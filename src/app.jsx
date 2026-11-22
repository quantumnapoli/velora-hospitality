import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { collection, demoMark, finishes, heroFont, markTones, product, sectors } from './catalog'
import './style.css'

const find = (list, id) => list.find(item => item.id === id) ?? list[0]
const loadCore = () => import('./three/core.js')

function download(blob, name) {
  const url = URL.createObjectURL(blob)
  const link = Object.assign(document.createElement('a'), { href: url, download: name })
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

function Mark({ className = '' }) {
  return <svg className={`velora-mark ${className}`} viewBox="0 0 120 64" aria-hidden="true">
    <path d="M6 58C26 54 40 38 52 22 62 9 77 3 92 6c-14 3-24 12-33 25C46 50 30 60 6 58Z" />
    <path d="M40 60c20-2 36-15 48-31 9-12 18-19 30-21-9 6-15 15-23 27C83 52 64 62 40 60Z" opacity=".55" />
  </svg>
}

function Logo() {
  return <a href="#top" className="logo" aria-label="Velora, torna all'inizio">
    <Mark />
    <span className="logo-word">VELORA<sup>®</sup></span>
    <span className="logo-sub">3D Design Objects</span>
  </a>
}

const icons = {
  cube: <path d="M12 2.8 20 7v10l-8 4.2L4 17V7zM4 7l8 4.2L20 7M12 11.2v10" />,
  leaf: <path d="M5 19C5 10 10 5 20 4c0 10-5 15-14 15m0 0 8-8" />,
  sliders: <path d="M4 7h10m4 0h2M4 12h4m4 0h8M4 17h12m4 0h0M14 5v4M8 10v4M16 15v4" />,
  infinity: <path d="M7.5 9C4 9 3 11 3 12s1 3 4.5 3c3.5 0 5.5-6 9-6 3.5 0 4.5 2 4.5 3s-1 3-4.5 3c-3.5 0-5.5-6-9-6Z" />,
  bed: <path d="M3 18V7m0 7h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5M6.5 11.5a1.5 1.5 0 1 0 0-.01" />,
  cloche: <path d="M3 17h18M5 17a7 7 0 0 1 14 0M12 8V6m-2 0h4" />,
  lotus: <path d="M12 19c-4 0-8-2-9-6 3 0 6 1 9 6Zm0 0c4 0 8-2 9-6-3 0-6 1-9 6Zm0 0c-3-3-3-9 0-13 3 4 3 10 0 13Z" />,
  people: <path d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.5 0a2.5 2.5 0 1 0 0-5M3 19c.5-3 2.7-5 5.5-5s5 2 5.5 5m2-5c2.4 0 4.3 1.7 4.8 4.5" />,
  bag: <path d="M5 8h14l-1 12H6L5 8Zm4 0V6a3 3 0 0 1 6 0v2" />,
  star: <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />,
}
const Icon = ({ name }) => <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">{icons[name]}</svg>

/* ───────────────────────── Hero ───────────────────────── */

function Hero() {
  const stage = useRef(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let dispose, alive = true
    import('./three/hero.js').then(({ mountHero }) => alive && mountHero(stage.current, {
      product, finish: find(finishes, product.finish), mark: demoMark, font: heroFont, onReady: () => alive && setReady(true),
    })).then(cleanup => { if (alive) dispose = cleanup; else cleanup?.() }).catch(() => {})
    return () => { alive = false; dispose?.() }
  }, [])
  return <section className="hero" id="top" aria-labelledby="hero-title">
    <div className="hero-glow" aria-hidden="true" />
    <div className="hero-copy">
      <Logo />
      <span className="tricolore" aria-hidden="true"><i /><i /><i /></span>
      <h1 id="hero-title">Oggetti scultorei<br />con il <em>tuo marchio</em>,<br />stampati in 3D.</h1>
      <p>Vasi e accessori per hotel, resort e spazi esclusivi. Carica il logo della tua struttura e scegli il colore: lo vedi subito sul vaso in 3D e ricevi un'immagine fotorealistica del pezzo finito, con il logo inciso.</p>
      <div className="hero-actions">
        <a className="button light" href="#configura">Carica il tuo logo <span aria-hidden="true">↓</span></a>
        <a className="hero-link" href="#collezione">Scopri la collezione</a>
      </div>
      <ul className="hero-points">
        {[['cube', 'Design esclusivo'], ['leaf', 'Materiali sostenibili'], ['sliders', 'Personalizzazione totale'], ['infinity', 'Collezioni modulari']].map(([icon, label]) =>
          <li key={label}><Icon name={icon} />{label}</li>)}
      </ul>
    </div>
    <div className={`hero-stage${ready ? ' ready' : ''}`} ref={stage}>
      <span className="hero-caption">{product.name} · {find(finishes, product.finish).name} · logo inciso</span>
    </div>
  </section>
}

/* ───────────────────────── Configuratore ───────────────────────── */

const blobToDataURL = blob => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(blob)
})

/** Logo su fondo bianco, lato massimo 1024 px: riferimento pulito per il generatore d'immagine. */
async function flattenLogo(source) {
  const bitmap = await createImageBitmap(source)
  const ratio = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height))
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(bitmap.width * ratio), height: Math.round(bitmap.height * ratio) })
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Logo non leggibile.')), 'image/png'))
}

function Configurator({ onConfigured }) {
  const stage = useRef(null)
  const studio = useRef(null)
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState('Preparazione dello studio 3D…')
  const [logo, setLogo] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [rotating, setRotating] = useState(false)
  const [render, setRender] = useState({ state: 'idle' })
  const [view, setView] = useState('3d')
  const [elapsed, setElapsed] = useState(0)
  const [finishId, setFinishId] = useState(product.finish)
  const finish = find(finishes, finishId)
  const tone = find(markTones, product.mark.tone)

  useEffect(() => {
    let alive = true
    import('./three/studio.js').then(async ({ Studio }) => {
      if (!alive) return
      const instance = new Studio(stage.current, { onStatus: setStatus, draggable: false })
      studio.current = instance
      const { heightPct, angle, box, depth, medallion } = product.mark
      instance.setPlacement({ heightPct, angle, box, depth, medallion })
      instance.setFinish(finish)
      instance.setMarkTone(tone)
      await instance.setProduct(product)
      if (alive) setReady(true)
    }).catch(() => alive && setStatus('Il tuo browser non supporta la grafica 3D (WebGL).'))
    return () => { alive = false; studio.current?.dispose(); studio.current = null }
  }, [])

  useEffect(() => { if (ready) studio.current.setMark(logo?.polygons ?? null) }, [ready, logo])
  useEffect(() => { studio.current?.setFinish(finish) }, [finish])
  useEffect(() => { if (ready) studio.current.setAutoRotate(rotating) }, [ready, rotating])
  useEffect(() => { onConfigured({ logo, render, studio, finish }) }, [logo, render, finish, onConfigured])
  useEffect(() => {
    if (render.state !== 'loading') return
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - render.started) / 1000)), 500)
    return () => clearInterval(timer)
  }, [render])

  async function processLogo(file, invert = false) {
    setError('')
    if (!file) return
    if (file.size > 8 * 1024 * 1024) { setError('Il file supera 8 MB.'); return }
    const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)
    if (!isSvg && !/^image\/(png|jpeg|webp)$/.test(file.type)) { setError('Formati accettati: SVG, PNG, JPG, WebP.'); return }
    setBusy(true)
    try {
      const { svgPolygons, rasterPolygons } = await loadCore()
      const raster = isSvg ? await rasterizeSvg(file) : file
      let polygons = null, kind = 'raster'
      if (isSvg && !invert) {
        polygons = await svgPolygons(await file.text()).catch(() => null)
        if (polygons?.length) kind = 'vector'
      }
      if (!polygons?.length) ({ polygons } = await rasterPolygons(raster, { invert }))
      const flat = await flattenLogo(raster)
      setLogo(current => {
        if (current?.url && current.file !== file) URL.revokeObjectURL(current.url)
        return { file, url: current?.file === file ? current.url : URL.createObjectURL(file), polygons, kind, invert, flat }
      })
      setRender({ state: 'idle' })
      setView('3d')
    } catch (problem) {
      setError(problem.message || 'Il logo non può essere elaborato.')
    } finally { setBusy(false) }
  }

  function removeLogo() {
    if (logo?.url) URL.revokeObjectURL(logo.url)
    setLogo(null)
    setRender({ state: 'idle' })
    setView('3d')
  }

  async function generate() {
    if (!studio.current || !logo || render.state === 'loading') return
    setRender({ state: 'loading', started: Date.now() })
    setElapsed(0)
    try {
      const response = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: product.id, finish: finish.id, logo: await blobToDataURL(logo.flat) }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.image) throw new Error(data.error || (response.status === 404 ? 'Servizio di generazione non disponibile.' : 'La generazione non è riuscita.'))
      setRender({ state: 'done', image: data.image, finish: finish.id })
      setView('render')
    } catch (problem) {
      setRender({ state: 'error', error: problem.message || 'La generazione non è riuscita.' })
    }
  }

  async function downloadRender() {
    const blob = await (await fetch(render.image)).blob()
    download(blob, `velora-${product.id}-definitiva.${blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png'}`)
  }

  return <section className="configurator" id="configura" aria-labelledby="config-title">
    <div className="section-head">
      <span className="eyebrow">Configuratore 3D</span>
      <h2 id="config-title">Il tuo marchio, <em>scolpito sull'oggetto.</em></h2>
      <p>Carica il logo della tua struttura e scegli il colore: il logo viene inciso sul medaglione del {product.name}, nella posizione e nella misura previste. L'anteprima 3D è indicativa; l'immagine definitiva mostra il pezzo finito.</p>
    </div>
    <div className="config-grid">
      <div className="config-stage">
        <div className="canvas-host" ref={stage} />
        {render.state === 'done' && view === 'render' && <img className="render-view" src={render.image} alt={`Immagine definitiva del ${product.name} con il logo`} />}
        {status && <p className="stage-status" role="status">{status}</p>}
        {ready && !logo && view === '3d' && <p className="stage-empty">Il medaglione attende il tuo logo</p>}
        <div className="stage-top">
          <span className="chip">{product.name} · {product.detail.split(' · ')[1]}</span>
          {render.state === 'done' && <div className="view-switch" role="tablist" aria-label="Vista">
            <button type="button" role="tab" aria-selected={view === '3d'} onClick={() => setView('3d')}>Anteprima 3D</button>
            <button type="button" role="tab" aria-selected={view === 'render'} onClick={() => setView('render')}>Immagine definitiva</button>
          </div>}
        </div>
        {view === '3d' && <div className="stage-tools" role="toolbar" aria-label="Vista 3D">
          <button type="button" onClick={() => studio.current?.frameAll()}>Vista intera</button>
          <button type="button" onClick={() => studio.current?.frameMark()} disabled={!logo}>Dettaglio logo</button>
          <button type="button" aria-pressed={rotating} onClick={() => setRotating(value => !value)}>360°</button>
        </div>}
        {view === '3d' && <p className="stage-hint">Ruota e ingrandisci con mouse o dita</p>}
      </div>

      <div className="config-panel">
        <div className="product-card">
          <strong>{product.name}</strong><small>{product.detail}</small>
          <p className="help">{product.description}</p>
        </div>

        <fieldset className="step">
          <legend><b>01</b> Carica il tuo logo</legend>
          <label className={`dropzone${busy ? ' busy' : ''}`}
            onDragOver={event => event.preventDefault()}
            onDrop={event => { event.preventDefault(); processLogo(event.dataTransfer.files[0]) }}>
            <input type="file" accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp" className="visually-hidden"
              onChange={event => { processLogo(event.target.files[0]); event.target.value = '' }} />
            {logo ? <img src={logo.url} alt="Logo caricato" /> : <span className="drop-icon" aria-hidden="true">↑</span>}
            <span>{busy ? 'Elaborazione del logo…' : logo ? logo.file.name : 'Trascina qui il logo o scegli un file'}<small>{logo ? 'Clicca per sostituirlo' : 'SVG consigliato · PNG, JPG, WebP fino a 8 MB'}</small></span>
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          {logo && <div className="logo-meta">
            <span>{logo.kind === 'vector' ? 'Vettoriale originale' : 'Contorni ricavati dall\'immagine'} · inciso {String(product.mark.depth).replace('.', ',')} mm</span>
            {logo.kind !== 'vector' && <button type="button" className="text-button" onClick={() => processLogo(logo.file, !logo.invert)}>Inverti pieni e vuoti</button>}
            <button type="button" className="text-button" onClick={removeLogo}>Rimuovi</button>
          </div>}
        </fieldset>

        <fieldset className="step">
          <legend><b>02</b> Colore <small>{finish.name}</small></legend>
          <div className="swatches">
            {finishes.map(item => <button type="button" key={item.id} aria-label={item.name} title={item.name} aria-pressed={item.id === finish.id} style={{ '--swatch': item.color }} onClick={() => { setFinishId(item.id); setView('3d') }} />)}
          </div>
          <p className="help small">Il logo è inciso nel medaglione, nello stesso colore del vaso.</p>
        </fieldset>

        <fieldset className="step">
          <legend><b>03</b> Immagine definitiva</legend>
          <p className="help">Generiamo una fotografia realistica del vaso nel colore scelto, con il tuo logo inciso, ambientata in una suite.</p>
          <button type="button" className="button dark" disabled={!logo || render.state === 'loading'} onClick={generate}>
            {render.state === 'loading' ? `Generazione in corso… ${elapsed}s` : render.state === 'done' && render.finish === finish.id ? 'Genera di nuovo' : 'Genera immagine definitiva'} <span aria-hidden="true">✦</span>
          </button>
          {!logo && <p className="help small">Disponibile dopo il caricamento del logo.</p>}
          {render.state === 'loading' && <p className="help small" role="status">Di solito servono 20–40 secondi.</p>}
          {render.state === 'error' && <p className="error" role="alert">{render.error}</p>}
          {render.state === 'done' && <div className="render-result">
            <button type="button" className="render-thumb" onClick={() => setView('render')}><img src={render.image} alt="" /></button>
            <div>
              <p className="help small">{render.finish === finish.id ? 'Immagine indicativa generata dall\'AI.' : `Generata in ${find(finishes, render.finish).name}: rigenera per il nuovo colore.`}</p>
              <button type="button" className="text-button" onClick={downloadRender}>Scarica immagine</button>
            </div>
          </div>}
        </fieldset>

        <div className="panel-actions">
          <a className="button outline" href="#preventivo">Richiedi preventivo <span aria-hidden="true">→</span></a>
        </div>
      </div>
    </div>
  </section>
}

async function rasterizeSvg(file) {
  // dimensioni esplicite: molti SVG hanno solo il viewBox
  const doc = new DOMParser().parseFromString(await file.text(), 'image/svg+xml')
  const svg = doc.documentElement
  if (svg.nodeName !== 'svg') throw new Error('SVG non leggibile.')
  const box = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number)
  const ratio = box.length === 4 && box[2] > 0 && box[3] > 0 ? box[2] / box[3] : (parseFloat(svg.getAttribute('width')) / parseFloat(svg.getAttribute('height'))) || 1
  const width = ratio >= 1 ? 1024 : Math.round(1024 * ratio), height = ratio >= 1 ? Math.round(1024 / ratio) : 1024
  svg.setAttribute('width', width)
  svg.setAttribute('height', height)
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('SVG non leggibile.')); image.src = url })
    const canvas = Object.assign(document.createElement('canvas'), { width, height })
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(image, 0, 0, width, height)
    return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('SVG non leggibile.')), 'image/png'))
  } finally { URL.revokeObjectURL(url) }
}

/* ───────────────────────── Preventivo ───────────────────────── */

function Quote({ current }) {
  const [state, setState] = useState('idle')
  async function submit(event) {
    event.preventDefault()
    const form = event.currentTarget
    setState('sending')
    try {
      const body = new FormData(form)
      body.set('form-name', 'preventivo')
      const { logo, render, studio } = current ?? {}
      body.set('configurazione', [
        `${product.name} (${product.detail}) · ${(current?.finish ?? find(finishes, product.finish)).name}`,
        `Logo: ${logo?.file.name ?? 'non caricato'}`,
        `Immagine definitiva: ${render?.state === 'done' ? 'generata e allegata' : 'non generata'}`,
      ].join('\n'))
      if (logo?.file) body.set('logo', logo.file)
      const preview = await studio?.current?.shot(1000, 'image/jpeg').catch(() => null)
      if (preview) body.set('anteprima', new File([preview], 'anteprima-3d.jpg', { type: 'image/jpeg' }))
      if (render?.state === 'done') {
        const blob = await (await fetch(render.image)).blob().catch(() => null)
        if (blob) body.set('definitiva', new File([blob], `immagine-definitiva.${blob.type.split('/')[1] || 'png'}`, { type: blob.type }))
      }
      const response = await fetch('/', { method: 'POST', body })
      if (!response.ok) throw new Error()
      setState('sent')
      form.reset()
    } catch { setState('error') }
  }
  return <section className="quote" id="preventivo" aria-labelledby="quote-title">
    <div className="quote-copy">
      <span className="eyebrow">Preventivo</span>
      <h2 id="quote-title">Portiamo il tuo vaso <em>in produzione.</em></h2>
      <p>Alla richiesta alleghiamo il logo, l'anteprima 3D e l'immagine definitiva. Ti rispondiamo con quotazione, tempi e un campione fisico su richiesta.</p>
      <ul className="quote-summary">
        <li><span>Oggetto</span>{product.name} · {product.detail}</li>
        <li><span>Colore</span>{(current?.finish ?? find(finishes, product.finish)).name}</li>
        <li><span>Logo</span>{current?.logo?.file.name ?? 'Da caricare nel configuratore'}</li>
        <li><span>Immagine</span>{current?.render?.state === 'done' ? 'Definitiva generata' : 'Non ancora generata'}</li>
      </ul>
      <a className="text-button" href="#configura">Torna al configuratore ↑</a>
    </div>
    {state === 'sent' ? <div className="quote-done" role="status">
      <h3>Richiesta inviata.</h3><p>Grazie: ti ricontatteremo a breve con la proposta.</p>
      <button type="button" className="text-button" onClick={() => setState('idle')}>Invia un'altra richiesta</button>
    </div> : <form className="quote-form" name="preventivo" method="POST" onSubmit={submit}>
      <input className="visually-hidden" tabIndex={-1} autoComplete="off" name="website" aria-hidden="true" />
      <label>Nome e cognome<input name="nome" required autoComplete="name" /></label>
      <label>Email<input name="email" type="email" required autoComplete="email" /></label>
      <label>Struttura<input name="struttura" required autoComplete="organization" placeholder="Hotel, resort, ristorante…" /></label>
      <label>Telefono<input name="telefono" type="tel" autoComplete="tel" /></label>
      <label>Quantità indicativa<input name="quantita" type="number" min="1" placeholder="Es. 120" /></label>
      <label className="wide">Note<textarea name="note" rows="3" placeholder="Tempi, quantità per camera, altri oggetti della collezione…" /></label>
      {state === 'error' && <p className="error wide" role="alert">Invio non riuscito. Riprova tra poco.</p>}
      <button className="button dark wide" type="submit" disabled={state === 'sending'}>{state === 'sending' ? 'Invio in corso…' : 'Invia la richiesta'} <span aria-hidden="true">→</span></button>
    </form>}
  </section>
}

/* ───────────────────────── Pagina ───────────────────────── */

function App() {
  const [current, setCurrent] = useState(null)
  const [scrolled, setScrolled] = useState(false)
  const [menu, setMenu] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const nav = [['#configura', 'Configuratore'], ['#collezione', 'Collezione'], ['#materiali', 'Materiali'], ['#settori', 'Su misura']]
  return <>
    <a className="skip" href="#configura">Vai al configuratore</a>
    <header className={`header${scrolled ? ' solid' : ''}`}>
      <a href="#top" className="header-logo" aria-label="Velora"><Mark />VELORA</a>
      <button className="menu-toggle" type="button" aria-expanded={menu} aria-controls="nav" onClick={() => setMenu(!menu)}>{menu ? 'Chiudi' : 'Menu'}</button>
      <nav id="nav" className={menu ? 'open' : ''} aria-label="Navigazione principale">
        {nav.map(([href, label]) => <a key={href} href={href} onClick={() => setMenu(false)}>{label}</a>)}
        <a className="nav-cta" href="#preventivo" onClick={() => setMenu(false)}>Preventivo</a>
      </nav>
    </header>
    <main>
      <Hero />
      <Configurator onConfigured={setCurrent} />

      <section className="collection" id="collezione" aria-labelledby="collection-title">
        <div className="section-head row">
          <div><span className="eyebrow">La collezione Parker's</span><h2 id="collection-title">Un solo linguaggio, <em>dalla hall alla suite.</em></h2></div>
          <p>Ogni pezzo condivide la stessa onda scultorea e porta il marchio della struttura. I modelli 3D configurabili si ampliano con la collezione.</p>
        </div>
        <div className="collection-grid">
          {collection.map(([name, text, image]) => <article key={name} className="collection-card">
            <img src={`/images/${image}.webp`} alt={name} loading="lazy" width="230" height="205" />
            <h3>{name}</h3><p>{text}</p>
          </article>)}
        </div>
        <figure className="collection-feature">
          <img src="/images/velora-suite.webp" alt="Oggetti della collezione Parker's su un piano bagno in marmo" loading="lazy" />
        </figure>
      </section>

      <section className="materials" id="materiali" aria-labelledby="materials-title">
        <img src="/images/velora-gallery-mobile.webp" alt="Due vasi Onda in luce radente" loading="lazy" />
        <div className="materials-copy">
          <span className="eyebrow">Materiali & finiture</span>
          <h2 id="materials-title">Superfici minerali, <em>palette calma.</em></h2>
          <p>Stampa 3D ad alta risoluzione con finitura opaca al tatto. Quattro tinte coordinate per vestire ogni ambiente con la stessa voce.</p>
          <ul className="finish-list">{finishes.map(item => <li key={item.id}><i style={{ background: item.color }} />{item.name}</li>)}</ul>
          <a className="button outline" href="#configura">Provale sul vaso <span aria-hidden="true">↑</span></a>
        </div>
      </section>

      <section className="sectors" id="settori" aria-labelledby="sectors-title">
        <div className="section-head row">
          <div><span className="eyebrow">Collezioni su misura</span><h2 id="sectors-title">Per ogni spazio <em>dell'ospitalità.</em></h2></div>
        </div>
        <ul className="sector-grid">{sectors.map(([label, icon]) => <li key={label}><Icon name={icon} />{label}</li>)}</ul>
        <ol className="process">
          {[['Configura', 'Forma, finitura e marchio direttamente sul modello 3D.'],
            ['Approva', 'Ricevi rendering e, su richiesta, un campione fisico.'],
            ['Produzione', 'Stampa 3D e finitura a mano di ogni pezzo.'],
            ['Consegna', 'Imballo per singola camera e riassortimenti nel tempo.']].map(([title, text], index) =>
            <li key={title}><b>{String(index + 1).padStart(2, '0')}</b><h3>{title}</h3><p>{text}</p></li>)}
        </ol>
      </section>

      <Quote current={current} />
    </main>
    <footer className="footer">
      <Logo />
      <p>Oggetti di design stampati in 3D per hotel, resort e spazi esclusivi.</p>
      <a href="#top">Torna su ↑</a>
    </footer>
  </>
}

createRoot(document.getElementById('root')).render(<App />)
