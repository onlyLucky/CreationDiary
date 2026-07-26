/**
 * 第 8 课课后作业：Loading 进度条 + 模型动画播放
 *
 * 作业要求：
 * 1. 实现一个美观的 Loading 进度条（30 分）
 * 2. 加载带动画的 GLTF 模型（25 分）
 * 3. 动画播放控制（播放/暂停/切换）（25 分）
 * 4. 控制面板（20 分）
 *
 * TODO: 完成课后作业代码
 */

import * as THREE from 'three'
import { SceneManager } from '@/core/SceneManager'

function init() {
  const canvas = document.getElementById('homework_canvas') as HTMLCanvasElement
  const manager = new SceneManager({
    canvas,
    bgColor: '#111111',
    fov: 50,
  })

  manager.camera.position.set(5, 3, 5)
  manager.camera.lookAt(0, 0, 0)

  // TODO: 实现 Loading 进度条
  // TODO: 加载 GLTF 模型
  // TODO: 实现动画播放控制
  // TODO: 添加控制面板

  manager.start()
}

init()
