<p align="center">
  <img src="assets/icons/icon.jpg" alt="Cozy Shelf Sort logo" width="136" height="136" style="border-radius: 30px;">
</p>

<h1 align="center">Cozy Shelf Sort — 便利店理货冲冲冲</h1>

<p align="center">
  一款零依赖、开箱即玩的 <strong>2D 立体货架收纳消除</strong> 休闲单机小游戏（原生 HTML5 / CSS3 / JavaScript）。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.1.0-2e7d32?style=flat-square" alt="Version 1.1.0">
  <img src="https://img.shields.io/badge/HTML5-CSS3-E34F26?style=flat-square&amp;logo=html5&amp;logoColor=white" alt="HTML5 &amp; CSS3">
  <img src="https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?style=flat-square&amp;logo=javascript&amp;logoColor=black" alt="Vanilla JavaScript">
  <img src="https://img.shields.io/badge/Web_Audio-Synth-2b9cd8?style=flat-square" alt="Web Audio Synth">
  <img src="https://img.shields.io/badge/Tests-19_Passing-339933?style=flat-square&amp;logo=nodedotjs&amp;logoColor=white" alt="19 Tests Passing">
</p>

<p align="center">
  <strong>中文</strong> | <a href="README.en.md">English</a>
</p>

---

## ✨ 游戏简介

把杂乱的多层货架整理得井井有条！在多排纵深货架之间点击或双击搬运商品，前排凑满 **4 格同款商品** 即可触发自动打包收箱，后排暗影商品随之自动前推补位。在有限的货架空间、**2 格异形大件**、**❓盲盒遮挡** 与 **🔒封条锁架** 之间巧妙腾挪，触发封箱暴击与狂热磁铁，冲击最少步数、零道具金冠与「店长天梯榜」榜首。

## 🎯 核心爽点与特色

- **🔥 三大高潮爽点机制**：
  - **🛵 闪送急单悬赏**：首箱打包后动态派发限时 `4` 步的外卖急单目标（带 `🛵` 角标高亮），规定步数内优先打包指定商品立享 **`+25💰`** 额外赏金。
  - **🧲 3连击狂热磁铁**：连续 3 次打包触发 `Fever` 状态时自动充能「狂热磁铁」，一键**零步数（0 步）**将全场所有同款商品瞬间吸齐炸箱。
  - **🎯 胶带封箱暴击（QTE）**：结合《微信跳一跳》时机手感，每次打包后弹出胶带游标，看准中央金色区（`35%~65%`）点击触发 **`🎯 完美封箱 CRIT! (+25💰)`**，普通区间点击亦有 `+10💰` 保底奖励。
- **⚡ 爽快连携与一键极速收箱**：移入同款货架或双击商品自动触发**同款批量连携移入**；当所有后排暗影与锁架全揭晓且存在必胜解时，自动浮现 **「⚡ 一键极速收箱」** 按钮极速清场。
- **📦 2 格异形大件 + 盲盒与锁架博弈**：引入占 2 格宽度的礼盒/大桶商品、清空前排才揭晓的 **「❓盲盒后排」** 以及需打包达标自动破封的 **「🔒封条锁架」**。
- **🍰 4 大主题 · 12 关主线 · 每日盲盒挑战**：内置「🧊 便利店冰柜」「🐾 萌宠猫咖架」「💄 治愈梳妆台」「🍰 甜品烘焙坊」4 套主题与 12 个梯度关卡，以及按日期种子生成的 **「📅 每日盲盒」**。
- **💰 金币经济与阶梯临时理货台**：底部临时理货台支持逐格扩容（`+1 → +4 格`），赚取的金币可直接购买「撤回 / +1临时格 / 重排 / 提示」4 类道具，或通过 3 秒模拟激励视频免费补给。
- **🏆 个人最佳记录（PB）与店长天梯榜**：实时显示步数、3⭐目标线与计时；自动记录每关**最少步数、最快用时与 👑 零道具金冠**，内置 9 段位店长天梯榜与 6 项成就勋章。
- **🎵 零依赖纯前端实现**：所有音效均由原生 `Web Audio API` 实时振荡合成，无需外部音频资源，进度自动保存在本地 `localStorage`。

## 🚀 快速开始

本项目**零第三方依赖**，无需 `npm install` 或任何构建步骤：

### 1. 启动游戏

- **方式 A（直接打开）**：直接双击打开项目根目录下的 [`index.html`](index.html)。
- **方式 B（本地 HTTP 服务）**：
  ```powershell
  python -m http.server 8080
  ```
  浏览器访问 [http://127.0.0.1:8080](http://127.0.0.1:8080)。

### 2. 操作速查

| 操作 | 说明 |
| --- | --- |
| **单击移动** | 单击前排商品提起，再点目标货架移入（同排多个同款且空位充足时自动**批量连携移入**） |
| **双击快捷移入** | 双击任意前排商品，自动匹配最佳同款货架或空位一键移入 |
| **触发封箱暴击** | 每次完成 4 格打包后，看准底部游标滑入中央金色区间时点击，赢取 `+25💰` 暴击赏金 |
| **释放狂热磁铁** | 达成 `×3` 狂热连击后，点击浮现的「🧲 狂热磁铁」按钮，0 步吸走全场一整箱同款商品 |

## 🗂️ 目录结构

```text
cozy-shelf-sort/
├── assets/icons/      # 游戏主图标与备选主题概念图标
├── index.html         # 游戏主页面（开始界面、局内 HUD、货架舞台与 4 大弹窗）
├── styles.css         # 全局样式表（4 套主题 CSS 变量、立体货架卡片与动效）
├── levels.js          # 4 大主题、26 种商品字典、12 关主线与每日盲盒生成器
├── game.js            # 纯函数核心状态机（移动、急单、磁铁、QTE、死锁、提示与天梯）
├── app.js             # 视图控制器、Web Audio 实时合成音效与 LocalStorage 存档
└── game.test.js       # Node.js 原生测试套件（19 项核心逻辑与关卡校验测试）
```

## 🧪 运行自动化测试

使用 Node.js 18+ 内置测试运行器零配置验证全部 19 项单元测试：

```powershell
node --test game.test.js
```
