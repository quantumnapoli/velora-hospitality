import {
  THREE, applyFinish, bodyMaterials, contactFloor, createRenderer, extrudeMark, loadFont,
  loadProduct, studioEnvironment, surfaceField, textPolygons, wrapOnSurface,
} from './core'

/**
 * Hero: il vaso in luce radente su fondo caldo, rotazione lenta e parallasse col puntatore.
 * Il marchio d'esempio compare a ogni giro, per raccontare la personalizzazione.
 */
export async function mountHero(container, { product, finish, mark, font, onReady }) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const renderer = createRenderer(container)
  renderer.toneMappingExposure = .95
  renderer.domElement.setAttribute('aria-hidden', 'true')
  const scene = new THREE.Scene()
  const environment = studioEnvironment(renderer, .08)
  scene.environment = environment.texture
  const camera = new THREE.PerspectiveCamera(24, 1, .01, 20)

  const h = product.height / 1000
  const key = new THREE.SpotLight('#ffd6a0', 16, 0, .42, .9, 1.4)
  key.position.set(-.75, .6, .32)
  key.target.position.set(0, h * .45, 0)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.bias = -.0002
  key.shadow.normalBias = .0015
  key.shadow.radius = 6
  const rim = new THREE.DirectionalLight('#ffe2bf', 2.4)
  rim.position.set(.8, .5, -.7)
  const bounce = new THREE.HemisphereLight('#fff3e2', '#3a2a1f', .5)
  const front = new THREE.DirectionalLight('#ffe9d0', .9)
  front.position.set(.25, .3, 1)
  scene.add(key, key.target, rim, bounce, front)
  const floor = contactFloor(.42)
  scene.add(floor)

  const pivot = new THREE.Group()
  scene.add(pivot)
  const root = await loadProduct(product)
  pivot.add(root)
  applyFinish(bodyMaterials(root), finish, .28)

  let markMesh
  try {
    const typeface = await loadFont(font)
    const polygons = textPolygons(typeface, [{ text: mark.line1, size: 14 }, { text: mark.line2, size: 30 }], mark.stars)
    const base = extrudeMark(polygons)
    const field = surfaceField(root, 768, 480)
    const geometry = wrapOnSurface(base.geometry, field, { theta: 0, height: h * product.mark.heightPct / 100, size: product.mark.box.w / 1000, depth: .0012 })
    base.geometry.dispose()
    const material = new THREE.MeshStandardMaterial()
    applyFinish([material], { color: '#4a4038', roughness: .5 }, .16)
    markMesh = new THREE.Mesh(geometry, material)
    markMesh.castShadow = true
    pivot.add(markMesh)
  } catch { /* il marchio d'esempio è facoltativo */ }

  const frame = () => {
    const { clientWidth: width, clientHeight: height } = container
    if (!width || !height) return
    renderer.setSize(width, height)
    camera.aspect = width / height
    // inquadratura: il vaso occupa ~78% dell'altezza disponibile
    const distance = (h * .64) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.max(1, .62 / camera.aspect)
    camera.position.set(0, h * .56, distance)
    camera.lookAt(0, h * .49, 0)
    camera.updateProjectionMatrix()
  }
  const resize = new ResizeObserver(frame)
  resize.observe(container)
  frame()

  let visible = true
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting })
  intersection.observe(container)
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
  const move = event => {
    pointer.tx = (event.clientX / window.innerWidth - .5) * 2
    pointer.ty = (event.clientY / window.innerHeight - .5) * 2
  }
  window.addEventListener('pointermove', move, { passive: true })

  let angle = -.9, last = performance.now()
  renderer.setAnimationLoop(now => {
    if (!visible) { last = now; return }
    const dt = Math.min(.05, (now - last) / 1000)
    last = now
    if (!reduced) angle += dt * .22
    pointer.x += (pointer.tx - pointer.x) * .04
    pointer.y += (pointer.ty - pointer.y) * .04
    pivot.rotation.y = angle + pointer.x * .25
    pivot.rotation.x = pointer.y * .035
    key.position.x = -.75 + pointer.x * .12
    renderer.render(scene, camera)
  })
  requestAnimationFrame(() => onReady?.())

  return () => {
    renderer.setAnimationLoop(null)
    resize.disconnect()
    intersection.disconnect()
    window.removeEventListener('pointermove', move)
    scene.traverse(node => {
      if (!node.isMesh) return
      node.geometry.dispose()
      ;[node.material].flat().forEach(material => material.dispose())
    })
    environment.dispose()
    renderer.dispose()
    renderer.domElement.remove()
  }
}
