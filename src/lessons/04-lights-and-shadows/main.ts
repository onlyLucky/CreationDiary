/**
 * 第 4 课：灯光与阴影
 *
 * 学习目标：
 * 1. 掌握 5 种灯光类型及适用场景
 * 2. 理解阴影的三要素（光源、投射物、接收面）
 * 3. 学会调整阴影质量和性能的平衡
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
 * 1. 创建渲染器、相机、控制器
 * 2. 配置阴影系统
 * 3. 创建 5 种灯光并添加 Helper
 * 4. 创建几何体和地面
 * 5. 加载外部模型（GLTF）
 * 6. 动画循环
 */
function init() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement

  const manager = new SceneManager({
    canvas,
    bgColor: '#0a0a1a',
    fov: 50,
  })

  // 相机位置：从上方俯视场景
  manager.camera.position.set(0, 8, 15)
  manager.camera.lookAt(0, 0, 0)

  /**
   * OrbitControls — 轨道控制器
   * 让用户可以用鼠标拖拽旋转、缩放、平移视角
   *
   * @param camera — 控制的相机
   * @param domElement — 监听鼠标事件的 DOM 元素
   */
  const controls = new OrbitControls(manager.camera, canvas)
  controls.enableDamping = true   // 启用阻尼（惯性），让旋转更平滑
  controls.dampingFactor = 0.05   // 阻尼系数（0~1），越小惯性越大
  controls.target.set(0, 0, 0)    // 控制器的焦点位置（相机围绕这个点旋转）

  /**
   * 阴影配置
   *
   * 开启阴影需要三步：
   * 1. renderer.shadowMap.enabled = true — 渲染器开启阴影
   * 2. light.castShadow = true — 灯光投射阴影
   * 3. mesh.castShadow = true — 物体投射阴影
   * 4. mesh.receiveShadow = true — 物体接收阴影
   * 灯光.castShadow — 灯光"有没有能力"投射阴影
   * 物体.castShadow — 这个物体"会不会"挡住光产生阴影
   * 地面.receiveShadow — 这个物体"能不能"显示别人投来的阴影
   */
  manager.renderer.shadowMap.enabled = true

  /**
   * shadowMap.type — 阴影贴图类型
   *
   * BasicShadowMap    — 最快，质量最差（硬边锯齿）
   * PCFShadowMap      — 中等质量，软边但可能有锯齿
   * PCFSoftShadowMap  — 高质量，柔和软边（推荐）
   * VSMShadowMap      — 另一种柔和阴影，但有局限性
   */
  manager.renderer.shadowMap.type = THREE.PCFSoftShadowMap

  // ========== 1. 五种灯光对比 ==========

  // 辅助环境光：单独使用灯光时，确保场景不会全黑
  const helperAmbientLight = new THREE.AmbientLight(0xffffff, 0.1)
  manager.scene.add(helperAmbientLight)

  /**
   * 1a. AmbientLight — 环境光
   *
   * 最简单的灯光：全局均匀照亮所有物体，没有方向、没有阴影。
   * 常用于填充暗部，避免完全黑暗的区域。
   *
   * AmbientLight(color, intensity)
   *   color     — 灯光颜色，默认 0xffffff（白色）
   *   intensity — 灯光强度，默认 1
   */
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3)
  manager.scene.add(ambientLight)

  /**
   * 1b. HemisphereLight — 半球光
   *
   * 模拟自然环境光：天空颜色 + 地面颜色，从上下两个方向照射。
   * 比 AmbientLight 更有层次感，适合户外场景。
   *
   * HemisphereLight(skyColor, groundColor, intensity)
   *   skyColor    — 天空方向的颜色（上方），默认 0xffffff
   *   groundColor — 地面方向的颜色（下方），默认 0xffffff
   *   intensity   — 灯光强度，默认 1
   */
  const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x362907, 0.4)
  manager.scene.add(hemisphereLight)

  /**
   * 1c. DirectionalLight — 方向光（平行光）
   *
   * 模拟太阳光：所有光线平行，从一个方向照射整个场景。
   * 可以投射阴影，阴影是正交投影（没有近大远小）。
   *
   * DirectionalLight(color, intensity)
   *   color     — 灯光颜色，默认 0xffffff
   *   intensity — 灯光强度，默认 1
   *
   * 注意：position 决定光照方向（从 position 指向 target，默认原点）
   * 但距离不影响光照强度（与 PointLight 不同）
   */
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0)
  directionalLight.position.set(-5, 8, 5)
  directionalLight.castShadow = true

  /**
   * DirectionalLight 阴影配置
   *
   * shadow.mapSize — 阴影贴图分辨率（像素）
   *   越大越清晰，但越耗性能
   *   常见值：512（低）、1024（中）、2048（高）、4096（极高）
   *
   * shadow.camera — 阴影的正交相机（定义阴影可见范围）
   *   near/far   — 阴影的最近/最远距离
   *   left/right/top/bottom — 阴影的上下左右边界
   *
   * ⚠️ 重要：物体超出这个范围就不会有阴影！
   */
  directionalLight.shadow.mapSize.width = 2048
  directionalLight.shadow.mapSize.height = 2048
  directionalLight.shadow.camera.near = 0.5
  directionalLight.shadow.camera.far = 50
  directionalLight.shadow.camera.left = -10
  directionalLight.shadow.camera.right = 10
  directionalLight.shadow.camera.top = 10
  directionalLight.shadow.camera.bottom = -10
  manager.scene.add(directionalLight)

  const shadowCameraHelper = new THREE.CameraHelper(directionalLight.shadow.camera)
  // manager.scene.add(shadowCameraHelper)

  /**
   * 1d. PointLight — 点光源
   *
   * 从一个点向四面八方发光，像灯泡、蜡烛。
   * 距离越远越暗（遵循平方反比定律），可以投射阴影。
   *
   * PointLight(color, intensity, distance, decay)
   *   color     — 灯光颜色，默认 0xffffff
   *   intensity — 灯光强度，默认 1
   *   distance  — 灯光最远照射距离（0 = 无限远），默认 0
   *   decay     — 衰减方式（2 = 真实物理衰减），默认 2
   */
  const pointLight = new THREE.PointLight(0xff922b, 2, 15)
  pointLight.position.set(3, 4, 2)
  pointLight.castShadow = true
  manager.scene.add(pointLight)

  /**
   * 1e. SpotLight — 聚光灯
   *
   * 从一个点向一个方向发光，像手电筒、舞台灯。
   * 可以投射阴影，有锥形范围。
   *
   * SpotLight(color, intensity, distance, angle, penumbra, decay)
   *   color     — 灯光颜色，默认 0xffffff
   *   intensity — 灯光强度，默认 1
   *   distance  — 最远照射距离（0 = 无限远），默认 0
   *   angle     — 光锥角度（弧度），默认 Math.PI/3（60°）
   *   penumbra  — 边缘柔和度（0~1），0 = 硬边，1 = 完全柔和，默认 0
   *   decay     — 衰减方式，默认 2
   */
  const spotLight = new THREE.SpotLight(0xffff00, 20, 0, Math.PI / 6)
  spotLight.position.set(0, 8, 0)
  spotLight.castShadow = true
  manager.scene.add(spotLight)

  // 灯光对象映射
  const lights: Record<string, THREE.Light> = {
    ambient: ambientLight,
    hemisphere: hemisphereLight,
    directional: directionalLight,
    point: pointLight,
    spot: spotLight,
  }

  // 灯光 Helper 映射
  const helpers: Record<string, THREE.Object3D> = {}

  /**
   * DirectionalLightHelper — 方向光辅助可视化
   *
   * 显示方向光的位置和照射方向（用线段和矩形表示）
   *
   * DirectionalLightHelper(light, size)
   *   light — 要可视化的方向光
   *   size  — 辅助线的长度，默认 1
   */
  const directionalHelper = new THREE.DirectionalLightHelper(directionalLight, 1)
  helpers.directional = directionalHelper
  manager.scene.add(directionalHelper)

  /**
   * SpotLightHelper — 聚光灯辅助可视化
   *
   * 显示聚光灯的锥形范围和照射方向
   *
   * SpotLightHelper(light)
   *   light — 要可视化的聚光灯
   */
  const spotHelper = new THREE.SpotLightHelper(spotLight)
  helpers.spot = spotHelper
  manager.scene.add(spotHelper)

  /**
   * PointLightHelper — 点光源辅助可视化
   *
   * 显示点光源的位置和照射范围（用球体表示）
   *
   * PointLightHelper(light, sphereSize)
   *   light      — 要可视化的点光源
   *   sphereSize — 辅助球体的半径，默认 1
   */
  const pointHelper = new THREE.PointLightHelper(pointLight, 0.5)
  helpers.point = pointHelper
  manager.scene.add(pointHelper)

  // 灯光标签映射
  const lightLabels: Record<string, THREE.Sprite> = {}

  // 创建灯光标签
  function createLabel(text: string, position: THREE.Vector3): THREE.Sprite {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 24px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(text, 128, 40)

    const texture = new THREE.CanvasTexture(canvas)
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    })
    const sprite = new THREE.Sprite(material)
    sprite.position.copy(position)
    sprite.scale.set(2, 0.5, 1)
    return sprite
  }

  // 创建灯光标签
  const labelPositions: Record<string, THREE.Vector3> = {
    ambient: new THREE.Vector3(-5, 5, 0),
    hemisphere: new THREE.Vector3(-3, 5, 0),
    directional: new THREE.Vector3(-1, 5, 0),
    point: new THREE.Vector3(1, 5, 0),
    spot: new THREE.Vector3(3, 5, 0),
  }

  Object.entries(labelPositions).forEach(([key, pos]) => {
    const label = createLabel(key.charAt(0).toUpperCase() + key.slice(1), pos)
    lightLabels[key] = label
    manager.scene.add(label)
  })

  // 切换灯光显示
  function switchLight(type: string) {
    // 先隐藏所有灯光
    Object.values(lights).forEach((light) => {
      light.visible = false
    })
    Object.values(helpers).forEach((helper) => {
      helper.visible = false
    })
    Object.values(lightLabels).forEach((label) => {
      label.visible = false
    })

    if (type === 'all') {
      // 显示所有灯光
      Object.values(lights).forEach((light) => {
        light.visible = true
      })
      Object.values(helpers).forEach((helper) => {
        helper.visible = true
      })
      Object.values(lightLabels).forEach((label) => {
        label.visible = true
      })
      // 辅助环境光设为弱
      helperAmbientLight.intensity = 0.1
    } else {
      // 只显示选中的灯光
      if (lights[type]) {
        lights[type].visible = true
      }
      if (helpers[type]) {
        helpers[type].visible = true
      }
      if (lightLabels[type]) {
        lightLabels[type].visible = true
      }
      // 辅助环境光设为较强，确保场景可见
      helperAmbientLight.intensity = 0.3
    }
  }

  // 初始化：显示所有灯光
  switchLight('all')

  // 创建控制面板
  const panel = new ControlPanel()

  // 添加灯光选择控件
  panel.addSelect({
    id: 'light-type',
    label: '灯光类型：',
    type: 'select',
    options: [
      { value: 'all', label: '全部显示' },
      { value: 'ambient', label: '环境光 (Ambient)' },
      { value: 'hemisphere', label: '半球光 (Hemisphere)' },
      { value: 'directional', label: '方向光 (Directional)' },
      { value: 'point', label: '点光源 (Point)' },
      { value: 'spot', label: '聚光灯 (Spot)' },
    ],
    defaultValue: 'all',
    onChange: (value) => {
      switchLight(value)
      console.log('切换灯光:', value)
    },
  })

  // ========== 2. 几何体展示 ==========

  // 创建几何体（参数说明见第 2 课）
  const sphereGeo = new THREE.SphereGeometry(0.8, 32, 16)
  const boxGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2)
  const torusGeo = new THREE.TorusGeometry(0.6, 0.3, 16, 32)

  // PBR 材质：金属质感，便于观察灯光和阴影效果
  const material = new THREE.MeshStandardMaterial({
    color: 0x4488ff,
    roughness: 0.3,
    metalness: 0.5,
  })

  /**
   * 阴影三要素：castShadow 和 receiveShadow
   *
   * castShadow = true   — 这个物体会投射阴影
   * receiveShadow = true — 这个物体会接收阴影（显示其他物体投来的阴影）
   *
   * ⚠️ 两者都需要设置，缺一不可：
   *   - 灯光.castShadow = true（灯光投射阴影）
   *   - 物体.castShadow = true（物体投射阴影）
   *   - 地面.receiveShadow = true（地面接收阴影）
   */
  const sphere = new THREE.Mesh(sphereGeo, material)
  sphere.position.set(-3, 0.8, 0)
  sphere.castShadow = true  // 球体会投射阴影
  manager.scene.add(sphere)

  // 立方体
  const box = new THREE.Mesh(boxGeo, material)
  box.position.set(0, 0.6, 0)
  box.castShadow = true
  manager.scene.add(box)

  // 圆环
  const torus = new THREE.Mesh(torusGeo, material)
  torus.position.set(3, 0.8, 0)
  torus.castShadow = true
  manager.scene.add(torus)

  /**
   * GLTFLoader — 加载 GLTF/GLB 模型
   *
   * GLTF（GL Transmission Format）是 3D 模型的标准格式，支持：
   *   - 几何体（Mesh）
   *   - 材质（Material）
   *   - 纹理（Texture）
   *   - 动画（Animation）
   *   - 骨骼（Skeleton）
   *
   * 文件格式：
   *   .gltf — JSON 格式，可能伴随 .bin 和纹理文件
   *   .glb  — 二进制格式，所有数据打包成一个文件（推荐）
   *
   * GLTFLoader.load(url, onLoad, onProgress, onError)
   *   url       — 模型文件路径
   *   onLoad    — 加载完成回调，参数是 GLTF 对象
   *   onProgress — 加载进度回调（可选）
   *   onError   — 加载失败回调（可选）
   */
  const gltfLoader = new GLTFLoader()
  const modelUrl = '/models/suzanne.glb'

  gltfLoader.load(
    modelUrl,
    (gltf) => {
      /**
       * gltf 对象结构：
       *   gltf.scene     — 模型的根节点（THREE.Group），包含所有子网格
       *   gltf.scenes    — 所有场景数组（通常只有一个）
       *   gltf.cameras   — 模型自带的相机
       *   gltf.animations — 模型自带的动画
       *   gltf.asset     — 模型元数据（版本、生成器等）
       */
      const monkeyModel = gltf.scene
      monkeyModel.scale.set(0.8, 0.8, 0.8)
      monkeyModel.position.set(0, 3, 0)

      /**
       * traverse — 遍历模型的所有子节点
       *
       * 模型可能包含多个 Mesh、Group、Light 等节点，
       * 需要遍历才能找到所有 Mesh 并设置阴影和材质。
       *
       * child 参数是当前遍历到的节点（THREE.Object3D）
       */
      monkeyModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true
          child.receiveShadow = true

          /**
           * 给模型添加材质
           *
           * 这个模型没有自带材质（白模），需要手动添加。
           * 如果模型自带材质，这一步可以跳过。
           */
          child.material = new THREE.MeshStandardMaterial({
            color: 0x4488ff,
            roughness: 0.6,
            metalness: 0.2,
          })
        }
      })

      manager.scene.add(monkeyModel)
      console.log('猴头模型加载成功')
    },
    (progress) => {
      // progress.loaded — 已加载字节数
      // progress.total  — 总字节数（可能为 0，如果服务器没返回 Content-Length）
      console.log('模型加载进度:', (progress.loaded / progress.total * 100) + '%')
    },
    (error) => {
      console.error('模型加载失败:', error)

      // 降级方案：加载失败时显示一个简单球体
      const fallbackGeo = new THREE.SphereGeometry(0.8, 32, 16)
      const fallbackMat = new THREE.MeshStandardMaterial({
        color: 0x8B4513,
        roughness: 0.6,
        metalness: 0.2,
      })
      const fallback = new THREE.Mesh(fallbackGeo, fallbackMat)
      fallback.position.set(0, 3, 0)
      fallback.castShadow = true
      fallback.receiveShadow = true
      manager.scene.add(fallback)
      manager.registerDisposable(fallbackGeo)
      manager.registerDisposable(fallbackMat)
    }
  )

  // ========== 3. 地面 ==========

  const groundGeo = new THREE.PlaneGeometry(20, 20)

  // 外部纹理加载示例：地面纹理
  const textureLoader = new THREE.TextureLoader()
  textureLoader.load(
    '/textures/concrete-floor.jpg',
    (texture) => {
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(4, 4)

      const groundMat = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.9,
        metalness: 0,
      })
      const ground = new THREE.Mesh(groundGeo, groundMat)
      ground.rotation.x = -Math.PI / 2
      ground.position.y = -1
      ground.receiveShadow = true
      manager.scene.add(ground)
      manager.registerDisposable(groundMat)
    },
    undefined,
    (error) => {
      console.warn('加载地面纹理失败，使用默认颜色:', error)
      // 降级：使用默认颜色
      const groundMat = new THREE.MeshStandardMaterial({
        color: 0x222233,
        roughness: 0.9,
        metalness: 0,
      })
      const ground = new THREE.Mesh(groundGeo, groundMat)
      ground.rotation.x = -Math.PI / 2
      ground.position.y = -1
      ground.receiveShadow = true
      manager.scene.add(ground)
      manager.registerDisposable(groundMat)
    }
  )
  manager.registerDisposable(groundGeo)

  // ========== 动画循环 ==========

  manager.onUpdate((delta) => {
    // 几何体缓慢旋转
    sphere.rotation.y += 0.3 * delta
    box.rotation.y += 0.3 * delta
    torus.rotation.y += 0.3 * delta

    // 更新灯光 Helper
    if (helpers.directional instanceof THREE.DirectionalLightHelper) {
      helpers.directional.update()
    }
    if (helpers.spot instanceof THREE.SpotLightHelper) {
      helpers.spot.update()
    }
    if (helpers.point instanceof THREE.PointLightHelper) {
      helpers.point.update()
    }

    // 更新 OrbitControls
    controls.update()
  })

  /**
   * AxesHelper — 坐标轴辅助可视化
   *
   * 显示 XYZ 三轴：
   *   X 轴 = 红色
   *   Y 轴 = 绿色
   *   Z 轴 = 蓝色
   *
   * AxesHelper(size)
   *   size — 坐标轴的长度，默认 1
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
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    })
    const sprite = new THREE.Sprite(material)
    sprite.position.copy(position)
    sprite.scale.set(0.8, 0.8, 1)
    return sprite
  }

  // 在每个轴末端添加标签
  manager.scene.add(createAxisLabel('X', new THREE.Vector3(8.5, 0, 0), '#ff0000'))
  manager.scene.add(createAxisLabel('Y', new THREE.Vector3(0, 8.5, 0), '#00ff00'))
  manager.scene.add(createAxisLabel('Z', new THREE.Vector3(0, 0, 8.5), '#0000ff'))

  manager.start()

  // 控制台提示
  console.log('=== 第 4 课：灯光与阴影 ===')
  console.log('观察要点：')
  console.log('  - 5 种灯光：Ambient/Hemisphere/Directional/Point/Spot')
  console.log('  - 阴影三要素：光源.castShadow + 物体.castShadow + 地面.receiveShadow')
  console.log('  - 灯光 Helper：可视化灯光范围和方向')
  console.log('')
  console.log('尝试修改：')
  console.log('  - 调整 directionalLight.intensity，观察亮度变化')
  console.log('  - 调整 shadow.mapSize，观察阴影质量变化')
  console.log('  - 调整 spotLight.angle，观察聚光灯范围变化')
  console.log('  - 关闭 renderer.shadowMap.enabled，观察阴影消失')
}

init()
