#!/usr/bin/env python3
"""Genera index.html (estático) a partir de data/*.json.
Uso:  python3 build.py
Para cambiar marca, número de WhatsApp o dominio, editá CONFIG y volvé a ejecutar."""
import json, re, html
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).parent

CONFIG = {
    "marca": "Bienestar Directo",          # <- reemplazá por el nombre de tu negocio
    "whatsapp": "5492236237299",           # +54 9 223 623-7299
    "whatsapp_visible": "+54 9 223 623-7299",
    "dominio": "https://bienestardirecto.github.io/salud.y.bienestar",                         # ej: "https://www.tudominio.com" (para canonical y Open Graph)
    "anio_catalogo": "2026",
    "precios_fecha": "8/11/2026",          # fecha en que se verificaron los precios contra el catálogo
    # --- Datos reales del negocio: cada bloque aparece en la página solo si está completo ---
    "vendedor": {                          # bloque "Quién te atiende"
        "nombre": "Ruben Edgard Gil",
        "foto": "images/vendedor.webp",
        "zona": "Mar del Plata, Buenos Aires",
        "edad": "37",
        "texto": "Te asesoro de forma personalizada para que elijas los productos de bienestar, belleza y cuidado del hogar que mejor se adaptan a vos.",
    },
    "envios": {
        "titulo": "A todo el país en 2 a 3 días hábiles*",
        "items": ["Despacho por Andreani", "Costo de envío según tu ubicación",
                  "Recibís seguimiento y un correo con la confirmación y los datos del envío"],
        "nota": "*Plazo estimado desde el pedido. Puede variar según ubicación y disponibilidad.",
    },
    "pagos": ["Tarjeta de crédito", "Tarjeta de débito", "Transferencia bancaria", "Mercado Pago"],
    "horario": "todos los días de 08:00 a 23:00 (hora de Argentina)",
    "horario_titulo": "Todos los días, de 08:00 a 23:00",
    # --- Medición (opcional): pegá los ID y se activan solos ---
    "ga4_id": "",                          # Google Analytics 4, ej: "G-XXXXXXXXXX"
    "clarity_id": "",                      # Microsoft Clarity, ej: "abcd1234ef"
}

CATEGORIAS = [
    dict(slug="nutricion", file="nutricion.json", nombre="Nutrición", tema="stage",
         h2="Nutrición para cada día.",
         intro="Suplementos dietarios Nutrilite y combos armados: elegí por producto o por combo y consultá por WhatsApp.",
         icon='<path d="M8.5 15.5l7-7a3.5 3.5 0 015 5l-7 7a3.5 3.5 0 01-5-5z"/><path d="M12 12l3 3"/>',
         grupo=lambda p: "Combos" if p.get("combo") else "Suplementos",
         nota="Suplementos dietarios. No reemplazan una alimentación variada. Consultá a tu médico y/o farmacéutico antes de usarlos."),
    dict(slug="belleza", file="belleza.json", nombre="Belleza", tema="light",
         h2="Cuidado de la piel y maquillaje Artistry.",
         intro="Rutinas por tipo de piel —Balance, Hidratación y Renovación— y maquillaje en tonos para elegir.",
         icon='<path d="M12 3c3 4 5 6.5 5 9.5a5 5 0 01-10 0C7 9.5 9 7 12 3z"/><path d="M9.5 13.5a2.5 2.5 0 002.5 2.5"/>',
         grupo=lambda p: "Maquillaje" if p.get("linea") == "Maquillaje" else "Cuidado de la piel",
         nota=""),
    dict(slug="cuidado-personal", file="cuidado-personal.json", nombre="Cuidado Personal", tema="stage",
         h2="Cabello, sonrisa y piel.",
         intro="Satinique para el cabello, Glister para el cuidado bucal y G&H para el cuidado corporal.",
         icon='<path d="M5 20c0-8 4-14 14-16-1 10-6 14-14 16z"/><path d="M5 20c2-5 5-8 9-10"/>',
         grupo=lambda p: {"Satinique": "Cabello", "Glister": "Cuidado bucal", "G&H": "Cuidado corporal"}.get(p["marca"], p["marca"]),
         nota=""),
    dict(slug="hogar", file="hogar.json", nombre="Hogar", tema="light-alt",
         h2="Limpieza concentrada para todo el hogar.",
         intro="Lavandería, superficies, cocina y accesorios. Fórmulas concentradas que rinden.",
         icon='<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/>',
         grupo=lambda p: p.get("linea", "Hogar"),
         nota=""),
]

WA_PATH = '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>'
WA_ICON = '<svg aria-hidden="true"><use href="#i-wa"/></svg>'

esc = html.escape


def wa(text):
    return f"https://wa.me/{CONFIG['whatsapp']}?text={quote(text, safe='')}"


def price_num(s):
    """'$33.008,00' -> '33008.00' (solo para datos estructurados)"""
    n = re.sub(r"[^\d,]", "", s).replace(",", ".")
    return n


_mf = ROOT / "images" / "products" / "manifest.json"
MANIFEST = json.loads(_mf.read_text(encoding="utf-8")) if _mf.exists() else {}

ZOOM_CUE = '<span class="zoom-cue" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M19 12a7 7 0 1 1-2.05-4.95"/><path d="M19 4v4h-4"/></svg></span>'
CHEV_L = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>'
CHEV_R = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>'
SERIAL = ["N-01 · SUPLEMENTOS", "B-02 · PIEL Y MAQUILLAJE", "C-03 · CABELLO, SONRISA Y PIEL", "H-04 · CONCENTRADOS"]


def pshow(s):
    """'$33.008,00' -> '$33.008' (mismo valor, sin centavos en cero)"""
    return s[:-3] if s.endswith(",00") else s


def wa_attr(origen):
    return f' data-origen="{origen}"'


def card(p, cat, grupo):
    pre = f"Hola, quiero pedir {p['nombre']} ({p['marca']}), {p['presentacion']}"
    code = p.get("codigo")
    post = f"Precio publicado: {pshow(p['precio'])}" + (f" (cód. {code})" if code else "") + ". ¿Me confirmás disponibilidad, envío y forma de pago?"
    tonos = p.get("tonos")
    href = wa(pre + ". " + post)
    img = ""
    m = MANIFEST.get(p["id"])
    if m and (ROOT / "images" / "products" / m["file"]).exists():
        fit = m["fit"]
        fit = "photo" if fit == "photo" else fit
        if fit == "cover" and not (0.95 <= m["w"] / m["h"] <= 1.7):
            fit = "photo"  # foto con fondo y proporción distinta a la tarjeta: se muestra completa
        img = (f'<img class="fit-{fit}" src="images/products/{m["file"]}" alt="{esc(p["nombre"])} {esc(p["presentacion"])}" '
               f'width="{m["w"]}" height="{m["h"]}" loading="lazy" decoding="async" data-depth>')
    else:
        for ext in ("jpg", "jpeg", "webp", "png"):
            if (ROOT / "images" / "products" / f"{p['id']}.{ext}").exists():
                img = f'<img class="fit-cover" src="images/products/{p["id"]}.{ext}" alt="{esc(p["nombre"])}" loading="lazy" decoding="async" data-depth>'
                break
    badge = '<span class="badge">Nuevo</span>' if p.get("nuevo") else ('<span class="badge">Combo</span>' if p.get("combo") else "")
    select = ""
    if tonos:
        opts = '<option value="" data-c="">Elegí tu tono</option>' + "".join(
            f'<option value="{esc(t["n"])}" data-c="{esc(t["c"])}">{esc(t["n"])}</option>' for t in tonos)
        select = (f'<div class="tono"><label class="sr-only" for="t-{p["id"]}">Tono de {esc(p["nombre"])}</label>'
                  f'<select id="t-{p["id"]}" data-tonos>{opts}</select><span class="tono-pick" aria-live="polite"></span></div>')
    code_html = f'<span class="code">Cód. {esc(code)}</span>' if code else ('<span class="code">Código según tono</span>' if tonos else '<span class="code"></span>')
    label = f'Pedir {p["nombre"]} por WhatsApp, {pshow(p["precio"])}'
    desc_txt = p.get("desc") or ("Combo armado: los dos productos en un solo pedido, al precio publicado del combo." if p.get("combo") else "")
    return f'''<article class="card" data-g="{esc(grupo)}" id="p-{p["id"]}">
<div class="card-media{" has-img" if img else ""}">{badge}<div class="ph"{"" if img else " data-depth"}><svg viewBox="0 0 24 24" aria-hidden="true">{cat["icon"]}</svg><span>{esc(p["marca"])}</span></div>{img}</div>
<div class="card-body">
<p class="card-brand">{esc(p["marca"])}</p>
<h3 class="card-title">{esc(p["nombre"])}</h3>
<p class="card-pres">{esc(p["presentacion"])}</p>
<p class="card-desc">{esc(desc_txt)}</p>
{select}
<div class="card-buy"><p><span class="price">{esc(pshow(p["precio"]))}</span>{code_html}</p>
<a class="btn btn-ghost btn-buy" href="{href}" target="_blank" rel="noopener" data-origen="producto" data-producto="{esc(p["id"])}" data-pre="{esc(pre)}" data-post="{esc(post)}" aria-label="{esc(label)}">{WA_ICON}<span class="lbl">Pedir por WhatsApp</span></a></div>
</div>
</article>'''


def section(cat, productos, idx):
    grupos = []
    for p in productos:
        g = cat["grupo"](p)
        if g not in grupos:
            grupos.append(g)
    rail_id = f"rail-{cat['slug']}"
    chips = '<button class="chip" data-g="*" aria-pressed="true">Todos</button>' + "".join(
        f'<button class="chip" data-g="{esc(g)}" aria-pressed="false">{esc(g)}</button>' for g in grupos)
    cards = "\n".join(card(p, cat, cat["grupo"](p)) for p in productos)
    msg = f"Hola, quiero consultar por los productos de {cat['nombre']} que vi en la página. ¿Me ayudás a elegir?"
    nota = f'<small>{esc(cat["nota"])}</small>' if cat["nota"] else ""
    n = len(productos)
    return f'''<section class="cat" id="{cat["slug"]}" data-i="{idx}" aria-labelledby="h-{cat["slug"]}">
<div class="cat-intro">
<div class="curtain" aria-hidden="true"></div>
<div class="cat-grid">
<div class="cat-l"><p class="label m-fade"><span class="ember">0{idx + 1}</span> / 04 — {esc(cat["nombre"])}</p>
<h2 id="h-{cat["slug"]}" class="split">{esc(cat["h2"])}</h2>
<p class="cat-count m-fade"><b data-count="{n}">{n}</b> productos con precio publicado</p></div>
<div class="cat-c" aria-hidden="true"></div>
<div class="cat-r"><p class="body m-fade">{esc(cat["intro"])}</p>
<a class="btn btn-fill magnetic m-fade" href="{wa(msg)}" target="_blank" rel="noopener" data-origen="categoria" data-producto="{cat["slug"]}">{WA_ICON}<span class="lbl">Consultar por {esc(cat["nombre"])}</span></a>{nota}</div>
</div>
<span class="cat-vert" aria-hidden="true">{SERIAL[idx]} · {CONFIG["anio_catalogo"]}</span>
</div>
<div class="catalog" id="cat-{cat["slug"]}">
<hr class="dash">
<div class="cat-bar">
<div class="chips" data-chips="{rail_id}" role="group" aria-label="Filtrar {esc(cat["nombre"])}">{chips}</div>
<div class="rail-ctl"><span class="rail-meta" aria-live="polite"></span><span class="rail-line" aria-hidden="true"><b></b></span>
<button class="rail-btn" data-dir="-1" aria-label="Anteriores" aria-controls="{rail_id}">{CHEV_L}</button><button class="rail-btn" data-dir="1" aria-label="Siguientes" aria-controls="{rail_id}">{CHEV_R}</button></div>
</div>
<div class="rail" id="{rail_id}" tabindex="0" role="region" aria-label="Productos de {esc(cat["nombre"])}, desplazamiento horizontal">
{cards}
</div>
<div class="cat-foot"><button class="more-btn" type="button" data-rail="{rail_id}" hidden>Ver los {n} productos</button>
<p class="cat-note">Precios del catálogo {CONFIG["anio_catalogo"]} · verificados el {CONFIG["precios_fecha"]}</p></div>
</div>
</section>'''


def tiktok_section():
    f = ROOT / "data" / "tiktok.json"
    if not f.exists():
        return ""
    vids = json.loads(f.read_text(encoding="utf-8")).get("videos", [])
    if not vids:
        return ""
    play = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>'
    cards = []
    for v in vids:
        u = esc(v["usuario"])
        msg = f"Hola, vi el video de @{v['usuario']} en la página y quiero consultar por ese producto. ¿Me pueden brindar más información?"
        cards.append(f'''<article class="tt-card">
<div class="tt-box"><a class="tt-face" href="{esc(v["url"])}" target="_blank" rel="noopener" data-tt="{esc(v["id"])}" aria-label="Ver video de TikTok de @{u}">
<span class="tt-top">TikTok</span><span class="tt-play">{play}</span><span class="tt-user">@{u}</span><span class="tt-hint">Cargando video…</span></a></div>
<a class="btn btn-ghost tt-wa" href="{wa(msg)}" target="_blank" rel="noopener" data-origen="video" data-producto="{esc(v["id"])}">{WA_ICON}<span class="lbl">Consultar por este producto</span></a>
</article>''')
    return f'''<section class="tt" id="videos" aria-labelledby="h-videos">
<div class="tt-head"><div><p class="label m-fade">En TikTok</p><h2 id="h-videos" class="split">Mirá cómo se usan.</h2></div>
<p class="body m-fade">Videos de personas que ya usan estos productos. Si te gusta lo que ves, consultanos por WhatsApp.</p></div>
<div class="tt-rail" tabindex="0" role="region" aria-label="Videos de TikTok, desplazamiento horizontal">
{"".join(cards)}
</div>
</section>'''


FIND = [
    ("Vitaminas y suplementos", "Nutrilite", "nutricion", "Suplementos"),
    ("Combos", "Dos productos en un pedido", "nutricion", "Combos"),
    ("Cuidado de la piel", "Artistry Skin Nutrition", "belleza", "Cuidado de la piel"),
    ("Maquillaje", "Bases, labiales, máscaras", "belleza", "Maquillaje"),
    ("Cabello", "Satinique", "cuidado-personal", "Cabello"),
    ("Sonrisa", "Glister", "cuidado-personal", "Cuidado bucal"),
    ("Cuerpo", "G&H", "cuidado-personal", "Cuidado corporal"),
    ("Limpieza del hogar", "SA8, L.O.C., Pursue, Dish Drops", "hogar", "*"),
]


def find_section(data):
    cats = {c["slug"]: c for c in CATEGORIAS}
    items = []
    for label, sub, slug, g in FIND:
        prods = data[slug]
        n = len(prods) if g == "*" else sum(1 for p in prods if cats[slug]["grupo"](p) == g)
        items.append(f'<li><a href="#cat-{slug}" data-find="rail-{slug}" data-g="{esc(g)}"><b>{esc(label)}</b><span>{esc(sub)}</span><em>{n}</em></a></li>')
    return f'''<section class="find" id="buscar" aria-labelledby="h-find">
<div class="find-head"><p class="label">Atajos</p><h2 id="h-find">¿Qué buscás?</h2></div>
<ul class="find-list">{"".join(items)}</ul>
</section>'''


def vendedor_section():
    v = CONFIG.get("vendedor") or {}
    if not v.get("nombre"):
        return ""
    foto = f'<img src="{esc(v["foto"])}" alt="Foto de {esc(v["nombre"])}" width="132" height="132" loading="lazy">' if v.get("foto") else ""
    meta = " · ".join(x for x in ["Distribuidor independiente", f"{v['edad']} años" if v.get("edad") else "", v.get("zona", "")] if x)
    msg = f"Hola {v['nombre'].split()[0]}, vi tu página y quiero que me asesores con unos productos."
    return f'''<section class="who" id="quien" aria-labelledby="h-who">
<div class="who-in m-fade">{foto}<div><p class="label">Quién te atiende</p><h2 id="h-who">{esc(v["nombre"])}</h2>
<p class="who-meta">{esc(meta)}</p>
{f'<p class="who-txt">{esc(v["texto"])}</p>' if v.get("texto") else ""}</div>
<div class="who-cta"><a class="btn btn-fill magnetic" href="{wa(msg)}" target="_blank" rel="noopener" data-origen="quien-te-atiende">{WA_ICON}<span class="lbl">Escribime</span></a></div></div>
</section>'''


IC_SVG = {
    "envio": '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/>',
    "pago": '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>',
    "hora": '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
}


def ship_block():
    env, pag, hor = CONFIG.get("envios") or {}, CONFIG.get("pagos") or [], CONFIG.get("horario") or ""
    if not (env or pag or hor):
        return ""
    def card(ico, h, big, body, nota):
        return (f'<article class="ic m-fade"><div class="ic-top"><span class="ic-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">{IC_SVG[ico]}</svg></span>'
                f'<h3>{h}</h3></div><p class="ic-big">{esc(big)}</p>{body}' + (f'<small>{esc(nota)}</small>' if nota else "") + '</article>')
    cols = []
    if env:
        cols.append(card("envio", "Envíos y entregas", env["titulo"], "<ul>" + "".join(f"<li>{esc(x)}</li>" for x in env["items"]) + "</ul>", env.get("nota")))
    if pag:
        cols.append(card("pago", "Medios de pago", "Pagá como te quede cómodo", '<div class="chips">' + "".join(f"<span>{esc(x)}</span>" for x in pag) + "</div>", "Te confirmamos el total con envío antes de que pagues."))
    if hor:
        cols.append(card("hora", "Atención al cliente", CONFIG.get("horario_titulo") or hor, f'<ul><li>WhatsApp: {esc(CONFIG["whatsapp_visible"])} (canal principal)</li></ul>', "Hora de Argentina."))
    return '<div class="info-grid" id="envios-pagos">' + "".join(cols) + "</div>"


def tracking_head():
    out = ""
    g = CONFIG.get("ga4_id")
    if g:
        out += (f'<script async src="https://www.googletagmanager.com/gtag/js?id={esc(g)}"></script>'
                f"<script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments)}}gtag('js',new Date());gtag('config','{esc(g)}');</script>")
    c = CONFIG.get("clarity_id")
    if c:
        out += ('<script>(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};'
                't=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];'
                f'y.parentNode.insertBefore(t,y)}})(window,document,"clarity","script","{esc(c)}");</script>')
    return out


NC_HTML = r"""<section class="nc" id="naturaleza-ciencia" aria-labelledby="nc-title">
  <div class="nc-head" data-in>
    <div><p class="label">Por qué confiar</p><h2 id="nc-title">Naturaleza y ciencia en equilibrio</h2></div>
    <p class="nc-lead">Productos desarrollados combinando ingredientes de origen natural, investigación científica y tecnología para acompañar tu bienestar, belleza y cuidado del hogar.</p>
  </div>
  <ul class="nc-list">
    <li class="nc-item" data-in>
      <span class="nc-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21v-8"/><path d="M12 13c0-4 3-6.5 7-6.5 0 4-3 6.5-7 6.5Z"/><path d="M12 15c0-3.2-2.4-5.2-5.6-5.2 0 3.2 2.4 5.2 5.6 5.2Z"/><path d="M3 21h18"/></svg></span>
      <div class="nc-txt"><h3>Granjas con certificación orgánica</h3>
      <p>Botánicos cultivados en granjas propias certificadas como orgánicas.</p></div>
      <p class="nc-scope">Aplica a: Nutrilite</p>
    </li>
    <li class="nc-item" data-in>
      <span class="nc-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 18h5a3 3 0 0 0 3-3V9a3 3 0 0 1 2-2.8"/><path d="M10 12h.01M15 12h.01"/></svg></span>
      <div class="nc-txt"><h3>Trazabilidad de la semilla al producto</h3>
      <p>Seguimiento de cada ingrediente botánico, desde el cultivo hasta el envase.</p></div>
      <p class="nc-scope">Aplica a: Nutrilite y botánicos de Artistry</p>
    </li>
    <li class="nc-item" data-in>
      <span class="nc-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M8.5 9.5 12 16l3.5-6.5"/><path d="M13.6 8.2c1-.9 2.2-1.1 3.2-.9-.2 1-.9 2-2.1 2.4"/></svg></span>
      <div class="nc-txt"><h3>Fórmulas veganas</h3>
      <p>Sin ingredientes de origen animal en los productos indicados como veganos.</p></div>
      <p class="nc-scope">Aplica a: Artistry Skin Nutrition y productos G&amp;H señalados</p>
    </li>
    <li class="nc-item" data-in>
      <span class="nc-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5c3 3.6 5.5 6.6 5.5 9.7a5.5 5.5 0 0 1-11 0c0-3.1 2.5-6.1 5.5-9.7Z"/><path d="m9.6 13.4 1.7 1.7 3.2-3.4"/></svg></span>
      <div class="nc-txt"><h3>Reconocidos por EPA Safer Choice</h3>
      <p>Fórmulas de limpieza que cumplen el estándar de la Agencia de Protección Ambiental de EE.&nbsp;UU.</p></div>
      <p class="nc-scope">Aplica a: SA8 Líquido, SA8 Polvo y Suavizante SA8</p>
    </li>
  </ul>
  <p class="nc-note" data-in>Cada distintivo aplica solo a las líneas indicadas. Fuente: catálogos oficiales 2026 y sitios del fabricante.<br>Productos respaldados por la Garantía de Satisfacción del fabricante (consultá condiciones).</p>
</section>"""

def main():
    data = {}
    total = 0
    for c in CATEGORIAS:
        d = json.loads((ROOT / "data" / c["file"]).read_text(encoding="utf-8"))
        data[c["slug"]] = d["productos"]
        total += len(d["productos"])

    marca = CONFIG["marca"]
    dom = CONFIG["dominio"].rstrip("/")
    titulo = f"{marca} | Suplementos, belleza, cuidado personal y hogar con precios y pedido por WhatsApp"
    desc = f"{total} productos con precio publicado: Nutrilite, Artistry, Satinique, Glister, G&H y SA8. Elegí y consultá por WhatsApp en un toque."
    general = "Hola, quiero consultar por los productos que vi en la página. ¿Me pueden brindar más información?"

    items = []
    n = 0
    for c in CATEGORIAS:
        for p in data[c["slug"]]:
            n += 1
            it = {"@type": "ListItem", "position": n, "item": {
                "@type": "Product", "name": f'{p["nombre"]} {p["presentacion"]}'.strip(), "brand": {"@type": "Brand", "name": p["marca"]},
                "offers": {"@type": "Offer", "price": price_num(p["precio"]), "priceCurrency": "ARS"}}}
            if p.get("codigo"):
                it["item"]["sku"] = p["codigo"]
            items.append(it)
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "WebSite", "name": marca, "inLanguage": "es-AR"},
        {"@type": "Store", "name": marca, "areaServed": {"@type": "Country", "name": "Argentina"}, "address": {"@type": "PostalAddress", "addressLocality": "Mar del Plata", "addressRegion": "Buenos Aires", "addressCountry": "AR"}, "telephone": "+" + CONFIG["whatsapp"], "openingHoursSpecification": {"@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"], "opens": "08:00", "closes": "23:00"}, "paymentAccepted": ", ".join(CONFIG.get("pagos") or [])},
        {"@type": "ItemList", "name": f"Catálogo {marca}", "itemListElement": items}]}
    ld_json = json.dumps(ld, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")

    og = f'''<meta property="og:type" content="website"><meta property="og:locale" content="es_AR">
<meta property="og:title" content="{esc(titulo)}"><meta property="og:description" content="{esc(desc)}">
<meta property="og:image" content="{dom + '/' if dom else ''}assets/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">''' + (f'<meta property="og:url" content="{dom}/"><link rel="canonical" href="{dom}/">' if dom else "")

    index = "".join(
        f'<a href="#{c["slug"]}" class="m-fade"><b>0{i + 1} {esc(c["nombre"])}</b><span>{len(data[c["slug"]])}</span></a>' for i, c in enumerate(CATEGORIAS))
    nav_links = "".join(f'<li><a href="#{c["slug"]}">{esc(c["nombre"])}</a></li>' for c in CATEGORIAS)

    secs = "\n".join(section(c, data[c["slug"]], i) for i, c in enumerate(CATEGORIAS))

    faq = [
        ("¿Cómo hago mi pedido?", "Elegí el producto, tocá “Pedir por WhatsApp” y se abre WhatsApp con el mensaje ya armado: nombre, presentación, código y precio publicado. Solo tenés que enviarlo y te respondemos."),
        ("¿Los precios son los que veo en la página?", f"Sí. Son los precios del catálogo {CONFIG['anio_catalogo']}, verificados el {CONFIG['precios_fecha']}. Cuando nos escribís te confirmamos precio y disponibilidad antes de cerrar el pedido."),
        ("¿Para qué sirve el código de cada producto?", "Es el código de catálogo del producto. Lo incluimos en el mensaje para que identificarlo y pedirlo sea más rápido, sobre todo en los productos con varias presentaciones."),
        ("¿Los suplementos reemplazan una alimentación variada?", "No. Son suplementos dietarios que complementan dietas insuficientes. Consultá a tu médico y/o farmacéutico antes de usarlos, sobre todo si estás en tratamiento o embarazada."),
        ("¿Hacen envíos a todo el país?", "Sí, enviamos a todo el país por Andreani. El plazo estimado es de 2 a 3 días hábiles desde el pedido y puede variar según tu ubicación y la disponibilidad. El costo de envío se calcula según tu ubicación y te lo confirmamos antes de cerrar el pedido. Recibís el seguimiento y un correo con la confirmación y los datos del envío."),
        ("¿Cómo puedo pagar?", "Con tarjeta de crédito, tarjeta de débito, transferencia bancaria o Mercado Pago. Antes de pagar te confirmamos por WhatsApp el total con el envío incluido."),
        ("¿Quién vende estos productos?", "Somos distribuidores independientes. Vendemos productos de marcas como Nutrilite, Artistry, Satinique, Glister, G&H y SA8; las marcas pertenecen a sus respectivos titulares."),
    ]
    faq_html = "".join(f'<li><details><summary>{esc(q)}<i aria-hidden="true"></i></summary><div class="ans">{esc(a)}</div></details></li>' for q, a in faq)

    trust = [
        ("Precios claros", "Cada producto muestra su precio publicado y su código de catálogo. Sin sorpresas."),
        ("Atención directa", "Hablás con una persona por WhatsApp, sin formularios ni vueltas."),
        ("Marcas reconocidas", "Nutrilite, Artistry, Satinique, Glister, G&H y SA8 en un solo lugar."),
        ("Transparencia", "Somos distribuidores independientes y te lo decimos desde el principio."),
    ]
    trust_html = "".join(f'<li class="m-fade"><span class="n">0{i + 1}</span><h3>{t}</h3><p>{d}</p></li>' for i, (t, d) in enumerate(trust))

    steps = [
        ("Elegí", "Recorré las categorías y filtrá por tipo de producto. Todos tienen precio publicado y código de catálogo."),
        ("Tocá “Pedir por WhatsApp”", "Se abre WhatsApp con el mensaje listo: producto, presentación, código y precio. Solo lo enviás."),
        ("Confirmamos tu pedido", "Te respondemos con disponibilidad, costo de envío y total antes de cerrar. Recién ahí pagás."),
    ]
    steps_html = "".join(f'<li data-step="{i}"><span class="n">0{i + 1}</span><h3>{esc(t)}</h3><p>{esc(d)}</p></li>' for i, (t, d) in enumerate(steps))

    page = f'''<!DOCTYPE html>
<html lang="es-AR" class="no-js" data-wa="{CONFIG["whatsapp"]}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{esc(titulo)}</title>
<meta name="description" content="{esc(desc)}">
<meta name="theme-color" content="#a58c5d">
<meta name="color-scheme" content="light">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="preload" href="assets/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>
{og}
<link rel="stylesheet" href="assets/style.css">
<script>(function(d){{var h=d.documentElement;h.classList.remove('no-js');if(!matchMedia('(prefers-reduced-motion: reduce)').matches){{h.classList.add('motion');setTimeout(function(){{if(!window.__motionReady)h.classList.remove('motion')}},3000)}}}})(document)</script>
{tracking_head()}
<script type="application/ld+json">{ld_json}</script>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="i-wa" viewBox="0 0 24 24">{WA_PATH}</symbol></svg>
<a class="skip" href="#catalogo">Saltar a los productos</a>
<div class="hero-bg" aria-hidden="true"></div>
<div class="stage" aria-hidden="true"><div class="stage-bg" data-i="0"></div><div class="stage-bg" data-i="1"></div><div class="stage-bg" data-i="2"></div><div class="stage-bg" data-i="3"></div><div class="glow" data-glow="h"></div><div class="glow" data-glow="0"></div><div class="glow" data-glow="1"></div><div class="glow" data-glow="2"></div><div class="glow" data-glow="3"></div><div id="scene" class="objs"></div></div>

<header class="nav"><a class="brand" href="#top">{esc(marca)}</a><nav aria-label="Principal"><ul class="nav-links">{nav_links}{'<li><a href="#videos">Videos</a></li>' if tiktok_section() else ''}<li><a href="#preguntas">Preguntas</a></li></ul></nav><a class="btn btn-nav magnetic" href="{wa(general)}" target="_blank" rel="noopener" data-origen="menu">{WA_ICON}<span class="lbl">WhatsApp</span></a><span class="progress" aria-hidden="true"></span></header>

<main id="top">
<section class="hero" aria-labelledby="h-hero">
<div class="hero-top">
<p class="hero-tag label m-fade"><span>Catálogo {CONFIG["anio_catalogo"]}</span><span>Distribuidor independiente</span><span class="ember">Suplementos · Belleza · Cuidado personal · Hogar</span></p>
<h1 id="h-hero"><span class="ln">Tu bienestar</span><span class="ln">a un mensaje</span><span class="ln"><span class="g">de distancia.</span></span></h1>
<span class="hero-glow" aria-hidden="true"></span>
<p class="hero-lead m-fade">Nutrilite, Artistry, Satinique, Glister, G&amp;H y SA8: <b>{total} productos con precio a la vista.</b> Elegí, tocá “Pedir por WhatsApp” y te respondemos con disponibilidad, envío y total.{(" Atendemos " + esc(CONFIG["horario"]) + ".") if CONFIG.get("horario") else ""}</p>
<div class="hero-cta m-fade"><a class="btn btn-fill magnetic" href="{wa(general)}" target="_blank" rel="noopener" data-origen="portada">{WA_ICON}<span class="lbl">Pedir por WhatsApp</span><svg class="arr" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg></a><a class="link" href="#buscar">¿Qué buscás?</a></div>
<p class="hero-note m-fade">Precios del catálogo {CONFIG["anio_catalogo"]} · verificados el {CONFIG["precios_fecha"]}</p>
{('<p class="hero-who m-fade">Te atiende ' + esc(CONFIG["vendedor"]["nombre"]) + ', distribuidor independiente.</p>') if CONFIG.get("vendedor", {}).get("nombre") else ""}
</div>
<div class="hero-slot" aria-hidden="true"></div>
<div class="hero-bottom">
<div class="cue m-fade" aria-hidden="true"><i></i>Deslizá</div>
<nav class="index" aria-label="Categorías">{index}</nav>
</div>
<span class="vert m-fade" aria-hidden="true">{esc(marca)} · {total} productos · {CONFIG["anio_catalogo"]}</span>
</section>

{NC_HTML}

{find_section(data)}

{vendedor_section()}

<section class="how" id="como-comprar" aria-labelledby="h-como">
<div class="how-in">
<div class="how-h"><p class="label m-fade">Cómo comprar</p><h2 id="h-como" class="split">Pedir es así de simple.</h2></div>
<ol class="steps">{steps_html}</ol>
</div>
{ship_block()}
</section>

<div id="catalogo">
{secs}
</div>

{tiktok_section()}

<section class="trust" id="confianza" aria-labelledby="h-conf">
<p class="label m-fade">Comprá con tranquilidad</p>
<h2 id="h-conf" class="split">Lo que podés esperar de nosotros.</h2>
<ul>{trust_html}</ul>
</section>

<section class="faq" id="preguntas" aria-labelledby="h-faq">
<div><p class="label m-fade">Preguntas frecuentes</p><h2 id="h-faq" class="split">Antes de escribirnos.</h2></div>
<ul>{faq_html}</ul>
</section>

<section class="final" id="contacto" aria-labelledby="h-final">
<p class="label m-fade">Último paso</p>
<h2 id="h-final" class="split">¿Listo para hacer tu pedido?</h2>
<hr class="dash">
<div class="row"><p class="body m-fade">Contanos qué producto te interesa y te respondemos por WhatsApp{(", " + esc(CONFIG["horario"])) if CONFIG.get("horario") else ""}.</p>
<div class="row m-fade"><span class="num">{esc(CONFIG["whatsapp_visible"])}</span><a class="btn btn-fill magnetic" href="{wa(general)}" target="_blank" rel="noopener" data-origen="cierre">{WA_ICON}<span class="lbl">Pedir por WhatsApp</span><svg class="arr" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg></a></div></div>
</section>
</main>

<footer>
<p><strong>{esc(marca)}</strong><br>Distribuidor independiente · Mar del Plata<br>WhatsApp {esc(CONFIG["whatsapp_visible"])} · Atención {esc(CONFIG["horario"])}</p>
<div class="legal">
<p>Las marcas y nombres de productos mencionados pertenecen a sus respectivos titulares y se usan con fines de identificación. Precios en pesos argentinos según catálogo {CONFIG["anio_catalogo"]}, verificados el {CONFIG["precios_fecha"]}; se confirman por WhatsApp al momento del pedido junto con el costo de envío.</p>
<p>Los suplementos dietarios no reemplazan una alimentación variada. Consultá a tu médico y/o farmacéutico.</p>
</div>
</footer>

<a class="float-wa magnetic" href="{wa(general)}" target="_blank" rel="noopener" aria-label="Pedir por WhatsApp" data-origen="flotante">{WA_ICON}<span class="dot" aria-hidden="true"></span><span class="t">Consultas</span></a>
<script src="assets/app.js" defer></script>
<script src="assets/vendor/gsap.min.js" defer></script>
<script src="assets/vendor/ScrollTrigger.min.js" defer></script>
<script src="assets/vendor/SplitText.min.js" defer></script>
<script src="assets/vendor/lenis.min.js" defer></script>
<script src="assets/motion.js" defer></script>
</body>
</html>
'''
    (ROOT / "index.html").write_text(page, encoding="utf-8")

    # Variante para publicar como artifact: librerías de terceros desde CDN permitidos
    import os
    out = os.environ.get("ARTIFACT_OUT")
    if out:
        cdn = "https://cdn.jsdelivr.net/npm/"
        a = page
        for local, remote in [("assets/vendor/gsap.min.js", cdn + "gsap@3.15.1/dist/gsap.min.js"),
                              ("assets/vendor/ScrollTrigger.min.js", cdn + "gsap@3.15.1/dist/ScrollTrigger.min.js"),
                              ("assets/vendor/SplitText.min.js", cdn + "gsap@3.15.1/dist/SplitText.min.js"),
                              ("assets/vendor/lenis.min.js", cdn + "lenis@1.3.27/dist/lenis.min.js")]:
            a = a.replace(f'src="{local}"', f'src="{remote}"')
        a = a.replace('<link rel="preload" href="assets/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>',
                      '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
                      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap">'
                      '<script>window.__TT_EMBED=false;</script>')
        a = a.replace('<span class="tt-hint">Cargando video…</span>', '<span class="tt-hint">Ver en TikTok</span>')
        Path(out).write_text(a, encoding="utf-8")
        print("variante artifact:", out)
    print(f"index.html generado: {total} productos")


if __name__ == "__main__":
    main()
