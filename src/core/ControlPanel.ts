/**
 * 通用 UI 控制面板
 * 
 * 支持的控件类型：
 * - select: 下拉选择
 * - slider: 滑块
 * - checkbox: 复选框
 * - button: 按钮
 */

export interface ControlOption {
  value: string
  label: string
}

export interface BaseControl {
  id: string
  label: string
  type: 'select' | 'slider' | 'checkbox' | 'button'
}

export interface SelectControl extends BaseControl {
  type: 'select'
  options: ControlOption[]
  defaultValue?: string
  onChange: (value: string) => void
}

export interface SliderControl extends BaseControl {
  type: 'slider'
  min: number
  max: number
  step: number
  defaultValue?: number
  onChange: (value: number) => void
}

export interface CheckboxControl extends BaseControl {
  type: 'checkbox'
  defaultValue?: boolean
  onChange: (checked: boolean) => void
}

export interface ButtonControl extends BaseControl {
  type: 'button'
  onClick: () => void
}

export type Control = SelectControl | SliderControl | CheckboxControl | ButtonControl

export class ControlPanel {
  private container: HTMLElement
  private controls: Map<string, HTMLElement> = new Map()

  constructor(containerId: string = 'controls') {
    const container = document.getElementById(containerId)
    if (!container) {
      throw new Error(`Control panel container #${containerId} not found`)
    }
    this.container = container
  }

  /** 添加下拉选择控件 */
  addSelect(config: SelectControl): void {
    const wrapper = document.createElement('div')
    wrapper.className = 'control-item'

    const label = document.createElement('label')
    label.textContent = config.label
    label.htmlFor = `control-${config.id}`

    const select = document.createElement('select')
    select.id = `control-${config.id}`

    config.options.forEach((opt) => {
      const option = document.createElement('option')
      option.value = opt.value
      option.textContent = opt.label
      select.appendChild(option)
    })

    if (config.defaultValue) {
      select.value = config.defaultValue
    }

    select.addEventListener('change', () => {
      config.onChange(select.value)
    })

    wrapper.appendChild(label)
    wrapper.appendChild(select)
    this.container.appendChild(wrapper)
    this.controls.set(config.id, select)
  }

  /** 添加滑块控件 */
  addSlider(config: SliderControl): void {
    const wrapper = document.createElement('div')
    wrapper.className = 'control-item'

    const label = document.createElement('label')
    label.textContent = config.label
    label.htmlFor = `control-${config.id}`

    const valueDisplay = document.createElement('span')
    valueDisplay.className = 'slider-value'
    valueDisplay.textContent = String(config.defaultValue ?? config.min)

    const slider = document.createElement('input')
    slider.type = 'range'
    slider.id = `control-${config.id}`
    slider.min = String(config.min)
    slider.max = String(config.max)
    slider.step = String(config.step)
    slider.value = String(config.defaultValue ?? config.min)

    slider.addEventListener('input', () => {
      const value = parseFloat(slider.value)
      valueDisplay.textContent = String(value)
      config.onChange(value)
    })

    wrapper.appendChild(label)
    wrapper.appendChild(valueDisplay)
    wrapper.appendChild(slider)
    this.container.appendChild(wrapper)
    this.controls.set(config.id, slider)
  }

  /** 添加复选框控件 */
  addCheckbox(config: CheckboxControl): void {
    const wrapper = document.createElement('div')
    wrapper.className = 'control-item control-checkbox'

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.id = `control-${config.id}`
    checkbox.checked = config.defaultValue ?? false

    const label = document.createElement('label')
    label.textContent = config.label
    label.htmlFor = `control-${config.id}`

    checkbox.addEventListener('change', () => {
      config.onChange(checkbox.checked)
    })

    wrapper.appendChild(checkbox)
    wrapper.appendChild(label)
    this.container.appendChild(wrapper)
    this.controls.set(config.id, checkbox)
  }

  /** 添加按钮控件 */
  addButton(config: ButtonControl): void {
    const wrapper = document.createElement('div')
    wrapper.className = 'control-item'

    const button = document.createElement('button')
    button.id = `control-${config.id}`
    button.textContent = config.label
    button.addEventListener('click', config.onClick)

    wrapper.appendChild(button)
    this.container.appendChild(wrapper)
    this.controls.set(config.id, button)
  }

  /** 添加控件（自动识别类型） */
  addControl(config: Control): void {
    switch (config.type) {
      case 'select':
        this.addSelect(config)
        break
      case 'slider':
        this.addSlider(config)
        break
      case 'checkbox':
        this.addCheckbox(config)
        break
      case 'button':
        this.addButton(config)
        break
    }
  }

  /** 批量添加控件 */
  addControls(configs: Control[]): void {
    configs.forEach((config) => this.addControl(config))
  }

  /** 获取控件元素 */
  getControl(id: string): HTMLElement | undefined {
    return this.controls.get(id)
  }

  /** 设置控件值（不触发 onChange） */
  setValue(id: string, value: string | number | boolean): void {
    const element = this.controls.get(id)
    if (!element) return

    if (element instanceof HTMLSelectElement) {
      element.value = String(value)
    } else if (element instanceof HTMLInputElement) {
      if (element.type === 'range') {
        element.value = String(value)
        // 更新滑块后面的数值显示
        const valueDisplay = element.parentElement?.querySelector('.slider-value')
        if (valueDisplay) {
          valueDisplay.textContent = String(value)
        }
      } else if (element.type === 'checkbox') {
        element.checked = Boolean(value)
      }
    }
  }

  /** 清空所有控件 */
  clear(): void {
    this.container.innerHTML = ''
    this.controls.clear()
  }
}
