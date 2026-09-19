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
 * - 三个可切换的 3D 场景（几何体、粒子、Shader）：按需创建、切换即销毁
 * - 切换流程：遮罩淡出 → 销毁旧场景（dispose）→ Loading 页 → 创建新场景 → 淡入
 * - hash 路由（#scene-a / #scene-b / #scene-c）驱动切换，支持浏览器前进/后退与分享链接
 * - 30 行发布订阅 store 管理全局状态（这就是 Zustand 的核心思想）
 *
 * 核心思路（单一数据流）：
 *   用户操作（下拉框 / 地址栏 hash）→ store → 各订阅者响应（切场景、同步路由、同步 UI）
 *
 * 资源管理：
 * - 切换时旧场景真正 dispose：只 scene.remove 不 dispose 的话，GPU 侧 buffer 不会回收
 * - renderer.info.memory 的 geometries/textures 计数在 dispose 前后打印，肉眼验证资源释放
 *
 * 参考案例：
 * - Three.js Examples — webgl_multiple_scenes
 * - Awwwards 获奖网站的场景切换
 *
 * 运行方式：
 * - 在浏览器中打开此文件对应的 HTML
 * - 使用控制面板下拉框，或直接修改地址栏 hash 切换场景
 */

import * as THREE from 'three'
import { ControlPanel } from '@/core/ControlPanel'
import { LoadingScreen } from '@/core/LoadingScreen'

/* ========== 场景接口 ========== */

interface Scene3D {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  update: (time: number) => void
  dispose: () => void
}

/** 三个场景的名称（也是路由表里的场景标识） */
type SceneName = 'geometry' | 'particles' | 'shader'

/* ========== 状态管理（发布订阅 store） ========== */

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** 全局应用状态：当前只有一个「当前场景」字段，需要更多再加 */
interface AppState {
  currentScene: SceneName
}

/**
 * 极简发布订阅 store（约 20 行）—— 这就是 Zustand 的核心思想
 *
 * 三个动词：
 * - getState：读状态
 * - setState：合并写入并通知所有订阅者
 * - subscribe：订阅变化，返回取消订阅函数
 *
 * 好处：状态只有单一来源，路由、下拉框、场景管理器都只听 store 的，
 * 而不是互相直接调用 —— 避免了「谁改了谁、改完要通知谁」的乱麻。
 */
function createPubSubStore<T extends object>(initialState: T) {
  let state = initialState
  const listeners = new Set<(state: T, prevState: T) => void>()

  return {
    getState: () => state,
    setState(partial: Partial<T>) {
      const prevState = state
      state = { ...state, ...partial }
      listeners.forEach((listener) => listener(state, prevState))
    },
    subscribe(listener: (state: T, prevState: T) => void) {
      listeners.add(listener)
      /** 返回取消订阅函数（组件卸载时调用，防止监听器泄漏） */
      return () => { listeners.delete(listener) }
    },
  }
}

const store = createPubSubStore<AppState>({ currentScene: 'geometry' })

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
 * 多场景管理器（按需加载版）
 *
 * 职责：
 * - 注册场景「工厂函数」，切换到它时才创建实例（按需加载）
 * - 切换时真正销毁旧场景：dispose + 从实例表移除
 * - 用全屏黑色遮罩 + LoadingScreen 实现「淡出 → 销毁 → Loading → 创建 → 淡入」过渡
 * - 每帧只渲染当前场景
 *
 * 为什么切换后不保留旧场景实例？
 * - 教学演示「创建 → 使用 → 销毁」的完整生命周期（配合 info.memory 计数看得见）
 * - 真实项目若场景轻量，也可以在此缓存实例做复用 —— 这正是预加载 vs 按需的取舍
 */
class SceneManagerMulti {
  private renderer: THREE.WebGLRenderer
  /** 场景工厂注册表 —— 注册的是「怎么造」，不是实例本身 */
  private factories: Map<SceneName, () => Scene3D> = new Map()
  /** 已创建的场景实例（当前只保留活跃的那一个） */
  private instances: Map<SceneName, Scene3D> = new Map()
  /** 当前激活的场景名称（null 表示还没切换过） */
  private current: SceneName | null = null
  /** 过渡锁：防止过渡过程中再次触发切换 */
  private transitioning = false
  /** 全屏黑色遮罩，用于淡入淡出过渡 */
  private overlay: HTMLDivElement
  /** Loading 过渡页（可选，不传则跳过加载动画） */
  private loadingScreen?: LoadingScreen

  constructor(renderer: THREE.WebGLRenderer, loadingScreen?: LoadingScreen) {
    this.renderer = renderer
    this.loadingScreen = loadingScreen
    this.overlay = document.createElement('div')
    this.overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#000;opacity:0;pointer-events:none;transition:opacity 0.5s;z-index:100'
    document.body.appendChild(this.overlay)
  }

  /** 注册一个场景工厂（切换到它时才会真正创建实例） */
  addScene(name: SceneName, factory: () => Scene3D) {
    this.factories.set(name, factory)
  }

  /**
   * 切换到指定场景
   *
   * 流程：遮罩变黑 → 销毁旧场景（dispose + info.memory 前后打印）
   *      → Loading 页模拟异步资源准备 → 按需创建新场景 → 遮罩淡入
   */
  async switchScene(name: SceneName) {
    if (this.transitioning || name === this.current) return
    this.transitioning = true

    /** 淡出：遮罩变黑，遮住旧场景 */
    this.overlay.style.opacity = '1'
    await sleep(500)

    /** 销毁旧场景：只 scene.remove 不 dispose 的话，GPU 侧 buffer 不会回收，切几次泄漏几次 */
    if (this.current) {
      const oldScene = this.instances.get(this.current)
      if (oldScene) {
        const before = { ...this.renderer.info.memory }
        oldScene.dispose()
        const after = { ...this.renderer.info.memory }
        console.log(
          `[dispose] "${this.current}" geometries: ${before.geometries} -> ${after.geometries}, ` +
          `textures: ${before.textures} -> ${after.textures}`,
        )
        this.instances.delete(this.current)
      }
    }

    /** Loading 页：模拟异步资源准备（真实项目里这里是 TextureLoader / GLTFLoader 的 await） */
    if (this.loadingScreen) {
      this.loadingScreen.update(0)
      this.loadingScreen.show()
      for (let progress = 0.25; progress <= 1; progress += 0.25) {
        await sleep(120)
        this.loadingScreen.update(progress)
      }
    }

    /** 按需创建新场景（工厂内部用当时的窗口尺寸建相机，天然适配） */
    const factory = this.factories.get(name)
    if (!factory) {
      this.transitioning = false
      return
    }
    this.instances.set(name, factory())
    this.current = name

    /** 淡入：Loading 隐藏 + 遮罩变透明，露出新场景 */
    this.loadingScreen?.hide()
    this.overlay.style.opacity = '0'
    await sleep(500)
    this.transitioning = false
  }

  /** 每帧更新并渲染当前场景 */
  update(time: number) {
    const active = this.current ? this.instances.get(this.current) : undefined
    if (active) {
      active.update(time)
      this.renderer.render(active.scene, active.camera)
    }
  }

  /** 获取当前活跃场景（resize 时更新其相机用） */
  getActiveScene(): Scene3D | undefined {
    return this.current ? this.instances.get(this.current) : undefined
  }
}

/* ========== 初始化 ========== */

/**
 * 初始化
 *
 * 结构：
 * - 手动创建 WebGLRenderer（本课不依赖 SceneManager 的单场景封装）
 * - hash 路由：#scene-a / #scene-b / #scene-c 三个地址对应三个场景
 * - store 是唯一数据源：下拉框和地址栏都只改 store，订阅者再各自响应
 * - resize 只更新当前活跃场景的相机（其他场景实例已销毁）
 */
function init() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  /** 首屏先展示 Loading 页，随后第一次 switchScene 会接管进度条 */
  const loadingScreen = new LoadingScreen({ title: '加载 3D 场景…' })
  loadingScreen.show()

  const manager = new SceneManagerMulti(renderer, loadingScreen)
  manager.addScene('geometry', createGeometryScene)
  manager.addScene('particles', createParticleScene)
  manager.addScene('shader', createShaderScene)

  /* ========== 控制面板 ========== */
  const panel = new ControlPanel('controls')

  panel.addSelect({
    id: 'scene-selector', label: '当前场景', type: 'select',
    /** 下拉框的 value 直接用路由名 —— UI 也是路由的一个入口 */
    options: [
      { value: 'scene-a', label: '几何体' },
      { value: 'scene-b', label: '粒子星空' },
      { value: 'scene-c', label: 'Shader 效果' },
    ],
    defaultValue: 'scene-a',
    /** 只写 hash，不直接切场景 —— 切换由 hashchange → store 统一驱动 */
    onChange: (route: string) => { location.hash = route },
  })

  /* ========== hash 路由 → store ========== */

  /** 路由名 ↔ 场景名 的映射表（与 React Router 的 routes 配置一个意思） */
  const ROUTE_TO_SCENE: Record<string, SceneName> = {
    'scene-a': 'geometry',
    'scene-b': 'particles',
    'scene-c': 'shader',
  }
  const SCENE_TO_ROUTE: Record<SceneName, string> = {
    geometry: 'scene-a',
    particles: 'scene-b',
    shader: 'scene-c',
  }

  /** 读地址栏 hash → 更新 store（hash 变化的唯一入口，前进/后退按钮也走这里） */
  function applyRoute() {
    const route = location.hash.replace('#', '') || 'scene-a'
    const sceneName = ROUTE_TO_SCENE[route] ?? 'geometry'
    if (sceneName !== store.getState().currentScene) {
      store.setState({ currentScene: sceneName })
    }
  }
  window.addEventListener('hashchange', applyRoute)

  /* ========== store 订阅者：状态一变，各处响应 ========== */

  store.subscribe((state, prevState) => {
    if (state.currentScene === prevState.currentScene) return

    /** 1. 同步地址栏（下拉框切换时 hash 跟着变；hash 已一致则跳过，避免多余 hashchange） */
    const route = SCENE_TO_ROUTE[state.currentScene]
    if (location.hash !== `#${route}`) location.hash = route

    /** 2. 同步下拉框选中项（改地址栏/前进后退时 UI 跟着变；setValue 不触发 onChange） */
    panel.setValue('scene-selector', route)

    /** 3. 真正切换场景（内部有过渡锁，重复触发会被吞掉） */
    manager.switchScene(state.currentScene)
  })

  /* ========== 启动 ========== */

  applyRoute()
  /** 把初始路由写进地址栏，「复制链接分享」从第一步就成立 */
  if (!location.hash) location.hash = SCENE_TO_ROUTE[store.getState().currentScene]
  /** 首次进入：手动切到初始场景（走完整 Loading 流程；若订阅已触发过，过渡锁会吞掉重复调用） */
  manager.switchScene(store.getState().currentScene)

  /* ========== 窗口自适应 ========== */
  window.addEventListener('resize', () => {
    const active = manager.getActiveScene()
    if (active) {
      active.camera.aspect = window.innerWidth / window.innerHeight
      active.camera.updateProjectionMatrix()
    }
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
