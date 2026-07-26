/**
 * 第 7 课课后作业：积木小动物拼装展示
 *
 * 左侧：OBJ 加载的 Storky 模型（对照组）
 * 右侧：用基本几何体拼装的 Storky 模型（实验组）
 *
 * 评分项：
 * - 父子关系实现（30分）
 * - 变换继承（25分）
 * - 视觉完成度（15分）
 * - 交互体验（15分）
 */

import * as THREE from 'three'
import { SceneManager } from '@/core/SceneManager'
import { ControlPanel } from '@/core/ControlPanel'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'

// 部件颜色
const COLORS = {
  body: 0x4b77f8,    // 蓝色主体
  neck: 0x12a77a,    // 绿色颈部
  head: 0xf5954a,    // 橙色头部
  beak: 0xf45b41,    // 红色喙
  leg: 0xf8b45d,     // 黄色腿
  wing: 0xf06292,    // 粉色翅膀
}

// ========== 分散/组合动画工具 ==========

/** 单个模块的分散动画状态 */
interface DispersionModule {
  object: THREE.Object3D
  homePosition: THREE.Vector3
  homeRotation: THREE.Euler
  awayPosition: THREE.Vector3
  awayRotation: THREE.Euler
}

/** 伪随机数，保证每次分散位置一致 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

/** 计算 Group 内所有对象的包围盒中心 */
function computeGroupCenter(group: THREE.Group): THREE.Vector3 {
  const box = new THREE.Box3().setFromObject(group)
  return box.getCenter(new THREE.Vector3())
}

/**
 * 为一组对象创建分散/组合的动画数据
 * @param modules     输出的模块数组
 * @param group       包含模块的 Group
 * @param center      组装状态时的模型中心
 * @param strength    分散强度
 * @param seedOffset  随机种子偏移
 */
function buildDispersionModules(
  modules: DispersionModule[],
  group: THREE.Group,
  center: THREE.Vector3,
  strength: number,
  seedOffset: number,
): void {
  modules.length = 0
  group.children.forEach((child, index) => {
    const homePosition = child.position.clone()
    const homeRotation = child.rotation.clone()

    const dir = homePosition.clone().sub(center)
    if (dir.lengthSq() < 0.001) {
      dir.set(
        seededRandom(seedOffset + index) - 0.5,
        seededRandom(seedOffset + index + 100) - 0.5,
        seededRandom(seedOffset + index + 200) - 0.5,
      )
    }
    dir.normalize()

    const distance = strength * (0.8 + seededRandom(seedOffset + index + 300) * 0.4)
    const awayPosition = homePosition.clone().add(dir.multiplyScalar(distance))
    awayPosition.y += (seededRandom(seedOffset + index + 400) - 0.5) * strength * 0.3

    const awayRotation = new THREE.Euler(
      homeRotation.x + (seededRandom(seedOffset + index + 500) - 0.5) * Math.PI,
      homeRotation.y + (seededRandom(seedOffset + index + 600) - 0.5) * Math.PI,
      homeRotation.z + (seededRandom(seedOffset + index + 700) - 0.5) * Math.PI,
    )

    modules.push({
      object: child,
      homePosition,
      homeRotation,
      awayPosition,
      awayRotation,
    })
  })
}

/** 根据进度将模块在组合态与分散态之间插值 */
function applyDispersion(modules: DispersionModule[], progress: number): void {
  modules.forEach((m) => {
    m.object.position.lerpVectors(m.homePosition, m.awayPosition, progress)
    m.object.rotation.x = THREE.MathUtils.lerp(m.homeRotation.x, m.awayRotation.x, progress)
    m.object.rotation.y = THREE.MathUtils.lerp(m.homeRotation.y, m.awayRotation.y, progress)
    m.object.rotation.z = THREE.MathUtils.lerp(m.homeRotation.z, m.awayRotation.z, progress)
  })
}

// ========== 几何体工厂函数 ==========

/** 共享材质缓存 */
const materialCache = new Map<number, THREE.MeshStandardMaterial>()
function getMaterial(color: number): THREE.MeshStandardMaterial {
  if (!materialCache.has(color)) {
    materialCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.1 }))
  }
  return materialCache.get(color)!
}

/**
 * 创建长方体
 * @param width  宽（X 轴）
 * @param height 高（Y 轴）
 * @param depth  深（Z 轴）
 * @param color  颜色
 */
function createBox(width: number, height: number, depth: number, color: number): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(width, height, depth)
  const mesh = new THREE.Mesh(geometry, getMaterial(color))
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/**
 * 创建圆拱扇形（圆环的一段）
 * @param outerRadius 外圆半径
 * @param innerRadius 内圆半径
 * @param height      高度（厚度）
 * @param color       颜色
 * @param thetaLength 扇形张角（默认半圆 Math.PI）
 * @param segments    圆弧分段数（默认 48）
 */
function createArch(
  outerRadius: number,
  innerRadius: number,
  height: number,
  color: number,
  thetaLength: number = Math.PI,
  segments: number = 48,
): THREE.Mesh {
  // 用 Shape 画扇形截面，再 Extrude 拉伸
  const shape = new THREE.Shape()
  shape.absarc(0, 0, outerRadius, 0, thetaLength, false)
  shape.absarc(0, 0, innerRadius, thetaLength, 0, true)
  shape.closePath()

  const extrudeSettings = {
    depth: height,
    bevelEnabled: false,
    curveSegments: segments,
  }
  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
  geometry.center()

  const mesh = new THREE.Mesh(geometry, getMaterial(color))
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}


function init() {
  const canvas = document.getElementById('homework_canvas') as HTMLCanvasElement

  const manager = new SceneManager({
    canvas,
    bgColor: '#000000',
    fov: 45,
  })

  manager.camera.position.set(0, 3, 10)
  manager.camera.lookAt(0, 1.5, 0)

  // OrbitControls
  const controls = new OrbitControls(manager.camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.target.set(0, 1.5, 0)

  // ========== 灯光 ==========
  const keyLight = new THREE.DirectionalLight(0xffffff, 10)
  keyLight.position.set(5, 10, 5)
  keyLight.castShadow = true
  manager.scene.add(keyLight)

  const fillLight = new THREE.DirectionalLight(0xffffff, 5)
  fillLight.position.set(-5, 3, -3)
  manager.scene.add(fillLight)

  const backLight = new THREE.DirectionalLight(0xffffff, 5)
  backLight.position.set(0, 2, -8)
  manager.scene.add(backLight)

  manager.scene.add(new THREE.AmbientLight(0x444444))

  // ========== 坐标轴 + 网格 ==========
  const axesHelper = new THREE.AxesHelper(5)
  manager.scene.add(axesHelper)

  function createAxisLabel(text: string, position: THREE.Vector3, color: string): THREE.Sprite {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 64
    const ctx = c.getContext('2d')!
    ctx.fillStyle = color
    ctx.font = 'bold 48px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 32, 32)
    const texture = new THREE.CanvasTexture(c)
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }))
    sprite.position.copy(position)
    sprite.scale.set(0.8, 0.8, 1)
    return sprite
  }

  const xLabel = createAxisLabel('X', new THREE.Vector3(5.5, 0, 0), '#ff0000')
  const yLabel = createAxisLabel('Y', new THREE.Vector3(0, 5.5, 0), '#00ff00')
  const zLabel = createAxisLabel('Z', new THREE.Vector3(0, 0, 5.5), '#0000ff')
  manager.scene.add(xLabel)
  manager.scene.add(yLabel)
  manager.scene.add(zLabel)

  const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x333333)
  gridHelper.visible = false
  manager.scene.add(gridHelper)

  // ========== 场景图结构 ==========
  // root
  // ├── objGroup (左侧 OBJ 模型)
  // └── primitiveGroup (右侧基本几何体模型)

  const root = new THREE.Group()
  manager.scene.add(root)

  // ========== 左侧：加载 OBJ 模型 ==========
  const objGroup = new THREE.Group()
  objGroup.position.x = -3
  root.add(objGroup)

  const objModules: DispersionModule[] = []
  const loader = new OBJLoader()
  loader.load(
    '/models/baukasten/storky.obj',
    (obj) => {
      // 计算包围盒并缩放
      const box = new THREE.Box3().setFromObject(obj)
      const size = box.getSize(new THREE.Vector3())
      const center = box.getCenter(new THREE.Vector3())
      const targetHeight = 4
      const scale = targetHeight / size.y

      // 按部件名称分配颜色（与右侧基本几何体颜色对应）
      const partColors: Record<string, number> = {
        'Part_1_Storky': COLORS.body,
        'Part_2_Storky': COLORS.body,
        'Part_3_Storky': COLORS.leg,
        'Part_4_Storky': COLORS.leg,
        'Part_5_Storky': COLORS.body,
        'Part_6_Storky': COLORS.body,
        'Part_7_Storky': COLORS.body,
        'Part_8_Storky': COLORS.body,
        'Part_9_Storky': COLORS.body,
        'Part_10_Storky': COLORS.body,
        'Part_11_Storky': COLORS.body,
        'Part_12_Storky': COLORS.neck,
        'Part_13_Storky': COLORS.neck,
        'Part_14_Storky': COLORS.head,
        'Part_15_Storky': COLORS.head,
        'Part_16_Storky': COLORS.wing,
        'Part_17_Storky': COLORS.head,
        'Part_18_Storky': COLORS.head,
        'Part_19_Storky': COLORS.head,
        'Part_20_Storky': COLORS.beak,
      }

      // 将 OBJ 中的每个 Mesh 作为独立模块拆出，方便后续做分散/组合动画
      const partMeshes: THREE.Mesh[] = []
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          partMeshes.push(child)
        }
      })

      partMeshes.forEach((mesh) => {
        const color = partColors[mesh.name] ?? 0xcccccc
        mesh.material = new THREE.MeshStandardMaterial({
          color,
          roughness: 0.35,
          metalness: 0.1,
        })
        mesh.castShadow = true
        mesh.receiveShadow = true

        // 把几何体中心移到局部原点，再把 mesh 摆回正确的组装位置
        mesh.geometry.computeBoundingBox()
        const geoCenter = mesh.geometry.boundingBox!.getCenter(new THREE.Vector3())
        mesh.geometry.translate(-geoCenter.x, -geoCenter.y, -geoCenter.z)

        mesh.scale.setScalar(scale)
        mesh.position.set(
          (geoCenter.x - center.x) * scale,
          (geoCenter.y - box.min.y) * scale,
          (geoCenter.z - center.z) * scale,
        )

        objGroup.add(mesh)
      })

      // 构建分散动画数据
      const objCenter = computeGroupCenter(objGroup)
      buildDispersionModules(objModules, objGroup, objCenter, 3, 0)

      console.log('[OBJ] 加载完成，模块数:', objModules.length)
    },
    undefined,
    (error) => console.error('[OBJ] 加载失败:', error),
  )

  // OBJ 标签
  const objLabel = createTextLabel('OBJ 模型', '#ffffff')
  objLabel.position.set(-3, -0.5, 0)
  root.add(objLabel)

  // ========== 右侧：基本几何体拼装 ==========
  const primitiveGroup = new THREE.Group()
  primitiveGroup.position.x = 3
  root.add(primitiveGroup)

  // 使用 createBox / createArch 工厂函数拼装 Storky
  const DEPTH = 0.25

  /* ---- 底部bottom ---- */
  const storky_c_01 = createBox(0.2, 0.42, DEPTH, COLORS.leg)
  storky_c_01.position.set(0, 0.21, -0.01)
  primitiveGroup.add(storky_c_01)

  const storky_c_02 = createBox(0.2, 0.84, DEPTH, COLORS.neck)
  storky_c_02.position.set(0, 0.84, -0.01)
  primitiveGroup.add(storky_c_02)

  const storky_b_l01 = createArch(0.85, 0.65, DEPTH, COLORS.wing, Math.PI/2)
  storky_b_l01.rotation.z = -Math.PI
  storky_b_l01.position.set(-0.53, 0.42, -0.01)
  primitiveGroup.add(storky_b_l01)

  const storky_b_l02 = createArch(0.65, 0.45, DEPTH, COLORS.head, Math.PI/2)
  storky_b_l02.rotation.z = -Math.PI
  storky_b_l02.position.set(-0.43, 0.52, -0.01)
  primitiveGroup.add(storky_b_l02)

  const storky_b_r01 = createArch(0.85, 0.65, DEPTH, COLORS.wing, Math.PI/2)
  storky_b_r01.rotation.z = -Math.PI/2
  storky_b_r01.position.set(0.53, 0.42, -0.01)
  primitiveGroup.add(storky_b_r01)

  const storky_b_r02 = createArch(0.65, 0.45, DEPTH, COLORS.head, Math.PI/2)
  storky_b_r02.rotation.z = -Math.PI/2
  storky_b_r02.position.set(0.43, 0.52, -0.01)
  primitiveGroup.add(storky_b_r02)


  const storky_body_l01 = createArch(0.41, 0.21 , DEPTH, COLORS.head, Math.PI/2)
  storky_body_l01.rotation.z = 0
  storky_body_l01.position.set(-0.11, 1.47, -0.01)
  primitiveGroup.add(storky_body_l01)

  const storky_body_l02 = createBox(0.2, 0.41, DEPTH, COLORS.neck)
  storky_body_l02.position.set(-0.416, 1.472, -0.01)
  primitiveGroup.add(storky_body_l02)

  const storky_body_l03 = createArch(0.41, 0.21 , DEPTH, COLORS.head, Math.PI/2)
  storky_body_l03.rotation.z = Math.PI/2
  storky_body_l03.position.set(-0.11, 1.882, -0.01)
  primitiveGroup.add(storky_body_l03)

  const storky_body_l04 = createArch(0.61, 0.41 , DEPTH, COLORS.beak, Math.PI/2)
  storky_body_l04.rotation.z = Math.PI/2
  storky_body_l04.position.set(-0.212, 1.986, -0.01)
  primitiveGroup.add(storky_body_l04)

  const storky_body_l05 = createArch(0.81, 0.61 , DEPTH, COLORS.leg, Math.PI/2)
  storky_body_l05.rotation.z = Math.PI/2
  storky_body_l05.position.set(-0.312, 2.086, -0.01)
  primitiveGroup.add(storky_body_l05)



  const storky_body_r01 = createArch(0.41, 0.21 , DEPTH, COLORS.head, Math.PI/2)
  storky_body_r01.rotation.z = 0
  storky_body_r01.position.set(0.302, 1.26, -0.01)
  primitiveGroup.add(storky_body_r01)

  const storky_body_r02 = createArch(0.41, 0.21 , DEPTH, COLORS.head, Math.PI/2)
  storky_body_r02.rotation.z = -Math.PI/2
  storky_body_r02.position.set(0.302, 1.672, -0.01)
  primitiveGroup.add(storky_body_r02)

  const storky_body_r03 = createArch(0.41, 0.21 , DEPTH, COLORS.neck, Math.PI/2)
  storky_body_r03.rotation.z = 0
  storky_body_r03.position.set(0.302, 2.086, -0.01)
  primitiveGroup.add(storky_body_r03)

  const storky_body_r04 = new THREE.Group()
  storky_body_r04.position.set(0.54, 2.156, -0.01)
  const storky_neck_01 = createArch(0.91, 0.71 , DEPTH, COLORS.wing, Math.PI/5)
  storky_neck_01.rotation.z = 0
  storky_neck_01.position.set(0, 0, 0.08)
  storky_body_r04.add(storky_neck_01)

  const storky_neck_02 = createArch(0.91, 0.71 , DEPTH, COLORS.wing, Math.PI/5)
  storky_neck_02.rotation.z = Math.PI
  storky_neck_02.position.set(-0.16, 0.4, 0.08)
  storky_body_r04.add(storky_neck_02)

  primitiveGroup.add(storky_body_r04)

  // header
  const storky_header_0 = createBox(0.2, 0.774, DEPTH, COLORS.body)
  storky_header_0.position.set(0.316, 3.21, 0.07)
  primitiveGroup.add(storky_header_0)

  const storky_header_01 = createArch(0.41, 0.21 , DEPTH, COLORS.neck, Math.PI/2)
  storky_header_01.rotation.z = Math.PI/2
  storky_header_01.position.set(0.42, 3.8, 0.07)
  primitiveGroup.add(storky_header_01)

  const storky_header_02 = createArch(0.41, 0.21 , DEPTH, COLORS.body, Math.PI/2)
  storky_header_02.rotation.z = 0
  storky_header_02.position.set(0.83, 3.8, 0.07)
  primitiveGroup.add(storky_header_02)

  const storky_header_03 = createArch(0.41, 0.21 , DEPTH, COLORS.head, Math.PI/2)
  storky_header_03.rotation.z = -Math.PI/2
  storky_header_03.position.set(0.83, 3.39, 0.07)
  primitiveGroup.add(storky_header_03)

  const storky_header_4 = createBox(0.774, 0.2, DEPTH, COLORS.wing)
  storky_header_4.position.set(1.38, 3.69, 0.068)
  primitiveGroup.add(storky_header_4)

  // 为基本几何体拼装模型构建分散动画数据
  const primModules: DispersionModule[] = []
  const primCenter = computeGroupCenter(primitiveGroup)
  buildDispersionModules(primModules, primitiveGroup, primCenter, 3, 1000)

  // 基本几何体标签
  const primLabel = createTextLabel('基本几何体', '#ffffff')
  primLabel.position.set(3, -0.5, 0)
  root.add(primLabel)

  // ========== 创建文字标签 ==========
  function createTextLabel(text: string, color: string): THREE.Sprite {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 64
    const ctx = c.getContext('2d')!
    ctx.fillStyle = color
    ctx.font = 'bold 36px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 128, 32)
    const texture = new THREE.CanvasTexture(c)
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }))
    sprite.scale.set(2, 0.5, 1)
    return sprite
  }

  // ========== 控制面板 ==========
  const panel = new ControlPanel()
  let autoRotate = false
  let rotateSpeed = 0.3

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

  panel.addCheckbox({
    id: 'auto-rotate',
    label: '自动旋转',
    type: 'checkbox',
    defaultValue: false,
    onChange: (checked) => { autoRotate = checked },
  })

  panel.addCheckbox({
    id: 'show-axes',
    label: '显示坐标轴',
    type: 'checkbox',
    defaultValue: true,
    onChange: (checked) => {
      axesHelper.visible = checked
      xLabel.visible = checked
      yLabel.visible = checked
      zLabel.visible = checked
    },
  })

  panel.addCheckbox({
    id: 'show-grid',
    label: '显示网格',
    type: 'checkbox',
    defaultValue: false,
    onChange: (checked) => {
      gridHelper.visible = checked
    },
  })

  // 分散/组合控制
  let dispersionProgress = 0
  let autoDemo = false
  let demoDirection = 1
  const demoSpeed = 0.4

  panel.addSlider({
    id: 'dispersion',
    label: '分散进度',
    type: 'slider',
    min: 0,
    max: 1,
    step: 0.01,
    defaultValue: 0,
    onChange: (value) => { dispersionProgress = value },
  })

  panel.addCheckbox({
    id: 'auto-demo',
    label: '自动演示分散/组合',
    type: 'checkbox',
    defaultValue: false,
    onChange: (checked) => { autoDemo = checked },
  })

  // ========== 动画循环 ==========
  manager.onUpdate((delta) => {
    controls.update()

    // 变换继承：旋转 root，两个模型一起转
    if (autoRotate) {
      root.rotation.y += rotateSpeed * delta
    }

    // 自动演示：分散 -> 组合 -> 分散 循环
    if (autoDemo) {
      dispersionProgress += demoDirection * demoSpeed * delta
      dispersionProgress = Math.round(dispersionProgress * 100) / 100
      if (dispersionProgress >= 1) {
        dispersionProgress = 1
        demoDirection = -1
      } else if (dispersionProgress <= 0) {
        dispersionProgress = 0
        demoDirection = 1
      }
      panel.setValue('dispersion', dispersionProgress)
    }

    // 对两侧模型应用分散/组合插值
    applyDispersion(objModules, dispersionProgress)
    applyDispersion(primModules, dispersionProgress)
  })

  manager.start()

  console.log('=== 作业：Baukasten 模型对比 ===')
  console.log('左侧：OBJ 加载模型')
  console.log('右侧：基本几何体拼装')
}

init()
