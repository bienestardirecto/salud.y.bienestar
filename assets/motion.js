/* Capa de movimiento: GSAP + ScrollTrigger + SplitText, Lenis (solo escritorio)
   y la escena 3D (Three.js, carga diferida). Todo es mejora progresiva:
   si algo falla, el contenido, los precios y WhatsApp siguen funcionando. */
(function () {
  'use strict';
  var h = document.documentElement;
  var gsap = window.gsap, ST = window.ScrollTrigger;
  if (!gsap || !ST) { h.classList.remove('motion'); return; }
  window.__motionReady = true;
  gsap.registerPlugin(ST);
  if (window.SplitText) gsap.registerPlugin(window.SplitText);

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(pointer: fine)').matches;
  var wide = window.matchMedia('(min-width: 901px)');
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------------- Escena 3D (diferida) ---------------- */
  var canvas = $('#scene');
  var scene = null, zone = { state: 'hero', on: true, el: $('.hero-slot') }, lastP = 0;
  function applyZone() {
    if (!scene) return;
    scene.setState(zone.state, zone.el);
    scene.setActive(zone.on);
    canvas.classList.toggle('on', zone.on);
  }
  function setZone(state, on, el) { zone = { state: state, on: on, el: el || null }; applyZone(); }
  function loadScene() {
    var conn = navigator.connection;
    if (!canvas || (conn && conn.saveData)) return;
    var s = document.createElement('script');
    s.src = 'assets/objects.js'; s.async = true;
    s.onload = function () {
      if (!window.Scene3D) return;
      scene = window.Scene3D.init(canvas, { low: !wide.matches || (navigator.hardwareConcurrency || 8) <= 4, still: reduce, pointer: fine });
      if (!scene) return;
      window.__scene = scene;
      syncZone();
      applyZone();
      if (!reduce) {
        var ex = { v: 0 };
        gsap.to(ex, { v: 1.08, duration: 2.4, ease: 'power2.out', onUpdate: function () { scene.setExposure(ex.v); } });
      }
    };
    document.head.appendChild(s);
  }
  function whenIdle(fn) {
    var go = function () { ('requestIdleCallback' in window) ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 300); };
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
  }
  whenIdle(loadScene);

  /* Zonas: qué muestra la escena en cada parte de la página */
  var zoneST = [];
  function zt(o, fn) {
    o.onToggle = function (s) { if (s.isActive) fn(); };
    zoneST.push({ st: ST.create(o), fn: fn });
  }
  function syncZone() { zoneST.forEach(function (z) { if (z.st.isActive) z.fn(); }); }
  function zones() {
    zt({ trigger: '.hero', start: 'top top', end: 'bottom 45%' }, function () { setZone('hero', true, $('.hero-slot')); });
    zt({ trigger: '.how', start: 'top 55%', end: 'bottom 45%' }, function () { setZone('orbit', wide.matches); });
    $$('.cat').forEach(function (cat) {
      var i = cat.getAttribute('data-i');
      var intro = $('.cat-intro', cat), catalog = $('.catalog', cat), slot = $('.cat-c', intro);
      zt({ trigger: intro, start: 'top 55%', end: 'bottom 45%' }, function () { setZone('focus' + i, true, slot); });
      zt({ trigger: catalog, start: 'top 45%', end: 'bottom 55%' }, function () { setZone('focus' + i, false, slot); });
      ST.create({ trigger: intro, start: 'top bottom', end: 'bottom top', onUpdate: function (s) { if (scene && zone.state === 'focus' + i) { lastP = s.progress; scene.setFocusProgress(lastP); } } });
    });
    zt({ trigger: '.trust', start: 'top 55%', endTrigger: '.faq', end: 'bottom 45%' }, function () { setZone('orbit', false); });
    zt({ trigger: '.final', start: 'top 35%', end: 'bottom top' }, function () { setZone('final', wide.matches); });
    ST.create({ start: 0, end: 'max', onUpdate: function (s) { if (!scene) return; scene.setVelocity(s.getVelocity()); if (reduce) scene.setFocusProgress(lastP); } });
  }

  /* Fondo negro de las presentaciones de categoría: una capa fija detrás del 3D,
     recortada exactamente al área visible de cada presentación */
  var layers = $$('.stage-bg'), intros = $$('.cat-intro');
  function paintDark() {
    var vh = window.innerHeight;
    intros.forEach(function (el, i) {
      var L = layers[i]; if (!L) return;
      var r = el.getBoundingClientRect();
      L.style.clipPath = (r.bottom > 0 && r.top < vh)
        ? 'inset(' + Math.max(0, r.top).toFixed(1) + 'px 0 ' + Math.max(0, vh - r.bottom).toFixed(1) + 'px 0)'
        : 'inset(100% 0 0 0)';
    });
  }
  if (layers.length && intros.length) {
    h.classList.add('dark-layer');
    ST.create({ start: 0, end: 'max', onUpdate: paintDark, onRefresh: paintDark });
    window.addEventListener('resize', paintDark);
    window.addEventListener('scroll', paintDark, { passive: true });
    paintDark();
  }

  /* Con movimiento reducido: escena estática, sin animaciones. Solo cambia de estado. */
  if (reduce) {
    h.classList.remove('motion');
    zones();
    return;
  }

  /* ---------------- Desplazamiento suave (escritorio) ---------------- */
  var lenis = null;
  if (fine && window.Lenis) {
    lenis = new window.Lenis({ duration: 1.05, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }, anchors: true, smoothWheel: true });
    lenis.on('scroll', ST.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    // los selectores nativos no deben mover la página
    $$('select').forEach(function (s) { s.setAttribute('data-lenis-prevent', ''); });
  }

  /* ---------------- Escritorio vs. celular ---------------- */
  var mm = gsap.matchMedia();
  mm.add('(min-width: 901px)', function () {
    /* Cómo comprar: sección fijada, el contenido cambia con el scroll */
    var how = $('.how');
    var li = $$('.steps li', how), bars = $$('.step-bar b', how);
    gsap.set(li.slice(1), { opacity: 0, y: 40 });
    var tl = gsap.timeline({ scrollTrigger: { trigger: how, start: 'top top', end: '+=210%', pin: true, scrub: 0.6, anticipatePin: 1 } });
    tl.to(bars[0], { scaleX: 1, duration: 1, ease: 'none' })
      .to(li[0], { opacity: 0, y: -40, duration: 0.35 })
      .to(li[1], { opacity: 1, y: 0, duration: 0.35 }, '<0.12')
      .to(bars[1], { scaleX: 1, duration: 1, ease: 'none' })
      .to(li[1], { opacity: 0, y: -40, duration: 0.35 })
      .to(li[2], { opacity: 1, y: 0, duration: 0.35 }, '<0.12')
      .to(bars[2], { scaleX: 1, duration: 1, ease: 'none' });
    /* Presentaciones de categoría: columnas a distintas profundidades */
    $$('.cat-intro').forEach(function (intro) {
      gsap.fromTo($('.cat-l', intro), { y: 70 }, { y: -50, ease: 'none', scrollTrigger: { trigger: intro, start: 'top bottom', end: 'bottom top', scrub: true } });
      gsap.fromTo($('.cat-r', intro), { y: 120 }, { y: -30, ease: 'none', scrollTrigger: { trigger: intro, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    return function () { gsap.set(li, { clearProps: 'all' }); gsap.set(bars, { clearProps: 'all' }); };
  });
  mm.add('(max-width: 900px)', function () { $('.how').classList.add('no-pin'); return function () { $('.how').classList.remove('no-pin'); }; });

  /* ---------------- Hero: secuencia de entrada ---------------- */
  var lines = $$('.hero h1 .ln');
  lines.forEach(function (ln) {
    var inner = document.createElement('span');
    inner.className = 'ln-i'; inner.style.display = 'block';
    while (ln.firstChild) inner.appendChild(ln.firstChild);
    ln.appendChild(inner);
    ln.style.overflow = 'hidden'; ln.style.paddingBottom = '.09em'; ln.style.marginBottom = '-.09em';
  });
  var heroFades = $$('.hero .m-fade');
  gsap.set(heroFades, { y: 18 });
  gsap.set('.float-wa', { y: 30, opacity: 0 });
  var intro = gsap.timeline({ defaults: { ease: 'expo.out' } });
  intro.set(lines, { opacity: 1 })
    .from($$('.ln-i'), { yPercent: 112, duration: 1.15, stagger: 0.09 }, 0.05)
    .to(heroFades, { opacity: 1, y: 0, duration: 0.9, stagger: 0.05 }, 0.25)
    .to('.float-wa', { y: 0, opacity: 1, duration: 0.8 }, 0.5)
    .fromTo('.nav', { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.8 }, 0.1)
    .fromTo('.hero-glow', { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 1.4, ease: 'expo.inOut' }, 0.45);

  /* Hero al salir: profundidad por capas */
  gsap.to('.hero h1', { yPercent: -18, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero .hero-bottom', { y: -60, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '.hero', start: '40% top', end: 'bottom top', scrub: true } });
  gsap.to('.hero-bg', { '--bgy': '18vh', ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.glow[data-glow="h"]', { yPercent: 40, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  $('.glow[data-glow="h"]').classList.add('on');

  /* ---------------- Navegación: fondo, progreso, sección activa ---------------- */
  ST.create({ trigger: '.hero', start: 'bottom 80px', onEnter: function () { $('.nav').classList.add('solid'); }, onLeaveBack: function () { $('.nav').classList.remove('solid'); } });
  gsap.to('.progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });
  $$('.nav-links a').forEach(function (a) {
    var t = $(a.getAttribute('href'));
    if (!t) return;
    ST.create({ trigger: t, start: 'top 50%', end: 'bottom 50%', onToggle: function (s) { a.setAttribute('aria-current', s.isActive ? 'true' : 'false'); } });
  });

  /* ---------------- Apariciones genéricas ---------------- */
  var fades = $$('.m-fade').filter(function (el) { return !el.closest('.hero'); });
  gsap.set(fades, { y: 24 });
  ST.batch(fades, { start: 'top 88%', once: true, onEnter: function (b) { gsap.to(b, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.07 }); } });
  $$('.dash').forEach(function (d) {
    gsap.fromTo(d, { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: d, start: 'top 92%', once: true } });
  });

  /* Títulos que aparecen por máscara de líneas */
  function splitHeads() {
    if (!window.SplitText) return;
    $$('.split').forEach(function (el) {
      window.SplitText.create(el, {
        type: 'lines', mask: 'lines', autoSplit: true, linesClass: 'sl',
        onSplit: function (self) {
          return gsap.from(self.lines, { yPercent: 112, duration: 1.2, ease: 'expo.out', stagger: 0.08,
            scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
        }
      });
    });
  }

  /* ---------------- Transiciones entre escenas ---------------- */
  $$('.cat').forEach(function (cat) {
    var i = cat.getAttribute('data-i');
    var intro = $('.cat-intro', cat);
    // cortina: un paño marrón se recoge hacia arriba al entrar en cada escena
    gsap.fromTo($('.curtain', intro), { scaleY: 1 }, { scaleY: 0, ease: 'power2.inOut', scrollTrigger: { trigger: intro, start: 'top 95%', end: 'top 45%', scrub: 0.5 } });
    // cambio de iluminación ambiental por categoría
    var glow = $('.glow[data-glow="' + i + '"]');
    ST.create({ trigger: cat, start: 'top 60%', end: 'bottom 40%', onToggle: function (s) { glow.classList.toggle('on', s.isActive); } });
    // contador de productos
    var b = $('[data-count]', intro);
    if (b) {
      var n = Number(b.getAttribute('data-count')), o = { v: 0 };
      ST.create({ trigger: b, start: 'top 90%', once: true, onEnter: function () {
        gsap.to(o, { v: n, duration: 1.4, ease: 'power3.out', onUpdate: function () { b.textContent = Math.round(o.v); } });
      } });
    }
    // las tarjetas entran desde la derecha, con perspectiva
    var rail = $('.rail', cat);
    // Solo se ocultan para la entrada si el carril todavía está fuera de pantalla.
    // Red de seguridad: si por cualquier motivo la animación no corre, se muestran igual.
    var pre = rail.getBoundingClientRect().top > window.innerHeight ? $$('.card', rail).slice(0, 6) : [];
    if (pre.length) gsap.set(pre, { opacity: 0 });
    var revealed = false;
    function safety() { if (!revealed) { revealed = true; gsap.to(pre, { opacity: 1, duration: 0.4, clearProps: 'opacity' }); } }
    if (pre.length && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (es, io) {
        if (es[0].isIntersecting) { io.disconnect(); setTimeout(safety, 900); }
      }).observe(rail);
    }
    ST.create({ trigger: rail, start: 'top bottom-=60', once: true, onEnter: function () {
      revealed = true;
      if (!pre.length) return;
      var W = window.innerWidth;
      var cards = $$('.card:not([hidden])', rail);
      var inView = cards.filter(function (c) { return c.getBoundingClientRect().left < W; });
      // las que quedan fuera de pantalla a la derecha se muestran ya, sin animación
      gsap.set(pre.filter(function (c) { return inView.indexOf(c) < 0; }), { clearProps: 'opacity' });
      gsap.fromTo(inView, { opacity: 0, x: 80, rotateY: -14 }, { opacity: 1, x: 0, rotateY: 0, duration: 1.1, ease: 'expo.out', stagger: 0.07, clearProps: 'transform,opacity' });
    } });
  });
  zones();

  /* ---------------- Catálogo: profundidad y respuesta ---------------- */
  // paralaje de la imagen dentro de cada tarjeta según su posición en el carril
  $$('.rail').forEach(function (rail) {
    var layers = $$('[data-depth]', rail), raf = 0;
    function update() {
      raf = 0;
      var W = window.innerWidth;
      layers.forEach(function (l) {
        var r = l.parentNode.getBoundingClientRect();
        if (r.right < -50 || r.left > W + 50) return;
        var f = ((r.left + r.width / 2) / W - 0.5);
        l.style.translate = (f * -22).toFixed(1) + 'px 0';
      });
    }
    rail.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', update);
    update();
  });

  // inclinación 3D de tarjetas al pasar el cursor (solo mouse)
  if (fine) {
    $$('.card').forEach(function (card) {
      var rx = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3.out' });
      var ry = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3.out' });
      var media = $('.card-media', card);
      var mx = gsap.quickTo(media, 'x', { duration: 0.6, ease: 'power3.out' });
      var my = gsap.quickTo(media, 'y', { duration: 0.6, ease: 'power3.out' });
      card.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        ry(x * 7); rx(-y * 7); mx(x * 6); my(y * 6);
      });
      card.addEventListener('pointerleave', function () { rx(0); ry(0); mx(0); my(0); });
    });
  }

  // foto del producto: acercamiento al pasar el cursor (o al tocar en celular)
  $$('.card-media').forEach(function (media) {
    var img = $('img', media) || $('.ph', media);
    if (!img) return;
    gsap.set(img, { transformPerspective: 900 });
    var spin = null, inside = false;
    function enter() {
      inside = true;
      if (spin) spin.kill();
      spin = gsap.to(img, { scale: 1.16, z: 50, duration: 0.8, ease: 'power3.out' });
    }
    function leave() {
      inside = false;
      if (spin) spin.kill();
      spin = gsap.to(img, { scale: 1, z: 0, duration: 0.6, ease: 'power3.out' });
    }
    if (fine) {
      media.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') enter(); });
      media.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') leave(); });
    }
    media.addEventListener('click', function () {
      if (fine && inside) { enter(); return; }
      enter(); setTimeout(leave, 1700);
    });
  });

  // indicador deslizante de los filtros + reentrada de tarjetas
  $$('[data-chips]').forEach(function (box) {
    var ind = document.createElement('span'); ind.className = 'chip-ind'; ind.setAttribute('aria-hidden', 'true');
    box.insertBefore(ind, box.firstChild);
    function place(chip, animate) {
      var p = { x: chip.offsetLeft, y: chip.offsetTop, width: chip.offsetWidth, height: chip.offsetHeight };
      if (animate) gsap.to(ind, Object.assign({ duration: 0.55, ease: 'expo.out' }, p)); else gsap.set(ind, p);
    }
    var cur = function () { return $('.chip[aria-pressed="true"]', box); };
    place(cur(), false);
    window.addEventListener('resize', function () { place(cur(), false); });
    document.fonts && document.fonts.ready.then(function () { place(cur(), false); });
    box.addEventListener('filtered', function (e) {
      place(e.detail.chip, true);
      var W = window.innerWidth;
      var vis = e.detail.cards.filter(function (c) { return c.getBoundingClientRect().left < W; });
      gsap.fromTo(vis, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out', stagger: 0.05, clearProps: 'transform,opacity' });
    });
  });

  // confirmación del tono elegido
  document.addEventListener('tone', function (e) {
    var p = $('.tono-pick', e.target);
    if (p) gsap.fromTo(p, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out' });
  });

  // FAQ: apertura suave
  $$('.faq details').forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (d.open) gsap.fromTo($('.ans', d), { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.6, ease: 'expo.out', clearProps: 'height' });
    });
  });

  // botones magnéticos (moderado, solo mouse)
  if (fine) {
    $$('.magnetic').forEach(function (el) {
      var x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
      var y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        x(Math.max(-8, Math.min(8, (e.clientX - r.left - r.width / 2) * 0.22)));
        y(Math.max(-6, Math.min(6, (e.clientY - r.top - r.height / 2) * 0.3)));
      });
      el.addEventListener('pointerleave', function () {
        gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, .45)' });
      });
    });
  }

  /* Fuentes listas: dividir títulos y recalcular posiciones */
  var ready = document.fonts ? document.fonts.ready : Promise.resolve();
  ready.then(function () { splitHeads(); ST.refresh(); });
  window.addEventListener('load', function () { ST.refresh(); });
})();
