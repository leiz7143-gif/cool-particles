<template>
  <div class="app-container">
    <!-- 开场画面 -->
    <div v-if="!cameraStarted" class="start-screen">
      <div class="start-content">
        <h1 class="title">✨ 手势控制粒子效果</h1>
        <p class="subtitle">使用摄像头捕捉你的手部和面部，创造惊艳的粒子动画</p>
        <button class="start-button" @click="startCamera" :disabled="isLoading">
          <span v-if="isLoading">加载中...</span>
          <span v-else>启用相机</span>
        </button>
        <div class="features">
          <div class="feature">🖐️ 手部追踪</div>
          <div class="feature">😊 面部追踪</div>
          <div class="feature">🎨 5种主题</div>
        </div>
      </div>
    </div>

    <!-- 主画布区域 -->
    <canvas 
      ref="particleCanvas" 
      class="particle-canvas"
      :class="{ visible: cameraStarted }"
    ></canvas>

    <!-- 摄像头预览覆盖层 -->
    <div v-if="cameraStarted" class="camera-preview">
      <video ref="videoElement" autoplay playsinline muted></video>
      <canvas ref="overlayCanvas" class="overlay-canvas"></canvas>
    </div>

    <!-- UI控制面板 -->
    <div v-if="cameraStarted" class="ui-controls">
      <!-- 左上角 - 模式切换 -->
      <div class="top-left">
        <button class="control-button" @click="toggleMode">
          {{ attractMode ? '🧲 吸引模式' : '💨 排斥模式' }}
        </button>
        <button class="control-button theme-button" @click="nextTheme">
          🎨 {{ currentThemeName }}
        </button>
      </div>

      <!-- 右上角 - 状态显示 -->
      <div class="top-right">
        <div class="status-panel">
          <div v-if="isLoading" class="status loading">⏳ 加载中...</div>
          <div v-else-if="handsDetected || faceDetected" class="status detected">
            <span v-if="handsDetected">🖐️ 检测到手部</span>
            <span v-if="faceDetected">😊 检测到面部</span>
          </div>
          <div v-else class="status hint">👋 举起你的手</div>
        </div>
      </div>

      <!-- 右下角 - 快捷键面板 -->
      <div class="bottom-right">
        <div class="shortcuts-panel">
          <div class="shortcut"><kbd>空格</kbd> 切换模式</div>
          <div class="shortcut"><kbd>V</kbd> 显示/隐藏预览</div>
          <div class="shortcut"><kbd>T</kbd> 切换主题</div>
          <div class="shortcut"><kbd>握拳</kbd> 循环主题</div>
        </div>
      </div>
    </div>

    <!-- 隐藏的视频元素用于MediaPipe -->
    <video 
      ref="hiddenVideo" 
      style="display: none;" 
      autoplay 
      playsinline 
      muted
    ></video>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { ParticleManager, COLOR_THEMES } from './utils/ParticleSystem.js'
import {
  generateHandTargets,
  generateFaceTargets,
  drawHandOverlay,
  drawFaceOverlay,
  detectFist
} from './utils/MediaPipeTracker.js'

// 状态变量
const cameraStarted = ref(false)
const isLoading = ref(false)
const handsDetected = ref(false)
const faceDetected = ref(false)
const attractMode = ref(true)
const currentThemeName = ref('彩虹')
const showPreview = ref(true)

// DOM引用
const particleCanvas = ref(null)
const overlayCanvas = ref(null)
const videoElement = ref(null)
const hiddenVideo = ref(null)

// 系统实例
let particleManager = null
let hands = null
let faceMesh = null
let camera = null
let animationId = null
let lastFistState = false
let fistCooldown = false

// 初始化粒子系统
function initParticleSystem() {
  const canvas = particleCanvas.value
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  particleManager = new ParticleManager(canvas, 10000)
}

// 初始化覆盖层画布
function initOverlayCanvas() {
  const canvas = overlayCanvas.value
  const video = videoElement.value
  canvas.width = 256
  canvas.height = 144
}

// 加载MediaPipe脚本
async function loadMediaPipeScripts() {
  const scripts = [
    'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js'
  ]

  for (const src of scripts) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = src
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  }
}

// 初始化MediaPipe
async function initMediaPipe() {
  // 初始化手部追踪
  hands = new window.Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  })

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 0,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.5
  })

  hands.onResults(onHandsResults)

  // 初始化面部追踪
  faceMesh = new window.FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
  })

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: false,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.5
  })

  faceMesh.onResults(onFaceResults)
}

// 存储最新的追踪结果
let latestHandLandmarks = []
let latestFaceLandmarks = []

// 手部追踪结果处理
function onHandsResults(results) {
  latestHandLandmarks = results.multiHandLandmarks || []
  handsDetected.value = latestHandLandmarks.length > 0

  // 检测握拳手势切换主题
  if (latestHandLandmarks.length > 0) {
    const isFist = latestHandLandmarks.some(landmarks => detectFist(landmarks))
    
    if (isFist && !lastFistState && !fistCooldown) {
      nextTheme()
      fistCooldown = true
      setTimeout(() => { fistCooldown = false }, 1000)
    }
    lastFistState = isFist
  }
}

// 面部追踪结果处理
function onFaceResults(results) {
  latestFaceLandmarks = results.multiFaceLandmarks || []
  faceDetected.value = latestFaceLandmarks.length > 0
}

// 启动摄像头
async function startCamera() {
  isLoading.value = true

  try {
    await loadMediaPipeScripts()
    
    cameraStarted.value = true
    await nextTick()

    initParticleSystem()
    initOverlayCanvas()
    await initMediaPipe()

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { 
        width: { ideal: 320 },
        height: { ideal: 240 },
        facingMode: 'user',
        frameRate: { ideal: 30 }
      }
    })

    const video = hiddenVideo.value
    video.srcObject = stream
    await video.play()

    // 同时显示预览视频
    if (videoElement.value) {
      videoElement.value.srcObject = stream
    }

    // 开始追踪循环
    startTrackingLoop(video)
    
    // 开始动画循环
    animate()

    isLoading.value = false
  } catch (error) {
    console.error('启动摄像头失败:', error)
    isLoading.value = false
    alert('无法启动摄像头，请确保已授权摄像头权限。')
  }
}

// 追踪循环
let lastTrackTime = 0
const TRACK_INTERVAL = 33 // 每33ms追踪一次 (30fps)

function startTrackingLoop(video) {
  async function detect() {
    if (!cameraStarted.value) return

    const now = performance.now()
    if (now - lastTrackTime >= TRACK_INTERVAL) {
      lastTrackTime = now
      try {
        await hands.send({ image: video })
        await faceMesh.send({ image: video })
      } catch (e) {
        console.warn('追踪错误:', e)
      }
    }

    requestAnimationFrame(detect)
  }
  detect()
}

// 动画主循环
function animate() {
  if (!cameraStarted.value) return

  const canvas = particleCanvas.value

  // 分别生成手部和面部目标点
  let handTargets = []
  let faceTargets = []

  // 手部目标
  latestHandLandmarks.forEach(landmarks => {
    const targets = generateHandTargets(landmarks, canvas.width, canvas.height, true)
    handTargets = handTargets.concat(targets)
  })

  // 面部目标
  latestFaceLandmarks.forEach(landmarks => {
    const targets = generateFaceTargets(landmarks, canvas.width, canvas.height, true)
    faceTargets = faceTargets.concat(targets)
  })

  // 更新粒子系统 - 分别传递手部和面部目标
  particleManager.setTargets(handTargets, faceTargets)
  particleManager.update()
  particleManager.draw()

  // 绘制覆盖层
  if (showPreview.value && overlayCanvas.value) {
    const overlayCtx = overlayCanvas.value.getContext('2d')
    overlayCtx.clearRect(0, 0, 256, 144)

    // 绘制手部骨骼
    latestHandLandmarks.forEach(landmarks => {
      drawHandOverlay(overlayCtx, landmarks, 256, 144, true)
    })

    // 绘制面部网格
    latestFaceLandmarks.forEach(landmarks => {
      drawFaceOverlay(overlayCtx, landmarks, 256, 144, true)
    })
  }

  animationId = requestAnimationFrame(animate)
}

// 切换吸引/排斥模式
function toggleMode() {
  if (particleManager) {
    const mode = particleManager.toggleMode()
    attractMode.value = particleManager.attractMode
  }
}

// 切换主题
function nextTheme() {
  if (particleManager) {
    currentThemeName.value = particleManager.nextTheme()
  }
}

// 切换预览显示
function togglePreview() {
  showPreview.value = !showPreview.value
}

// 键盘事件处理
function handleKeydown(e) {
  if (e.code === 'Space') {
    e.preventDefault()
    toggleMode()
  } else if (e.code === 'KeyV') {
    togglePreview()
  } else if (e.code === 'KeyT') {
    nextTheme()
  }
}

// 窗口大小变化处理
function handleResize() {
  if (particleCanvas.value && particleManager) {
    particleCanvas.value.width = window.innerWidth
    particleCanvas.value.height = window.innerHeight
    particleManager.resize(window.innerWidth, window.innerHeight)
  }
}

// 生命周期
onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', handleResize)
  
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  
  if (hiddenVideo.value && hiddenVideo.value.srcObject) {
    hiddenVideo.value.srcObject.getTracks().forEach(track => track.stop())
  }
})
</script>

<style scoped>
.app-container {
  width: 100%;
  height: 100%;
  position: relative;
  background: #000;
  overflow: hidden;
}

/* 开场画面 */
.start-screen {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 50%, #0a0a2a 100%);
  z-index: 100;
}

.start-content {
  text-align: center;
  color: #fff;
}

.title {
  font-size: 3rem;
  margin-bottom: 1rem;
  background: linear-gradient(90deg, #00ffff, #ff66cc, #00ffff);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: gradient 3s ease infinite;
}

@keyframes gradient {
  0% { background-position: 0% center; }
  50% { background-position: 100% center; }
  100% { background-position: 0% center; }
}

.subtitle {
  font-size: 1.2rem;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 2rem;
}

.start-button {
  padding: 1rem 3rem;
  font-size: 1.3rem;
  background: linear-gradient(135deg, #00c8ff, #0066ff);
  border: none;
  border-radius: 50px;
  color: #fff;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 0 30px rgba(0, 200, 255, 0.5);
}

.start-button:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 0 50px rgba(0, 200, 255, 0.8);
}

.start-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.features {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-top: 3rem;
}

.feature {
  padding: 0.8rem 1.5rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  font-size: 1rem;
  backdrop-filter: blur(10px);
}

/* 粒子画布 */
.particle-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  transition: opacity 0.5s ease;
}

.particle-canvas.visible {
  opacity: 1;
}

/* 摄像头预览 */
.camera-preview {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 256px;
  height: 144px;
  border-radius: 10px;
  overflow: hidden;
  border: 2px solid rgba(0, 255, 255, 0.5);
  box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
  z-index: 10;
}

.camera-preview video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}

.overlay-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* UI控制面板 */
.ui-controls {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 20;
}

.top-left {
  position: absolute;
  top: 20px;
  left: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: auto;
}

.top-right {
  position: absolute;
  top: 20px;
  right: 20px;
  pointer-events: auto;
}

.bottom-right {
  position: absolute;
  bottom: 20px;
  right: 20px;
  pointer-events: auto;
}

.control-button {
  padding: 0.6rem 1.2rem;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(0, 255, 255, 0.5);
  border-radius: 25px;
  color: #fff;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.control-button:hover {
  background: rgba(0, 255, 255, 0.2);
  border-color: rgba(0, 255, 255, 0.8);
  box-shadow: 0 0 15px rgba(0, 255, 255, 0.5);
}

.status-panel {
  padding: 0.6rem 1.2rem;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 25px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.status {
  color: #fff;
  font-size: 0.9rem;
}

.status.loading {
  color: #ffcc00;
}

.status.detected {
  color: #00ff88;
}

.status.detected span {
  margin-right: 10px;
}

.status.hint {
  color: rgba(255, 255, 255, 0.7);
}

.shortcuts-panel {
  padding: 1rem;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 15px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.shortcut {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
}

.shortcut:last-child {
  margin-bottom: 0;
}

kbd {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 5px;
  font-family: monospace;
  margin-right: 0.5rem;
}
</style>
