# How deploys work

Pushing to `master` builds the site on GitHub Actions and uploads it to the web server with rsync over SSH. The server's SSH port is closed to everything except a few known IPs, so the GitHub runner reaches it over [Tailscale](https://tailscale.com) instead of the public internet.

The secrets the workflow needs are listed in the [README](../README.md#deploying).

## Step by step

1. **Push to `master`.** GitHub matches the push against `on: push` in `.github/workflows/deploy.yml` and starts a fresh Ubuntu VM (the "runner"). It is thrown away when the job ends.
2. **Build.** The runner checks out the repo, runs `npm ci` and `npm run build`, and ends up with the site in `dist/`. Nothing has touched the server yet.
3. **Connect to Tailscale.** `tailscale/github-action` installs Tailscale, uses the OAuth client (`TS_OAUTH_CLIENT_ID` / `TS_OAUTH_SECRET`) to get a short-lived single-use login tagged `tag:ci`, and joins the tailnet as a temporary device with its own `100.x.y.z` address. The runner and the server are now on the same private network.
4. **Configure SSH.** The runner writes the deploy private key (`DEPLOY_SSH_KEY`), the server's public host key (`DEPLOY_KNOWN_HOSTS`) and a small SSH config to `~/.ssh/`.
5. **Upload.** `scripts/deploy.sh` runs rsync over SSH to `DEPLOY_HOST`, the server's Tailscale address. Only changed files are sent; old ones are removed.
6. **Clean up.** The action logs out of Tailscale, the temporary device is removed from the tailnet, and the VM is destroyed.

## What the SSH connection really goes through

```
Runner                                         Web server
──────                                         ──────────
rsync/ssh → <tailscale ip>:22                  sshd :22
   │                                              ▲
   ▼                                              │
tailscale0 (virtual network card)              tailscale0
   │  wraps SSH in an encrypted                   │  unwraps it and hands it
   │  WireGuard packet                            │  to sshd as normal
   ▼                                              │
UDP → server's public IP ──► host firewall ──► tailscaled
      (or via a Tailscale relay over 443)
```

SSH thinks it is talking to an ordinary address on port 22. Underneath, Tailscale wraps each packet in encrypted WireGuard and sends it across the internet as UDP. On the server it is unwrapped and passed to `sshd`, which sees a normal connection from the runner's `100.x` address.

## Why the firewall lets it through

The firewall in the hosting control panel only allows **incoming** connections to port 22 from known IPs. Tailscale never makes an incoming connection to port 22:

- The server's Tailscale client keeps an **outgoing** connection to Tailscale's coordination service. Outgoing traffic, and its replies, are allowed.
- When the runner joins, the coordination service tells each machine the other's public address, and **both** send UDP to each other at the same time. To the firewall, the runner's packets look like replies to traffic the server just sent ("NAT traversal").
- If a direct path can't be made, both sides connect **out** to a Tailscale relay (DERP) over HTTPS port 443, which passes the encrypted packets between them.
- The firewall only ever sees encrypted UDP or HTTPS. The SSH traffic inside is unwrapped on the server, after the firewall.

Port 22 stays closed to the internet. Tailscale is a separate, authenticated way in that only devices on the tailnet can use.

## What keeps it secure

Three things all have to line up:

1. **Tailscale membership.** Only someone with the OAuth secret can add a `tag:ci` device to the tailnet.
2. **Host key.** The runner refuses to talk to anything that isn't the server (`DEPLOY_KNOWN_HOSTS`).
3. **SSH key.** The server only accepts the runner because the deploy public key is in `authorized_keys`.

The deploy key is a separate, passphrase-less key pair used only for this. If it ever leaks, delete its line from the server's `authorized_keys` and nothing else is affected.

Tailscale's access controls should limit `tag:ci` to SSH on the web server, so a CI runner can't reach other devices on the tailnet:

```json
"grants": [
  { "src": ["autogroup:member"], "dst": ["*"],               "ip": ["*"] },
  { "src": ["tag:ci"],           "dst": ["<server tailscale ip>"], "ip": ["tcp:22"] }
]
```

## Setting it up again

1. **Deploy key.** `ssh-keygen -t ed25519 -f ~/.ssh/<name>-deploy -N "" -C "github-actions-deploy"`, then add the `.pub` line to the deploy user's `~/.ssh/authorized_keys` on the server, and `gh secret set DEPLOY_SSH_KEY < ~/.ssh/<name>-deploy`.
2. **Tailscale on the server.** `curl -fsSL https://tailscale.com/install.sh | sh`, `sudo tailscale up`, and `tailscale ip -4` for `DEPLOY_HOST`.
3. **Host key.** Run `ssh-keyscan <tailscale ip>` from a machine on the tailnet (or the server itself) for `DEPLOY_KNOWN_HOSTS`.
4. **Tailscale admin console.** Add `"tagOwners": { "tag:ci": ["autogroup:admin"] }` to the access controls, then create an OAuth client (Settings → Trust credentials / OAuth clients) with **Auth Keys: Write** and tag `tag:ci`. Store its ID and secret as `TS_OAUTH_CLIENT_ID` and `TS_OAUTH_SECRET`.
5. **GitHub token.** Pushing changes to `.github/workflows/` needs a token with the `workflow` scope: `gh auth refresh -s workflow` then `gh auth setup-git`.

## Troubleshooting

| Error in the Upload step                 | Meaning                                                                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `Connection timed out`                   | Packets aren't reaching the server. The runner isn't on the tailnet, or `DEPLOY_HOST` is the public address.                   |
| `Host key verification failed`           | `DEPLOY_KNOWN_HOSTS` is empty or was scanned from a different address than `DEPLOY_HOST`.                                       |
| `Permission denied (publickey,password)` | The server was reached but refused the key. Check the key is really in `authorized_keys` and `DEPLOY_USER` is right.           |

The server's `/var/log/auth.log` shows which user and address each attempt came from, which tells the cases apart.

**Testing a key properly.** A `Host *` / `IdentityFile` line in your local `~/.ssh/config` makes SSH offer your personal key on every connection, so a test can succeed without the deploy key ever being used. `ssh-copy-id` is fooled the same way and reports "All keys were skipped". Ignore the config when testing:

```shell
ssh -F /dev/null -o IdentitiesOnly=yes -i ~/.ssh/<name>-deploy <user>@<host> 'echo ok'
```

and use `ssh-copy-id -f` to force the install.
