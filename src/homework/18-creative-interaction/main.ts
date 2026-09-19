/**
 * 第 18 课课后作业：创意交互
 *
 * 作业要求：做一个鼠标跟随的 3D 涟漪效果
 * 1. 鼠标位置作为 uniform 传入 shader，归一化到平面坐标系
 * 2. 点击（或移动）产生从鼠标点扩散的涟漪，随时间衰减消失
 * 3. 支持连续多次点击，多个波源共存（记录最近几个点击点传入 shader）
 * 进阶（可选）：波纹叠加水面高光或折射扭曲
 * 参考案例：src/lessons/18-creative-interaction/main.ts（鼠标交互与着色器联动可对照）
 *
 * 运行方式：pnpm dev 启动后，地址栏加 #homework-18 选课
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
