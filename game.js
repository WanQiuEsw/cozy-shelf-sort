(function (root) {
  'use strict';

  const { SHELF_CAPACITY, ITEMS, LEVELS } =
    typeof module !== 'undefined' && module.exports
      ? require('./levels.js')
      : root.ShelfLevels;

  const DEFAULT_BOOSTERS = { undo: 0, expand: 0, shuffle: 0, hint: 0 };
  const BOOSTER_COSTS = { undo: 25, hint: 30, shuffle: 50, expand: 60 };
  const COMBO_GRACE_MOVES = 3;
  const RUSH_ORDER_MOVES = 4;
  const RUSH_ORDER_REWARD = 25;
  const SEAL_PERFECT_MIN = 35;
  const SEAL_PERFECT_MAX = 65;
  const SEAL_PERFECT_REWARD = 25;
  const SEAL_GOOD_REWARD = 10;

  function getRowWidth(row) {
    let total = 0;
    for (let i = 0; i < row.length; i += 1) {
      const item = ITEMS[row[i]];
      total += item ? item.width : 0;
    }
    return total;
  }

  function getRemainingWidth(shelf) {
    const front = shelf.layers[0] || [];
    return Math.max(0, shelf.capacity - getRowWidth(front));
  }

  function isRowPacked(row, capacity) {
    if (capacity !== SHELF_CAPACITY || row.length === 0) return false;
    const first = row[0];
    return getRowWidth(row) === SHELF_CAPACITY && row.every((id) => id === first);
  }

  function cloneLayers(layers) {
    return layers.map((row) => row.slice());
  }

  function snapshot(state) {
    return {
      shelves: state.shelves.map((s) => ({
        id: s.id,
        capacity: s.capacity,
        isTemp: false,
        isChute: Boolean(s.isChute),
        isStrict: Boolean(s.isStrict),
        unlockAtPacks: s.unlockAtPacks || 0,
        layers: cloneLayers(s.layers),
      })),
      tempTray: {
        id: state.tempTray.id,
        capacity: state.tempTray.capacity,
        maxCapacity: state.tempTray.maxCapacity,
        isTemp: true,
        layers: cloneLayers(state.tempTray.layers),
      },
      hardcoreMode: Boolean(state.hardcoreMode),
      moves: state.moves,
      packsCleared: state.packsCleared,
      coins: state.coins,
      combo: state.combo,
      maxCombo: state.maxCombo,
      comboGrace: state.comboGrace,
      feverMagnetReady: Boolean(state.feverMagnetReady),
      rushOrder: state.rushOrder ? { ...state.rushOrder } : null,
      rushOrdersCompleted: state.rushOrdersCompleted || 0,
      perfectSeals: state.perfectSeals || 0,
      boostersUsed: state.boostersUsed,
      status: state.status,
    };
  }

  function evaluateSealTiming(cursorPct) {
    const pct = Math.max(0, Math.min(100, Number(cursorPct) || 0));
    const isPerfect = pct >= SEAL_PERFECT_MIN && pct <= SEAL_PERFECT_MAX;
    return {
      grade: isPerfect ? 'perfect' : 'good',
      label: isPerfect ? '🎯 完美封箱 CRIT!' : '📦 极速封箱!',
      bonusCoins: isPerfect ? SEAL_PERFECT_REWARD : SEAL_GOOD_REWARD,
      isPerfect,
    };
  }

  function claimSealBonus(state, cursorPct) {
    if (!state) return evaluateSealTiming(cursorPct);
    const res = evaluateSealTiming(cursorPct);
    state.coins += res.bonusCoins;
    if (res.isPerfect) {
      state.perfectSeals = (state.perfectSeals || 0) + 1;
    }
    return res;
  }

  function pickNextRushOrder(shelves, tempTray, excludeItemId = null) {
    const counts = {};
    const order = [];
    const all = tempTray ? [...shelves, tempTray] : shelves;
    for (const s of all) {
      if (!s || !s.layers || !s.layers[0]) continue;
      for (const id of s.layers[0]) {
        if (!counts[id]) {
          counts[id] = 0;
          order.push(id);
        }
        counts[id] += 1;
      }
    }
    const packable = order.filter((id) => {
      const item = ITEMS[id];
      return item && counts[id] * item.width >= SHELF_CAPACITY;
    });
    const pool = packable.length > 0 ? packable : order;
    if (pool.length === 0) return null;
    const candidates = pool.length > 1 && excludeItemId
      ? pool.filter((id) => id !== excludeItemId)
      : pool;
    candidates.sort((a, b) => counts[b] - counts[a]);
    return {
      itemId: candidates[0],
      movesLeft: RUSH_ORDER_MOVES,
      reward: RUSH_ORDER_REWARD,
    };
  }

  function countTotalPacks(shelves) {
    let totalWidth = 0;
    for (const rawShelf of shelves) {
      for (const layer of rawShelf) {
        totalWidth += getRowWidth(layer);
      }
    }
    return Math.round(totalWidth / SHELF_CAPACITY);
  }

  function createGameState(levelIndex = 0, savedBoosters, customLevel = null, options = {}) {
    const idx = Math.max(0, Math.min(levelIndex, LEVELS.length - 1));
    const level = customLevel || LEVELS[idx];
    const lockedMap = (level && level.lockedShelves) || {};
    const chuteSet = new Set(Array.isArray(level && level.chuteShelves) ? level.chuteShelves : []);
    const strictSet = new Set(Array.isArray(level && level.strictShelves) ? level.strictShelves : []);
    const hardcoreMode = Boolean((options && options.hardcoreMode) || (level && level.hardcoreMode));

    const shelves = level.shelves.map((rawLayers, i) => ({
      id: `shelf-${i}`,
      capacity: SHELF_CAPACITY,
      isTemp: false,
      isChute: hardcoreMode || chuteSet.has(i),
      isStrict: hardcoreMode || strictSet.has(i),
      unlockAtPacks: Number(lockedMap[i]) || 0,
      layers: rawLayers.length ? cloneLayers(rawLayers) : [[]],
    }));

    return {
      levelIndex: idx,
      levelId: level.id,
      isDaily: Boolean(level.isDaily),
      mysteryBack: Boolean(level.mysteryBack),
      hardcoreMode,
      parMoves: level.parMoves || null,
      customLevel: customLevel || null,
      shelves,
      tempTray: {
        id: 'temp',
        capacity: 0,
        maxCapacity: SHELF_CAPACITY,
        isTemp: true,
        layers: [[]],
      },
      history: [],
      boosters: { ...DEFAULT_BOOSTERS, ...(savedBoosters || {}) },
      coins: 0,
      moves: 0,
      packsCleared: 0,
      totalPacks: countTotalPacks(level.shelves),
      combo: 0,
      maxCombo: 0,
      comboGrace: 0,
      feverMagnetReady: false,
      rushOrder: null,
      rushOrdersCompleted: 0,
      perfectSeals: 0,
      boostersUsed: 0,
      status: 'playing',
    };
  }

  function isShelfLocked(state, shelf) {
    return Boolean(state && shelf && !shelf.isTemp && (shelf.unlockAtPacks || 0) > state.packsCleared);
  }

  function getAllShelves(state) {
    return state.tempTray.capacity > 0
      ? [...state.shelves, state.tempTray]
      : [...state.shelves];
  }

  function findShelf(state, shelfId) {
    if (shelfId === state.tempTray.id) return state.tempTray;
    return state.shelves.find((s) => s.id === shelfId) || null;
  }

  function isShelfChute(state, shelf) {
    return Boolean(shelf && !shelf.isTemp && (shelf.isChute || (state && state.hardcoreMode)));
  }

  function isShelfStrict(state, shelf) {
    return Boolean(shelf && !shelf.isTemp && (shelf.isStrict || (state && state.hardcoreMode)));
  }

  function isItemAccessible(state, shelf, itemIndex) {
    if (!shelf || !Array.isArray(shelf.layers) || !Array.isArray(shelf.layers[0])) return false;
    const front = shelf.layers[0];
    if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= front.length) return false;
    if (isShelfChute(state, shelf)) {
      return itemIndex === front.length - 1;
    }
    return true;
  }

  function canShelfAcceptItem(state, dst, itemId) {
    if (!dst || !itemId || !ITEMS[itemId]) return false;
    const item = ITEMS[itemId];
    if (getRemainingWidth(dst) < item.width) return false;
    if (isShelfStrict(state, dst)) {
      const dstFront = dst.layers[0];
      if (dstFront.length > 0 && dstFront[dstFront.length - 1] !== itemId) {
        return false;
      }
    }
    return true;
  }

  function canMoveItem(state, srcShelfId, itemIndex, dstShelfId) {
    if (!state || state.status !== 'playing') return false;
    if (srcShelfId === dstShelfId) return false;

    const src = findShelf(state, srcShelfId);
    const dst = findShelf(state, dstShelfId);
    if (!src || !dst) return false;
    if (isShelfLocked(state, src) || isShelfLocked(state, dst)) return false;
    if (dst.isTemp && dst.capacity <= 0) return false;

    if (!isItemAccessible(state, src, itemIndex)) {
      return false;
    }

    const itemId = src.layers[0][itemIndex];
    return canShelfAcceptItem(state, dst, itemId);
  }

  function slideIfEmpty(shelf) {
    let revealed = false;
    while (!shelf.isTemp && shelf.layers[0].length === 0 && shelf.layers.length > 1) {
      shelf.layers.shift();
      revealed = true;
    }
    return revealed;
  }

  function isBoardCleared(state) {
    for (const shelf of [...state.shelves, state.tempTray]) {
      for (const layer of shelf.layers) {
        if (layer.length > 0) return false;
      }
    }
    return true;
  }

  function isDeadlocked(state) {
    if (!state || state.status !== 'playing') return false;
    const shelves = getAllShelves(state);
    for (const src of shelves) {
      const front = src.layers[0];
      for (let i = 0; i < front.length; i += 1) {
        for (const dst of shelves) {
          if (canMoveItem(state, src.id, i, dst.id)) return false;
        }
      }
    }
    return true;
  }

  function moveItem(state, srcShelfId, itemIndex, dstShelfId, options = {}) {
    if (!canMoveItem(state, srcShelfId, itemIndex, dstShelfId)) {
      return { ok: false, reason: 'invalid_move' };
    }

    state.history.push(snapshot(state));

    const src = findShelf(state, srcShelfId);
    const dst = findShelf(state, dstShelfId);
    const [itemId] = src.layers[0].splice(itemIndex, 1);
    dst.layers[0].push(itemId);
    let movedCount = 1;

    if (options && options.batch) {
      const itemWidth = ITEMS[itemId].width;
      const srcIsChute = isShelfChute(state, src);
      while (
        !isRowPacked(dst.layers[0], dst.capacity) &&
        getRemainingWidth(dst) >= itemWidth
      ) {
        let nextIdx = -1;
        if (srcIsChute) {
          const topIdx = src.layers[0].length - 1;
          if (topIdx >= 0 && src.layers[0][topIdx] === itemId) nextIdx = topIdx;
        } else {
          nextIdx = src.layers[0].indexOf(itemId);
        }
        if (nextIdx === -1) break;
        src.layers[0].splice(nextIdx, 1);
        dst.layers[0].push(itemId);
        movedCount += 1;
      }
    }

    state.moves += 1;

    let packed = null;
    const unlockedShelfIds = [];
    if (isRowPacked(dst.layers[0], dst.capacity)) {
      const prevPacks = state.packsCleared;
      const packedItemId = dst.layers[0][0];
      dst.layers[0] = [];
      state.packsCleared += 1;
      for (const s of state.shelves) {
        if ((s.unlockAtPacks || 0) > prevPacks && (s.unlockAtPacks || 0) <= state.packsCleared) {
          unlockedShelfIds.push(s.id);
        }
      }
      state.combo += 1;
      state.maxCombo = Math.max(state.maxCombo || 0, state.combo);
      state.comboGrace = COMBO_GRACE_MOVES;
      const isFever = state.combo >= 3;
      if (isFever) state.feverMagnetReady = true;
      const coinsEarned = 10 + Math.max(0, state.combo - 1) * 5 + (isFever ? 5 : 0);
      state.coins += coinsEarned;
      packed = { shelfId: dst.id, itemId: packedItemId, coinsEarned, combo: state.combo, isFever };
    } else if (state.comboGrace > 0) {
      state.comboGrace -= 1;
      if (state.comboGrace === 0) state.combo = 0;
    } else {
      state.combo = 0;
    }

    const revealedShelfIds = [];
    if (slideIfEmpty(src)) revealedShelfIds.push(src.id);
    if (slideIfEmpty(dst)) revealedShelfIds.push(dst.id);

    const won = isBoardCleared(state);
    if (won) state.status = 'won';

    let rushCompleted = null;
    if (state.rushOrder) {
      if (packed && packed.itemId === state.rushOrder.itemId) {
        const rushBonus = state.rushOrder.reward;
        state.coins += rushBonus;
        packed.coinsEarned += rushBonus;
        packed.rushBonus = rushBonus;
        state.rushOrdersCompleted = (state.rushOrdersCompleted || 0) + 1;
        rushCompleted = { itemId: packed.itemId, reward: rushBonus };
        state.rushOrder = won ? null : pickNextRushOrder(state.shelves, state.tempTray, packed.itemId);
      } else if (won) {
        state.rushOrder = null;
      } else {
        state.rushOrder.movesLeft -= 1;
        if (state.rushOrder.movesLeft <= 0) {
          state.rushOrder = pickNextRushOrder(state.shelves, state.tempTray, state.rushOrder.itemId);
        }
      }
    } else if (!won && state.packsCleared >= 1) {
      state.rushOrder = pickNextRushOrder(state.shelves, state.tempTray, packed ? packed.itemId : null);
    }

    const deadlocked = !won && isDeadlocked(state);

    return {
      ok: true,
      itemId,
      movedCount,
      packed,
      rushCompleted,
      revealedShelfIds,
      unlockedShelfIds,
      won,
      deadlocked,
    };
  }

  function undoMove(state) {
    if (!state || state.history.length === 0) {
      return { ok: false, reason: 'empty_history' };
    }
    const prev = state.history.pop();
    state.shelves = prev.shelves;
    state.tempTray = prev.tempTray;
    state.hardcoreMode = Boolean(prev.hardcoreMode);
    state.moves = prev.moves;
    state.packsCleared = prev.packsCleared;
    state.coins = prev.coins;
    state.combo = prev.combo;
    state.maxCombo = prev.maxCombo || 0;
    state.comboGrace = prev.comboGrace || 0;
    state.feverMagnetReady = Boolean(prev.feverMagnetReady);
    state.rushOrder = prev.rushOrder ? { ...prev.rushOrder } : null;
    state.rushOrdersCompleted = prev.rushOrdersCompleted || 0;
    state.perfectSeals = prev.perfectSeals || 0;
    state.boostersUsed = prev.boostersUsed || 0;
    state.status = prev.status;
    return { ok: true };
  }

  function findBestMagnetTarget(state) {
    if (!state || state.status !== 'playing') return null;
    const all = getAllShelves(state).filter((s) => !isShelfLocked(state, s));
    const frontCounts = {};
    const totalCounts = {};

    for (const s of state.shelves) {
      for (let lIdx = 0; lIdx < s.layers.length; lIdx += 1) {
        for (const id of s.layers[lIdx]) {
          totalCounts[id] = (totalCounts[id] || 0) + 1;
          if (lIdx === 0 && !isShelfLocked(state, s)) {
            frontCounts[id] = (frontCounts[id] || 0) + 1;
          }
        }
      }
    }
    if (state.tempTray && state.tempTray.capacity > 0) {
      for (const id of state.tempTray.layers[0]) {
        totalCounts[id] = (totalCounts[id] || 0) + 1;
        frontCounts[id] = (frontCounts[id] || 0) + 1;
      }
    }

    const candidates = Object.keys(totalCounts).filter((id) => {
      const item = ITEMS[id];
      return item && totalCounts[id] >= SHELF_CAPACITY / item.width;
    });
    if (candidates.length === 0) return null;

    const rushId = state.rushOrder && state.rushOrder.itemId;
    candidates.sort((a, b) => {
      const aIsRush = a === rushId ? 1 : 0;
      const bIsRush = b === rushId ? 1 : 0;
      if (aIsRush !== bIsRush) return bIsRush - aIsRush;
      return (frontCounts[b] || 0) - (frontCounts[a] || 0);
    });

    const targetId = candidates[0];
    let bestShelf = all[0] || state.shelves[0];
    let bestHits = -1;
    for (const s of all) {
      if (s.isTemp) continue;
      const hits = s.layers[0].filter((id) => id === targetId).length;
      if (hits > bestHits) {
        bestHits = hits;
        bestShelf = s;
      }
    }
    return { itemId: targetId, shelfId: bestShelf ? bestShelf.id : 'shelf-0' };
  }

  function triggerFeverMagnet(state) {
    if (!state || state.status !== 'playing' || !state.feverMagnetReady) {
      return { ok: false, reason: 'not_ready' };
    }
    const target = findBestMagnetTarget(state);
    if (!target) {
      return { ok: false, reason: 'no_target' };
    }

    state.history.push(snapshot(state));
    state.feverMagnetReady = false;

    const item = ITEMS[target.itemId];
    let needed = SHELF_CAPACITY / item.width;
    const affectedShelves = new Set();

    // 1. Pull matching items from unlocked front rows & tempTray first
    for (const s of getAllShelves(state)) {
      if (isShelfLocked(state, s)) continue;
      for (let i = 0; i < s.layers[0].length && needed > 0; ) {
        if (s.layers[0][i] === target.itemId) {
          s.layers[0].splice(i, 1);
          needed -= 1;
          affectedShelves.add(s);
        } else {
          i += 1;
        }
      }
    }

    // 2. Pull remaining matching items from back layers or locked shelves if needed
    for (const s of state.shelves) {
      for (let lIdx = 0; lIdx < s.layers.length && needed > 0; lIdx += 1) {
        const layer = s.layers[lIdx];
        for (let i = 0; i < layer.length && needed > 0; ) {
          if (layer[i] === target.itemId) {
            layer.splice(i, 1);
            needed -= 1;
            affectedShelves.add(s);
          } else {
            i += 1;
          }
        }
      }
    }

    // Clean up any empty back layers or slide forward
    const revealedShelfIds = [];
    for (const s of affectedShelves) {
      if (!s.isTemp) {
        for (let lIdx = s.layers.length - 1; lIdx >= 1; lIdx -= 1) {
          if (s.layers[lIdx].length === 0) s.layers.splice(lIdx, 1);
        }
        if (slideIfEmpty(s)) revealedShelfIds.push(s.id);
      }
    }

    const prevPacks = state.packsCleared;
    state.packsCleared += 1;
    const unlockedShelfIds = [];
    for (const s of state.shelves) {
      if ((s.unlockAtPacks || 0) > prevPacks && (s.unlockAtPacks || 0) <= state.packsCleared) {
        unlockedShelfIds.push(s.id);
      }
    }

    state.combo += 1;
    state.maxCombo = Math.max(state.maxCombo || 0, state.combo);
    state.comboGrace = COMBO_GRACE_MOVES;
    const coinsEarned = 15 + Math.max(0, state.combo - 1) * 5;
    state.coins += coinsEarned;

    const packed = {
      shelfId: target.shelfId,
      itemId: target.itemId,
      coinsEarned,
      combo: state.combo,
      isFever: true,
      isMagnet: true,
    };

    const won = isBoardCleared(state);
    if (won) state.status = 'won';

    let rushCompleted = null;
    if (state.rushOrder && state.rushOrder.itemId === target.itemId) {
      const rushBonus = state.rushOrder.reward;
      state.coins += rushBonus;
      packed.coinsEarned += rushBonus;
      packed.rushBonus = rushBonus;
      state.rushOrdersCompleted = (state.rushOrdersCompleted || 0) + 1;
      rushCompleted = { itemId: target.itemId, reward: rushBonus };
      state.rushOrder = won ? null : pickNextRushOrder(state.shelves, state.tempTray, target.itemId);
    } else if (won) {
      state.rushOrder = null;
    }

    const deadlocked = !won && isDeadlocked(state);

    return {
      ok: true,
      itemId: target.itemId,
      packed,
      rushCompleted,
      revealedShelfIds,
      unlockedShelfIds,
      won,
      deadlocked,
    };
  }

  function toggleHardcoreMode(state, enabled) {
    if (!state) return false;
    const level = state.customLevel || LEVELS[state.levelIndex];
    const chuteSet = new Set(Array.isArray(level && level.chuteShelves) ? level.chuteShelves : []);
    const strictSet = new Set(Array.isArray(level && level.strictShelves) ? level.strictShelves : []);
    const next = typeof enabled === 'boolean' ? enabled : !state.hardcoreMode;
    state.hardcoreMode = next;
    state.shelves.forEach((s, i) => {
      s.isChute = next || chuteSet.has(i);
      s.isStrict = next || strictSet.has(i);
    });
    return state.hardcoreMode;
  }

  function expandTempTray(state) {
    if (!state || state.status !== 'playing') {
      return { ok: false, reason: 'not_playing' };
    }
    if (state.tempTray.capacity >= state.tempTray.maxCapacity) {
      return { ok: false, reason: 'max_reached' };
    }
    state.tempTray.capacity += 1;
    return { ok: true, capacity: state.tempTray.capacity };
  }

  function fisherYates(arr, rng) {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
  }

  function shuffleFrontRows(state, rng = Math.random) {
    if (!state || state.status !== 'playing') {
      return { ok: false, reason: 'not_playing' };
    }
    const unlockedShelves = state.shelves.filter((s) => !isShelfLocked(state, s));
    const pool = [];
    for (const shelf of unlockedShelves) {
      for (const id of shelf.layers[0]) pool.push(id);
    }
    if (pool.length <= 1) {
      return { ok: false, reason: 'nothing_to_shuffle' };
    }

    const beforeKey = unlockedShelves.map((s) => s.layers[0].join(',')).join('|');
    const wide = pool.filter((id) => ITEMS[id].width > 1);
    const narrow = pool.filter((id) => ITEMS[id].width === 1);

    let bestLayout = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      fisherYates(wide, rng);
      fisherYates(narrow, rng);
      // Place wide items before narrow ones so 1-slot fragments never strand a 2-slot item.
      const ordered = [...wide, ...narrow];
      const buckets = unlockedShelves.map(() => []);
      const used = unlockedShelves.map(() => 0);
      const indices = unlockedShelves.map((_, i) => i);

      for (const itemId of ordered) {
        const w = ITEMS[itemId].width;
        fisherYates(indices, rng);
        const fitting = indices.filter((idx) => SHELF_CAPACITY - used[idx] >= w);
        const nonPacking = fitting.filter((idx) => {
          const candidate = [...buckets[idx], itemId];
          return !isRowPacked(candidate, SHELF_CAPACITY);
        });
        const targetIdx = (nonPacking.length ? nonPacking : fitting)[0];
        buckets[targetIdx].push(itemId);
        used[targetIdx] += w;
      }

      const afterKey = buckets.map((b) => b.join(',')).join('|');
      const hasPacked = buckets.some((b) => isRowPacked(b, SHELF_CAPACITY));
      bestLayout = buckets;
      if (afterKey !== beforeKey && !hasPacked) break;
    }

    unlockedShelves.forEach((shelf, i) => {
      shelf.layers[0] = bestLayout[i];
    });
    return { ok: true };
  }

  function scoreMove(state, src, itemIndex, dst) {
    const itemId = src.layers[0][itemIndex];
    const item = ITEMS[itemId];
    const srcFront = src.layers[0];
    const dstFront = dst.layers[0];

    const simulatedDst = [...dstFront, itemId];
    if (isRowPacked(simulatedDst, dst.capacity)) {
      return { score: 10000, reason: 'complete_pack' };
    }

    const dstAllSame = dstFront.length > 0 && dstFront.every((id) => id === itemId);
    const srcAllSame = srcFront.every((id) => id === itemId);

    if (dstAllSame && (!srcAllSame || dstFront.length >= srcFront.length)) {
      return { score: 2000 + dstFront.length * 10, reason: 'consolidate' };
    }

    if (srcFront.length === 1 && src.layers.length > 1) {
      return { score: 1500, reason: 'reveal_back_layer' };
    }

    const hasWideItem = getAllShelves(state).some((s) =>
      s.layers[0].some((id) => ITEMS[id].width > 1)
    );
    const srcRemBefore = getRemainingWidth(src);
    if (hasWideItem && srcRemBefore < 2 && srcRemBefore + item.width >= 2 && !srcAllSame) {
      return { score: 1000, reason: 'open_wide_slot' };
    }

    if (dstFront.length === 0 && srcFront.length > 1 && !srcAllSame) {
      return { score: 100, reason: 'free_mixed_shelf' };
    }

    if (dstFront.length === 0 && srcFront.length === 1 && src.layers.length === 1) {
      return { score: -100, reason: 'redundant_empty_move' };
    }

    return { score: 10, reason: 'reposition' };
  }

  function findBestHint(state) {
    if (!state || state.status !== 'playing') return null;
    const shelves = getAllShelves(state);
    let best = null;

    for (const src of shelves) {
      const seenTypes = new Set();
      for (let i = 0; i < src.layers[0].length; i += 1) {
        if (!isItemAccessible(state, src, i)) continue;
        const itemId = src.layers[0][i];
        if (seenTypes.has(itemId)) continue;
        seenTypes.add(itemId);

        for (const dst of shelves) {
          if (!canMoveItem(state, src.id, i, dst.id)) continue;
          const { score, reason } = scoreMove(state, src, i, dst);
          if (!best || score > best.score) {
            best = {
              srcShelfId: src.id,
              itemIndex: i,
              dstShelfId: dst.id,
              itemId,
              score,
              reason,
            };
          }
        }
      }
    }

    return best;
  }

  function validateLevel(level) {
    const errors = [];
    if (!level || !Array.isArray(level.shelves) || level.shelves.length === 0) {
      return { valid: false, errors: ['Missing or empty shelves'] };
    }

    const counts = {};
    level.shelves.forEach((layers, sIdx) => {
      if (!Array.isArray(layers) || layers.length === 0) {
        errors.push(`Shelf ${sIdx} has no layers`);
        return;
      }
      layers.forEach((layer, lIdx) => {
        for (const id of layer) {
          if (!ITEMS[id]) errors.push(`Unknown item "${id}" at shelf ${sIdx} layer ${lIdx}`);
          counts[id] = (counts[id] || 0) + 1;
        }
        const width = getRowWidth(layer);
        if (width > SHELF_CAPACITY) {
          errors.push(`Shelf ${sIdx} layer ${lIdx} exceeds capacity (${width}/${SHELF_CAPACITY})`);
        }
        if (lIdx === 0 && isRowPacked(layer, SHELF_CAPACITY)) {
          errors.push(`Shelf ${sIdx} front layer starts already packed`);
        }
      });
    });

    for (const [id, count] of Object.entries(counts)) {
      const item = ITEMS[id];
      if (!item) continue;
      const perPack = SHELF_CAPACITY / item.width;
      if (count % perPack !== 0) {
        errors.push(`Item "${id}" count ${count} is not divisible by ${perPack}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  function canAutoComplete(state) {
    if (!state || state.status !== 'playing' || state.packsCleared < 1) return false;
    if (state.shelves.some((s) => s.layers.length > 1 || isShelfLocked(state, s))) return false;
    const hint = findBestHint(state);
    return Boolean(hint && hint.score >= 100);
  }

  function getThreeStarMoves(totalPacks, parMoves) {
    if (Number.isInteger(parMoves) && parMoves > 0) return parMoves;
    return Math.max(1, totalPacks || 1) * 4;
  }

  function calculateStars(moves, totalPacks, parMoves) {
    const target3 = getThreeStarMoves(totalPacks, parMoves);
    const target2 = Number.isInteger(parMoves) && parMoves > 0
      ? Math.ceil(target3 * 1.45)
      : Math.max(1, totalPacks || 1) * 6;
    if (moves <= target3) return 3;
    if (moves <= target2) return 2;
    return 1;
  }

  function updateLevelRecord(prev, result) {
    const old = prev && typeof prev === 'object' ? prev : {};
    const prevMoves = Number.isInteger(old.bestMoves) && old.bestMoves > 0 ? old.bestMoves : null;
    const prevTime = Number.isInteger(old.bestTimeSec) && old.bestTimeSec > 0 ? old.bestTimeSec : null;
    const moves = Math.max(1, Number(result.moves) || 1);
    const timeSec = Math.max(1, Number(result.timeSec) || 1);
    const stars = Math.max(1, Number(result.stars) || 1);
    const maxCombo = Math.max(0, Number(result.maxCombo) || 0);
    const earnedCrown = (Number(result.boostersUsed) || 0) === 0;

    const improvedMoves = prevMoves !== null && moves < prevMoves;
    const improvedTime = prevTime !== null && timeSec < prevTime;
    const isFirstClear = prevMoves === null;
    const isNewCrown = earnedCrown && !old.crown;

    const record = {
      stars: Math.max(Number(old.stars) || 0, stars),
      bestMoves: prevMoves !== null ? Math.min(prevMoves, moves) : moves,
      bestTimeSec: prevTime !== null ? Math.min(prevTime, timeSec) : timeSec,
      maxCombo: Math.max(Number(old.maxCombo) || 0, maxCombo),
      crown: Boolean(old.crown || earnedCrown),
      clears: (Number(old.clears) || 0) + 1,
    };

    return {
      record,
      isFirstClear,
      improvedMoves,
      moveDelta: prevMoves !== null ? Math.max(0, prevMoves - moves) : 0,
      improvedTime,
      timeDelta: prevTime !== null ? Math.max(0, prevTime - timeSec) : 0,
      earnedCrown,
      isNewCrown,
    };
  }

  const MANAGER_LADDER = [
    { name: '传奇收纳神 · 店长S', badge: '👑', score: 4350, title: '全满星零道具传说' },
    { name: '秋名山理货王 · 阿杰', badge: '🏆', score: 3600, title: '极速连击主理人' },
    { name: '强迫症满星控 · 小满', badge: '✨', score: 2850, title: '高阶空间规划师' },
    { name: '烘焙甜点师 · 桃子', badge: '🍰', score: 2150, title: '甜品区金牌店长' },
    { name: '猫咖主理人 · 团子', badge: '🐾', score: 1500, title: '萌宠货架资深组长' },
    { name: '彩妆陈列师 · 薇薇', badge: '💄', score: 950, title: '精致梳妆收纳达人' },
    { name: '冰柜补货手 · 阿伟', badge: '🥤', score: 450, title: '夜班勤奋理货员' },
    { name: '摸鱼见习生 · 小新', badge: '🌱', score: 100, title: '刚入职便利店萌新' },
  ];

  function buildLeaderboard(stats = {}) {
    const totalStars = Number(stats.totalStars) || 0;
    const totalCrowns = Number(stats.totalCrowns) || 0;
    const dailyClears = Number(stats.dailyClears) || 0;
    const totalPacks = Number(stats.totalPacks) || 0;
    const playerScore = totalStars * 100 + totalCrowns * 55 + dailyClears * 80 + totalPacks * 2;

    const playerEntry = {
      name: '我（本店长）',
      badge: '🧑',
      score: playerScore,
      title: `${totalStars}⭐ · ${totalCrowns}👑 · 打包${totalPacks}箱`,
      isPlayer: true,
    };

    const entries = [...MANAGER_LADDER, playerEntry].sort((a, b) =>
      b.score !== a.score ? b.score - a.score : (b.isPlayer ? 1 : -1)
    );
    const playerIndex = entries.findIndex((e) => e.isPlayer);
    const nextRival = playerIndex > 0 ? entries[playerIndex - 1] : null;

    return {
      playerScore,
      playerRank: playerIndex + 1,
      nextRival,
      entries,
    };
  }

  const ACHIEVEMENTS = [
    { id: 'first_clear', icon: '📦', title: '初次理货大捷', desc: '首次通关任意关卡', reward: 30, check: (s) => s.clearedCount >= 1 },
    { id: 'combo_master', icon: '🔥', title: '狂热连击达人', desc: '单局最高连击达到 ×4', reward: 50, check: (s) => s.bestCombo >= 4 },
    { id: 'speed_runner', icon: '⚡', title: '秋名山闪电手', desc: '35 秒内通关任意关卡', reward: 50, check: (s) => s.fastestTimeSec > 0 && s.fastestTimeSec <= 35 },
    { id: 'crown_hunter', icon: '👑', title: '零道具硬核派', desc: '累计获得 3 枚零道具金冠', reward: 80, check: (s) => s.totalCrowns >= 3 },
    { id: 'daily_star', icon: '📅', title: '盲盒打卡店长', desc: '完成 1 次每日盲盒挑战', reward: 60, check: (s) => s.dailyClears >= 1 },
    { id: 'star_master', icon: '🌟', title: '强迫症满星王', desc: '累计收集 24 颗通关星星', reward: 100, check: (s) => s.totalStars >= 24 },
  ];

  function evaluateAchievements(stats, unlockedMap = {}) {
    const newlyUnlocked = [];
    let rewardCoins = 0;
    const nextUnlocked = { ...unlockedMap };

    for (const ach of ACHIEVEMENTS) {
      if (!nextUnlocked[ach.id] && ach.check(stats)) {
        nextUnlocked[ach.id] = true;
        newlyUnlocked.push(ach);
        rewardCoins += ach.reward;
      }
    }
    return { unlockedMap: nextUnlocked, newlyUnlocked, rewardCoins };
  }

  const api = {
    DEFAULT_BOOSTERS,
    BOOSTER_COSTS,
    COMBO_GRACE_MOVES,
    RUSH_ORDER_MOVES,
    RUSH_ORDER_REWARD,
    SEAL_PERFECT_MIN,
    SEAL_PERFECT_MAX,
    SEAL_PERFECT_REWARD,
    SEAL_GOOD_REWARD,
    MANAGER_LADDER,
    ACHIEVEMENTS,
    createGameState,
    pickNextRushOrder,
    evaluateSealTiming,
    claimSealBonus,
    getRowWidth,
    getRemainingWidth,
    isRowPacked,
    isShelfLocked,
    isShelfChute,
    isShelfStrict,
    isItemAccessible,
    canShelfAcceptItem,
    toggleHardcoreMode,
    getAllShelves,
    findShelf,
    canMoveItem,
    moveItem,
    triggerFeverMagnet,
    isDeadlocked,
    undoMove,
    expandTempTray,
    shuffleFrontRows,
    findBestHint,
    canAutoComplete,
    validateLevel,
    getThreeStarMoves,
    calculateStars,
    updateLevelRecord,
    buildLeaderboard,
    evaluateAchievements,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.ShelfGame = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
