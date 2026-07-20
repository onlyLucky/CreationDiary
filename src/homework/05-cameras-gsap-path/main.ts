/**
 * 第 5 课课后作业：GSAP 相机路径动画 - 过山车
 *
 * 作业要求：
 * - 轨道上有一个长方体作为火车
 * - 两个机位：第三人称（右下角）和第一人称（全屏）
 * - 相机沿预设路径平滑移动
 * - 可以循环播放或手动触发
 */

import * as THREE from 'three'
import { SceneManager } from '@/core/SceneManager'
import { ControlPanel } from '@/core/ControlPanel'
import gsap from 'gsap'

function init() {
  // ========== 主场景：第一人称（全屏）==========
  const mainCanvas = document.getElementById('homework_canvas') as HTMLCanvasElement

  const mainManager = new SceneManager({
    canvas: mainCanvas,
    bgColor: '#1a1a2e',
    fov: 75,
  })

  // ========== 第三人称场景（右下角）==========
  const overviewContainer = document.createElement('div')
  overviewContainer.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 300px;
    height: 220px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    overflow: hidden;
    z-index: 100;
  `
  document.body.appendChild(overviewContainer)

  const overviewCanvas = document.createElement('canvas')
  overviewCanvas.style.cssText = 'width: 100%; height: 100%;'
  overviewContainer.appendChild(overviewCanvas)

  const overviewRenderer = new THREE.WebGLRenderer({ canvas: overviewCanvas, antialias: true })
  overviewRenderer.setSize(300, 220)
  overviewRenderer.setPixelRatio(window.devicePixelRatio)
  overviewRenderer.setClearColor(0x1a1a2e)

  const overviewScene = new THREE.Scene()
  const overviewCamera = new THREE.PerspectiveCamera(60, 300 / 220, 0.1, 200)
  overviewCamera.position.set(0, 30, 30)
  overviewCamera.lookAt(0, 0, 0)

  // ========== 1. 过山车轨道 ==========

  // 轨道路径点（更圆滑的曲线）
  const trackPoints = [
    new THREE.Vector3(0, 2, 15),
    new THREE.Vector3(-6, 5, 10),
    new THREE.Vector3(-10, 10, 3),
    new THREE.Vector3(-6, 14, -4),
    new THREE.Vector3(0, 10, -10),
    new THREE.Vector3(6, 4, -8),
    new THREE.Vector3(10, 3, 0),
    new THREE.Vector3(8, 6, 8),
    new THREE.Vector3(3, 4, 13),
  ]

  const trackCurve = new THREE.CatmullRomCurve3(trackPoints, true)

  // 轨道用线显示
  const curvePoints = trackCurve.getPoints(200)
  const trackLineGeometry = new THREE.BufferGeometry().setFromPoints(curvePoints)
  const trackLineMaterial = new THREE.LineBasicMaterial({ color: 0x6688aa })
  const trackLine = new THREE.Line(trackLineGeometry, trackLineMaterial)
  mainManager.scene.add(trackLine)
  overviewScene.add(trackLine.clone())

  // ========== 2. 火车（长方体）==========

  const trainGeometry = new THREE.BoxGeometry(1, 1, 2)
  const trainMaterial = new THREE.MeshStandardMaterial({ color: 0xff4444 })
  const train = new THREE.Mesh(trainGeometry, trainMaterial)
  mainManager.scene.add(train)

  const trainClone = train.clone()
  overviewScene.add(trainClone)

  // ========== 3. 场景物体 ==========

  // 地面
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({ color: 0x1a3a1a })
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.5
  mainManager.scene.add(ground)
  overviewScene.add(ground.clone())

  // 网格
  const grid = new THREE.GridHelper(100, 50, 0x333355, 0x222244)
  grid.position.y = -0.49
  mainManager.scene.add(grid)
  overviewScene.add(grid.clone())

  // 简单装饰物（长方体和球体）
  const decoGeometries = [
    new THREE.BoxGeometry(1, 2, 1),
    new THREE.SphereGeometry(0.5, 8, 8),
  ]
  const decoMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x44aa44 }),
    new THREE.MeshStandardMaterial({ color: 0x4488aa }),
  ]

  for (let i = 0; i < 20; i++) {
    const geoIndex = Math.floor(Math.random() * 2)
    const deco = new THREE.Mesh(decoGeometries[geoIndex], decoMaterials[geoIndex])
    deco.position.set(
      (Math.random() - 0.5) * 50,
      0,
      (Math.random() - 0.5) * 50
    )
    mainManager.scene.add(deco)
    overviewScene.add(deco.clone())
  }

  // ========== 4. 灯光 ==========

  mainManager.scene.add(new THREE.AmbientLight(0xffffff, 2))
  const mainLight = new THREE.DirectionalLight(0xffffff, 2)
  mainLight.position.set(10, 20, 10)
  mainManager.scene.add(mainLight)

  overviewScene.add(new THREE.AmbientLight(0xffffff, 2))
  const overviewLight = new THREE.DirectionalLight(0xffffff, 2)
  overviewLight.position.set(10, 20, 10)
  overviewScene.add(overviewLight)

  // ========== 5. 初始位置 ==========

  // 火车初始位置（轨道起点）
  const initPosition = trackCurve.getPointAt(0)
  const initTangent = trackCurve.getTangentAt(0)
  train.position.copy(initPosition)
  train.lookAt(initPosition.clone().add(initTangent))
  trainClone.position.copy(initPosition)
  trainClone.rotation.copy(train.rotation)

  // 第一人称相机初始位置
  mainManager.camera.position.copy(initPosition).add(new THREE.Vector3(0, 1.5, 0))
  const initLookAhead = trackCurve.getPointAt(0.02)
  initLookAhead.y += 1
  mainManager.camera.lookAt(initLookAhead)

  // ========== 6. 相机 Helper ==========

  // 第三人称视角中显示第一人称相机的 helper
  const firstPersonHelper = new THREE.CameraHelper(mainManager.camera)
  overviewScene.add(firstPersonHelper)

  // 第一人称视角中显示第三人称相机的 helper
  const overviewHelper = new THREE.CameraHelper(overviewCamera)
  mainManager.scene.add(overviewHelper)

  // ========== 7. GSAP 动画 ==========

  const animationProgress = { progress: 0 }

  const timeline = gsap.timeline({
    repeat: -1,
    paused: true,
  })

  timeline.to(animationProgress, {
    progress: 1,
    duration: 12,
    ease: 'none',
    onUpdate: () => {
      const t = animationProgress.progress

      // 火车位置
      const position = trackCurve.getPointAt(t)
      const tangent = trackCurve.getTangentAt(t)

      train.position.copy(position)
      const lookAtPoint = position.clone().add(tangent)
      train.lookAt(lookAtPoint)

      // 同步克隆体
      trainClone.position.copy(position)
      trainClone.rotation.copy(train.rotation)

      // 第一人称相机（在火车上方）
      mainManager.camera.position.copy(position).add(new THREE.Vector3(0, 1.5, 0))

      // 先用 lookAt 设定基础朝向（看前进方向）
      const lookAheadT = (t + 0.02) % 1
      const lookAhead = trackCurve.getPointAt(lookAheadT)
      lookAhead.y += 1
      mainManager.camera.lookAt(lookAhead)

      // 再叠加鼠标/触摸偏移（拖动方向 = 视角方向）
      mainManager.camera.rotation.y += lookOffset.x
      mainManager.camera.rotation.x -= lookOffset.y

      // 同步第三人称相机看向过山车中心
      overviewCamera.lookAt(new THREE.Vector3(0, 5, 0))

      // 更新 helper
      firstPersonHelper.update()
      overviewHelper.update()
    },
  })

  // ========== 7. 控制面板 ==========

  const panel = new ControlPanel()
  let isPlaying = false

  panel.addButton({
    id: 'play-pause',
    label: '▶ 播放',
    type: 'button',
    onClick: () => {
      isPlaying = !isPlaying
      isPlaying ? timeline.play() : timeline.pause()
      // 更新按钮文字
      const btn = document.getElementById('control-play-pause')
      if (btn) btn.textContent = isPlaying ? '⏸ 暂停' : '▶ 播放'
    },
  })

  panel.addButton({
    id: 'reset',
    label: '↺ 重置',
    type: 'button',
    onClick: () => {
      timeline.pause()
      timeline.progress(0)
      isPlaying = false
      // 重置按钮文字
      const playBtn = document.getElementById('control-play-pause')
      if (playBtn) playBtn.textContent = '▶ 播放'
      // 重置速度
      timeline.timeScale(1)
      panel.setValue('speed', 1)
      // 重置视角
      lookOffset.x = 0
      lookOffset.y = 0
    },
  })

  panel.addSlider({
    id: 'speed',
    label: '速度：',
    type: 'slider',
    min: 0.5,
    max: 3,
    step: 0.1,
    defaultValue: 1,
    onChange: (value) => timeline.timeScale(value),
  })

  panel.addCheckbox({
    id: 'show-overview',
    label: '第三人称',
    type: 'checkbox',
    defaultValue: true,
    onChange: (checked) => {
      overviewContainer.style.display = checked ? 'block' : 'none'
    },
  })

  panel.addCheckbox({
    id: 'show-helper',
    label: '相机 Helper',
    type: 'checkbox',
    defaultValue: true,
    onChange: (checked) => {
      firstPersonHelper.visible = checked
      overviewHelper.visible = checked
    },
  })

  // ========== 8. 第一人称视角控制 ==========

  // 鼠标/触摸偏移量
  const lookOffset = { x: 0, y: 0 }
  let isDragging = false
  let lastMouseX = 0
  let lastMouseY = 0

  // 鼠标事件
  mainCanvas.addEventListener('mousedown', (e) => {
    isDragging = true
    lastMouseX = e.clientX
    lastMouseY = e.clientY
  })

  mainCanvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return
    lookOffset.x += (e.clientX - lastMouseX) * 0.003
    lookOffset.y += (e.clientY - lastMouseY) * 0.003
    lookOffset.y = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, lookOffset.y))
    lastMouseX = e.clientX
    lastMouseY = e.clientY
  })

  mainCanvas.addEventListener('mouseup', () => isDragging = false)
  mainCanvas.addEventListener('mouseleave', () => isDragging = false)

  // 触摸事件
  mainCanvas.addEventListener('touchstart', (e) => {
    isDragging = true
    lastMouseX = e.touches[0].clientX
    lastMouseY = e.touches[0].clientY
  })

  mainCanvas.addEventListener('touchmove', (e) => {
    if (!isDragging) return
    e.preventDefault()
    lookOffset.x += (e.touches[0].clientX - lastMouseX) * 0.003
    lookOffset.y += (e.touches[0].clientY - lastMouseY) * 0.003
    lookOffset.y = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, lookOffset.y))
    lastMouseX = e.touches[0].clientX
    lastMouseY = e.touches[0].clientY
  })

  mainCanvas.addEventListener('touchend', () => isDragging = false)

  // 重置视角按钮
  panel.addButton({
    id: 'reset-view',
    label: '重置视角',
    type: 'button',
    onClick: () => {
      lookOffset.x = 0
      lookOffset.y = 0
    },
  })

  // ========== 9. 动画循环 ==========

  mainManager.onUpdate(() => {
    overviewRenderer.render(overviewScene, overviewCamera)
  })

  mainManager.start()
}

init()
