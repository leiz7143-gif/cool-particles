// 粒子系统核心类 - 优化版本，粒子更小更密集
export class Particle {
  constructor(x, y, canvas) {
    this.x = x
    this.y = y
    this.canvas = canvas
    this.originX = x
    this.originY = y
    this.vx = 0
    this.vy = 0
    this.size = 1.2
    this.targetX = null
    this.targetY = null
    this.targetType = null // 'hand' 或 'face'，用于区分
    this.color = { r: 255, g: 120, b: 50 }
    this.alpha = 0.9
    this.assigned = false
  }

  // 更新粒子位置
  update(attractMode) {
    const hasTarget = this.targetX !== null && this.targetY !== null

    if (hasTarget) {
      const dx = this.targetX - this.x
      const dy = this.targetY - this.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (attractMode) {
        // 吸引模式 - 快速精确跟随
        const speed = 0.35
        this.vx = dx * speed
        this.vy = dy * speed
      } else {
        // 排斥模式
        if (distance < 150) {
          const force = (150 - distance) * 0.12
          const angle = Math.atan2(dy, dx)
          this.vx -= Math.cos(angle) * force
          this.vy -= Math.sin(angle) * force
        }
        this.vx *= 0.92
        this.vy *= 0.92
      }
      
      this.alpha = distance < 20 ? 0.95 : 0.8
    } else {
      // 无目标时散开
      const dx = this.originX - this.x
      const dy = this.originY - this.y
      this.vx = dx * 0.03
      this.vy = dy * 0.03
      this.alpha = 0.15
    }

    // 限制最大速度
    const maxSpeed = 60
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy)
    if (speed > maxSpeed) {
      this.vx = (this.vx / speed) * maxSpeed
      this.vy = (this.vy / speed) * maxSpeed
    }

    this.x += this.vx
    this.y += this.vy

    // 边界处理
    if (this.x < 0) this.x = 0
    if (this.x > this.canvas.width) this.x = this.canvas.width
    if (this.y < 0) this.y = 0
    if (this.y > this.canvas.height) this.y = this.canvas.height
  }
}

// 颜色主题
export const COLOR_THEMES = {
  rainbow: {
    name: '彩虹',
    getColor: (index, total) => {
      const hue = (index / total) * 360
      return hslToRgb(hue, 100, 50)
    }
  },
  fire: {
    name: '火焰',
    getColor: (index, total) => {
      const t = index / total
      return {
        r: 255,
        g: Math.floor(100 * t + 50),
        b: Math.floor(30 * t)
      }
    }
  },
  ocean: {
    name: '海洋',
    getColor: (index, total) => {
      const t = index / total
      return {
        r: Math.floor(30 * t),
        g: Math.floor(150 + 105 * t),
        b: 255
      }
    }
  },
  galaxy: {
    name: '银河',
    getColor: (index, total) => {
      const t = index / total
      return {
        r: Math.floor(150 + 105 * t),
        g: Math.floor(50 + 100 * t),
        b: 255
      }
    }
  },
  matrix: {
    name: '矩阵',
    getColor: (index, total) => {
      const t = index / total
      return {
        r: 0,
        g: Math.floor(150 + 105 * t),
        b: Math.floor(50 * t)
      }
    }
  }
}

// HSL转RGB
function hslToRgb(h, s, l) {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = n => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
  }
  return {
    r: Math.round(f(0) * 255),
    g: Math.round(f(8) * 255),
    b: Math.round(f(4) * 255)
  }
}

// 粒子系统管理器 - 分离手部和面部粒子池
export class ParticleManager {
  constructor(canvas, particleCount = 8000) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.handParticles = []      // 手部粒子池
    this.faceParticles = []      // 面部粒子池
    this.idleParticles = []      // 空闲粒子池
    this.particleCount = particleCount
    this.handTargets = []
    this.faceTargets = []
    this.attractMode = true
    this.currentTheme = 'fire'
    this.themeKeys = Object.keys(COLOR_THEMES)
    this.themeIndex = 1
    this.init()
  }

  // 初始化粒子
  init() {
    const allParticles = []
    for (let i = 0; i < this.particleCount; i++) {
      const x = Math.random() * this.canvas.width
      const y = Math.random() * this.canvas.height
      const particle = new Particle(x, y, this.canvas)
      particle.size = 1 + Math.random() * 0.5 // 1-1.5px 小粒子
      this.updateParticleColor(particle, i)
      allParticles.push(particle)
    }
    
    // 初始时所有粒子都是空闲的
    this.idleParticles = allParticles
    this.handParticles = []
    this.faceParticles = []
  }

  // 更新粒子颜色
  updateParticleColor(particle, index) {
    const theme = COLOR_THEMES[this.currentTheme]
    particle.color = theme.getColor(index, this.particleCount)
  }

  // 切换主题
  nextTheme() {
    this.themeIndex = (this.themeIndex + 1) % this.themeKeys.length
    this.currentTheme = this.themeKeys[this.themeIndex]
    const allParticles = [...this.handParticles, ...this.faceParticles, ...this.idleParticles]
    allParticles.forEach((p, i) => this.updateParticleColor(p, i))
    return COLOR_THEMES[this.currentTheme].name
  }

  // 切换吸引/排斥模式
  toggleMode() {
    this.attractMode = !this.attractMode
    return this.attractMode ? '吸引' : '排斥'
  }

  // 分别设置手部和面部目标
  setTargets(handTargets, faceTargets) {
    this.handTargets = handTargets || []
    this.faceTargets = faceTargets || []
  }

  // 更新所有粒子 - 简化版本，直接分配到目标
  update() {
    // 合并所有目标
    const allTargets = [...this.handTargets, ...this.faceTargets]
    const targetCount = allTargets.length
    const allParticles = [...this.handParticles, ...this.faceParticles, ...this.idleParticles]
    
    // 确保粒子池正确
    if (allParticles.length === 0) return
    
    if (targetCount === 0) {
      // 没有目标，粒子回到原点
      allParticles.forEach(particle => {
        particle.targetX = null
        particle.targetY = null
      })
    } else {
      // 将粒子均匀分配到目标点
      allParticles.forEach((particle, index) => {
        // 循环分配到各个目标
        const targetIndex = index % targetCount
        const target = allTargets[targetIndex]
        
        // 在目标点周围小范围随机偏移
        const offsetAngle = (index * 2.399) % (Math.PI * 2)
        const offsetRadius = (index % 5) * 1.5
        
        particle.targetX = target.x + Math.cos(offsetAngle) * offsetRadius
        particle.targetY = target.y + Math.sin(offsetAngle) * offsetRadius
        particle.size = target.size || 1.2
      })
    }
    
    // 更新粒子位置
    allParticles.forEach(p => p.update(this.attractMode))
    
    // 重新整理粒子池
    this.handParticles = allParticles.slice(0, Math.floor(allParticles.length / 2))
    this.faceParticles = allParticles.slice(Math.floor(allParticles.length / 2))
    this.idleParticles = []
  }

  // 绘制所有粒子
  draw() {
    // 清除画布
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    // 批量绘制所有粒子
    const allParticles = [...this.handParticles, ...this.faceParticles, ...this.idleParticles]
    
    // 按颜色分组绘制
    const colorGroups = new Map()
    allParticles.forEach(p => {
      const key = `${p.color.r},${p.color.g},${p.color.b}`
      if (!colorGroups.has(key)) colorGroups.set(key, [])
      colorGroups.get(key).push(p)
    })

    colorGroups.forEach((particles, colorKey) => {
      const [r, g, b] = colorKey.split(',').map(Number)
      
      this.ctx.beginPath()
      particles.forEach(p => {
        this.ctx.moveTo(p.x + p.size, p.y)
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      })
      this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.9)`
      this.ctx.fill()
    })
  }

  // 调整画布大小
  resize(width, height) {
    this.canvas.width = width
    this.canvas.height = height
    const allParticles = [...this.handParticles, ...this.faceParticles, ...this.idleParticles]
    allParticles.forEach(p => {
      p.originX = Math.random() * width
      p.originY = Math.random() * height
    })
  }
}
