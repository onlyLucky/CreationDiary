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
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

/** 初始化场景 */
function init() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement

  const manager = new SceneManager({
    canvas,
    bgColor: '#0a0a1a',
    fov: 50,
  })

  // 相机位置
  manager.camera.position.set(0, 8, 15)
  manager.camera.lookAt(0, 0, 0)

  // 添加 OrbitControls（鼠标拖拽旋转视角）
  const controls = new OrbitControls(manager.camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.target.set(0, 0, 0)

  // 开启阴影
  manager.renderer.shadowMap.enabled = true
  manager.renderer.shadowMap.type = THREE.PCFSoftShadowMap

  // ========== 1. 五种灯光对比 ==========

  // 1a. AmbientLight — 环境光（全局均匀照明）
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3)
  manager.scene.add(ambientLight)

  // 1b. HemisphereLight — 半球光（天空+地面）
  const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x362907, 0.4)
  manager.scene.add(hemisphereLight)

  // 1c. DirectionalLight — 方向光（模拟太阳）
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0)
  directionalLight.position.set(-5, 8, 5)
  directionalLight.castShadow = true
  // 配置阴影
  directionalLight.shadow.mapSize.width = 1024
  directionalLight.shadow.mapSize.height = 1024
  directionalLight.shadow.camera.near = 0.5
  directionalLight.shadow.camera.far = 50
  directionalLight.shadow.camera.left = -10
  directionalLight.shadow.camera.right = 10
  directionalLight.shadow.camera.top = 10
  directionalLight.shadow.camera.bottom = -10
  manager.scene.add(directionalLight)

  // 1d. PointLight — 点光源（台灯）
  const pointLight = new THREE.PointLight(0xff922b, 2, 15)
  pointLight.position.set(3, 4, 2)
  pointLight.castShadow = true
  manager.scene.add(pointLight)

  // 1e. SpotLight — 聚光灯（手电筒）
  const spotLight = new THREE.SpotLight(0xffffff, 1, 20, Math.PI / 6)
  spotLight.position.set(0, 8, 0)
  spotLight.castShadow = true
  manager.scene.add(spotLight)

  // ========== 2. 几何体展示 ==========

  // 创建几何体
  const sphereGeo = new THREE.SphereGeometry(0.8, 32, 16)
  const boxGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2)
  const torusGeo = new THREE.TorusGeometry(0.6, 0.3, 16, 32)

  // 材质
  const material = new THREE.MeshStandardMaterial({
    color: 0x4488ff,
    roughness: 0.3,
    metalness: 0.5,
  })

  // 球体
  const sphere = new THREE.Mesh(sphereGeo, material)
  sphere.position.set(-3, 0.8, 0)
  sphere.castShadow = true
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

  // 外部模型加载示例：猴头模型
  // 由于下载模型失败，使用内置几何体组合成简单的"猴头"形状
  const monkeyGroup = new THREE.Group()

  // 猴头主体（球体）
  const headGeo = new THREE.SphereGeometry(0.8, 32, 16)
  const headMat = new THREE.MeshStandardMaterial({
    color: 0x8B4513,
    roughness: 0.6,
    metalness: 0.2,
  })
  const head = new THREE.Mesh(headGeo, headMat)
  head.castShadow = true
  head.receiveShadow = true
  monkeyGroup.add(head)

  // 左耳
  const earGeo = new THREE.SphereGeometry(0.3, 16, 8)
  const earMat = new THREE.MeshStandardMaterial({
    color: 0x8B4513,
    roughness: 0.6,
    metalness: 0.2,
  })
  const leftEar = new THREE.Mesh(earGeo, earMat)
  leftEar.position.set(-0.7, 0.5, 0)
  leftEar.castShadow = true
  leftEar.receiveShadow = true
  monkeyGroup.add(leftEar)

  // 右耳
  const rightEar = new THREE.Mesh(earGeo, earMat)
  rightEar.position.set(0.7, 0.5, 0)
  rightEar.castShadow = true
  rightEar.receiveShadow = true
  monkeyGroup.add(rightEar)

  // 眼睛（两个小球）
  const eyeGeo = new THREE.SphereGeometry(0.15, 16, 8)
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    roughness: 0.2,
    metalness: 0.8,
  })
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat)
  leftEye.position.set(-0.25, 0.15, 0.7)
  monkeyGroup.add(leftEye)

  const rightEye = new THREE.Mesh(eyeGeo, eyeMat)
  rightEye.position.set(0.25, 0.15, 0.7)
  monkeyGroup.add(rightEye)

  // 鼻子
  const noseGeo = new THREE.SphereGeometry(0.2, 16, 8)
  const noseMat = new THREE.MeshStandardMaterial({
    color: 0x8B4513,
    roughness: 0.6,
    metalness: 0.2,
  })
  const nose = new THREE.Mesh(noseGeo, noseMat)
  nose.position.set(0, -0.1, 0.75)
  nose.castShadow = true
  nose.receiveShadow = true
  monkeyGroup.add(nose)

  // 设置位置和缩放
  monkeyGroup.position.set(0, 3, 0)
  monkeyGroup.scale.set(0.8, 0.8, 0.8)

  manager.scene.add(monkeyGroup)

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

  // ========== 4. 灯光 Helper ==========

  // 方向光 Helper
  const directionalHelper = new THREE.DirectionalLightHelper(directionalLight, 1)
  manager.scene.add(directionalHelper)

  // 聚光灯 Helper
  const spotHelper = new THREE.SpotLightHelper(spotLight)
  manager.scene.add(spotHelper)

  // 点光源 Helper
  const pointHelper = new THREE.PointLightHelper(pointLight, 0.5)
  manager.scene.add(pointHelper)

  // ========== 5. 标签（Sprite 文字） ==========

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

  // 灯光标签
  const labels = [
    { text: 'Ambient', pos: new THREE.Vector3(-5, 5, 0) },
    { text: 'Hemisphere', pos: new THREE.Vector3(-3, 5, 0) },
    { text: 'Directional', pos: new THREE.Vector3(-1, 5, 0) },
    { text: 'Point', pos: new THREE.Vector3(1, 5, 0) },
    { text: 'Spot', pos: new THREE.Vector3(3, 5, 0) },
  ]
  labels.forEach(({ text, pos }) => {
    const label = createLabel(text, pos)
    manager.scene.add(label)
  })

  // ========== 动画循环 ==========

  manager.onUpdate((delta) => {
    // 几何体缓慢旋转
    sphere.rotation.y += 0.3 * delta
    box.rotation.y += 0.3 * delta
    torus.rotation.y += 0.3 * delta

    // 更新灯光 Helper
    directionalHelper.update()
    spotHelper.update()
    pointHelper.update()

    // 更新 OrbitControls
    controls.update()
  })

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
