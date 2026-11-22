import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js'

export { THREE }

/* ───────────────────────── Caricamento prodotti ───────────────────────── */

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
const cache = new Map()

/**
 * Carica un GLB, lo porta all'altezza reale (metri), lo appoggia a terra centrato sull'asse Y
 * e restituisce un clone indipendente con materiali propri.
 */
export async function loadProduct(product) {
  if (!cache.has(product.model)) cache.set(product.model, loader.loadAsync(product.model).then(gltf => gltf.scene))
  const source = await cache.get(product.model)
  const object = source.clone(true)
  object.traverse(node => {
    if (node.isMesh) {
      node.material = node.material.clone()
      node.castShadow = true
      node.receiveShadow = true
    }
  })
  const inner = new THREE.Group()
  inner.add(object)
  inner.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(object)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const scale = product.height / 1000 / size.y
  inner.scale.setScalar(scale)
  inner.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale)
  const root = new THREE.Group()
  root.add(inner)
  root.updateMatrixWorld(true)
  return root
}

export function bodyMaterials(root) {
  const list = []
  root.traverse(node => { if (node.isMesh) list.push(...[node.material].flat()) })
  return list
}

/** `env`: intensità dei riflessi d'ambiente (three r160 non ha scene.environmentIntensity). */
export function applyFinish(materials, finish, env = .35) {
  for (const material of materials) {
    material.envMapIntensity = env
    material.color.set(finish.color)
    material.roughness = finish.roughness
    material.metalness = finish.metalness ?? 0
    material.needsUpdate = true
  }
}

/* ───────────────────────── Ambiente ───────────────────────── */

export function createRenderer(container, { shadows = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = shadows
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  container.append(renderer.domElement)
  return renderer
}

export function studioEnvironment(renderer, blur = .04) {
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment(renderer)
  const target = pmrem.fromScene(room, blur)
  room.dispose()
  pmrem.dispose()
  return target
}

export function contactFloor(opacity = .28) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.ShadowMaterial({ opacity }))
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  return floor
}

/** Grana leggera da stampa 3D (polvere minerale), generata proceduralmente. */
let grainTexture
export function grain() {
  if (grainTexture) return grainTexture
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const image = ctx.createImageData(size, size)
  for (let i = 0; i < size * size; i++) {
    const v = 118 + Math.random() * 20 + (Math.random() < .015 ? 40 : 0)
    image.data.set([v, v, v, 255], i * 4)
  }
  ctx.putImageData(image, 0, 0)
  grainTexture = new THREE.CanvasTexture(canvas)
  grainTexture.wrapS = grainTexture.wrapT = THREE.RepeatWrapping
  grainTexture.repeat.set(10, 10)
  return grainTexture
}

/* ───────────────────────── Mappa cilindrica della superficie ───────────────────────── */

/**
 * Rasterizza il modello in coordinate cilindriche (θ, h) conservando il raggio più esterno.
 * È l'equivalente di un raycast radiale dall'esterno, ma calcolato una volta sola:
 * dopo, avvolgere il logo costa pochi millisecondi e funziona con qualunque GLB.
 */
export function surfaceField(root, columns = 1024, rows = 640) {
  const triangles = []
  const v = new THREE.Vector3()
  let minY = Infinity, maxY = -Infinity
  root.updateMatrixWorld(true)
  root.traverse(node => {
    if (!node.isMesh) return
    const geometry = node.geometry
    const position = geometry.getAttribute('position')
    const points = new Float32Array(position.count * 3)
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld)
      points.set([v.x, v.y, v.z], i * 3)
      if (v.y < minY) minY = v.y
      if (v.y > maxY) maxY = v.y
    }
    const index = geometry.getIndex()
    triangles.push({ points, index: index ? index.array : null, count: index ? index.count : position.count })
  })
  const span = maxY - minY
  const radius = new Float32Array(columns * rows).fill(-1)
  const TAU = Math.PI * 2
  const toGrid = (x, y, z, out) => {
    let theta = Math.atan2(x, z)
    if (theta < 0) theta += TAU
    out[0] = theta / TAU * columns
    out[1] = (y - minY) / span * (rows - 1)
    out[2] = Math.hypot(x, z)
  }
  const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0]
  const write = (col, row, r) => {
    const j = ((col % columns) + columns) % columns
    const k = row * columns + j
    if (r > radius[k]) radius[k] = r
  }
  for (const { points, index, count } of triangles) {
    for (let t = 0; t < count; t += 3) {
      const ia = index ? index[t] : t, ib = index ? index[t + 1] : t + 1, ic = index ? index[t + 2] : t + 2
      toGrid(points[ia * 3], points[ia * 3 + 1], points[ia * 3 + 2], a)
      toGrid(points[ib * 3], points[ib * 3 + 1], points[ib * 3 + 2], b)
      toGrid(points[ic * 3], points[ic * 3 + 1], points[ic * 3 + 2], c)
      if (a[2] < 1e-5 || b[2] < 1e-5 || c[2] < 1e-5) continue
      // srotola la cucitura θ = 0 / 2π
      const lo = Math.min(a[0], b[0], c[0]), hi = Math.max(a[0], b[0], c[0])
      if (hi - lo > columns / 2) for (const p of [a, b, c]) if (p[0] < columns / 2) p[0] += columns
      if (Math.max(a[0], b[0], c[0]) - Math.min(a[0], b[0], c[0]) > columns / 2) continue
      // i vertici scrivono sempre: copre anche triangoli più piccoli di una cella
      for (const p of [a, b, c]) write(Math.round(p[0]), Math.round(p[1]), p[2])
      const x0 = Math.ceil(Math.min(a[0], b[0], c[0])), x1 = Math.floor(Math.max(a[0], b[0], c[0]))
      const y0 = Math.max(0, Math.ceil(Math.min(a[1], b[1], c[1]))), y1 = Math.min(rows - 1, Math.floor(Math.max(a[1], b[1], c[1])))
      if (x1 < x0 || y1 < y0) continue
      const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
      if (Math.abs(det) < 1e-9) continue
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const l1 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / det
          const l2 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / det
          const l3 = 1 - l1 - l2
          if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue
          write(x, y, l1 * a[2] + l2 * b[2] + l3 * c[2])
        }
      }
    }
  }
  // chiude i piccoli buchi interpolando dai vicini
  for (let pass = 0; pass < 6; pass++) {
    let filled = 0
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 0; x < columns; x++) {
        const k = y * columns + x
        if (radius[k] >= 0) continue
        let sum = 0, n = 0
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const r = radius[(y + dy) * columns + ((x + dx + columns) % columns)]
          if (r >= 0) { sum += r; n++ }
        }
        if (n >= 2) { radius[k] = sum / n; filled++ }
      }
    }
    if (!filled) break
  }
  return createField(radius, columns, rows, minY, maxY)
}

function createField(radius, columns, rows, minY, maxY) {
  const TAU = Math.PI * 2
  const span = maxY - minY
  const dTheta = TAU / columns * 1.5
  const dH = span / (rows - 1) * 1.5
  function r(theta, h) {
    let gx = (theta / TAU) * columns
    gx = ((gx % columns) + columns) % columns
    const gy = Math.min(rows - 1.0001, Math.max(0, (h - minY) / span * (rows - 1)))
    const x0 = Math.floor(gx), y0 = Math.floor(gy)
    const x1 = (x0 + 1) % columns, y1 = Math.min(rows - 1, y0 + 1)
    const fx = gx - x0, fy = gy - y0
    const s00 = radius[y0 * columns + x0], s10 = radius[y0 * columns + x1]
    const s01 = radius[y1 * columns + x0], s11 = radius[y1 * columns + x1]
    let sum = 0, weight = 0
    const add = (s, w) => { if (s >= 0) { sum += s * w; weight += w } }
    add(s00, (1 - fx) * (1 - fy)); add(s10, fx * (1 - fy)); add(s01, (1 - fx) * fy); add(s11, fx * fy)
    return weight > 1e-6 ? sum / weight : -1
  }
  const point = (theta, h, out = new THREE.Vector3()) => {
    const radiusAt = r(theta, h)
    return out.set(Math.sin(theta) * radiusAt, h, Math.cos(theta) * radiusAt)
  }
  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3(), pd = new THREE.Vector3()
  const tTheta = new THREE.Vector3(), tH = new THREE.Vector3()
  const normal = (theta, h, out = new THREE.Vector3()) => {
    point(theta + dTheta, h, pa); point(theta - dTheta, h, pb)
    point(theta, Math.min(maxY, h + dH), pc); point(theta, Math.max(minY, h - dH), pd)
    tTheta.subVectors(pa, pb); tH.subVectors(pc, pd)
    return out.crossVectors(tTheta, tH).normalize()
  }
  /** Quote valide (dove il modello ha superficie) lungo una colonna. */
  function valid(theta) {
    const col = ((Math.round((theta / TAU) * columns) % columns) + columns) % columns
    let first = -1, last = -1
    for (let y = 0; y < rows; y++) if (radius[y * columns + col] > 0) { if (first < 0) first = y; last = y }
    return [minY + first / (rows - 1) * span, minY + last / (rows - 1) * span]
  }
  /** Ascissa curvilinea lungo il profilo verticale (per non deformare il logo sui fianchi inclinati). */
  function arcTable(theta) {
    const heights = new Float32Array(rows), lengths = new Float32Array(rows)
    let previous = null, total = 0
    for (let y = 0; y < rows; y++) {
      const h = minY + y / (rows - 1) * span
      const rr = Math.max(0, r(theta, h))
      if (previous) total += Math.hypot(h - previous[0], rr - previous[1])
      heights[y] = h; lengths[y] = total
      previous = [h, rr]
    }
    const lengthAt = h => {
      const g = Math.min(rows - 1.0001, Math.max(0, (h - minY) / span * (rows - 1)))
      const i = Math.floor(g)
      return lengths[i] + (lengths[i + 1] - lengths[i]) * (g - i)
    }
    const heightAt = s => {
      if (s <= 0) return heights[0]
      if (s >= total) return heights[rows - 1]
      let lo = 0, hi = rows - 1
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; lengths[mid] < s ? lo = mid : hi = mid }
      const f = (s - lengths[lo]) / Math.max(1e-9, lengths[hi] - lengths[lo])
      return heights[lo] + (heights[hi] - heights[lo]) * f
    }
    return { lengthAt, heightAt, total }
  }
  return { r, point, normal, valid, arcTable, minY, maxY }
}

/* ───────────────────────── Marchio: poligoni ───────────────────────── */

/** Un marchio è un elenco di poligoni { outer: [x,y][], holes: [x,y][][] } con y verso l'alto. */

const fontCache = new Map()
export async function loadFont(url) {
  if (!fontCache.has(url)) {
    fontCache.set(url, Promise.all([import('three/addons/loaders/FontLoader.js'), fetch(url).then(r => r.json())])
      .then(([{ Font }, json]) => new Font(json)))
  }
  return fontCache.get(url)
}

const pointsOf = list => list.map(p => [p.x, p.y])

function shapesToPolygons(shapes, divisions = 10, transform = (x, y) => [x, y]) {
  return shapes.map(shape => {
    const { shape: outer, holes } = shape.extractPoints(divisions)
    return {
      outer: pointsOf(outer).map(([x, y]) => transform(x, y)),
      holes: holes.map(hole => pointsOf(hole).map(([x, y]) => transform(x, y))),
    }
  })
}

function starPolygon(cx, cy, outerRadius) {
  const points = []
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + i * Math.PI / 5
    const rr = i % 2 ? outerRadius * .42 : outerRadius
    points.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr])
  }
  return { outer: points, holes: [] }
}

function boundsOf(polygons) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const { outer } of polygons) for (const [x, y] of outer) {
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (y < minY) minY = y; if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

/** Composizione tipografica: righe centrate con interlinea proporzionale e stelle opzionali. */
export function textPolygons(font, lines, stars = 0) {
  const result = []
  let cursor = 0
  const rows = []
  for (const { text, size } of lines) {
    if (!text.trim()) continue
    const polygons = shapesToPolygons(font.generateShapes(text, size), 6)
    if (!polygons.length) continue
    rows.push({ polygons, size, bounds: boundsOf(polygons) })
  }
  if (stars > 0) {
    const size = rows.length ? Math.min(...rows.map(row => row.size)) * .62 : 20
    const polygons = []
    for (let i = 0; i < stars; i++) polygons.push(starPolygon(i * size * 2.1, 0, size))
    rows.push({ polygons, size: size * 1.4, bounds: boundsOf(polygons) })
  }
  rows.forEach((row, index) => {
    const gap = index ? row.size * .38 : 0
    const top = cursor - gap
    const dx = -(row.bounds.minX + row.bounds.width / 2)
    const dy = top - row.bounds.maxY
    for (const polygon of row.polygons) {
      result.push({
        outer: polygon.outer.map(([x, y]) => [x + dx, y + dy]),
        holes: polygon.holes.map(hole => hole.map(([x, y]) => [x + dx, y + dy])),
      })
    }
    cursor = top - row.bounds.height
  })
  return result
}

/** SVG vettoriale: usa i riempimenti; se non ce ne sono (solo tratti, testo…) ripiega sul raster. */
export async function svgPolygons(text) {
  const { SVGLoader } = await import('three/addons/loaders/SVGLoader.js')
  const data = new SVGLoader().parse(text)
  // i tratti (linee senza riempimento) non hanno un'area da estrudere: in quel caso meglio il raster
  const stroked = data.paths.some(path => {
    const style = path.userData?.style
    return style?.stroke && style.stroke !== 'none' && Number(style.strokeWidth ?? 1) > 0
  })
  if (stroked) return []
  const fills = []
  for (const path of data.paths) {
    const fill = path.userData?.style?.fill
    if (!fill || fill === 'none' || fill.startsWith('url(')) continue
    const color = new THREE.Color().setStyle(fill, THREE.LinearSRGBColorSpace)
    const opacity = Number(path.userData.style.fillOpacity ?? 1) * Number(path.userData.style.opacity ?? 1)
    if (opacity < .2) continue
    const luminance = color.r * .2126 + color.g * .7152 + color.b * .0722
    fills.push({ path, luminance })
  }
  const hasDark = fills.some(fill => fill.luminance < .85)
  const polygons = []
  for (const { path, luminance } of fills) {
    if (hasDark && luminance >= .92) continue // sfondo bianco o riempimenti di servizio
    polygons.push(...shapesToPolygons(SVGLoader.createShapes(path), 12, (x, y) => [x, -y]))
  }
  return polygons.filter(polygon => polygon.outer.length > 2)
}

/* ───────────── Vettorializzazione di loghi raster (PNG/JPG) ───────────── */

function otsu(values) {
  const histogram = new Array(256).fill(0)
  for (const value of values) histogram[value]++
  const total = values.length
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * histogram[i]
  let sumB = 0, weightB = 0, best = 0, threshold = 128
  for (let i = 0; i < 256; i++) {
    weightB += histogram[i]
    if (!weightB) continue
    const weightF = total - weightB
    if (!weightF) break
    sumB += i * histogram[i]
    const mB = sumB / weightB, mF = (sum - sumB) / weightF
    const between = weightB * weightF * (mB - mF) ** 2
    if (between > best) { best = between; threshold = i }
  }
  return threshold
}

function area(points) {
  let total = 0
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) total += (points[j][0] * points[i][1] - points[i][0] * points[j][1])
  return total / 2
}

function inside([x, y], polygon) {
  let hit = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j]
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

function simplify(points, epsilon) {
  // Douglas–Peucker su anello chiuso: spezza nei due punti più lontani
  if (points.length < 8) return points
  let far = 0, best = 0
  for (let i = 1; i < points.length; i++) {
    const d = (points[i][0] - points[0][0]) ** 2 + (points[i][1] - points[0][1]) ** 2
    if (d > best) { best = d; far = i }
  }
  const run = list => {
    const keep = new Uint8Array(list.length)
    keep[0] = keep[list.length - 1] = 1
    const stack = [[0, list.length - 1]]
    while (stack.length) {
      const [s, e] = stack.pop()
      const [ax, ay] = list[s], [bx, by] = list[e]
      const length = Math.hypot(bx - ax, by - ay) || 1
      let index = -1, max = epsilon
      for (let i = s + 1; i < e; i++) {
        const d = Math.abs((by - ay) * list[i][0] - (bx - ax) * list[i][1] + bx * ay - by * ax) / length
        if (d > max) { max = d; index = i }
      }
      if (index > 0) { keep[index] = 1; stack.push([s, index], [index, e]) }
    }
    return list.filter((_, i) => keep[i])
  }
  const first = run(points.slice(0, far + 1))
  const second = run([...points.slice(far), points[0]])
  return [...first.slice(0, -1), ...second.slice(0, -1)]
}

function chaikin(points) {
  const out = []
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length]
    const prev = points[(i - 1 + points.length) % points.length]
    // conserva gli spigoli vivi (angoli acuti tipici di lettere e marchi geometrici)
    const v1 = [p[0] - prev[0], p[1] - prev[1]], v2 = [q[0] - p[0], q[1] - p[1]]
    const cos = (v1[0] * v2[0] + v1[1] * v2[1]) / ((Math.hypot(...v1) * Math.hypot(...v2)) || 1)
    if (cos < .35) out.push(p)
    else out.push([p[0] * .75 + prev[0] * .25, p[1] * .75 + prev[1] * .25])
    out.push([p[0] * .75 + q[0] * .25, p[1] * .75 + q[1] * .25])
  }
  return out
}

/**
 * Converte un'immagine in poligoni: soglia (alfa o Otsu), contorno a segmenti di pixel,
 * semplificazione e arrotondamento leggero. Restituisce anche un'anteprima del tracciato.
 */
export async function rasterPolygons(file, { invert = false, maxSide = 640 } = {}) {
  const bitmap = await createImageBitmap(file)
  const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height), 4)
  const scale = Math.max(ratio, Math.min(4, 320 / Math.max(bitmap.width, bitmap.height)))
  const width = Math.max(1, Math.round(bitmap.width * scale)), height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()
  const { data } = ctx.getImageData(0, 0, width, height)
  let transparent = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] < 200) transparent++
  const useAlpha = transparent > width * height * .05
  const luminance = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i++) {
    const a = data[i * 4 + 3] / 255
    // compone su bianco per i PNG semitrasparenti
    const l = (data[i * 4] * .2126 + data[i * 4 + 1] * .7152 + data[i * 4 + 2] * .0722) * a + 255 * (1 - a)
    luminance[i] = Math.round(l)
  }
  const threshold = otsu(luminance)
  const W = width + 2, H = height + 2
  const ink = new Uint8Array(W * H)
  let border = 0, borderInk = 0
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x
    const on = useAlpha ? data[i * 4 + 3] >= 128 : luminance[i] <= threshold
    ink[(y + 1) * W + x + 1] = on ? 1 : 0
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) { border++; if (on) borderInk++ }
  }
  // logo chiaro su fondo scuro: inverte automaticamente
  const autoInvert = !useAlpha && borderInk > border * .6
  if (autoInvert !== invert) for (let y = 1; y <= height; y++) for (let x = 1; x <= width; x++) ink[y * W + x] ^= 1
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : ink[y * W + x]

  // spigoli orientati sul reticolo dei vertici (inchiostro sempre a destra in coordinate schermo)
  const key = (x, y) => y * (W + 1) + x
  const outgoing = new Map()
  const addEdge = (x1, y1, x2, y2) => {
    const k = key(x1, y1)
    const list = outgoing.get(k)
    const edge = { x1, y1, x2, y2, used: false }
    list ? list.push(edge) : outgoing.set(k, [edge])
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!at(x, y)) continue
    if (!at(x, y - 1)) addEdge(x, y, x + 1, y)
    if (!at(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1)
    if (!at(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1)
    if (!at(x - 1, y)) addEdge(x, y + 1, x, y)
  }
  const loops = []
  for (const list of outgoing.values()) for (const start of list) {
    if (start.used) continue
    const loop = []
    let edge = start
    while (edge && !edge.used) {
      edge.used = true
      loop.push([edge.x1, edge.y1])
      const dx = edge.x2 - edge.x1, dy = edge.y2 - edge.y1
      const candidates = (outgoing.get(key(edge.x2, edge.y2)) || []).filter(e => !e.used)
      if (candidates.length > 1) {
        // sui punti di sella gira a destra: separa i pixel che si toccano solo in diagonale
        candidates.sort((p, q) => {
          const turn = e => { const ex = e.x2 - e.x1, ey = e.y2 - e.y1; return dx * ey - dy * ex }
          return turn(q) - turn(p)
        })
      }
      edge = candidates[0]
    }
    if (loop.length >= 4) loops.push(loop)
  }
  const minArea = Math.max(6, width * height * .00004)
  let cleaned = loops.map(loop => {
    const compact = loop.filter((p, i) => {
      const a = loop[(i - 1 + loop.length) % loop.length], b = loop[(i + 1) % loop.length]
      return (b[0] - a[0]) * (p[1] - a[1]) !== (b[1] - a[1]) * (p[0] - a[0])
    })
    let points = simplify(compact.length > 2 ? compact : loop, .9)
    points = chaikin(chaikin(points))
    return { points: points.map(([x, y]) => [x - 1, height - (y - 1)]), area: area(points.map(([x, y]) => [x, height - y])) }
  }).filter(loop => Math.abs(loop.area) >= minArea && loop.points.length >= 3)
  if (!cleaned.length) throw new Error('Nel file non è stato riconosciuto alcun segno. Prova un logo più contrastato.')
  const outerSign = Math.sign(cleaned.reduce((best, loop) => Math.abs(loop.area) > Math.abs(best.area) ? loop : best).area)
  const outers = cleaned.filter(loop => Math.sign(loop.area) === outerSign).map(loop => ({ outer: loop.points, holes: [], area: Math.abs(loop.area) }))
  outers.sort((a, b) => a.area - b.area)
  for (const hole of cleaned.filter(loop => Math.sign(loop.area) !== outerSign)) {
    const probe = hole.points[0]
    const parent = outers.find(outer => outer.area > Math.abs(hole.area) && inside(probe, outer.outer))
    if (parent) parent.holes.push(hole.points)
  }
  return { polygons: outers.map(({ outer, holes }) => ({ outer, holes })), inverted: autoInvert !== invert }
}

/* ───────────────────────── Estrusione e avvolgimento ───────────────────────── */

/**
 * Estrude i poligoni normalizzandoli: lato maggiore = 1, centro nell'origine, z ∈ [0, 1].
 * La geometria viene suddivisa finemente così da poter seguire la curvatura dell'oggetto.
 */
export function extrudeMark(polygons) {
  const bounds = boundsOf(polygons)
  const side = Math.max(bounds.width, bounds.height) || 1
  const cx = bounds.minX + bounds.width / 2, cy = bounds.minY + bounds.height / 2
  const norm = ([x, y]) => new THREE.Vector2((x - cx) / side, (y - cy) / side)
  const shapes = polygons.map(({ outer, holes }) => {
    const shape = new THREE.Shape(outer.map(norm))
    shape.holes = holes.map(hole => new THREE.Path(hole.map(norm)))
    return shape
  })
  const depth = .01
  let geometry = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false, curveSegments: 1 })
  geometry = new TessellateModifier(.028, 7).modify(geometry)
  const position = geometry.getAttribute('position')
  for (let i = 0; i < position.count; i++) position.setZ(i, position.getZ(i) / depth)
  const result = new THREE.BufferGeometry()
  result.setAttribute('position', position)
  result.userData.crease = creaseGroups(position)
  return { geometry: result, width: bounds.width / side, height: bounds.height / side }
}

/** Gruppi di vertici coincidenti, calcolati una volta sola nello spazio normalizzato. */
function creaseGroups(position) {
  const ids = new Map()
  const groupOf = new Int32Array(position.count)
  const q = v => Math.round(v * 1e6)
  for (let i = 0; i < position.count; i++) {
    const key = `${q(position.getX(i))},${q(position.getY(i))},${q(position.getZ(i))}`
    let id = ids.get(key)
    if (id === undefined) { id = ids.size; ids.set(key, id) }
    groupOf[i] = id
  }
  const starts = new Int32Array(ids.size + 1)
  for (let i = 0; i < groupOf.length; i++) starts[groupOf[i] + 1]++
  for (let g = 0; g < ids.size; g++) starts[g + 1] += starts[g]
  const fill = starts.slice(0, -1)
  const members = new Int32Array(groupOf.length)
  for (let i = 0; i < groupOf.length; i++) members[fill[groupOf[i]]++] = i
  return { groupOf, starts, members }
}

/** Normali smussate entro l'angolo di piega: spigoli del rilievo netti, superfici morbide. */
function creasedNormals(array, { groupOf, starts, members }, creaseAngle) {
  const limit = Math.cos(creaseAngle)
  const faces = new Float32Array(array.length / 3)
  for (let t = 0; t < array.length / 9; t++) {
    const o = t * 9
    const ux = array[o + 3] - array[o], uy = array[o + 4] - array[o + 1], uz = array[o + 5] - array[o + 2]
    const vx = array[o + 6] - array[o], vy = array[o + 7] - array[o + 1], vz = array[o + 8] - array[o + 2]
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    const l = Math.hypot(nx, ny, nz) || 1
    faces[t * 3] = nx / l; faces[t * 3 + 1] = ny / l; faces[t * 3 + 2] = nz / l
  }
  const normals = new Float32Array(array.length)
  for (let i = 0; i < groupOf.length; i++) {
    const f = Math.floor(i / 3) * 3
    const fx = faces[f], fy = faces[f + 1], fz = faces[f + 2]
    let x = 0, y = 0, z = 0
    for (let k = starts[groupOf[i]]; k < starts[groupOf[i] + 1]; k++) {
      const g = Math.floor(members[k] / 3) * 3
      if (faces[g] * fx + faces[g + 1] * fy + faces[g + 2] * fz >= limit) { x += faces[g]; y += faces[g + 1]; z += faces[g + 2] }
    }
    const l = Math.hypot(x, y, z) || 1
    normals[i * 3] = x / l; normals[i * 3 + 1] = y / l; normals[i * 3 + 2] = z / l
  }
  return normals
}

export function ellipsePolygon(width, height, segments = 120) {
  const outer = []
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2
    outer.push([Math.cos(a) * width / 2, Math.sin(a) * height / 2])
  }
  return [{ outer, holes: [] }]
}

/**
 * Avvolge una geometria normalizzata sulla superficie: x → arco orizzontale, y → arco lungo il profilo,
 * z → spessore lungo la normale. `size` e `depth` in metri.
 */
export function wrapOnSurface(base, field, { theta, height, size, depth, lift = 0, embed = .00025 }) {
  const source = base.getAttribute('position')
  const count = source.count
  const array = new Float32Array(count * 3)
  const arc = field.arcTable(theta)
  const s0 = arc.lengthAt(height)
  const p = new THREE.Vector3(), n = new THREE.Vector3()
  const { starts, members } = base.userData.crease
  // un solo calcolo per posizione distinta (la geometria non indicizzata ripete ogni vertice ~6 volte)
  for (let g = 0; g < starts.length - 1; g++) {
    const i = members[starts[g]]
    const x = source.getX(i) * size, y = source.getY(i) * size, z = source.getZ(i) * depth + lift - embed
    const h = arc.heightAt(s0 + y)
    const r = Math.max(field.r(theta, h), 1e-4)
    const t = theta + x / r
    field.point(t, h, p)
    field.normal(t, h, n)
    const px = p.x + n.x * z, py = p.y + n.y * z, pz = p.z + n.z * z
    for (let k = starts[g]; k < starts[g + 1]; k++) {
      const o = members[k] * 3
      array[o] = px; array[o + 1] = py; array[o + 2] = pz
    }
  }
  const result = new THREE.BufferGeometry()
  result.setAttribute('position', new THREE.BufferAttribute(array, 3))
  result.setAttribute('normal', new THREE.BufferAttribute(creasedNormals(array, base.userData.crease, Math.PI / 5), 3))
  result.computeBoundingSphere()
  return result
}
