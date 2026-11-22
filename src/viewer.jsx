import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

function materialStudy() {
  const profile = new THREE.Shape()
  profile.moveTo(-1, -.62)
  profile.lineTo(1, -.62)
  profile.lineTo(1, .62)
  profile.lineTo(-1, .62)
  profile.closePath()
  const recess = new THREE.Path()
  recess.moveTo(0, .32)
  recess.lineTo(.32, 0)
  recess.lineTo(0, -.32)
  recess.lineTo(-.32, 0)
  recess.closePath()
  profile.holes.push(recess)
  const material = new THREE.MeshStandardMaterial()
  material.name = 'study'
  const front = new THREE.Mesh(new THREE.ExtrudeGeometry(profile, {
    depth: .28, bevelEnabled: true, bevelSize: .035, bevelThickness: .035, bevelSegments: 4,
  }), material)
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.99, 1.23, .11), material)
  back.position.z = -.042
  const group = new THREE.Group()
  group.add(front, back)
  return group
}

function release(root) {
  const materials = new Set()
  const textures = new Set()
  root?.traverse(object => {
    object.geometry?.dispose()
    for (const material of [object.material].flat().filter(Boolean)) {
      materials.add(material)
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value)
    }
  })
  materials.forEach(material => material.dispose())
  textures.forEach(texture => texture.dispose())
}

export default function Viewer({ model, finishMaterials, finish, onCapture, captureRef }) {
  const host = useRef(null)
  const controlsRef = useRef(null)
  const selectedFinish = useRef(finish)
  const materialRefs = useRef([])
  const [status, setStatus] = useState('')
  const [rotating, setRotating] = useState(false)

  useEffect(() => {
    selectedFinish.current = finish
    for (const material of materialRefs.current) {
      material.color.set(finish.color)
      material.roughness = finish.roughness
      material.metalness = finish.metalness
    }
  }, [finish])

  useEffect(() => {
    setStatus(model ? 'Loading 3D asset…' : '')
    const container = host.current
    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true })
    } catch {
      setStatus('3D preview requires WebGL.')
      return
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 1, .05, 100)
    camera.position.set(2.5, 1.6, 4.2)
    const pmrem = new THREE.PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    const environment = pmrem.fromScene(room, .055)
    room.dispose()
    pmrem.dispose()
    scene.environment = environment.texture
    const light = new THREE.DirectionalLight('#fff2df', 2)
    light.position.set(2, 5, 4)
    scene.add(light)
    container.append(renderer.domElement)
    renderer.domElement.setAttribute('aria-label', 'Interactive 3D preview')
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan = false
    controls.enableDamping = true
    controls.minDistance = 2
    controls.maxDistance = 9
    controls.autoRotateSpeed = 1
    controls.saveState()
    controlsRef.current = controls
    let alive = true
    let object

    function show(asset) {
      if (!alive) { release(asset); return }
      object = asset
      object.updateMatrixWorld(true)
      const bounds = new THREE.Box3().setFromObject(object)
      const size = bounds.getSize(new THREE.Vector3()).length()
      const center = bounds.getCenter(new THREE.Vector3())
      const group = new THREE.Group()
      group.scale.setScalar(size ? 2.7 / size : 1)
      object.position.sub(center)
      group.add(object)
      scene.add(group)
      const materials = new Set()
      object.traverse(mesh => {
        for (const material of [mesh.material].flat().filter(Boolean)) {
          if (material.isMeshStandardMaterial && (model ? finishMaterials.includes(material.name) : material.name === 'study')) materials.add(material)
        }
      })
      materialRefs.current = [...materials]
      const current = selectedFinish.current
      materials.forEach(material => {
        material.color.set(current.color)
        material.roughness = current.roughness
        material.metalness = current.metalness
      })
      setStatus('')
    }
    if (model) new GLTFLoader().load(model, gltf => show(gltf.scene), undefined, () => alive && setStatus('The 3D asset could not be loaded.'))
    else show(materialStudy())

    const resize = new ResizeObserver(() => {
      const { clientWidth, clientHeight } = container
      if (!clientWidth || !clientHeight) return
      renderer.setSize(clientWidth, clientHeight)
      camera.aspect = clientWidth / clientHeight
      camera.updateProjectionMatrix()
    })
    resize.observe(container)
    renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera) })
    captureRef.current = () => {
      if (!object) return
      renderer.render(scene, camera)
      onCapture(renderer.domElement.toDataURL('image/png'))
    }
    return () => {
      alive = false
      captureRef.current = null
      controlsRef.current = null
      materialRefs.current = []
      resize.disconnect()
      renderer.setAnimationLoop(null)
      controls.dispose()
      release(object)
      environment.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [model, finishMaterials, onCapture, captureRef])

  useEffect(() => {
    if (controlsRef.current) controlsRef.current.autoRotate = rotating
  }, [rotating, model])

  function move(action) {
    const controls = controlsRef.current
    if (!controls) return
    if (action === 'reset') controls.reset()
    else if (action === 'left' || action === 'right') {
      const offset = controls.object.position.clone().sub(controls.target)
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), action === 'left' ? -.3 : .3)
      controls.object.position.copy(controls.target).add(offset)
      controls.update()
    } else {
      const offset = controls.object.position.clone().sub(controls.target)
      offset.multiplyScalar(action === 'in' ? .8 : 1.25)
      controls.object.position.copy(controls.target).add(offset)
      controls.update()
    }
  }

  return <div className="viewer">
    <div className="viewer-canvas" ref={host} />
    {status && <p className="viewer-status" role="status">{status}</p>}
    <div className="viewer-controls">
      <button type="button" aria-label="Rotate left" onClick={() => move('left')}>↶</button>
      <button type="button" aria-label="Rotate right" onClick={() => move('right')}>↷</button>
      <button type="button" aria-label="Zoom in" onClick={() => move('in')}>+</button>
      <button type="button" aria-label="Zoom out" onClick={() => move('out')}>−</button>
      <button type="button" aria-label="Reset view" onClick={() => move('reset')}>⌂</button>
      <button type="button" aria-pressed={rotating} onClick={() => setRotating(value => !value)}>360°</button>
    </div>
  </div>
}
