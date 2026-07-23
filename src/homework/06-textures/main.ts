/**
 * 第 6 课课后作业：奢侈品手表展示
 *
 * 参考案例：https://watch.marplacode.com/ (Awwwards Honorable Mention)
 *
 * 考察因素（100分）：
 * - 环境贴图反射效果（25分）— 天空盒加载 + scene.environment 设置
 * - 材质参数调整（25分）— 金属质感增强（metalness/roughness）
 * - 光影氛围（20分）— 三点照明布局
 * - 交互体验（15分）— 控制面板调节旋转/浮动
 * - 视觉完成度（15分）— 镜面地面 + 整体构图
 *
 * 已有物料：
 * - 模型：/models/watch/diegoWatchAnimation4.gltf（模型非常小，需要根据包围盒自动缩放）
 * - 天空盒：/textures/skybox/ 下 6 张图片
 * - 手表纹理：/textures/watch/ 下的 ao 和 nor 贴图
 */

import * as THREE from 'three'
import { SceneManager } from '@/core/SceneManager'
import { ControlPanel } from '@/core/ControlPanel'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'

function init() {
  const canvas = document.getElementById('homework_canvas') as HTMLCanvasElement

  const manager = new SceneManager({
    canvas,
    bgColor: '#0a0a0a',
    fov: 45,
  })

  // 相机位置
  manager.camera.position.set(0, 0, 3)
  manager.camera.lookAt(0, 0, 0)

  /* ========== 1. 环境贴图加载（25分）==========
   *
   * HDRI 环境贴图：使用 RGBELoader 加载 .hdr 文件
   * 比 CubeTextureLoader 光照更真实，但文件较大
   */

  const rgbeLoader = new RGBELoader()
  rgbeLoader.load(
    '/textures/venice-sunset.hdr',
    (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping
      manager.scene.background = texture  // HDRI 背景
      manager.scene.environment = texture  // 环境光照，PBR 材质自动采样
      console.log('✅ HDRI 环境贴图加载成功')
    },
    undefined,
    (error) => console.warn('❌ HDRI 环境贴图加载失败:', error)
  )

  /* ========== 2. 灯光布局（20分）==========
   *
   * 三点照明：主光 + 补光 + 背光 + 环境光
   */

  const keyLight = new THREE.DirectionalLight(0xffffff, 2)
  keyLight.position.set(5, 10, 5)
  keyLight.castShadow = true
  manager.scene.add(keyLight)

  const fillLight = new THREE.DirectionalLight(0x8888ff, 0.5)
  fillLight.position.set(-5, 5, -5)
  manager.scene.add(fillLight)

  const backLight = new THREE.DirectionalLight(0xffffff, 1)
  backLight.position.set(0, 5, -10)
  manager.scene.add(backLight)

  manager.scene.add(new THREE.AmbientLight(0x222222))

  /* ========== 3. 加载手表模型（25分）==========
   *
   * 模型加载和自动缩放已写好，你需要完成：
   * TODO:（可选）调整材质参数增强金属质感
   *       遍历模型 mesh，设置 material.metalness=0.9, material.roughness=0.1
   */

  let watchModel: THREE.Group | null = null
  let watchBaseY = 0
  const gltfLoader = new GLTFLoader()

  gltfLoader.load(
    '/models/watch/diegoWatchAnimation4.gltf',
    (gltf) => {
      watchModel = gltf.scene

      /* 自动缩放：根据包围盒计算合适的大小 */
      const box = new THREE.Box3().setFromObject(watchModel)
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)

      // 调整目标大小：1 个单位（适中大小）
      const targetSize = 1.5
      watchModel.scale.setScalar(targetSize / maxDim)

      /* 居中到原点 */
      const box2 = new THREE.Box3().setFromObject(watchModel)
      const center = box2.getCenter(new THREE.Vector3())

      // 水平居中（X 和 Z 轴居中）
      watchModel.position.x = -center.x
      watchModel.position.z = -center.z

      // 垂直居中：模型中心在 y=0 位置
      watchModel.position.y = -center.y

      watchBaseY = watchModel.position.y

      /* 设置阴影 */
      watchModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true
          child.receiveShadow = true
        }
      })

      manager.scene.add(watchModel)
      console.log('✅ 模型加载完成，已居中展示')
    },
    (progress) => {
      const percent = (progress.loaded / progress.total * 100).toFixed(0)
      console.log(`加载进度: ${percent}%`)
    },
    (error) => console.error('❌ 模型加载失败:', error)
  )

  /* ========== 4. 镜面地面（15分）==========
   *
   * 镜面反射地面：roughness 极低（接近镜面），metalness 极高（反射环境）
   */

  const groundGeo = new THREE.PlaneGeometry(20, 20)
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.05,   // 接近镜面
    metalness: 0.98,   // 高金属度，反射环境贴图
  })
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.01
  ground.receiveShadow = true
  // manager.scene.add(ground)

  /* ========== 5. 控制面板（15分）==========
   *
   * 控制面板：调节旋转速度、浮动幅度、自动旋转开关
   */

  const panel = new ControlPanel()
  let rotationSpeed = 0.3
  let floatAmplitude = 0.3
  let autoRotate = true

  // 旋转速度滑块
  panel.addSlider({
    id: 'rotation-speed',
    label: '旋转速度',
    type: 'slider',
    min: 0,
    max: 2,
    step: 0.1,
    defaultValue: 0.3,
    onChange: (value) => { rotationSpeed = value },
  })

  // 浮动幅度滑块
  panel.addSlider({
    id: 'float-amplitude',
    label: '浮动幅度',
    type: 'slider',
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: 0.3,
    onChange: (value) => { floatAmplitude = value },
  })

  // 自动旋转开关
  panel.addCheckbox({
    id: 'auto-rotate',
    label: '自动旋转',
    type: 'checkbox',
    defaultValue: true,
    onChange: (checked) => { autoRotate = checked },
  })

  /* ========== 6. 动画循环 ==========
   *
   * 动画效果：自动旋转 + sin 函数浮动（平滑动画）
   */

  const clock = new THREE.Clock()

  manager.onUpdate(() => {
    const elapsed = clock.getElapsedTime()
    /* if (watchModel) {
      // 自动旋转（平滑旋转）
      if (autoRotate) {
        watchModel.rotation.y += rotationSpeed * 0.01
      }
      // 浮动效果：使用 sin 函数实现上下浮动
      // elapsed * 0.8 控制浮动频率，floatAmplitude 控制浮动幅度
      watchModel.position.y = watchBaseY + Math.sin(elapsed * 0.8) * floatAmplitude
    } */
  })

  manager.start()
}

init()
