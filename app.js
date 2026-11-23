(function () {
  'use strict';

  const { THEMES, ITEMS, LEVELS } = window.ShelfLevels;
  const {
    DEFAULT_BOOSTERS,
    createGameState,
    getRowWidth,
    getRemainingWidth,
    getAllShelves,
    findShelf,
    canMoveItem,
    moveItem,
    isDeadlocked,
    undoMove,
    expandTempTray,
    shuffleFrontRows,
    findBestHint,
    calculateStars,
  } = window.ShelfGame;

  const STORAGE_KEY = 'cozy_shelf_sort_v1';
  const BOOSTER_REFILL = { undo: 2, expand: 1, shuffle: 1, hint: 2 };
  const BOOSTER_LABELS = { undo: '撤回', expand: '+1临时格', shuffle: '重排', hint: '提示' };

  const el = {
    appShell: document.getElementById('appShell'),
    startScreen: document.getElementById('startScreen'),
    startLevelStat: document.getElementById('startLevelStat'),
    startStarStat: document.getElementById('startStarStat'),
    startCoinStat: document.getElementById('startCoinStat'),
    startGameBtn: document.getElementById('startGameBtn'),
    startLevelBtn: document.getElementById('startLevelBtn'),
    homeBtn: document.getElementById('homeBtn'),
    levelSwitchBtn: document.getElementById('levelSwitchBtn'),
    levelTitle: document.getElementById('levelTitle'),
    eliteTag: document.getElementById('eliteTag'),
    coinCount: document.getElementById('coinCount'),
    soundToggleBtn: document.getElementById('soundToggleBtn'),
    restartBtn: document.getElementById('restartBtn'),
    themeLabel: document.getElementById('themeLabel'),
    packProgressText: document.getElementById('packProgressText'),
    packProgressBar: document.getElementById('packProgressBar'),
    levelTip: document.getElementById('levelTip'),
    toastSlot: document.getElementById('toastSlot'),
    shelvesGrid: document.getElementById('shelvesGrid'),
    tempTrayWrap: document.getElementById('tempTrayWrap'),
    tempCapBadge: document.getElementById('tempCapBadge'),
    tempTrayContainer: document.getElementById('tempTrayContainer'),
    deadlockBanner: document.getElementById('deadlockBanner'),
    btnUndo: document.getElementById('btnUndo'),
    badgeUndo: document.getElementById('badgeUndo'),
    btnExpand: document.getElementById('btnExpand'),
    badgeExpand: document.getElementById('badgeExpand'),
    btnShuffle: document.getElementById('btnShuffle'),
    badgeShuffle: document.getElementById('badgeShuffle'),
    btnHint: document.getElementById('btnHint'),
    badgeHint: document.getElementById('badgeHint'),
    levelModal: document.getElementById('levelModal'),
    closeLevelModalBtn: document.getElementById('closeLevelModalBtn'),
    levelList: document.getElementById('levelList'),
    winModal: document.getElementById('winModal'),
    winStars: document.getElementById('winStars'),
    winSummary: document.getElementById('winSummary'),
    winMoves: document.getElementById('winMoves'),
    winPacks: document.getElementById('winPacks'),
    winCoins: document.getElementById('winCoins'),
    winReplayBtn: document.getElementById('winReplayBtn'),
    nextLevelBtn: document.getElementById('nextLevelBtn'),
    adModal: document.getElementById('adModal'),
    adRewardDesc: document.getElementById('adRewardDesc'),
    adTimerText: document.getElementById('adTimerText'),
    adProgressBar: document.getElementById('adProgressBar'),
    cancelAdBtn: document.getElementById('cancelAdBtn'),
  };

  function sanitizeBoosters(raw) {
    const out = { ...DEFAULT_BOOSTERS };
    if (!raw || typeof raw !== 'object') return out;
    for (const key of Object.keys(DEFAULT_BOOSTERS)) {
      const val = Number(raw[key]);
      if (Number.isInteger(val) && val >= 0) out[key] = val;
    }
    return out;
  }

  function loadSave() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        currentLevelIndex: Number.isInteger(parsed.currentLevelIndex)
          ? Math.max(0, Math.min(parsed.currentLevelIndex, LEVELS.length - 1))
          : 0,
        unlockedLevelIndex: Number.isInteger(parsed.unlockedLevelIndex)
          ? Math.max(0, Math.min(parsed.unlockedLevelIndex, LEVELS.length - 1))
          : 0,
        coins: Number.isFinite(parsed.coins) ? parsed.coins : 0,
        muted: Boolean(parsed.muted),
        bestStars: parsed.bestStars && typeof parsed.bestStars === 'object' ? parsed.bestStars : {},
        boosters: sanitizeBoosters(parsed.boosters),
      };
    } catch {
      return {
        currentLevelIndex: 0,
        unlockedLevelIndex: 0,
        coins: 0,
        muted: false,
        bestStars: {},
        boosters: { ...DEFAULT_BOOSTERS },
      };
    }
  }

  function persistSave() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
    } catch {
      // Ignore storage quota or restricted file:// storage policies.
    }
  }

  let audioCtx = null;
  function playTone(freqStart, freqEnd, duration, type, gainVal, delay = 0) {
    if (save.muted) return;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    if (!audioCtx) audioCtx = new AudioCtor();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});

    const now = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + duration);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(gainVal, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  const sfx = {
    select: () => playTone(520, 680, 0.06, 'sine', 0.07),
    place: () => playTone(340, 220, 0.07, 'triangle', 0.08),
    reveal: () => playTone(300, 560, 0.13, 'sine', 0.05, 0.04),
    error: () => {
      playTone(170, 115, 0.09, 'sawtooth', 0.04);
      playTone(145, 95, 0.09, 'sawtooth', 0.04, 0.09);
    },
    pack: (combo) => {
      const mul = Math.pow(2, Math.min(combo - 1, 5) / 12);
      playTone(523 * mul, 523 * mul, 0.1, 'triangle', 0.09, 0);
      playTone(659 * mul, 659 * mul, 0.11, 'triangle', 0.09, 0.06);
      playTone(784 * mul, 880 * mul, 0.16, 'sine', 0.09, 0.12);
    },
    reward: () => {
      playTone(587, 659, 0.1, 'triangle', 0.08, 0);
      playTone(880, 1046, 0.16, 'sine', 0.09, 0.09);
    },
    win: () => {
      [523, 659, 784, 1046].forEach((f, idx) =>
        playTone(f, f * 1.01, 0.18, 'triangle', 0.09, idx * 0.08)
      );
    },
  };

  let save = loadSave();
  let state = createGameState(save.currentLevelIndex, save.boosters);
  let selected = null;
  let activeHint = null;
  let toastTimer = null;
  let hintTimer = null;
  let adTimer = null;
  let animFlags = { shakeShelfId: null, packedShelfId: null, revealedIds: new Set() };

  function showToast(text, isCombo = false) {
    clearTimeout(toastTimer);
    el.toastSlot.innerHTML = '';
    const pill = document.createElement('div');
    pill.className = isCombo ? 'toast-pill toast-pill--combo' : 'toast-pill';
    pill.textContent = text;
    el.toastSlot.appendChild(pill);
    toastTimer = setTimeout(() => {
      el.toastSlot.innerHTML = '';
    }, 1800);
  }

  function clearHint() {
    activeHint = null;
    clearTimeout(hintTimer);
  }

  function applyTheme(themeKey) {
    const theme = THEMES[themeKey] || THEMES.fridge;
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--theme-bg', theme.bgGradient);
    rootStyle.setProperty('--theme-accent', theme.accent);
    rootStyle.setProperty('--shelf-bg', theme.shelfBg);
    rootStyle.setProperty('--shelf-border', theme.shelfBorder);
    rootStyle.setProperty('--ledge-bg', theme.ledgeBg);
    el.themeLabel.textContent = `${theme.name} · ${theme.subtitle}`;
  }

  function getTotalStars() {
    return LEVELS.reduce((sum, lvl) => sum + (Number(save.bestStars[lvl.id]) || 0), 0);
  }

  function formatStars(count) {
    return '★'.repeat(count) + '☆'.repeat(Math.max(0, 3 - count));
  }

  function renderStartScreen() {
    const totalStars = getTotalStars();
    const maxStars = LEVELS.length * 3;
    el.startLevelStat.textContent = `第 ${save.currentLevelIndex + 1} / ${LEVELS.length} 关`;
    el.startStarStat.textContent = `⭐ ${totalStars} / ${maxStars}`;
    el.startCoinStat.textContent = `💰 ${save.coins}`;
    el.startGameBtn.textContent =
      save.currentLevelIndex > 0 || totalStars > 0
        ? `继续第 ${save.currentLevelIndex + 1} 关 ▶`
        : '开始理货 ▶';
  }

  function showStartScreen() {
    renderStartScreen();
    el.startScreen.classList.remove('hidden');
  }

  function syncBoostersToSave() {
    save.boosters = { ...state.boosters };
    persistSave();
  }

  function startLevel(index) {
    save.currentLevelIndex = Math.max(0, Math.min(index, LEVELS.length - 1));
    persistSave();
    state = createGameState(save.currentLevelIndex, save.boosters);
    selected = null;
    clearHint();
    animFlags = { shakeShelfId: null, packedShelfId: null, revealedIds: new Set() };
    el.startScreen.classList.add('hidden');
    el.winModal.classList.add('hidden');
    el.levelModal.classList.add('hidden');
    render();
  }

  function createItemNode(itemId, options = {}) {
    const item = ITEMS[itemId];
    const node = document.createElement('div');
    node.className = 'item-tile';
    if (item.width === 2) node.classList.add('item-tile--wide');
    if (options.isSelected) node.classList.add('item-tile--selected');
    if (options.isHintSrc) node.classList.add('item-tile--hint-src');

    node.style.setProperty('--item-bg', item.bg);
    node.style.setProperty('--item-border', item.border);
    node.style.setProperty('--item-accent', item.accent);

    if (!options.isPreview) {
      node.setAttribute('role', 'button');
      node.setAttribute('tabindex', '0');
      node.setAttribute('aria-label', `${item.name} 占${item.width}格`);
      if (item.width === 2) {
        const wide = document.createElement('span');
        wide.className = 'wide-badge';
        wide.textContent = '2格';
        node.appendChild(wide);
      }
    }

    const emoji = document.createElement('span');
    emoji.className = 'item-emoji';
    emoji.textContent = item.emoji;
    node.appendChild(emoji);

    const name = document.createElement('span');
    name.className = 'item-name';
    name.textContent = item.name;
    node.appendChild(name);

    return node;
  }

  function renderShelfCard(shelf) {
    const card = document.createElement('div');
    card.className = 'shelf-card';
    card.dataset.shelfId = shelf.id;

    const canAcceptSelected =
      selected &&
      selected.shelfId !== shelf.id &&
      canMoveItem(state, selected.shelfId, selected.itemIndex, shelf.id);
    if (canAcceptSelected) card.classList.add('shelf-card--valid');
    if (activeHint && activeHint.dstShelfId === shelf.id) card.classList.add('shelf-card--hint-dst');
    if (animFlags.shakeShelfId === shelf.id) card.classList.add('shelf-card--shake');
    if (animFlags.packedShelfId === shelf.id) card.classList.add('shelf-card--packed');
    if (animFlags.revealedIds.has(shelf.id)) card.classList.add('shelf-card--revealed');

    if (!shelf.isTemp && shelf.layers.length > 1) {
      const badge = document.createElement('span');
      badge.className = 'depth-badge';
      badge.textContent = `后方 +${shelf.layers.length - 1}层`;
      card.appendChild(badge);
    }

    const stage = document.createElement('div');
    stage.className = 'shelf-stage';

    if (!shelf.isTemp && shelf.layers.length > 1 && shelf.layers[1].length > 0) {
      const peek = document.createElement('div');
      peek.className = 'back-peek-row';
      for (const id of shelf.layers[1]) {
        peek.appendChild(createItemNode(id, { isPreview: true }));
      }
      stage.appendChild(peek);
    }

    const front = document.createElement('div');
    front.className = 'front-row';
    const frontItems = shelf.layers[0];

    frontItems.forEach((id, idx) => {
      const isSelected = Boolean(selected && selected.shelfId === shelf.id && selected.itemIndex === idx);
      const isHintSrc = Boolean(
        activeHint && activeHint.srcShelfId === shelf.id && activeHint.itemIndex === idx
      );
      const tile = createItemNode(id, { isSelected, isHintSrc });
      tile.addEventListener('click', (e) => {
        e.stopPropagation();
        handleItemClick(shelf.id, idx);
      });
      tile.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        handleItemDoubleClick(shelf.id, idx);
      });
      front.appendChild(tile);
    });

    const rem = getRemainingWidth(shelf);
    for (let i = 0; i < rem; i += 1) {
      const slot = document.createElement('div');
      slot.className = 'empty-slot';
      front.appendChild(slot);
    }

    if (shelf.isTemp) {
      const lockedSlots = shelf.maxCapacity - shelf.capacity;
      for (let i = 0; i < lockedSlots; i += 1) {
        const locked = document.createElement('div');
        locked.className = 'empty-slot empty-slot--locked';
        locked.textContent = '🔒';
        front.appendChild(locked);
      }
    }

    stage.appendChild(front);
    card.appendChild(stage);
    card.addEventListener('click', () => handleShelfClick(shelf.id));
    return card;
  }

  function renderBoosters(deadlocked) {
    const map = [
      { key: 'undo', btn: el.btnUndo, badge: el.badgeUndo },
      { key: 'expand', btn: el.btnExpand, badge: el.badgeExpand },
      { key: 'shuffle', btn: el.btnShuffle, badge: el.badgeShuffle },
      { key: 'hint', btn: el.btnHint, badge: el.badgeHint },
    ];

    for (const { key, btn, badge } of map) {
      const count = state.boosters[key];
      const isExpandMax = key === 'expand' && state.tempTray.capacity >= state.tempTray.maxCapacity;
      btn.disabled = state.status !== 'playing' || isExpandMax;

      if (isExpandMax) {
        badge.textContent = '已满';
        badge.classList.remove('booster-badge--ad');
      } else if (count > 0) {
        badge.textContent = String(count);
        badge.classList.remove('booster-badge--ad');
      } else {
        badge.textContent = '📺 领';
        badge.classList.add('booster-badge--ad');
      }

      const shouldPulse = deadlocked && (key === 'expand' || key === 'shuffle') && !btn.disabled;
      btn.classList.toggle('booster-btn--pulse', shouldPulse);
    }
  }

  function render() {
    const level = LEVELS[state.levelIndex];
    applyTheme(level.theme);

    el.levelTitle.textContent = level.title;
    el.eliteTag.classList.toggle('hidden', !level.isElite);
    el.coinCount.textContent = String(save.coins);
    el.soundToggleBtn.textContent = save.muted ? '🔇' : '🔊';

    el.packProgressText.textContent = `${state.packsCleared} / ${state.totalPacks}`;
    const pct = state.totalPacks > 0 ? Math.round((state.packsCleared / state.totalPacks) * 100) : 0;
    el.packProgressBar.style.width = `${pct}%`;
    el.levelTip.textContent = level.tip;

    el.shelvesGrid.innerHTML = '';
    for (const shelf of state.shelves) {
      el.shelvesGrid.appendChild(renderShelfCard(shelf));
    }

    if (state.tempTray.capacity > 0) {
      el.tempTrayWrap.classList.remove('hidden');
      el.tempCapBadge.textContent = `${state.tempTray.capacity} / ${state.tempTray.maxCapacity} 格`;
      el.tempTrayContainer.innerHTML = '';
      el.tempTrayContainer.appendChild(renderShelfCard(state.tempTray));
    } else {
      el.tempTrayWrap.classList.add('hidden');
    }

    const deadlocked = state.status === 'playing' && isDeadlocked(state);
    el.deadlockBanner.classList.toggle('hidden', !deadlocked);
    renderBoosters(deadlocked);
  }

  function performMove(srcShelfId, itemIndex, dstShelfId) {
    clearHint();
    if (!canMoveItem(state, srcShelfId, itemIndex, dstShelfId)) {
      const src = findShelf(state, srcShelfId);
      const itemId = src && src.layers[0][itemIndex];
      const item = ITEMS[itemId];
      animFlags = { shakeShelfId: dstShelfId, packedShelfId: null, revealedIds: new Set() };
      sfx.error();
      if (item) {
        showToast(`空间不足，「${item.name}」占 ${item.width} 格哦~`);
      }
      render();
      setTimeout(() => {
        animFlags.shakeShelfId = null;
      }, 300);
      return;
    }

    const res = moveItem(state, srcShelfId, itemIndex, dstShelfId);
    selected = null;
    animFlags = {
      shakeShelfId: null,
      packedShelfId: res.packed ? res.packed.shelfId : null,
      revealedIds: new Set(res.revealedShelfIds),
    };

    if (res.packed) {
      save.coins += res.packed.coinsEarned;
      persistSave();
      sfx.pack(res.packed.combo);
      const msg =
        res.packed.combo > 1
          ? `连击 ×${res.packed.combo}！打包成功 +${res.packed.coinsEarned} 💰`
          : `打包成功！+${res.packed.coinsEarned} 💰`;
      showToast(msg, res.packed.combo > 1);
    } else {
      sfx.place();
    }

    if (res.revealedShelfIds.length > 0) {
      sfx.reveal();
    }

    render();
    setTimeout(() => {
      animFlags = { shakeShelfId: null, packedShelfId: null, revealedIds: new Set() };
    }, 360);

    if (res.won) {
      save.unlockedLevelIndex = Math.max(
        save.unlockedLevelIndex,
        Math.min(state.levelIndex + 1, LEVELS.length - 1)
      );
      persistSave();
      setTimeout(() => {
        sfx.win();
        openWinModal();
      }, 360);
    }
  }

  function handleItemClick(shelfId, itemIndex) {
    if (state.status !== 'playing') return;
    clearHint();

    if (!selected) {
      selected = { shelfId, itemIndex };
      sfx.select();
      render();
      return;
    }

    if (selected.shelfId === shelfId && selected.itemIndex === itemIndex) {
      selected = null;
      render();
      return;
    }

    if (selected.shelfId === shelfId) {
      selected = { shelfId, itemIndex };
      sfx.select();
      render();
      return;
    }

    performMove(selected.shelfId, selected.itemIndex, shelfId);
  }

  function handleShelfClick(shelfId) {
    if (state.status !== 'playing' || !selected) return;
    if (selected.shelfId === shelfId) {
      selected = null;
      render();
      return;
    }
    performMove(selected.shelfId, selected.itemIndex, shelfId);
  }

  function handleItemDoubleClick(shelfId, itemIndex) {
    if (state.status !== 'playing') return;
    const src = findShelf(state, shelfId);
    const itemId = src && src.layers[0][itemIndex];
    if (!itemId) return;

    const candidates = getAllShelves(state).filter((dst) =>
      canMoveItem(state, shelfId, itemIndex, dst.id)
    );
    if (candidates.length === 0) {
      animFlags = { shakeShelfId: shelfId, packedShelfId: null, revealedIds: new Set() };
      sfx.error();
      showToast('没有足够空位可以自动移入哦~');
      render();
      return;
    }

    candidates.sort((a, b) => {
      const score = (dst) => {
        const nextRow = [...dst.layers[0], itemId];
        if (dst.capacity === 4 && getRowWidth(nextRow) === 4 && nextRow.every((id) => id === itemId)) {
          return 1000;
        }
        if (dst.layers[0].length > 0 && dst.layers[0].every((id) => id === itemId)) return 500;
        if (!dst.isTemp && dst.layers[0].length === 0) return 200;
        if (!dst.isTemp) return 50;
        return 10;
      };
      return score(b) - score(a);
    });

    performMove(shelfId, itemIndex, candidates[0].id);
  }

  function executeBooster(type) {
    clearHint();
    selected = null;

    if (type === 'undo') {
      if (state.history.length === 0) {
        showToast('还没有可以撤回的步骤哦~');
        return false;
      }
      undoMove(state);
      sfx.place();
      showToast('已撤回上一步');
      return true;
    }

    if (type === 'expand') {
      const res = expandTempTray(state);
      if (!res.ok) {
        showToast('临时理货台已达到上限 4 格~');
        return false;
      }
      sfx.reveal();
      showToast(`临时理货台已扩容至 ${res.capacity}/4 格！`);
      return true;
    }

    if (type === 'shuffle') {
      const res = shuffleFrontRows(state);
      if (!res.ok) {
        showToast('当前前排商品无需重排~');
        return false;
      }
      sfx.reveal();
      showToast('前排商品已重新整理排序！');
      return true;
    }

    if (type === 'hint') {
      const hint = findBestHint(state);
      if (!hint) {
        showToast('当前已无常规可移步骤，试试「+1临时格」或「重排」~');
        return false;
      }
      activeHint = hint;
      sfx.select();
      showToast(`提示：把「${ITEMS[hint.itemId].name}」移入闪烁货架`);
      hintTimer = setTimeout(() => {
        activeHint = null;
        render();
      }, 2400);
      return true;
    }

    return false;
  }

  function openSimulatedAd(type) {
    clearInterval(adTimer);
    const totalSeconds = 3;
    let left = totalSeconds;
    el.adRewardDesc.textContent = `观看完成后获得「${BOOSTER_LABELS[type]}」×${BOOSTER_REFILL[type]}`;
    el.adTimerText.textContent = `${left}s`;
    el.adProgressBar.style.width = '10%';
    el.adModal.classList.remove('hidden');

    adTimer = setInterval(() => {
      left -= 1;
      const pct = Math.min(100, Math.round(((totalSeconds - left) / totalSeconds) * 100));
      el.adProgressBar.style.width = `${pct}%`;
      if (left > 0) {
        el.adTimerText.textContent = `${left}s`;
        return;
      }
      clearInterval(adTimer);
      el.adModal.classList.add('hidden');
      state.boosters[type] += BOOSTER_REFILL[type];
      sfx.reward();

      const canAutoUse = !(type === 'undo' && state.history.length === 0);
      if (canAutoUse && executeBooster(type)) {
        state.boosters[type] -= 1;
      } else {
        showToast(`🎬 补给到账！获得「${BOOSTER_LABELS[type]}」×${BOOSTER_REFILL[type]}`);
      }
      syncBoostersToSave();
      render();
    }, 1000);
  }

  function handleBoosterClick(type) {
    if (state.status !== 'playing') return;
    if (type === 'expand' && state.tempTray.capacity >= state.tempTray.maxCapacity) {
      showToast('临时理货台已达到上限 4 格~');
      return;
    }

    if (state.boosters[type] <= 0) {
      openSimulatedAd(type);
      return;
    }

    if (type === 'undo' && state.history.length === 0) {
      showToast('还没有可以撤回的步骤哦~');
      return;
    }

    if (executeBooster(type)) {
      state.boosters[type] -= 1;
      syncBoostersToSave();
      render();
    }
  }

  function openLevelModal() {
    el.levelList.innerHTML = '';
    LEVELS.forEach((lvl, idx) => {
      const theme = THEMES[lvl.theme];
      const item = document.createElement('button');
      item.type = 'button';
      item.className = idx === state.levelIndex ? 'level-item level-item--active' : 'level-item';

      const left = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'level-item-title';
      title.textContent = lvl.isElite ? `${lvl.title} 🔥` : lvl.title;
      const meta = document.createElement('div');
      meta.className = 'level-item-meta';
      meta.textContent = `${theme.name} · ${lvl.shelves.length} 个货架`;
      left.appendChild(title);
      left.appendChild(meta);

      const right = document.createElement('div');
      right.className = 'level-item-right';
      const starSpan = document.createElement('span');
      starSpan.className = 'level-stars';
      starSpan.textContent = formatStars(Number(save.bestStars[lvl.id]) || 0);
      const statusSpan = document.createElement('span');
      statusSpan.textContent =
        idx === state.levelIndex ? '当前' : idx <= save.unlockedLevelIndex ? '已解锁' : '可试玩';
      right.appendChild(starSpan);
      right.appendChild(statusSpan);
      item.appendChild(left);
      item.appendChild(right);

      item.addEventListener('click', () => startLevel(idx));
      el.levelList.appendChild(item);
    });
    el.levelModal.classList.remove('hidden');
  }

  function openWinModal() {
    const level = LEVELS[state.levelIndex];
    const stars = calculateStars(state.moves, state.totalPacks);
    save.bestStars[level.id] = Math.max(Number(save.bestStars[level.id]) || 0, stars);
    persistSave();

    const isLast = state.levelIndex >= LEVELS.length - 1;
    el.winStars.textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    el.winSummary.textContent = isLast
      ? '全部 6 个单机关卡已打通！你可以冲刺全三星或重温任意主题。'
      : `已完成「${level.title}」，获得 ${stars} 星评价！`;
    el.winMoves.textContent = String(state.moves);
    el.winPacks.textContent = String(state.packsCleared);
    el.winCoins.textContent = `+${state.coins}`;
    el.nextLevelBtn.textContent = isLast ? '回到第 1 关' : '下一关 ➜';
    el.winModal.classList.remove('hidden');
  }

  el.startGameBtn.addEventListener('click', () => {
    sfx.select();
    startLevel(save.currentLevelIndex);
  });
  el.startLevelBtn.addEventListener('click', () => {
    sfx.select();
    openLevelModal();
  });
  el.homeBtn.addEventListener('click', showStartScreen);

  el.levelSwitchBtn.addEventListener('click', openLevelModal);
  el.closeLevelModalBtn.addEventListener('click', () => el.levelModal.classList.add('hidden'));
  el.levelModal.addEventListener('click', (e) => {
    if (e.target === el.levelModal) el.levelModal.classList.add('hidden');
  });

  el.soundToggleBtn.addEventListener('click', () => {
    save.muted = !save.muted;
    persistSave();
    render();
  });

  el.restartBtn.addEventListener('click', () => {
    startLevel(state.levelIndex);
    showToast('已重置本关货架');
  });

  el.winReplayBtn.addEventListener('click', () => startLevel(state.levelIndex));
  el.nextLevelBtn.addEventListener('click', () => {
    const nextIdx = state.levelIndex + 1 < LEVELS.length ? state.levelIndex + 1 : 0;
    startLevel(nextIdx);
  });

  el.cancelAdBtn.addEventListener('click', () => {
    clearInterval(adTimer);
    el.adModal.classList.add('hidden');
  });

  [el.btnUndo, el.btnExpand, el.btnShuffle, el.btnHint].forEach((btn) => {
    btn.addEventListener('click', () => handleBoosterClick(btn.dataset.booster));
  });

  renderStartScreen();
  render();
})();
