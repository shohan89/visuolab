/* Visuolab — page motion: smooth scroll, nav state, reveals, case stack, carousel */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var docEl = document.documentElement;

  /* ---- smooth scroll (Lenis, if it loaded) ------------------------------ */
  var lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new window.Lenis({
      lerp: 0.075, wheelMultiplier: 0.8, smoothWheel: true, smoothTouch: false,
      touchMultiplier: 1.6, gestureOrientation: 'vertical', autoResize: true
    });
    docEl.classList.add('lenis-on');
    window.lenis = lenis;                                          // handy for debugging / other scripts
    var loop = function (t) { lenis.raf(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    // in-page anchors go through Lenis so they ease instead of jump
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a || a.getAttribute('href').length < 2) return;
      var target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -60, duration: 1.4 });
    });
    lenis.on('scroll', function () { onScroll(); });               // reveals/nav stay in sync with the smooth position
    if (location.hash.length > 1) {                                 // arriving with #anchor: glide, don't jump
      var t0 = document.querySelector(location.hash);
      if (t0) requestAnimationFrame(function () { lenis.scrollTo(t0, { offset: -60, duration: 1.2, immediate: false }); });
    }
  }

  /* ---- hero copy: staggered rise on load -------------------------------- */
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { document.body.classList.add('loaded'); });
  });

  /* ---- nav: solid after scroll, dark text over light sections ---------- */
  var nav = document.getElementById('nav');
  var lights = Array.prototype.slice.call(document.querySelectorAll('.light'));
  var navH = nav.offsetHeight;
  function updateNav() {
    nav.classList.toggle('scrolled', window.scrollY > 24);
    var overLight = lights.some(function (s) {
      var r = s.getBoundingClientRect();
      var off = parseFloat(s.dataset.lightOffset || 0);   // px of the section that are still dark/blue
      return r.top + off <= navH * 0.6 && r.bottom >= navH * 0.6;
    });
    nav.classList.toggle('over-light', overLight);
  }

  /* ---- reveal on scroll ------------------------------------------------- */
  var reveals = document.querySelectorAll('.reveal');
  if (reduce || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ---- case stack: dim + blur the panel underneath as the next slides up  */
  var panels = Array.prototype.slice.call(document.querySelectorAll('.case-panel'));
  var stackOn = window.matchMedia('(min-width: 901px)');
  function updateStack() {
    if (!stackOn.matches || reduce) return;
    var vh = window.innerHeight;
    for (var i = 0; i < panels.length - 1; i++) {
      var next = panels[i + 1].getBoundingClientRect();
      // 0 while the next panel is below the fold, 1 once it has covered this one
      var p = 1 - (next.top - navH) / (vh - navH);
      p = Math.max(0, Math.min(1, p));
      panels[i].style.setProperty('--p', p.toFixed(3));
    }
  }

  /* ---- showreel: grows from 74% to 100% as it rises into view ----------- */
  var reel = document.querySelector('.reel');
  var reelVideo = reel && reel.querySelector('.reel-video');
  function updateReel() {
    if (!reel || reduce) return;
    var r = reel.getBoundingClientRect();
    var vh = window.innerHeight;
    // 0 when the panel's top is at the fold, 1 once it reaches ~18% from the top
    var p = (vh - r.top) / (vh * 0.82);
    p = Math.max(0, Math.min(1, p));
    p = p * p * (3 - 2 * p);
    reel.style.setProperty('--p', p.toFixed(3));
  }
  // only play a real video while the panel is on screen
  if (reelVideo && !reelVideo.hidden && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      en[0].isIntersecting ? reelVideo.play().catch(function () {}) : reelVideo.pause();
    }, { threshold: 0.2 }).observe(reel);
  }

  /* ---- manifesto: words brighten one by one as the paragraph scrolls ---- */
  var mani = document.querySelector('[data-scroll-words]');
  var words = [];
  if (mani) {
    (function split(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var s = document.createElement('span'); s.className = 'w'; s.textContent = part;
            frag.appendChild(s); words.push(s);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1) split(n);
      });
    })(mani);
  }
  function updateManifesto() {
    if (!words.length || reduce) return;
    var r = mani.getBoundingClientRect(), vh = window.innerHeight;
    var p = (vh * 0.85 - r.top) / (r.height + vh * 0.45);   // 0: top enters at 85% of the viewport → 1: bottom passes 40%
    p = Math.max(0, Math.min(1, p));
    var n = words.length, lit = p * n;
    for (var i = 0; i < n; i++) {
      var o = Math.max(0, Math.min(1, lit - i + 1));          // two-word ramp
      words[i].style.setProperty('--o', (0.2 + o * 0.8).toFixed(3));
    }
  }

  /* ---- live clocks (About: where we work) ------------------------------- */
  var clocks = Array.prototype.slice.call(document.querySelectorAll('.clock[data-tz]'));
  if (clocks.length && window.Intl) {
    var tick = function () {
      var now = new Date();
      clocks.forEach(function (c) {
        var opts = { timeZone: c.dataset.tz, hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' };
        var parts;
        try { parts = new Intl.DateTimeFormat('en-GB', Object.assign({ timeZoneName: 'shortOffset' }, opts)).formatToParts(now); }
        catch (e) { parts = new Intl.DateTimeFormat('en-GB', opts).formatToParts(now); }
        var get = function (t) { var p = parts.filter(function (x) { return x.type === t; })[0]; return p ? p.value : ''; };
        var h = parseInt(get('hour'), 10) % 24, wd = get('weekday');
        c.querySelector('.time').innerHTML = (h < 10 ? '0' + h : h) + '<i>:</i>' + get('minute');
        c.querySelector('.offset').textContent = get('timeZoneName');
        var weekend = wd === 'Sat' || wd === 'Sun', working = !weekend && h >= 9 && h < 18;
        c.classList.toggle('off', !working);
        c.querySelector('.status span').textContent = weekend ? 'Weekend' : working ? 'Working now' : 'After hours';
      });
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ---- FAQ accordion (one open at a time) ------------------------------- */
  var qas = Array.prototype.slice.call(document.querySelectorAll('.qa'));
  qas.forEach(function (qa) {
    qa.querySelector('.qa-q').addEventListener('click', function () {
      var wasOpen = qa.classList.contains('open');
      qas.forEach(function (o) { o.classList.remove('open'); o.querySelector('.qa-q').setAttribute('aria-expanded', 'false'); });
      if (!wasOpen) { qa.classList.add('open'); qa.querySelector('.qa-q').setAttribute('aria-expanded', 'true'); }
    });
  });

  /* ---- works index: filter chips ---------------------------------------- */
  var grid = document.getElementById('works-grid') || document.getElementById('posts-grid');
  if (grid) {
    var chips = Array.prototype.slice.call(document.querySelectorAll('.chip[data-filter]'));
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.wcard, .post'));
    var empty = document.querySelector('.works-empty');
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var f = chip.dataset.filter;
        chips.forEach(function (c) { var on = c === chip; c.classList.toggle('is-on', on); c.setAttribute('aria-pressed', on); });
        var shown = 0;
        cards.forEach(function (card) {
          var key = card.dataset.tags || card.dataset.cat || '';
          var hit = f === 'all' || (' ' + key + ' ').indexOf(' ' + f + ' ') > -1;
          card.classList.toggle('is-hidden', !hit);
          if (hit) { shown++; card.classList.add('in'); }
        });
        if (empty) empty.hidden = shown > 0;
      });
    });
  }

  /* ---- contact form: front-end only, shows a confirmation ---------------- */
  var cform = document.getElementById('contact-form');
  if (cform) {
    cform.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!cform.checkValidity()) { cform.reportValidity(); return; }
      var ok = cform.querySelector('.form-ok');
      var btn = cform.querySelector('button[type="submit"]');
      if (ok) ok.hidden = false;
      if (btn) { btn.disabled = true; btn.style.opacity = '.6'; }
      cform.querySelector('.form-note').hidden = true;
    });
  }

  /* ---- shared scroll driver -------------------------------------------- */
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { updateNav(); updateStack(); updateReel(); updateManifesto(); ticking = false; });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ---- article: table of contents + share rail -------------------------- */
  var tocList = document.querySelector('.toc-list');
  if (tocList) {
    var heads = [].slice.call(document.querySelectorAll('.prose h2'));
    if (heads.length) {
      heads.forEach(function (h, i) {
        if (!h.id) {
          h.id = h.textContent.trim().toLowerCase()
            .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 48) || ('section-' + (i + 1));
        }
        var a = document.createElement('a');
        a.href = '#' + h.id;
        a.textContent = h.textContent.trim();
        tocList.appendChild(a);
      });
      var links = [].slice.call(tocList.querySelectorAll('a'));
      /* highlight the heading the reader is currently under */
      var spy = function () {
        var top = window.scrollY + parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h') || 92) + 40;
        var current = 0;
        heads.forEach(function (h, i) { if (h.offsetTop <= top) current = i; });
        links.forEach(function (a, i) { a.classList.toggle('on', i === current); });
      };
      window.addEventListener('scroll', spy, { passive: true });
      spy();
    } else {
      var toc = document.querySelector('.toc');
      if (toc) toc.remove();
    }
  }

  var shareBox = document.querySelector('.share-btns');
  if (shareBox) {
    var url = location.href, title = document.title;
    var ico = function (d) { return '<svg viewBox="0 0 24 24">' + d + '</svg>'; };
    var nets = [
      { label: 'Share on X', href: 'https://twitter.com/intent/tweet?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(title),
        d: '<path d="M5 5l14 14M19 5L5 19"/>' },
      { label: 'Share on LinkedIn', href: 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url),
        d: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.5M12 17v-4a2 2 0 014 0v4"/>' },
      { label: 'Share on Facebook', href: 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url),
        d: '<path d="M14 8.5h2.5V5.2h-2.6c-2 0-3.4 1.4-3.4 3.5v1.8H8v3.3h2.5V21h3.4v-7.2h2.4l.4-3.3h-2.8V9.2c0-.5.3-.7.7-.7z"/>' }
    ];
    nets.forEach(function (n) {
      var a = document.createElement('a');
      a.href = n.href; a.target = '_blank'; a.rel = 'noopener';
      a.setAttribute('aria-label', n.label); a.title = n.label;
      a.innerHTML = ico(n.d);
      shareBox.appendChild(a);
    });
    var copy = document.createElement('button');
    copy.type = 'button';
    copy.setAttribute('aria-label', 'Copy link'); copy.title = 'Copy link';
    copy.innerHTML = ico('<rect x="9" y="9" width="12" height="12" rx="2.4"/><path d="M15 9V5.4A2.4 2.4 0 0012.6 3H5.4A2.4 2.4 0 003 5.4v7.2A2.4 2.4 0 005.4 15H9"/>');
    copy.addEventListener('click', function () {
      var done = function () {
        copy.classList.add('copied');
        copy.innerHTML = ico('<path d="M5 12.5l4.5 4.5L19 7.5"/>');
        setTimeout(function () {
          copy.classList.remove('copied');
          copy.innerHTML = ico('<rect x="9" y="9" width="12" height="12" rx="2.4"/><path d="M15 9V5.4A2.4 2.4 0 0012.6 3H5.4A2.4 2.4 0 003 5.4v7.2A2.4 2.4 0 005.4 15H9"/>');
        }, 1600);
      };
      if (navigator.clipboard) { navigator.clipboard.writeText(url).then(done, function () {}); }
    });
    shareBox.appendChild(copy);
  }

  /* ---- process steps: the + opens that phase's note, one at a time ----- */
  var stepBtns = document.querySelectorAll('.stair-btn');
  if (stepBtns.length) {
    var closeSteps = function (except) {
      stepBtns.forEach(function (b) { if (b !== except) b.setAttribute('aria-expanded', 'false'); });
    };
    stepBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        closeSteps(btn);
        btn.setAttribute('aria-expanded', btn.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
      });
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.stair-bar')) closeSteps(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSteps(); });
  }

  /* ---- mobile menu: built from the desktop nav's own links, so every page's
     relative paths are already right ------------------------------------- */
  var burger = document.querySelector('.nav-burger');
  if (burger && nav) {
    // Services: every column of the desktop dropdown, in its order, plus the sprint offer
    var svcGroups = [];
    nav.querySelectorAll('.mega-side .mega-col').forEach(function (col) {
      var label = col.querySelector('.mega-label');
      var links = [];
      col.querySelectorAll('ul a').forEach(function (a) { links.push({ href: a.getAttribute('href'), label: a.textContent.trim() }); });
      if (links.length) svcGroups.push({ label: label ? label.textContent.trim() : '', links: links });
    });
    var promo = nav.querySelector('.mega-promo');
    var mainLinks = [];
    nav.querySelectorAll('.nav-links > a').forEach(function (a) {
      mainLinks.push({ href: a.getAttribute('href'), label: a.textContent.trim() });
    });
    var cta = nav.querySelector('.nav-cta');
    var brand = nav.querySelector('.brand');
    var esc = function (t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; };
    var chev = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

    var panel = document.createElement('div');
    panel.className = 'mnav'; panel.id = 'mnav'; panel.hidden = true;
    panel.setAttribute('data-lenis-prevent', '');                  // Lenis is paused while open and would swallow the panel's own scroll
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'Menu');
    var i = 0, html = '<div class="mnav-top wrap">' + (brand ? brand.outerHTML : '') +
      '<button class="mnav-close" type="button" aria-label="Close menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<nav class="mnav-body wrap" aria-label="Mobile">';
    if (svcGroups.length) {
      html += '<button class="mnav-link mnav-toggle" type="button" aria-expanded="false" aria-controls="mnav-svc" style="--i:' + (i++) + '">Services' + chev + '</button>' +
        '<div class="mnav-sub" id="mnav-svc" hidden>' + svcGroups.map(function (g) {
          return '<div class="mnav-group"><p class="mnav-group-label">' + esc(g.label) + '</p><ul>' +
            g.links.map(function (l) { return '<li><a href="' + l.href + '">' + esc(l.label) + '</a></li>'; }).join('') + '</ul></div>';
        }).join('') +
        (promo ? '<a class="mnav-promo" href="' + promo.getAttribute('href') + '">' +
          '<b>' + esc((promo.querySelector('b') || promo).childNodes[0].textContent.trim()) +
          (promo.querySelector('.tag') ? ' <span class="tag">' + esc(promo.querySelector('.tag').textContent.trim()) + '</span>' : '') + '</b>' +
          (promo.querySelector(':scope > span') ? '<span>' + esc(promo.querySelector(':scope > span').textContent.trim()) + '</span>' : '') + '</a>' : '') +
        '</div>';
    }
    mainLinks.forEach(function (l) { html += '<a class="mnav-link" style="--i:' + (i++) + '" href="' + l.href + '">' + esc(l.label) + '</a>'; });
    html += '</nav><div class="mnav-foot wrap" style="--i:' + i + '">' +
      (cta ? cta.outerHTML.replace('nav-cta', 'mnav-cta') : '') +
      '<a class="mnav-mail" href="mailto:hello@visuolab.studio">hello@visuolab.studio</a></div>';
    panel.innerHTML = html;
    document.body.appendChild(panel);

    burger.setAttribute('aria-controls', 'mnav');
    burger.setAttribute('aria-expanded', 'false');
    var closeBtn = panel.querySelector('.mnav-close');
    var toggle = panel.querySelector('.mnav-toggle');
    var sub = panel.querySelector('.mnav-sub');
    var isOpen = false, hideTimer = null;

    var openMenu = function () {
      if (isOpen) return; isOpen = true;
      clearTimeout(hideTimer);
      panel.hidden = false;
      void panel.offsetWidth;                                   // commit the start state so it animates in
      panel.classList.add('is-open');
      docEl.classList.add('mnav-open');
      burger.setAttribute('aria-expanded', 'true');
      if (lenis) lenis.stop();
      closeBtn.focus();
    };
    var closeMenu = function (restoreFocus) {
      if (!isOpen) return; isOpen = false;
      panel.classList.remove('is-open');
      docEl.classList.remove('mnav-open');
      burger.setAttribute('aria-expanded', 'false');
      if (lenis) lenis.start();
      hideTimer = setTimeout(function () { panel.hidden = true; }, reduce ? 0 : 380);
      if (restoreFocus !== false) burger.focus();
    };
    burger.addEventListener('click', openMenu);
    closeBtn.addEventListener('click', function () { closeMenu(); });
    if (toggle) toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      sub.hidden = !open;
    });
    panel.addEventListener('click', function (e) {             // following a link closes the menu behind it
      if (e.target.closest('a')) closeMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (!isOpen) return;
      if (e.key === 'Escape') { closeMenu(); return; }
      if (e.key !== 'Tab') return;                              // keep Tab inside the open menu
      var f = Array.prototype.filter.call(panel.querySelectorAll('a, button'), function (el) { return el.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    window.matchMedia('(min-width: 901px)').addEventListener('change', function (m) { if (m.matches) closeMenu(false); });
  }

  /* ---- reviews carousel ------------------------------------------------- */
  var track = document.getElementById('carousel');
  if (track) {
    var step = function () { var card = track.querySelector('.review-card'); return card ? card.getBoundingClientRect().width + 16 : 400; };
    document.querySelectorAll('[data-carousel]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        track.scrollBy({ left: btn.dataset.carousel === 'next' ? step() : -step(), behavior: 'smooth' });
      });
    });
  }
})();
