const items = document.querySelectorAll<HTMLElement>("[data-reveal]");
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }
  },
  { rootMargin: "0px 0px -10% 0px" },
);
items.forEach((el) => observer.observe(el));
