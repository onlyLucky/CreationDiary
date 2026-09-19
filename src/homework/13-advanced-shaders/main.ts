/**
 * 第 13 课课后作业：高级 Shader 效果
 *
 * 作业要求：复刻一个消融过渡（Dissolve）效果
 * 1. 用噪声（贴图或 hash 函数）+ uProgress 控制片元 discard，物体逐渐消散
 * 2. 消散边缘有发光带：噪声值接近阈值的区域染上亮色
 * 3. uProgress 可交互调节（滑杆、滚轮或点击均可），来回拖动消散可逆
 * 进阶（可选）：换一张噪声图对比效果差异，或叠加全息扫描线（Hologram）
 * 参考案例：src/lessons/13-advanced-shaders/main.ts（Dissolve 与 Hologram 实现可对照）
 *
 * 运行方式：pnpm dev 启动后，地址栏加 #homework-13 选课
 * 模板说明：下方旋转立方体只是起点骨架，先跑通运行，再把它替换为作业内容。
 */

import * as THREE from 'three'
import { SceneManager } from '@/core/SceneManager'

function init() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement
  const manager = new SceneManager({ canvas, bgColor: '#0a0a0a' })

  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const material = new THREE.MeshNormalMaterial()
  const cube = new THREE.Mesh(geometry, material)
  manager.scene.add(cube)

  function animate() {
    requestAnimationFrame(animate)
    cube.rotation.y += 0.01
    manager.renderer.render(manager.scene, manager.camera)
  }
  animate()
}

init()
