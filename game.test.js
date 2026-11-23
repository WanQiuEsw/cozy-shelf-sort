'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { SHELF_CAPACITY, ITEMS, LEVELS } = require('./levels.js');
const {
  createGameState,
  getRowWidth,
  getRemainingWidth,
  canMoveItem,
  moveItem,
  isDeadlocked,
  undoMove,
  expandTempTray,
  shuffleFrontRows,
  findBestHint,
  validateLevel,
} = require('./game.js');

test('all 6 levels pass structural validation and start playable', () => {
  assert.equal(LEVELS.length, 6);
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
