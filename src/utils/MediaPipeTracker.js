// MediaPipe 手部和面部追踪工具类

// 手部连接关系（骨骼）
export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],      // 拇指
  [0, 5], [5, 6], [6, 7], [7, 8],      // 食指
  [0, 9], [9, 10], [10, 11], [11, 12], // 中指
  [0, 13], [13, 14], [14, 15], [15, 16], // 无名指
  [0, 17], [17, 18], [18, 19], [19, 20], // 小指
  [5, 9], [9, 13], [13, 17]             // 掌心连接
]

// 指尖索引
export const FINGERTIPS = [4, 8, 12, 16, 20]

// 手腕索引
export const WRIST = 0

// 面部区域索引
export const FACE_REGIONS = {
  // 左眼轮廓
  leftEye: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
  // 右眼轮廓
  rightEye: [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
  // 嘴唇轮廓
  lips: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78],
  // 面部轮廓
  faceOval: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
  // 鼻子
  nose: [1, 2, 98, 327, 168, 6, 197, 195, 5, 4, 19, 94, 2],
  // 眉毛
  leftEyebrow: [70, 63, 105, 66, 107, 55, 65, 52, 53, 46],
  rightEyebrow: [300, 293, 334, 296, 336, 285, 295, 282, 283, 276]
}

// 检测握拳手势
export function detectFist(landmarks) {
  if (!landmarks || landmarks.length < 21) return false
  
  // 计算指尖到手腕的距离
  const wrist = landmarks[WRIST]
  let foldedFingers = 0
  
  FINGERTIPS.forEach((tipIndex, i) => {
    const tip = landmarks[tipIndex]
    const base = landmarks[tipIndex - 2] // 指节基部
    
    const tipDist = Math.sqrt(
      Math.pow(tip.x - wrist.x, 2) + Math.pow(tip.y - wrist.y, 2)
    )
    const baseDist = Math.sqrt(
      Math.pow(base.x - wrist.x, 2) + Math.pow(base.y - wrist.y, 2)
    )
    
    // 如果指尖比指节基部更靠近手腕，则认为手指弯曲
    if (tipDist < baseDist * 1.1) {
      foldedFingers++
    }
  })
  
  // 至少4个手指弯曲才认为是握拳
  return foldedFingers >= 4
}

// 从手部地标生成粒子目标点 - 实心手形版本
export function generateHandTargets(landmarks, canvasWidth, canvasHeight, mirror = true) {
  if (!landmarks || landmarks.length === 0) return []
  
  const targets = []
  
  // 辅助函数：获取地标坐标
  const getPoint = (index) => {
    const lm = landmarks[index]
    return {
      x: mirror ? (1 - lm.x) * canvasWidth : lm.x * canvasWidth,
      y: lm.y * canvasHeight
    }
  }
  
  // 辅助函数：在两点之间填充 - 更密集
  const fillBetween = (p1, p2, width, count = 12) => {
    for (let t = 0; t <= 1; t += 1/count) {
      const x = p1.x + (p2.x - p1.x) * t
      const y = p1.y + (p2.y - p1.y) * t
      // 沿垂直方向填充宽度
      const dx = p2.x - p1.x
      const dy = p2.y - p1.y
      const len = Math.sqrt(dx*dx + dy*dy)
      if (len === 0) continue
      const nx = -dy / len
      const ny = dx / len
      
      // 更密集的宽度填充
      for (let w = -width/2; w <= width/2; w += 2) {
        targets.push({
          x: x + nx * w,
          y: y + ny * w,
          size: 1.2
        })
      }
    }
  }
  
  // 辅助函数：填充三角形区域 - 更密集
  const fillTriangle = (p1, p2, p3, density = 5) => {
    for (let i = 0; i <= density; i++) {
      for (let j = 0; j <= density - i; j++) {
        const k = density - i - j
        const x = (p1.x * i + p2.x * j + p3.x * k) / density
        const y = (p1.y * i + p2.y * j + p3.y * k) / density
        targets.push({ x, y, size: 1.2 })
      }
    }
  }
  
  // 辅助函数：填充四边形区域
  const fillQuad = (p1, p2, p3, p4, density = 6) => {
    for (let u = 0; u <= 1; u += 1/density) {
      for (let v = 0; v <= 1; v += 1/density) {
        // 双线性插值
        const top = { x: p1.x + (p2.x - p1.x) * u, y: p1.y + (p2.y - p1.y) * u }
        const bot = { x: p4.x + (p3.x - p4.x) * u, y: p4.y + (p3.y - p4.y) * u }
        const x = top.x + (bot.x - top.x) * v
        const y = top.y + (bot.y - top.y) * v
        targets.push({ x, y, size: 1.2 })
      }
    }
  }
  
  // 1. 填充手掌区域（手腕到各指根连接形成的区域）
  const wrist = getPoint(0)
  const thumb_cmc = getPoint(1)
  const index_mcp = getPoint(5)
  const middle_mcp = getPoint(9)
  const ring_mcp = getPoint(13)
  const pinky_mcp = getPoint(17)
  
  // 手掌中心
  const palmCenter = {
    x: (wrist.x + index_mcp.x + middle_mcp.x + ring_mcp.x + pinky_mcp.x) / 5,
    y: (wrist.y + index_mcp.y + middle_mcp.y + ring_mcp.y + pinky_mcp.y) / 5
  }
  
  // 填充手掌三角形 - 更高密度
  fillTriangle(wrist, index_mcp, palmCenter, 12)
  fillTriangle(wrist, pinky_mcp, palmCenter, 12)
  fillTriangle(index_mcp, middle_mcp, palmCenter, 10)
  fillTriangle(middle_mcp, ring_mcp, palmCenter, 10)
  fillTriangle(ring_mcp, pinky_mcp, palmCenter, 10)
  fillTriangle(thumb_cmc, index_mcp, palmCenter, 10)
  fillTriangle(wrist, thumb_cmc, palmCenter, 10)
  
  // 填充指根之间的区域
  fillQuad(index_mcp, middle_mcp, getPoint(10), getPoint(6), 8)
  fillQuad(middle_mcp, ring_mcp, getPoint(14), getPoint(10), 8)
  fillQuad(ring_mcp, pinky_mcp, getPoint(18), getPoint(14), 8)
  
  // 2. 填充每根手指（带宽度）- 更密集
  const fingerBases = [
    [1, 2, 3, 4],    // 拇指
    [5, 6, 7, 8],    // 食指
    [9, 10, 11, 12], // 中指
    [13, 14, 15, 16],// 无名指
    [17, 18, 19, 20] // 小指
  ]
  
  fingerBases.forEach((finger, fingerIdx) => {
    // 手指宽度：从根部到指尖逐渐变细 - 更宽
    const widths = fingerIdx === 0 ? [22, 18, 14, 10] : [20, 16, 12, 8]
    
    for (let i = 0; i < finger.length - 1; i++) {
      const p1 = getPoint(finger[i])
      const p2 = getPoint(finger[i + 1])
      const width = widths[i]
      fillBetween(p1, p2, width, 10)
    }
    
    // 指尖圆形填充 - 更密集
    const tip = getPoint(finger[finger.length - 1])
    for (let r = 0; r < 10; r += 1.5) {
      for (let a = 0; a < Math.PI * 2; a += 0.3) {
        targets.push({
          x: tip.x + Math.cos(a) * r,
          y: tip.y + Math.sin(a) * r,
          size: 1
        })
      }
    }
    
    // 每个关节点周围填充
    finger.forEach(idx => {
      const p = getPoint(idx)
      for (let r = 2; r < 8; r += 2) {
        for (let a = 0; a < Math.PI * 2; a += 0.5) {
          targets.push({
            x: p.x + Math.cos(a) * r,
            y: p.y + Math.sin(a) * r,
            size: 1
          })
        }
      }
    })
  })
  
  // 3. 手腕区域加粗 - 更密集
  for (let r = 0; r < 25; r += 2) {
    for (let a = 0; a < Math.PI * 2; a += 0.25) {
      targets.push({
        x: wrist.x + Math.cos(a) * r,
        y: wrist.y + Math.sin(a) * r,
        size: 1.5
      })
    }
  }
  
  // 4. 手掌中心额外填充
  for (let r = 0; r < 30; r += 3) {
    for (let a = 0; a < Math.PI * 2; a += 0.3) {
      targets.push({
        x: palmCenter.x + Math.cos(a) * r,
        y: palmCenter.y + Math.sin(a) * r,
        size: 1.2
      })
    }
  }
  
  return targets
}

// 从面部地标生成粒子目标点 - 密集版本，形成完整的面部网格
export function generateFaceTargets(landmarks, canvasWidth, canvasHeight, mirror = true) {
  if (!landmarks || landmarks.length === 0) return []
  
  const targets = []
  
  // 面部网格连接 - 使用所有468个点，但在相邻点之间插值
  // 遍历所有地标点
  landmarks.forEach((landmark, index) => {
    const x = mirror ? (1 - landmark.x) * canvasWidth : landmark.x * canvasWidth
    const y = landmark.y * canvasHeight
    
    // 所有点都添加
    targets.push({ x, y, size: 1.2 })
  })
  
  // 在面部轮廓线上进行插值，形成更清晰的轮廓
  const contourRegions = [
    FACE_REGIONS.faceOval,
    FACE_REGIONS.leftEye,
    FACE_REGIONS.rightEye,
    FACE_REGIONS.lips,
    FACE_REGIONS.leftEyebrow,
    FACE_REGIONS.rightEyebrow
  ]
  
  contourRegions.forEach(region => {
    for (let i = 0; i < region.length; i++) {
      const curr = landmarks[region[i]]
      const next = landmarks[region[(i + 1) % region.length]]
      
      if (!curr || !next) continue
      
      const cx = mirror ? (1 - curr.x) * canvasWidth : curr.x * canvasWidth
      const cy = curr.y * canvasHeight
      const nx = mirror ? (1 - next.x) * canvasWidth : next.x * canvasWidth
      const ny = next.y * canvasHeight
      
      // 在轮廓线上插值
      for (let t = 0.2; t <= 0.8; t += 0.2) {
        targets.push({
          x: cx + (nx - cx) * t,
          y: cy + (ny - cy) * t,
          size: 1
        })
      }
    }
  })
  
  return targets
}

// 在canvas上绘制手部骨骼覆盖
export function drawHandOverlay(ctx, landmarks, canvasWidth, canvasHeight, mirror = true) {
  if (!landmarks || landmarks.length === 0) return
  
  // 绘制骨骼连接
  HAND_CONNECTIONS.forEach(([start, end]) => {
    const startPoint = landmarks[start]
    const endPoint = landmarks[end]
    
    const x1 = mirror ? (1 - startPoint.x) * canvasWidth : startPoint.x * canvasWidth
    const y1 = startPoint.y * canvasHeight
    const x2 = mirror ? (1 - endPoint.x) * canvasWidth : endPoint.x * canvasWidth
    const y2 = endPoint.y * canvasHeight
    
    // 发光效果
    ctx.shadowBlur = 10
    ctx.shadowColor = '#00ffff'
    
    // 渐变线条
    const gradient = ctx.createLinearGradient(x1, y1, x2, y2)
    gradient.addColorStop(0, 'rgba(0, 255, 255, 0.8)')
    gradient.addColorStop(1, 'rgba(255, 100, 200, 0.8)')
    
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.strokeStyle = gradient
    ctx.lineWidth = 2
    ctx.stroke()
  })
  
  // 绘制关节点
  landmarks.forEach((landmark, index) => {
    const x = mirror ? (1 - landmark.x) * canvasWidth : landmark.x * canvasWidth
    const y = landmark.y * canvasHeight
    
    let radius = 3
    let color = 'rgba(0, 255, 255, 0.9)'
    
    if (FINGERTIPS.includes(index)) {
      radius = 6
      color = 'rgba(255, 100, 200, 1)'
    } else if (index === WRIST) {
      radius = 8
      color = 'rgba(0, 255, 255, 1)'
    }
    
    ctx.shadowBlur = 15
    ctx.shadowColor = color
    
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  })
  
  ctx.shadowBlur = 0
}

// 在canvas上绘制面部网格覆盖
export function drawFaceOverlay(ctx, landmarks, canvasWidth, canvasHeight, mirror = true) {
  if (!landmarks || landmarks.length === 0) return
  
  // 绘制眼睛轮廓 - 青绿色
  drawFaceRegion(ctx, landmarks, FACE_REGIONS.leftEye, canvasWidth, canvasHeight, 'rgba(0, 255, 200, 0.8)', mirror)
  drawFaceRegion(ctx, landmarks, FACE_REGIONS.rightEye, canvasWidth, canvasHeight, 'rgba(0, 255, 200, 0.8)', mirror)
  
  // 绘制嘴唇轮廓 - 粉色
  drawFaceRegion(ctx, landmarks, FACE_REGIONS.lips, canvasWidth, canvasHeight, 'rgba(255, 100, 200, 0.8)', mirror)
  
  // 绘制面部轮廓 - 青绿色
  drawFaceRegion(ctx, landmarks, FACE_REGIONS.faceOval, canvasWidth, canvasHeight, 'rgba(0, 200, 200, 0.5)', mirror)
  
  // 绘制鼻子
  drawFaceRegion(ctx, landmarks, FACE_REGIONS.nose, canvasWidth, canvasHeight, 'rgba(0, 255, 255, 0.6)', mirror)
  
  // 绘制眉毛
  drawFaceRegion(ctx, landmarks, FACE_REGIONS.leftEyebrow, canvasWidth, canvasHeight, 'rgba(0, 200, 200, 0.6)', mirror)
  drawFaceRegion(ctx, landmarks, FACE_REGIONS.rightEyebrow, canvasWidth, canvasHeight, 'rgba(0, 200, 200, 0.6)', mirror)
}

// 绘制面部区域
function drawFaceRegion(ctx, landmarks, indices, canvasWidth, canvasHeight, color, mirror) {
  if (indices.length < 2) return
  
  ctx.shadowBlur = 5
  ctx.shadowColor = color
  
  ctx.beginPath()
  const firstPoint = landmarks[indices[0]]
  const fx = mirror ? (1 - firstPoint.x) * canvasWidth : firstPoint.x * canvasWidth
  const fy = firstPoint.y * canvasHeight
  ctx.moveTo(fx, fy)
  
  for (let i = 1; i < indices.length; i++) {
    const point = landmarks[indices[i]]
    const px = mirror ? (1 - point.x) * canvasWidth : point.x * canvasWidth
    const py = point.y * canvasHeight
    ctx.lineTo(px, py)
  }
  
  ctx.closePath()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.stroke()
  
  ctx.shadowBlur = 0
}
