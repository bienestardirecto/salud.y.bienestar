(function () {
  'use strict';
  var WA = document.documentElement.getAttribute('data-wa') || '';
  function track(ev, data) {
    try {
      (window.dataLayer = window.dataLayer || []).push(Object.assign({ event: ev }, data || {}));
      if (typeof window.gtag === 'function') window.gtag('event', ev, Object.assign({ transport_type: 'beacon' }, data || {}));
      if (typeof window.clarity === 'function') window.clarity('event', ev);
    } catch (e) {}
  }
  /* Aparición suave al hacer scroll */
  var els = document.querySelectorAll('.rv');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });
  } else els.forEach(function (el) { el.classList.add('in'); });
  /* Clics a WhatsApp con origen */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-origen]');
    if (a) track('whatsapp_click', { origen: a.getAttribute('data-origen') });
    var p = e.target.closest('[data-interes]');
    if (p) {
      var k = p.getAttribute('data-interes'), box = document.querySelector('.e-chk input[data-k="' + k + '"]');
      if (box) box.checked = true;
      track('emprende_perfil', { perfil: k });
    }
  });
  /* Formulario: arma el mensaje y abre WhatsApp */
  var form = document.getElementById('e-form'); if (!form) return;
  var err = form.querySelector('.e-err');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = form.elements, bad = [];
    ['nombre', 'whatsapp', 'ciudad'].forEach(function (n) {
      var ok = f[n].value.trim().length > 1; f[n].classList.toggle('bad', !ok); if (!ok) bad.push(n);
    });
    var ints = Array.prototype.filter.call(form.querySelectorAll('input[name="interes"]'), function (c) { return c.checked; }).map(function (c) { return c.value.toLowerCase(); });
    if (bad.length || !ints.length) {
      err.hidden = false;
      err.textContent = bad.length ? 'Completá tu nombre, WhatsApp y ciudad.' : 'Elegí al menos una opción en «¿Qué te interesa?».';
      (bad.length ? f[bad[0]] : form.querySelector('input[name="interes"]')).focus();
      return;
    }
    err.hidden = true;
    var lista = ints.length > 1 ? ints.slice(0, -1).join(', ') + ' y ' + ints[ints.length - 1] : ints[0];
    var msg = 'Hola, quiero recibir información sobre la oportunidad de emprendimiento de Bienestar Directo. Mi nombre es ' +
      f.nombre.value.trim() + ', soy de ' + f.ciudad.value.trim() + ' y me interesa ' + lista + '.';
    var neg = form.querySelector('input[name="negocio"]:checked'), exp = form.querySelector('input[name="experiencia"]:checked');
    if (neg) msg += '\n¿Tengo un negocio actualmente?: ' + neg.value + '.';
    if (exp) msg += '\nExperiencia en ventas: ' + exp.value + '.';
    if (f.objetivo.value) msg += '\nMi objetivo: ' + f.objetivo.value + '.';
    msg += '\nMi WhatsApp: ' + f.whatsapp.value.trim() + '.';
    track('lead_emprende', { intereses: ints.join('|'), objetivo: f.objetivo.value || '' });
    window.open('https://wa.me/' + WA + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  });
})();
