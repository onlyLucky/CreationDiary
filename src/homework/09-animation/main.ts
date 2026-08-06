/**
 * 第 9 课课后作业：动画系统
 *
 * TODO: 完成课后作业
 */

import * as THREE from 'three'
import { SceneManager } from '@/core/SceneManager'

function init() {
  const canvas = document.getElementById('homework_canvas') as HTMLCanvasElement
  const manager = new SceneManager({ canvas, bgColor: '#111111', fov: 50 })
  manager.camera.position.set(5, 3, 5)
  manager.camera.lookAt(0, 0, 0)
  manager.start()
}

init()
