/**
 * 第 18 课课后作业：创意交互
 *
 * 作业内容：待定
 * 参考案例：待定
 *
 * 运行方式：
 * 1. 修改 src/main.ts 的 MODE 为 'homework'
 * 2. 将 import 路径指向 './homework/18-creative-interaction/main'
 * 3. 运行 pnpm dev 启动开发服务器
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
