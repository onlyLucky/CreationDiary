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

function createNormalMeshes(count: number, scene: THREE.Scene): THREE.Mesh[] {
  const geo = new THREE.SphereGeometry(0.15, 16, 16)
  const meshes: THREE.Mesh[] = []

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

function createInstancedMeshes(count: number, scene: THREE.Scene): THREE.InstancedMesh {
  const geo = new THREE.SphereGeometry(0.15, 16, 16)
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.5 })
  const instancedMesh = new THREE.InstancedMesh(geo, mat, count)

  const dummy = new THREE.Object3D()
  const color = new THREE.Color()

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

class PerformanceMonitor {
  private element: HTMLDivElement
  private frames = 0
  private lastTime = performance.now()
  private fps = 0

  constructor() {
    this.element = document.createElement('div')
    this.element.style.cssText = 'position:fixed;top:10px;left:10px;color:#0f0;font-family:monospace;font-size:14px;background:rgba(0,0,0,0.7);padding:10px;border-radius:4px;z-index:1000'
    document.body.appendChild(this.element)
  }

  update(renderer: THREE.WebGLRenderer) {
    this.frames++
    const now = performance.now()
    if (now - this.lastTime >= 1000) {
      this.fps = this.frames
      this.frames = 0
      this.lastTime = now
    }

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

  /** 创建物体 */
  const count = 1000
  const normalMeshes = createNormalMeshes(count, manager.scene)
  const instancedMesh = createInstancedMeshes(count, manager.scene)

  /** 默认显示 InstancedMesh */
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
      /** 重新创建 InstancedMesh（数量变化需要重建） */
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
