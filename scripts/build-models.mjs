// Genera i modelli GLB provvisori della collezione (superfici di rivoluzione con onde scultoree).
// Uso: npm run models  →  public/models/*.glb   (unità: metri, asse Y verso l'alto)
import { mkdtemp, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'

globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.() }) }
  readAsDataURL(blob) { blob.arrayBuffer().then(buffer => { this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`; this.onloadend?.() }) }
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

// Profilo a lama: salita morbida e gradino netto, come i petali sovrapposti delle foto.
function blade(phase) {
  const u = phase - Math.floor(phase)
  const lip = .84
  // lo strato nasce sotto il labbro precedente, si gonfia e termina con un bordo arrotondato
  if (u < lip) return .04 + .96 * (1 - Math.pow(1 - u / lip, 2.6))
  const v = (u - lip) / (1 - lip)
  return .04 + .96 * Math.sqrt(Math.max(0, 1 - v * v * v))
}

function product({ height, profile, wall, blades, twist, amplitude, envelope, segments = 384, rows = 240 }) {
  const curve = new THREE.CatmullRomCurve3(profile.map(([h, r]) => new THREE.Vector3(r * height, h * height, 0)), false, 'centripetal')
  const outer = []
  for (let i = 0; i <= rows; i++) {
    const h = (i / rows) * height
    // campiona il raggio del profilo alla quota h
    let lo = 0, hi = 1
    for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; curve.getPoint(mid).y < h ? lo = mid : hi = mid }
    outer.push([h, curve.getPoint((lo + hi) / 2).x])
  }
  const positions = [], indices = [], uvs = []
  // le colonne di vertici seguono l'elica delle onde: labbri netti senza scalettature
  const ring = (radiusAt, y, v, offset = 0) => {
    const start = positions.length / 3
    for (let j = 0; j <= segments; j++) {
      const theta = (j / segments) * Math.PI * 2 + offset
      const r = radiusAt(theta)
      positions.push(Math.sin(theta) * r, y, Math.cos(theta) * r)
      uvs.push(j / segments, v)
    }
    return start
  }
  const strip = (a, b, flip) => {
    for (let j = 0; j < segments; j++) {
      const p = a + j, q = a + j + 1, r = b + j, s = b + j + 1
      flip ? indices.push(p, q, r, q, s, r) : indices.push(p, r, q, q, r, s)
    }
  }
  const rows3d = []
  const maxR = Math.max(...outer.map(([, r]) => r))
  // parete esterna con le onde (ampiezza proporzionale al raggio locale)
  outer.forEach(([h, r], i) => {
    const t = h / height
    const amp = amplitude * envelope(t) * height * Math.pow(r / maxR, 1.1)
    const offset = -twist(t) / blades * Math.PI * 2
    rows3d.push(ring(theta => r + amp * blade(theta / (Math.PI * 2) * blades + twist(t)), h, i / rows, offset))
  })
  // bordo arrotondato e parete interna liscia
  const [topH, topR] = outer.at(-1)
  const lip = 10
  for (let k = 1; k <= lip; k++) {
    const a = (k / lip) * Math.PI
    rows3d.push(ring(() => topR - wall / 2 + Math.cos(a) * wall / 2, topH + Math.sin(a) * wall * .55, 1, -twist(1) / blades * Math.PI * 2))
  }
  const innerRows = outer.filter(([h], i) => h > wall * 1.6 && (i % 4 === 0 || i === outer.length - 1)).reverse()
  innerRows.forEach(([h, r]) => rows3d.push(ring(() => Math.max(r - wall, wall), h, 1, -twist(h / height) / blades * Math.PI * 2)))
  for (let i = 0; i < rows3d.length - 1; i++) strip(rows3d[i], rows3d[i + 1], false)
  // fondo interno
  const innerBottom = positions.length / 3
  positions.push(0, innerRows.at(-1)[0], 0); uvs.push(.5, 1)
  const lastInner = rows3d.at(-1)
  for (let j = 0; j < segments; j++) indices.push(innerBottom, lastInner + j, lastInner + j + 1)
  // base esterna con piccolo smusso
  const baseR = outer[0][1]
  const chamfer = ring(() => baseR - wall * .45, 0, 0, -twist(0) / blades * Math.PI * 2)
  // ricolloca lo smusso appena sopra il piano
  for (let j = 0; j <= segments; j++) positions[(chamfer + j) * 3 + 1] = 0
  for (let j = 0; j <= segments; j++) positions[(rows3d[0] + j) * 3 + 1] = wall * .35
  strip(chamfer, rows3d[0], false)
  const bottom = positions.length / 3
  positions.push(0, 0, 0); uvs.push(.5, 0)
  for (let j = 0; j < segments; j++) indices.push(bottom, chamfer + j + 1, chamfer + j)

  let geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  // salda la cucitura a theta = 0/2π per normali continue
  geometry = mergeSeam(geometry)
  geometry.computeVertexNormals()
  return geometry
}

function mergeSeam(geometry) {
  const position = geometry.getAttribute('position')
  const map = new Map(), remap = new Uint32Array(position.count)
  const keep = []
  for (let i = 0; i < position.count; i++) {
    const key = `${position.getX(i).toFixed(6)},${position.getY(i).toFixed(6)},${position.getZ(i).toFixed(6)}`
    if (map.has(key)) remap[i] = map.get(key)
    else { map.set(key, keep.length); remap[i] = keep.length; keep.push(i) }
  }
  const out = new THREE.BufferGeometry()
  const pos = new Float32Array(keep.length * 3), uv = new Float32Array(keep.length * 2)
  const uvAttr = geometry.getAttribute('uv')
  keep.forEach((src, i) => { pos.set([position.getX(src), position.getY(src), position.getZ(src)], i * 3); uv.set([uvAttr.getX(src), uvAttr.getY(src)], i * 2) })
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  const index = geometry.getIndex().array
  const next = []
  for (let i = 0; i < index.length; i += 3) {
    const a = remap[index[i]], b = remap[index[i + 1]], c = remap[index[i + 2]]
    if (a !== b && b !== c && a !== c) next.push(a, b, c)
  }
  out.setIndex(next)
  return out
}

const models = {
  'vaso-onda-alto': product({
    height: .32, wall: .0035, blades: 8, amplitude: .044,
    twist: t => -4.8 * t - 1.4 * t * t,
    envelope: t => smooth(.27, .5, t) * (1 - .55 * smooth(.88, .99, t)),
    profile: [[0, .145], [.08, .175], [.2, .2], [.33, .207], [.46, .195], [.6, .162], [.72, .118], [.82, .085], [.9, .072], [.96, .08], [1, .105]],
  }),
  'vaso-onda-basso': product({
    height: .2, wall: .003, blades: 12, amplitude: .06,
    twist: t => -5.6 * t - 1.6 * t * t,
    envelope: t => smooth(.4, .6, t) * (1 - .7 * smooth(.86, .97, t)),
    profile: [[0, .27], [.12, .34], [.3, .4], [.45, .41], [.6, .37], [.74, .28], [.84, .2], [.92, .17], [.97, .18], [1, .2]],
  }),
  'portaspazzolini': product({
    height: .115, wall: .003, blades: 4, amplitude: .032,
    twist: t => -1.5 * t - .5 * t * t,
    envelope: t => smooth(.46, .72, t) * (1 - .6 * smooth(.92, 1, t)),
    profile: [[0, .26], [.04, .275], [.2, .282], [.5, .29], [.8, .298], [.96, .302], [1, .3]],
    segments: 240, rows: 120,
  }),
}

const exporter = new GLTFExporter()
const raw = await mkdtemp(join(tmpdir(), 'velora-'))
for (const [name, geometry] of Object.entries(models)) {
  const material = new THREE.MeshStandardMaterial({ color: '#e5d9c9', roughness: .66, metalness: 0 })
  material.name = 'corpo'
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  const scene = new THREE.Scene()
  scene.add(mesh)
  const glb = await exporter.parseAsync(scene, { binary: true })
  const source = join(raw, `${name}.glb`)
  await writeFile(source, Buffer.from(glb))
  // compressione meshopt + quantizzazione (decodificata nel browser da MeshoptDecoder)
  execFileSync('npx', ['gltfpack', '-i', source, '-o', `public/models/${name}.glb`, '-cc', '-vn', '12', '-vt', '12'], { stdio: 'inherit' })
  console.log(name, geometry.getAttribute('position').count, 'vertici')
}
