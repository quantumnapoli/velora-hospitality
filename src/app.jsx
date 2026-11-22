import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { finishes, integration, products } from './catalog'
import { download, projectStore, traceLogo } from './storage'
import './style.css'

const Viewer = lazy(() => import('./viewer'))
const findProduct = id => products.find(product => product.id === id) ?? products[0]
const findFinish = id => finishes.find(finish => finish.id === id) ?? finishes[0]
const tabs = ['Design', 'Your collection', 'In your space', 'Request a quote']
const emptyProject = { items: [], logo: null, vector: null, room: null, placement: { x: 50, y: 64, scale: 24 }, roomResult: null, selection: products[0].id, finish: finishes[0].id, roomItem: '', customModels: {} }

function Step({ children }) {
  return <span className="eyebrow step">{children}</span>
}

function useAsset(blob) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!blob) { setUrl(''); return }
    const objectUrl = URL.createObjectURL(blob)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [blob])
  return url
}

function App() {
  const [state, setState] = useState(emptyProject)
  const [tab, setTab] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState('')
  const [quoteSent, setQuoteSent] = useState(false)
  const messageTimer = useRef(null)
  const captureRef = useRef(null)
  const roomStage = useRef(null)
  const logoVersion = useRef(0)
  const studio = useRef(null)
  const [showStudy, setShowStudy] = useState(false)
  const [savedReady, setSavedReady] = useState(false)

  const product = findProduct(state.selection)
  const finish = findFinish(state.finish)
  const customModel = state.customModels[product.id]
  const activeModel = customModel?.finish === finish.id ? customModel.url : product.model
  const selectedRoomItem = state.items.find(item => item.id === state.roomItem) ?? state.items[0]
  const roomProduct = selectedRoomItem ? findProduct(selectedRoomItem.id) : null
  const logoUrl = useAsset(state.logo)
  const roomUrl = useAsset(state.room)
  const resultUrl = useAsset(state.roomResult)

  function notify(text) {
    window.clearTimeout(messageTimer.current)
    setMessage(text)
    messageTimer.current = window.setTimeout(() => setMessage(''), 4200)
  }

  useEffect(() => {
    projectStore().then(saved => { if (saved) setState({ ...emptyProject, ...saved }) })
      .catch(() => notify('Project storage is unavailable in this browser.'))
      .finally(() => setSavedReady(true))
    return () => clearTimeout(messageTimer.current)
  }, [])

  function patch(update) {
    setState(current => ({ ...current, ...(typeof update === 'function' ? update(current) : update) }))
  }

  async function save() {
    try {
      await projectStore(state)
      notify('Project saved on this device.')
    } catch {
      notify('The project could not be saved. Browser storage may be full.')
    }
  }

  function openStudio(next = 0, id) {
    if (id) patch({ selection: id })
    setTab(next)
    setMenuOpen(false)
    setShowStudy(false)
    if (window.location.hash !== '#studio') window.location.hash = 'studio'
    else studio.current?.scrollIntoView({ behavior: 'instant' })
  }

  function add() {
    patch(current => ({
      items: current.items.some(item => item.id === product.id)
        ? current.items.map(item => item.id === product.id && item.finish !== finish.id
          ? { id: product.id, finish: finish.id, quantity: item.quantity } : item)
        : [...current.items, { id: product.id, finish: finish.id, quantity: 1 }],
      roomResult: null,
    }))
    notify(`${product.name} added to your collection.`)
  }

  const capture = useCallback(data => {
    setState(current => ({
      ...current,
      items: current.items.map(item => item.id === current.selection && item.finish === current.finish ? { ...item, preview: data } : item),
    }))
  }, [])

  async function uploadLogo(event) {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file) return
    const version = ++logoVersion.current
    if (file.size > 5 * 1024 * 1024) { notify('Choose a logo under 5 MB.'); return }
    if (!/\.(svg|png)$/i.test(file.name)) { notify('Choose an SVG or PNG logo.'); return }
    try {
      const vector = /\.png$/i.test(file.name) ? await traceLogo(file) : file
      if (version !== logoVersion.current) return
      patch(current => ({
        logo: file, vector, customModels: {}, roomResult: null,
        items: current.items.map(({ preview, ...item }) => item),
      }))
      notify('Logo added to your project.')
    } catch (error) {
      if (version === logoVersion.current) notify(error.message || 'The logo could not be processed.')
    }
  }

  async function engrave() {
    const key = product.id
    const version = logoVersion.current
    if (!state.vector || !product.model || !product.engraving || !integration.engravingEndpoint) return
    setBusy('engraving')
    try {
      const body = new FormData()
      body.append('productId', key)
      body.append('finish', finish.id)
      body.append('logo', state.vector, 'logo.svg')
      const response = await fetch(integration.engravingEndpoint, { method: 'POST', body })
      if (!response.ok) throw new Error()
      const { modelUrl } = await response.json()
      if (!modelUrl) throw new Error()
      if (version === logoVersion.current) patch(current => ({
        customModels: { ...current.customModels, [key]: { url: modelUrl, finish: finish.id } },
      }))
    } catch { notify('Engraving preview is temporarily unavailable.') }
    finally { setBusy('') }
  }

  async function uploadRoom(event) {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) {
      notify('Choose a JPG, PNG or WebP under 15 MB.')
      return
    }
    try {
      const bitmap = await createImageBitmap(file)
      bitmap.close()
      patch({ room: file, roomResult: null })
    } catch { notify('The photo could not be opened.') }
  }

  function placement(update) {
    patch(current => ({ placement: { ...current.placement, ...update }, roomResult: null }))
  }

  function locate(event) {
    if (!roomStage.current || !state.room) return
    const { left, top, width, height } = roomStage.current.getBoundingClientRect()
    const clamp = value => Math.min(97, Math.max(3, value))
    placement({ x: clamp((event.clientX - left) / width * 100), y: clamp((event.clientY - top) / height * 100) })
  }

  const roomCustom = roomProduct && state.customModels[roomProduct.id]
  const roomAsset = roomCustom?.finish === selectedRoomItem?.finish && roomCustom ? roomCustom.url : state.logo ? null : roomProduct?.model
  async function renderRoom() {
    if (!state.room || !roomAsset || !integration.roomRenderEndpoint) return
    setBusy('room')
    try {
      const body = new FormData()
      body.append('room', state.room)
      body.append('modelUrl', roomAsset)
      body.append('productId', selectedRoomItem.id)
      body.append('finish', selectedRoomItem.finish)
      body.append('placement', JSON.stringify(state.placement))
      const response = await fetch(integration.roomRenderEndpoint, { method: 'POST', body })
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error()
      const roomResult = await response.blob()
      patch(current => current.room === state.room && current.placement === state.placement &&
        current.logo === state.logo && current.roomItem === state.roomItem &&
        current.items.some(item => item.id === selectedRoomItem.id && item.finish === selectedRoomItem.finish)
        ? { roomResult } : {})
    } catch { notify('The room render could not be generated.') }
    finally { setBusy('') }
  }

  function exportPlacement() {
    const marker = new Image()
    marker.onload = () => {
      const canvas = document.createElement('canvas')
      const ratio = Math.min(1, 1600 / Math.max(marker.width, marker.height))
      canvas.width = Math.round(marker.width * ratio)
      canvas.height = Math.round(marker.height * ratio)
      const context = canvas.getContext('2d')
      context.drawImage(marker, 0, 0, canvas.width, canvas.height)
      const { x, y, scale } = state.placement
      const radius = canvas.width * scale / 200
      context.fillStyle = '#f5e9d455'
      context.strokeStyle = '#fff5e6'
      context.lineWidth = Math.max(2, canvas.width / 500)
      context.beginPath()
      context.arc(x / 100 * canvas.width, y / 100 * canvas.height, radius, 0, Math.PI * 2)
      context.fill()
      context.stroke()
      context.fillStyle = '#24201d'
      context.fillRect(0, canvas.height - 48, canvas.width, 48)
      context.fillStyle = '#ffffff'
      context.font = `${Math.max(10, Math.min(17, canvas.width / 32))}px sans-serif`
      context.fillText(`VELORA  ·  PLACEMENT STUDY  /  ${(roomProduct?.label ?? '').toUpperCase()}`, 16, canvas.height - 18)
      canvas.toBlob(blob => blob && download(blob, 'velora-placement.png'))
    }
    marker.src = roomUrl
  }

  async function submitQuote(event) {
    event.preventDefault()
    const form = event.currentTarget
    if (!state.items.length) return
    setBusy('quote')
    try {
      const body = new FormData(form)
      body.set('form-name', 'commission')
      body.set('collection', state.items.map(item => `${findProduct(item.id).name} | ${findFinish(item.finish).name} | Qty ${item.quantity} | ${item.preview ? '3D preview captured' : 'Reference image'}`).join('\n'))
      if (state.logo) body.set('logo', state.logo)
      const response = await fetch('/', { method: 'POST', body })
      if (!response.ok) throw new Error()
      setQuoteSent(true)
      form.reset()
    } catch { notify('Your request could not be submitted. Please try again.') }
    finally { setBusy('') }
  }

  const modalTabs = [
    <div className="design-grid" key="design">
      <div className="design-stage">
        <div className="stage-label">
          <span className="eyebrow">{activeModel ? 'Product viewer' : showStudy ? 'Interactive material study' : 'Product reference'}</span>
          {!activeModel && <button type="button" className="text-button" onClick={() => setShowStudy(value => !value)}>{showStudy ? 'View product' : 'Explore finishes in 3D ↗'}</button>}
        </div>
        {activeModel || showStudy ? <Suspense fallback={<div className="viewer loading">Loading the 3D studio…</div>}>
          <Viewer model={activeModel} finishMaterials={product.finishMaterials} finish={finish} captureRef={captureRef} onCapture={capture} />
        </Suspense> : <div className="product-reference"><img src={product.image} alt={product.label} /></div>}
        <p className="stage-caption">{activeModel ? 'Drag to rotate · Scroll or pinch to zoom' : showStudy ? 'Recessed relief sample · Official product model pending' : 'Image from the Velora collection reference'}</p>
      </div>
      <div className="design-options">
        <label className="field-title" htmlFor="design-product">Design object</label>
        <select id="design-product" value={product.id} onChange={event => patch({ selection: event.target.value })}>{products.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select>
        <p className="product-description">{product.description}</p>
        <span className="field-title">Finish <small>{finish.name}</small></span>
        <div className="swatches">{finishes.map(option => <button key={option.id} type="button" aria-label={option.name} aria-pressed={finish.id === option.id} title={option.name} style={{ '--swatch': option.color }} onClick={() => patch({ finish: option.id })} />)}</div>
        <label className="field-title" htmlFor="logo">Your hotel mark</label>
        <label className="upload" htmlFor="logo"><span>{state.logo?.name || 'Upload SVG or PNG'}</span><span aria-hidden="true">↑</span></label>
        <input id="logo" type="file" accept=".svg,.png" className="visually-hidden file-input" onChange={uploadLogo} />
        {state.logo && <div className="logo-line">
          {logoUrl && <img src={logoUrl} alt="Uploaded hotel mark" />}
          {/\.png$/i.test(state.logo.name) && <button type="button" className="text-button" onClick={() => download(state.vector, 'velora-logo-draft.svg')}>Download draft SVG</button>}
          <button type="button" className="text-button" onClick={() => {
            logoVersion.current++
            patch(current => ({ logo: null, vector: null, customModels: {}, roomResult: null, items: current.items.map(({ preview, ...item }) => item) }))
          }}>Remove</button>
        </div>}
        <p className="field-help">{state.logo && /\.png$/i.test(state.logo.name) ? 'PNG conversion creates a draft silhouette for review. ' : ''}{integration.engravingEndpoint && product.engraving ? 'Generate a recessed logo on the product geometry.' : 'Custom engraving preview requires the approved GLB and engraving service.'}</p>
        {integration.engravingEndpoint && product.engraving && <button className="button secondary" type="button" onClick={engrave} disabled={!state.logo || !!busy}>{busy === 'engraving' ? 'Engraving…' : 'Preview engraving'}</button>}
        <div className="actions">
          <button className="button dark" type="button" onClick={add}>Add to collection <span>↗</span></button>
          <button className="text-button" type="button" onClick={save} disabled={!savedReady}>Save project</button>
        </div>
        {activeModel && state.items.some(item => item.id === product.id && item.finish === finish.id) && <button className="text-button" type="button" onClick={() => captureRef.current?.()}>Capture current view</button>}
      </div>
    </div>,
    <div className="work-panel" key="collection">
      <div className="panel-head"><h3>A collection of your own.</h3>{state.logo && <span className="small-tag">{state.logo.name}</span>}</div>
      {state.items.length ? <div className="showroom">{state.items.map(item => {
        const entry = findProduct(item.id)
        return <article className="showroom-item" key={item.id}><img src={item.preview ?? entry.image} alt={entry.label} />
          <div><h4>{entry.name}</h4><p>{findFinish(item.finish).name}</p></div>
          <div className="actions"><button className="text-button" type="button" onClick={() => { patch({ selection: item.id, finish: item.finish }); setTab(0) }}>Edit</button><button className="text-button" type="button" onClick={() => patch(current => ({ items: current.items.filter(candidate => candidate.id !== item.id), roomResult: null }))}>Remove</button></div>
        </article>
      })}</div> : <p>Choose objects and finishes in the design studio to begin.</p>}
      <div className="actions"><button className="button dark" type="button" onClick={() => setTab(state.items.length ? 2 : 0)}>{state.items.length ? 'Visualize in your space' : 'Choose an object'} <span>↗</span></button><button className="text-button" type="button" onClick={save} disabled={!savedReady}>Save project</button></div>
    </div>,
    <div className="work-panel" key="room">
      <div className="panel-head"><h3>See it in your space.</h3><span className="small-tag">{resultUrl ? 'Photorealistic preview' : 'Placement study'}</span></div>
      <div className="room-grid">
        <div className="room-preview">
          {roomUrl ? <div ref={roomStage} className="room-photo" onClick={resultUrl ? undefined : locate}>
            <img src={resultUrl || roomUrl} alt={resultUrl ? 'Rendered room preview' : 'Uploaded room photograph'} />
            {!resultUrl && <span className="placement-marker" aria-hidden="true" style={{ left: `${state.placement.x}%`, top: `${state.placement.y}%`, width: `${state.placement.scale}%` }}>+</span>}
          </div> : <p>Upload a room photograph to begin your placement study.</p>}
        </div>
        <div className="room-options">
          <label className="upload" htmlFor="room-upload"><span>{state.room ? 'Replace room photograph' : 'Upload room photograph'}</span><span>↑</span></label>
          <input id="room-upload" className="visually-hidden file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadRoom} />
          <label className="field-title" htmlFor="room-object">Collection object</label>
          <select id="room-object" value={selectedRoomItem?.id ?? ''} onChange={event => patch({ roomItem: event.target.value, roomResult: null })}>
            {!state.items.length && <option value="">Add an object to your collection</option>}
            {state.items.map(item => <option key={item.id} value={item.id}>{findProduct(item.id).name}</option>)}
          </select>
          {state.room && [['x', 'Horizontal position', 97], ['y', 'Vertical position', 97], ['scale', 'Scale', 70]].map(([key, label, max]) =>
            <label key={key} className="slider-label">{label}<input type="range" min="3" max={max} value={state.placement[key]} onChange={event => placement({ [key]: +event.target.value })} /></label>
          )}
          <p className="field-help">Placement and scale are approximate. Photorealistic preview requires the approved 3D asset and rendering service.</p>
          <div className="actions">
            {integration.roomRenderEndpoint && <button className="button dark" type="button" disabled={!state.room || !roomAsset || !!busy} onClick={renderRoom}>{busy === 'room' ? 'Rendering…' : 'Render preview'}</button>}
            <button className="button secondary" type="button" disabled={!state.room} onClick={() => state.roomResult ? download(state.roomResult, `velora-visualization.${state.roomResult.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png'}`) : exportPlacement()}>{state.roomResult ? 'Download visualization' : 'Download placement'}</button>
            <button className="text-button" type="button" onClick={save} disabled={!savedReady}>Save project</button>
          </div>
        </div>
      </div>
    </div>,
    <div className="work-panel" key="quote">
      <div className="panel-head"><h3>Commission your collection.</h3></div>
      {!state.items.length ? <><p>Add at least one object to prepare your request.</p><button className="button dark" type="button" onClick={() => setTab(0)}>Choose an object <span>↗</span></button></>
      : <div className="quote-grid">
        <div><span className="field-title">Collection summary</span><div className="quote-summary">{state.items.map(item => {
          const entry = findProduct(item.id)
          return <div className="quote-item" key={item.id}>
            <img src={item.preview ?? entry.image} alt={entry.label} />
            <div><strong>{entry.name}</strong><p>{findFinish(item.finish).name}</p></div>
            <label>Qty<input type="number" min="1" step="1" value={item.quantity} onChange={event => {
              const quantity = Math.max(1, Math.trunc(Number(event.target.value)) || 1)
              patch(current => ({ items: current.items.map(candidate => candidate.id === item.id ? { ...candidate, quantity } : candidate) }))
            }} /></label>
          </div>
        })}</div><p className="field-help">{logoUrl && <img className="inline-logo" src={logoUrl} alt="Hotel mark" />}{state.logo ? state.logo.name : 'No hotel mark attached'}</p></div>
        {quoteSent ? <div role="status"><h4>Request received.</h4><p>Your commission request has been submitted.</p><button className="text-button" type="button" onClick={() => setQuoteSent(false)}>Send another request</button></div> :
          <form className="quote-form" onSubmit={submitQuote} method="POST" name="commission">
            <input className="visually-hidden" tabIndex={-1} autoComplete="off" name="website" aria-hidden="true" />
            <label>Name<input name="name" required autoComplete="name" /></label>
            <label>Email<input name="email" type="email" required autoComplete="email" /></label>
            <label>Property<input name="property" required autoComplete="organization" /></label>
            <label>Project notes<textarea name="message" rows="3" /></label>
            <button className="button dark" type="submit" disabled={!!busy}>{busy === 'quote' ? 'Sending…' : 'Request a quote'} <span>↗</span></button>
          </form>
        }
      </div>}
    </div>,
  ]

  return <>
    <a className="skip" href="#main">Skip to content</a>
    <header className="header">
      <a href="#top" className="wordmark" aria-label="Velora home">VELORA<span>ITALIAN DESIGN OBJECTS</span></a>
      <button className="nav-toggle" type="button" aria-expanded={menuOpen} aria-controls="main-nav" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? 'Close' : 'Menu'}</button>
      <nav id="main-nav" className={menuOpen ? 'open' : ''} aria-label="Main navigation">
        <a href="#collection" onClick={() => setMenuOpen(false)}>Collection</a>
        <a href="#materials" onClick={() => setMenuOpen(false)}>Materials</a>
        <a href="#studio" onClick={event => { event.preventDefault(); openStudio(0) }}>Design Studio</a>
        <a className="mobile-quote" href="#studio" onClick={event => { event.preventDefault(); openStudio(3) }}>Request a quote</a>
      </nav>
      <a className="header-cta" href="#studio" onClick={event => { event.preventDefault(); openStudio(3) }}>Request a quote <span>↗</span></a>
    </header>
    <main id="main">
      <section className="hero" id="top" aria-labelledby="hero-title">
        <div className="hero-photo" />
        <div className="hero-inner wrap">
          <Step>Objects for exceptional stays</Step>
          <h1 id="hero-title">Your space.<br /><em>Your identity.</em></h1>
          <p>A collection of contemporary Italian design objects,<br className="desktop" /> made uniquely yours.</p>
          <div className="hero-actions">
            <a className="button light" href="#collection">Explore collection <span>↗</span></a>
            <a className="hero-link" href="#studio" onClick={event => { event.preventDefault(); openStudio(0) }}>Create your collection <span>↗</span></a>
          </div>
        </div>
        <div className="hero-bottom wrap"><a href="#collection" aria-label="Scroll to collection">↓</a><span>Sculptural vases <i /> Editorial visualization</span></div>
      </section>
      <section className="catalog wrap" id="collection" aria-labelledby="collection-heading">
        <div className="section-top">
          <div><Step>The collection</Step><h2 id="collection-heading">Objects with <em>presence.</em></h2></div>
          <p>From reception to the guest suite, a family of sculptural pieces brings one design language to the entire stay.</p>
        </div>
        <div className="catalog-feature">
          <a href="#studio" className="feature-image" onClick={event => { event.preventDefault(); openStudio(0, '01') }}>
            <img src="/images/velora-suite.webp" alt="Objects from the Parker’s collection in a hospitality suite" loading="lazy" />
          </a>
          <div className="feature-copy">
            <Step>The Parker’s collection</Step>
            <h3>One language.<br /><em>Room to room.</em></h3>
            <p>From the sculptural vase to the guest-room sign, a shared relief ties each object to the space it belongs to.</p>
            <a href="#studio" onClick={event => { event.preventDefault(); openStudio(0, '01') }}>Start with an object <span>↗</span></a>
          </div>
        </div>
        <div className="catalog-strip">
          {products.map(entry => <article className="object-card" key={entry.id}>
            <a href="#studio" onClick={event => { event.preventDefault(); openStudio(0, entry.id) }}>
              <div className="object-image"><img src={entry.image} alt={entry.label} loading="lazy" /><span className="object-arrow" aria-hidden="true">↗</span></div>
              <div className="object-info"><h3>{entry.name}</h3></div>
              <p>{entry.label}</p>
            </a>
          </article>)}
        </div>
      </section>
      <section className="materials" id="materials" aria-labelledby="materials-heading">
        <img src="/images/velora-detail.webp" alt="Close-up of the sculptural surface shown in the Velora collection" loading="lazy" />
        <div className="material-copy">
          <Step>Materials & finishes</Step>
          <h2 id="materials-heading">A palette <em>in harmony.</em></h2>
          <p>Four finishes, from warm ivory to neutral blue and graphite, to bring a shared expression to every room.</p>
          <div className="palette">{finishes.map(option => <button key={option.id} type="button" onClick={() => { patch({ finish: option.id }); openStudio() }}><i style={{ backgroundColor: option.color }} /><span>{option.name}</span></button>)}</div>
        </div>
      </section>
      <section id="studio" className="studio wrap" ref={studio} aria-labelledby="studio-heading">
        <div className="section-top"><div><Step>The design studio</Step><h2 id="studio-heading">Make it <em>yours.</em></h2></div><p>Choose your objects, coordinate finishes and bring your hotel mark into the collection.</p></div>
        <div className="studio-nav" aria-label="Studio steps">
          {tabs.map((label, index) => <button type="button" key={label} aria-pressed={index === tab} onClick={() => setTab(index)}>{label}{index === 1 && state.items.length > 0 && <small>{state.items.length}</small>}</button>)}
        </div>
        {modalTabs[tab]}
      </section>
    </main>
    <footer className="footer"><div className="wrap"><a href="#top" className="wordmark">VELORA<span>ITALIAN DESIGN OBJECTS</span></a><p>Contemporary objects for hospitality.</p><a href="#top" className="back-top">Back to top ↑</a></div></footer>
    <div className={message ? 'toast visible' : 'toast'} role="status">{message}</div>
  </>
}

createRoot(document.getElementById('root')).render(<App />)
