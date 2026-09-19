/**
 * 第 15 课课后作业：粒子系统
 *
 * 作业要求：做一个 10 万粒子的流动效果
 * 1. 用 BufferGeometry + Points 搭粒子系统，位置更新放进顶点着色器（GPU 方式）
 * 2. 粒子数上到 10 万且帧率稳定（用 stats 面板确认）
 * 3. 有流动感：位置随 uTime 周期变化（噪声或正弦均可），大小或颜色随位置/速度变化
 * 进阶（可选）：鼠标移动时扰动附近的粒子流
 * 参考案例：src/lessons/15-particles/main.ts（GPU 粒子的 buffer 布局可对照）
 *
 * 运行方式：pnpm dev 启动后，地址栏加 #homework-15 选课
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
