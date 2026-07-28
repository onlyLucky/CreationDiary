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
 * - 通过控制面板切换模型、动画、LOD、Draco 等
 */

import * as THREE from 'three'
import { SceneManager } from '@/core/SceneManager'
import { ControlPanel } from '@/core/ControlPanel'
import { LoadingScreen } from '@/core/LoadingScreen'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

/* ========== 1. Loading Manager ========== */
/**
 * LoadingManager：加载管理器
 * 统一管理所有资源的加载进度
 */
function createLoadingManager(): {
  manager: THREE.LoadingManager
  screen: LoadingScreen
} {
  const manager = new THREE.LoadingManager()
  const screen = new LoadingScreen({ title: '加载中…' })
  screen.show()

  manager.onLoad = () => {
    console.log('所有资源加载完成')
    screen.hide()
  }

  manager.onProgress = (url, itemsLoaded, itemsTotal) => {
    const progress = itemsTotal > 0 ? itemsLoaded / itemsTotal : 0
    console.log(`加载进度：${(progress * 100).toFixed(1)}% - ${url}`)
    screen.update(progress)
  }

  manager.onError = (url) => {
    console.error('加载失败：', url)
  }

  return { manager, screen }
}

/* ========== 2. GLTF Loader（支持 Draco 开关） ========== */
function createGLTFLoader(
  manager: THREE.LoadingManager,
  useDraco: boolean,
): GLTFLoader {
  const loader = new GLTFLoader(manager)

  if (useDraco) {
    // 解码器来自 three 自带的 examples/jsm/libs/draco，Vite 会拷贝 wasm
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('three/examples/jsm/libs/draco/')
    dracoLoader.setDecoderConfig({ type: 'wasm' })
    loader.setDRACOLoader(dracoLoader)
    console.log('Draco 解码器已启用')
  }

  return loader
}

/* ========== 3. 模型加载函数 ========== */
interface ModelOptions {
  autoCenter?: boolean
  autoScale?: boolean
  targetSize?: number
  castShadow?: boolean
  receiveShadow?: boolean
  groundSnap?: boolean
}

interface LoadedModel {
  model: THREE.Group
  mixer: THREE.AnimationMixer | null
  animations: THREE.AnimationClip[]
}

async function loadModel(
  loader: GLTFLoader,
  url: string,
  options: ModelOptions = {},
): Promise<LoadedModel> {
  const {
    autoCenter = true,
    autoScale = true,
    targetSize = 3,
    castShadow = true,
    receiveShadow = true,
    groundSnap = false,
  } = options

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene

        // 1. 计算包围盒
        const box = new THREE.Box3().setFromObject(model)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())

        console.log('模型原始尺寸：', size)
        console.log('模型中心点：', center)

        // 2. 自动缩放
        if (autoScale) {
          const maxDim = Math.max(size.x, size.y, size.z)
          const scale = targetSize / maxDim
          model.scale.setScalar(scale)
          console.log(`缩放比例：${scale.toFixed(3)} (目标大小：${targetSize})`)
        }

        // 3. 自动居中
        if (autoCenter) {
          const newBox = new THREE.Box3().setFromObject(model)
          const newCenter = newBox.getCenter(new THREE.Vector3())
          model.position.sub(newCenter)
          console.log('已居中到原点')
        }

        // 3.1 落地
        if (groundSnap) {
          const newBox = new THREE.Box3().setFromObject(model)
          model.position.y -= newBox.min.y
          console.log('已贴地')
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

        console.log('模型加载完成:', url)

        // 5. 动画混合器
        let mixer: THREE.AnimationMixer | null = null
        if (gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(model)
          console.log(`发现 ${gltf.animations.length} 个动画：`)
          gltf.animations.forEach((clip, i) => {
            console.log(`   ${i + 1}. ${clip.name} (${clip.duration.toFixed(2)}s)`)
          })
        }

        resolve({
          model,
          mixer,
          animations: gltf.animations,
        })
      },
      (progress) => {
        if (progress.total > 0) {
          const percent = (progress.loaded / progress.total) * 100
          console.log(`文件加载：${percent.toFixed(1)}%`)
        }
      },
      (error) => {
        console.error('模型加载失败：', error)
        reject(error)
      },
    )
  })
}

/* ========== 4. LOD 工厂 ========== */
/**
 * LOD：Level of Detail
 * 根据相机距离自动切换不同精度的模型占位
 * 这里用同一模型的多个缩放/简化版本作为示例
 *
 * 注意：传入的 baseModel 必须保持 scale = 1；LOD 内部各个 level 自己设置缩放。
 */
function createLODFromModel(baseModel: THREE.Group): THREE.LOD {
  const lod = new THREE.LOD()

  // 把 baseModel 归一到 scale = 1，避免和 level 的缩放复合相乘
  baseModel.scale.setScalar(1)

  // 高精度：原模型（不要 clone，直接用 baseModel）
  const high = baseModel
  high.traverse((c) => {
    if (c instanceof THREE.Mesh) {
      c.castShadow = true
      const mat = c.material as THREE.MeshStandardMaterial
      if (mat) mat.flatShading = false
    }
  })

  // 中精度：克隆 + 缩放 + 简化材质
  const mid = baseModel.clone(true)
  mid.scale.setScalar(0.85)
  mid.traverse((c) => {
    if (c instanceof THREE.Mesh) {
      c.castShadow = true
      const mat = c.material as THREE.MeshStandardMaterial
      if (mat) mat.flatShading = true
    }
  })

  // 低精度：克隆 + 更小 + 灰色简单材质
  const low = baseModel.clone(true)
  low.scale.setScalar(0.6)
  low.traverse((c) => {
    if (c instanceof THREE.Mesh) {
      c.castShadow = true
      const mat = c.material as THREE.MeshStandardMaterial
      if (mat) {
        mat.flatShading = true
        mat.color = new THREE.Color(0x999999)
      }
    }
  })

  lod.addLevel(high, 0)
  lod.addLevel(mid, 8)
  lod.addLevel(low, 16)

  return lod
}

/* ========== 5. 动画播放控制 ========== */
class AnimationController {
  private mixer: THREE.AnimationMixer
  private actions: Map<string, THREE.AnimationAction> = new Map()
  private currentAction: THREE.AnimationAction | null = null

  constructor(mixer: THREE.AnimationMixer, clips: THREE.AnimationClip[]) {
    this.mixer = mixer
    clips.forEach((clip) => {
      const action = mixer.clipAction(clip)
      this.actions.set(clip.name || 'default', action)
    })
  }

  play(name: string, options: { loop?: boolean; speed?: number } = {}) {
    const { loop = true, speed = 1 } = options
    const action = this.actions.get(name)
    if (!action) {
      console.warn(`动画 "${name}" 不存在`)
      return
    }

    if (this.currentAction) {
      this.currentAction.fadeOut(0.3)
    }

    action.reset()
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1)
    action.clampWhenFinished = true
    action.timeScale = speed
    action.fadeIn(0.3)
    action.play()

    this.currentAction = action
    console.log(`播放动画：${name}`)
  }

  stop() {
    this.actions.forEach((action) => action.stop())
    this.currentAction = null
    console.log('停止所有动画')
  }

  update(delta: number) {
    this.mixer.update(delta)
  }

  getAnimationNames(): string[] {
    return Array.from(this.actions.keys())
  }
}

/* ========== 6. 资源清理工具 ========== */
function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose()
      const mat = child.material
      if (Array.isArray(mat)) {
        mat.forEach((m) => m.dispose())
      } else if (mat) {
        mat.dispose()
      }
    }
  })
}

/* ========== 7. 初始化场景 ========== */

interface ModelEntry {
  id: string
  label: string
  url: string
  hasAnimation: boolean
}

const MODELS: ModelEntry[] = [
  { id: 'duck',label: 'Duck（黄色橡皮鸭）',url: '/models/Duck.glb',hasAnimation: false },
  { id: 'suzanne', label: 'Suzanne（猴头）', url: '/models/suzanne.glb', hasAnimation: false },
  { id: 'watch', label: 'Watch（戴表动画）', url: '/models/watch/diegoWatchAnimation4.gltf', hasAnimation: true  },
]

/**
 * 初始化场景（异步：需要等待首模型加载）
 *
 * 场景图结构：
 * scene (根节点)
 * ├── ambientLight          (环境光)
 * ├── directionalLight      (方向光 + 阴影)
 * ├── ground                (地面，接收阴影)
 * ├── gridHelper            (网格辅助线)
 * └── currentModelRoot      (当前模型，普通 Group 或 THREE.LOD)
 *     ├── duck / suzanne / watch（取决于选择）
 *     └── 或 LOD.addLevel(high,0) / LOD.addLevel(mid,8) / LOD.addLevel(low,16)
 *
 * DOM 结构：
 * body
 * ├── #control-panel
 * ├── #loading-screen
 * └── #canvas
 */
async function init() {
  // 获取 canvas 元素并断言为 HTMLCanvasElement 类型
  const canvas = document.getElementById('canvas') as HTMLCanvasElement

  // 创建场景管理器
  // SceneManager 封装了 scene、camera、renderer 的创建和管理
  const manager = new SceneManager({
    canvas,
    bgColor: '#111111',   // 近黑色背景，便于观察模型
    fov: 50,              // 相机视场角
  })

  // 设置相机位置：从 (5, 3, 8) 看向模型中心 (0, 0.5, 0)
  manager.camera.position.set(5, 3, 8)
  manager.camera.lookAt(0, 0.5, 0)

  // OrbitControls：轨道控制器
  // 允许用户通过鼠标拖拽旋转视角，滚轮缩放
  const controls = new OrbitControls(manager.camera, canvas)
  controls.enableDamping = true              // 启用阻尼（惯性效果）
  controls.dampingFactor = 0.05              // 阻尼系数
  controls.target.set(0, 0.5, 0)             // 控制器的目标点
  controls.maxDistance = 30                  // 限制最大拉远距离
  controls.maxPolarAngle = Math.PI / 2 - 0.05 // 限制最大俯仰角，避免穿到地面下

  // 缓存相机到 target 的单位方向；OrbitControls 拖动后会在 change 里更新它
  // 用于「LOD 演示」滑块按视线方向缩放相机
  const cameraDir = new THREE.Vector3()
    .subVectors(manager.camera.position, controls.target)
    .normalize()

  // 拖动 / 滚轮时刷新相机方向
  controls.addEventListener('change', () => {
    if (manager.camera.position.distanceToSquared(controls.target) > 1e-4) {
      cameraDir
        .subVectors(manager.camera.position, controls.target)
        .normalize()
    }
  })

  // ========== 灯光 ==========
  // 环境光：均匀照亮整个场景，没有方向性
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
  manager.scene.add(ambientLight)

  // 方向光：模拟太阳光，会产生方向性阴影
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
  directionalLight.position.set(5, 10, 5)         // 光源位置
  directionalLight.castShadow = true              // 启用阴影投射
  directionalLight.shadow.mapSize.width = 2048    // 阴影贴图分辨率
  directionalLight.shadow.mapSize.height = 2048
  manager.scene.add(directionalLight)

  // ========== 地面与网格 ==========
  // 地面：接收阴影，让模型有「落影」
  const groundGeo = new THREE.PlaneGeometry(40, 40)         // 40x40 平面
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x333333,   // 深灰色
    roughness: 0.8,    // 粗糙表面，漫反射更强
  })
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.rotation.x = -Math.PI / 2 // 旋转到水平面
  ground.position.y = -0.01        // 略低于 0，避免与模型底面 z-fighting
  ground.receiveShadow = true      // 接收阴影
  manager.scene.add(ground)

  // 网格辅助线：用于观察模型在世界中的位置
  // 参数：尺寸, 分割数, 主线颜色, 次线颜色
  const gridHelper = new THREE.GridHelper(40, 40, 0x444444, 0x222222)
  manager.scene.add(gridHelper)

  // ========== 加载管理器 ==========
  // LoadingManager 统一管理所有 GLTFLoader 加载进度
  // 传给 GLTFLoader 后，进度会自动报告到屏幕
  const { manager: loadingManager, screen: loadingScreen } = createLoadingManager()

  // ========== 当前场景状态 ==========
  // 用一组变量集中保存控制面板的开关状态，
  // 在 onUpdate / 控件回调里读写，避免散落在各处
  let currentModelId = 'duck'        // 当前选中的模型 id
  let useDraco = false               // 是否启用 Draco 解码器
  let useLOD = false                 // 是否启用 LOD（多精度）
  let autoRotate = true              // 是否自动旋转
  let rotateSpeed = 0.5              // 自转速度（弧度/秒）
  let currentModelRoot: THREE.Object3D | null = null  // 当前挂载到场景的根（普通 Group 或 THREE.LOD）
  let animationController: AnimationController | null = null  // 当前模型的动画控制器
  const animationSpeed = { value: 1 } // 当前动画播放速度

  // ========== 控制面板 ==========
  const panel = new ControlPanel()

  // -------- 1. 模型选择与加载 --------
  // 选择模型：切到对应 GLTF/GLB，并清空「播放动画」下拉
  panel.addSelect({
    id: 'model-select',
    label: '选择模型',
    type: 'select',
    options: MODELS.map((m) => ({ value: m.id, label: m.label })),
    defaultValue: currentModelId,
    onChange: (id) => {
      const entry = MODELS.find((m) => m.id === id)
      if (!entry) return
      currentModelId = id
      // 切换时清空动画下拉
      panel.setValue('animation', '')
      void loadAndMount(entry)
    },
  })

  // 重新加载：用于观察 Draco 开关等参数变化后的效果
  panel.addButton({
    id: 'reload',
    label: '重新加载当前模型',
    type: 'button',
    onClick: () => {
      const entry = MODELS.find((m) => m.id === currentModelId)
      if (entry) void loadAndMount(entry)
    },
  })

  // -------- 2. 自转控制 --------
  // 自动旋转开关
  panel.addCheckbox({
    id: 'auto-rotate',
    label: '模型自动旋转',
    type: 'checkbox',
    defaultValue: autoRotate,
    onChange: (checked) => { autoRotate = checked },
  })

  // 自转速度（弧度/秒）
  panel.addSlider({
    id: 'rotate-speed',
    label: '旋转速度',
    type: 'slider',
    min: 0,
    max: 3,
    step: 0.1,
    defaultValue: rotateSpeed,
    onChange: (value) => { rotateSpeed = value },
  })

  // -------- 3. 动画播放 --------
  // 动画下拉：选项在 loadAndMount 内动态填充（replaceSelectOptions）
  panel.addSelect({
    id: 'animation',
    label: '播放动画',
    type: 'select',
    options: [{ value: '', label: '（无）' }],
    defaultValue: '',
    onChange: (name) => {
      if (!animationController || !name) return
      animationController.play(name, {
        loop: true,
        speed: animationSpeed.value,
      })
    },
  })

  // 动画速度：调整后立即用新速度重新播放当前动画
  panel.addSlider({
    id: 'anim-speed',
    label: '动画速度',
    type: 'slider',
    min: 0,
    max: 2,
    step: 0.1,
    defaultValue: 1,
    onChange: (value) => {
      animationSpeed.value = value
      if (animationController) {
        const sel = panel.getControl('animation') as HTMLSelectElement | undefined
        const cur = sel?.value
        if (cur) animationController.play(cur, { loop: true, speed: value })
      }
    },
  })

  // -------- 4. LOD（多精度） --------
  // 启用 LOD：用 createLODFromModel 把当前模型包成 THREE.LOD
  panel.addCheckbox({
    id: 'use-lod',
    label: '启用 LOD（多精度）',
    type: 'checkbox',
    defaultValue: useLOD,
    onChange: (checked) => {
      useLOD = checked
      const entry = MODELS.find((m) => m.id === currentModelId)
      if (entry) void loadAndMount(entry)
    },
  })

  // LOD 演示滑块：沿当前视线方向改变相机距离，
  // 方便观察 LOD 等级切换（动画循环里调用 lod.update(camera)）
  panel.addSlider({
    id: 'lod-hint',
    label: 'LOD 演示（缩放距离）',
    type: 'slider',
    min: 0.5,   // 最小 0.5，避免贴脸导致方向向量被清零
    max: 30,
    step: 0.5,
    defaultValue: 8,
    onChange: (value) => {
      const dist = Math.max(0.5, value)
      manager.camera.position
        .copy(controls.target)
        .addScaledVector(cameraDir, dist)
    },
  })

  // -------- 5. Draco 解码器 --------
  // 启用后 GLTFLoader 会带 DRACOLoader，
  // 解码器来自 three/examples/jsm/libs/draco/
  panel.addCheckbox({
    id: 'use-draco',
    label: '启用 Draco 解码器',
    type: 'checkbox',
    defaultValue: useDraco,
    onChange: (checked) => {
      useDraco = checked
      const entry = MODELS.find((m) => m.id === currentModelId)
      if (entry) void loadAndMount(entry)
    },
  })

  // 切换加载界面
  panel.addButton({
    id: 'show-loading',
    label: '再次显示加载界面',
    type: 'button',
    onClick: () => {
      // 模拟一次从 0% 到 100% 的加载流程，结束后自动隐藏
      simulateLoading()
    },
  })

  /**
   * 模拟加载进度：30 步从 0 跑到 1，再调用 hide
   *
   * 用于「再次显示加载界面」按钮，没有真实资源加载，
   * 仅做 UI 演示，让用户能再次看到加载过程的动画。
   */
  function simulateLoading(): void {
    loadingScreen.show()
    loadingScreen.update(0)

    let progress = 0
    const totalSteps = 30
    const interval = setInterval(() => {
      progress += 1 / totalSteps
      if (progress >= 1) {
        progress = 1
        loadingScreen.update(progress)
        clearInterval(interval)
        // 跑完稍等一下再隐藏，让用户看清 100%
        setTimeout(() => loadingScreen.hide(), 250)
      } else {
        loadingScreen.update(progress)
      }
    }, 40)
  }

  // ========== 加载并挂载模型 ==========
  /**
   * 加载并挂载模型到场景中：
   * 1. 清理旧的模型根与动画控制器（释放 GPU 资源）
   * 2. 重新创建 GLTFLoader（Draco 开关变化需要重建）
   * 3. await loadModel 拿到 model / mixer / animations
   * 4. 决定是否用 LOD 包裹
   * 5. 同步「播放动画」下拉的选项
   *
   * @param entry 模型元数据（id/url/hasAnimation）
   */
  async function loadAndMount(entry: ModelEntry) {
    // 1. 清理旧模型：dispose 几何/材质/贴图，避免内存泄漏
    if (currentModelRoot) {
      manager.scene.remove(currentModelRoot)
      disposeObject(currentModelRoot)
      currentModelRoot = null
    }
    if (animationController) {
      animationController.stop()
      animationController = null
    }

    // 2. 重新创建加载器（Draco 开关可能改了）
    const loader = createGLTFLoader(loadingManager, useDraco)

    try {
      // 3. 加载：loadModel 内做自动居中/缩放/贴地
      const { model, mixer, animations } = await loadModel(loader, entry.url, {
        autoCenter: true,
        autoScale: true,
        targetSize: entry.id === 'watch' ? 1.2 : 2.5,
        castShadow: true,
        receiveShadow: true,
        groundSnap: true,
      })

      // 落地后再加一个小的 y 偏移，避免 z-fighting
      model.position.y += 0.001

      // 4. 是否使用 LOD
      const root: THREE.Object3D = useLOD ? createLODFromModel(model) : model
      manager.scene.add(root)
      currentModelRoot = root

      // 5. 动画：动态填充下拉框
      if (mixer && animations.length > 0) {
        animationController = new AnimationController(mixer, animations)
        // 同步动画下拉选项
        const opts = [
          { value: '', label: '（无）' },
          ...animations.map((c) => ({ value: c.name, label: c.name })),
        ]
        replaceSelectOptions(panel, 'animation', opts)
        // 标记 hasAnimation 的模型默认播放第一个动画
        if (entry.hasAnimation) {
          panel.setValue('animation', animations[0].name)
          animationController.play(animations[0].name, {
            loop: true,
            speed: animationSpeed.value,
          })
        }
      } else {
        replaceSelectOptions(panel, 'animation', [{ value: '', label: '（无）' }])
        panel.setValue('animation', '')
      }
    } catch (err) {
      console.error('挂载模型失败：', err)
    }
  }

  // 初始加载
  await loadAndMount(MODELS[0])

  // ========== 动画循环 ==========
  // 每一帧需要做的事：
  // - 阻尼控制器 update
  // - 模型自转（如果开启）
  // - LOD 等级更新（如果当前 root 是 LOD）
  // - 动画 mixer 推进 delta
  manager.onUpdate((delta) => {
    // OrbitControls 阻尼更新
    controls.update()

    // 模型自转（LOD 继承自 Object3D，rotation 字段可用）
    if (autoRotate && currentModelRoot) {
      currentModelRoot.rotation.y += rotateSpeed * delta
    }

    // LOD：每帧根据相机距离更新 level
    if (currentModelRoot instanceof THREE.LOD) {
      currentModelRoot.update(manager.camera)
    }

    // 推进动画（mixer.update(delta) 单位是秒）
    if (animationController) {
      animationController.update(delta)
    }
  })

  // 启动渲染循环
  manager.start()

  console.log('=== 第 8 课：模型加载 ===')
  console.log('观察要点：')
  console.log('  - 模型加载进度条')
  console.log('  - 模型自动缩放、居中、贴地')
  console.log('  - 阴影效果')
  console.log('  - LOD 多精度切换（拉远相机观察）')
  console.log('  - Watch 模型内置动画')
  console.log('')
  console.log('尝试修改：')
  console.log('  - 切换 Drake / Suzanne / Watch')
  console.log('  - 启用 Draco 解码器')
  console.log('  - 启用 LOD 拉远观察等级切换')
}

/** 替换下拉选项（ControlPanel 未暴露，按需补一个本地工具） */
function replaceSelectOptions(
  panel: ControlPanel,
  id: string,
  options: { value: string; label: string }[],
): void {
  const sel = panel.getControl(id) as HTMLSelectElement | undefined
  if (!sel) return
  sel.innerHTML = ''
  options.forEach((opt) => {
    const o = document.createElement('option')
    o.value = opt.value
    o.textContent = opt.label
    sel.appendChild(o)
  })
}

init().catch((err: unknown) => {
  console.error('初始化失败：', err)
})
