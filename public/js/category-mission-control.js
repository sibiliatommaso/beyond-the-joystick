(() => {
  const root = document.querySelector('.mc-category');
  if (!root) return;
  const items = root.querySelectorAll('.mc-briefing, .mc-featured, .mc-card, .mc-divisions');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || !('IntersectionObserver' in window)) {
    items.forEach((item) => item.classList.add('is-visible'));
    return;
  }
  items.forEach((item) => item.classList.add('mc-reveal'));
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  items.forEach((item) => observer.observe(item));
})();
