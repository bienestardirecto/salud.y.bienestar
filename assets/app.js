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
    // En computadoras se precargan como vista previa; en celulares se cargan recién al tocar play
    // (precargar varios reproductores a la vez traba el scroll y TikTok muestra "Watch on TikTok").
    var ttMobile = !window.matchMedia('(min-width: 900px) and (pointer: fine)').matches;
    if (!ttMobile && 'IntersectionObserver' in window) {
      var tio = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { tio.unobserve(e.target); ttLoad(e.target, false); } });
      }, { rootMargin: '300px 300px' });
      faces.forEach(function (f) { tio.observe(f); });
    }
    document.addEventListener('click', function (e) {
      var face = e.target.closest('.tt-face');
      if (!face) return;
      e.preventDefault();
      if (ttMobile) document.querySelectorAll('.tt-box .tt-frame').forEach(function (fr) {
        if (fr.parentNode !== face.parentNode) { var pf = fr.parentNode.querySelector('.tt-face'); if (pf) pf.removeAttribute('tabindex'); fr.remove(); }
      });
      ttLoad(face, true);
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

/* Videos: flechas, contador y gestos horizontales del trackpad */
(function(){
  var rail=document.getElementById('tt-rail'); if(!rail) return;
  var cards=rail.querySelectorAll('.tt-card'), cnt=document.querySelector('.tt-count'), btns=document.querySelectorAll('.tt-btn');
  function info(){
    var r=rail.getBoundingClientRect(), first=-1, last=-1;
    cards.forEach(function(c,i){var b=c.getBoundingClientRect(),vis=Math.min(b.right,r.right)-Math.max(b.left,r.left);if(vis>b.width*.6){if(first<0)first=i;last=i;}});
    if(first<0){first=last=0;}
    if(cnt) cnt.textContent=(first===last?(first+1):(first+1)+'–'+(last+1))+' de '+cards.length+' videos';
    btns[0].disabled=rail.scrollLeft<4; btns[1].disabled=rail.scrollLeft+rail.clientWidth>=rail.scrollWidth-4;
  }
  btns.forEach(function(b){b.addEventListener('click',function(){
    var w=cards[0].getBoundingClientRect().width+18, n=Math.max(1,Math.floor(rail.clientWidth/w));
    rail.scrollBy({left:w*n*Number(b.getAttribute('data-dir')),behavior:'smooth'});
  });});
  var t=false; rail.addEventListener('scroll',function(){if(t)return;t=true;requestAnimationFrame(function(){t=false;info();});},{passive:true});
  rail.addEventListener('wheel',function(e){if(Math.abs(e.deltaX)>Math.abs(e.deltaY))e.stopPropagation();},{passive:true});
  window.addEventListener('resize',info); info();
})();

/* Pedido con varios productos: se agregan desde cada tarjeta y se envía un solo mensaje por WhatsApp.
   Se recuerda en este navegador (si el almacenamiento está disponible). */
(function () {
  var cart = document.getElementById('cart'); if (!cart) return;
  var WA = document.documentElement.getAttribute('data-wa') || '';
  var KEY = 'bd-pedido-v1', items = [];
  try { items = JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch (e) { items = []; }
  var list = cart.querySelector('.cart-list'), panel = document.getElementById('cart-panel');
  var tog = cart.querySelector('[data-cart-toggle]'), send = cart.querySelector('.cart-send');
  function num(s) { var n = parseFloat(String(s).replace(/[^0-9,]/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; }
  function money(n) { return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {} }
  function key(id, tono) { return id + '|' + (tono || ''); }
  function find(k) { for (var i = 0; i < items.length; i++) if (items[i].k === k) return i; return -1; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function message() {
    var lines = items.map(function (it) {
      return '• ' + it.q + ' x ' + it.n + (it.t ? ', tono ' + it.t : '') + (it.c ? ' (cód. ' + it.c + ')' : '') + ' — ' + money(it.p) + (it.q > 1 ? ' c/u' : '');
    });
    var tot = items.reduce(function (a, it) { return a + it.p * it.q; }, 0);
    return 'Hola, quiero hacer este pedido:\n' + lines.join('\n') + '\n\nTotal según precios publicados: ' + money(tot) +
      '\n¿Me confirmás disponibilidad, envío y forma de pago?';
  }
  function syncCards() {
    document.querySelectorAll('.card[data-item]').forEach(function (card) {
      var id = card.id.replace(/^p-/, ''), on = items.some(function (it) { return it.id === id; });
      card.classList.toggle('in-cart', on);
      var b = card.querySelector('[data-add]'); if (!b) return;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.querySelector('.add-i').textContent = on ? '✓' : '+';
      b.querySelector('.add-l').textContent = on ? 'En tu pedido · quitar' : 'Agregar al pedido';
    });
  }
  function render() {
    var count = items.reduce(function (a, it) { return a + it.q; }, 0);
    var tot = items.reduce(function (a, it) { return a + it.p * it.q; }, 0);
    cart.hidden = !items.length;
    document.documentElement.classList.toggle('has-cart', !!items.length);
    if (!items.length) { panel.hidden = true; tog.setAttribute('aria-expanded', 'false'); }
    cart.querySelector('.cart-n').textContent = count;
    cart.querySelector('.cart-tot').textContent = money(tot);
    cart.querySelector('.cart-t b').textContent = count === 1 ? '1 producto' : count + ' productos';
    list.innerHTML = items.map(function (it, i) {
      return '<li><div class="ci-t"><b>' + esc(it.n) + '</b>' + (it.t ? '<span>Tono: ' + esc(it.t) + '</span>' : '') +
        '<span>' + money(it.p) + (it.c ? ' · Cód. ' + esc(it.c) : '') + '</span></div>' +
        '<div class="ci-q"><button type="button" data-q="-1" data-i="' + i + '" aria-label="Quitar uno">−</button><span>' + it.q + '</span>' +
        '<button type="button" data-q="1" data-i="' + i + '" aria-label="Agregar uno">+</button></div></li>';
    }).join('');
    send.href = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(message());
    send.setAttribute('data-producto', items.map(function (it) { return it.id; }).join(','));
    syncCards(); save();
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-add]');
    if (b) {
      var card = b.closest('.card'), id = card.id.replace(/^p-/, '');
      var existing = items.filter(function (it) { return it.id === id; });
      if (existing.length) { items = items.filter(function (it) { return it.id !== id; }); render(); return; }
      var sel = card.querySelector('select[data-tonos]'), tono = '', cod = card.getAttribute('data-cod');
      if (sel) {
        var o = sel.options[sel.selectedIndex];
        if (!o || !o.value) { var pk = card.querySelector('.tono-pick'); if (pk) pk.textContent = 'Elegí un tono para agregarlo'; sel.focus(); return; }
        tono = o.value; cod = o.getAttribute('data-c') || cod;
      }
      items.push({ k: key(id, tono), id: id, n: card.getAttribute('data-item'), t: tono, c: cod, p: num(card.getAttribute('data-precio')), q: 1 });
      render();
      cart.classList.remove('bump'); void cart.offsetWidth; cart.classList.add('bump');
      return;
    }
    var q = e.target.closest('[data-q]');
    if (q && cart.contains(q)) {
      var i = Number(q.getAttribute('data-i')); items[i].q += Number(q.getAttribute('data-q'));
      if (items[i].q < 1) items.splice(i, 1);
      render(); return;
    }
    if (e.target.closest('[data-cart-toggle]')) {
      panel.hidden = !panel.hidden; tog.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true'); return;
    }
    if (e.target.closest('[data-cart-close]')) { panel.hidden = true; tog.setAttribute('aria-expanded', 'false'); return; }
    if (e.target.closest('[data-cart-clear]')) { items = []; render(); }
  });
  render();
})();
