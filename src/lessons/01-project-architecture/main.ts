/**
 * 第 1 课：Three.js 项目架构
 *
 * 学习目标：
 * 1. 理解 SceneManager 的模块化设计
 * 2. 掌握 requestAnimationFrame + delta time 的动画循环
 * 3. 学会资源注册与自动清理
 *
 * 练习：从零搭建一个干净的 Three.js 项目骨架
 */

import * as THREE from 'three'
import { SceneManager } from '@/core/SceneManager'

/** 初始化场景 */
function init() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement

  // 创建场景管理器
  const manager = new SceneManager({
    canvas,
    bgColor: '#0a0a0a',
    fov: 75,
  })

  // 将相机往后移，才能看到物体
  manager.camera.position.z = 5

  // 创建一个立方体
  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const material = new THREE.MeshNormalMaterial()
  const cube = new THREE.Mesh(geometry, material)
  manager.scene.add(cube)

  // 注册资源清理（geometry 和 material 会在 dispose 时自动清理）
  manager.registerDisposable(geometry)
  manager.registerDisposable(material)

  // 注册每帧更新
  let rotationSpeed = 1 // 每秒旋转的弧度
  manager.onUpdate((delta, elapsed) => {
    // 用 delta time 控制旋转速度，保证在不同帧率下表现一致
    cube.rotation.x += rotationSpeed * delta
    cube.rotation.y += rotationSpeed * delta * 0.7

    // 用 elapsed 做周期性动画（上下浮动）
    cube.position.y = Math.sin(elapsed * 2) * 0.3
  })

  // 启动动画循环
  manager.start()

  // 控制台提示
  console.log('=== 第 1 课：项目架构 ===')
  console.log('SceneManager 负责：')
  console.log('  1. 管理 Scene/Camera/Renderer 三件套')
  console.log('  2. 统一的动画循环（带 delta time）')
  console.log('  3. 窗口自适应')
  console.log('  4. 资源清理（防止内存泄漏）')
  console.log('')
  console.log('观察控制台：')
  console.log('  - 缩放窗口时会输出分辨率变化日志')
  console.log('  - 按 F12 打开 DevTools 查看')
}

init()
