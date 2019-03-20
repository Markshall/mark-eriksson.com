$(function() {
	$('header#home').css('height', $(window).height());
	
	$(window).on('resize orientationchange', function() {
		$('header#home').css('height', $(window).height());
		$('body').css('width', $(window).width());
	}).on('scroll', function() {
		var Header = $('header#home').height(),
			ScrTop = $(this).scrollTop(),
			$Nav   = $('nav#navigation');
		
		if ((ScrTop > Header*.20) && (ScrTop < Header) && ($(window).outerWidth() > 768)) {
			$Nav.fadeOut('fast');
		} else {
			if (ScrTop < Header*.20) {
				$Nav.removeClass('opacity').fadeIn('fast');
			} else {
				$Nav.addClass('opacity').fadeIn('fast');
			}
		}
		
		//animate in my face
    if (ScrTop > $('#about').offset().top-650) {
      $('.profile-picture').addClass('fademein');
    }
	});
	
	$('a.toggleNavigation').on('click', function(e) {
		e.preventDefault();
		
		var $nav = $('nav#navigation ul');
    
    $nav[$nav.is(':visible') ? 'fadeOut' : 'fadeIn']('slow');
		
		$(this).toggleClass('crossactive');
		
		return false;
	});
	
	$('form#contactForm').on('submit', function(e) {
		e.preventDefault();
		
		var formName    = $('#contactName').val(),
        formEmail   = $('#contactEmail').val(),
        formSubject = $('#contactSubject').val(),
        formContent = $('#contactContent').val(),
        formError   = '',
        emailFilter = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,6})+$/;
		
		if (formName.length < 1 || formEmail.length < 1 || formSubject.length < 1 || formContent.length < 1) {
			formError = 'All fields are required.';
		} else if (!emailFilter.test(formEmail)) {
			formError = 'Please enter a valid email address.';
		} else if (formContent.length <= 20) {
			formError = 'Your message must be more than 20 characters long.';
		}
		
		if (formError.length > 1) {
			$('div#contactResult').removeClass('error success').addClass('error');
			$('span#contactResultIcon').removeClass('fa fa-check yay fa-times aww').addClass('fa fa-times aww');
			$('span#contactResultText').text(formError);

			$('div#contactResult').fadeIn('fast');
			
			setTimeout(function(){
				$('div#contactResult').fadeOut('slow');
			}, 7000);
		} else {
			$('button#contactSubmit').attr('disabled', 'disabled');
			$('img#Loading').fadeIn('fast');
			$('div#contactResult').fadeOut('fast');

			$.ajax({
				url: "inc/contactSend.php",
				type: "POST",
				dataType: "json",
				data: $(this).serialize(),
				cache: false,
				success: function(r) {
					if (r.error) {
						$('div#contactResult').removeClass('error success').addClass('error');
						$('span#contactResultIcon').removeClass('fa fa-check yay fa-times aww').addClass('fa fa-times aww');
						$('span#contactResultText').text(r.error);

						$('div#contactResult').fadeIn('fast');
					} else {
						$('div#contactResult').removeClass('error success').addClass('success');
						$('span#contactResultIcon').removeClass('fa fa-check yay fa-times aww').addClass('fa fa-check yay');
						$('span#contactResultText').text('Yay, your message has been sent successfully!');

						$('.contact-row .input-group input.contains-contents, .contact-row .input-group textarea.contains-contents').removeClass('contains-contents');

						$('#contactName, #contactEmail, #contactSubject, #contactContent').val('');

						$('div#contactResult').fadeIn('fast');
					}
				},
				error: function() {
					$('div#contactResult').removeClass('error success').addClass('error');
					$('span#contactResultIcon').removeClass('fa fa-check yay fa-times aww').addClass('fa fa-times aww');
					$('span#contactResultText').text('Woops, an error occurred with the jQuery AJAX request.');

					$('div#contactResult').fadeIn('fast');
					$('img#Loading').fadeOut('fast');
				}
			}).complete(function() {
				$('img#Loading').fadeOut('fast');
				$('button#contactSubmit').removeAttr('disabled');

				setTimeout(function(){
					$('div#contactResult').fadeOut('slow');
				}, 7000);
			});
		}
		
		return false;
	});
	
	$('.scrolly').on('click', function(e) {
		e.preventDefault();
		
		var section  = this.hash,
			$section = $(section);
		
		$('html, body').stop().animate({
			'scrollTop': $section.offset().top
		}, 800, 'swing',function(){
			window.location.hash = section
		});
	});
	
	$('.contact-row .input-group input, .contact-row .input-group textarea').focusout(function() {
		var selfVal = $(this).val();
		
    $(this)[
      (selfVal !== '') ? 'addClass' : 'removeClass'
    ]('contains-contents');
	});
	
	var waypoints = $("section").waypoint(function(d) {
		var $activeSection = $(this.element);
		
		if (d === 'up')
		  $activeSection = $activeSection.prev();
		
		var $activeLink = $('nav#navigation ul li a[href="#' + $activeSection.attr('id') + '"]');
    
    $('nav#navigation ul li').removeClass('active');
		$activeLink.parent().addClass('active');
  }, {offset: '25px'});
});