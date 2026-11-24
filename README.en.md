<p align="center">
  <img src="assets/icons/icon.jpg" alt="Cozy Shelf Sort logo" width="144" height="144" style="border-radius: 32px;">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-2e7d32?style=flat-square" alt="Version 1.0.0">
  <img src="https://img.shields.io/badge/HTML5-CSS3-E34F26?style=flat-square&amp;logo=html5&amp;logoColor=white" alt="HTML5 &amp; CSS3">
  <img src="https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?style=flat-square&amp;logo=javascript&amp;logoColor=black" alt="Vanilla JavaScript">
  <img src="https://img.shields.io/badge/Web_Audio-Synth-2b9cd8?style=flat-square" alt="Web Audio Synth">
  <img src="https://img.shields.io/badge/LocalStorage-Offline_Save-6d28d9?style=flat-square" alt="LocalStorage Save">
  <img src="https://img.shields.io/badge/Node.js-Test_Runner-339933?style=flat-square&amp;logo=nodedotjs&amp;logoColor=white" alt="Node.js Test Runner">
</p>

<p align="center">
  <a href="README.md">中文</a> | <strong>English</strong>
</p>

<h1 align="center">Cozy Shelf Sort — 便利店理货冲冲冲</h1>

## Overview

**Cozy Shelf Sort** is a zero-dependency, offline-first **2D multi-layered shelf sorting & packing puzzle game** built with vanilla HTML5, CSS3, and JavaScript.

Move and group items across multi-depth shelves: matching **4 slots of identical items** on a front row automatically packs and clears the box, pulling shadowed back-row items forward. Juggle 1-slot standard goods and **2-slot wide items**, uncover **❓ Mystery Back Rows**, break **🔒 Sealed Shelf Locks**, chain **Fever Combos**, and climb the **Store Manager Ladder**.

## Key Features

- **⚡ Batch Chain Moves & Instant Auto-Pack**: Moving an item into a matching shelf (or double-clicking an item) automatically pulls sibling items along; clearing all hidden back rows unlocks a one-tap **Auto-Complete** button.
- **📦 2-Slot Wide Items, Mystery Rows & Locked Shelves**: Combines 1-slot and 2-slot items with hidden back rows (`mysteryBack`) and pack-gated shelf locks (`lockedShelves`).
- **🍰 4 Cozy Themes · 12 Campaign Levels · Daily Seed Challenge**: Features *Convenience Store Fridge*, *Cat Cafe Shelf*, *Healing Vanity*, and *Sweet Bakery* themes, plus a deterministic **Daily Mystery Challenge** (`FNV-1a` + `LCG` PRNG).
- **💰 In-Game Coin Economy & Expandable Temp Tray**: Earn coins with combo multipliers to expand the temporary tray (`+1` to `+4` slots) or buy Undo, Expand, Shuffle, and Smart Hint boosters.
- **🏆 Personal Best (PB) Records, Manager Ladder & Achievements**: Tracks best moves, fastest clear time, 3-star ratings, and **👑 No-Booster Gold Crowns** locally via `localStorage`.
- **🎵 Zero-Dependency Web Audio Synth**: All sound effects are synthesized in real time using the native browser `Web Audio API`.

## Quick Start

1. **Direct Open**: Double-click [`index.html`](index.html) in any modern browser.
2. **Local Static Server**:
   ```powershell
   python -m http.server 8080
   ```
   Then open [http://127.0.0.1:8080](http://127.0.0.1:8080).
3. **Run Automated Tests (Node.js 18+)**:
   ```powershell
   node --test game.test.js
   ```
