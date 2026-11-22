import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { collection, demoMark, finishes, fonts, markTones, products, sectors } from './catalog'
import './style.css'

const find = (list, id) => list.find(item => item.id === id) ?? list[0]
const loadCore = () => import('./three/core.js')
const mm = value => `${Math.round(value)} mm`

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
      product: products[0], finish: finishes[0], mark: demoMark, font: fonts[0].url, onReady: () => alive && setReady(true),
    })).then(cleanup => { if (alive) dispose = cleanup; else cleanup?.() }).catch(() => {})
    return () => { alive = false; dispose?.() }
  }, [])
  return <section className="hero" id="top" aria-labelledby="hero-title">
    <div className="hero-glow" aria-hidden="true" />
    <div className="hero-copy">
      <Logo />
      <span className="tricolore" aria-hidden="true"><i /><i /><i /></span>
      <h1 id="hero-title">Oggetti scultorei<br />con il <em>tuo marchio</em>,<br />stampati in 3D.</h1>
      <p>Vasi, accessori bagno e segnaletica per hotel, resort e spazi esclusivi. Scegli la forma, carica il logo: lo estrudiamo in rilievo e lo vedi sull'oggetto, in tempo reale.</p>
      <div className="hero-actions">
        <a className="button light" href="#configura">Personalizza in 3D <span aria-hidden="true">↓</span></a>
        <a className="hero-link" href="#collezione">Scopri la collezione</a>
      </div>
      <ul className="hero-points">
        {[['cube', 'Design esclusivo'], ['leaf', 'Materiali sostenibili'], ['sliders', 'Personalizzazione totale'], ['infinity', 'Collezioni modulari']].map(([icon, label]) =>
          <li key={label}><Icon name={icon} />{label}</li>)}
      </ul>
    </div>
    <div className={`hero-stage${ready ? ' ready' : ''}`} ref={stage}>
      <span className="hero-caption">Vaso Onda · Bianco Avorio · marchio in rilievo 1,2 mm</span>
    </div>
  </section>
}

/* ───────────────────────── Configuratore ───────────────────────── */

const defaultConfig = product => ({
  product: product.id, finish: finishes[0].id, tone: 'grafite',
  mode: 'testo', ...demoMark,
  heightPct: product.mark.heightPct, angle: 0, size: product.mark.size, depth: 1.2, medallion: true,
})

function Range({ label, value, display, min, max, step = 1, onChange }) {
  return <label className="range">
    <span>{label}<output>{display ?? value}</output></span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} />
  </label>
}

function Configurator({ onConfigured }) {
  const stage = useRef(null)
  const studio = useRef(null)
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState('Preparazione dello studio 3D…')
  const [config, setConfig] = useState(() => defaultConfig(products[0]))
  const [logo, setLogo] = useState(null)
  const [logoBusy, setLogoBusy] = useState(false)
  const [logoError, setLogoError] = useState('')
  const [measure, setMeasure] = useState(null)
  const [rotating, setRotating] = useState(false)
  const [exporting, setExporting] = useState('')
  const product = find(products, config.product)
  const finish = find(finishes, config.finish)
  const tone = find(markTones, config.tone)
  const patch = update => setConfig(current => ({ ...current, ...update }))

  useEffect(() => {
    let alive = true
    import('./three/studio.js').then(({ Studio }) => {
      if (!alive) return
      studio.current = new Studio(stage.current, {
        onStatus: setStatus,
        onPlacement: placement => setConfig(current => ({ ...current, ...placement })),
        onMeasure: setMeasure,
      })
      setReady(true)
    }).catch(() => setStatus('Il tuo browser non supporta la grafica 3D (WebGL).'))
    return () => { alive = false; studio.current?.dispose(); studio.current = null }
  }, [])

  useEffect(() => {
    if (!ready) return
    studio.current.setProduct(product).catch(() => {})
  }, [ready, product])

  useEffect(() => { if (ready) { studio.current.setFinish(finish); studio.current.setMarkTone(tone) } }, [ready, finish, tone])
  useEffect(() => { if (ready) studio.current.setAutoRotate(rotating) }, [ready, rotating])

  useEffect(() => {
    if (!ready) return
    const { heightPct, angle, size, depth, medallion } = config
    studio.current.setPlacement({ heightPct, angle, size, depth, medallion })
  }, [ready, config.heightPct, config.angle, config.size, config.depth, config.medallion])

  // geometria del marchio: testo composto oppure logo vettorializzato
  useEffect(() => {
    if (!ready) return
    let alive = true
    const timer = setTimeout(async () => {
      if (config.mode === 'logo') { studio.current.setMark(logo?.polygons ?? null); return }
      const { loadFont, textPolygons } = await loadCore()
      const font = await loadFont(find(fonts, config.font).url)
      if (!alive) return
      const polygons = textPolygons(font, [{ text: config.line1, size: 14 }, { text: config.line2, size: 30 }], config.stars)
      studio.current.setMark(polygons.length ? polygons : null)
    }, 120)
    return () => { alive = false; clearTimeout(timer) }
  }, [ready, config.mode, config.line1, config.line2, config.stars, config.font, logo])

  useEffect(() => { onConfigured({ config, product, finish, tone, logo, measure, studio }) }, [config, product, finish, tone, logo, measure, onConfigured])

  function selectProduct(next) {
    patch({ product: next.id, heightPct: next.mark.heightPct, size: next.mark.size, angle: 0 })
  }

  async function processLogo(file, invert = false) {
    setLogoError('')
    if (!file) return
    if (file.size > 8 * 1024 * 1024) { setLogoError('Il file supera 8 MB.'); return }
    const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)
    if (!isSvg && !/^image\/(png|jpeg|webp)$/.test(file.type)) { setLogoError('Formati accettati: SVG, PNG, JPG, WebP.'); return }
    setLogoBusy(true)
    try {
      const { svgPolygons, rasterPolygons } = await loadCore()
      let polygons = null, kind = 'raster', inverted = false
      if (isSvg && !invert) {
        polygons = await svgPolygons(await file.text()).catch(() => null)
        if (polygons?.length) kind = 'vector'
      }
      if (!polygons?.length) {
        const source = isSvg ? await rasterizeSvg(file) : file
        ;({ polygons, inverted } = await rasterPolygons(source, { invert }))
      }
      // marchi compatti (stemmi, monogrammi): dimensione ridotta per restare nella zona liscia
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
      for (const { outer } of polygons) for (const [x, y] of outer) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y) }
      const aspect = (maxX - minX) / Math.max(1e-6, maxY - minY)
      if (file !== logo?.file) patch({ size: Math.round(product.mark.size * (aspect < 1.4 ? .62 : 1)) })
      setLogo(current => {
        if (current?.url && current.file !== file) URL.revokeObjectURL(current.url)
        return { file, url: current?.file === file ? current.url : URL.createObjectURL(file), polygons, kind, invert, inverted, shapes: polygons.length }
      })
      patch({ mode: 'logo' })
    } catch (error) {
      setLogoError(error.message || 'Il logo non può essere elaborato.')
    } finally { setLogoBusy(false) }
  }

  async function exportFile(type) {
    if (!studio.current) return
    setExporting(type)
    try {
      if (type === 'stl') download(await studio.current.exportSTL(), `velora-${product.id}.stl`)
      else download(await studio.current.snapshot(), `velora-${product.id}.png`)
    } finally { setExporting('') }
  }

  const angleLabel = config.angle === 0 ? 'Fronte' : `${config.angle > 0 ? '+' : ''}${config.angle}°`
  return <section className="configurator" id="configura" aria-labelledby="config-title">
    <div className="section-head">
      <span className="eyebrow">Configuratore 3D</span>
      <h2 id="config-title">Il tuo marchio, <em>scolpito sull'oggetto.</em></h2>
      <p>Scegli forma e finitura, scrivi il nome della struttura o carica il logo: viene estruso in rilievo e avvolto sulla superficie, come nel pezzo stampato.</p>
    </div>
    <div className="config-grid">
      <div className="config-stage">
        <div className="canvas-host" ref={stage} />
        {status && <p className="stage-status" role="status">{status}</p>}
        <div className="stage-top">
          <span className="chip">{product.name} · {product.detail.split(' · ')[1]}</span>
          <span className="chip ghost">{finish.name}</span>
        </div>
        <div className="stage-tools" role="toolbar" aria-label="Vista 3D">
          <button type="button" onClick={() => studio.current?.frameAll()}>Vista intera</button>
          <button type="button" onClick={() => studio.current?.frameMark()}>Dettaglio marchio</button>
          <button type="button" aria-pressed={rotating} onClick={() => setRotating(value => !value)}>360°</button>
        </div>
        <p className="stage-hint">Trascina il marchio per spostarlo · Ruota e ingrandisci con mouse o dita</p>
      </div>

      <div className="config-panel">
        <fieldset className="step">
          <legend><b>01</b> Oggetto</legend>
          <div className="product-options">
            {products.map(item => <button type="button" key={item.id} aria-pressed={item.id === product.id} onClick={() => selectProduct(item)}>
              <strong>{item.name}</strong><small>{item.detail}</small>
            </button>)}
          </div>
          <p className="help">{product.description}</p>
        </fieldset>

        <fieldset className="step">
          <legend><b>02</b> Finitura <small>{finish.name}</small></legend>
          <div className="swatches">
            {finishes.map(item => <button type="button" key={item.id} aria-label={item.name} title={item.name} aria-pressed={item.id === finish.id} style={{ '--swatch': item.color }} onClick={() => patch({ finish: item.id })} />)}
          </div>
        </fieldset>

        <fieldset className="step">
          <legend><b>03</b> Marchio</legend>
          <div className="segmented" role="tablist">
            <button type="button" role="tab" aria-selected={config.mode === 'testo'} onClick={() => patch({ mode: 'testo' })}>Testo</button>
            <button type="button" role="tab" aria-selected={config.mode === 'logo'} onClick={() => patch({ mode: 'logo' })}>Carica logo</button>
          </div>
          {config.mode === 'testo' ? <div className="text-fields">
            <label>Prima riga<input value={config.line1} maxLength={28} onChange={event => patch({ line1: event.target.value })} placeholder="GRAND HOTEL" /></label>
            <label>Nome<input value={config.line2} maxLength={22} onChange={event => patch({ line2: event.target.value })} placeholder="Nome struttura" /></label>
            <div className="inline-fields">
              <label>Stelle<select value={config.stars} onChange={event => patch({ stars: Number(event.target.value) })}>
                {[0, 1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value ? '★'.repeat(value) : 'Nessuna'}</option>)}
              </select></label>
              <label>Carattere<select value={config.font} onChange={event => patch({ font: event.target.value })}>
                {fonts.map(font => <option key={font.id} value={font.id}>{font.name}</option>)}
              </select></label>
            </div>
          </div> : <div className="logo-fields">
            <label className={`dropzone${logoBusy ? ' busy' : ''}`}
              onDragOver={event => event.preventDefault()}
              onDrop={event => { event.preventDefault(); processLogo(event.dataTransfer.files[0]) }}>
              <input type="file" accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp" className="visually-hidden"
                onChange={event => { processLogo(event.target.files[0]); event.target.value = '' }} />
              {logo ? <img src={logo.url} alt="Logo caricato" /> : <span className="drop-icon" aria-hidden="true">↑</span>}
              <span>{logoBusy ? 'Vettorializzazione in corso…' : logo ? logo.file.name : 'Trascina qui il logo o scegli un file'}<small>SVG consigliato · PNG, JPG, WebP fino a 8 MB</small></span>
            </label>
            {logoError && <p className="error" role="alert">{logoError}</p>}
            {logo && <div className="logo-meta">
              <span>{logo.kind === 'vector' ? 'Vettoriale originale' : 'Contorni ricavati dall\'immagine'} · {logo.shapes} forme</span>
              <button type="button" className="text-button" onClick={() => processLogo(logo.file, !logo.invert)}>Inverti pieni e vuoti</button>
              <button type="button" className="text-button" onClick={() => { URL.revokeObjectURL(logo.url); setLogo(null) }}>Rimuovi</button>
            </div>}
          </div>}
          <div className="tones">
            <span className="mini-label">Colore del rilievo</span>
            {markTones.map(item => <button type="button" key={item.id} aria-pressed={item.id === tone.id} onClick={() => patch({ tone: item.id })}>
              <i style={{ background: item.color ?? finish.color }} />{item.name}
            </button>)}
          </div>
        </fieldset>

        <fieldset className="step">
          <legend><b>04</b> Posizione e rilievo</legend>
          <Range label="Altezza sull'oggetto" value={config.heightPct} display={mm(product.height * config.heightPct / 100)} min={4} max={92} step={.5} onChange={heightPct => patch({ heightPct })} />
          <Range label="Rotazione" value={config.angle} display={angleLabel} min={-180} max={180} onChange={angle => patch({ angle })} />
          <Range label="Larghezza marchio" value={config.size} display={measure ? `${mm(measure.w)} × ${mm(measure.h)}` : mm(config.size)} min={16} max={Math.round(product.height * .55)} onChange={size => patch({ size })} />
          <Range label="Spessore del rilievo" value={config.depth} display={`${config.depth.toFixed(1).replace('.', ',')} mm`} min={.4} max={3} step={.1} onChange={depth => patch({ depth })} />
          <label className="toggle"><input type="checkbox" checked={config.medallion} onChange={event => patch({ medallion: event.target.checked })} /><span />Medaglione ovale sotto il marchio</label>
        </fieldset>

        <div className="panel-actions">
          <a className="button dark" href="#preventivo">Richiedi preventivo <span aria-hidden="true">→</span></a>
          <div className="downloads">
            <button type="button" className="text-button" disabled={!!exporting} onClick={() => exportFile('png')}>{exporting === 'png' ? 'Rendering…' : 'Salva immagine'}</button>
            <button type="button" className="text-button" disabled={!!exporting} onClick={() => exportFile('stl')}>{exporting === 'stl' ? 'Esportazione…' : 'Scarica STL'}</button>
          </div>
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
      if (current) {
        const { config, product, finish, tone, logo, measure, studio } = current
        body.set('configurazione', [
          `${product.name} (${product.detail})`,
          `Finitura: ${finish.name}`,
          `Marchio: ${config.mode === 'logo' ? `logo ${logo?.file.name ?? 'non caricato'}` : `${config.line1} / ${config.line2} / ${config.stars} stelle / carattere ${config.font}`}`,
          `Colore rilievo: ${tone.name} · spessore ${config.depth} mm${config.medallion ? ' · con medaglione' : ''}`,
          measure ? `Ingombro marchio: ${Math.round(measure.w)} × ${Math.round(measure.h)} mm` : '',
          `Posizione: altezza ${Math.round(product.height * config.heightPct / 100)} mm, rotazione ${config.angle}°`,
        ].filter(Boolean).join('\n'))
        if (logo?.file) body.set('logo', logo.file)
        const preview = await studio.current?.snapshot(1000, 1000).catch(() => null)
        if (preview) body.set('anteprima', new File([preview], 'anteprima.png', { type: 'image/png' }))
      }
      const response = await fetch('/', { method: 'POST', body })
      if (!response.ok) throw new Error()
      setState('sent')
      form.reset()
    } catch { setState('error') }
  }
  const summary = current && <ul className="quote-summary">
    <li><span>Oggetto</span>{current.product.name} · {current.product.detail}</li>
    <li><span>Finitura</span>{current.finish.name}</li>
    <li><span>Marchio</span>{current.config.mode === 'logo' ? (current.logo?.file.name ?? 'Logo da caricare') : [current.config.line1, current.config.line2].filter(Boolean).join(' · ')}</li>
    <li><span>Rilievo</span>{current.tone.name} · {current.config.depth.toFixed(1).replace('.', ',')} mm{current.config.medallion ? ' · medaglione' : ''}</li>
  </ul>
  return <section className="quote" id="preventivo" aria-labelledby="quote-title">
    <div className="quote-copy">
      <span className="eyebrow">Preventivo</span>
      <h2 id="quote-title">Portiamo la tua collezione <em>in produzione.</em></h2>
      <p>Allegheremo alla richiesta la configurazione, l'anteprima 3D e il logo. Ti rispondiamo con quotazione, tempi e un campione fisico su richiesta.</p>
      {summary}
      <a className="text-button" href="#configura">Modifica la configurazione ↑</a>
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
      <label className="wide">Note<textarea name="note" rows="3" placeholder="Altri oggetti della collezione, colori, tempi…" /></label>
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
