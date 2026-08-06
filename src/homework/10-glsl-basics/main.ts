/**
 * 第 10 课课后作业：GLSL 基础
 *
 * 作业目标：
 * 1. 用 ShaderMaterial 实现一个自定义效果
 * 2. 掌握 uniform 传参和 varying 插值
 * 3. 理解坐标系变换在实际效果中的应用
 *
 * 基础代码框架（待补充）
 */

import { SceneManager } from '@/core/SceneManager'

function init() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement

  const manager = new SceneManager({
    canvas,
    bgColor: '#111111',
  })

  /** TODO: 在这里实现你的 shader 效果 */

  manager.start()
}

init()
