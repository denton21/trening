window.Trainer = window.Trainer || {};

(function () {
  const { $ } = Trainer;

  const EURO_ORDER = Trainer.EURO_ORDER;
  const RED = Trainer.EURO_RED;

  function colorOf(n) {
    if (n === 0) return 'green';
    return RED.has(n) ? 'red' : 'black';
  }

  function polar(cx, cy, r, deg) {
    const rad = ((deg - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad)
    };
  }

  function arcPath(cx, cy, rOuter, rInner, startDeg, endDeg) {
    const large = endDeg - startDeg > 180 ? 1 : 0;
    const o1 = polar(cx, cy, rOuter, startDeg);
    const o2 = polar(cx, cy, rOuter, endDeg);
    const i1 = polar(cx, cy, rInner, endDeg);
    const i2 = polar(cx, cy, rInner, startDeg);
    return [
      `M ${o1.x.toFixed(3)} ${o1.y.toFixed(3)}`,
      `A ${rOuter} ${rOuter} 0 ${large} 1 ${o2.x.toFixed(3)} ${o2.y.toFixed(3)}`,
      `L ${i1.x.toFixed(3)} ${i1.y.toFixed(3)}`,
      `A ${rInner} ${rInner} 0 ${large} 0 ${i2.x.toFixed(3)} ${i2.y.toFixed(3)}`,
      'Z'
    ].join(' ');
  }

  function renderWheel(svg) {
    if (!svg) return;

    const cx = 160;
    const cy = 160;
    const rOuter = 148;
    const rInner = 78;
    const rText = 116;
    const n = EURO_ORDER.length;
    const step = 360 / n;

    const parts = [];
    parts.push(`<circle class="rim" cx="${cx}" cy="${cy}" r="154" />`);
    parts.push(`<circle class="rim-inner" cx="${cx}" cy="${cy}" r="150" />`);

    EURO_ORDER.forEach((num, i) => {
      const start = i * step;
      const end = (i + 1) * step;
      const mid = start + step / 2;
      const cls = `seg seg-${colorOf(num)}`;
      const d = arcPath(cx, cy, rOuter, rInner, start, end);
      parts.push(`<path class="${cls}" data-num="${num}" d="${d}" />`);
      const p = polar(cx, cy, rText, mid);
      const rot = mid;
      parts.push(
        `<text class="seg-num" x="${p.x.toFixed(2)}" y="${p.y.toFixed(2)}" transform="rotate(${rot.toFixed(2)} ${p.x.toFixed(2)} ${p.y.toFixed(2)})">${num}</text>`
      );
    });

    parts.push(`<circle class="hub" cx="${cx}" cy="${cy}" r="52" />`);
    parts.push(`<circle class="hub-core" cx="${cx}" cy="${cy}" r="28" />`);
    parts.push(`<text class="hub-text" x="${cx}" y="${cy}" fill="#f6e27a">EURO</text>`);

    svg.setAttribute('viewBox', '0 0 320 320');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Европейское колесо рулетки 0–36');
    svg.innerHTML = parts.join('');
  }

  function wireWheel(svg, infoEl) {
    if (!svg || !infoEl) return;

    const picked = infoEl.querySelector('.ref-picked');
    const meta = infoEl.querySelector('.ref-picked-meta');

    function setPick(num) {
      const c = colorOf(num);
      picked.textContent = String(num);
      picked.className = `ref-picked is-${c}`;
      Trainer.replayClass?.(picked, 'is-pop');
      const colorRu = c === 'green' ? 'зеро' : c === 'red' ? 'красное' : 'чёрное';
      meta.textContent = num === 0 ? 'Зеро · европейская рулетка' : `${colorRu} · прямая ×35`;
      svg.querySelectorAll('.seg').forEach((el) => {
        el.classList.toggle('is-hot', Number(el.dataset.num) === num);
      });
    }

    svg.addEventListener('click', (e) => {
      const seg = e.target.closest('.seg');
      if (!seg) return;
      setPick(Number(seg.dataset.num));
    });

    svg.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
    });

    // Default highlight
    setPick(0);
  }

  function wireNav() {
    const nav = $('#refNav');
    const root = $('#referenceTab');
    if (!nav || !root) return;

    const buttons = Array.from(nav.querySelectorAll('[data-ref-target]'));
    const sections = buttons
      .map((btn) => document.getElementById(btn.dataset.refTarget))
      .filter(Boolean);

    function setActive(id) {
      buttons.forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.refTarget === id);
      });
    }

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = document.getElementById(btn.dataset.refTarget);
        if (!target) return;
        setActive(btn.dataset.refTarget);
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    if ('IntersectionObserver' in window && sections.length) {
      const io = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
          if (visible[0]) {
            setActive(visible[0].target.id);
          }
        },
        { rootMargin: '-20% 0px -55% 0px', threshold: [0.15, 0.4, 0.7] }
      );
      sections.forEach((s) => io.observe(s));
    }
  }

  Trainer.stopReference = function stopReference() {
    // static tab — nothing to stop
  };

  Trainer.initReference = function initReference() {
    const svg = $('#refWheel');
    const info = $('#refWheelInfo');
    Trainer.fillPayoutTables?.($('#referenceTab') || document);
    renderWheel(svg);
    wireWheel(svg, info);
    wireNav();
  };
})();
