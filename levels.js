(function (root) {
  'use strict';

  const SHELF_CAPACITY = 4;

  const THEMES = {
    fridge: {
      id: 'fridge',
      name: '便利店冰柜',
      subtitle: '冷气十足 · 饮品鲜食整理',
      accent: '#2b9cd8',
      bgGradient: 'linear-gradient(180deg, #e7f6ff 0%, #f4fbff 100%)',
      shelfBg: 'rgba(255, 255, 255, 0.78)',
      shelfBorder: '#b7dff5',
      ledgeBg: 'linear-gradient(180deg, #cfeafa 0%, #9acde9 100%)',
    },
    catcafe: {
      id: 'catcafe',
      name: '萌宠猫咖架',
      subtitle: '暖木原色 · 零食咖啡归类',
      accent: '#d97a38',
      bgGradient: 'linear-gradient(180deg, #fff4e8 0%, #fffaf4 100%)',
      shelfBg: 'rgba(255, 251, 245, 0.85)',
      shelfBorder: '#ebd2b8',
      ledgeBg: 'linear-gradient(180deg, #e8c39e 0%, #c89464 100%)',
    },
    vanity: {
      id: 'vanity',
      name: '治愈梳妆台',
      subtitle: '柔粉亚克力 · 护肤彩妆收纳',
      accent: '#d95b8c',
      bgGradient: 'linear-gradient(180deg, #ffeef4 0%, #fff7fa 100%)',
      shelfBg: 'rgba(255, 255, 255, 0.82)',
      shelfBorder: '#f4c7d8',
      ledgeBg: 'linear-gradient(180deg, #f9d5e2 0%, #e7a4be 100%)',
    },
    bakery: {
      id: 'bakery',
      name: '甜品烘焙坊',
      subtitle: '暖杏奶油 · 糕点礼盒归类',
      accent: '#c2612c',
      bgGradient: 'linear-gradient(180deg, #fff6e8 0%, #fffdf8 100%)',
      shelfBg: 'rgba(255, 252, 245, 0.86)',
      shelfBorder: '#f0d4b4',
      ledgeBg: 'linear-gradient(180deg, #f5cfa6 0%, #d99b66 100%)',
    },
  };

  const ITEMS = {
    // 便利店冰柜
    cola: { id: 'cola', name: '冰可乐', emoji: '🥤', width: 1, bg: '#ffe3e3', border: '#f48989', accent: '#c92a2a' },
    yogurt: { id: 'yogurt', name: '原味酸奶', emoji: '🥛', width: 1, bg: '#edf5ff', border: '#8cb8f5', accent: '#2563eb' },
    juice: { id: 'juice', name: '鲜橙汁', emoji: '🍊', width: 1, bg: '#fff1dc', border: '#f7b259', accent: '#d97706' },
    onigiri: { id: 'onigiri', name: '金枪鱼饭团', emoji: '🍙', width: 1, bg: '#eef7ee', border: '#7ec484', accent: '#15803d' },
    matcha: { id: 'matcha', name: '抹茶拿铁', emoji: '🍵', width: 1, bg: '#eaf8e6', border: '#6dbd63', accent: '#166534' },
    milk_big: { id: 'milk_big', name: '大桶鲜奶', emoji: '🧃', width: 2, bg: '#e3f4ff', border: '#4da8e2', accent: '#0369a1' },

    // 萌宠猫咖架
    cat_strip: { id: 'cat_strip', name: '金枪猫条', emoji: '🐟', width: 1, bg: '#e6f5ff', border: '#6db6e8', accent: '#0284c7' },
    fish_can: { id: 'fish_can', name: '鲜肉罐头', emoji: '🥫', width: 1, bg: '#ffe9df', border: '#f29572', accent: '#c2410c' },
    paw_cookie: { id: 'paw_cookie', name: '猫爪曲奇', emoji: '🐾', width: 1, bg: '#fff2d8', border: '#e9b259', accent: '#b45309' },
    latte: { id: 'latte', name: '拉花拿铁', emoji: '☕', width: 1, bg: '#f4ece3', border: '#b89474', accent: '#6d4c32' },
    cat_food_big: { id: 'cat_food_big', name: '大袋猫粮', emoji: '🛍️', width: 2, bg: '#ffefd9', border: '#e59a49', accent: '#9a3412' },
    litter_box: { id: 'litter_box', name: '大箱猫砂', emoji: '📦', width: 2, bg: '#efe8ff', border: '#9d7fe0', accent: '#6d28d9' },

    // 治愈梳妆台
    lipstick: { id: 'lipstick', name: '丝绒口红', emoji: '💄', width: 1, bg: '#ffe2ea', border: '#ef769b', accent: '#be185d' },
    perfume: { id: 'perfume', name: '花漾香水', emoji: '🧴', width: 1, bg: '#f4e8ff', border: '#b383e8', accent: '#7e22ce' },
    cream: { id: 'cream', name: '护手霜', emoji: '🫧', width: 1, bg: '#e4f7f5', border: '#5ec7bd', accent: '#0f766e' },
    serum: { id: 'serum', name: '小棕精华', emoji: '🧪', width: 1, bg: '#fff1db', border: '#e6a34c', accent: '#b45309' },
    powder: { id: 'powder', name: '定妆粉饼', emoji: '🪞', width: 1, bg: '#ffeae1', border: '#eb9777', accent: '#c2410c' },
    brush: { id: 'brush', name: '蜜粉刷', emoji: '🖌️', width: 1, bg: '#e8efff', border: '#7b9df0', accent: '#1d4ed8' },
    mask_box: { id: 'mask_box', name: '礼盒面膜', emoji: '🎁', width: 2, bg: '#ffe5f0', border: '#ec6fa4', accent: '#9d174d' },
    toner_set: { id: 'toner_set', name: '水乳套盒', emoji: '🎀', width: 2, bg: '#f3e8ff', border: '#a86ee3', accent: '#6b21a8' },

    // 甜品烘焙坊
    dango: { id: 'dango', name: '草莓大福', emoji: '🍓', width: 1, bg: '#ffe6eb', border: '#f2849e', accent: '#be123c' },
    pudding: { id: 'pudding', name: '焦糖布丁', emoji: '🍮', width: 1, bg: '#fff3d6', border: '#ebb450', accent: '#b45309' },
    macaron: { id: 'macaron', name: '开心果马卡龙', emoji: '🧁', width: 1, bg: '#e8f8ec', border: '#74c686', accent: '#15803d' },
    croissant: { id: 'croissant', name: '黄油可颂', emoji: '🥐', width: 1, bg: '#ffedd5', border: '#e89d54', accent: '#9a3412' },
    swiss_roll: { id: 'swiss_roll', name: '抹茶瑞士卷', emoji: '🍰', width: 2, bg: '#e6f6e4', border: '#6ab861', accent: '#166534' },
    cake_box: { id: 'cake_box', name: '缤纷蛋糕盒', emoji: '🎂', width: 2, bg: '#ffe8f2', border: '#e577a6', accent: '#9d174d' },
  };

  // layers[0] is the interactive front row; layers[1..] are shadowed back rows that slide forward once front is cleared.
  const LEVELS = [
    {
      id: 1,
      title: '第 1 关 · 新手理货',
      theme: 'fridge',
      tip: '点击商品选中，再点空余货架移入；凑满 4 格同款自动打包！',
      isElite: false,
      parMoves: 10,
      shelves: [
        [['cola', 'cola', 'yogurt'], ['juice', 'cola']],
        [['yogurt', 'yogurt', 'juice'], ['cola', 'yogurt']],
        [['juice', 'juice']],
        [[]],
      ],
    },
    {
      id: 2,
      title: '第 2 关 · 异形大桶',
      theme: 'fridge',
      tip: '注意！大桶鲜奶占 2 格空间，需留出至少 2 格空位才能放进去。',
      isElite: false,
      parMoves: 15,
      shelves: [
        [['milk_big', 'cola'], ['milk_big', 'onigiri']],
        [['milk_big', 'yogurt'], ['yogurt', 'cola']],
        [['onigiri', 'onigiri', 'milk_big']],
        [['cola', 'cola', 'yogurt'], ['onigiri']],
        [['yogurt']],
      ],
    },
    {
      id: 3,
      title: '第 3 关 · 猫咖上新',
      theme: 'catcafe',
      tip: '先腾出 2 格空位搬运大袋猫粮，别把 1 格空位全堵死哦~',
      isElite: false,
      parMoves: 18,
      shelves: [
        [['cat_food_big', 'cat_strip', 'fish_can'], ['paw_cookie']],
        [['cat_food_big', 'paw_cookie'], ['fish_can', 'latte']],
        [['latte', 'cat_strip', 'cat_food_big']],
        [['fish_can', 'cat_food_big', 'paw_cookie']],
        [['cat_strip', 'latte', 'latte']],
        [['fish_can', 'paw_cookie', 'cat_strip']],
      ],
    },
    {
      id: 4,
      title: '第 4 关 · 滑道深架',
      theme: 'catcafe',
      tip: '注意「⏩滑道」货架！滑道内只能拿取最外侧（最右端）商品，中间商品无法直接抽出哦！',
      isElite: false,
      chuteShelves: [0, 1],
      parMoves: 21,
      shelves: [
        [['cat_food_big', 'cat_strip'], ['fish_can', 'paw_cookie'], ['litter_box']],
        [['litter_box', 'fish_can'], ['cat_food_big'], ['cat_strip', 'latte']],
        [['paw_cookie', 'latte', 'cat_food_big'], ['fish_can']],
        [['cat_strip', 'fish_can', 'paw_cookie'], ['latte']],
        [['latte', 'cat_food_big', 'paw_cookie'], ['litter_box']],
        [['cat_strip', 'litter_box']],
      ],
    },
    {
      id: 5,
      title: '第 5 关 · 专柜梳妆台',
      theme: 'vanity',
      tip: '新增「🏷️同款专柜」货架：专柜内严禁混放杂物，只能放入与柜内同款的商品（或空柜）！',
      isElite: false,
      strictShelves: [3, 4],
      parMoves: 21,
      shelves: [
        [['mask_box', 'lipstick'], ['perfume', 'cream'], ['serum', 'powder']],
        [['toner_set', 'perfume'], ['mask_box'], ['cream', 'lipstick']],
        [['serum', 'powder', 'mask_box'], ['lipstick', 'toner_set']],
        [['cream', 'serum', 'powder'], ['perfume']],
        [['lipstick', 'perfume', 'powder'], ['serum']],
        [['cream', 'mask_box']],
      ],
    },
    {
      id: 6,
      title: '第 6 关 · 精英大清点',
      theme: 'vanity',
      tip: '精英挑战关：⏩滑道单向取物 + 🏷️专柜禁混放同台考验，先清外侧再合并大件！',
      isElite: true,
      chuteShelves: [0, 1],
      strictShelves: [4, 6],
      parMoves: 24,
      shelves: [
        [['mask_box', 'lipstick', 'perfume'], ['cream', 'serum'], ['toner_set']],
        [['toner_set', 'powder'], ['mask_box'], ['lipstick', 'brush']],
        [['cream', 'serum', 'mask_box'], ['powder', 'perfume']],
        [['brush', 'lipstick', 'cream', 'perfume']],
        [['powder', 'mask_box'], ['brush']],
        [['serum', 'brush', 'powder', 'cream']],
        [['lipstick', 'perfume', 'serum']],
        [[]],
      ],
    },
    {
      id: 7,
      title: '第 7 关 · 烘焙早班',
      theme: 'bakery',
      tip: '甜品烘焙坊开启！注意前两排为⏩重力滑道架，只能从最右侧依次取货。',
      isElite: false,
      chuteShelves: [0, 1],
      parMoves: 18,
      shelves: [
        [['swiss_roll', 'dango', 'pudding'], ['macaron', 'croissant']],
        [['swiss_roll', 'macaron'], ['dango', 'pudding']],
        [['croissant', 'dango', 'swiss_roll'], ['macaron']],
        [['pudding', 'swiss_roll', 'croissant']],
        [['dango', 'macaron', 'croissant']],
        [['pudding']],
      ],
    },
    {
      id: 8,
      title: '第 8 关 · 盲盒冰柜',
      theme: 'fridge',
      tip: '进阶挑战：❓盲盒后排 + ⏩弹簧滑道 + 🏷️同款专柜，步步为营揭晓盲盒！',
      isElite: false,
      mysteryBack: true,
      chuteShelves: [0, 1],
      strictShelves: [3, 4],
      parMoves: 20,
      shelves: [
        [['milk_big', 'cola', 'yogurt'], ['juice', 'onigiri'], ['matcha', 'cola']],
        [['milk_big', 'juice'], ['yogurt', 'matcha'], ['onigiri']],
        [['onigiri', 'matcha', 'milk_big'], ['cola', 'juice']],
        [['yogurt', 'milk_big', 'cola'], ['matcha']],
        [['juice', 'onigiri', 'yogurt']],
        [[]],
      ],
    },
    {
      id: 9,
      title: '第 9 关 · 锁格猫咖',
      theme: 'catcafe',
      tip: '右下角货架被锁扣封住，上方还有⏩滑道与🏷️专柜限制，先凑满 1 箱破封！',
      isElite: false,
      lockedShelves: { 5: 1 },
      chuteShelves: [0, 2],
      strictShelves: [3],
      parMoves: 20,
      shelves: [
        [['cat_food_big', 'cat_strip'], ['fish_can', 'paw_cookie'], ['litter_box']],
        [['cat_food_big', 'fish_can'], ['cat_strip', 'latte']],
        [['paw_cookie', 'latte', 'cat_food_big'], ['fish_can']],
        [['cat_strip', 'cat_food_big'], ['paw_cookie', 'latte']],
        [['fish_can', 'paw_cookie', 'latte']],
        [['litter_box', 'cat_strip']],
      ],
    },
    {
      id: 10,
      title: '第 10 关 · 甜点双礼盒',
      theme: 'bakery',
      tip: '双大件齐上阵，配合⏩滑道取物与🏷️专柜对齐规则，切勿把大件堵在滑道底层！',
      isElite: false,
      mysteryBack: true,
      chuteShelves: [0, 1, 2],
      strictShelves: [4, 5],
      parMoves: 22,
      shelves: [
        [['swiss_roll', 'dango'], ['pudding', 'macaron'], ['cake_box']],
        [['cake_box', 'pudding'], ['swiss_roll'], ['dango', 'croissant']],
        [['macaron', 'croissant', 'swiss_roll'], ['pudding']],
        [['dango', 'cake_box', 'macaron'], ['croissant']],
        [['pudding', 'swiss_roll', 'dango'], ['cake_box']],
        [['croissant', 'macaron']],
        [[]],
      ],
    },
    {
      id: 11,
      title: '第 11 关 · 彩妆八架锁',
      theme: 'vanity',
      tip: '精英前哨战：8 货架阵列 + ⏩滑道 + 🏷️专柜 + 🔒2箱锁架四重机制合璧！',
      isElite: true,
      mysteryBack: true,
      lockedShelves: { 7: 2 },
      chuteShelves: [0, 1],
      strictShelves: [3, 4],
      parMoves: 24,
      shelves: [
        [['mask_box', 'lipstick'], ['perfume', 'cream'], ['toner_set']],
        [['mask_box', 'perfume'], ['lipstick', 'serum'], ['powder']],
        [['cream', 'serum', 'mask_box'], ['lipstick', 'powder']],
        [['powder', 'mask_box', 'cream'], ['perfume', 'brush']],
        [['lipstick', 'perfume', 'serum'], ['brush']],
        [['cream', 'powder', 'brush']],
        [[]],
        [['toner_set', 'serum', 'brush']],
      ],
    },
    {
      id: 12,
      title: '第 12 关 · 烘焙八架考核',
      theme: 'bakery',
      tip: '8 货架大考：⏩滑道 + 🏷️同款专柜 + 🔒锁架，先利用空余货架周转再破封！',
      isElite: true,
      mysteryBack: true,
      lockedShelves: { 7: 2 },
      chuteShelves: [0, 1, 2],
      strictShelves: [4, 5],
      parMoves: 25,
      shelves: [
        [['swiss_roll', 'dango'], ['pudding', 'macaron'], ['cake_box']],
        [['swiss_roll', 'pudding'], ['dango', 'croissant'], ['matcha']],
        [['macaron', 'swiss_roll', 'croissant'], ['pudding', 'matcha']],
        [['dango', 'cake_box', 'pudding'], ['macaron'], ['cake_box', 'matcha']],
        [['croissant', 'swiss_roll', 'matcha']],
        [['dango', 'macaron']],
        [[]],
        [['cake_box', 'croissant']],
      ],
    },
    {
      id: 13,
      title: '第 13 关 · 冰柜八架夜班',
      theme: 'fridge',
      tip: '8 货架满编冰柜：全系 6 款饮品齐聚，利用右侧空余货架解开⏩滑道大桶鲜奶！',
      isElite: false,
      mysteryBack: true,
      lockedShelves: { 7: 2 },
      chuteShelves: [0, 1, 2],
      strictShelves: [4, 5],
      parMoves: 26,
      shelves: [
        [['milk_big', 'cola', 'yogurt'], ['juice', 'onigiri']],
        [['milk_big', 'juice', 'matcha'], ['cola', 'yogurt']],
        [['onigiri', 'matcha', 'milk_big'], ['juice', 'cola']],
        [['yogurt', 'milk_big', 'onigiri'], ['matcha']],
        [['cola', 'yogurt', 'juice']],
        [['onigiri', 'matcha']],
        [[]],
        [[]],
      ],
    },
    {
      id: 14,
      title: '第 14 关 · 猫咖十架总仓',
      theme: 'catcafe',
      tip: '首次开启 10 货架超大容量！大袋猫粮与大箱猫砂双大件混排，注意🔒阶梯锁架节奏。',
      isElite: true,
      mysteryBack: true,
      lockedShelves: { 8: 2, 9: 3 },
      chuteShelves: [0, 1, 2, 3],
      strictShelves: [4, 5, 6],
      parMoves: 28,
      shelves: [
        [['cat_food_big', 'cat_strip'], ['fish_can', 'paw_cookie']],
        [['litter_box', 'fish_can'], ['cat_food_big', 'latte']],
        [['paw_cookie', 'latte', 'cat_food_big'], ['cat_strip']],
        [['cat_strip', 'litter_box', 'fish_can'], ['paw_cookie']],
        [['latte', 'cat_food_big', 'paw_cookie']],
        [['fish_can', 'litter_box']],
        [['cat_strip', 'latte']],
        [['litter_box']],
        [[]],
        [[]],
      ],
    },
    {
      id: 15,
      title: '第 15 关 · 美妆十架旗舰',
      theme: 'vanity',
      tip: '10 货架旗舰陈列柜：8 款彩妆护肤品全上阵，善用3连击「🧲狂热磁铁」一键吸箱破局！',
      isElite: true,
      mysteryBack: true,
      lockedShelves: { 9: 2 },
      chuteShelves: [0, 1, 2],
      strictShelves: [4, 5],
      parMoves: 30,
      shelves: [
        [['mask_box', 'lipstick'], ['perfume', 'cream'], ['serum']],
        [['toner_set', 'powder'], ['mask_box', 'lipstick'], ['brush']],
        [['cream', 'serum', 'mask_box'], ['perfume', 'powder']],
        [['brush', 'toner_set'], ['cream', 'serum', 'lipstick']],
        [['powder', 'mask_box'], ['brush', 'toner_set']],
        [['perfume', 'cream', 'serum']],
        [['lipstick', 'powder', 'brush']],
        [['toner_set', 'perfume']],
        [[]],
        [[]],
      ],
    },
    {
      id: 16,
      title: '第 16 关 · 传奇十架大满贯',
      theme: 'bakery',
      tip: '单机终极 10 货架大满贯：4 滑道 + 2 专柜 + 2 阶梯锁架，献给真正的收纳传奇店长！',
      isElite: true,
      mysteryBack: true,
      lockedShelves: { 8: 2, 9: 3 },
      chuteShelves: [0, 1, 2, 3],
      strictShelves: [4, 5],
      parMoves: 32,
      shelves: [
        [['swiss_roll', 'dango'], ['pudding', 'macaron'], ['croissant', 'cake_box']],
        [['cake_box', 'macaron'], ['matcha', 'swiss_roll'], ['dango', 'cola']],
        [['croissant', 'swiss_roll'], ['cola', 'pudding', 'matcha']],
        [['dango', 'cake_box'], ['pudding', 'macaron', 'croissant']],
        [['matcha', 'swiss_roll', 'cola'], ['dango']],
        [['pudding', 'macaron', 'croissant']],
        [['cake_box', 'matcha', 'cola']],
        [[]],
        [[]],
        [[]],
      ],
    },
  ];

  function createDailyLevel(dateStr) {
    const key = String(dateStr || new Date().toISOString().slice(0, 10));
    let seed = 2166136261;
    for (let i = 0; i < key.length; i += 1) {
      seed ^= key.charCodeAt(i);
      seed = Math.imul(seed, 16777619) >>> 0;
    }
    const rng = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const pickShuffle = (arr) => {
      const copy = arr.slice();
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = copy[i];
        copy[i] = copy[j];
        copy[j] = tmp;
      }
      return copy;
    };

    const themePools = [
      { theme: 'fridge', wide: 'milk_big', narrow: ['cola', 'yogurt', 'juice', 'onigiri', 'matcha'] },
      { theme: 'catcafe', wide: 'cat_food_big', narrow: ['cat_strip', 'fish_can', 'paw_cookie', 'latte', 'cola'] },
      { theme: 'vanity', wide: 'mask_box', narrow: ['lipstick', 'perfume', 'cream', 'serum', 'powder'] },
      { theme: 'bakery', wide: 'swiss_roll', narrow: ['dango', 'pudding', 'macaron', 'croissant', 'matcha'] },
    ];
    const pool = themePools[Math.floor(rng() * themePools.length)];
    const widePool = [pool.wide, pool.wide, pool.wide, pool.wide];
    const narrowPool = [];
    for (const id of pool.narrow) {
      narrowPool.push(id, id, id, id);
    }

    const ordered = [...pickShuffle(widePool), ...pickShuffle(narrowPool)];
    // 6 active layers on 6 shelves (front + back) + 1 empty 7th shelf
    const slots = Array.from({ length: 10 }, () => ({ items: [], used: 0 }));
    const slotOrder = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

    for (const itemId of ordered) {
      const w = ITEMS[itemId].width;
      const candidates = pickShuffle(slotOrder).filter((idx) => {
        const slot = slots[idx];
        const cap = idx < 6 ? 3 : 4; // Front rows leave at least 1 gap so opening is never deadlocked
        if (cap - slot.used < w) return false;
        const next = [...slot.items, itemId];
        const nextW = slot.used + w;
        if (nextW === SHELF_CAPACITY && next.every((x) => x === next[0])) return false;
        return true;
      });
      const chosen = candidates.length > 0
        ? candidates[0]
        : slotOrder.find((idx) => SHELF_CAPACITY - slots[idx].used >= w);
      slots[chosen].items.push(itemId);
      slots[chosen].used += w;
    }

    const shelves = [];
    for (let s = 0; s < 6; s += 1) {
      const layers = [slots[s].items];
      if (s < 4 && slots[s + 6].items.length > 0) {
        layers.push(slots[s + 6].items);
      }
      shelves.push(layers);
    }
    shelves.push([[]]);

    return {
      id: `daily-${key}`,
      isDaily: true,
      dateKey: key,
      title: `📅 每日挑战 · ${key.slice(5)}`,
      theme: pool.theme,
      tip: '每日盲盒挑战：全球同日同种子布局，融合⏩滑道与🏷️专柜机制，冲击今日纪录！',
      isElite: true,
      mysteryBack: true,
      chuteShelves: [0, 1],
      strictShelves: [3, 4],
      parMoves: 21,
      shelves,
    };
  }

  const api = { SHELF_CAPACITY, THEMES, ITEMS, LEVELS, createDailyLevel };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.ShelfLevels = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
