/**
 * 第 8 课课后作业：My Room in 3D — 房间场景加载
 *
 * 参考 Bruno Simon 的 my-room-in-3d 项目，实现：
 * 1. Loading 进度条
 * 2. GLTF 模型加载（房间 + 装饰物）
 * 3. 烘焙着色器（日/夜/中性三种光照模式）
 * 4. 相机导航（轨道控制）
 * 5. 交互元素（弹跳 Logo、屏幕视频、咖啡蒸汽、LED 等）
 * 6. 控制面板
 */

import * as THREE from 'three'
import { SceneManager } from '@/core/SceneManager'
import { ControlPanel } from '@/core/ControlPanel'
import { LoadingScreen } from '@/core/LoadingScreen'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

import bakedVertexShader from './shaders/baked/vertex.glsl?raw'
import bakedFragmentShader from './shaders/baked/fragment.glsl?raw'

// ========== 资源路径 ==========
const BASE = '/models/room/'
const TEX_BASE = '/textures/room/'

const ASSETS = {
  roomModel: BASE + 'roomModel.glb',
  pcScreenModel: BASE + 'pcScreenModel.glb',
  macScreenModel: BASE + 'macScreenModel.glb',
  topChairModel: BASE + 'topChairModel.glb',
  coffeeSteamModel: BASE + 'coffeeSteamModel.glb',
  elgatoLightModel: BASE + 'elgatoLightModel.glb',
  googleHomeLedsModel: BASE + 'googleHomeLedsModel.glb',
  loupedeckButtonsModel: BASE + 'loupedeckButtonsModel.glb',
  bakedDay: TEX_BASE + 'bakedDay.jpg',
  bakedNight: TEX_BASE + 'bakedNight.jpg',
  bakedNeutral: TEX_BASE + 'bakedNeutral.jpg',
  lightMap: TEX_BASE + 'lightMap.jpg',
  logoTexture: TEX_BASE + 'threejsJourneyLogo.png',
  ledMask: TEX_BASE + 'googleHomeLedMask.png',
  videoPortfolio: BASE + 'videoPortfolio.mp4',
  videoStream: BASE + 'videoStream.mp4',
}

// ========== 初始化 ==========
async function init() {
  const canvas = document.getElementById('homework_canvas') as HTMLCanvasElement

  // ---- 场景管理器 ----
  const manager = new SceneManager({
    canvas,
    bgColor: '#000000',
    fov: 20,
  })

  manager.camera.position.set(0, 2, 0)
  manager.camera.lookAt(0, 2, 0)

  // ---- 轨道控制器 ----
  const controls = new OrbitControls(manager.camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.target.set(0, 2, 0)
  controls.minDistance = 10
  controls.maxDistance = 50
  controls.maxPolarAngle = Math.PI * 0.5
  controls.minPolarAngle = 0.01
  controls.enablePan = false
  controls.update()

  // ---- Loading 界面 ----
  const loadingScreen = new LoadingScreen({
    title: '加载房间中…',
    gradientFrom: '#4f46e5',
    gradientTo: '#7c3aed',
    background: '#000',
  })
  loadingScreen.show()

  // ---- Loading Manager ----
  const loadingManager = new THREE.LoadingManager()
  loadingManager.onProgress = (_url, loaded, total) => {
    loadingScreen.update(total > 0 ? loaded / total : 0)
  }
  loadingManager.onLoad = () => {
    loadingScreen.hide()
    console.log('所有资源加载完成')
  }
  loadingManager.onError = (url) => {
    console.error('加载失败:', url)
  }

  // ---- 加载器 ----
  const dracoLoader = new DRACOLoader(loadingManager)
  dracoLoader.setDecoderPath('/draco/')
  const gltfLoader = new GLTFLoader(loadingManager)
  gltfLoader.setDRACOLoader(dracoLoader)
  const textureLoader = new THREE.TextureLoader(loadingManager)

  // ---- 加载所有资源 ----
  console.log('开始加载资源...')

  const [
    roomGltf,
    bakedDayTex, bakedNightTex, bakedNeutralTex, lightMapTex,
    logoTexture, ledMaskTex,
    pcScreenGltf, macScreenGltf,
    topChairGltf, coffeeSteamGltf, elgatoLightGltf,
    googleLedsGltf, loupedeckGltf,
  ] = await Promise.all([
    gltfLoader.loadAsync(ASSETS.roomModel),
    textureLoader.loadAsync(ASSETS.bakedDay),
    textureLoader.loadAsync(ASSETS.bakedNight),
    textureLoader.loadAsync(ASSETS.bakedNeutral),
    textureLoader.loadAsync(ASSETS.lightMap),
    textureLoader.loadAsync(ASSETS.logoTexture),
    textureLoader.loadAsync(ASSETS.ledMask),
    gltfLoader.loadAsync(ASSETS.pcScreenModel),
    gltfLoader.loadAsync(ASSETS.macScreenModel),
    gltfLoader.loadAsync(ASSETS.topChairModel),
    gltfLoader.loadAsync(ASSETS.coffeeSteamModel),
    gltfLoader.loadAsync(ASSETS.elgatoLightModel),
    gltfLoader.loadAsync(ASSETS.googleHomeLedsModel),
    gltfLoader.loadAsync(ASSETS.loupedeckButtonsModel),
  ])

  // ---- 纹理设置 ----
  bakedDayTex.colorSpace = THREE.SRGBColorSpace
  bakedDayTex.flipY = false
  bakedNightTex.colorSpace = THREE.SRGBColorSpace
  bakedNightTex.flipY = false
  bakedNeutralTex.colorSpace = THREE.SRGBColorSpace
  bakedNeutralTex.flipY = false
  lightMapTex.flipY = false

  // ========== 房间烘焙着色器 ==========
  const roomMesh = roomGltf.scene.children[0] as THREE.Mesh
  const bakedMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uBakedDayTexture: { value: bakedDayTex },
      uBakedNightTexture: { value: bakedNightTex },
      uBakedNeutralTexture: { value: bakedNeutralTex },
      uLightMapTexture: { value: lightMapTex },
      uNightMix: { value: 1 },
      uNeutralMix: { value: 0 },
      uLightTvColor: { value: new THREE.Color('#ff115e') },
      uLightTvStrength: { value: 1.47 },
      uLightDeskColor: { value: new THREE.Color('#ff6700') },
      uLightDeskStrength: { value: 1.9 },
      uLightPcColor: { value: new THREE.Color('#0082ff') },
      uLightPcStrength: { value: 1.4 },
    },
    vertexShader: bakedVertexShader,
    fragmentShader: bakedFragmentShader,
  })

  roomMesh.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.material = bakedMaterial
    }
  })
  manager.scene.add(roomGltf.scene)

  // ========== 屏幕视频 ==========
  function createScreenVideo(mesh: THREE.Mesh, videoPath: string) {
    const video = document.createElement('video')
    video.muted = true
    video.loop = true
    video.playsInline = true
    video.autoplay = true
    video.src = videoPath
    video.play().catch(() => {})

    const texture = new THREE.VideoTexture(video)
    texture.colorSpace = THREE.SRGBColorSpace

    const material = new THREE.MeshBasicMaterial({ map: texture })
    mesh.material = material
    manager.scene.add(mesh)
  }

  createScreenVideo(pcScreenGltf.scene.children[0] as THREE.Mesh, ASSETS.videoPortfolio)
  createScreenVideo(macScreenGltf.scene.children[0] as THREE.Mesh, ASSETS.videoStream)

  // ========== 弹跳 Logo（电视机屏幕内） ==========
  logoTexture.colorSpace = THREE.SRGBColorSpace
  const logoGroup = new THREE.Group()
  // 电视机在房间中的位置
  logoGroup.position.set(4.2, 2.717, 1.630)
  manager.scene.add(logoGroup)

  const logoMaterial = new THREE.MeshBasicMaterial({
    map: logoTexture,
    transparent: true,
    premultipliedAlpha: true,
  })
  const logoGeometry = new THREE.PlaneGeometry(4, 1, 1, 1)
  logoGeometry.rotateY(-Math.PI * 0.5)
  const logoMesh = new THREE.Mesh(logoGeometry, logoMaterial)
  // 缩放适配电视机屏幕大小
  logoMesh.scale.y = 0.359
  logoMesh.scale.z = 0.424
  logoGroup.add(logoMesh)

  // 弹跳动画状态（在电视机屏幕范围内移动）
  const logoAnim = {
    z: 0,
    y: 0,
    speedZ: 0.00061,
    speedY: 0.00037,
    limitsZ: { min: -1.076, max: 1.454 },
    limitsY: { min: -1.055, max: 0.947 },
  }

  // ========== 咖啡蒸汽 ==========
  coffeeSteamGltf.scene.position.set(0, 0, 0)
  manager.scene.add(coffeeSteamGltf.scene)

  // ========== 其他装饰模型 ==========
  manager.scene.add(topChairGltf.scene)
  manager.scene.add(elgatoLightGltf.scene)
  manager.scene.add(googleLedsGltf.scene)
  manager.scene.add(loupedeckGltf.scene)

  // ========== Google LED 旋转 ==========
  ledMaskTex.colorSpace = THREE.SRGBColorSpace
  const ledMaterial = new THREE.MeshBasicMaterial({
    map: ledMaskTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
  })
  googleLedsGltf.scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.material = ledMaterial
    }
  })

  // ========== 控制面板 ==========
  const panel = new ControlPanel()
  let autoRotate = false
  let rotateSpeed = 0.3

  panel.addSelect({
    id: 'lighting',
    label: '光照模式',
    type: 'select',
    options: [
      { value: 'night', label: '夜晚模式' },
      { value: 'day', label: '白天模式' },
      { value: 'neutral', label: '中性模式' },
    ],
    defaultValue: 'night',
    onChange: (value) => {
      switch (value) {
        case 'night':
          bakedMaterial.uniforms.uNightMix.value = 1
          bakedMaterial.uniforms.uNeutralMix.value = 0
          break
        case 'day':
          bakedMaterial.uniforms.uNightMix.value = 0
          bakedMaterial.uniforms.uNeutralMix.value = 0
          break
        case 'neutral':
          bakedMaterial.uniforms.uNightMix.value = 0
          bakedMaterial.uniforms.uNeutralMix.value = 1
          break
      }
    },
  })

  panel.addCheckbox({
    id: 'auto-rotate',
    label: '自动旋转',
    type: 'checkbox',
    defaultValue: false,
    onChange: (checked) => { autoRotate = checked },
  })

  panel.addSlider({
    id: 'rotate-speed',
    label: '旋转速度',
    type: 'slider',
    min: 0,
    max: 2,
    step: 0.1,
    defaultValue: 0.3,
    onChange: (value) => { rotateSpeed = value },
  })

  // ========== 动画循环 ==========
  let elapsedTime = 0

  manager.onUpdate((delta) => {
    controls.update()
    elapsedTime += delta

    if (autoRotate) {
      controls.autoRotate = true
      controls.autoRotateSpeed = rotateSpeed
    } else {
      controls.autoRotate = false
    }

    // 弹跳 Logo（电视机屏幕内）
    logoAnim.z += logoAnim.speedZ * delta
    logoAnim.y += logoAnim.speedY * delta

    if (logoAnim.z > logoAnim.limitsZ.max) {
      logoAnim.z = logoAnim.limitsZ.max
      logoAnim.speedZ *= -1
    }
    if (logoAnim.z < logoAnim.limitsZ.min) {
      logoAnim.z = logoAnim.limitsZ.min
      logoAnim.speedZ *= -1
    }
    if (logoAnim.y > logoAnim.limitsY.max) {
      logoAnim.y = logoAnim.limitsY.max
      logoAnim.speedY *= -1
    }
    if (logoAnim.y < logoAnim.limitsY.min) {
      logoAnim.y = logoAnim.limitsY.min
      logoAnim.speedY *= -1
    }

    logoMesh.position.z = logoAnim.z
    logoMesh.position.y = logoAnim.y

    // Google LED 旋转
    googleLedsGltf.scene.children[0].rotation.y += delta * 2

    // Loupedeck 按钮简单动画
    loupedeckGltf.scene.children[0].scale.setScalar(
      1 + Math.sin(elapsedTime * 3) * 0.03,
    )
  })

  manager.start()

  console.log('=== 作业：My Room in 3D ===')
  console.log('烘焙着色器：日/夜/中性三种光照模式')
  console.log('交互元素：弹跳 Logo、屏幕视频、LED 旋转')
  console.log('使用控制面板切换光照模式')
}

init().catch((err: unknown) => {
  console.error('初始化失败：', err)
})