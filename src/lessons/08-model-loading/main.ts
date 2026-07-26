/**
 * 第 8 课：模型加载
 *
 * 学习目标：
 * 1. 掌握 GLTF/GLB 模型加载
 * 2. 理解 Draco 压缩和 LOD 策略
 * 3. 学会实现 Loading 进度条
 * 4. 掌握模型动画播放（AnimationMixer）
 *
 * 核心概念：
 * - GLTF：GL Transmission Format，3D 模型的"JPEG"
 * - GLB：GLTF 的二进制版本，单文件包含所有资源
 * - Draco：Google 的 3D 几何压缩库，减小文件体积
 * - LOD：Level of Detail，根据距离切换不同精度的模型
 * - AnimationMixer：Three.js 的动画播放器
 *
 * 运行方式：
 * - 在浏览器中打开此文件对应的 HTML
 * - 观察模型加载进度条
 * - 使用鼠标拖拽旋转视角，滚轮缩放
 * - 通过控制面板切换模型和动画
 */

import * as THREE from 'three'
import { SceneManager } from '@/core/SceneManager'
import { ControlPanel } from '@/core/ControlPanel'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

/* ========== 1. Loading Manager ========== */
/**
 * LoadingManager：加载管理器
 * 统一管理所有资源的加载进度
 *
 * 为什么需要 LoadingManager？
 * - 当场景中有多个资源（模型、纹理、HDRI）时
 * - 可以统一监控所有资源的加载进度
 * - 所有资源加载完成后才开始渲染
 */
function createLoadingManager(): THREE.LoadingManager {
  const manager = new THREE.LoadingManager()

  // 获取进度条元素
  const progressBar = document.getElementById('progress-bar') as HTMLDivElement
  const progressText = document.getElementById('progress-text') as HTMLSpanElement
  const loadingScreen = document.getElementById('loading-screen') as HTMLDivElement

  // 显示加载界面
  if (loadingScreen) {
    loadingScreen.style.display = 'flex'
  }

  // onLoad：所有资源加载完成
  manager.onLoad = () => {
    console.log('✅ 所有资源加载完成')
    // 隐藏加载界面
    if (loadingScreen) {
      loadingScreen.style.opacity = '0'
      setTimeout(() => {
        loadingScreen.style.display = 'none'
      }, 500)
    }
  }

  // onProgress：加载进度更新
  manager.onProgress = (url, itemsLoaded, itemsTotal) => {
    const progress = itemsLoaded / itemsTotal
    console.log(`📦 加载进度：${(progress * 100).toFixed(1)}% - ${url}`)

    // 更新进度条宽度
    if (progressBar) {
      progressBar.style.width = `${progress * 100}%`
    }
    if (progressText) {
      progressText.textContent = `${(progress * 100).toFixed(0)}%`
    }
  }

  // onError：加载失败
  manager.onError = (url) => {
    console.error('❌ 加载失败：', url)
  }

  return manager
}

/* ========== 2. GLTF Loader ========== */
/**
 * GLTFLoader：GLTF 模型加载器
 *
 * GLTF vs GLB：
 * - GLTF：JSON 格式，可读性强，资源分散（.gltf + .bin + 纹理）
 * - GLB：二进制格式，单文件包含所有资源，加载更快
 *
 * Draco 压缩：
 * - Google 开发的 3D 几何压缩库
 * - 可以将模型文件大小减小 90%+
 * - 需要额外的 DRACOLoader 解码器
 */
function createGLTFLoader(manager?: THREE.LoadingManager): GLTFLoader {
  const loader = manager ? new GLTFLoader(manager) : new GLTFLoader()

  // Draco 解码器（可选）
  // 如果模型使用了 Draco 压缩，需要配置解码器
  const dracoLoader = new DRACOLoader()
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
  loader.setDRACOLoader(dracoLoader)

  return loader
}

/* ========== 3. 模型加载函数 ========== */
/**
 * 加载 GLTF/GLB 模型
 *
 * @param loader - GLTFLoader 实例
 * @param url - 模型路径
 * @param scene - 场景
 * @param options - 配置选项
 *
 * 返回 Promise，resolve 时返回模型对象和动画混合器
 */
async function loadModel(
  loader: GLTFLoader,
  url: string,
  scene: THREE.Scene,
  options: {
    autoCenter?: boolean    // 是否自动居中
    autoScale?: boolean     // 是否自动缩放
    targetSize?: number     // 目标大小（自动缩放时使用）
    castShadow?: boolean    // 是否投射阴影
    receiveShadow?: boolean // 是否接收阴影
  } = {}
): Promise<{ model: THREE.Group; mixer: THREE.AnimationMixer | null }> {
  // 默认选项
  const {
    autoCenter = true,
    autoScale = true,
    targetSize = 3,
    castShadow = true,
    receiveShadow = true,
  } = options

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      // onLoad：加载成功
      (gltf) => {
        const model = gltf.scene

        // 1. 计算包围盒
        const box = new THREE.Box3().setFromObject(model)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())

        console.log('📐 模型原始尺寸：', size)
        console.log('📍 模型中心点：', center)

        // 2. 自动缩放
        if (autoScale) {
          const maxDim = Math.max(size.x, size.y, size.z)
          const scale = targetSize / maxDim
          model.scale.setScalar(scale)
          console.log(`📏 缩放比例：${scale.toFixed(3)} (目标大小：${targetSize})`)
        }

        // 3. 自动居中
        if (autoCenter) {
          // 重新计算缩放后的包围盒
          const newBox = new THREE.Box3().setFromObject(model)
          const newCenter = newBox.getCenter(new THREE.Vector3())
          model.position.sub(newCenter)
          console.log('🎯 已居中到原点')
        }

        // 4. 阴影设置
        if (castShadow || receiveShadow) {
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = castShadow
              child.receiveShadow = receiveShadow
            }
          })
        }

        // 5. 添加到场景
        scene.add(model)
        console.log('✅ 模型已添加到场景')

        // 6. 动画混合器
        let mixer: THREE.AnimationMixer | null = null
        if (gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(model)
          console.log(`🎬 发现 ${gltf.animations.length} 个动画：`)
          gltf.animations.forEach((clip, i) => {
            console.log(`   ${i + 1}. ${clip.name} (${clip.duration.toFixed(2)}s)`)
          })
        }

        resolve({ model, mixer })
      },
      // onProgress：加载进度（单个文件）
      (progress) => {
        if (progress.total > 0) {
          const percent = (progress.loaded / progress.total) * 100
          console.log(`📦 模型加载：${percent.toFixed(1)}%`)
        }
      },
      // onError：加载失败
      (error) => {
        console.error('❌ 模型加载失败：', error)
        reject(error)
      }
    )
  })
}

/* ========== 4. 动画播放控制 ========== */
/**
 * 动画播放控制器
 *
 * AnimationMixer：动画混合器
 * - 管理模型的所有动画
 * - 可以播放、暂停、停止动画
 * - 可以混合多个动画
 *
 * AnimationAction：动画动作
 * - 单个动画的播放控制
 * - 可以设置循环模式、播放速度、权重
 */
class AnimationController {
  private mixer: THREE.AnimationMixer
  private actions: Map<string, THREE.AnimationAction> = new Map()
  private currentAction: THREE.AnimationAction | null = null

  constructor(mixer: THREE.AnimationMixer, clips: THREE.AnimationClip[]) {
    this.mixer = mixer

    // 创建所有动画的动作
    clips.forEach((clip) => {
      const action = mixer.clipAction(clip)
      this.actions.set(clip.name, action)
    })
  }

  // 播放指定动画
  play(name: string, options: { loop?: boolean; speed?: number } = {}) {
    const { loop = true, speed = 1 } = options
    const action = this.actions.get(name)
    if (!action) {
      console.warn(`⚠️ 动画 "${name}" 不存在`)
      return
    }

    // 停止当前动画
    if (this.currentAction) {
      this.currentAction.fadeOut(0.3)
    }

    // 播放新动画
    action.reset()
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1)
    action.clampWhenFinished = true
    action.timeScale = speed
    action.fadeIn(0.3)
    action.play()

    this.currentAction = action
    console.log(`▶️ 播放动画：${name}`)
  }

  // 停止所有动画
  stop() {
    this.actions.forEach((action) => {
      action.stop()
    })
    this.currentAction = null
    console.log('⏹️ 停止所有动画')
  }

  // 更新动画（每帧调用）
  update(delta: number) {
    this.mixer.update(delta)
  }

  // 获取所有动画名称
  getAnimationNames(): string[] {
    return Array.from(this.actions.keys())
  }
}

/* ========== 5. 初始化场景 ========== */
function init() {
  // 获取 canvas 元素
  const canvas = document.getElementById('canvas') as HTMLCanvasElement

  // 创建场景管理器
  const manager = new SceneManager({
    canvas,
    bgColor: '#111111',
    fov: 50,
  })

  // 设置相机位置
  manager.camera.position.set(5, 3, 5)
  manager.camera.lookAt(0, 0, 0)

  // 轨道控制器
  const controls = new OrbitControls(manager.camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.target.set(0, 0, 0)

  // ========== 灯光 ==========
  // 环境光：均匀照亮场景
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
  manager.scene.add(ambientLight)

  // 方向光：模拟太阳光，产生阴影
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
  directionalLight.position.set(5, 10, 5)
  directionalLight.castShadow = true
  directionalLight.shadow.mapSize.width = 2048
  directionalLight.shadow.mapSize.height = 2048
  manager.scene.add(directionalLight)

  // 地面：接收阴影
  const groundGeo = new THREE.PlaneGeometry(20, 20)
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.8,
  })
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.01
  ground.receiveShadow = true
  manager.scene.add(ground)

  // 网格辅助线
  const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222)
  manager.scene.add(gridHelper)

  // ========== 加载管理器 ==========
  // LoadingManager 统一管理所有资源的加载进度
  // 传给 GLTFLoader 后，模型加载进度会自动报告给 manager
  const loadingManager = createLoadingManager()

  // ========== GLTF 加载器 ==========
  // 将 LoadingManager 传给 GLTFLoader，这样加载进度会自动更新
  const gltfLoader = createGLTFLoader(loadingManager)

  // ========== 加载模型 ==========
  let animationController: AnimationController | null = null

  // 加载 Suzanne 模型
  loadModel(gltfLoader, '/models/suzanne.glb', manager.scene, {
    autoCenter: true,
    autoScale: true,
    targetSize: 3,
    castShadow: true,
    receiveShadow: true,
  }).then(({ model: _model, mixer }) => {
    console.log('🎉 Suzanne 模型加载完成')

    // 如果有动画，创建动画控制器
    if (mixer) {
      // 这里需要传入动画片段，但 Suzanne 模型可能没有动画
      // 实际使用时需要从 gltf.animations 获取
      console.log('ℹ️ Suzanne 模型没有动画')
    }
  }).catch((error) => {
    console.error('❌ 加载失败：', error)
  })

  // ========== 控制面板 ==========
  const panel = new ControlPanel()

  // 模型信息显示
  panel.addSlider({
    id: 'model-info',
    label: '模型信息',
    type: 'slider',
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 0,
    onChange: () => {},
  })

  // ========== 动画循环 ==========
  manager.onUpdate((delta) => {
    // 更新控制器
    controls.update()

    // 更新动画
    if (animationController) {
      ;(animationController as AnimationController).update(delta)
    }
  })

  // 启动渲染
  manager.start()

  // ========== 控制台提示 ==========
  console.log('=== 第 8 课：模型加载 ===')
  console.log('观察要点：')
  console.log('  - 模型加载进度条')
  console.log('  - 模型自动缩放和居中')
  console.log('  - 阴影效果')
  console.log('')
  console.log('尝试修改：')
  console.log('  - 替换不同的模型文件')
  console.log('  - 调整 targetSize 参数')
  console.log('  - 添加 Draco 压缩模型')
}

// 初始化场景
init()
