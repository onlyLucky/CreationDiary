/**
 * 第 17 课课后作业：滚动驱动动画
 *
 * 作业要求：做一个滚动驱动的 3D 场景切换 demo
 * 1. 页面高度超过一屏，滚动进度映射到 3D 场景状态（相机运动或物体变换）
 * 2. 至少两个「章节」，章节之间过渡平滑（lerp 或 GSAP）
 * 3. 快速滚动不跳变：对滚动值做阻尼/插值平滑后再驱动场景
 * 进阶（可选）：HTML 文案随进度显隐，与 3D 画面对应
 * 参考案例：src/lessons/17-scroll-animation/main.ts（滚动监听结构可对照）
 *
 * 运行方式：pnpm dev 启动后，地址栏加 #homework-17 选课
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
