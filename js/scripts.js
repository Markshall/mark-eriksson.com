document
  .querySelector(".toggleNavigation")
  .addEventListener("click", function (e) {
    e.preventDefault();

    document.querySelector("#navigation ul").classList.toggle("nav-toggle");

    this.classList.toggle("crossactive");
  });
