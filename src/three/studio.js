import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {
  THREE, applyFinish, bodyMaterials, contactFloor, createRenderer, ellipsePolygon, extrudeMark,
  loadProduct, studioEnvironment, surfaceField, wrapOnSurface,
} from './core'

const TAU = Math.PI * 2
const MM = .001

/**
 * Configuratore: un prodotto GLB, un marchio estruso che ne segue la superficie,
 * un medaglione opzionale. Tutte le misure reali sono in millimetri lato interfaccia.
 */
export class Studio {
  constructor(container, { onStatus = () => {}, onPlacement = () => {}, onMeasure = () => {} } = {}) {
    this.container = container
    this.onMeasure = onMeasure
    this.onStatus = onStatus
    this.onPlacement = onPlacement
    this.placement = { heightPct: 20, angle: 0, size: 60, depth: 1.2, medallion: true }
    this.renderer = createRenderer(container)
    this.renderer.toneMappingExposure = 1.12
    this.renderer.domElement.setAttribute('aria-label', 'Anteprima 3D interattiva del prodotto personalizzato')
    this.scene = new THREE.Scene()
    this.environment = studioEnvironment(this.renderer)
    this.scene.environment = this.environment.texture
    this.camera = new THREE.PerspectiveCamera(30, 1, .01, 20)

    const key = new THREE.DirectionalLight('#fff1de', 3.2)
    key.position.set(-1.4, 1.2, .9)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.bias = -.0005
    key.shadow.normalBias = .002
    key.shadow.radius = 4
    this.key = key
    const rim = new THREE.DirectionalLight('#dfe8ff', .9)
    rim.position.set(1.4, .9, -1.2)
    const fill = new THREE.HemisphereLight('#fff7ec', '#8a7765', .38)
    this.scene.add(key, key.target, rim, fill)
    this.floor = contactFloor(.22)
    this.scene.add(this.floor)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.enablePan = false
    this.controls.autoRotateSpeed = 1.4
    this.controls.minPolarAngle = .25
    this.controls.maxPolarAngle = Math.PI / 2 + .05

    this.materials = { body: [], mark: new THREE.MeshStandardMaterial(), medal: new THREE.MeshStandardMaterial() }
    this.markMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.materials.mark)
    this.medalMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.materials.medal)
    for (const mesh of [this.markMesh, this.medalMesh]) { mesh.castShadow = true; mesh.receiveShadow = true }
    this.scene.add(this.markMesh, this.medalMesh)

    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2()
    this.dragging = false
    this.bindPointer()

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.visible = true
    this.intersection = new IntersectionObserver(([entry]) => { this.visible = entry.isIntersecting })
    this.intersection.observe(container)
    this.tween = null
    this.renderer.setAnimationLoop(time => this.frame(time))
    this.resize()
  }

  resize() {
    const { clientWidth: width, clientHeight: height } = this.container
    if (!width || !height) return
    this.renderer.setSize(width, height)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  frame(time) {
    if (!this.visible) return
    if (this.tween) {
      const t = Math.min(1, (time - this.tween.start) / this.tween.duration)
      const e = 1 - (1 - t) ** 3
      this.camera.position.lerpVectors(this.tween.fromPosition, this.tween.toPosition, e)
      this.controls.target.lerpVectors(this.tween.fromTarget, this.tween.toTarget, e)
      if (t >= 1) this.tween = null
    }
    if (this.dirty) this.rebuild()
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  /* ───────── Prodotto ───────── */

  async setProduct(product) {
    const token = (this.token = Symbol())
    this.onStatus('Caricamento del modello 3D…')
    let root
    try { root = await loadProduct(product) } catch (error) {
      if (token === this.token) this.onStatus('Il modello 3D non è stato caricato. Ricarica la pagina.')
      throw error
    }
    if (token !== this.token) return
    if (this.product) { this.scene.remove(this.product); dispose(this.product) }
    this.product = root
    this.productInfo = product
    this.scene.add(root)
    this.materials.body = bodyMaterials(root)
    if (this.finish) this.setFinish(this.finish)
    this.field = surfaceField(root)
    const height = product.height * MM
    this.heightM = height
    const radius = Math.max(...[0, .25, .5, .75].map(t => Math.abs(this.field.r(t * TAU, height * .4))))
    this.radiusM = radius
    this.key.shadow.camera.left = this.key.shadow.camera.bottom = -height
    this.key.shadow.camera.right = this.key.shadow.camera.top = height
    this.key.shadow.camera.near = .01
    this.key.shadow.camera.far = 6
    this.key.position.set(-1.4, 1.2, .9).normalize().multiplyScalar(height * 4)
    this.key.shadow.camera.updateProjectionMatrix()
    this.controls.minDistance = height * .45
    this.controls.maxDistance = height * 5
    this.dirty = true
    this.frameAll(false)
    this.onStatus('')
  }

  setFinish(finish) {
    this.finish = finish
    applyFinish(this.materials.body, finish, .5)
    this.applyMarkTone()
  }

  setMarkTone(tone) {
    this.tone = tone
    this.applyMarkTone()
  }

  applyMarkTone() {
    if (!this.finish) return
    const tone = this.tone?.color ? this.tone : null
    applyFinish([this.materials.medal], this.finish, .5)
    applyFinish([this.materials.mark], tone ?? this.finish, .5)
  }

  /* ───────── Marchio ───────── */

  setMark(polygons) {
    this.markBase?.geometry.dispose()
    this.markBase = polygons?.length ? extrudeMark(polygons) : null
    this.dirty = true
  }

  setPlacement(placement) {
    this.placement = { ...this.placement, ...placement }
    this.dirty = true
  }

  /** Dimensioni reali del marchio e del medaglione, in metri. */
  dimensions() {
    const { size, medallion } = this.placement
    if (!this.markBase) return null
    const w = this.markBase.width * size * MM, h = this.markBase.height * size * MM
    const medal = medallion ? { w: w * 1.24 + 9 * MM, h: h * 1.42 + 9 * MM } : null
    return { w, h, medal }
  }

  rebuild() {
    this.dirty = false
    if (!this.field) return
    const dims = this.dimensions()
    this.markMesh.visible = !!dims
    this.medalMesh.visible = !!dims?.medal
    this.onMeasure(dims && { w: dims.w * 1000, h: dims.h * 1000, medal: dims.medal && { w: dims.medal.w * 1000, h: dims.medal.h * 1000 } })
    if (!dims) return
    const { angle, heightPct, size, depth } = this.placement
    const theta = ((angle / 360) * TAU % TAU + TAU) % TAU
    // tiene l'ingombro all'interno della superficie utile
    const [lo, hi] = this.field.valid(theta)
    const arc = this.field.arcTable(theta)
    const half = (dims.medal ? dims.medal.h : dims.h) / 2 + 2 * MM
    const sLo = arc.lengthAt(lo + this.heightM * .02) + half
    const sHi = arc.lengthAt(hi - this.heightM * .04) - half
    let s = arc.lengthAt(this.heightM * heightPct / 100)
    if (sLo < sHi) s = Math.min(sHi, Math.max(sLo, s))
    const height = arc.heightAt(s)
    this.markCenter = { theta, height }
    const medalLift = .6 * MM
    if (dims.medal) {
      this.medalBase ??= extrudeMark(ellipsePolygon(1, 1))
      const side = Math.max(dims.medal.w, dims.medal.h)
      // ellisse unitaria scalata in modo anisotropo prima dell'avvolgimento
      const base = this.medalBase.geometry
      const scaled = base.clone()
      scaled.userData = base.userData
      scaled.scale(dims.medal.w / side, dims.medal.h / side, 1)
      const geometry = wrapOnSurface(scaled, this.field, { theta, height, size: side, depth: medalLift })
      scaled.dispose()
      this.medalMesh.geometry.dispose()
      this.medalMesh.geometry = geometry
    }
    const geometry = wrapOnSurface(this.markBase.geometry, this.field, {
      theta, height, size: size * MM, depth: depth * MM, lift: dims.medal ? medalLift : 0,
    })
    this.markMesh.geometry.dispose()
    this.markMesh.geometry = geometry
  }

  /* ───────── Camera ───────── */

  animateTo(position, target, duration = 900) {
    this.tween = {
      start: performance.now(), duration,
      fromPosition: this.camera.position.clone(), toPosition: position,
      fromTarget: this.controls.target.clone(), toTarget: target,
    }
  }

  frameAll(animate = true) {
    if (!this.heightM) return
    const h = this.heightM
    const box = new THREE.Box3().setFromObject(this.product)
    const width = Math.max(box.max.x - box.min.x, box.max.z - box.min.z)
    const portrait = this.camera.aspect < 1
    const half = Math.max(h * (portrait ? .78 : .66), width * .62 / this.camera.aspect * 1.25)
    const distance = half / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))
    const theta = this.markCenter?.theta ?? (this.placement.angle / 360) * TAU
    const position = new THREE.Vector3(Math.sin(theta) * distance, h * .62, Math.cos(theta) * distance)
    const target = new THREE.Vector3(0, h * (portrait ? .4 : .44), 0)
    if (animate) this.animateTo(position, target)
    else { this.camera.position.copy(position); this.controls.target.copy(target); this.controls.update() }
  }

  frameMark() {
    if (this.dirty) this.rebuild()
    if (!this.markCenter || !this.field) return this.frameAll()
    const { theta, height } = this.markCenter
    const dims = this.dimensions()
    const span = Math.max(dims?.medal?.w ?? dims?.w ?? .05, (dims?.medal?.h ?? dims?.h ?? .05) * 1.5)
    const surface = this.field.point(theta, height)
    const normal = this.field.normal(theta, height)
    const distance = span * .78 / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) / Math.min(1, this.camera.aspect)
    const direction = new THREE.Vector3(normal.x, Math.max(normal.y, 0) + .06, normal.z).normalize()
    this.animateTo(surface.clone().addScaledVector(direction, distance), surface)
  }

  setAutoRotate(value) { this.controls.autoRotate = value }

  /* ───────── Trascinamento del marchio ───────── */

  bindPointer() {
    const canvas = this.renderer.domElement
    const cast = (event, objects) => {
      const rect = canvas.getBoundingClientRect()
      this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
      this.raycaster.setFromCamera(this.pointer, this.camera)
      return this.raycaster.intersectObjects(objects.filter(Boolean), true)[0]
    }
    this.onDown = event => {
      if (!this.markMesh.visible) return
      const hit = cast(event, [this.markMesh, this.medalMesh.visible && this.medalMesh])
      if (!hit) return
      this.dragging = true
      this.controls.enabled = false
      canvas.setPointerCapture(event.pointerId)
      canvas.style.cursor = 'grabbing'
      event.preventDefault()
    }
    this.onMove = event => {
      if (!this.dragging) {
        if (event.pointerType === 'mouse' && this.markMesh.visible) {
          canvas.style.cursor = cast(event, [this.markMesh, this.medalMesh.visible && this.medalMesh]) ? 'grab' : ''
        }
        return
      }
      const hit = cast(event, [this.product])
      if (!hit) return
      let angle = THREE.MathUtils.radToDeg(Math.atan2(hit.point.x, hit.point.z))
      if (angle > 180) angle -= 360
      const heightPct = THREE.MathUtils.clamp(hit.point.y / this.heightM * 100, 0, 100)
      this.setPlacement({ angle: Math.round(angle), heightPct: Math.round(heightPct * 10) / 10 })
      this.onPlacement({ angle: Math.round(angle), heightPct: Math.round(heightPct * 10) / 10 })
    }
    this.onUp = event => {
      if (!this.dragging) return
      this.dragging = false
      this.controls.enabled = true
      canvas.style.cursor = ''
      canvas.releasePointerCapture?.(event.pointerId)
    }
    canvas.addEventListener('pointerdown', this.onDown)
    canvas.addEventListener('pointermove', this.onMove)
    canvas.addEventListener('pointerup', this.onUp)
    canvas.addEventListener('pointercancel', this.onUp)
  }

  /* ───────── Esportazioni ───────── */

  snapshot(width = 1400, height = 1400) {
    const { domElement } = this.renderer
    const previous = { w: domElement.width, h: domElement.height, aspect: this.camera.aspect, ratio: this.renderer.getPixelRatio() }
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.render(this.scene, this.camera)
    return new Promise(resolve => domElement.toBlob(blob => {
      this.renderer.setPixelRatio(previous.ratio)
      this.resize()
      resolve(blob)
    }, 'image/png'))
  }

  async exportSTL() {
    const { STLExporter } = await import('three/addons/exporters/STLExporter.js')
    const group = new THREE.Group()
    const add = mesh => {
      const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld)
      geometry.scale(1000, 1000, 1000)
      // STL: Z verso l'alto, come nei software di slicing
      geometry.rotateX(Math.PI / 2)
      group.add(new THREE.Mesh(geometry))
    }
    this.product.updateMatrixWorld(true)
    this.product.traverse(node => node.isMesh && add(node))
    if (this.markMesh.visible) add(this.markMesh)
    if (this.medalMesh.visible) add(this.medalMesh)
    const data = new STLExporter().parse(group, { binary: true })
    group.traverse(node => node.geometry?.dispose())
    return new Blob([data], { type: 'model/stl' })
  }

  dispose() {
    this.token = null
    this.renderer.setAnimationLoop(null)
    this.resizeObserver.disconnect()
    this.intersection.disconnect()
    const canvas = this.renderer.domElement
    canvas.removeEventListener('pointerdown', this.onDown)
    canvas.removeEventListener('pointermove', this.onMove)
    canvas.removeEventListener('pointerup', this.onUp)
    canvas.removeEventListener('pointercancel', this.onUp)
    this.controls.dispose()
    if (this.product) dispose(this.product)
    this.markMesh.geometry.dispose()
    this.medalMesh.geometry.dispose()
    this.markBase?.geometry.dispose()
    this.medalBase?.geometry.dispose()
    Object.values(this.materials).flat().forEach(material => material.dispose?.())
    this.floor.geometry.dispose(); this.floor.material.dispose()
    this.environment.dispose()
    this.renderer.dispose()
    canvas.remove()
  }
}

function dispose(root) {
  root.traverse(node => {
    if (!node.isMesh) return
    node.geometry.dispose()
    ;[node.material].flat().forEach(material => material.dispose())
  })
}
