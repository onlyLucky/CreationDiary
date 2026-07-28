/**
 * 加载界面 LoadingScreen
 *
 * 与 ControlPanel 类似，完全在 TS 中构建 DOM，不依赖 index.html 中预置元素。
 * 用法：
 *   const loader = new LoadingScreen({ title: '加载中…' })
 *   loader.show()
 *   loader.update(0.4)            // 0~1
 *   loader.hide()                 // 淡出后移除
 */

export interface LoadingScreenOptions {
  /** 标题文字 */
  title?: string
  /** 是否自动注入到 body（默认 true） */
  autoMount?: boolean
  /** 进度条渐变颜色 */
  gradientFrom?: string
  gradientTo?: string
  /** 背景色 */
  background?: string
}

export class LoadingScreen {
  private root: HTMLDivElement
  private bar: HTMLDivElement
  private text: HTMLSpanElement
  private mounted: boolean

  constructor(options: LoadingScreenOptions = {}) {
    const {
      title = '加载中…',
      autoMount = true,
      gradientFrom = '#4f46e5',
      gradientTo = '#7c3aed',
      background = '#111',
    } = options

    this.mounted = false

    // 外层
    this.root = document.createElement('div')
    this.root.className = 'loading-screen'
    this.root.style.cssText = [
      'position: fixed',
      'top: 0',
      'left: 0',
      'width: 100%',
      'height: 100%',
      `background: ${background}`,
      'display: none',
      'flex-direction: column',
      'justify-content: center',
      'align-items: center',
      'z-index: 100',
      'transition: opacity 0.5s ease',
    ].join('; ')

    // 标题
    const heading = document.createElement('h2')
    heading.className = 'loading-screen__title'
    heading.textContent = title
    heading.style.cssText = 'color: #fff; margin-bottom: 20px; font-family: sans-serif;'

    // 进度条容器
    const barTrack = document.createElement('div')
    barTrack.className = 'loading-screen__track'
    barTrack.style.cssText = 'width: 300px; background: #333; border-radius: 10px; overflow: hidden;'

    // 进度条
    this.bar = document.createElement('div')
    this.bar.className = 'loading-screen__bar'
    this.bar.style.cssText = [
      'width: 0%',
      'height: 8px',
      `background: linear-gradient(90deg, ${gradientFrom}, ${gradientTo})`,
      'border-radius: 10px',
      'transition: width 0.3s ease',
    ].join('; ')

    barTrack.appendChild(this.bar)

    // 百分比文字
    this.text = document.createElement('span')
    this.text.className = 'loading-screen__text'
    this.text.textContent = '0%'
    this.text.style.cssText = 'color: #aaa; margin-top: 10px; font-family: sans-serif; font-size: 14px;'

    this.root.appendChild(heading)
    this.root.appendChild(barTrack)
    this.root.appendChild(this.text)

    if (autoMount) {
      this.mount()
    }
  }

  /** 挂载到 body */
  mount(): void {
    if (this.mounted) return
    document.body.appendChild(this.root)
    this.mounted = true
  }

  /** 显示加载界面 */
  show(): void {
    if (!this.mounted) this.mount()
    this.root.style.opacity = '1'
    this.root.style.display = 'flex'
  }

  /** 更新进度 (0~1) */
  update(progress: number): void {
    const p = Math.max(0, Math.min(1, progress))
    this.bar.style.width = `${p * 100}%`
    this.text.textContent = `${Math.round(p * 100)}%`
  }

  /** 隐藏并从 DOM 中移除 */
  hide(): void {
    this.root.style.opacity = '0'
    setTimeout(() => {
      this.root.style.display = 'none'
    }, 500)
  }

  /** 完全销毁 */
  destroy(): void {
    if (this.mounted && this.root.parentElement) {
      this.root.parentElement.removeChild(this.root)
    }
    this.mounted = false
  }
}
