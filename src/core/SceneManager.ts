/**
 * SceneManager - 场景管理核心模块
 *
 * 职责：
 * 1. 管理 Three.js 核心三件套（Scene, Camera, Renderer）
 * 2. 统一的动画循环（带 delta time）
 * 3. 窗口自适应
 * 4. 资源清理（防止内存泄漏）
 */

import * as THREE from 'three'

export interface SceneManagerOptions {
  /** canvas 元素 */
  canvas: HTMLCanvasElement
  /** 背景色，默认 #000000 */
  bgColor?: string
  /** 是否启用抗锯齿，默认 true */
  antialias?: boolean
  /** 相机 FOV，默认 75 */
  fov?: number
  /** 相机近裁剪面，默认 0.1 */
  near?: number
  /** 相机远裁剪面，默认 1000 */
  far?: number
}

export class SceneManager {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer

  /** 上一帧的时间戳（毫秒） */
  private lastTime = 0
  /** 动画是否正在运行 */
  private isRunning = false
  /** 注册的更新回调列表 */
  private updateCallbacks: Array<(delta: number, elapsed: number) => void> = []
  /** 用于清理的资源列表 */
  private disposables: Array<{ dispose: () => void }> = []
  /** 动画帧 ID */
  private rafId = 0

  constructor(options: SceneManagerOptions) {
    // 1. 创建场景
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(options.bgColor ?? '#000000')

    // 2. 创建相机
    const { width, height } = this.getSize()
    this.camera = new THREE.PerspectiveCamera(
      options.fov ?? 75,
      width / height,
      options.near ?? 0.1,
      options.far ?? 1000,
    )

    // 3. 创建渲染器
    this.renderer = new THREE.WebGLRenderer({
      canvas: options.canvas,
      antialias: options.antialias ?? true,
    })
    this.renderer.setSize(width, height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    // 4. 监听窗口大小变化
    this.handleResize = this.handleResize.bind(this)
    window.addEventListener('resize', this.handleResize)

    console.log('[SceneManager] 初始化完成', {
      分辨率: `${width}x${height}`,
      像素比: this.renderer.getPixelRatio(),
    })
  }

  /** 获取窗口尺寸 */
  private getSize() {
    return { width: window.innerWidth, height: window.innerHeight }
  }

  /** 窗口大小变化处理 */
  private handleResize() {
    const { width, height } = this.getSize()

    // 更新相机宽高比
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()

    // 更新渲染器尺寸
    this.renderer.setSize(width, height)

    console.log('[SceneManager] 窗口大小变化', `${width}x${height}`)
  }

  /**
   * 注册每帧更新回调
   * @param callback (delta: 秒, elapsed: 秒) => void
   */
  onUpdate(callback: (delta: number, elapsed: number) => void) {
    this.updateCallbacks.push(callback)
  }

  /**
   * 注册需要清理的资源
   * 场景销毁时会自动调用 dispose()
   */
  registerDisposable(resource: { dispose: () => void }) {
    this.disposables.push(resource)
  }

  /** 启动动画循环 */
  start() {
    if (this.isRunning) return
    this.isRunning = true
    this.lastTime = performance.now()
    this.tick(this.lastTime)
    console.log('[SceneManager] 动画循环启动')
  }

  /** 停止动画循环 */
  stop() {
    this.isRunning = false
    cancelAnimationFrame(this.rafId)
    console.log('[SceneManager] 动画循环停止')
  }

  /** 每帧执行 */
  private tick(now: number) {
    if (!this.isRunning) return

    this.rafId = requestAnimationFrame((t) => this.tick(t))

    // 计算 delta time（秒）和 elapsed time（秒）
    const delta = (now - this.lastTime) / 1000
    const elapsed = now / 1000
    this.lastTime = now

    // 执行所有更新回调
    for (const cb of this.updateCallbacks) {
      cb(delta, elapsed)
    }

    // 渲染场景
    this.renderer.render(this.scene, this.camera)
  }

  /** 销毁所有资源 */
  dispose() {
    this.stop()
    window.removeEventListener('resize', this.handleResize)

    // 清理所有注册的资源
    for (const d of this.disposables) {
      d.dispose()
    }
    this.disposables = []

    // 清理渲染器
    this.renderer.dispose()

    console.log('[SceneManager] 已销毁所有资源')
  }
}
