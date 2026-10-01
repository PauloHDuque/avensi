var swiper = new Swiper(".mySwiper", {
  slidesPerView: 3,
  spaceBetween: 30,
  loop: true,
  freeMode: true,
  autoplay: {
    delay: 2000,
    disableOnInteraction: false,
  },
  breakpoints: {
    1024: {
      slidesPerView: 3,
      spaceBetween: 30,
    },
    768: {
      slidesPerView: 2,
      spaceBetween: 20,
    },
    0: {
      slidesPerView: 1,
      spaceBetween: 10,
    },
  },
});

