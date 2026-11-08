/* Objetos de la portada en 2.5D: cuatro imágenes realistas (frasco, pote, cápsula y gota)
   que flotan, siguen al cursor y se reacomodan según la sección visible.
   Misma interfaz que tenía la escena 3D (window.Scene3D.init), así motion.js no cambia.
   Solo anima transform y opacity. */
(function () {
  'use strict';
  var SRC = [
    { src: 'images/hero/frasco.webp', w: 381, h: 703, alt: 'Frasco de suplemento' },
    { src: 'images/hero/pote.webp', w: 458, h: 336, alt: 'Pote de crema' },
    { src: 'images/hero/capsula.webp', w: 271, h: 369, alt: 'Cápsula' },
    { src: 'images/hero/gota.webp', w: 279, h: 486, alt: 'Gota de concentrado' }
  ];
  function lerp(a, b, k) { return a + (b - a) * k; }

  function init(host, opts) {
    opts = opts || {};
    var still = !!opts.still;
    var objs = SRC.map(function (d, i) {
      var img = document.createElement('img');
      img.src = d.src; img.alt = ''; img.decoding = 'async';
      img.width = d.w; img.height = d.h;
      img.className = 'obj obj-' + i;
      host.appendChild(img);
      return { el: img, w: d.w, h: d.h, seed: i * 1.7 + 0.4, cur: { x: 0, y: 0, s: 0.3, op: 0, r: 0 }, tgt: null, first: true };
    });

    var state = 'hero', anchor = null, focusP = 0, vel = 0, spin = 0, active = true, visible = true;
    var intro = still ? 1 : 0;
    var ptr = { x: 0, y: 0, tx: 0, ty: 0 };
    var W = window.innerWidth, H = window.innerHeight, narrow = W < 900;

    // tamaño objetivo (alto en px) → escala de la imagen
    function S(o, hpx) { return hpx / o.h; }

    function layout(A) {
      var t = [];
      if (state === 'hero') {
        if (!narrow) {
          t = [
            { x: 0.69 * W, y: 0.46 * H, h: 0.6 * H, r: -5, d: 1.0 },
            { x: 0.85 * W, y: 0.53 * H, h: 0.2 * H, r: 4, d: 0.6 },
            { x: 0.59 * W, y: 0.76 * H, h: 0.2 * H, r: -30, d: 1.3 },
            { x: 0.87 * W, y: 0.27 * H, h: 0.25 * H, r: 9, d: 0.8 }
          ];
        } else if (A) {
          t = [
            { x: A.x - 0.26 * A.w, y: A.y, h: 1.0 * A.h, r: -5, d: 1 },
            { x: A.x + 0.12 * A.w, y: A.y + 0.2 * A.h, h: 0.42 * A.h, r: 4, d: 0.6 },
            { x: A.x + 0.02 * A.w, y: A.y + 0.3 * A.h, h: 0.38 * A.h, r: -30, d: 1.3 },
            { x: A.x + 0.36 * A.w, y: A.y - 0.18 * A.h, h: 0.5 * A.h, r: 9, d: 0.8 }
          ];
        }
      } else if (state === 'orbit' || state === 'final') {
        var fin = state === 'final';
        var cx = fin ? 0.78 * W : 0.5 * W, cy = fin ? 0.42 * H : 0.5 * H;
        var hh = fin ? 0.2 * H : 0.17 * H;
        for (var i = 0; i < 4; i++) t.push({ orbit: { cx: cx, cy: cy, rx: fin ? 0.1 * W : 0.1 * W, ry: 0.1 * H, i: i }, h: hh * (i === 0 ? 1.5 : 1), r: 0, d: 1 });
      } else if (state.indexOf('focus') === 0) {
        var k = Number(state.slice(5));
        for (var j = 0; j < 4; j++) {
          if (j === k && A) {
            var o = objs[j], box = Math.min(A.h * 0.95, (A.w * 0.9) * o.h / o.w);
            t.push({ x: A.x, y: A.y, h: box, r: 0, d: 0.5, focus: true });
          } else {
            t.push({ x: (j % 2 ? 1.2 : -0.2) * W, y: (j < 2 ? -0.2 : 1.2) * H, h: 0.2 * H, r: 0, d: 1, op: 0 });
          }
        }
      }
      return t;
    }

    function frame(now, snap) {
      var t = now / 1000;
      var dt = Math.min((now - (frame.last || now)) / 1000, 0.05); frame.last = now;
      var k = snap ? 1 : 1 - Math.pow(0.004, dt);
      var ka = snap ? 1 : 1 - Math.pow(0.00004, dt);
      ptr.x = lerp(ptr.x, ptr.tx, still ? 1 : 1 - Math.pow(0.03, dt));
      ptr.y = lerp(ptr.y, ptr.ty, still ? 1 : 1 - Math.pow(0.03, dt));
      vel *= Math.pow(0.1, dt); spin += vel * dt;
      var A = null;
      if (anchor) {
        var rc = anchor.getBoundingClientRect();
        if (rc.height > 0) A = { x: rc.left + rc.width / 2, y: rc.top + rc.height / 2, w: rc.width, h: rc.height };
      }
      var L = layout(A);
      objs.forEach(function (o, i) {
        var g = L[i], c = o.cur;
        if (!g) { c.op = lerp(c.op, 0, k); o.el.style.opacity = c.op.toFixed(3); return; }
        var tx, ty;
        if (g.orbit) {
          var a = (still ? 0 : t * 0.3) + g.orbit.i * Math.PI / 2;
          tx = g.orbit.cx + Math.cos(a) * g.orbit.rx; ty = g.orbit.cy + Math.sin(a) * g.orbit.ry;
        } else { tx = g.x; ty = g.y; }
        var ts = S(o, g.h), top = g.op === undefined ? 1 : g.op;
        if (o.first) { c.x = tx; c.y = ty + 60; c.s = ts * 0.9; c.r = g.r; o.first = false; }
        var kk = (A && !g.orbit && state !== 'hero') || (A && narrow) ? ka : k;
        c.x = lerp(c.x, tx, kk); c.y = lerp(c.y, ty, kk); c.s = lerp(c.s, ts, k);
        c.op = lerp(c.op, top, k); c.r = lerp(c.r, g.r, k);
        var bob = still ? 0 : Math.sin(t * 0.9 + o.seed) * 8;
        var px = ptr.x * 18 * g.d, py = ptr.y * 12 * g.d;
        var rot = c.r + (still ? 0 : Math.sin(t * 0.45 + o.seed) * 2) + spin * (i % 2 ? -1 : 1) * 4;
        var ry = ptr.x * 10 * g.d, rx = -ptr.y * 6 * g.d;
        if (g.focus) { rot += (focusP - 0.5) * 16; ry += (focusP - 0.5) * 24; }
        var rise = (1 - intro) * 70;
        o.el.style.transform = 'translate3d(' + (c.x + px - o.w / 2).toFixed(1) + 'px,' + (c.y + py + bob + rise - o.h / 2).toFixed(1) + 'px,0) ' +
          'perspective(900px) rotateY(' + ry.toFixed(2) + 'deg) rotateX(' + rx.toFixed(2) + 'deg) rotate(' + rot.toFixed(2) + 'deg) scale(' + c.s.toFixed(4) + ')';
        o.el.style.opacity = (c.op * intro).toFixed(3);
      });
    }

    var raf = 0;
    function loop(now) { raf = 0; if (!active || !visible) return; frame(now); raf = requestAnimationFrame(loop); }
    function kick() { if (still) { frame(performance.now(), true); return; } if (!raf && active && visible) raf = requestAnimationFrame(loop); }
    window.addEventListener('resize', function () { W = window.innerWidth; H = window.innerHeight; narrow = W < 900; kick(); });
    document.addEventListener('visibilitychange', function () { visible = !document.hidden; kick(); });
    if (!still && opts.pointer) {
      window.addEventListener('pointermove', function (e) {
        ptr.tx = (e.clientX / window.innerWidth - 0.5) * 2;
        ptr.ty = (e.clientY / window.innerHeight - 0.5) * 2;
      }, { passive: true });
    }
    kick();

    return {
      setState: function (name, el) { state = name; anchor = el || null; kick(); },
      setFocusProgress: function (p) { focusP = p; if (still) kick(); },
      setVelocity: function (v) { vel = Math.max(-3, Math.min(3, v / 900)); },
      setActive: function (a) { active = a; kick(); },
      setExposure: function (e) { intro = Math.min(1, e); },
      get state() { return state; }
    };
  }

  window.Scene3D = { init: init };
})();
