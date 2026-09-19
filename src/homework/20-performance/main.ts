/**
 * 第 20 课课后作业：性能调优与部署
 *
 * 作业要求：把作品优化到 60fps，部署上线
 * 1. 用性能面板（stats 或浏览器 Performance）定位瓶颈，记录优化前帧率
 * 2. 至少应用两种优化（实例化/合批、纹理压缩、按需渲染、LOD 任选），记录优化前后对比
 * 3. 部署上线（Vercel / Netlify / GitHub Pages 任一），附访问链接
 * 进阶（可选）：跑一次 Lighthouse 记录分数
 * 参考案例：src/lessons/20-performance/main.ts（实例重建与性能手段可对照）
 *
 * 运行方式：pnpm dev 启动后，地址栏加 #homework-20 选课
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
