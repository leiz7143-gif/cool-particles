# 🎭 AI-Gesture Interactive Particle System
### 基于 MediaPipe 与 Vue 3 的超视网膜级手势交互粒子系统

![License](https://img.shields.io/badge/license-MIT-green)
![Vue](https://img.shields.io/badge/frontend-Vue%203-brightgreen)
![Tech](https://img.shields.io/badge/AI-MediaPipe-blue)

## 🌟 项目简介
这不仅是一个粒子特效，更是一个基于 Web 的实时视觉反馈系统。通过摄像头捕捉用户的手部与面部动作，利用 AI 模型进行高精度追踪，并将数万个粒子实时映射为用户的生物轮廓。

## ✨ 核心亮点
- **高精度 AI 追踪**：集成 MediaPipe Hands & Face Mesh，支持 21 个手部关键点及 468 个面部地标捕捉。
- **极致物理表现**：
  - **吸引/排斥双模式**：粒子支持快速跟随目标与避障排斥算法。
  - **黄金角度螺旋分布**：采用极坐标采样算法，确保粒子在目标点分布均匀、无重叠。
- **沉浸式交互**：
  - **手势控制**：支持通过“握拳”等手势实时切换五大主题颜色（彩虹、火焰、海洋、银河、矩阵）。
  - **60FPS 渲染**：基于 Canvas 2D 优化，即使万级粒子也能流畅运行。

## 🛠️ 技术深度 (Technical Stack)
| 类别 | 技术方案 |
| :--- | :--- |
| **框架** | Vue 3 (Composition API) + Vite |
| **追踪引擎** | MediaPipe (Hands v0.5+, Face Mesh v0.4+) |
| **渲染底层** | Canvas 2D / RequestAnimationFrame |
| **优化技术** | 批量绘制、双线性插值填充、轻量级模型复杂度控制 |

## 🚀 快速开始

### 1. 环境准备
确保你的电脑拥有摄像头，并推荐使用 Chrome 浏览器以获得最佳 AI 加速效果。

### 2. 本地运行
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
