/* Scroll-hands banner controller (no dependencies).
   Drives CSS custom properties on .banner.reaching:
     --reach   0→1  hands move inward until the fingertips touch
     --pulse   0→1→0 orb brightens/expands/turns on contact
     --ripple  0→1  contact ring expands (with --ripple-opacity)
     --mx/--my -1→1 pointer parallax, --float px  idle drift
   Reverse scrolling reverses the sequence. Honors prefers-reduced-motion. */
(function () {
  'use strict';

  function initBanner(el) {
    var section = el.parentElement;
    var preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    var x = 0, y = 0, tx = 0, ty = 0, raf = 0, previous = 0, progress = 0;

    // Fill the star field once if the markup left it empty.
    var stars = el.querySelector('.stars');
    if (stars && !stars.children.length) {
      var frag = document.createDocumentFragment();
      for (var i = 0; i < 48; i++) {
        var s = document.createElement('i');
        // three sizes: mostly faint pinpricks, some mid, a few bright
        var size = i % 7 === 0 ? 2.6 : (i % 3 === 0 ? 1.6 : 1);
        s.style.cssText =
          'left:' + ((i * 61.803) % 100).toFixed(3) + '%;' +
          'top:' + ((i * 37.317) % 100).toFixed(3) + '%;' +
          'width:' + size + 'px;height:' + size + 'px;' +
          '--g:' + (size * 2).toFixed(1) + 'px;' +                           // glow scales with the star
          '--o:' + (size === 1 ? 0.22 + (i % 4) * 0.07 : 0.45 + (i % 5) * 0.1).toFixed(2) + ';' +
          '--dur:' + (5 + ((i * 0.37) % 6)).toFixed(2) + 's;' +             // 5–11s per star
          'animation-delay:' + (-((i * 0.83) % 11)).toFixed(2) + 's';
        frag.appendChild(s);
      }
      stars.appendChild(frag);
    }

    var move = function (e) {
      var r = el.getBoundingClientRect();
      tx = Math.max(-1, Math.min(1, (e.clientX - r.left) / r.width * 2 - 1));
      ty = Math.max(-1, Math.min(1, (e.clientY - r.top) / r.height * 2 - 1));
    };
    var reset = function () { tx = 0; ty = 0; };
    var smooth = function (v) { v = Math.max(0, Math.min(1, v)); return v * v * (3 - 2 * v); };

    var frame = function (now) {
      var dt = Math.min(50, now - previous || 16); previous = now;
      var ease = 1 - Math.exp(-dt / 190);
      x += (tx - x) * ease; y += (ty - y) * ease;

      var reduce = preference.matches;
      var distance = Math.max(1, section.offsetHeight - window.innerHeight);
      var target = Math.max(0, Math.min(1, -section.getBoundingClientRect().top / distance));
      progress += (target - progress) * (1 - Math.exp(-dt / 95));

      // 0–3.2: approach · 3.2–5.6: contact, pulse and ring
      var cycle = progress * 5.6;
      var reach = smooth(cycle / 3.2);
      var contact = cycle - 3.2;
      var pulse = contact >= 0 && contact < 2.4
        ? Math.exp(-contact * 1.7) * Math.sin(Math.min(contact / 0.55, 1) * Math.PI / 2) : 0;
      var ripple = contact >= 0 && contact < 1.8 ? contact / 1.8 : 0;

      var st = el.style;
      st.setProperty('--reach', String(reduce ? 0 : reach));
      st.setProperty('--pulse', String(reduce ? 0 : pulse));
      st.setProperty('--ripple', String(reduce ? 0 : ripple));
      st.setProperty('--ripple-opacity', String(reduce || contact < 0 || contact >= 1.8 ? 0 : (1 - ripple) * 0.8));
      st.setProperty('--mx', String(reduce ? 0 : x));
      st.setProperty('--my', String(reduce ? 0 : y));
      st.setProperty('--float', (reduce ? 0 : Math.sin(now / 2300) * 6) + 'px');
      raf = requestAnimationFrame(frame);
    };

    var start = function () { if (!raf) { previous = 0; raf = requestAnimationFrame(frame); } };
    var stop = function () { cancelAnimationFrame(raf); raf = 0; };

    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', reset);
    el.addEventListener('pointerup', reset);

    // Only run the frame loop while the section is near the viewport.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries[0].isIntersecting ? start() : stop();
      }, { rootMargin: '25%' }).observe(section);
    } else {
      start();
    }
  }

  var boot = function () {
    var banners = document.querySelectorAll('.scroll-sequence > .banner.reaching');
    for (var i = 0; i < banners.length; i++) initBanner(banners[i]);
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();
