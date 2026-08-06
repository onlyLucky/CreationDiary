/**
 * 第 9 课：动画系统
 *
 * 学习目标：
 * 1. 理解 requestAnimationFrame 循环 vs GSAP 动画的区别
 * 2. 掌握 gsap.to() / gsap.from() / gsap.timeline()
 * 3. 学会用 GSAP 控制相机和物体的平滑移动
 * 4. 掌握 AnimationMixer 播放模型动画
 * 5. 学会关键帧动画（KeyframeTrack / AnimationClip）
 * 6. 理解 AnimationObjectGroup 让多个对象共享动画
 *
 * 参考案例：Three.js misc_animation_groups
 * https://threejs.org/examples/misc_animation_groups.html
 *
 * 运行方式：
 * - 在浏览器中打开此文件对应的 HTML
 * - 观察 25 个立方体的旋转、变色、透明度动画
 * - 使用控制面板切换动画模式和参数
 */

import * as THREE from 'three'
import { SceneManager } from '@/core/SceneManager'
import { ControlPanel } from '@/core/ControlPanel'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import gsap from 'gsap'

/* ========== 1. GSAP 基础动画 ========== */

/**
 * gsap.to() — 从当前状态动画到目标状态
 * 最常用的动画方法
 *
 * 关键参数：
 * - duration：动画时长（秒）
 * - ease：缓动曲线（如 "power2.out"）
 * - repeat：重复次数（-1 = 无限）
 * - yoyo：来回播放
 * - delay：延迟开始
 * - onComplete / onStart：回调
 */
function demoGsapTo(group: THREE.Group) {
  // 把 group.rotation.y 从当前值动画到 2π（转一圈）
  gsap.to(group.rotation, {
    y: Math.PI * 2,   // 目标角度
    duration: 3,      // 3 秒一圈
    ease: 'none',     // 线性（等速旋转）
    repeat: -1,       // 无限循环
  })
}

/**
 * gsap.from() — 从指定状态动画到当前状态
 * 适合做入场动画
 *
 * 注意：from() 会立即应用初始值（immediateRender: true）
 */
function demoGsapFrom(group: THREE.Group) {
  // from：把 group.scale 从 0 弹回到当前值（默认是 1）
  // 立即跳到 0 然后弹回，所以适合做「入场」效果
  gsap.from(group.scale, {
    x: 0,             // 起始 x 缩放
    y: 0,             // 起始 y 缩放
    z: 0,             // 起始 z 缩放
    duration: 1.5,    // 1.5 秒
    ease: 'elastic.out(1, 0.3)',  // 弹性回弹曲线
  })
}

/**
 * gsap.timeline() — 时间线编排多个动画
 *
 * 位置参数（第三个参数）：
 * - 绝对时间：1（第 1 秒）
 * - 相对时间："+=" 前一个动画结束后 / "-=" 前一个动画结束前
 * - "<" 与前一个动画同时开始
 */
function demoGsapTimeline(group: THREE.Group) {
  // timeline：把多个动画按时间线串起来
  // defaults 给所有子动画一个默认配置
  const tl = gsap.timeline({
    defaults: { duration: 0.8, ease: 'power2.out' },
    repeat: -1,   // 整个时间线循环
    yoyo: true,   // 来回播放
  })

  // 阶段 1：向上跳
  tl.to(group.position, { y: 2 })
    // 阶段 2：与上一动画同时开始，旋转 180°
    .to(group.rotation, { y: Math.PI }, '<')
    // 阶段 3：在阶段 2 结束前 0.4 秒就开始放大
    .to(group.scale, { x: 1.2, y: 1.2, z: 1.2 }, '-=0.4')
}

/* ========== 2. KeyframeTrack 动画系统 ========== */

/**
 * 创建 KeyframeTrack 动画
 *
 * AnimationObjectGroup — 让多个对象共享同一个动画状态
 * 所有加入 group 的对象会同步播放相同的动画
 *
 * 三种 KeyframeTrack 类型：
 * 三种 KeyframeTrack 类型：
 * - QuaternionKeyframeTrack：旋转（四元数）
 * - ColorKeyframeTrack：颜色（离散插值）
 * - NumberKeyframeTrack：数值（如透明度）
 *
 * 注意：AnimationObjectGroup 中不能用 VectorKeyframeTrack 控制位置，
 * 因为会把所有对象的位置都设置为相同值，导致重叠。
 */
function createKeyframeAnimation() {
  // -------- 旋转关键帧（四元数） --------
  // 绕 X 轴：0° → 180° → 0°
  const xAxis = new THREE.Vector3(1, 0, 0)
  const qInitial = new THREE.Quaternion().setFromAxisAngle(xAxis, 0)
  const qFinal = new THREE.Quaternion().setFromAxisAngle(xAxis, Math.PI)

  // 参数：路径、时间数组、值数组（每帧一个四元数 x,y,z,w）
  const quaternionKF = new THREE.QuaternionKeyframeTrack(
    '.quaternion',
    [0, 1, 2],
    [
      qInitial.x, qInitial.y, qInitial.z, qInitial.w,
      qFinal.x, qFinal.y, qFinal.z, qFinal.w,
      qInitial.x, qInitial.y, qInitial.z, qInitial.w,
    ],
  )

  // -------- 颜色关键帧（离散插值） --------
  // 红 → 绿 → 蓝，帧间瞬间切换（不渐变）
  // 第四个参数 InterpolateDiscrete 表示「离散插值」
  const colorKF = new THREE.ColorKeyframeTrack(
    '.material.color',
    [0, 1, 2],
    [1, 0, 0, 0, 1, 0, 0, 0, 1],   // 每帧一个 r,g,b
    THREE.InterpolateDiscrete,
  )

  // -------- 透明度关键帧（线性插值） --------
  // 1 → 0 → 1，帧间平滑过渡
  const opacityKF = new THREE.NumberKeyframeTrack(
    '.material.opacity',
    [0, 1, 2],
    [1, 0, 1],
  )

  // 把三条 track 装进一个 AnimationClip，时长 3 秒
  const clip = new THREE.AnimationClip('cubeAnimation', 3, [
    quaternionKF,
    colorKF,
    opacityKF,
  ])

  return clip
}

/* ========== 3. 创建立方体网格 ========== */

function createCubeGrid(
  scene: THREE.Scene,
  animationGroup: THREE.AnimationObjectGroup,
) {
  // 5x5x5 立方体，几何 + 共享材质（节省内存）
  // material.transparent = true 允许 opacity 关键帧生效
  const geometry = new THREE.BoxGeometry(5, 5, 5)
  const material = new THREE.MeshBasicMaterial({ transparent: true })

  const cubes: THREE.Mesh[] = []

  // 5x5 网格，间隔 16，铺开 64x64 的区域
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.x = 32 - (16 * i)   // x: 32, 16, 0, -16, -32
      mesh.position.y = 0
      mesh.position.z = 32 - (16 * j)   // z: 32, 16, 0, -16, -32
      // 同时挂到两个地方：scene 负责渲染，animationGroup 负责共享动画状态
      scene.add(mesh)
      animationGroup.add(mesh)
      cubes.push(mesh)
    }
  }

  return cubes
}

/* ========== 4. AnimationMixer 播放模型动画 ========== */

/**
 * AnimationMixer — 播放模型自带的动画
 *
 * 使用步骤：
 * 1. 创建 mixer：new THREE.AnimationMixer(model)
 * 2. 获取 clip：gltf.animations[0]
 * 3. 创建 action：mixer.clipAction(clip)
 * 4. 播放：action.play()
 * 5. 每帧更新：mixer.update(delta)
 */
async function loadAnimatedModel(
  scene: THREE.Scene,
): Promise<{ mixer: THREE.AnimationMixer | null; model: THREE.Object3D | null }> {
  const loader = new GLTFLoader()

  try {
    // loadAsync 返回 Promise，比 load(url, onSuccess) 写法更现代
    const gltf = await loader.loadAsync('/models/watch/diegoWatchAnimation4.gltf')
    const model = gltf.scene

    // 1. 自动缩放：把最大维归一到 10（与立方体矩阵尺度匹配）
    const box = new THREE.Box3().setFromObject(model)
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    model.scale.setScalar(10 / maxDim)

    // 2. 居中：缩放后重新算包围盒，把中心平移到原点，再抬 0.5 离地
    const newBox = new THREE.Box3().setFromObject(model)
    model.position.sub(newBox.getCenter(new THREE.Vector3()))
    model.position.y += 0.5

    // 3. 遍历每个 Mesh：阴影 + 升级为铬镜面
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true     // 投射阴影
        child.receiveShadow = true  // 接收阴影

        // 一个 Mesh 可能有多个材质（数组），需分别处理
        const mat = child.material
        if (Array.isArray(mat)) {
          mat.forEach((m) => applyChrome(m))
        } else if (mat) {
          applyChrome(mat)
        }
      }
    })

    /**
     * 把任意材质升级为铬镜面：
     * - 金属度 0.8（保留贴图色彩，不会全黑）
     * - 粗糙度 0.2（轻微漫反射，镜面反射仍占主导）
     * - envMapIntensity 1.5（让环境反射更亮）
     * - 保留原 color/normal 等贴图
     */
    function applyChrome(m: THREE.Material): void {
      if (m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshPhysicalMaterial) {
        m.metalness = 1
        m.roughness = 0.2
        m.envMapIntensity = 1.5
        m.needsUpdate = true  // 告诉 Three.js 材质参数已变，重新编译 shader
      }
    }

    scene.add(model)

    // 4. 创建动画混合器并默认播放第一段
    if (gltf.animations.length > 0) {
      const mixer = new THREE.AnimationMixer(model)

      console.log(`发现 ${gltf.animations.length} 个动画：`)
      gltf.animations.forEach((clip, i) => {
        console.log(`   ${i + 1}. ${clip.name} (${clip.duration.toFixed(2)}s)`)
      })

      // clipAction 把 AnimationClip 包装成可播放的 action
      const action = mixer.clipAction(gltf.animations[0])
      action.setLoop(THREE.LoopRepeat, Infinity)  // 循环播放
      action.play()

      return { mixer, model }
    }

    return { mixer: null, model }
  } catch (err) {
    // 加载失败时不让整个页面挂掉，仅打印警告
    console.warn('模型加载失败（跳过动画演示）：', err)
    return { mixer: null, model: null }
  }
}

/* ========== 5. 初始化场景 ========== */

/**
 * 初始化场景
 *
 * 场景图结构：
 * scene (根节点)
 * ├── ambientLight                (环境光)
 * ├── keyLight + fillLight        (主光 + 补光)
 * ├── gsapGroup                   (由 25 个立方体组成，GSAP 整体操控)
 * │   └── cube × 25               (5x5 网格，同时挂在 animationGroup 共享动画)
 * └── watchModel                  (GLTF 加载的手表模型，自带 mixer)
 *
 * 动画状态：
 * - mixer 驱动 animationGroup（25 个立方体同步旋转/变色/变透明）
 * - modelMixer 驱动 watchModel（手表的骨骼动画）
 *
 * @returns 无；启动渲染循环
 */
async function init() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement

  const manager = new SceneManager({
    canvas,
    bgColor: '#111111',
    fov: 40,
  })

  // 环境贴图（铬镜面需要环境反射才能看起来"亮"）
  // RoomEnvironment 是一个程序化生成的简易 HDR 环境，
  // 通过 PMREMGenerator 预处理后作为 scene.environment，
  // 所有 PBR 材质的金属反射都会采样它
  const pmrem = new THREE.PMREMGenerator(manager.renderer)
  // 第二个参数 0.04：环境场景的「sigma」模糊度，越大越糊
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 1000).texture
  pmrem.dispose()                            // 释放生成器（结果 texture 仍由 scene.environment 持有）
  manager.scene.environment = envTexture     // 所有 PBR 材质自动采样此环境

  // 相机：从右上前方看向原点
  manager.camera.position.set(50, 50, 100)
  manager.camera.lookAt(0, 0, 0)

  // OrbitControls：阻尼让旋转更顺滑
  const controls = new OrbitControls(manager.camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.05

  /* ========== 灯光 ========== */
  // 环境光：均匀照亮手表
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
  manager.scene.add(ambientLight)

  // 主方向光：模拟太阳，提供主光照和阴影
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2)
  keyLight.position.set(30, 50, 40)          // 光源位置
  keyLight.castShadow = true                  // 投射阴影
  keyLight.shadow.mapSize.width = 2048        // 阴影贴图分辨率
  keyLight.shadow.mapSize.height = 2048
  manager.scene.add(keyLight)

  // 补光：从对侧打弱光，避免背光面纯黑
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.4)
  fillLight.position.set(-30, 20, -20)
  manager.scene.add(fillLight)

  /* ========== 创建动画组 ========== */
  // AnimationObjectGroup — 所有加入的对象共享同一个动画状态
  const animationGroup = new THREE.AnimationObjectGroup()

  /* ========== 创建立方体网格 ========== */
  // 25 个立方体同时挂到 scene（渲染）和 animationGroup（共享动画）
  const cubes = createCubeGrid(manager.scene, animationGroup)

  /* ========== 创建 KeyframeTrack 动画 ========== */
  const clip = createKeyframeAnimation()
  // mixer 绑定到 group 而不是单个 mesh，因此 25 个立方体同步播放
  const mixer = new THREE.AnimationMixer(animationGroup)
  const clipAction = mixer.clipAction(clip)
  clipAction.play()

  /* ========== GSAP 动画组（用于整体控制） ========== */
  // GSAP 是直接对 Object3D 属性插值，所以新建一个 group 把 25 个 cube 再包一层
  // 这样 GSAP.to(group) 整体旋转 / 缩放 / 移动，立方体跟随
  const gsapGroup = new THREE.Group()
  cubes.forEach(cube => gsapGroup.add(cube))
  manager.scene.add(gsapGroup)

  /* ========== 加载带动画的模型 ========== */
  // 解构出 mixer 和 model 引用（model 用于显示模式切换）
  const { mixer: modelMixer, model: watchModel } = await loadAnimatedModel(manager.scene)

  /* ========== 显示模式 ========== */
  // 'cubes'  : 仅显示立方体
  // 'watch'  : 仅显示手表
  // 'both'   : 两者同时显示
  type DisplayMode = 'cubes' | 'watch' | 'both'
  let displayMode: DisplayMode = 'both'

  function applyDisplayMode() {
    const showCubes = displayMode === 'cubes' || displayMode === 'both'
    const showWatch = displayMode === 'watch' || displayMode === 'both'
    gsapGroup.visible = showCubes
    if (watchModel) watchModel.visible = showWatch
  }

  /* ========== GSAP 动画状态 ========== */
  // 保存当前播放的 GSAP 动画，切模式时 kill 掉避免叠加
  let currentGsapAnim: gsap.core.Tween | gsap.core.Timeline | null = null

  function killCurrentGsap() {
    if (currentGsapAnim) {
      currentGsapAnim.kill()
      currentGsapAnim = null
    }
    // 重置组状态，避免切换后残留变形
    gsapGroup.rotation.set(0, 0, 0)
    gsapGroup.scale.set(1, 1, 1)
    gsapGroup.position.set(0, 0, 0)
  }

  /* ========== 控制面板 ========== */
  const panel = new ControlPanel()

  // -------- 1. 显示内容切换 --------
  panel.addSelect({
    id: 'display-mode',
    label: '显示内容',
    type: 'select',
    options: [
      { value: 'cubes', label: '立方体矩阵' },
      { value: 'watch', label: '手表模型' },
      { value: 'both',  label: '两者同时显示' },
    ],
    defaultValue: 'both',
    onChange: (value) => {
      displayMode = value as DisplayMode
      applyDisplayMode()
    },
  })

  // -------- 2. GSAP 动画模式 --------
  panel.addSelect({
    id: 'gsap-mode',
    label: 'GSAP 动画模式',
    type: 'select',
    options: [
      { value: 'none',     label: '无动画' },
      { value: 'to',       label: 'gsap.to() — 旋转' },
      { value: 'from',     label: 'gsap.from() — 弹性入场' },
      { value: 'timeline', label: 'gsap.timeline() — 时间线' },
    ],
    defaultValue: 'none',
    onChange: (value) => {
      killCurrentGsap()
      switch (value) {
        case 'to':
          currentGsapAnim = demoGsapTo(gsapGroup) ?? null
          break
        case 'from':
          currentGsapAnim = demoGsapFrom(gsapGroup) ?? null
          break
        case 'timeline':
          currentGsapAnim = demoGsapTimeline(gsapGroup) ?? null
          break
      }
    },
  })

  // -------- 3. KeyframeTrack 播放控制 --------
  panel.addCheckbox({
    id: 'kf-play',
    label: 'KeyframeTrack 播放',
    type: 'checkbox',
    defaultValue: true,
    onChange: (checked) => {
      // paused = true 时 mixer 不再推进，但保留时间位置
      clipAction.paused = !checked
    },
  })

  // -------- 4. KeyframeTrack 速度控制 --------
  panel.addSlider({
    id: 'anim-speed',
    label: '动画速度',
    type: 'slider',
    min: 0.1,    // 0 没用，会原地停；给 0.1 留点余地
    max: 3,
    step: 0.1,
    defaultValue: 1,
    onChange: (value) => {
      // mixer.timeScale 影响 25 个立方体的同步动画
      mixer.timeScale = value
    },
  })

  // -------- 5. 手表模型动画控制 --------
  // modelMixer 为 null 时（模型加载失败）跳过，避免报错
  if (modelMixer) {
    panel.addCheckbox({
      id: 'model-anim',
      label: '手表动画播放',
      type: 'checkbox',
      defaultValue: true,
      onChange: (checked) => {
        // timeScale = 0 等价于暂停，且不会丢时间位置
        modelMixer.timeScale = checked ? 1 : 0
      },
    })
  }

  // 应用初始显示模式（默认 both）
  applyDisplayMode()

  /* ========== 动画循环 ========== */
  // 每一帧：推进 controls 阻尼、两个 mixer（KeyframeTrack + 手表骨骼）
  manager.onUpdate((delta) => {
    controls.update()

    // 25 个立方体共享的 KeyframeTrack 动画
    mixer.update(delta)

    // 手表骨骼动画（仅当模型加载成功）
    if (modelMixer) {
      modelMixer.update(delta)
    }
  })

  // 启动渲染循环
  manager.start()

  console.log('=== 第 9 课：动画系统 ===')
  console.log('')
  console.log('核心概念：')
  console.log('  - AnimationObjectGroup：多个对象共享动画状态')
  console.log('  - QuaternionKeyframeTrack：旋转关键帧')
  console.log('  - ColorKeyframeTrack：颜色关键帧（离散插值）')
  console.log('  - NumberKeyframeTrack：透明度关键帧')
  console.log('')
  console.log('交互控制：')
  console.log('  - 切换 GSAP 动画模式')
  console.log('  - 开关 KeyframeTrack 动画')
  console.log('  - 调整动画速度')
  console.log('  - 开关手表模型动画')
  console.log('')
  console.log('观察要点：')
  console.log('  - 25 个立方体同步旋转、变色、变透明')
  console.log('  - 颜色是离散插值（瞬间切换），透明度是线性插值（平滑过渡）')
  console.log('  - GSAP 和 KeyframeTrack 可以同时生效')
}

init().catch((err) => {
  console.error('初始化失败：', err)
})
