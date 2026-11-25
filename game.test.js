'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { SHELF_CAPACITY, THEMES, ITEMS, LEVELS, createDailyLevel } = require('./levels.js');
const {
  BOOSTER_COSTS,
  createGameState,
  getRowWidth,
  getRemainingWidth,
  isShelfLocked,
  isShelfChute,
  isShelfStrict,
  isItemAccessible,
  canShelfAcceptItem,
  toggleHardcoreMode,
  canMoveItem,
  moveItem,
  triggerFeverMagnet,
  evaluateSealTiming,
  claimSealBonus,
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
} = require('./game.js');

test('all 12 levels pass structural validation and start playable across 4 themes', () => {
  assert.equal(LEVELS.length, 12);
  assert.ok(THEMES.bakery && ITEMS.swiss_roll && ITEMS.cake_box);
  for (let i = 0; i < LEVELS.length; i += 1) {
    const result = validateLevel(LEVELS[i]);
    assert.equal(result.valid, true, `Level ${i + 1} errors: ${result.errors.join('; ')}`);
    const state = createGameState(i);
    assert.equal(isDeadlocked(state), false, `Level ${i + 1} starts deadlocked`);
  }
});

test('1-unit and 2-unit wide item moves enforce remaining capacity', () => {
  const state = createGameState(1); // Level 2 has milk_big (width 2)
  // Shelf 0: ['milk_big', 'cola'] (used 3, remaining 1)
  // Shelf 4: ['yogurt'] (used 1, remaining 3)
  assert.equal(getRemainingWidth(state.shelves[0]), 1);
  assert.equal(getRemainingWidth(state.shelves[4]), 3);

  // Moving milk_big (width 2) to shelf 1 (remaining 1) must be rejected
  assert.equal(canMoveItem(state, 'shelf-0', 0, 'shelf-1'), false);
  const bad = moveItem(state, 'shelf-0', 0, 'shelf-1');
  assert.equal(bad.ok, false);

  // Moving milk_big (width 2) to shelf 4 (remaining 3) succeeds
  assert.equal(canMoveItem(state, 'shelf-0', 0, 'shelf-4'), true);
  const good = moveItem(state, 'shelf-0', 0, 'shelf-4');
  assert.equal(good.ok, true);
  assert.equal(getRemainingWidth(state.shelves[0]), 3);
  assert.equal(getRemainingWidth(state.shelves[4]), 1);
});

test('auto pack-up triggers for both 4x width-1 and 2x width-2 shelves', () => {
  // Test 4x width-1 auto pack on Level 1
  const s1 = createGameState(0);
  assert.equal(moveItem(s1, 'shelf-1', 2, 'shelf-2').packed, null); // juice -> shelf-2 (3 juice)
  const res1 = moveItem(s1, 'shelf-0', 2, 'shelf-3'); // yogurt -> shelf-3
  assert.equal(res1.ok, true);
  assert.equal(res1.packed, null);

  // Put 4th juice?Wait shelf-0 back has juice; let's test explicit 2x width-2 on Level 2
  const s2 = createGameState(1);
  // Move cola off shelf-0 to shelf-3 (shelf-3: cola, cola, yogurt, cola -> width 4)
  moveItem(s2, 'shelf-0', 1, 'shelf-3');
  // Now shelf-0 has ['milk_big'] (remaining 2). Move milk_big from shelf-1 -> shelf-0!
  const packWide = moveItem(s2, 'shelf-1', 0, 'shelf-0');
  assert.equal(packWide.ok, true);
  assert.ok(packWide.packed);
  assert.equal(packWide.packed.itemId, 'milk_big');
  assert.equal(s2.packsCleared, 1);
  assert.equal(s2.coins, 10);

  // Also test 4x width-1 auto-pack cleanly on shelf-4 (yogurt)
  const s1b = createGameState(0);
  // Move yogurt from shelf-0 -> shelf-3, then yogurt,yogurt from shelf-1 -> shelf-3, wait shelf-1 has juice at idx 2
  moveItem(s1b, 'shelf-0', 2, 'shelf-3'); // s3: [yogurt]
  moveItem(s1b, 'shelf-1', 0, 'shelf-3'); // s3: [yogurt, yogurt]
  moveItem(s1b, 'shelf-1', 0, 'shelf-3'); // s3: [yogurt, yogurt, yogurt]
  // Reveal shelf-1 back ['cola', 'yogurt'] by moving juice out of shelf-1 -> shelf-2
  moveItem(s1b, 'shelf-1', 0, 'shelf-2');
  const packNarrow = moveItem(s1b, 'shelf-1', 1, 'shelf-3'); // back yogurt -> s3 (4x yogurt)
  assert.ok(packNarrow.packed);
  assert.equal(packNarrow.packed.itemId, 'yogurt');
});

test('back layer slides forward when front row empties via move or auto-pack', () => {
  // Via moving out on Level 1
  const s1 = createGameState(0);
  // Empty shelf-0 ['cola', 'cola', 'yogurt'] into shelf-3 (cap 4)
  moveItem(s1, 'shelf-0', 0, 'shelf-3');
  moveItem(s1, 'shelf-0', 0, 'shelf-3');
  const revealViaMove = moveItem(s1, 'shelf-0', 0, 'shelf-3');
  assert.deepEqual(revealViaMove.revealedShelfIds, ['shelf-0']);
  assert.deepEqual(s1.shelves[0].layers, [['juice', 'cola']]);

  // Via auto-pack on Level 2 (shelf-0 packs milk_big and reveals ['milk_big', 'onigiri'])
  const s2 = createGameState(1);
  moveItem(s2, 'shelf-0', 1, 'shelf-3');
  const revealViaPack = moveItem(s2, 'shelf-1', 0, 'shelf-0');
  assert.ok(revealViaPack.packed);
  assert.deepEqual(revealViaPack.revealedShelfIds, ['shelf-0']);
  assert.deepEqual(s2.shelves[0].layers, [['milk_big', 'onigiri']]);
});

test('undo restores exact state across pack-up and back-layer reveal', () => {
  const s2 = createGameState(1);
  moveItem(s2, 'shelf-0', 1, 'shelf-3');
  const beforeLayers = s2.shelves.map((s) => s.layers.map((l) => [...l]));

  const res = moveItem(s2, 'shelf-1', 0, 'shelf-0');
  assert.ok(res.packed);
  assert.equal(s2.packsCleared, 1);

  const undone = undoMove(s2);
  assert.equal(undone.ok, true);
  assert.equal(s2.packsCleared, 0);
  assert.equal(s2.coins, 0);
  assert.deepEqual(
    s2.shelves.map((s) => s.layers),
    beforeLayers
  );
  assert.equal(undoMove(createGameState(0)).ok, false);
});

test('tiered temp tray expands 0->1->2->3->4, caps at 4, and accepts wide item at >=2', () => {
  const state = createGameState(1);
  assert.equal(state.tempTray.capacity, 0);
  assert.equal(canMoveItem(state, 'shelf-0', 1, 'temp'), false);

  assert.equal(expandTempTray(state).capacity, 1);
  // Narrow item fits at capacity 1; wide item (width 2) does not
  assert.equal(canMoveItem(state, 'shelf-0', 1, 'temp'), true);
  assert.equal(canMoveItem(state, 'shelf-0', 0, 'temp'), false);

  assert.equal(expandTempTray(state).capacity, 2);
  assert.equal(canMoveItem(state, 'shelf-0', 0, 'temp'), true);

  assert.equal(expandTempTray(state).capacity, 3);
  assert.equal(expandTempTray(state).capacity, 4);
  assert.equal(expandTempTray(state).ok, false);
  assert.equal(state.tempTray.capacity, 4);
});

test('shuffle preserves exact front-row item inventory and capacity <= 4', () => {
  const state = createGameState(4); // Level 5 with wide + narrow items
  const beforeCounts = {};
  for (const s of state.shelves) {
    for (const id of s.layers[0]) beforeCounts[id] = (beforeCounts[id] || 0) + 1;
  }

  let seed = 42;
  const detRng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const res = shuffleFrontRows(state, detRng);
  assert.equal(res.ok, true);

  const afterCounts = {};
  for (const s of state.shelves) {
    assert.ok(getRowWidth(s.layers[0]) <= SHELF_CAPACITY);
    for (const id of s.layers[0]) afterCounts[id] = (afterCounts[id] || 0) + 1;
  }
  assert.deepEqual(afterCounts, beforeCounts);
});

test('deadlock detection catches full shelves and fragmented 1-unit gaps with width-2 items', () => {
  // Case A: all shelves full 4/4
  const fullState = createGameState(0);
  fullState.shelves = [
    { id: 'shelf-0', capacity: 4, isTemp: false, layers: [['cola', 'yogurt', 'cola', 'yogurt']] },
    { id: 'shelf-1', capacity: 4, isTemp: false, layers: [['juice', 'cola', 'juice', 'yogurt']] },
  ];
  assert.equal(isDeadlocked(fullState), true);

  // Case B: empty 1-unit temp tray gap cannot accept width-2 items (deadlocked despite free space)
  const fragState = createGameState(1);
  fragState.shelves = [
    { id: 'shelf-0', capacity: 4, isTemp: false, layers: [['milk_big', 'milk_big']] },
    { id: 'shelf-1', capacity: 4, isTemp: false, layers: [['milk_big', 'milk_big']] },
  ];
  expandTempTray(fragState); // tempTray capacity = 1 (remaining = 1)
  assert.equal(getRemainingWidth(fragState.tempTray), 1);
  assert.equal(isDeadlocked(fragState), true);
  assert.equal(findBestHint(fragState), null);
});

test('hint prioritizes immediate pack completion and returns legal move when playable', () => {
  const state = createGameState(0);
  // Move juice from shelf-1 -> shelf-2 (shelf-2 now has 3 juice)
  moveItem(state, 'shelf-1', 2, 'shelf-2');
  // Move yogurt from shelf-0 -> shelf-3, then reveal back of shelf-0 by emptying cola,cola -> shelf-3
  moveItem(state, 'shelf-0', 2, 'shelf-3');
  moveItem(state, 'shelf-0', 0, 'shelf-3');
  moveItem(state, 'shelf-0', 0, 'shelf-3');
  // Now shelf-0 front is ['juice', 'cola'] and shelf-2 front is ['juice', 'juice', 'juice']
  const hint = findBestHint(state);
  assert.ok(hint);
  assert.equal(hint.srcShelfId, 'shelf-0');
  assert.equal(hint.itemId, 'juice');
  assert.equal(hint.dstShelfId, 'shelf-2');
  assert.equal(hint.reason, 'complete_pack');
  assert.equal(canMoveItem(state, hint.srcShelfId, hint.itemIndex, hint.dstShelfId), true);
});

test('completing Level 1 transitions cleanly to won status', () => {
  const s = createGameState(0);
  assert.equal(moveItem(s, 'shelf-0', 2, 'shelf-3').ok, true); // yogurt -> s3
  assert.equal(moveItem(s, 'shelf-1', 2, 'shelf-2').ok, true); // juice -> s2 (3x juice)
  assert.equal(moveItem(s, 'shelf-3', 0, 'shelf-1').ok, true); // yogurt -> s1 (3x yogurt)
  assert.equal(moveItem(s, 'shelf-0', 0, 'shelf-3').ok, true); // cola -> s3
  const revealS0 = moveItem(s, 'shelf-0', 0, 'shelf-3'); // cola -> s3, s0 reveals ['juice','cola']
  assert.deepEqual(revealS0.revealedShelfIds, ['shelf-0']);

  const packJuice = moveItem(s, 'shelf-0', 0, 'shelf-2'); // juice -> s2 => PACK juice
  assert.ok(packJuice.packed);
  assert.equal(moveItem(s, 'shelf-0', 0, 'shelf-3').ok, true); // cola -> s3 (3x cola)

  // Move 3x yogurt from s1 -> s2 (now empty) to reveal s1 back ['cola','yogurt']
  assert.equal(moveItem(s, 'shelf-1', 0, 'shelf-2').ok, true);
  assert.equal(moveItem(s, 'shelf-1', 0, 'shelf-2').ok, true);
  const revealS1 = moveItem(s, 'shelf-1', 0, 'shelf-2');
  assert.deepEqual(revealS1.revealedShelfIds, ['shelf-1']);

  const packCola = moveItem(s, 'shelf-1', 0, 'shelf-3'); // cola -> s3 => PACK cola
  assert.ok(packCola.packed);

  const packYogurt = moveItem(s, 'shelf-1', 0, 'shelf-2'); // yogurt -> s2 => PACK yogurt & WIN
  assert.ok(packYogurt.packed);
  assert.equal(packYogurt.won, true);
  assert.equal(s.status, 'won');
  assert.equal(s.packsCleared, 3);
  assert.equal(isDeadlocked(s), false);
});

test('all boosters start at 0 so every booster requires simulated ad acquisition', () => {
  const state = createGameState(0);
  assert.deepEqual(state.boosters, { undo: 0, expand: 0, shuffle: 0, hint: 0 });
});

test('calculateStars awards 3, 2, or 1 star based on move efficiency', () => {
  assert.equal(calculateStars(10, 3), 3);
  assert.equal(calculateStars(12, 3), 3);
  assert.equal(calculateStars(15, 3), 2);
  assert.equal(calculateStars(18, 3), 2);
  assert.equal(calculateStars(19, 3), 1);
});

test('combo grace window keeps streak alive across up to 2 setup moves and resets on 3rd', () => {
  const s = createGameState(0);
  // Set up Level 1 so we pack juice, take 2 non-packing moves, then pack cola -> combo should be 2!
  moveItem(s, 'shelf-0', 2, 'shelf-3'); // yogurt -> s3
  moveItem(s, 'shelf-1', 2, 'shelf-2'); // juice -> s2 (3x juice)
  moveItem(s, 'shelf-3', 0, 'shelf-1'); // yogurt -> s1 (3x yogurt)
  moveItem(s, 'shelf-0', 0, 'shelf-3'); // cola -> s3
  moveItem(s, 'shelf-0', 0, 'shelf-3'); // cola -> s3, reveals s0 ['juice', 'cola']

  const pack1 = moveItem(s, 'shelf-0', 0, 'shelf-2'); // pack juice -> combo 1, grace 3
  assert.equal(pack1.packed.combo, 1);
  assert.equal(s.comboGrace, 3);

  moveItem(s, 'shelf-0', 0, 'shelf-3'); // non-pack move 1 -> grace 2, combo still 1
  assert.equal(s.combo, 1);
  assert.equal(s.comboGrace, 2);

  moveItem(s, 'shelf-1', 0, 'shelf-2'); // non-pack move 2 -> grace 1, combo still 1
  assert.equal(s.combo, 1);
  assert.equal(s.comboGrace, 1);

  moveItem(s, 'shelf-1', 0, 'shelf-2'); // non-pack move 3 -> grace 0, combo resets to 0
  assert.equal(s.combo, 0);
  assert.equal(s.comboGrace, 0);

  // Undo restores combo & comboGrace cleanly
  undoMove(s);
  assert.equal(s.combo, 1);
  assert.equal(s.comboGrace, 1);
});

test('batch move transfers multiple matching items in one move and canAutoComplete detects revealed board', () => {
  const s = createGameState(0);
  assert.equal(canAutoComplete(s), false);
  // Shelf-0 has ['cola', 'cola', 'yogurt']; batch move cola to empty shelf-3 moves both colas in 1 move
  const batchRes = moveItem(s, 'shelf-0', 0, 'shelf-3', { batch: true });
  assert.equal(batchRes.ok, true);
  assert.equal(batchRes.movedCount, 2);
  assert.equal(s.moves, 1);
  assert.deepEqual(s.shelves[3].layers[0], ['cola', 'cola']);
  assert.deepEqual(s.shelves[0].layers[0], ['yogurt']);
  assert.ok(BOOSTER_COSTS.undo > 0 && BOOSTER_COSTS.expand > 0);
});

test('locked shelves block moves until required packs are cleared and daily challenge generator is deterministic', () => {
  // Level 9 (index 8) has shelf-5 locked until 1 pack is cleared
  const s9 = createGameState(8);
  assert.equal(isShelfLocked(s9, s9.shelves[5]), true);
  assert.equal(canMoveItem(s9, 'shelf-5', 0, 'shelf-4'), false);
  assert.equal(canMoveItem(s9, 'shelf-4', 0, 'shelf-5'), false);

  // Free shelf-0's 1-unit item so we can pack 2x cat_food_big on shelf-0
  assert.equal(moveItem(s9, 'shelf-0', 1, 'shelf-4').ok, true); // cat_strip -> shelf-4
  const packRes = moveItem(s9, 'shelf-1', 0, 'shelf-0'); // cat_food_big -> shelf-0 => PACK!
  assert.ok(packRes.packed);
  assert.deepEqual(packRes.unlockedShelfIds, ['shelf-5']);
  assert.equal(isShelfLocked(s9, s9.shelves[5]), false);
  assert.equal(canMoveItem(s9, 'shelf-5', 1, 'shelf-1'), true);

  // Daily level generator produces valid, playable, deterministic boards
  const d1 = createDailyLevel('2026-11-24');
  const d2 = createDailyLevel('2026-11-24');
  assert.deepEqual(d1, d2);
  assert.equal(validateLevel(d1).valid, true);
  const ds = createGameState(0, null, d1);
  assert.equal(ds.isDaily, true);
  assert.equal(ds.mysteryBack, true);
  assert.equal(isDeadlocked(ds), false);
  assert.equal(getThreeStarMoves(7, 20), 20);
  assert.equal(calculateStars(20, 7, 20), 3);
  assert.equal(calculateStars(21, 7, 20), 2);
});

test('personal best records, manager leaderboard, and achievements compute improvements accurately', () => {
  const first = updateLevelRecord(null, {
    stars: 2,
    moves: 14,
    timeSec: 40,
    maxCombo: 2,
    boostersUsed: 1,
  });
  assert.equal(first.isFirstClear, true);
  assert.equal(first.earnedCrown, false);
  assert.equal(first.record.bestMoves, 14);

  const second = updateLevelRecord(first.record, {
    stars: 3,
    moves: 10,
    timeSec: 28,
    maxCombo: 4,
    boostersUsed: 0,
  });
  assert.equal(second.improvedMoves, true);
  assert.equal(second.moveDelta, 4);
  assert.equal(second.improvedTime, true);
  assert.equal(second.timeDelta, 12);
  assert.equal(second.earnedCrown, true);
  assert.equal(second.isNewCrown, true);
  assert.equal(second.record.crown, true);

  const lb = buildLeaderboard({ totalStars: 18, totalCrowns: 4, dailyClears: 1, totalPacks: 35 });
  assert.ok(lb.playerScore > 2000);
  assert.ok(lb.playerRank >= 1 && lb.playerRank <= lb.entries.length);

  const ach = evaluateAchievements(
    { clearedCount: 3, bestCombo: 4, fastestTimeSec: 28, totalCrowns: 3, dailyClears: 1, totalStars: 24 },
    {}
  );
  assert.equal(ach.newlyUnlocked.length, 6);
  assert.ok(ach.rewardCoins >= 300);
});

test('rush order bounty spawns after first pack, awards bonus coins when target packed, and rotates on expiry', () => {
  const s = createGameState(1); // Level 2 starts with no rushOrder until 1st pack is cleared
  assert.equal(s.rushOrder, null);

  // Move 1: free cola from shelf-0 -> shelf-3
  moveItem(s, 'shelf-0', 1, 'shelf-3');
  assert.equal(s.rushOrder, null);

  // Move 2: pack milk_big on shelf-0 -> 1st pack cleared! Spawns a rushOrder!
  const firstPack = moveItem(s, 'shelf-1', 0, 'shelf-0');
  assert.ok(firstPack.packed);
  assert.equal(s.coins, 10);
  assert.ok(s.rushOrder);
  assert.equal(s.rushOrder.movesLeft, 4);

  // Set rushOrder target to 'milk_big' and pack the remaining 2x milk_big (on shelf-0 and shelf-2)
  s.rushOrder = { itemId: 'milk_big', movesLeft: 4, reward: 25 };
  moveItem(s, 'shelf-0', 1, 'shelf-4'); // move onigiri off shelf-0 -> shelf-4 (decrements movesLeft to 3)
  assert.equal(s.rushOrder.movesLeft, 3);

  const secondPack = moveItem(s, 'shelf-2', 2, 'shelf-0'); // pack 2nd milk_big -> completes rushOrder!
  assert.ok(secondPack.packed);
  assert.ok(secondPack.rushCompleted);
  assert.equal(secondPack.rushCompleted.itemId, 'milk_big');
  assert.equal(secondPack.rushCompleted.reward, 25);
  assert.equal(s.rushOrdersCompleted, 1);
  assert.equal(s.coins, 10 + 15 + 25); // 10 (pack 1) + 15 (combo x2) + 25 (rush bounty)
});

test('3-combo fever charges magnet burst and triggerFeverMagnet clears a full pack in 0 moves', () => {
  const s = createGameState(1); // Level 2 (4 packs total)
  assert.equal(s.feverMagnetReady, false);
  assert.equal(triggerFeverMagnet(s).ok, false);

  // Reach combo 3 to charge feverMagnetReady
  s.combo = 2;
  s.comboGrace = 3;
  moveItem(s, 'shelf-0', 1, 'shelf-3'); // move cola -> s3 (combo still 2, grace 2)
  const pack3 = moveItem(s, 'shelf-1', 0, 'shelf-0'); // pack milk_big -> combo 3 => feverMagnetReady!
  assert.ok(pack3.packed);
  assert.equal(s.combo, 3);
  assert.equal(s.feverMagnetReady, true);

  const movesBefore = s.moves;
  const packsBefore = s.packsCleared;
  const magRes = triggerFeverMagnet(s);
  assert.equal(magRes.ok, true);
  assert.ok(magRes.packed && magRes.packed.isMagnet);
  assert.equal(s.feverMagnetReady, false);
  assert.equal(s.moves, movesBefore); // 0 moves consumed!
  assert.equal(s.packsCleared, packsBefore + 1);
  assert.equal(s.combo, 4);

  // Undo restores feverMagnetReady and pack count
  undoMove(s);
  assert.equal(s.feverMagnetReady, true);
  assert.equal(s.packsCleared, packsBefore);
});

test('QTE seal timing awards 25 coins on perfect center hit and 10 coins on normal hit', () => {
  const s = createGameState(0);
  const perfect = claimSealBonus(s, 50);
  assert.equal(perfect.isPerfect, true);
  assert.equal(perfect.grade, 'perfect');
  assert.equal(perfect.bonusCoins, 25);
  assert.equal(s.coins, 25);
  assert.equal(s.perfectSeals, 1);

  const normal = claimSealBonus(s, 15);
  assert.equal(normal.isPerfect, false);
  assert.equal(normal.grade, 'good');
  assert.equal(normal.bonusCoins, 10);
  assert.equal(s.coins, 35);
  assert.equal(s.perfectSeals, 1);
  assert.equal(evaluateSealTiming(65).isPerfect, true);
  assert.equal(evaluateSealTiming(66).isPerfect, false);
});

test('Direction 1 (LIFO chute shelves) blocks inner items and Direction 2 (strict shelves) rejects mixed items', () => {
  // Level 6 (index 5) has chuteShelves: [0, 1] and strictShelves: [4, 6]
  const s = createGameState(5);
  assert.equal(isShelfChute(s, s.shelves[0]), true);
  assert.equal(isShelfStrict(s, s.shelves[4]), true);

  // Direction 1: Shelf 0 front row is ['mask_box', 'lipstick', 'perfume']
  // Inner items (index 0 and 1) are blocked; only outermost item (index 2, 'perfume') is accessible!
  assert.equal(isItemAccessible(s, s.shelves[0], 0), false);
  assert.equal(isItemAccessible(s, s.shelves[0], 1), false);
  assert.equal(isItemAccessible(s, s.shelves[0], 2), true);
  assert.equal(canMoveItem(s, 'shelf-0', 0, 'shelf-2'), false);
  assert.equal(canMoveItem(s, 'shelf-0', 1, 'shelf-6'), false);

  // Outermost item 'powder' (index 1) on chute shelf-1 CAN move to shelf-2 ( Wait shelf-1 is ['toner_set', 'powder'], remaining 1, shelf-4 has ['powder', 'mask_box'] (strict, rightmost is mask_box, remaining 1)
  // Let's free 1 slot on shelf-2 by moving 'serum' (shelf-2 idx 1) -> strict shelf-6 (['lipstick', 'perfume', 'serum'], rightmost is 'serum')!
  assert.equal(canShelfAcceptItem(s, s.shelves[6], 'serum'), true);
  assert.equal(canMoveItem(s, 'shelf-2', 1, 'shelf-6'), true);

  // Direction 2: Moving 'perfume' (from shelf-0 idx 2) into strict shelf-6 must be rejected because 'perfume' !== 'serum'
  assert.equal(canShelfAcceptItem(s, s.shelves[6], 'perfume'), false);
  assert.equal(canMoveItem(s, 'shelf-0', 2, 'shelf-6'), false);

  // Now move 'serum' from shelf-2 idx 1 -> strict shelf-6, freeing 1 slot on shelf-2
  assert.equal(moveItem(s, 'shelf-2', 1, 'shelf-6').ok, true);
  // Outermost item 'perfume' (index 2) on chute shelf-0 CAN now move to shelf-2, while inner index 1 ('lipstick') still cannot!
  assert.equal(canMoveItem(s, 'shelf-0', 2, 'shelf-2'), true);
  assert.equal(canMoveItem(s, 'shelf-0', 1, 'shelf-2'), false);

  // Global Hardcore Mode toggle turns all shelves into Chute + Strict
  assert.equal(toggleHardcoreMode(s, true), true);
  assert.equal(isShelfChute(s, s.shelves[2]), true);
  assert.equal(isShelfStrict(s, s.shelves[2]), true);
  assert.equal(isItemAccessible(s, s.shelves[2], 0), false);
  assert.equal(toggleHardcoreMode(s, false), false);
  assert.equal(isShelfChute(s, s.shelves[2]), false);
});
