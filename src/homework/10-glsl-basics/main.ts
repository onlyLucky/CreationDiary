/**
 * 第 10 课课后作业：GLSL 基础
 *
 * 作业目标：
 * 1. 用 ShaderMaterial 实现一个自定义效果
 * 2. 掌握 uniform 传参和 varying 插值
 * 3. 理解坐标系变换在实际效果中的应用
 *
 * 作业要求：写一个渐变色 shader，用 uniform 传入时间让颜色随时间变化
 * 1. 创建一个平面网格，挂 ShaderMaterial，片元着色器里用 uv 做双色渐变
 * 2. 声明 uTime uniform 并每帧更新，让颜色随时间流动（色相偏移或双色插值均可）
 * 3. 验收标准：改一个 uniform 值画面立刻变化，说明传参链路已打通
 * 进阶（可选）：用 varying 把顶点位置插值传给片元，做对角渐变
 * 参考案例：src/lessons/10-glsl-basics/main.ts（uniform/varying 基本写法可对照）
 */

import { SceneManager } from '@/core/SceneManager'

function init() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement

  const manager = new SceneManager({
    canvas,
    bgColor: '#111111',
  })

  // 在这里实现作业：创建平面网格 + ShaderMaterial，
  // 顶点/片元着色器以内联字符串写在下方，uTime 在动画循环里累加更新。
  // 对照上方「作业要求」三条逐条完成。

  manager.start()
}

init()
