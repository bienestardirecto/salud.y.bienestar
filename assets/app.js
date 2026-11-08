/* Funcionalidad base: funciona sin las librerías de movimiento.
   Tonos, filtros, carriles horizontales, arrastre y estado de "consultado". */
(function () {
  'use strict';
  var WA = document.documentElement.getAttribute('data-wa') || '';
  function waUrl(text) { return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(text); }
  var fine = window.matchMedia('(pointer: fine)').matches;

  /* Selector de tono: actualiza el mensaje, el código y la confirmación visible */
  document.querySelectorAll('.card').forEach(function (card) {
    var sel = card.querySelector('select[data-tonos]');
    if (!sel) return;
    var link = card.querySelector('a[data-pre]');
    var code = card.querySelector('.code');
    var pick = card.querySelector('.tono-pick');
    sel.addEventListener('change', function () {
      var o = sel.options[sel.selectedIndex];
      var c = o.getAttribute('data-c');
      var tono = o.value ? ', tono ' + o.value + (c ? ' (cód. ' + c + ')' : '') : '';
      link.href = waUrl(link.getAttribute('data-pre') + tono + '. ' + link.getAttribute('data-post'));
      if (code) code.textContent = c ? 'Cód. ' + c : '';
      if (pick) pick.textContent = o.value ? 'Tono elegido: ' + o.value : '';
      card.dispatchEvent(new CustomEvent('tone', { bubbles: true }));
    });
  });

  /* Estado visual al consultar */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('.btn-buy, .btn-fill, .btn-nav, .float-wa');
    if (!a) return;
    var lbl = a.querySelector('.lbl');
    var card = a.closest('.card');
    if (card) {
      document.querySelectorAll('.card.picked').forEach(function (c) { c.classList.remove('picked'); });
      card.classList.add('picked');
    }
    if (!lbl || a.classList.contains('sent')) return;
    var prev = lbl.textContent;
    a.classList.add('sent'); lbl.textContent = 'Abriendo WhatsApp…';
    setTimeout(function () { a.classList.remove('sent'); lbl.textContent = prev; }, 2400);
  });

  /* Carriles: flechas, contador, barra de avance */
  function railInfo(rail) {
    var wrap = rail.closest('.catalog');
    var cards = Array.prototype.filter.call(rail.querySelectorAll('.card'), function (c) { return !c.hidden; });
    var n = cards.length;
    var w = cards[0] ? cards[0].getBoundingClientRect().width + 18 : 320;
    var first = Math.min(n, Math.round(rail.scrollLeft / w) + 1);
    var vis = Math.max(1, Math.floor((rail.clientWidth - 30) / w));
    var last = Math.min(n, first + vis - 1);
    var meta = wrap.querySelector('.rail-meta');
    if (meta) meta.textContent = (first === last ? pad(first) : pad(first) + '–' + pad(last)) + ' / ' + pad(n);
    var max = rail.scrollWidth - rail.clientWidth;
    var bar = wrap.querySelector('.rail-line b');
    if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? Math.max(0.08, vis / n + (1 - vis / n) * (rail.scrollLeft / max)) : 1) + ')';
    var prev = wrap.querySelector('[data-dir="-1"]'), next = wrap.querySelector('[data-dir="1"]');
    if (prev) prev.disabled = rail.scrollLeft < 8;
    if (next) next.disabled = rail.scrollLeft >= max - 8;
  }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  window.__railInfo = railInfo;

  document.querySelectorAll('.rail').forEach(function (rail) {
    var wrap = rail.closest('.catalog');
    var ticking = false;
    rail.addEventListener('scroll', function () {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () { ticking = false; railInfo(rail); });
    }, { passive: true });
    wrap.querySelectorAll('.rail-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        var card = rail.querySelector('.card:not([hidden])');
        var step = (card ? card.getBoundingClientRect().width + 18 : 320) * Math.max(1, Math.floor(rail.clientWidth / 360));
        rail.scrollBy({ left: step * Number(b.getAttribute('data-dir')), behavior: 'smooth' });
      });
    });
    /* Los gestos horizontales del trackpad quedan en el carril (no los toma el scroll suave vertical) */
    rail.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) e.stopPropagation();
    }, { passive: true });
    /* Arrastre con mouse (escritorio). En pantallas táctiles se usa el desplazamiento nativo. */
    if (fine) {
      var down = false, moved = false, sx = 0, sl = 0, vx = 0, lx = 0, lt = 0, raf = 0;
      rail.addEventListener('pointerdown', function (e) {
        if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('a,button,select,label')) return;
        down = true; moved = false; sx = lx = e.clientX; sl = rail.scrollLeft; lt = performance.now(); vx = 0;
        cancelAnimationFrame(raf);
        rail.style.scrollSnapType = 'none'; rail.style.scrollBehavior = 'auto';
      });
      window.addEventListener('pointermove', function (e) {
        if (!down) return;
        var dx = e.clientX - sx;
        if (!moved && Math.abs(dx) > 6) { moved = true; rail.classList.add('dragging'); }
        if (!moved) return;
        e.preventDefault();
        rail.scrollLeft = sl - dx;
        var now = performance.now(); vx = (e.clientX - lx) / Math.max(1, now - lt); lx = e.clientX; lt = now;
      });
      function settle() {
        rail.classList.remove('dragging');
        var cards = Array.prototype.filter.call(rail.querySelectorAll('.card'), function (c) { return !c.hidden; });
        var pl = parseFloat(getComputedStyle(rail).paddingLeft) || 0, best = rail.scrollLeft, d = Infinity;
        cards.forEach(function (c) { var x = c.offsetLeft - pl; if (Math.abs(x - rail.scrollLeft) < d) { d = Math.abs(x - rail.scrollLeft); best = x; } });
        rail.style.scrollBehavior = '';
        rail.scrollTo({ left: best, behavior: 'smooth' });
        setTimeout(function () { rail.style.scrollSnapType = ''; }, 500);
      }
      window.addEventListener('pointerup', function () {
        if (!down) return; down = false;
        if (!moved) { rail.style.scrollSnapType = ''; rail.style.scrollBehavior = ''; return; }
        var v = -vx * 16;
        (function glide() {
          v *= 0.92; rail.scrollLeft += v;
          if (Math.abs(v) > 0.8) raf = requestAnimationFrame(glide); else settle();
        })();
      });
      // un arrastre no debe abrir un enlace por accidente
      rail.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    }
    railInfo(rail);
  });
  window.addEventListener('resize', function () { document.querySelectorAll('.rail').forEach(railInfo); });

  /* Videos de TikTok: el reproductor oficial carga cuando la tarjeta se acerca a la pantalla
     (muestra la portada del video como vista previa y se reproduce ahí mismo al tocar play).
     Si los reproductores externos están bloqueados (vista previa de claude.ai), el enlace abre TikTok. */
  function ttLoad(face, autoplay) {
    if (!face.isConnected) return;
    var id = face.getAttribute('data-tt');
    var f = document.createElement('iframe');
    f.className = 'tt-frame';
    f.src = 'https://www.tiktok.com/player/v1/' + id + '?music_info=1&description=1&rel=0&autoplay=' + (autoplay ? 1 : 0);
    f.title = face.getAttribute('aria-label');
    f.loading = 'lazy';
    f.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
    f.setAttribute('allowfullscreen', '');
    face.replaceWith(f);
  }
  if (window.__TT_EMBED !== false) {
    var faces = document.querySelectorAll('.tt-face');
    if ('IntersectionObserver' in window) {
      var tio = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { tio.unobserve(e.target); ttLoad(e.target, false); } });
      }, { rootMargin: '300px 300px' });
      faces.forEach(function (f) { tio.observe(f); });
    }
    document.addEventListener('click', function (e) {
      var face = e.target.closest('.tt-face');
      if (!face) return;
      e.preventDefault(); ttLoad(face, true);
    });
  }

  /* Filtros por grupo */
  document.querySelectorAll('[data-chips]').forEach(function (box) {
    var rail = document.getElementById(box.getAttribute('data-chips'));
    if (!rail) return;
    box.addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b || b.getAttribute('aria-pressed') === 'true') return;
      box.querySelectorAll('.chip').forEach(function (c) { c.setAttribute('aria-pressed', c === b ? 'true' : 'false'); });
      var g = b.getAttribute('data-g');
      var shown = [];
      rail.querySelectorAll('.card').forEach(function (c) {
        var on = g === '*' || c.getAttribute('data-g') === g;
        c.hidden = !on; if (on) shown.push(c);
      });
      rail.scrollLeft = 0;
      railInfo(rail);
      box.dispatchEvent(new CustomEvent('filtered', { bubbles: true, detail: { chip: b, cards: shown } }));
    });
  });
})();
