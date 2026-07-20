/**
 * 第 5 课课后作业：GSAP 相机路径动画
 *
 * 作业目标：
 * 1. 学会用 GSAP 控制相机沿路径移动
 * 2. 实现一个第一人称"过山车"相机漫游效果
 * 3. 理解 timeline 和关键帧动画
 *
 * 作业要求：
 * - 相机沿预设路径平滑移动
 * - 相机始终看向目标点
 * - 可以循环播放或手动触发
 */

import * as THREE from 'three'
import { SceneManager } from '@/core/SceneManager'
import { ControlPanel } from '@/core/ControlPanel'
import gsap from 'gsap'

/**
 * 初始化场景
 *
 * 整体结构：
 * 1. 创建场景物体（地面、建筑、树木等）
 * 2. 定义相机路径点
 * 3. 用 GSAP Timeline 控制相机移动
 * 4. 控制面板：播放/暂停/重置
 */
function init() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement

  const manager = new SceneManager({
    canvas,
    bgColor: '#1a1a2e',
    fov: 75,  // 稍大的 FOV，增强沉浸感
  })

  // ========== 1. 创建场景 ==========

  // 地面
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.9 })
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.5
  manager.scene.add(ground)

  // 网格辅助线
  const gridHelper = new THREE.GridHelper(100, 50, 0x444444, 0x333333)
  gridHelper.position.y = -0.49
  manager.scene.add(gridHelper)

  // 坐标轴
  const axesHelper = new THREE.AxesHelper(10)
  manager.scene.add(axesHelper)

  /**
   * 创建简单的建筑物
   *
   * @param x — X 坐标
   * @param z — Z 坐标
   * @param height — 建筑高度
   * @param color — 建筑颜色
   */
  function createBuilding(x: number, z: number, height: number, color: number): THREE.Mesh {
    const geo = new THREE.BoxGeometry(2, height, 2)
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.3 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(x, height / 2 - 0.5, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    manager.scene.add(mesh)
    return mesh
  }

  // 创建一些建筑物
  createBuilding(-8, -5, 6, 0x4488ff)
  createBuilding(-5, -8, 4, 0xff6b6b)
  createBuilding(5, -6, 8, 0x51cf66)
  createBuilding(8, -3, 5, 0xffd43b)
  createBuilding(-3, 5, 7, 0xcc5de8)
  createBuilding(6, 7, 3, 0xff922b)

  // 创建一些球体（树木）
  function createTree(x: number, z: number): THREE.Group {
    const group = new THREE.Group()

    // 树干
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.3, 2, 8),
      new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8 })
    )
    trunk.position.y = 0.5
    group.add(trunk)

    // 树冠
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.8 })
    )
    crown.position.y = 2
    group.add(crown)

    group.position.set(x, -0.5, z)
    manager.scene.add(group)
    return group
  }

  // 创建一些树
  createTree(-6, 2)
  createTree(-4, 4)
  createTree(2, -2)
  createTree(4, 3)
  createTree(7, -7)

  // 灯光
  manager.scene.add(new THREE.AmbientLight(0xffffff, 0.4))
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
  dirLight.position.set(10, 20, 10)
  dirLight.castShadow = true
  manager.scene.add(dirLight)

  // ========== 2. 定义相机路径 ==========

  /**
   * 相机路径点
   *
   * 每个点包含：
   *   position — 相机位置
   *   lookAt   — 相机看向的目标点
   *   duration — 从上一个点到这个点的时间（秒）
   */
  interface PathPoint {
    position: THREE.Vector3
    lookAt: THREE.Vector3
    duration: number
  }

  const pathPoints: PathPoint[] = [
    // 起点：从高处俯瞰
    {
      position: new THREE.Vector3(0, 15, 20),
      lookAt: new THREE.Vector3(0, 0, 0),
      duration: 2,
    },
    // 第 2 点：下降到街道高度
    {
      position: new THREE.Vector3(-8, 2, 10),
      lookAt: new THREE.Vector3(-5, 1, 5),
      duration: 3,
    },
    // 第 3 点：穿过建筑群
    {
      position: new THREE.Vector3(-5, 2, 0),
      lookAt: new THREE.Vector3(0, 2, -5),
      duration: 3,
    },
    // 第 4 点：绕到另一侧
    {
      position: new THREE.Vector3(5, 3, -5),
      lookAt: new THREE.Vector3(8, 2, -8),
      duration: 3,
    },
    // 第 5 点：上升到空中
    {
      position: new THREE.Vector3(10, 8, 5),
      lookAt: new THREE.Vector3(0, 0, 0),
      duration: 2,
    },
    // 终点：回到起点
    {
      position: new THREE.Vector3(0, 15, 20),
      lookAt: new THREE.Vector3(0, 0, 0),
      duration: 2,
    },
  ]

  // ========== 3. 创建 GSAP Timeline ==========

  /**
   * GSAP Timeline — 时间线动画
   *
   * Timeline 可以：
   *   - 按顺序播放多个动画
   *   - 控制播放/暂停/倒放
   *   - 调整播放速度
   *   - 循环播放
   */
  const timeline = gsap.timeline({
    paused: true,  // 默认暂停，等待用户触发
    repeat: -1,    // -1 = 无限循环
    yoyo: false,   // 不来回播放
    onUpdate: () => {
      // 每帧更新相机 Helper
      manager.camera.updateProjectionMatrix()
    },
  })

  // 为每个路径点添加动画
  pathPoints.forEach((point, index) => {
    if (index === 0) {
      // 第一个点：直接设置位置
      manager.camera.position.copy(point.position)
      manager.camera.lookAt(point.lookAt)
      return
    }

    // 添加位置动画
    timeline.to(manager.camera.position, {
      x: point.position.x,
      y: point.position.y,
      z: point.position.z,
      duration: point.duration,
      ease: 'power2.inOut',  // 缓动函数：先加速后减速
    })

    // 添加看向目标点的动画
    // 用一个临时对象来存储 lookAt 目标
    const lookAtTarget = { x: pathPoints[index - 1].lookAt.x, y: pathPoints[index - 1].lookAt.y, z: pathPoints[index - 1].lookAt.z }
    timeline.to(lookAtTarget, {
      x: point.lookAt.x,
      y: point.lookAt.y,
      z: point.lookAt.z,
      duration: point.duration,
      ease: 'power2.inOut',
      onUpdate: () => {
        manager.camera.lookAt(lookAtTarget.x, lookAtTarget.y, lookAtTarget.z)
      },
    }, '<')  // '<' 表示和前一个动画同时开始
  })

  // ========== 4. 控制面板 ==========

  const panel = new ControlPanel()

  // 播放/暂停按钮
  let isPlaying = false
  panel.addButton({
    id: 'play-pause',
    label: '▶ 播放',
    type: 'button',
    onClick: () => {
      isPlaying = !isPlaying
      if (isPlaying) {
        timeline.play()
        const btn = document.querySelector('#control-play-pause') as HTMLButtonElement
        if (btn) btn.textContent = '⏸ 暂停'
      } else {
        timeline.pause()
        const btn = document.querySelector('#control-play-pause') as HTMLButtonElement
        if (btn) btn.textContent = '▶ 播放'
      }
    },
  })

  // 重置按钮
  panel.addButton({
    id: 'reset',
    label: '↺ 重置',
    type: 'button',
    onClick: () => {
      timeline.restart()
      timeline.pause()
      isPlaying = false
      const btn = document.querySelector('#control-play-pause') as HTMLButtonElement
      if (btn) btn.textContent = '▶ 播放'
    },
  })

  // 速度滑块
  panel.addSlider({
    id: 'speed',
    label: '播放速度：',
    type: 'slider',
    min: 0.1,
    max: 3,
    step: 0.1,
    defaultValue: 1,
    onChange: (value) => {
      timeline.timeScale(value)
    },
  })

  // 显示/隐藏路径
  let pathLine: THREE.Line | null = null
  panel.addCheckbox({
    id: 'show-path',
    label: '显示路径线',
    type: 'checkbox',
    defaultValue: true,
    onChange: (checked) => {
      if (pathLine) {
        pathLine.visible = checked
      }
    },
  })

  // ========== 5. 可视化路径 ==========

  /**
   * 绘制相机路径线
   *
   * 用 THREE.Line 连接所有路径点，方便预览
   */
  const pathGeometry = new THREE.BufferGeometry().setFromPoints(
    pathPoints.map((p) => p.position)
  )
  const pathMaterial = new THREE.LineBasicMaterial({ color: 0xffd43b })
  pathLine = new THREE.Line(pathGeometry, pathMaterial)
  manager.scene.add(pathLine)

  // 在每个路径点添加小球标记
  pathPoints.forEach((point, index) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 8),
      new THREE.MeshBasicMaterial({ color: index === 0 ? 0x00ff00 : 0xff0000 })
    )
    marker.position.copy(point.position)
    manager.scene.add(marker)
  })

  // ========== 6. 动画循环 ==========

  manager.onUpdate(() => {
    // GSAP 的更新由 timeline 自动处理
    // 这里可以添加其他逻辑
  })

  manager.start()

  // 控制台提示
  console.log('=== 第 5 课课后作业：GSAP 相机路径动画 ===')
  console.log('操作说明：')
  console.log('  - 点击"播放"按钮开始动画')
  console.log('  - 拖动"播放速度"滑块调整速度')
  console.log('  - 勾选"显示路径线"查看相机轨迹')
  console.log('')
  console.log('观察要点：')
  console.log('  - 相机沿路径平滑移动')
  console.log('  - 相机始终看向目标点')
  console.log('  - 缓动函数让运动更自然')
}

init()
