(function () {
  'use strict';

  const { THEMES, ITEMS, LEVELS, createDailyLevel } = window.ShelfLevels;
  const {
    DEFAULT_BOOSTERS,
    BOOSTER_COSTS,
    ACHIEVEMENTS,
    createGameState,
    getRowWidth,
    getRemainingWidth,
    isRowPacked,
    isShelfLocked,
    getAllShelves,
    findShelf,
    canMoveItem,
    moveItem,
    isDeadlocked,
    undoMove,
    expandTempTray,
    shuffleFrontRows,
    findBestHint,
    canAutoComplete,
    getThreeStarMoves,
    calculateStars,
    updateLevelRecord,
    buildLeaderboard,
    evaluateAchievements,
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
    startDailyBtn: document.getElementById('startDailyBtn'),
    startRankBtn: document.getElementById('startRankBtn'),
    rankBtn: document.getElementById('rankBtn'),
    homeBtn: document.getElementById('homeBtn'),
    levelSwitchBtn: document.getElementById('levelSwitchBtn'),
    levelTitle: document.getElementById('levelTitle'),
    eliteTag: document.getElementById('eliteTag'),
    coinCount: document.getElementById('coinCount'),
    soundToggleBtn: document.getElementById('soundToggleBtn'),
    restartBtn: document.getElementById('restartBtn'),
    themeLabel: document.getElementById('themeLabel'),
    comboPill: document.getElementById('comboPill'),
    packProgressText: document.getElementById('packProgressText'),
    packProgressBar: document.getElementById('packProgressBar'),
    hudMoves: document.getElementById('hudMoves'),
    hudStarTarget: document.getElementById('hudStarTarget'),
    hudTimer: document.getElementById('hudTimer'),
    hudBestRecord: document.getElementById('hudBestRecord'),
    levelTip: document.getElementById('levelTip'),
    toastSlot: document.getElementById('toastSlot'),
    shelvesGrid: document.getElementById('shelvesGrid'),
    tempTrayWrap: document.getElementById('tempTrayWrap'),
    tempCapBadge: document.getElementById('tempCapBadge'),
    tempTrayContainer: document.getElementById('tempTrayContainer'),
    autoCompleteBtn: document.getElementById('autoCompleteBtn'),
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
    winRecordBadges: document.getElementById('winRecordBadges'),
    winSummary: document.getElementById('winSummary'),
    winMoves: document.getElementById('winMoves'),
    winTime: document.getElementById('winTime'),
    winPacks: document.getElementById('winPacks'),
    winCoins: document.getElementById('winCoins'),
    winReplayBtn: document.getElementById('winReplayBtn'),
    nextLevelBtn: document.getElementById('nextLevelBtn'),
    rankModal: document.getElementById('rankModal'),
    closeRankModalBtn: document.getElementById('closeRankModalBtn'),
    rankSummaryBanner: document.getElementById('rankSummaryBanner'),
    rankModalBody: document.getElementById('rankModalBody'),
    tabLadderBtn: document.getElementById('tabLadderBtn'),
    tabRecordsBtn: document.getElementById('tabRecordsBtn'),
    tabAchBtn: document.getElementById('tabAchBtn'),
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
        records: parsed.records && typeof parsed.records === 'object' ? parsed.records : {},
        achievements:
          parsed.achievements && typeof parsed.achievements === 'object' ? parsed.achievements : {},
        stats:
          parsed.stats && typeof parsed.stats === 'object'
            ? parsed.stats
            : { totalPacks: 0, dailyClears: 0, bestCombo: 0, fastestTimeSec: 0 },
        boosters: sanitizeBoosters(parsed.boosters),
      };
    } catch {
      return {
        currentLevelIndex: 0,
        unlockedLevelIndex: 0,
        coins: 0,
        muted: false,
        bestStars: {},
        records: {},
        achievements: {},
        stats: { totalPacks: 0, dailyClears: 0, bestCombo: 0, fastestTimeSec: 0 },
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

  function vibrate(pattern) {
    if (!save.muted && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore unsupported vibration calls.
      }
    }
  }

  let save = loadSave();
  let state = createGameState(save.currentLevelIndex, save.boosters);
  let selected = null;
  let activeHint = null;
  let toastTimer = null;
  let hintTimer = null;
  let adTimer = null;
  let clockTimer = null;
  let elapsedSec = 0;
  let activeRankTab = 'ladder';
  let animFlags = {
    shakeShelfId: null,
    packedShelfId: null,
    packBurst: null,
    landed: null,
    revealedIds: new Set(),
  };

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

  function getTotalCrowns() {
    return LEVELS.reduce((sum, lvl) => sum + (save.records[lvl.id] && save.records[lvl.id].crown ? 1 : 0), 0);
  }

  function getAggregateStats() {
    const clearedCount = LEVELS.filter((lvl) => Number(save.bestStars[lvl.id]) > 0).length;
    return {
      totalStars: getTotalStars(),
      totalCrowns: getTotalCrowns(),
      clearedCount,
      totalPacks: Number(save.stats && save.stats.totalPacks) || 0,
      dailyClears: Number(save.stats && save.stats.dailyClears) || 0,
      bestCombo: Number(save.stats && save.stats.bestCombo) || 0,
      fastestTimeSec: Number(save.stats && save.stats.fastestTimeSec) || 0,
    };
  }

  function formatTime(sec) {
    const s = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }

  function startClock() {
    clearInterval(clockTimer);
    elapsedSec = 0;
    clockTimer = setInterval(() => {
      if (state.status === 'playing' && el.startScreen.classList.contains('hidden')) {
        elapsedSec += 1;
        if (el.hudTimer) el.hudTimer.textContent = formatTime(elapsedSec);
      }
    }, 1000);
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

  function getCurrentLevel() {
    return state.customLevel || LEVELS[state.levelIndex];
  }

  function startLevel(index, customLevel = null) {
    if (!customLevel) {
      save.currentLevelIndex = Math.max(0, Math.min(index, LEVELS.length - 1));
      persistSave();
    }
    state = createGameState(save.currentLevelIndex, save.boosters, customLevel);
    selected = null;
    clearHint();
    animFlags = {
      shakeShelfId: null,
      packedShelfId: null,
      packBurst: null,
      landed: null,
      revealedIds: new Set(),
    };
    el.startScreen.classList.add('hidden');
    el.winModal.classList.add('hidden');
    el.levelModal.classList.add('hidden');
    el.rankModal.classList.add('hidden');
    startClock();
    render();
  }

  function startDailyChallenge() {
    const todayKey = new Date().toISOString().slice(0, 10);
    const dailyLevel = createDailyLevel(todayKey);
    startLevel(save.currentLevelIndex, dailyLevel);
    showToast(`📅 已进入 ${todayKey} 每日盲盒挑战！`);
  }

  function createItemNode(itemId, options = {}) {
    const item = ITEMS[itemId];
    const node = document.createElement('div');
    node.className = 'item-tile';
    if (item.width === 2) node.classList.add('item-tile--wide');
    if (options.isMystery) {
      node.classList.add('item-tile--mystery');
      const emoji = document.createElement('span');
      emoji.className = 'item-emoji';
      emoji.textContent = '❓';
      node.appendChild(emoji);
      const name = document.createElement('span');
      name.className = 'item-name';
      name.textContent = item.width === 2 ? '大件盲盒' : '盲盒';
      node.appendChild(name);
      return node;
    }
    if (options.isSelected) node.classList.add('item-tile--selected');
    if (options.isMatch) node.classList.add('item-tile--match');
    if (options.isLanded) node.classList.add('item-tile--landed');
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

  function getSelectedItemId() {
    if (!selected) return null;
    const src = findShelf(state, selected.shelfId);
    return src ? src.layers[0][selected.itemIndex] || null : null;
  }

  function createPackBurstNode(packBurst) {
    const burst = document.createElement('div');
    burst.className = 'pack-burst';

    const label = document.createElement('span');
    label.className = 'pack-float';
    label.textContent =
      packBurst.combo > 1
        ? `🔥 ×${packBurst.combo} +${packBurst.coinsEarned}💰`
        : `+${packBurst.coinsEarned}💰`;
    burst.appendChild(label);

    const sparks = [
      { tx: '-38px', ty: '-26px', color: '#fcc419' },
      { tx: '38px', ty: '-26px', color: '#ff922b' },
      { tx: '-46px', ty: '6px', color: '#ff6b6b' },
      { tx: '46px', ty: '6px', color: '#51cf66' },
      { tx: '-20px', ty: '28px', color: '#339af0' },
      { tx: '22px', ty: '28px', color: '#fcc419' },
    ];
    for (const s of sparks) {
      const dot = document.createElement('span');
      dot.className = 'pack-spark';
      dot.style.setProperty('--tx', s.tx);
      dot.style.setProperty('--ty', s.ty);
      dot.style.setProperty('--spark-color', s.color);
      burst.appendChild(dot);
    }
    return burst;
  }

  function renderShelfCard(shelf) {
    const card = document.createElement('div');
    card.className = 'shelf-card';
    card.dataset.shelfId = shelf.id;

    const selectedItemId = getSelectedItemId();
    const canAcceptSelected =
      selected &&
      selected.shelfId !== shelf.id &&
      canMoveItem(state, selected.shelfId, selected.itemIndex, shelf.id);
    const willPack =
      canAcceptSelected &&
      selectedItemId &&
      isRowPacked([...shelf.layers[0], selectedItemId], shelf.capacity);

    if (willPack) {
      card.classList.add('shelf-card--pack-ready');
      const readyTag = document.createElement('span');
      readyTag.className = 'pack-ready-tag';
      readyTag.textContent = '✨ 打包!';
      card.appendChild(readyTag);
    } else if (canAcceptSelected) {
      card.classList.add('shelf-card--valid');
    }
    if (activeHint && activeHint.dstShelfId === shelf.id) card.classList.add('shelf-card--hint-dst');
    if (animFlags.shakeShelfId === shelf.id) card.classList.add('shelf-card--shake');
    if (animFlags.packedShelfId === shelf.id) card.classList.add('shelf-card--packed');
    if (animFlags.revealedIds.has(shelf.id)) card.classList.add('shelf-card--revealed');

    const locked = isShelfLocked(state, shelf);
    if (locked) {
      card.classList.add('shelf-card--locked');
      const overlay = document.createElement('div');
      overlay.className = 'lock-overlay';
      const pill = document.createElement('span');
      pill.className = 'lock-pill';
      pill.textContent = `🔒 再打包 ${shelf.unlockAtPacks - state.packsCleared} 箱解锁`;
      overlay.appendChild(pill);
      card.appendChild(overlay);
    }

    if (!shelf.isTemp && shelf.layers.length > 1) {
      const badge = document.createElement('span');
      badge.className = 'depth-badge';
      badge.textContent = state.mysteryBack
        ? `❓盲盒 +${shelf.layers.length - 1}层`
        : `后方 +${shelf.layers.length - 1}层`;
      card.appendChild(badge);
    }

    const stage = document.createElement('div');
    stage.className = 'shelf-stage';

    if (!shelf.isTemp && shelf.layers.length > 1 && shelf.layers[1].length > 0) {
      const peek = document.createElement('div');
      peek.className = 'back-peek-row';
      for (const id of shelf.layers[1]) {
        peek.appendChild(createItemNode(id, { isPreview: true, isMystery: state.mysteryBack }));
      }
      stage.appendChild(peek);
    }

    const front = document.createElement('div');
    front.className = 'front-row';
    const frontItems = shelf.layers[0];

    frontItems.forEach((id, idx) => {
      const isSelected = Boolean(selected && selected.shelfId === shelf.id && selected.itemIndex === idx);
      const isMatch = Boolean(selectedItemId && !isSelected && id === selectedItemId);
      const isLanded = Boolean(
        animFlags.landed && animFlags.landed.shelfId === shelf.id && animFlags.landed.itemIndex === idx
      );
      const isHintSrc = Boolean(
        activeHint && activeHint.srcShelfId === shelf.id && activeHint.itemIndex === idx
      );
      const tile = createItemNode(id, { isSelected, isMatch, isLanded, isHintSrc });
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
    if (animFlags.packBurst && animFlags.packBurst.shelfId === shelf.id) {
      card.appendChild(createPackBurstNode(animFlags.packBurst));
    }
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
      const cost = BOOSTER_COSTS[key];
      const isExpandMax = key === 'expand' && state.tempTray.capacity >= state.tempTray.maxCapacity;
      btn.disabled = state.status !== 'playing' || isExpandMax;
      badge.classList.remove('booster-badge--ad', 'booster-badge--coin');

      if (isExpandMax) {
        badge.textContent = '已满';
      } else if (count > 0) {
        badge.textContent = String(count);
      } else if (save.coins >= cost) {
        badge.textContent = `💰${cost}`;
        badge.classList.add('booster-badge--coin');
      } else {
        badge.textContent = '📺 领';
        badge.classList.add('booster-badge--ad');
      }

      const shouldPulse = deadlocked && (key === 'expand' || key === 'shuffle') && !btn.disabled;
      btn.classList.toggle('booster-btn--pulse', shouldPulse);
    }
  }

  function render() {
    const level = getCurrentLevel();
    applyTheme(level.theme);

    el.levelTitle.textContent = level.title;
    el.eliteTag.classList.toggle('hidden', !level.isElite);
    el.coinCount.textContent = String(save.coins);
    el.soundToggleBtn.textContent = save.muted ? '🔇' : '🔊';

    el.packProgressText.textContent = `${state.packsCleared} / ${state.totalPacks}`;
    const showCombo = state.status === 'playing' && state.combo > 0 && state.comboGrace > 0;
    el.comboPill.classList.toggle('hidden', !showCombo);
    el.comboPill.classList.toggle('combo-pill--fever', showCombo && state.combo >= 3);
    if (showCombo) {
      const prefix = state.combo >= 3 ? '⚡ 狂热连击' : '🔥 连击';
      el.comboPill.textContent = `${prefix} ×${state.combo} · 剩${state.comboGrace}步`;
    }
    const pct = state.totalPacks > 0 ? Math.round((state.packsCleared / state.totalPacks) * 100) : 0;
    el.packProgressBar.style.width = `${pct}%`;
    const target3 = getThreeStarMoves(state.totalPacks, level.parMoves);
    el.hudMoves.textContent = String(state.moves);
    el.hudStarTarget.textContent = `(3⭐≤${target3})`;
    el.hudTimer.textContent = formatTime(elapsedSec);
    const rec = save.records[level.id];
    el.hudBestRecord.textContent =
      rec && rec.bestMoves
        ? `${rec.bestMoves}步/${rec.bestTimeSec}s${rec.crown ? '👑' : ''}`
        : '未通关';
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
    el.autoCompleteBtn.classList.toggle('hidden', deadlocked || !canAutoComplete(state));
    renderBoosters(deadlocked);
  }

  function performMove(srcShelfId, itemIndex, dstShelfId, forceBatch = false) {
    clearHint();
    if (!canMoveItem(state, srcShelfId, itemIndex, dstShelfId)) {
      const src = findShelf(state, srcShelfId);
      const dst = findShelf(state, dstShelfId);
      const itemId = src && src.layers[0][itemIndex];
      const item = ITEMS[itemId];
      animFlags = {
        shakeShelfId: dstShelfId,
        packedShelfId: null,
        packBurst: null,
        landed: null,
        revealedIds: new Set(),
      };
      sfx.error();
      vibrate([18, 30, 18]);
      if (dst && isShelfLocked(state, dst)) {
        showToast(`🔒 再打包 ${dst.unlockAtPacks - state.packsCleared} 箱才能解锁该货架哦~`);
      } else if (item) {
        showToast(`空间不足，「${item.name}」占 ${item.width} 格哦~`);
      }
      render();
      setTimeout(() => {
        animFlags.shakeShelfId = null;
      }, 300);
      return;
    }

    const srcBefore = findShelf(state, srcShelfId);
    const dstBefore = findShelf(state, dstShelfId);
    const movingId = srcBefore && srcBefore.layers[0][itemIndex];
    const shouldBatch =
      forceBatch || Boolean(dstBefore && movingId && dstBefore.layers[0].includes(movingId));
    const res = moveItem(state, srcShelfId, itemIndex, dstShelfId, { batch: shouldBatch });
    selected = null;
    const dstAfter = findShelf(state, dstShelfId);
    const landedIdx = !res.packed && dstAfter ? dstAfter.layers[0].length - 1 : -1;
    animFlags = {
      shakeShelfId: null,
      packedShelfId: res.packed ? res.packed.shelfId : null,
      packBurst: res.packed
        ? { shelfId: res.packed.shelfId, coinsEarned: res.packed.coinsEarned, combo: res.packed.combo }
        : null,
      landed: landedIdx >= 0 ? { shelfId: dstShelfId, itemIndex: landedIdx } : null,
      revealedIds: new Set(res.revealedShelfIds),
    };

    if (res.packed) {
      save.coins += res.packed.coinsEarned;
      persistSave();
      sfx.pack(res.packed.combo);
      vibrate(res.packed.combo > 1 ? [20, 30, 30] : 22);
      if (res.packed.combo >= 2) {
        el.appShell.classList.remove('app-shell--bump');
        void el.appShell.offsetWidth;
        el.appShell.classList.add('app-shell--bump');
      }
      const msg =
        res.packed.combo >= 3
          ? `⚡ 狂热连击 ×${res.packed.combo}！打包 +${res.packed.coinsEarned} 💰`
          : res.packed.combo > 1
            ? `🔥 连击 ×${res.packed.combo}！打包成功 +${res.packed.coinsEarned} 💰`
            : `✨ 打包成功！+${res.packed.coinsEarned} 💰`;
      showToast(msg, res.packed.combo > 1);
    } else {
      sfx.place();
      vibrate(8);
      if (res.movedCount > 1) {
        showToast(`⚡ 同款连携移入 ×${res.movedCount}！`);
      }
    }

    if (res.unlockedShelfIds && res.unlockedShelfIds.length > 0) {
      sfx.reveal();
      showToast('🔓 封条解除！新货架已解锁加入流转！', true);
    } else if (res.revealedShelfIds.length > 0) {
      sfx.reveal();
    }

    render();
    setTimeout(() => {
      animFlags = {
        shakeShelfId: null,
        packedShelfId: null,
        packBurst: null,
        landed: null,
        revealedIds: new Set(),
      };
    }, 620);

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
    if (state.status !== 'playing') return;
    const shelf = findShelf(state, shelfId);
    if (shelf && isShelfLocked(state, shelf)) {
      sfx.error();
      showToast(`🔒 再打包 ${shelf.unlockAtPacks - state.packsCleared} 箱即可解锁该货架~`);
      return;
    }
    if (!selected) return;
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

    performMove(shelfId, itemIndex, candidates[0].id, true);
  }

  function runAutoComplete() {
    if (state.status !== 'playing' || !canAutoComplete(state)) return;
    const step = () => {
      if (state.status !== 'playing') return;
      const hint = findBestHint(state);
      if (!hint || hint.score < 100) return;
      performMove(hint.srcShelfId, hint.itemIndex, hint.dstShelfId, true);
      if (state.status === 'playing' && canAutoComplete(state)) {
        setTimeout(step, 130);
      }
    };
    step();
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
        state.boostersUsed = (state.boostersUsed || 0) + 1;
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

    if (type === 'undo' && state.history.length === 0) {
      showToast('还没有可以撤回的步骤哦~');
      return;
    }

    if (state.boosters[type] <= 0) {
      const cost = BOOSTER_COSTS[type];
      if (save.coins >= cost) {
        if (executeBooster(type)) {
          save.coins -= cost;
          state.boostersUsed = (state.boostersUsed || 0) + 1;
          persistSave();
          render();
        }
        return;
      }
      openSimulatedAd(type);
      return;
    }

    if (executeBooster(type)) {
      state.boosters[type] -= 1;
      state.boostersUsed = (state.boostersUsed || 0) + 1;
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
      const tags = [`${theme.name}`, `${lvl.shelves.length}架`];
      if (lvl.mysteryBack) tags.push('❓盲盒');
      if (lvl.lockedShelves) tags.push('🔒锁架');
      meta.textContent = tags.join(' · ');
      left.appendChild(title);
      left.appendChild(meta);

      const right = document.createElement('div');
      right.className = 'level-item-right';
      const starSpan = document.createElement('span');
      starSpan.className = 'level-stars';
      const rec = save.records[lvl.id];
      const crownIcon = rec && rec.crown ? '👑 ' : '';
      starSpan.textContent = crownIcon + formatStars(Number(save.bestStars[lvl.id]) || 0);
      const statusSpan = document.createElement('span');
      statusSpan.textContent =
        rec && rec.bestMoves
          ? `最佳 ${rec.bestMoves}步 · ${rec.bestTimeSec}s`
          : idx === state.levelIndex
            ? '当前'
            : '未通关';
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
    clearInterval(clockTimer);
    const level = getCurrentLevel();
    const timeSec = Math.max(1, elapsedSec);
    const stars = calculateStars(state.moves, state.totalPacks, level.parMoves);
    const recUpdate = updateLevelRecord(save.records[level.id], {
      stars,
      moves: state.moves,
      timeSec,
      maxCombo: state.maxCombo,
      boostersUsed: state.boostersUsed,
    });
    save.records[level.id] = recUpdate.record;
    save.bestStars[level.id] = recUpdate.record.stars;

    if (!save.stats) {
      save.stats = { totalPacks: 0, dailyClears: 0, bestCombo: 0, fastestTimeSec: 0 };
    }
    save.stats.totalPacks = (Number(save.stats.totalPacks) || 0) + state.packsCleared;
    if (state.isDaily) save.stats.dailyClears = (Number(save.stats.dailyClears) || 0) + 1;
    save.stats.bestCombo = Math.max(Number(save.stats.bestCombo) || 0, state.maxCombo || 0);
    save.stats.fastestTimeSec =
      save.stats.fastestTimeSec > 0 ? Math.min(save.stats.fastestTimeSec, timeSec) : timeSec;

    const achRes = evaluateAchievements(getAggregateStats(), save.achievements);
    save.achievements = achRes.unlockedMap;
    if (achRes.rewardCoins > 0) {
      save.coins += achRes.rewardCoins;
    }
    persistSave();

    const badges = [];
    if (recUpdate.isFirstClear) badges.push('🎉 首次通关记录！');
    if (recUpdate.improvedMoves) badges.push(`🔥 刷新最少步数 (-${recUpdate.moveDelta}步)！`);
    if (recUpdate.improvedTime) badges.push(`⚡ 刷新最快用时 (-${recUpdate.timeDelta}s)！`);
    if (recUpdate.earnedCrown) badges.push('👑 零道具金冠达成！');
    for (const ach of achRes.newlyUnlocked) {
      badges.push(`🎖️ 成就「${ach.title}」+${ach.reward}💰`);
    }

    el.winRecordBadges.innerHTML = '';
    el.winRecordBadges.classList.toggle('hidden', badges.length === 0);
    for (const text of badges) {
      const pill = document.createElement('span');
      pill.className = 'win-record-pill';
      pill.textContent = text;
      el.winRecordBadges.appendChild(pill);
    }

    const isLast = !state.isDaily && state.levelIndex >= LEVELS.length - 1;
    el.winStars.textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    el.winSummary.textContent = state.isDaily
      ? `已完成今日盲盒挑战，获得 ${stars} 星评价！`
      : isLast
        ? `全部 ${LEVELS.length} 个主线关卡已打通！你可以挑战每日盲盒或冲刺全三星。`
        : `已完成「${level.title}」，获得 ${stars} 星评价！`;
    el.winMoves.textContent = String(state.moves);
    el.winTime.textContent = formatTime(timeSec);
    el.winPacks.textContent = `×${Math.max(1, state.maxCombo || 1)}`;
    el.winCoins.textContent = `+${state.coins + achRes.rewardCoins}`;
    el.nextLevelBtn.textContent = state.isDaily ? '返回主线 ➜' : isLast ? '回到第 1 关' : '下一关 ➜';
    render();
    el.winModal.classList.remove('hidden');
  }

  function renderRankModal(tab = activeRankTab) {
    activeRankTab = tab;
    const stats = getAggregateStats();
    const lb = buildLeaderboard(stats);

    const nextHint = lb.nextRival
      ? `距超越「${lb.nextRival.name}」还差 ${Math.max(1, lb.nextRival.score - lb.playerScore)} 分`
      : '已登顶便利店传奇店长榜首！';
    el.rankSummaryBanner.innerHTML =
      `当前排名：<strong>第 ${lb.playerRank} 名</strong>（综合评分 <strong>${lb.playerScore}</strong>）· ` +
      `累计 <strong>${stats.totalStars}⭐</strong> / <strong>${stats.totalCrowns}👑</strong><br>${nextHint}`;

    [
      { btn: el.tabLadderBtn, key: 'ladder' },
      { btn: el.tabRecordsBtn, key: 'records' },
      { btn: el.tabAchBtn, key: 'achievements' },
    ].forEach(({ btn, key }) => {
      btn.classList.toggle('rank-tab--active', key === activeRankTab);
    });

    el.rankModalBody.innerHTML = '';

    if (activeRankTab === 'ladder') {
      lb.entries.forEach((entry, idx) => {
        const row = document.createElement('div');
        row.className = entry.isPlayer ? 'rank-row rank-row--player' : 'rank-row';
        row.innerHTML = `
          <div class="rank-row-left">
            <span class="rank-num">${idx + 1}</span>
            <div>
              <div class="rank-row-title">${entry.badge} ${entry.name}</div>
              <div class="rank-row-sub">${entry.title}</div>
            </div>
          </div>
          <span class="rank-row-score">${entry.score} 分</span>
        `;
        el.rankModalBody.appendChild(row);
      });
      return;
    }

    if (activeRankTab === 'records') {
      LEVELS.forEach((lvl, idx) => {
        const rec = save.records[lvl.id];
        const row = document.createElement('div');
        row.className = 'rank-row';
        const left = document.createElement('div');
        left.className = 'rank-row-left';
        const starText = formatStars(Number(save.bestStars[lvl.id]) || 0);
        const recText =
          rec && rec.bestMoves
            ? `最佳 ${rec.bestMoves} 步 (3⭐≤${lvl.parMoves}) · 用时 ${rec.bestTimeSec}s · 连击 ×${rec.maxCombo || 1}`
            : `尚未通关 · 3⭐目标 ≤${lvl.parMoves} 步`;
        left.innerHTML = `
          <span class="rank-num">${rec && rec.crown ? '👑' : idx + 1}</span>
          <div>
            <div class="rank-row-title">${lvl.title} <span class="level-stars">${starText}</span></div>
            <div class="rank-row-sub">${recText}</div>
          </div>
        `;
        const playBtn = document.createElement('button');
        playBtn.type = 'button';
        playBtn.className = 'pill-btn';
        playBtn.textContent = rec && rec.bestMoves ? '刷纪录' : '挑战';
        playBtn.addEventListener('click', () => startLevel(idx));
        row.appendChild(left);
        row.appendChild(playBtn);
        el.rankModalBody.appendChild(row);
      });
      return;
    }

    for (const ach of ACHIEVEMENTS) {
      const unlocked = Boolean(save.achievements && save.achievements[ach.id]);
      const row = document.createElement('div');
      row.className = unlocked ? 'rank-row rank-row--unlocked' : 'rank-row';
      row.innerHTML = `
        <div class="rank-row-left">
          <span class="rank-num">${ach.icon}</span>
          <div>
            <div class="rank-row-title">${ach.title}</div>
            <div class="rank-row-sub">${ach.desc}</div>
          </div>
        </div>
        <span class="rank-row-score">${unlocked ? '✅ 已达成' : `+${ach.reward}💰`}</span>
      `;
      el.rankModalBody.appendChild(row);
    }
  }

  function openRankModal(tab = 'ladder') {
    renderRankModal(tab);
    el.rankModal.classList.remove('hidden');
  }

  el.startGameBtn.addEventListener('click', () => {
    sfx.select();
    startLevel(save.currentLevelIndex);
  });
  el.startLevelBtn.addEventListener('click', () => {
    sfx.select();
    openLevelModal();
  });
  el.startDailyBtn.addEventListener('click', () => {
    sfx.select();
    startDailyChallenge();
  });
  el.startRankBtn.addEventListener('click', () => {
    sfx.select();
    openRankModal('ladder');
  });
  el.rankBtn.addEventListener('click', () => {
    sfx.select();
    openRankModal('ladder');
  });
  el.closeRankModalBtn.addEventListener('click', () => el.rankModal.classList.add('hidden'));
  el.rankModal.addEventListener('click', (e) => {
    if (e.target === el.rankModal) el.rankModal.classList.add('hidden');
  });
  [el.tabLadderBtn, el.tabRecordsBtn, el.tabAchBtn].forEach((btn) => {
    btn.addEventListener('click', () => renderRankModal(btn.dataset.tab));
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
    startLevel(state.levelIndex, state.customLevel);
    showToast('已重置本关货架');
  });

  el.winReplayBtn.addEventListener('click', () => startLevel(state.levelIndex, state.customLevel));
  el.nextLevelBtn.addEventListener('click', () => {
    if (state.isDaily) {
      startLevel(save.currentLevelIndex);
      return;
    }
    const nextIdx = state.levelIndex + 1 < LEVELS.length ? state.levelIndex + 1 : 0;
    startLevel(nextIdx);
  });

  el.cancelAdBtn.addEventListener('click', () => {
    clearInterval(adTimer);
    el.adModal.classList.add('hidden');
  });

  el.autoCompleteBtn.addEventListener('click', runAutoComplete);

  [el.btnUndo, el.btnExpand, el.btnShuffle, el.btnHint].forEach((btn) => {
    btn.addEventListener('click', () => handleBoosterClick(btn.dataset.booster));
  });

  renderStartScreen();
  render();
})();
