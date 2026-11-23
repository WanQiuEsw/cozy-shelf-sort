(function (root) {
  'use strict';

  const { SHELF_CAPACITY, ITEMS, LEVELS } =
    typeof module !== 'undefined' && module.exports
      ? require('./levels.js')
      : root.ShelfLevels;

  const DEFAULT_BOOSTERS = { undo: 0, expand: 0, shuffle: 0, hint: 0 };
  const COMBO_GRACE_MOVES = 3;

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
        layers: cloneLayers(s.layers),
      })),
      tempTray: {
        id: state.tempTray.id,
        capacity: state.tempTray.capacity,
        maxCapacity: state.tempTray.maxCapacity,
        isTemp: true,
        layers: cloneLayers(state.tempTray.layers),
      },
      moves: state.moves,
      packsCleared: state.packsCleared,
      coins: state.coins,
      combo: state.combo,
      comboGrace: state.comboGrace,
      status: state.status,
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

  function createGameState(levelIndex = 0, savedBoosters) {
    const idx = Math.max(0, Math.min(levelIndex, LEVELS.length - 1));
    const level = LEVELS[idx];
    const shelves = level.shelves.map((rawLayers, i) => ({
      id: `shelf-${i}`,
      capacity: SHELF_CAPACITY,
      isTemp: false,
      layers: rawLayers.length ? cloneLayers(rawLayers) : [[]],
    }));

    return {
      levelIndex: idx,
      levelId: level.id,
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
      comboGrace: 0,
      status: 'playing',
    };
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

  function canMoveItem(state, srcShelfId, itemIndex, dstShelfId) {
    if (!state || state.status !== 'playing') return false;
    if (srcShelfId === dstShelfId) return false;

    const src = findShelf(state, srcShelfId);
    const dst = findShelf(state, dstShelfId);
    if (!src || !dst) return false;
    if (dst.isTemp && dst.capacity <= 0) return false;

    const srcFront = src.layers[0];
    if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= srcFront.length) {
      return false;
    }

    const item = ITEMS[srcFront[itemIndex]];
    if (!item) return false;

    return getRemainingWidth(dst) >= item.width;
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

  function moveItem(state, srcShelfId, itemIndex, dstShelfId) {
    if (!canMoveItem(state, srcShelfId, itemIndex, dstShelfId)) {
      return { ok: false, reason: 'invalid_move' };
    }

    state.history.push(snapshot(state));

    const src = findShelf(state, srcShelfId);
    const dst = findShelf(state, dstShelfId);
    const [itemId] = src.layers[0].splice(itemIndex, 1);
    dst.layers[0].push(itemId);
    state.moves += 1;

    let packed = null;
    if (isRowPacked(dst.layers[0], dst.capacity)) {
      const packedItemId = dst.layers[0][0];
      dst.layers[0] = [];
      state.packsCleared += 1;
      state.combo += 1;
      state.comboGrace = COMBO_GRACE_MOVES;
      const coinsEarned = 10 + Math.max(0, state.combo - 1) * 5;
      state.coins += coinsEarned;
      packed = { shelfId: dst.id, itemId: packedItemId, coinsEarned, combo: state.combo };
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

    const deadlocked = !won && isDeadlocked(state);

    return { ok: true, itemId, packed, revealedShelfIds, won, deadlocked };
  }

  function undoMove(state) {
    if (!state || state.history.length === 0) {
      return { ok: false, reason: 'empty_history' };
    }
    const prev = state.history.pop();
    state.shelves = prev.shelves;
    state.tempTray = prev.tempTray;
    state.moves = prev.moves;
    state.packsCleared = prev.packsCleared;
    state.coins = prev.coins;
    state.combo = prev.combo;
    state.comboGrace = prev.comboGrace || 0;
    state.status = prev.status;
    return { ok: true };
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
    const pool = [];
    for (const shelf of state.shelves) {
      for (const id of shelf.layers[0]) pool.push(id);
    }
    if (pool.length <= 1) {
      return { ok: false, reason: 'nothing_to_shuffle' };
    }

    const beforeKey = state.shelves.map((s) => s.layers[0].join(',')).join('|');
    const wide = pool.filter((id) => ITEMS[id].width > 1);
    const narrow = pool.filter((id) => ITEMS[id].width === 1);

    let bestLayout = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      fisherYates(wide, rng);
      fisherYates(narrow, rng);
      // Place wide items before narrow ones so 1-slot fragments never strand a 2-slot item.
      const ordered = [...wide, ...narrow];
      const buckets = state.shelves.map(() => []);
      const used = state.shelves.map(() => 0);
      const indices = state.shelves.map((_, i) => i);

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

    state.shelves.forEach((shelf, i) => {
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

  function calculateStars(moves, totalPacks) {
    const packs = Math.max(1, totalPacks || 1);
    if (moves <= packs * 4) return 3;
    if (moves <= packs * 6) return 2;
    return 1;
  }

  const api = {
    DEFAULT_BOOSTERS,
    COMBO_GRACE_MOVES,
    createGameState,
    getRowWidth,
    getRemainingWidth,
    isRowPacked,
    getAllShelves,
    findShelf,
    canMoveItem,
    moveItem,
    isDeadlocked,
    undoMove,
    expandTempTray,
    shuffleFrontRows,
    findBestHint,
    validateLevel,
    calculateStars,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.ShelfGame = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
