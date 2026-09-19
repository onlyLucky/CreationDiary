/**
 * 第 14 课课后作业：后处理效果
 *
 * 作业要求：给场景加上 Bloom + 色彩校正 + Vignette
 * 1. 用 EffectComposer 串起 RenderPass + UnrealBloomPass，让场景有辉光
 * 2. 自写一个 ShaderPass 同时做色彩校正（对比度/饱和度至少其一）和 Vignette 暗角
 * 3. 调出两组不同风格的参数（如冷色科幻、暖色复古），感受后处理对氛围的影响
 * 进阶（可选）：加 FXAA 抗锯齿，对比开与关的边缘差异
 * 参考案例：src/lessons/14-post-processing/main.ts（EffectComposer 串联顺序可对照）
 *
 * 运行方式：pnpm dev 启动后，地址栏加 #homework-14 选课
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
