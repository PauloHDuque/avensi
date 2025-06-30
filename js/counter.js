const counters = document.querySelectorAll(".counter");

const observer = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const counter = entry.target;
      const target = +counter.getAttribute("data-target");
      const symbol = counter.getAttribute("data-symbol") || "";
      let count = 0;
      const increment = target / 100;

      const updateCounter = () => {
        if (count < target) {
          count += increment;
          counter.innerText = `${Math.ceil(count)}${symbol}`;
          setTimeout(updateCounter, 30);
        } else {
          counter.innerText = `${target}${symbol}`;
        }
      };

      updateCounter();
      observer.unobserve(counter);
    }
  });
}, {
  threshold: 0.6,
});

counters.forEach((counter) => {
  observer.observe(counter);
});
