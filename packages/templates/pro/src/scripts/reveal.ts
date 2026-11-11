// Reveals [data-reveal] elements and counts [data-count] numbers up when they scroll into view.
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function countUp(el: HTMLElement) {
  const target = Number(el.dataset.count);
  const format = el.dataset.format ?? "number";
  const formatter =
    format === "cop"
      ? new Intl.NumberFormat("es-CO", {
          style: "currency",
          currency: "COP",
          maximumFractionDigits: 0,
        })
      : new Intl.NumberFormat("es-CO");
  if (reduced || !Number.isFinite(target)) {
    el.textContent = formatter.format(target);
    return;
  }
  const start = performance.now();
  const duration = 1600;
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = formatter.format(Math.round(target * eased));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target as HTMLElement;
      if (el.dataset.delay) el.style.setProperty("--delay", `${el.dataset.delay}ms`);
      el.classList.add("is-visible");
      if (el.dataset.count) countUp(el);
      observer.unobserve(el);
    }
  },
  { rootMargin: "0px 0px -12% 0px" },
);

document
  .querySelectorAll<HTMLElement>("[data-reveal], [data-count]")
  .forEach((el) => observer.observe(el));
