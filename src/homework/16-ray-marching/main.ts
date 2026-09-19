/**
 * 第 16 课课后作业：Ray Marching & SDF
 *
 * 作业要求：用纯 shader 画一个 metaball（融球）效果
 * 1. 全屏平面上用 fragment shader 做 ray marching，不依赖任何几何体
 * 2. 至少两个 SDF 圆用 smooth min 融合，靠近时能看到「黏在一起」的过渡
 * 3. 有基础光照：法线由距离场梯度求得，至少含漫反射
 * 进阶（可选）：让其中一个球跟随鼠标移动
 * 参考案例：src/lessons/16-ray-marching/main.ts（ray marching 主循环与法线估算可对照）
 *
 * 运行方式：pnpm dev 启动后，地址栏加 #homework-16 选课
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
