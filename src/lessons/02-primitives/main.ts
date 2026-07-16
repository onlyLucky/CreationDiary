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
  canvas.width = size  // canvas 宽度（像素）
  canvas.height = size // canvas 高度（像素）
  const ctx = canvas.getContext('2d')!

  const squareSize = size / squares
  for (let i = 0; i < squares; i++) {
    for (let j = 0; j < squares; j++) {
      ctx.fillStyle = (i + j) % 2 === 0 ? '#ffffff' : '#333333' // 交替黑白
      ctx.fillRect(i * squareSize, j * squareSize, squareSize, squareSize)
    }
  }

  const texture = new THREE.CanvasTexture(canvas) // 从 canvas 创建纹理
  texture.wrapS = THREE.RepeatWrapping // 水平方向重复平铺
  texture.wrapT = THREE.RepeatWrapping // 垂直方向重复平铺
  return texture
}

/** 初始化场景 */
function init() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement

  const manager = new SceneManager({
    canvas,                  // 绑定的 canvas 元素
    bgColor: '#1a1a2e',     // 背景色（深蓝紫）
    fov: 60,                // 相机视场角（度）
  })

  // 相机位置：往后退，能看到多个物体
  manager.camera.position.set(0, 3, 10) // x=0, y=3(略高于物体), z=10(远离物体)
  manager.camera.lookAt(0, 0, 0)        // 看向原点

  // 添加灯光（后面课程会详细讲，这里先用基础灯光）
  const ambientLight = new THREE.AmbientLight(
    0xffffff, // 颜色（白色）
    0.6       // 强度
  )
  manager.scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(
    0xffffff, // 颜色（白色）
    0.8       // 强度
  )
  directionalLight.position.set(5, 10, 5) // 从右上前方照射
  manager.scene.add(directionalLight)

  // 创建棋盘格纹理
  const checkerTexture = createCheckerTexture() // size=256, squares=8（默认值）

  // ========== 1. BoxGeometry（立方体）==========
  const boxGeometry = new THREE.BoxGeometry(
    1.5, // width  — X 轴宽度
    1.5, // height — Y 轴高度
    1.5, // depth  — Z 轴深度
    1,   // widthSegments   — X 轴分段数
    1,   // heightSegments  — Y 轴分段数
    1    // depthSegments   — Z 轴分段数
  )
  const boxMaterial = new THREE.MeshStandardMaterial({
    map: checkerTexture, // 纹理贴图（棋盘格）
    roughness: 0.8,      // 粗糙度（0=镜面, 1=完全粗糙）
    wireframe: true,     // 临时加上，观察完去掉
  })
  const box = new THREE.Mesh(boxGeometry, boxMaterial)
  box.position.set(-4, 0, 0) // 放在最左边
  manager.scene.add(box)
  manager.registerDisposable(boxGeometry)  // 注册资源，场景销毁时自动释放
  manager.registerDisposable(boxMaterial)

  // ========== 2. SphereGeometry（球体）==========
  const sphereGeometry = new THREE.SphereGeometry(
    1,  // radius — 球体半径
    32, // widthSegments  — 水平分段数（经度方向，越大越圆滑）
    16  // heightSegments — 垂直分段数（纬度方向，越大越圆滑）
  )
  const sphereMaterial = new THREE.MeshStandardMaterial({
    color: 0x4488ff, // 蓝色
    roughness: 0.3,  // 较光滑
    metalness: 0.7,  // 高金属感
  })
  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial)
  sphere.position.set(-1.5, 0, 0) // 球体左侧第二个位置
  manager.scene.add(sphere)
  manager.registerDisposable(sphereGeometry)
  manager.registerDisposable(sphereMaterial)

  // ========== 3. CylinderGeometry（圆柱体）==========
  const cylinderGeometry = new THREE.CylinderGeometry(
    0.2, // radiusTop    — 顶部半径
    0.8, // radiusBottom — 底部半径（与顶部相同=圆柱体，不同=圆台，0=圆锥）
    2,   // height       — 高度
    32   // radialSegments — 径向分段数（越大越圆滑）
  )
  const cylinderMaterial = new THREE.MeshStandardMaterial({
    color: 0xff6b6b, // 红色
    roughness: 0.5,  // 中等粗糙
  })
  const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial)
  cylinder.position.set(1.5, 0, 0) // 圆柱体右侧第二个位置
  manager.scene.add(cylinder)
  manager.registerDisposable(cylinderGeometry)
  manager.registerDisposable(cylinderMaterial)

  // ========== 4. TorusGeometry（圆环）==========
  const torusGeometry = new THREE.TorusGeometry(
    1,   // radius — 圆环半径（中心到管中心的距离）
    0.4, // tube   — 管的粗细
    16,  // radialSegments  — 径向分段数（管截面的圆滑度）
    32   // tubularSegments — 管道分段数（环形方向的圆滑度）
  )
  const torusMaterial = new THREE.MeshStandardMaterial({
    color: 0x51cf66, // 绿色
    roughness: 0.4,  // 较光滑
    metalness: 0.6,  // 金属感
  })
  const torus = new THREE.Mesh(torusGeometry, torusMaterial)
  torus.position.set(4, 0, 0) // 放在最右边
  manager.scene.add(torus)
  manager.registerDisposable(torusGeometry)
  manager.registerDisposable(torusMaterial)

  // ========== 5. PlaneGeometry（平面）==========
  const planeGeometry = new THREE.PlaneGeometry(
    12, // width  — 宽度
    12, // height — 高度
    1,  // widthSegments  — 宽度分段数（做地面不需要细分）
    1   // heightSegments — 高度分段数
  )
  const planeMaterial = new THREE.MeshStandardMaterial({
    map: checkerTexture,      // 棋盘格纹理
    roughness: 1,             // 完全粗糙（哑光地面）
    side: THREE.DoubleSide,   // 双面渲染（正面背面都可见）
  })
  const plane = new THREE.Mesh(planeGeometry, planeMaterial)
  plane.rotation.x = -Math.PI / 2 // 绕 X 轴旋转 -90°，从垂直翻转为水平
  plane.position.y = -2           // 下移到物体下方作为地面
  manager.scene.add(plane)
  manager.registerDisposable(planeGeometry)
  manager.registerDisposable(planeMaterial)

  // ========== 6. Wireframe 可视化 ==========
  const wireGeometry = new THREE.SphereGeometry(
    0.6, // radius — 较小半径
    8,   // widthSegments  — 低分段，明显看到多边形
    4    // heightSegments — 低分段，更粗糙
  )
  const wireMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd43b,   // 黄色
    wireframe: true,    // 线框模式（只渲染边，不渲染面）
  })
  const wireSphere = new THREE.Mesh(wireGeometry, wireMaterial)
  wireSphere.position.set(-4, 2.5, 0) // 左上角，高于其他物体
  manager.scene.add(wireSphere)
  manager.registerDisposable(wireGeometry)
  manager.registerDisposable(wireMaterial)

  // ========== 动画循环 ==========
  manager.onUpdate((delta) => {
    // delta = 两帧间隔时间（秒）
    box.rotation.x += 0.5 * delta      // X 轴旋转速度 0.5 rad/s
    box.rotation.y += 0.3 * delta      // Y 轴旋转速度 0.3 rad/s

    sphere.rotation.y += 0.4 * delta   // Y 轴旋转

    cylinder.rotation.y += 0.6 * delta // Y 轴旋转

    torus.rotation.x += 0.4 * delta    // X 轴旋转
    torus.rotation.y += 0.6 * delta    // Y 轴旋转

    wireSphere.rotation.y += 0.8 * delta // 线框球旋转更快
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
