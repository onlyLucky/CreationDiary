/**入口文件 - 切换不同的课程
 *
 * 切换方式：修改 MODE 变量
 *   'lessons'  - 渲染课程
 *   'homework' - 渲染作业
 */

type Mode = 'lessons' | 'homework'

const MODE = 'lessons' as Mode

// 根据模式显示/隐藏对应的 canvas 容器
const lessonsCanvas = document.getElementById('canvas')
const homeworkContainer = document.getElementById('homework')

if (lessonsCanvas) {
  lessonsCanvas.style.display = MODE === 'lessons' ? 'block' : 'none'
}
if (homeworkContainer) {
  homeworkContainer.style.display = MODE === 'homework' ? 'block' : 'none'
}

// 根据模式动态导入对应的模块
if (MODE === 'lessons') {
  import('./lessons/08-model-loading/main')
} else {
  import('./homework/08-model-loading/main')
}
