/**
 * 第 5 课：相机与控制
 *
 * 学习目标：
 * 1. 区分透视相机（PerspectiveCamera）和正交相机（OrthographicCamera）
 * 2. 掌握 OrbitControls 轨道控制器的配置
 * 3. 理解相机参数（fov、aspect、near、far）的含义和影响
 * 4. 学会相机切换和参数调整
 *
 * 核心概念：
 * - 透视相机：近大远小，模拟人眼，适合 3D 场景
 * - 正交相机：远近一样大，无透视，适合 2D/CAD
 * - 视锥体（Frustum）：相机能看到的空间范围
 * - 裁剪面（Near/Far）：超出范围的物体不显示
 */

import * as THREE from 'three'
import { SceneManager } from '@/core/SceneManager'
import { ControlPanel } from '@/core/ControlPanel'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

/**
 * 初始化场景
 *
 * 整体结构：
 * 1. 创建透视相机 + OrbitControls
 * 2. 创建场景物体（猴头模型、球体、地面）
 * 3. 创建正交相机
 * 4. 控制面板（切换相机、调整参数）
 * 5. 窗口自适应
 * 6. 动画循环
 */
function init() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement

  const manager = new SceneManager({
    canvas,
    bgColor: '#1a1a2e',
    fov: 50,
  })

  /**
   * 保存透视相机引用
   *
   * manager.camera 会被 setCamera() 修改，所以需要单独保存引用
   * 后续切换相机时需要同时操作两个相机对象
   */
  const perspectiveCamera = manager.camera as THREE.PerspectiveCamera
  perspectiveCamera.position.set(5, 5, 10)
  perspectiveCamera.lookAt(0, 0, 0)

  /**
   * OrbitControls — 轨道控制器
   *
   * 让用户可以用鼠标拖拽旋转、缩放、平移视角
   *
   * 常用属性：
   *   enableDamping   — 启用阻尼（惯性），让旋转更平滑
   *   dampingFactor   — 阻尼系数（0~1），越小惯性越大
   *   target          — 控制器的焦点位置（相机围绕这个点旋转）
   *   enableZoom      — 是否允许缩放（默认 true）
   *   enableRotate    — 是否允许旋转（默认 true）
   *   enablePan       — 是否允许平移（默认 true）
   */
  const controls = new OrbitControls(perspectiveCamera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.target.set(0, 0, 0)
  controls.enableZoom = true    // 允许缩放（滚轮）
  controls.enableRotate = true  // 允许旋转（左键拖拽）
  controls.enablePan = true     // 允许平移（右键拖拽）

  // ========== 1. 创建场景物体 ==========

  /**
   * GLTFLoader — 加载 GLTF/GLB 模型
   *
   * GLTFLoader.load(url, onLoad, onProgress, onError)
   *   url    — 模型文件路径（相对于 public 目录）
   *   onLoad — 加载完成回调，参数是 GLTF 对象
   */
  const gltfLoader = new GLTFLoader()
  gltfLoader.load('/models/suzanne.glb', (gltf) => {
    const monkeyModel = gltf.scene
    monkeyModel.scale.set(0.8, 0.8, 0.8)
    monkeyModel.position.set(0, 1, 0)

    // 遍历模型，给所有 Mesh 添加材质
    monkeyModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: 0x4488ff,
          roughness: 0.6,
          metalness: 0.2,
        })
      }
    })
    manager.scene.add(monkeyModel)
  })

  // 地面：深色平面，旋转到水平
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.9 })
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.5
  manager.scene.add(ground)

  /**
   * 两个相同大小的球体，一个近一个远
   * 用来直观对比透视相机和正交相机的区别：
   *   透视相机：近处球体看起来更大
   *   正交相机：两个球体一样大
   */
  const sphereGeo = new THREE.SphereGeometry(0.5, 32, 16)
  const sphereMat = new THREE.MeshStandardMaterial({ color: 0x4488ff, roughness: 0.3, metalness: 0.5 })

  // 近处球体（z = -2）
  const nearSphere = new THREE.Mesh(sphereGeo, sphereMat)
  nearSphere.position.set(-3, 0.5, -2)
  manager.scene.add(nearSphere)

  // 远处球体（z = -8）
  const farSphere = new THREE.Mesh(sphereGeo, sphereMat)
  farSphere.position.set(-3, 0.5, -8)
  manager.scene.add(farSphere)

  /**
   * GridHelper — 网格辅助线
   *
   * GridHelper(size, divisions, colorCenterLine, colorGrid)
   *   size      — 网格总大小
   *   divisions — 分段数（格子数量）
   */
  const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x333333)
  gridHelper.position.y = -0.49  // 略高于地面，避免闪烁（z-fighting）
  manager.scene.add(gridHelper)

  /**
   * AxesHelper — 坐标轴辅助
   *
   * 显示 XYZ 三轴：X 红色、Y 绿色、Z 蓝色
   */
  const axesHelper = new THREE.AxesHelper(8)
  manager.scene.add(axesHelper)

  /**
   * 坐标轴标签（Sprite 文字）
   *
   * 在每个轴的末端添加 X/Y/Z 标签，方便识别
   */
  function createAxisLabel(text: string, position: THREE.Vector3, color: string): THREE.Sprite {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = color
    ctx.font = 'bold 48px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 32, 32)
    const texture = new THREE.CanvasTexture(canvas)
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }))
    sprite.position.copy(position)
    sprite.scale.set(0.8, 0.8, 1)
    return sprite
  }
  manager.scene.add(createAxisLabel('X', new THREE.Vector3(8.5, 0, 0), '#ff0000'))
  manager.scene.add(createAxisLabel('Y', new THREE.Vector3(0, 8.5, 0), '#00ff00'))
  manager.scene.add(createAxisLabel('Z', new THREE.Vector3(0, 0, 8.5), '#0000ff'))

  // ========== 2. 灯光 ==========

  // 环境光：全局均匀照明
  manager.scene.add(new THREE.AmbientLight(0xffffff, 0.4))

  // 主方向光：从右上方照射
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(5, 8, 5)
  manager.scene.add(directionalLight)

  // 补充方向光：从左下方补光，减少暗部
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3)
  fillLight.position.set(-5, 3, -5)
  manager.scene.add(fillLight)

  // ========== 3. 创建正交相机 ==========

  /**
   * OrthographicCamera — 正交相机
   *
   * 正交相机没有透视效果（远近一样大），适合：
   *   - 2D 游戏
   *   - 工程制图 / CAD
   *   - 策略游戏俯视角
   *
   * OrthographicCamera(left, right, top, bottom, near, far)
   *   left/right — 可视范围的左右边界
   *   top/bottom — 可视范围的上下边界
   *   near/far   — 近/远裁剪面
   *
   * 注意：需要保持宽高比与屏幕一致，否则物体会被拉伸变形
   */
  const aspect = window.innerWidth / window.innerHeight
  const frustumSize = 10  // 可视范围的高度（单位）

  const orthographicCamera = new THREE.OrthographicCamera(
    -frustumSize * aspect / 2,  // left
    frustumSize * aspect / 2,   // right
    frustumSize / 2,            // top
    -frustumSize / 2,           // bottom
    0.1,                        // near
    100                         // far
  )
  orthographicCamera.position.set(5, 5, 10)
  orthographicCamera.lookAt(0, 0, 0)

  /**
   * CameraHelper — 相机辅助可视化
   *
   * 显示相机的视锥体（frustum）：
   *   - 近裁剪面（小矩形）
   *   - 远裁剪面（大矩形）
   *   - 连接线（表示视锥范围）
   *
   * 透视相机 Helper 是锥体（金字塔形）
   * 正交相机 Helper 是长方体（盒子形）
   */
  const perspectiveHelper = new THREE.CameraHelper(perspectiveCamera)
  manager.scene.add(perspectiveHelper)

  const orthographicHelper = new THREE.CameraHelper(orthographicCamera)
  manager.scene.add(orthographicHelper)
  orthographicHelper.visible = false  // 默认隐藏正交相机 Helper

  // ========== 4. 控制面板 ==========

  const panel = new ControlPanel()

  // 相机参数默认值（切换时重置用）
  const defaultPerspective = { fov: 50, near: 0.1, far: 100 }
  const defaultOrthographic = { frustumSize: 10, near: 0.1, far: 100 }

  let cameraType = 'perspective'

  /**
   * 更新正交相机视锥体
   *
   * @param size — 可视范围的高度（单位）
   *
   * 正交相机的 left/right 需要根据宽高比计算，否则画面会变形
   */
  function updateOrthographicFrustum(size: number) {
    const a = window.innerWidth / window.innerHeight
    orthographicCamera.left = -size * a / 2
    orthographicCamera.right = size * a / 2
    orthographicCamera.top = size / 2
    orthographicCamera.bottom = -size / 2
    orthographicCamera.updateProjectionMatrix()
  }

  /**
   * 同步控制面板滑块显示（不触发 onChange）
   *
   * 切换相机时需要更新滑块的值和标签，但不触发 onChange 回调
   * 否则会重复设置相机参数
   */
  function syncSliders(params: { main: number, near: number, far: number }) {
    const mainSlider = document.querySelector('#control-fov-or-size') as HTMLInputElement
    const nearSlider = document.querySelector('#control-near') as HTMLInputElement
    const farSlider = document.querySelector('#control-far') as HTMLInputElement

    if (mainSlider) {
      mainSlider.value = String(params.main)
      mainSlider.parentElement?.querySelector('.value')?.replaceChildren(String(params.main))
    }
    if (nearSlider) {
      nearSlider.value = String(params.near)
      nearSlider.parentElement?.querySelector('.value')?.replaceChildren(params.near.toFixed(2))
    }
    if (farSlider) {
      farSlider.value = String(params.far)
      farSlider.parentElement?.querySelector('.value')?.replaceChildren(String(params.far))
    }

    // 更新 FOV/可视范围滑块的标签
    const mainLabel = document.querySelector('#control-fov-or-size')?.parentElement?.querySelector('label')
    if (mainLabel) {
      mainLabel.textContent = cameraType === 'perspective' ? 'FOV：' : '可视范围：'
    }
  }

  /**
   * 切换相机类型 — 重置场景到干净状态
   *
   * 切换时会：
   *   1. 重置两个相机的参数为默认值
   *   2. 切换当前使用的相机
   *   3. 更新 CameraHelper
   *   4. 同步控制面板滑块
   *   5. 重置 OrbitControls
   */
  function switchCamera(type: string) {
    cameraType = type

    // 重置透视相机参数为默认值
    perspectiveCamera.fov = defaultPerspective.fov
    perspectiveCamera.near = defaultPerspective.near
    perspectiveCamera.far = defaultPerspective.far
    perspectiveCamera.position.set(5, 5, 10)
    perspectiveCamera.updateProjectionMatrix()

    // 重置正交相机参数为默认值
    orthographicCamera.near = defaultOrthographic.near
    orthographicCamera.far = defaultOrthographic.far
    orthographicCamera.position.set(5, 5, 10)
    updateOrthographicFrustum(defaultOrthographic.frustumSize)

    // 切换当前使用的相机
    if (type === 'perspective') {
      manager.setCamera(perspectiveCamera)
      perspectiveHelper.visible = true
      orthographicHelper.visible = false
      controls.object = perspectiveCamera
      syncSliders({ main: defaultPerspective.fov, near: defaultPerspective.near, far: defaultPerspective.far })
    } else {
      manager.setCamera(orthographicCamera)
      perspectiveHelper.visible = false
      orthographicHelper.visible = true
      ;(controls as any).object = orthographicCamera
      syncSliders({ main: defaultOrthographic.frustumSize * 5, near: defaultOrthographic.near, far: defaultOrthographic.far })
    }

    // 重置控制器
    controls.target.set(0, 0, 0)
    controls.update()
    perspectiveHelper.update()
    orthographicHelper.update()

    console.log(`切换到${type === 'perspective' ? '透视' : '正交'}相机，参数已重置`)
  }

  // ========== 5. 控制面板控件 ==========

  // 相机类型选择
  panel.addSelect({
    id: 'camera-type',
    label: '相机类型：',
    type: 'select',
    options: [
      { value: 'perspective', label: '透视相机 (Perspective)' },
      { value: 'orthographic', label: '正交相机 (Orthographic)' },
    ],
    defaultValue: 'perspective',
    onChange: (value) => switchCamera(value),
  })

  /**
   * FOV / 可视范围滑块
   *
   * 透视相机：调整 FOV（Field of View，视场角）
   *   FOV 越大，视野越广，但透视变形越严重
   *   FOV 越小，视野越窄，像望远镜
   *
   * 正交相机：调整 frustumSize（可视范围高度）
   *   数值越大，能看到的范围越大，物体看起来越小
   *   数值越小，范围越小，物体看起来越大
   */
  panel.addSlider({
    id: 'fov-or-size',
    label: 'FOV/可视范围：',
    type: 'slider',
    min: 30,
    max: 120,
    step: 1,
    defaultValue: 50,
    onChange: (value) => {
      if (cameraType === 'perspective') {
        perspectiveCamera.fov = value
        console.log(value)
        perspectiveCamera.updateProjectionMatrix()
      } else {
        updateOrthographicFrustum(value / 5)
      }
      perspectiveHelper.update()
      orthographicHelper.update()
    },
  })

  /**
   * Near / Far 滑块
   *
   * Near — 近裁剪面：比这更近的物体不显示
   *   太大 → 近处物体被裁掉
   *   太小 → 深度精度下降（远处物体闪烁）
   *
   * Far — 远裁剪面：比这更远的物体不显示
   *   太小 → 远处物体被裁掉
   *   太大 → 深度精度下降
   *
   * 最佳实践：Near/Far 比值不要超过 1000:1
   */
  panel.addSlider({
    id: 'near',
    label: 'Near：',
    type: 'slider',
    min: 0.01,
    max: 10,
    step: 0.01,
    defaultValue: 0.1,
    onChange: (value) => {
      if (cameraType === 'perspective') {
        perspectiveCamera.near = value
        perspectiveCamera.updateProjectionMatrix()
      } else {
        orthographicCamera.near = value
        orthographicCamera.updateProjectionMatrix()
      }
      perspectiveHelper.update()
      orthographicHelper.update()
    },
  })

  panel.addSlider({
    id: 'far',
    label: 'Far：',
    type: 'slider',
    min: 10,
    max: 200,
    step: 1,
    defaultValue: 100,
    onChange: (value) => {
      if (cameraType === 'perspective') {
        perspectiveCamera.far = value
        perspectiveCamera.updateProjectionMatrix()
      } else {
        orthographicCamera.far = value
        orthographicCamera.updateProjectionMatrix()
      }
      perspectiveHelper.update()
      orthographicHelper.update()
    },
  })

  // 重置视角按钮：恢复相机到初始位置
  panel.addButton({
    id: 'reset-view',
    label: '重置视角',
    type: 'button',
    onClick: () => {
      perspectiveCamera.position.set(5, 5, 10)
      orthographicCamera.position.set(5, 5, 10)
      controls.target.set(0, 0, 0)
      controls.update()
    },
  })

  // 显示/隐藏 Helper：控制相机 Helper、网格、坐标轴的可见性
  panel.addCheckbox({
    id: 'show-helper',
    label: '显示相机 Helper',
    type: 'checkbox',
    defaultValue: true,
    onChange: (checked) => {
      perspectiveHelper.visible = checked && cameraType === 'perspective'
      orthographicHelper.visible = checked && cameraType === 'orthographic'
      gridHelper.visible = checked
      axesHelper.visible = checked
    },
  })

  // 初始化 Helper 可见性（defaultValue 不会触发 onChange）
  perspectiveHelper.visible = true
  orthographicHelper.visible = false

  // ========== 6. 窗口自适应 ==========

  /**
   * 窗口大小变化时，必须同步更新相机的 aspect（宽高比）
   * 否则画面会被拉伸变形
   */
  window.addEventListener('resize', () => {
    const a = window.innerWidth / window.innerHeight

    // 透视相机：更新 aspect
    perspectiveCamera.aspect = a
    perspectiveCamera.updateProjectionMatrix()

    // 正交相机：更新 left/right（保持宽高比）
    const currentTop = orthographicCamera.top
    updateOrthographicFrustum(currentTop * 2)

    perspectiveHelper.update()
      orthographicHelper.update()
  })

  // ========== 动画循环 ==========

  manager.onUpdate((delta) => {
    // 更新 OrbitControls（必须每帧调用，否则阻尼不生效）
    controls.update()

    // 更新相机 Helper（当相机位置/参数变化时）
    perspectiveHelper.update()
    orthographicHelper.update()

    // 两个球体缓慢旋转，方便观察透视/正交的区别
    nearSphere.rotation.y += 0.5 * delta
    farSphere.rotation.y += 0.5 * delta
  })

  manager.start()

  // 控制台提示
  console.log('=== 第 5 课：相机与控制 ===')
  console.log('观察要点：')
  console.log('  - 透视相机：近大远小，有透视效果')
  console.log('  - 正交相机：远近一样大，无透视效果')
  console.log('  - 切换相机类型会重置所有参数为默认值')
  console.log('')
  console.log('尝试修改：')
  console.log('  - 切换相机类型，观察近处和远处球体的大小变化')
  console.log('  - 调整 FOV，观察视野范围变化')
  console.log('  - 调整 Near/Far，观察相机裁切范围变化')
  console.log('  - 鼠标拖拽旋转视角，滚轮缩放')
}

init()
