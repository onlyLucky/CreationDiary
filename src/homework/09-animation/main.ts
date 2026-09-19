/**
 * 第 9 课课后作业：动画系统
 *
 * 作业要求：用 GSAP 做一个物体从 A 点平滑移动到 B 点的动画
 * 1. 在场景里放一个物体（球或方块都行），起点 A、终点 B 自定
 * 2. 用 gsap.to 驱动物体 position，至少试两种缓动函数（如 power2.out、elastic.out）对比手感
 * 3. 动画可重复触发（如点击画面重新播放）
 * 进阶（可选）：给移动过程加轨迹拖尾或相机跟随
 * 参考案例：src/lessons/09-animation/main.ts（动画循环与 Clock 用法可对照）
 */

import { SceneManager } from '@/core/SceneManager'
// 若项目未安装 GSAP，先执行 pnpm add gsap，再 import gsap from 'gsap'

function init() {
  const canvas = document.getElementById('homework_canvas') as HTMLCanvasElement
  const manager = new SceneManager({ canvas, bgColor: '#111111', fov: 50 })
  manager.camera.position.set(5, 3, 5)
  manager.camera.lookAt(0, 0, 0)
  manager.start()
}

init()
