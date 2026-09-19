/**
 * 入口文件 - 按 URL hash 选择课程
 *
 * 用法：地址栏加 #lesson-17 或 #homework-12
 * 无 hash 时显示课程门户（index.html 内的 #portal），
 * 点击门户条目（锚点 href）设置 hash 后自动加载对应课程；
 * 带 hash 直接进入时门户不出现。
 */

const lessonModules = import.meta.glob('./lessons/*/main.ts')
const homeworkModules = import.meta.glob('./homework/*/main.ts')

type Target = { type: 'lessons' | 'homework'; id: string }

/** 解析地址栏 hash，支持 #lesson-N 与 #homework-N（N 写 3 或 03 都能识别） */
function parseHash(): Target | null {
  const m = location.hash.match(/^#(lesson|homework)-(\d+)$/)
  if (!m) return null
  return { type: m[1] === 'lesson' ? 'lessons' : 'homework', id: m[2].padStart(2, '0') }
}

const portal = document.getElementById('portal')

function showPortal() {
  if (portal) portal.style.display = ''
}

function hidePortal() {
  if (portal) portal.style.display = 'none'
}

/** 是否已经加载过一次课程（切换课程时需要整页刷新，避免新旧场景叠加） */
let loaded = false

/** 按目标加载课程或作业模块（canvas 切换 + 动态 import） */
async function loadTarget(target: Target) {
  // 根据课程类型显示/隐藏对应的 canvas 容器（homework 模块用 #homework 里的画布）
  const lessonsCanvas = document.getElementById('canvas')
  const homeworkContainer = document.getElementById('homework')
  if (lessonsCanvas) {
    lessonsCanvas.style.display = target.type === 'lessons' ? 'block' : 'none'
  }
  if (homeworkContainer) {
    homeworkContainer.style.display = target.type === 'homework' ? 'block' : 'none'
  }

  const modules = target.type === 'lessons' ? lessonModules : homeworkModules
  // 目录名是 01-project-architecture 这种「课号-名字」格式，按课号前缀匹配
  const entry = Object.keys(modules).find((path) => path.includes(`/${target.id}-`))
  if (!entry) {
    console.warn(`未找到课程：${location.hash}，返回门户`)
    showPortal()
    return
  }
  loaded = true
  await modules[entry]()
}

function boot() {
  const initial = parseHash()
  if (initial) {
    // 带 hash 直接进入：门户不出现
    hidePortal()
    loadTarget(initial)
  }

  window.addEventListener('hashchange', () => {
    if (loaded) {
      // 已有课程在跑：刷新页面让新课在干净状态下加载（hash 会保留）
      location.reload()
      return
    }
    const target = parseHash()
    if (!target) {
      // hash 被清空：回到门户
      showPortal()
      return
    }
    hidePortal()
    loadTarget(target)
  })
}

boot()
