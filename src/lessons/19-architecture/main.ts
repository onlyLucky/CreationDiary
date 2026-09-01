/**
 * 第 19 课：网站架构设计
 *
 * 学习目标：
 * 1. 理解多场景管理架构
 * 2. 掌握场景切换过渡动画
 * 3. 学会 Loading 策略（预加载 vs 按需加载）
 * 4. 理解状态管理与 3D 场景的集成
 *
 * 本节概览：
 * - 三个可切换的 3D 场景（几何体、粒子、Shader）
 * - 场景间有淡入淡出过渡
 * - Loading 界面预加载资源
 * - 导航菜单切换场景
 *
 * 核心思路：
 * - 每个场景是独立的 THREE.Scene + 独立的 update 函数
 * - 切换时：旧场景淡出 → 移除 → 新场景添加 → 淡入
 * - 资源管理：dispose 几何体/材质/纹理防止内存泄漏
 *
 * 参考案例：
 * - Three.js Examples — webgl_multiple_scenes
 * - Awwwards 获奖网站的场景切换
 *
 * 运行方式：
 * - 在浏览器中打开此文件对应的 HTML
 * - 使用导航菜单切换场景
 */

import * as THREE from 'three'
import { ControlPanel } from '@/core/ControlPanel'

/* ========== 场景接口 ========== */

interface Scene3D {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  update: (time: number) => void
  dispose: () => void
}

/* ========== 场景 1：几何体展示 ========== */

/**
 * 场景 1：几何体展示
 *
 * 内容：3 个不同几何体（盒/球/圆环），不同颜色和金属质感
 * update：每个几何体以不同速度旋转，形成层次感
 * dispose：释放所有几何体与材质（防止内存泄漏）
 */
function createGeometryScene(): Scene3D {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x111122)

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100)
  camera.position.set(0, 2, 6)

  scene.add(new THREE.AmbientLight(0xffffff, 0.5))
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0)
  dirLight.position.set(5, 5, 5)
  scene.add(dirLight)

  const meshes: THREE.Mesh[] = []
  const geometries = [
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.SphereGeometry(0.6, 32, 32),
    new THREE.TorusGeometry(0.5, 0.2, 16, 32),
  ]
  const colors = [0xff4444, 0x44ff44, 0x4444ff]

  geometries.forEach((geo, i) => {
    const mat = new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.3, metalness: 0.7 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.x = (i - 1) * 2.5
    scene.add(mesh)
    meshes.push(mesh)
  })

  return {
    scene, camera,
    update: (t: number) => {
      /** 各几何体按不同速度旋转，速度与索引 i 相关 */
      meshes.forEach((m, i) => {
        m.rotation.y = t * (0.5 + i * 0.2)
        m.rotation.x = t * (0.3 + i * 0.1)
      })
    },
    dispose: () => {
      /** 释放 GPU 资源：几何体和材质都必须 dispose */
      meshes.forEach((m) => { m.geometry.dispose(); (m.material as THREE.Material).dispose() })
    },
  }
}

/* ========== 场景 2：粒子星空 ========== */

/**
 * 场景 2：粒子星空
 *
 * 内容：10000 个白色粒子在 20×20×20 空间内随机分布
 * update：整体绕 Y 轴缓慢旋转
 * dispose：释放几何体与材质
 */
function createParticleScene(): Scene3D {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x050510)

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100)
  camera.position.set(0, 0, 5)

  const count = 10000
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(count * 3)
  /** 在 20×20×20 立方体内随机分布粒子位置 */
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 20
    pos[i * 3 + 1] = (Math.random() - 0.5) * 20
    pos[i * 3 + 2] = (Math.random() - 0.5) * 20
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))

  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.03, sizeAttenuation: true })
  const particles = new THREE.Points(geo, mat)
  scene.add(particles)

  return {
    scene, camera,
    update: (t: number) => { particles.rotation.y = t * 0.05 },
    dispose: () => { geo.dispose(); mat.dispose() },
  }
}

/* ========== 场景 3：Shader 效果 ========== */

/**
 * 场景 3：Shader 效果
 *
 * 内容：一个平面 + 径向波纹 Shader（sin 波从中心向外扩散）
 * update：每帧更新 uTime 驱动波纹运动
 * dispose：释放几何体与材质
 */
function createShaderScene(): Scene3D {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000000)

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100)
  camera.position.set(0, 0, 3)

  const geo = new THREE.PlaneGeometry(4, 4)
  const mat = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        /** 中心化 UV 并放大：范围 [-2, 2] */
        vec2 uv = vUv * 4.0 - 2.0;
        /** 到中心的距离 */
        float d = length(uv);
        /** 径向波纹：sin 波随时间向外扩散，映射到 [0, 1] */
        float wave = sin(d * 10.0 - uTime * 3.0) * 0.5 + 0.5;
        vec3 color = vec3(wave * 0.3, wave * 0.6, wave);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    uniforms: { uTime: { value: 0 } },
    side: THREE.DoubleSide,
  })

  const mesh = new THREE.Mesh(geo, mat)
  scene.add(mesh)

  return {
    scene, camera,
    update: (t: number) => { mat.uniforms.uTime.value = t },
    dispose: () => { geo.dispose(); mat.dispose() },
  }
}

/* ========== 场景管理器 ========== */

/**
 * 多场景管理器
 *
 * 职责：
 * - 用 Map 注册多个场景，用名称切换当前场景
 * - 用全屏黑色遮罩（overlay）实现 0.5 秒的「淡出 → 切换 → 淡入」过渡
 * - 每帧只渲染当前场景
 *
 * 为什么用遮罩而不是销毁场景？
 * - 切换时旧场景只是隐藏，其注册的资源可以保留复用
 * - 遮罩过渡让切换更平滑，避免画面闪烁
 */
class SceneManagerMulti {
  private renderer: THREE.WebGLRenderer
  /** 已注册的场景集合（key 为场景名称） */
  private scenes: Map<string, Scene3D> = new Map()
  /** 当前激活的场景名称 */
  private current: string = ''
  /** 过渡锁：防止过渡过程中再次触发切换 */
  private transitioning = false
  /** 全屏黑色遮罩，用于淡入淡出过渡 */
  private overlay: HTMLDivElement

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer
    this.overlay = document.createElement('div')
    this.overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#000;opacity:0;pointer-events:none;transition:opacity 0.5s;z-index:100'
    document.body.appendChild(this.overlay)
  }

  /** 注册一个场景到管理器 */
  addScene(name: string, scene: Scene3D) {
    this.scenes.set(name, scene)
  }

  /**
   * 切换到指定场景（带淡入淡出过渡）
   * - 过渡中或目标就是当前场景时直接返回
   * - 流程：遮罩变黑 → 等待 0.5s → 切换 current → 遮罩变透明
   */
  async switchScene(name: string) {
    if (this.transitioning || name === this.current) return
    this.transitioning = true

    /** 淡出：遮罩变黑，遮住旧场景 */
    this.overlay.style.opacity = '1'
    await new Promise((r) => setTimeout(r, 500))

    /** 切换：更新当前场景名称 */
    this.current = name

    /** 淡入：遮罩变透明，露出新场景 */
    this.overlay.style.opacity = '0'
    await new Promise((r) => setTimeout(r, 500))
    this.transitioning = false
  }

  /** 每帧更新并渲染当前场景 */
  update(time: number) {
    const scene = this.scenes.get(this.current)
    if (scene) {
      scene.update(time)
      this.renderer.render(scene.scene, scene.camera)
    }
  }

  getScenes() { return this.scenes }
}

/* ========== 初始化 ========== */

/**
 * 初始化
 *
 * 结构：
 * - 手动创建 WebGLRenderer（本课不依赖 SceneManager 的单场景封装）
 * - SceneManagerMulti 注册 3 个场景：geometry / particles / shader
 * - 默认显示 geometry 场景
 * - 控制面板选择器切换场景，resize 时同步更新所有场景的相机
 */
function init() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const manager = new SceneManagerMulti(renderer)
  manager.addScene('geometry', createGeometryScene())
  manager.addScene('particles', createParticleScene())
  manager.addScene('shader', createShaderScene())
  manager.switchScene('geometry')

  /* ========== 控制面板 ========== */
  const panel = new ControlPanel('controls')

  panel.addSelect({
    id: 'scene-selector', label: '当前场景', type: 'select',
    options: [
      { value: 'geometry', label: '几何体' },
      { value: 'particles', label: '粒子星空' },
      { value: 'shader', label: 'Shader 效果' },
    ],
    defaultValue: 'geometry',
    onChange: (value: string) => { manager.switchScene(value) },
  })

  /* ========== 窗口自适应 ========== */
  window.addEventListener('resize', () => {
    manager.getScenes().forEach((s) => {
      s.camera.aspect = window.innerWidth / window.innerHeight
      s.camera.updateProjectionMatrix()
    })
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  /* ========== 动画循环 ========== */
  const clock = new THREE.Clock()

  function animate() {
    requestAnimationFrame(animate)
    manager.update(clock.getElapsedTime())
  }
  animate()
}

init()
