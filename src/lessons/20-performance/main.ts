/**
 * 第 20 课：性能调优与部署
 *
 * 学习目标：
 * 1. 理解 Draw Call 的概念和优化方法
 * 2. 掌握 InstancedMesh 批量渲染
 * 3. 学会纹理压缩和模型优化
 * 4. 理解 Shader 性能优化策略
 *
 * 本节概览（性能对比演示）：
 * - 左侧：普通 Mesh（每个一个 Draw Call）
 * - 中间：InstancedMesh（一个 Draw Call 渲染所有实例）
 * - 右侧：性能监控面板（FPS / Draw Calls / 内存）
 *
 * 核心思路：
 * - Draw Call = CPU 向 GPU 发送一次渲染指令
 * - 每个 Draw Call 有固定的 CPU 开销（状态切换）
 * - InstancedMesh = 一次 Draw Call 渲染成千上万个相同几何体
 * - 合并几何体、共享材质、LOD 都是优化手段
 *
 * 参考案例：
 * - Three.js Examples — webgl_instancing
 * - Three.js Examples — webgl_instancing_performance
 *
 * 运行方式：
 * - 在浏览器中打开此文件对应的 HTML
 * - 对比两种渲染方式的 Draw Call 数量和 FPS
 */

import * as THREE from 'three'
import { SceneManager } from '@/core/SceneManager'
import { ControlPanel } from '@/core/ControlPanel'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

/* ========== 1. 普通 Mesh 渲染 ========== */

/**
 * 创建普通 Mesh — 性能对比的「反面教材」
 *
 * 每个球体一个 Mesh，共享同一几何体但各自独立的材质实例：
 * - 每个 Mesh 都是一次独立的 Draw Call（CPU 状态切换开销大）
 * - 数量达到数千时，渲染明显变慢
 *
 * @param count - 球体数量
 * @param scene - 目标场景
 */
function createNormalMeshes(count: number, scene: THREE.Scene): THREE.Mesh[] {
  const geo = new THREE.SphereGeometry(0.15, 16, 16)
  const meshes: THREE.Mesh[] = []

  /** 每个球体一个独立材质（按索引映射色相），随机分布在 10×10×10 空间 */
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(i / count, 0.8, 0.5),
      roughness: 0.3,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10,
    )
    scene.add(mesh)
    meshes.push(mesh)
  }

  return meshes
}

/* ========== 2. InstancedMesh 渲染 ========== */

/**
 * 创建 InstancedMesh — 性能对比的「推荐方案」
 *
 * 只创建一个网格对象，用一份 geometry + 一份材质渲染 count 个实例：
 * - 所有实例合并为一次 Draw Call，性能远优于普通 Mesh
 * - 每个实例的变换矩阵和颜色分别通过 setMatrixAt / setColorAt 设置
 *
 * @param count - 实例数量
 * @param scene - 目标场景
 */
function createInstancedMeshes(count: number, scene: THREE.Scene): THREE.InstancedMesh {
  const geo = new THREE.SphereGeometry(0.15, 16, 16)
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.5 })
  const instancedMesh = new THREE.InstancedMesh(geo, mat, count)

  /** dummy 是临时的 Object3D，用于计算每个实例的位置矩阵 */
  const dummy = new THREE.Object3D()
  const color = new THREE.Color()

  /** 为每个实例写入位置矩阵和颜色 */
  for (let i = 0; i < count; i++) {
    dummy.position.set(
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10,
    )
    dummy.updateMatrix()
    instancedMesh.setMatrixAt(i, dummy.matrix)
    instancedMesh.setColorAt(i, color.setHSL(i / count, 0.8, 0.5))
  }

  scene.add(instancedMesh)
  return instancedMesh
}

/* ========== 3. 性能监控 ========== */

/**
 * 性能监控器
 *
 * 在页面左上角显示实时性能数据：
 * - FPS：每秒帧数（统计 1 秒内的帧数）
 * - Draw Calls / Triangles：来自 renderer.info.render
 * - Geometries / Textures：来自 renderer.info.memory
 *
 * 用 renderer.info 可以直观对比「普通 Mesh」与「InstancedMesh」的 Draw Call 差异
 */
class PerformanceMonitor {
  /** 用于显示的 DOM 元素 */
  private element: HTMLDivElement
  /** 上一秒累计的帧数 / 上次结算时间 / 计算出的 FPS */
  private frames = 0
  private lastTime = performance.now()
  private fps = 0

  constructor() {
    this.element = document.createElement('div')
    this.element.style.cssText = 'position:fixed;top:10px;left:10px;color:#0f0;font-family:monospace;font-size:14px;background:rgba(0,0,0,0.7);padding:10px;border-radius:4px;z-index:1000'
    document.body.appendChild(this.element)
  }

  /** 每帧调用：累计帧数，每秒结算一次并刷新显示 */
  update(renderer: THREE.WebGLRenderer) {
    this.frames++
    const now = performance.now()
    /** 距上次结算满 1 秒时，更新 FPS 并清零计数 */
    if (now - this.lastTime >= 1000) {
      this.fps = this.frames
      this.frames = 0
      this.lastTime = now
    }

    /** 从 renderer.info 读取渲染统计信息并刷新到 DOM */
    const info = renderer.info
    this.element.innerHTML = [
      `FPS: ${this.fps}`,
      `Draw Calls: ${info.render.calls}`,
      `Triangles: ${info.render.triangles}`,
      `Geometries: ${info.memory.geometries}`,
      `Textures: ${info.memory.textures}`,
    ].join('<br>')
  }
}

/* ========== 初始化场景 ========== */

/**
 * 初始化场景
 *
 * 场景结构：
 * scene (根节点)
 * ├── ambientLight / directionalLight (灯光)
 * ├── normalMeshes    (普通 Mesh × count，默认隐藏)
 * └── instancedMesh   (InstancedMesh × count，默认显示)
 *
 * 演示方式：
 * - 同一份球体几何体、同样的数量，分别用两种方式渲染
 * - 用控制面板切换渲染模式，观察左上角性能监控的 Draw Calls 差异
 */
function init() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement
  const manager = new SceneManager({ canvas, bgColor: '#111111', fov: 60 })

  manager.camera.position.set(0, 0, 15)

  const controls = new OrbitControls(manager.camera, canvas)
  controls.enableDamping = true

  /** 灯光 */
  manager.scene.add(new THREE.AmbientLight(0xffffff, 0.4))
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0)
  dirLight.position.set(10, 10, 10)
  manager.scene.add(dirLight)

  /** 用同样的数量创建两种渲染方式，方便对比性能 */
  const count = 1000
  const normalMeshes = createNormalMeshes(count, manager.scene)
  const instancedMesh = createInstancedMeshes(count, manager.scene)

  /** 默认显示 InstancedMesh（性能更好），隐藏普通 Mesh */
  normalMeshes.forEach((m) => { m.visible = false })

  const monitor = new PerformanceMonitor()

  /* ========== 控制面板 ========== */
  const panel = new ControlPanel('controls')

  panel.addSelect({
    id: 'render-mode', label: '渲染模式', type: 'select',
    options: [
      { value: 'instanced', label: 'InstancedMesh（推荐）' },
      { value: 'normal', label: '普通 Mesh' },
    ],
    defaultValue: 'instanced',
    onChange: (value: string) => {
      normalMeshes.forEach((m) => { m.visible = value === 'normal' })
      instancedMesh.visible = value === 'instanced'
    },
  })

  let instanceCount = count
  panel.addSlider({ id: 'instance-count', label: '实例数量', type: 'slider', min: 100, max: 50000, step: 100, defaultValue: count,
    onChange: (v: number) => {
      instanceCount = Math.round(v)
      /** 实例数量变化后需要重建 InstancedMesh：先移除并 dispose 旧对象，再创建新的 */
      manager.scene.remove(instancedMesh)
      instancedMesh.dispose()
      const newInstanced = createInstancedMeshes(instanceCount, manager.scene)
      manager.scene.add(newInstanced)
    },
  })

  /* ========== 动画循环 ========== */
  const clock = new THREE.Clock()

  function animate() {
    requestAnimationFrame(animate)
    const t = clock.getElapsedTime()

    /** 缓慢旋转整个场景 */
    manager.scene.rotation.y = t * 0.05

    controls.update()
    manager.renderer.render(manager.scene, manager.camera)
    monitor.update(manager.renderer)
  }
  animate()
}

init()
