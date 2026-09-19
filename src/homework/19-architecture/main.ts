/**
 * 第 19 课课后作业：网站架构设计
 *
 * 作业要求：设计网站架构图，实现场景切换 + Loading 页
 * 1. 先画架构图（场景划分、资源加载、路由方式），放在本目录 README 或代码注释里
 * 2. 实现 Loading 页：资源加载完成再进场（用 LoadingManager 管理进度）
 * 3. 实现场景切换：hash 路由或按钮切换，切换时销毁旧场景资源（dispose 防内存泄漏）
 * 进阶（可选）：加载进度条、加载失败重试
 * 参考案例：src/lessons/19-architecture/main.ts（hash 路由与 dispose 流程可对照）
 *
 * 运行方式：pnpm dev 启动后，地址栏加 #homework-19 选课
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
