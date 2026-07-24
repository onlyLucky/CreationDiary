/**
 * 第 7 课：场景图与变换
 *
 * 学习目标：
 * 1. 理解场景图的树形结构
 * 2. 掌握父子关系与变换继承
 * 3. 区分局部坐标系 vs 世界坐标系
 * 4. 学会 Object3D 分组管理
 * 5. 掌握 scene.traverse() 遍历
 * 6. 学会 AxesHelper / GridHelper 调试
 *
 * 核心概念：
 * - 场景图：树形结构，scene 是根节点，所有物体都是它的子节点
 * - 父子关系：子物体的变换（位置/旋转/缩放）相对于父物体
 * - 变换继承：子物体自动继承父物体的变换
 * - 局部坐标系：物体自身的坐标系
 * - 世界坐标系：场景的全局坐标系
 *
 * 运行方式：
 * - 在浏览器中打开此文件对应的 HTML
 * - 使用鼠标拖拽旋转视角，滚轮缩放
 * - 通过控制面板调整地球和月球的公转速度
 * - 切换坐标轴和网格的显示
 */

import * as THREE from 'three'
import { SceneManager } from '@/core/SceneManager'
import { ControlPanel } from '@/core/ControlPanel'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

/**
 * 初始化场景
 *
 * 场景图结构：
 * scene (根节点)
 * ├── axesHelper (坐标轴)
 * ├── xLabel, yLabel, zLabel (坐标轴标签)
 * ├── gridHelper (网格)
 * ├── ambientLight (环境光)
 * ├── directionalLight (方向光)
 * └── sun (太阳)
 *     └── earth (地球)
 *         └── moon (月球)
 */
function init() {
  // 获取 canvas 元素并断言为 HTMLCanvasElement 类型
  const canvas = document.getElementById('canvas') as HTMLCanvasElement

  // 创建场景管理器
  // SceneManager 封装了 scene、camera、renderer 的创建和管理
  const manager = new SceneManager({
    canvas,
    bgColor: '#000011',  // 深蓝色背景
    fov: 75,             // 相机视场角
  })

  // 设置相机位置：从 (0, 10, 20) 观察原点
  // 俯视角度，可以看到太阳系统的全貌
  manager.camera.position.set(0, 10, 20)
  manager.camera.lookAt(0, 0, 0)

  // OrbitControls：轨道控制器
  // 允许用户通过鼠标拖拽旋转视角，滚轮缩放
  const controls = new OrbitControls(manager.camera, canvas)
  controls.enableDamping = true   // 启用阻尼（惯性效果）
  controls.dampingFactor = 0.05   // 阻尼系数
  controls.target.set(0, 0, 0)   // 控制器的目标点

  // ========== 1. 辅助工具 ==========
  // AxesHelper：坐标轴辅助线
  //   红色 = X 轴，绿色 = Y 轴，蓝色 = Z 轴
  //   参数 5 表示坐标轴长度为 5 个单位
  const axesHelper = new THREE.AxesHelper(5)
  manager.scene.add(axesHelper)

  // 坐标轴标签（Sprite 文字）
  // Sprite 是始终面向相机的 2D 图像，适合用于标签
  function createAxisLabel(text: string, position: THREE.Vector3, color: string): THREE.Sprite {
    // 创建 canvas 用于绘制文字
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')!

    // 绘制文字
    ctx.fillStyle = color
    ctx.font = 'bold 48px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 32, 32)

    // 将 canvas 转换为纹理
    const texture = new THREE.CanvasTexture(canvas)

    // 创建 Sprite 材质并设置透明度
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }))
    sprite.position.copy(position)
    sprite.scale.set(0.8, 0.8, 1)
    return sprite
  }

  // 创建 X、Y、Z 轴标签
  const xLabel = createAxisLabel('X', new THREE.Vector3(5.5, 0, 0), '#ff0000')
  const yLabel = createAxisLabel('Y', new THREE.Vector3(0, 5.5, 0), '#00ff00')
  const zLabel = createAxisLabel('Z', new THREE.Vector3(0, 0, 5.5), '#0000ff')
  manager.scene.add(xLabel)
  manager.scene.add(yLabel)
  manager.scene.add(zLabel)

  // GridHelper：网格辅助线
  // 参数：(size, divisions, colorCenterLine, colorGrid)
  // size=20 表示网格大小 20x20，divisions=20 表示分成 20 格
  const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x333333)
  manager.scene.add(gridHelper)

  // ========== 2. 太阳系统 ==========
  // 创建太阳、地球、月球的几何体
  // SphereGeometry 参数：(radius, widthSegments, heightSegments)
  // radius：球体半径
  // widthSegments/heightSegments：分段数，越高越平滑
  const sunGeo = new THREE.SphereGeometry(1.5, 32, 16)   // 太阳半径 1.5
  const earthGeo = new THREE.SphereGeometry(0.5, 32, 16) // 地球半径 0.5
  const moonGeo = new THREE.SphereGeometry(0.2, 32, 16)  // 月球半径 0.2

  // 创建材质
  // MeshBasicMaterial：不受光照影响，自发光效果
  // MeshStandardMaterial：基于物理的材质，需要灯光才能看到
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 }) // 太阳自发光
  const earthMat = new THREE.MeshStandardMaterial({ color: 0x2233ff, roughness: 0.5 }) // 地球，粗糙度 0.5
  const moonMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.8 })  // 月球，粗糙度 0.8

  // 创建网格对象（Mesh = Geometry + Material）
  const sun = new THREE.Mesh(sunGeo, sunMat)
  const earth = new THREE.Mesh(earthGeo, earthMat)
  const moon = new THREE.Mesh(moonGeo, moonMat)

  // 月球标记点：用于观察月球自转
  // 在月球表面添加一个红色小球，清楚显示月球的自转状态
  // 关键：红点放在 x 轴负方向（-0.2），这样初始时就朝向地球
  const markerGeo = new THREE.SphereGeometry(0.05, 16, 8)  // 小球半径 0.05
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xff0000 }) // 红色，自发光
  const moonMarker = new THREE.Mesh(markerGeo, markerMat)
  moonMarker.position.set(-0.2, 0, 0)  // 放在月球表面（x轴负方向，朝向地球）
  moon.add(moonMarker)  // 作为月球的子物体，跟随月球旋转

  // 地球标记点：用于观察地球自转
  const earthMarkerGeo = new THREE.SphereGeometry(0.1, 16, 8)
  const earthMarkerMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 }) // 绿色
  const earthMarker = new THREE.Mesh(earthMarkerGeo, earthMarkerMat)
  earthMarker.position.set(0.5, 0, 0)  // 放在地球表面
  earth.add(earthMarker)

  // 连接线：显示地球和月球的连接关系
  // 使用虚线材质，更美观
  const lineMaterial = new THREE.LineDashedMaterial({
    color: 0x888888,
    dashSize: 0.1,
    gapSize: 0.05,
    linewidth: 1
  })
  const lineGeometry = new THREE.BufferGeometry()
  const linePoints = [
    new THREE.Vector3(0, 0, 0),  // 地球位置
    new THREE.Vector3(1.5, 0, 0) // 月球位置
  ]
  lineGeometry.setFromPoints(linePoints)
  const connectionLine = new THREE.Line(lineGeometry, lineMaterial)
  connectionLine.computeLineDistances()  // 计算虚线距离
  earth.add(connectionLine)  // 作为地球的子物体

  // ========== 3. 构建父子关系 ==========
  // 关键概念：场景图中的父子关系
  //   - 地球是太阳的子物体，月球是地球的子物体
  //   - 子物体的 position 是相对于父物体的局部坐标
  //   - 当父物体变换时，子物体自动跟随变换

  sun.position.y = 2

  // 设置地球位置：距离太阳 5 个单位（局部坐标）
  // 注意：这是相对于太阳的位置，不是世界坐标
  earth.position.x = 5

  // 设置月球位置：距离地球 1.5 个单位（局部坐标）
  // 注意：这是相对于地球的位置
  moon.position.x = 1.5

  // 构建父子关系
  // sun.add(earth)：将 earth 添加为 sun 的子物体
  // earth.add(moon)：将 moon 添加为 earth 的子物体
  // 这样就形成了：sun → earth → moon 的层级结构
  sun.add(earth)
  earth.add(moon)

  // 将太阳添加到场景（根节点）
  // 太阳的所有子物体（地球、月球）会自动跟随
  manager.scene.add(sun)

  // ========== 4. 灯光 ==========
  // MeshBasicMaterial 不受灯光影响，所以太阳不需要灯光
  // MeshStandardMaterial 需要灯光才能看到，所以地球和月球需要灯光

  // AmbientLight：环境光
  // 均匀照亮场景中的所有物体，没有方向
  // 参数：(color, intensity)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3)
  manager.scene.add(ambientLight)

  // DirectionalLight：方向光
  // 模拟太阳光，平行光线，有方向性
  // 参数：(color, intensity)
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
  directionalLight.position.set(0, 10, 0) // 从上方照射
  manager.scene.add(directionalLight)

  // ========== 5. 控制面板 ==========
  // ControlPanel：自定义控制面板组件
  // 提供滑块和复选框来控制场景参数
  const panel = new ControlPanel()

  // 运动控制变量
  let earthSpeed = 1     // 地球公转速度
  let moonSpeed = 3      // 月球公转速度
  let tidalLocked = true // 潮汐锁定开关
  let moonRotationSpeed = moonSpeed  // 自转速度 = 公转速度

  // 添加地球公转速度滑块
  // 参数：id, label, type, min, max, step, defaultValue, onChange
  panel.addSlider({
    id: 'earth-speed',
    label: '地球公转速度',
    type: 'slider',
    min: 0,
    max: 5,
    step: 0.1,
    defaultValue: 1,
    onChange: (value) => { earthSpeed = value },
  })

  // 添加月球公转速度滑块
  panel.addSlider({
    id: 'moon-speed',
    label: '月球公转速度',
    type: 'slider',
    min: 0,
    max: 10,
    step: 0.1,
    defaultValue: 3,
    onChange: (value) => { moonSpeed = value },
  })

  // 添加坐标轴显示复选框
  // 通过 visible 属性控制物体的显示/隐藏
  panel.addCheckbox({
    id: 'show-axes',
    label: '显示坐标轴',
    type: 'checkbox',
    defaultValue: true,
    onChange: (checked) => {
      axesHelper.visible = checked
      xLabel.visible = checked
      yLabel.visible = checked
      zLabel.visible = checked
    },
  })

  // 添加网格显示复选框
  panel.addCheckbox({
    id: 'show-grid',
    label: '显示网格',
    type: 'checkbox',
    defaultValue: true,
    onChange: (checked) => {
      gridHelper.visible = checked
    },
  })

  // 添加潮汐锁定复选框
  // 潮汐锁定：月球自转周期 = 公转周期，同一面始终朝向地球
  panel.addCheckbox({
    id: 'tidal-lock',
    label: '潮汐锁定',
    type: 'checkbox',
    defaultValue: true,
    onChange: (checked) => {
      tidalLocked = checked
    },
  })

  // 添加标记点显示复选框
  // 控制月球标记点、地球标记点和连接线的显示
  panel.addCheckbox({
    id: 'show-markers',
    label: '显示标记点',
    type: 'checkbox',
    defaultValue: true,
    onChange: (checked) => {
      moonMarker.visible = checked
      earthMarker.visible = checked
      connectionLine.visible = checked
    },
  })

  // ========== 6. 动画循环 ==========
  // THREE.Clock：时钟对象，用于计算时间差
  // getDelta() 返回上一帧到当前帧的时间差（秒）
  const clock = new THREE.Clock()

  // onUpdate：每帧更新回调
  // delta：时间差，用于实现帧率无关的动画
  manager.onUpdate((delta) => {
    // 更新轨道控制器（必须在动画循环中调用）
    controls.update()

    // 地球绕太阳公转
    // 旋转太阳 → 地球作为子物体自动跟随旋转
    // 这就是场景图的变换继承：子物体继承父物体的变换
    sun.rotation.y += earthSpeed * delta * 0.5

    // 月球绕地球公转
    // 旋转地球 → 月球作为子物体自动跟随旋转
    // 注意：月球同时继承了太阳和地球的旋转
    earth.rotation.y += moonSpeed * delta * 0.5

    // 月球自转
    if (tidalLocked) {
      // 自转速度 = 公转速度，方向相反（潮汐锁定）
      moon.rotation.y -= moonRotationSpeed * delta * 0.5
    }else{
      // 自由自转（不同步）
      moon.rotation.y += delta * 0.3
    }
  })

  // 启动渲染循环
  manager.start()

  // ========== 控制台提示 ==========
  console.log('=== 第 7 课：场景图与变换 ===')
  console.log('观察要点：')
  console.log('  - 地球绕太阳公转（地球是太阳的子物体）')
  console.log('  - 月球绕地球公转（月球是地球的子物体）')
  console.log('  - 潮汐锁定：月球同一面始终朝向地球')
  console.log('  - 月球红色标记点：观察月球自转状态')
  console.log('  - 地球绿色标记点：观察地球自转状态')
  console.log('  - 灰色虚线：地球与月球的连接')
  console.log('  - 坐标轴和网格辅助线')
  console.log('')
  console.log('尝试修改：')
  console.log('  - 调整地球和月球的公转速度')
  console.log('  - 切换潮汐锁定，观察标记点变化')
  console.log('  - 切换标记点显示')
  console.log('  - 切换坐标轴和网格的显示')
}

// 初始化场景
init()
