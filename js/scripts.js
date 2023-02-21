$(function () {
  // $(window).on("scroll", function () {
  //   var Header = $("header#home").height(),
  //     ScrTop = $(this).scrollTop(),
  //     $Nav = $("nav#navigation");

  //   if (
  //     ScrTop > Header * 0.2 &&
  //     ScrTop < Header &&
  //     $(window).outerWidth() > 768
  //   ) {
  //     $Nav.fadeOut("fast");
  //   } else {
  //     if (ScrTop < Header * 0.2) {
  //       $Nav.removeClass("opacity").fadeIn("fast");
  //     } else {
  //       $Nav.addClass("opacity").fadeIn("fast");
  //     }
  //   }

  // });

  $("a.toggleNavigation").on("click", function (e) {
    e.preventDefault();

    var $nav = $("nav#navigation ul");

    if ($nav.is(":visible")) {
      $nav.fadeOut("slow");
    } else {
      $nav.fadeIn("slow");
    }

    $(this).toggleClass("crossactive");

    return false;
  });
});
