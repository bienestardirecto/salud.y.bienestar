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
    var box = face.parentNode;
    if (!box || box.querySelector('.tt-frame')) {
      var old = box && box.querySelector('.tt-frame');
      if (old && autoplay && old.src.indexOf('autoplay=1') < 0) old.src = old.src.replace('autoplay=0', 'autoplay=1');
      return;
    }
    var id = face.getAttribute('data-tt');
    var f = document.createElement('iframe');
    f.className = 'tt-frame';
    f.src = 'https://www.tiktok.com/player/v1/' + id + '?music_info=1&description=1&rel=0&autoplay=' + (autoplay ? 1 : 0);
    f.title = face.getAttribute('aria-label');
    f.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
    f.setAttribute('allowfullscreen', '');
    f.addEventListener('load', function () { setTimeout(function () { f.classList.add('ready'); face.setAttribute('tabindex', '-1'); }, 700); });
    box.appendChild(f);
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

  /* Medición: cada clic a WhatsApp se registra con su origen (portada, menú, flotante, producto,
     categoría, video, cierre). Funciona con GA4 y/o Microsoft Clarity si están configurados. */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-origen]');
    if (!a) return;
    var d = { origen: a.getAttribute('data-origen'), producto: a.getAttribute('data-producto') || '' };
    try {
      (window.dataLayer = window.dataLayer || []).push({ event: 'whatsapp_click', origen: d.origen, producto: d.producto });
      if (typeof window.gtag === 'function') window.gtag('event', 'whatsapp_click', { origen: d.origen, producto: d.producto, transport_type: 'beacon' });
      if (typeof window.clarity === 'function') { window.clarity('event', 'whatsapp_' + d.origen); window.clarity('set', 'producto', d.producto); }
    } catch (err) { /* la medición nunca debe impedir abrir WhatsApp */ }
  }, true);

  /* Celular: lista vertical con los primeros 6 productos y "Ver los N" */
  var mobile = window.matchMedia('(max-width: 700px)');
  var SHOW = 6;
  function collapse(rail) {
    var btn = document.querySelector('.more-btn[data-rail="' + rail.id + '"]');
    var vis = Array.prototype.filter.call(rail.querySelectorAll('.card'), function (c) { return !c.hidden; });
    var on = mobile.matches && !rail.hasAttribute('data-open') && vis.length > SHOW + 1;
    Array.prototype.forEach.call(rail.querySelectorAll('.card'), function (c) { c.classList.remove('more-hidden'); });
    if (on) vis.slice(SHOW).forEach(function (c) { c.classList.add('more-hidden'); });
    if (btn) { btn.hidden = !on; btn.textContent = 'Ver los ' + vis.length + ' productos'; }
  }
  document.querySelectorAll('.rail').forEach(collapse);
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.more-btn');
    if (!b) return;
    var rail = document.getElementById(b.getAttribute('data-rail'));
    rail.setAttribute('data-open', '');
    collapse(rail);
    var first = rail.querySelectorAll('.card:not([hidden])')[SHOW];
    if (first) first.focus && first.querySelector('a,select') && first.querySelector('a,select').focus({ preventScroll: true });
  });
  (mobile.addEventListener ? mobile.addEventListener('change', function () { document.querySelectorAll('.rail').forEach(collapse); }) : null);
  document.addEventListener('filtered', function (e) {
    var rail = document.getElementById(e.target.getAttribute('data-chips'));
    if (rail) collapse(rail);
  });

  /* Atajos "¿Qué buscás?": filtran la categoría y llevan al catálogo */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-find]');
    if (!a) return;
    var rail = document.getElementById(a.getAttribute('data-find'));
    if (!rail) return;
    e.preventDefault();
    var g = a.getAttribute('data-g');
    var box = document.querySelector('[data-chips="' + rail.id + '"]');
    var chip = box && box.querySelector('.chip[data-g="' + (window.CSS && CSS.escape ? CSS.escape(g) : g) + '"]');
    if (chip && chip.getAttribute('aria-pressed') !== 'true') chip.click();
    var target = rail.closest('.catalog');
    if (window.__lenis) window.__lenis.scrollTo(target, { offset: -72 });
    else { var y = target.getBoundingClientRect().top + window.pageYOffset - 72; window.scrollTo({ top: y, behavior: 'smooth' }); }
    if (history.replaceState) history.replaceState(null, '', '#' + target.id);
  });

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

/* Naturaleza y Ciencia: entrada suave */
(function(){var s=document.querySelector(".nc");if(!s)return;if(!("IntersectionObserver" in window)){s.classList.add("is-in");return}var io=new IntersectionObserver(function(e){if(e[0].isIntersecting){s.classList.add("is-in");io.disconnect()}},{threshold:.15});io.observe(s)})();
