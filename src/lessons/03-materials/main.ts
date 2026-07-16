/**
 * 第 3 课：材质系统
 *
 * 学习目标：
 * 1. 区分 6 种材质类型（Basic/Lambert/Phong/Standard/Physical/Toon）
 * 2. 理解 PBR 材质的 roughness 和 metalness
 * 3. 掌握环境贴图实现反射效果
 * 4. 理解法线贴图的原理
 */

import * as THREE from 'three'
import { SceneManager } from '@/core/SceneManager'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// 导入纹理文件（Vite 会处理路径和打包）
import rustMetalUrl from '@/assets/texture/rust-metal.jpg'
import woodFloorUrl from '@/assets/texture/wood-floor.jpg'

/**
 * 创建棋盘格纹理（程序生成，复用第 2 课）
 *
 * 用 Canvas 2D 绘制黑白交替的方格图案，然后转为 Three.js 纹理。
 * 常用于地面，能直观展示 UV 映射和纹理重复效果。
 *
 * @param size    — Canvas 的像素尺寸（正方形），默认 256
 * @param squares — 每行/列的方格数量，默认 8（即 8×8 = 64 个格子）
 * @returns       — 可直接用于 Material.map 的 CanvasTexture
 */
function createCheckerTexture(size = 256, squares = 8): THREE.CanvasTexture {
  // 创建离屏 Canvas，不会显示在页面上，仅用于生成纹理像素数据
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // 每个方格的像素尺寸，例如 256 / 8 = 32px
  const squareSize = size / squares

  // 双重循环遍历每个格子，用 (i+j) 的奇偶性决定黑白
  for (let i = 0; i < squares; i++) {
    for (let j = 0; j < squares; j++) {
      ctx.fillStyle = (i + j) % 2 === 0 ? '#ffffff' : '#333333'
      ctx.fillRect(i * squareSize, j * squareSize, squareSize, squareSize)
    }
  }

  // 将 Canvas 包装为 Three.js 纹理
  const texture = new THREE.CanvasTexture(canvas)

  // 设置 S/T 轴（即 U/V 轴）的包裹模式为 RepeatWrapping
  // 这样当纹理坐标超出 [0,1] 范围时，纹理会平铺重复
  // 而不是拉伸边缘像素（默认的 ClampToEdgeWrapping）
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping

  return texture
}

/**
 * 创建法线贴图（程序生成，模拟凹凸砖块）
 *
 * 法线贴图的每个像素存储的是表面法线方向，而非颜色：
 *   R = 法线 X 分量（左右倾斜）
 *   G = 法线 Y 分量（前后倾斜）
 *   B = 法线 Z 分量（朝上/朝外）
 *
 * 标准"朝上"的法线颜色是 RGB(128, 128, 255)，即蓝紫色。
 * 偏离这个颜色 = 法线倾斜 = 视觉上产生凹凸感（但几何体本身不变）。
 *
 * @param size — Canvas 的像素尺寸（正方形），默认 256
 * @returns    — 可直接用于 Material.normalMap 的 CanvasTexture
 */
function createNormalMap(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // 基础色：RGB(128, 128, 255) 表示法线完全朝上（无倾斜）
  // 这是法线贴图的"平坦"基准色
  ctx.fillStyle = 'rgb(128, 128, 255)'
  ctx.fillRect(0, 0, size, size)

  // 砖块边缘：RGB(100, 100, 200) 偏离基准色
  // R/G/B 都变小 → 法线向边缘倾斜 → 光照时边缘产生阴影 → 看起来像凹槽
  ctx.strokeStyle = 'rgb(100, 100, 200)'
  ctx.lineWidth = 4

  // 砖块布局：4 行 × 2 列，每块大小为 size/2 × size/4
  const brickH = size / 4
  const brickW = size / 2
  for (let row = 0; row < 4; row++) {
    const y = row * brickH
    // 画两块砖的完整边框（实际效果：中间有竖缝分隔）
    ctx.strokeRect(0, y, brickW, brickH)
    ctx.strokeRect(brickW, y, brickW, brickH)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

/** 创建简单的立方体环境贴图（程序生成） */
function createEnvMap(): THREE.CubeTexture {
  const size = 64
  const faces: HTMLCanvasElement[] = []

  const colors = [
    '#ff6b6b', // +X 红
    '#4488ff', // -X 蓝
    '#51cf66', // +Y 绿
    '#ffd43b', // -Y 黄
    '#cc5de8', // +Z 紫
    '#ff922b', // -Z 橙
  ]

  for (let i = 0; i < 6; i++) {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!

    // 渐变背景
    const gradient = ctx.createLinearGradient(0, 0, size, size)
    gradient.addColorStop(0, '#1a1a2e')
    gradient.addColorStop(1, colors[i])
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)

    faces.push(canvas)
  }

  const cubeTexture = new THREE.CubeTexture(faces)
  cubeTexture.needsUpdate = true
  return cubeTexture
}

/** 初始化场景 */
function init() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement

  const manager = new SceneManager({
    canvas,
    bgColor: '#0a0a1a',
    fov: 50,
  })

  // 相机位置
  manager.camera.position.set(0, 2, 12)
  manager.camera.lookAt(0, 0, 0)

  // 添加 OrbitControls（鼠标拖拽旋转视角）
  const controls = new OrbitControls(manager.camera, canvas)
  controls.enableDamping = true // 平滑阻尼
  controls.dampingFactor = 0.05
  controls.target.set(0, 0, 0)

  // 添加灯光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
  manager.scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0)
  directionalLight.position.set(5, 8, 5)
  directionalLight.castShadow = true
  manager.scene.add(directionalLight)

  // 点光源（模拟台灯）
  const pointLight = new THREE.PointLight(0xff922b, 2, 20)
  pointLight.position.set(-3, 4, 2)
  manager.scene.add(pointLight)

  // 创建纹理
  const checkerTexture = createCheckerTexture()
  const normalMap = createNormalMap()
  const envMap = createEnvMap()

  // ========== 1. 六种材质对比 ==========
  // 同一个球体，不同材质，排成一排
  const sphereGeo = new THREE.SphereGeometry(0.8, 32, 16)

  // 1a. MeshBasicMaterial — 不受光照
  const basicMat = new THREE.MeshBasicMaterial({
    color: 0x4488ff, // 蓝色
    wireframe: false,
  })
  const basicSphere = new THREE.Mesh(sphereGeo, basicMat)
  basicSphere.position.set(-5, 2, 0)
  manager.scene.add(basicSphere)
  manager.registerDisposable(basicMat)

  // 1b. MeshLambertMaterial — Lambert 漫反射（无高光）
  const lambertMat = new THREE.MeshLambertMaterial({
    color: 0x4488ff, // 蓝色
  })
  const lambertSphere = new THREE.Mesh(sphereGeo, lambertMat)
  lambertSphere.position.set(-2.5, 2, 0)
  manager.scene.add(lambertSphere)
  manager.registerDisposable(lambertMat)

  // 1c. MeshPhongMaterial — Phong 高光
  const phongMat = new THREE.MeshPhongMaterial({
    color: 0x4488ff,  // 蓝色
    shininess: 100,   // 高光锐度（越大越集中）
    specular: 0x111111, // 高光颜色
  })
  const phongSphere = new THREE.Mesh(sphereGeo, phongMat)
  phongSphere.position.set(0, 2, 0)
  manager.scene.add(phongSphere)
  manager.registerDisposable(phongMat)

  // 1d. MeshStandardMaterial — PBR 物理渲染
  const standardMat = new THREE.MeshStandardMaterial({
    color: 0x4488ff, // 蓝色
    roughness: 0.5,  // 中等粗糙
    metalness: 0,    // 非金属
    envMap,          // 环境贴图
    envMapIntensity: 0.5, // 环境贴图强度
  })
  const standardSphere = new THREE.Mesh(sphereGeo, standardMat)
  standardSphere.position.set(2.5, 2, 0)
  manager.scene.add(standardSphere)
  manager.registerDisposable(standardMat)

  // 1e. MeshPhysicalMaterial — PBR 扩展（清漆效果）
  const physicalMat = new THREE.MeshPhysicalMaterial({
    color: 0x4488ff, // 蓝色
    roughness: 0.1,  // 光滑
    metalness: 0,    // 非金属
    clearcoat: 1.0,      // 清漆层强度（汽车漆效果）
    clearcoatRoughness: 0.1, // 清漆层粗糙度
    envMap,
    envMapIntensity: 0.8,
  })
  const physicalSphere = new THREE.Mesh(sphereGeo, physicalMat)
  physicalSphere.position.set(5, 2, 0)
  manager.scene.add(physicalSphere)
  manager.registerDisposable(physicalMat)

  // 1f. MeshToonMaterial — 卡通着色
  const toonMat = new THREE.MeshToonMaterial({
    color: 0x4488ff, // 蓝色
  })
  const toonSphere = new THREE.Mesh(sphereGeo, toonMat)
  toonSphere.position.set(0, 4.5, 0) // 放在顶部中间
  manager.scene.add(toonSphere)
  manager.registerDisposable(toonMat)

  // ========== 2. 粗糙度 × 金属感网格 ==========
  // 3×3 网格：roughness (0.1, 0.5, 0.9) × metalness (0, 0.5, 1)
  const gridGeo = new THREE.SphereGeometry(0.6, 32, 16)
  const roughnessValues = [0.1, 0.5, 0.9]
  const metalnessValues = [0, 0.5, 1]

  for (let r = 0; r < 3; r++) {
    for (let m = 0; m < 3; m++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff, // 白色，方便观察 roughness/metalness 效果
        roughness: roughnessValues[r],
        metalness: metalnessValues[m],
        envMap,
        envMapIntensity: 1.0,
      })
      const sphere = new THREE.Mesh(gridGeo, mat)
      sphere.position.set(
        -2 + m * 2,  // X: metalness 0/0.5/1
        -1 - r * 1.5, // Y: roughness 0.1/0.5/0.9
        0
      )
      manager.scene.add(sphere)
      manager.registerDisposable(mat)
    }
  }

  // ========== 3. 纹理贴图展示 ==========
  // 棋盘格纹理 + 法线贴图
  const texturedGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5)

  // 3a. 颜色纹理
  const texturedMat = new THREE.MeshStandardMaterial({
    map: checkerTexture,   // 棋盘格颜色纹理
    roughness: 0.7,
    metalness: 0,
  })
  const texturedBox = new THREE.Mesh(texturedGeo, texturedMat)
  texturedBox.position.set(-4, -1, 0)
  manager.scene.add(texturedBox)
  manager.registerDisposable(texturedMat)

  // 3b. 法线贴图
  const normalMat = new THREE.MeshStandardMaterial({
    color: 0x888888,  // 灰色基底
    normalMap,         // 法线贴图
    normalScale: new THREE.Vector2(2, 2), // 法线强度
    roughness: 0.8,
    metalness: 0,
  })
  const normalBox = new THREE.Mesh(texturedGeo, normalMat)
  normalBox.position.set(-4, -3, 0)
  manager.scene.add(normalBox)
  manager.registerDisposable(normalMat)

  // ========== 4. 外部纹理加载示例 ==========
  // 使用 TextureLoader 加载外部纹理文件
  const textureLoader = new THREE.TextureLoader()

  // 4a. 加载金属锈蚀纹理
  textureLoader.load(
    rustMetalUrl,
    (texture) => {
      // 纹理加载成功
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(2, 2)

      const rustMat = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.8,
        metalness: 0.2,
      })
      const rustSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.8, 32, 16),
        rustMat
      )
      rustSphere.position.set(4, -1, 0)
      manager.scene.add(rustSphere)
      manager.registerDisposable(rustMat)

      // 添加标签
      const rustLabel = createLabel('Rust Metal', new THREE.Vector3(4, -2.2, 0))
      manager.scene.add(rustLabel)
    },
    undefined,
    (error) => {
      console.warn('加载 rust-metal.jpg 失败:', error)
    }
  )

  // 4b. 加载木地板纹理
  textureLoader.load(
    woodFloorUrl,
    (texture) => {
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(3, 3)

      const woodMat = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.6,
        metalness: 0,
      })
      const woodBox = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 1.5, 1.5),
        woodMat
      )
      woodBox.position.set(4, -3, 0)
      manager.scene.add(woodBox)
      manager.registerDisposable(woodMat)

      const woodLabel = createLabel('Wood Floor', new THREE.Vector3(4, -4.2, 0))
      manager.scene.add(woodLabel)
    },
    undefined,
    (error) => {
      console.warn('加载 wood-floor.jpg 失败:', error)
    }
  )

  // ========== 地面 ==========
  const groundGeo = new THREE.PlaneGeometry(20, 20)
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x222233,
    roughness: 0.9,
    metalness: 0,
  })
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -5
  manager.scene.add(ground)
  manager.registerDisposable(groundGeo)
  manager.registerDisposable(groundMat)

  // ========== 标签（Sprite 文字） ==========
  function createLabel(text: string, position: THREE.Vector3): THREE.Sprite {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 28px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(text, 128, 40)

    const texture = new THREE.CanvasTexture(canvas)
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    })
    const sprite = new THREE.Sprite(material)
    sprite.position.copy(position)
    sprite.scale.set(2, 0.5, 1)
    return sprite
  }

  // 六种材质标签
  const labels = [
    { text: 'Basic', pos: new THREE.Vector3(-5, 0.8, 0) },
    { text: 'Lambert', pos: new THREE.Vector3(-2.5, 0.8, 0) },
    { text: 'Phong', pos: new THREE.Vector3(0, 0.8, 0) },
    { text: 'Standard', pos: new THREE.Vector3(2.5, 0.8, 0) },
    { text: 'Physical', pos: new THREE.Vector3(5, 0.8, 0) },
    { text: 'Toon', pos: new THREE.Vector3(0, 3.3, 0) },
  ]
  labels.forEach(({ text, pos }) => {
    const label = createLabel(text, pos)
    manager.scene.add(label)
  })

  // roughness × metalness 标签
  const gridLabel = createLabel(
    'roughness × metalness',
    new THREE.Vector3(0, 0.2, 0)
  )
  manager.scene.add(gridLabel)

  // 纹理标签
  const texLabel1 = createLabel('Color Map', new THREE.Vector3(-4, 0.2, 0))
  manager.scene.add(texLabel1)
  const texLabel2 = createLabel('Normal Map', new THREE.Vector3(-4, -1.8, 0))
  manager.scene.add(texLabel2)

  // ========== 动画循环 ==========
  manager.onUpdate((delta) => {
    // 所有球体缓慢旋转
    const spheres = [
      basicSphere, lambertSphere, phongSphere,
      standardSphere, physicalSphere, toonSphere,
    ]
    spheres.forEach((s) => {
      s.rotation.y += 0.3 * delta
    })

    // 纹理方块旋转
    texturedBox.rotation.y += 0.5 * delta
    texturedBox.rotation.x += 0.3 * delta
    normalBox.rotation.y += 0.5 * delta
    normalBox.rotation.x += 0.3 * delta

    // 更新 OrbitControls
    controls.update()
  })

  manager.start()

  // 控制台提示
  console.log('=== 第 3 课：材质系统 ===')
  console.log('观察要点：')
  console.log('  - 6 种材质：Basic/Lambert/Phong/Standard/Physical/Toon')
  console.log('  - roughness × metalness 网格：9 种组合对比')
  console.log('  - 棋盘格纹理 vs 法线贴图')
  console.log('  - 鼠标拖拽旋转视角（OrbitControls）')
  console.log('')
  console.log('尝试修改：')
  console.log('  - 调整 sphereMat.roughness (0~1)，观察表面光滑度变化')
  console.log('  - 调整 sphereMat.metalness (0~1)，观察金属感变化')
  console.log('  - 把 BasicMaterial 的 wireframe 改成 true，观察效果')
  console.log('  - 调整 PhysicalMaterial 的 clearcoat (0~1)，观察清漆效果')
}

init()
