document
  .querySelector(".toggleNavigation")
  .addEventListener("click", function (e) {
    e.preventDefault();

    document.querySelector("#navigation ul").classList.toggle("nav-toggle");

    this.classList.toggle("crossactive");
  });

const yearEl = document.querySelector("#year");
if (yearEl) {
  yearEl.innerText = new Date().getFullYear();
}
