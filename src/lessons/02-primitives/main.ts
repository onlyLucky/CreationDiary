/**
 * 第 2 课：几何体与图元
 *
 * 学习目标：
 * 1. 掌握 Three.js 内置几何体（Box, Sphere, Cylinder, Torus, Plane）
 * 2. 理解参数对效果和性能的影响（segments 分段数）
 * 3. 学会用多个图元组合成复杂物体
 * 4. 理解 Wireframe 可视化
 */

import * as THREE from 'three'
import { SceneManager } from '@/core/SceneManager'

/** 创建棋盘格纹理（程序生成） */
function createCheckerTexture(size = 256, squares = 8): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  const squareSize = size / squares
  for (let i = 0; i < squares; i++) {
    for (let j = 0; j < squares; j++) {
      ctx.fillStyle = (i + j) % 2 === 0 ? '#ffffff' : '#333333'
      ctx.fillRect(i * squareSize, j * squareSize, squareSize, squareSize)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

/** 初始化场景 */
function init() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement

  const manager = new SceneManager({
    canvas,
    bgColor: '#1a1a2e',
    fov: 60,
  })

  // 相机位置：往后退，能看到多个物体
  manager.camera.position.set(0, 3, 10)
  manager.camera.lookAt(0, 0, 0)

  // 添加灯光（后面课程会详细讲，这里先用基础灯光）
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  manager.scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(5, 10, 5)
  manager.scene.add(directionalLight)

  // 创建棋盘格纹理
  const checkerTexture = createCheckerTexture()

  // ========== 1. BoxGeometry（立方体）==========
  // 参数：width, height, depth, widthSegments, heightSegments, depthSegments
  const boxGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5, 2, 2, 2)
  const boxMaterial = new THREE.MeshStandardMaterial({
    map: checkerTexture,
    roughness: 0.8,
  })
  const box = new THREE.Mesh(boxGeometry, boxMaterial)
  box.position.set(-4, 0, 0)
  manager.scene.add(box)
  manager.registerDisposable(boxGeometry)
  manager.registerDisposable(boxMaterial)

  // ========== 2. SphereGeometry（球体）==========
  // 参数：radius, widthSegments, heightSegments
  const sphereGeometry = new THREE.SphereGeometry(1, 32, 16)
  const sphereMaterial = new THREE.MeshStandardMaterial({
    color: 0x4488ff,
    roughness: 0.3,
    metalness: 0.7,
  })
  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial)
  sphere.position.set(-1.5, 0, 0)
  manager.scene.add(sphere)
  manager.registerDisposable(sphereGeometry)
  manager.registerDisposable(sphereMaterial)

  // ========== 3. CylinderGeometry（圆柱体）==========
  // 参数：radiusTop, radiusBottom, height, radialSegments
  const cylinderGeometry = new THREE.CylinderGeometry(0.8, 0.8, 2, 32)
  const cylinderMaterial = new THREE.MeshStandardMaterial({
    color: 0xff6b6b,
    roughness: 0.5,
  })
  const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial)
  cylinder.position.set(1.5, 0, 0)
  manager.scene.add(cylinder)
  manager.registerDisposable(cylinderGeometry)
  manager.registerDisposable(cylinderMaterial)

  // ========== 4. TorusGeometry（圆环）==========
  // 参数：radius, tube, radialSegments, tubularSegments
  const torusGeometry = new THREE.TorusGeometry(1, 0.4, 16, 32)
  const torusMaterial = new THREE.MeshStandardMaterial({
    color: 0x51cf66,
    roughness: 0.4,
    metalness: 0.6,
  })
  const torus = new THREE.Mesh(torusGeometry, torusMaterial)
  torus.position.set(4, 0, 0)
  manager.scene.add(torus)
  manager.registerDisposable(torusGeometry)
  manager.registerDisposable(torusMaterial)

  // ========== 5. PlaneGeometry（平面）==========
  // 参数：width, height, widthSegments, heightSegments
  const planeGeometry = new THREE.PlaneGeometry(12, 12, 1, 1)
  const planeMaterial = new THREE.MeshStandardMaterial({
    map: checkerTexture,
    roughness: 1,
    side: THREE.DoubleSide,
  })
  const plane = new THREE.Mesh(planeGeometry, planeMaterial)
  plane.rotation.x = -Math.PI / 2 // 旋转到水平
  plane.position.y = -2
  manager.scene.add(plane)
  manager.registerDisposable(planeGeometry)
  manager.registerDisposable(planeMaterial)

  // ========== 6. Wireframe 可视化 ==========
  // 用线框显示 Sphere，展示分段数的效果
  const wireGeometry = new THREE.SphereGeometry(0.6, 8, 4) // 低分段数，明显看到多边形
  const wireMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd43b,
    wireframe: true,
  })
  const wireSphere = new THREE.Mesh(wireGeometry, wireMaterial)
  wireSphere.position.set(-4, 2.5, 0)
  manager.scene.add(wireSphere)
  manager.registerDisposable(wireGeometry)
  manager.registerDisposable(wireMaterial)

  // ========== 动画循环 ==========
  manager.onUpdate((delta, elapsed) => {
    // 所有物体缓慢旋转
    box.rotation.x += 0.5 * delta
    box.rotation.y += 0.3 * delta

    sphere.rotation.y += 0.4 * delta

    cylinder.rotation.y += 0.6 * delta

    torus.rotation.x += 0.4 * delta
    torus.rotation.y += 0.6 * delta

    wireSphere.rotation.y += 0.8 * delta
  })

  manager.start()

  // 控制台提示
  console.log('=== 第 2 课：几何体与图元 ===')
  console.log('观察要点：')
  console.log('  - 5 种几何体：Box, Sphere, Cylinder, Torus, Plane')
  console.log('  - Wireframe 球体：低分段数，明显看到多边形')
  console.log('  - 棋盘格纹理：展示 UV 映射效果')
  console.log('')
  console.log('尝试修改：')
  console.log('  - 调整 SphereGeometry 的 segments 参数（如 8, 16, 32, 64）')
  console.log('  - 观察分段数对球体圆滑度的影响')
  console.log('  - 修改 BoxGeometry 的分段数，观察 wireframe 变化')
}

init()
