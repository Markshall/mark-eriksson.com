<?php
$result = array();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
	$name    = ucwords(htmlspecialchars($_POST['contactName']));
	$email   = htmlspecialchars($_POST['contactEmail']);
	$subject = htmlspecialchars($_POST['contactSubject']);
	$msg     = nl2br(htmlspecialchars($_POST['contactContent']));
	
	if (isset($_POST['contactTel']) && strlen($_POST['contactTel']) > 0) {
		$result['error'] = 'No bots allowed.';
	} else {
		if (empty($name) || empty($email) || empty($subject) || empty($msg)) {
			$result['error'] = 'All fields are required.';
		} else {
			if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
				$result['error'] = 'Please enter a valid email address.';
			} else {
				if (strlen($msg) <= 20) {
					$result['error'] = 'Your message must be more than 20 characters long.';
				} else {
					//start email
					$to = 'markeriksson94@live.co.uk';
					$headers = "From: contact@mark-eriksson.com\r\nReply-To: {$email}\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=ISO-8859-1\r\n";
					
					$message = "<table border=\"1\"><tbody><tr><td><strong>Name:</strong></td><td>{$name}</td></tr><tr><td><strong>Email:</strong></td><td>{$email}</td></tr><tr><td><strong>Date sent:</strong></td><td>" . date ("jS F Y - g:i a") . "</td></tr><tr><td><strong>IP Address:</strong></td><td>{$_SERVER['REMOTE_ADDR']}</td></tr><tr><td colspan=\"2\"><strong>Message:</strong><br /><br />{$msg}</td></tr></tbody></table>";
					
					if (!@mail($to, $subject, $message, $headers)) {
						$result['error'] = 'Your email could not be sent at this time.';
					} else {						
						$result['success'] = 'Yes';
						$result['name'] = $name;
					}
				}
			}
		}
	}		
}

print json_encode($result);
?>