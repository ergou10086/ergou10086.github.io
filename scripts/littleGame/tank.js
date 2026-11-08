// Tank Trouble: lazy-loaded Canvas engine; no external runtime dependencies.
(function() {
  'use strict';

  if (window.LittleTankTrouble) return;

  // ---------------- 常量 ----------------
  var CFG = {
    cols: 28,             // 地图 28 x 20 格
    rows: 20,
    tile: 32,
    cellCols: 13,         // 迷宫单元 13 x 9（每单元间隔 1 格墙）
    cellRows: 9,
    mapCount: 30,         // 大/中/小各 10 张，按需生成
    targetScore: 8
  };
  var W = CFG.cols * CFG.tile;      // 896
  var H = CFG.rows * CFG.tile;      // 640
  var TILE = CFG.tile;

  var TANK_RADIUS = 8.5;
  var PLAYER_SPEED = 138;
  var AI_SPEED = 112;
  var BULLET_SPEED = 430;
  var BULLET_RADIUS = 3;
  var RAPID_SPEED = 500;
  var RAPID_RADIUS = 2.1;
  var FIRE_INTERVAL = 0.5;
  var RAPID_INTERVAL = 0.13;
  var BULLET_LIFE = 7;
  var RAPID_LIFE = 4.5;
  var LASER_MAX_BOUNCE = 2;
  var POWERUP_TYPES = ['laser', 'double', 'shotgun', 'homing', 'mine', 'shield', 'rapid', 'frag', 'deathray', 'rc'];
  var POWER = {
    laser: ['L', '激光', '#e91e63'], double: ['D', '双管炮', '#3f8efc'],
    shotgun: ['S', '霰弹枪', '#ef8c00'], homing: ['H', '追踪导弹', '#ec5252'],
    mine: ['M', '地雷', '#c49000'], shield: ['B', '护盾', '#39a5db'],
    rapid: ['G', '加特林', '#26a69a'], frag: ['F', '碎片炸弹', '#a45ac7'],
    deathray: ['R', '死亡射线', '#cf316b'], rc: ['C', '遥控导弹', '#7373e1']
  };
  // Decision rates and search budgets differ; all tiers use the same projectile physics.
  var PROFILES = {
    normal: { think: 0.27, steer: 0.12, error: 0.075, fire: 1.15, horizon: 0.6, directions: 8, banks: 12, bounces: 1, lead: 0.8 },
    original: { think: 0.14, steer: 0.075, error: 0.025, fire: 0.62, horizon: 1.0, directions: 16, banks: 32, bounces: 2, lead: 1 },
    nightmare: { think: 0.085, steer: 0.05, error: 0.003, fire: 0.5, horizon: 1.5, directions: 24, banks: 64, bounces: 3, lead: 1 }
  };
  var settings = { difficulty: 'normal', aiCount: 2, allies: [], friendlyFire: true, targetScore: 8, roundTime: 120 };
  var settingsOpen = false;
  var scoreNodes = {};
  var AI_COLORS = ['#ef5350', '#ef8c00', '#a26bea', '#26a69a', '#d45f9c'];
  var forecast = [];
  var forecastTimer = 0;
  var roundElapsed = 0;
  var clockKey = '';
  var cachedTanks = [];

  function normalizeSettings(value) {
    value = value || {};
    var count = clamp(Math.round(Number(value.aiCount) || 2), 1, 5);
    var allies = Array.isArray(value.allies) ? value.allies : [];
    return {
      difficulty: PROFILES[value.difficulty] ? value.difficulty : 'normal',
      aiCount: count,
      allies: allies.filter(function(n, i) { return Number.isInteger(n) && n >= 1 && n <= count && allies.indexOf(n) === i; }).slice(0, Math.min(2, count - 1)),
      friendlyFire: value.friendlyFire !== false,
      targetScore: clamp(Math.round(Number(value.targetScore) || 8), 5, 20),
      roundTime: clamp(Math.round(Number(value.roundTime) || 120), 30, 300)
    };
  }

  function teamOf(tank) { return tank ? tank.team : null; }
  function canDamage(owner, tank) { return settings.friendlyFire || !owner || owner.team !== tank.team; }
  function enemies(a, b) { return a && b && a.team !== b.team; }
  function profile(tank) { return PROFILES[tank.ai && tank.ai.level || settings.difficulty]; }
  function tankColor(tank) { return tank.key === 'player' ? '#49b1f5' : tank.team === 'player' ? '#36b8cb' : AI_COLORS[Number(tank.key.slice(2)) - 1]; }

  function configure(value, save) {
    settings = normalizeSettings(value);
    CFG.targetScore = settings.targetScore;
    if (save) { try { localStorage.setItem('littleTank.settings.v2', JSON.stringify(settings)); } catch (_) {} }
    return settings;
  }

  var MAX_BULLETS = 180;

  var PALETTES = {
    light: {
      floor: '#f4f7fc',
      floorAlt: '#edf2f9',
      wall: '#c2cfdf',
      wallTop: '#d9e3ee',
      wallEdge: '#a9b9cc',
      player: '#49b1f5',
      playerDark: '#2f8fd0',
      ai1: '#ef5350',
      ai1Dark: '#c62828',
      ai2: '#ffb74d',
      ai2Dark: '#ef8c00',
      bullet: '#37474f',
      mine: '#37474f',
      text: '#37474f',
      laser: '#e91e63',
      pad: 'rgba(73,177,245,0.14)',
      danger: '#ef5350',
      rapid: '#26a69a',
      powerBg: '#ffffff'
    },
    dark: {
      floor: '#1a1f2b',
      floorAlt: '#171c26',
      wall: '#39445c',
      wallTop: '#4d5b76',
      wallEdge: '#2a3245',
      player: '#49b1f5',
      playerDark: '#2f8fd0',
      ai1: '#ef5350',
      ai1Dark: '#b71c1c',
      ai2: '#ffb74d',
      ai2Dark: '#ef8c00',
      bullet: '#e3e8f7',
      mine: '#cfd8dc',
      text: '#dbe4f0',
      laser: '#ff4081',
      pad: 'rgba(73,177,245,0.12)',
      danger: '#ef5350',
      rapid: '#4dd0e1',
      powerBg: '#222a3a'
    }
  };

  // ---------------- DOM / 运行状态 ----------------
  var panel = null;
  var canvas = null;
  var ctx = null;
  var stageEl = null;
  var overlayEl = null;
  var overlayTitle = null;
  var overlayDesc = null;
  var startBtn = null;
  var hudEls = null;
  var touchEls = null;
  var joystickEl = null;
  var initialized = false;
  var resizeObserver = null;
  var themeObserver = null;

  var State = {
    active: false,
    running: false,
    ready: false,
    state: 'idle',          // idle | countdown | playing | roundEnd | matchEnd
    round: 1,
    time: 0,
    scores: { player: 0, ai1: 0, ai2: 0 },
    map: null,
    mapIndex: -1,
    lastMapIndex: -1,
    player: null,
    ais: [],
    bullets: [],
    mines: [],
    powerups: [],
    particles: [],
    lasers: [],
    input: { up: false, down: false, left: false, right: false, firing: false },
    aim: { x: W / 2, y: H / 2, has: false, touch: false },
    roundTimer: 0,
    freezeTimer: 0,
    powerSpawnTimer: 3,
    killInfo: null,
    matchWinner: null,
    message: null,
    messageTimer: 0,
    hudTimer: 0,
    scaleX: 1,
    scaleY: 1,
    dpr: 1,
    raf: 0,
    lastTime: 0,
    frames: 0,
    stats: {
      playerShots: 0,
      aiShots: 0,
      playerLaserShots: 0,
      aiLaserShots: 0,
      aiDecisions: 0,
      powerupsSpawned: 0,
      powerupsPicked: 0,
      mineExplosions: 0,
      minesPlaced: 0,
      rounds: 0
    }
  };

  var mapPool = null;
  var mapCanvas = null;
  var bakedDpr = 0;
  var bakedPaletteDark = null;
  var gameTime = 0;

  // ---------------- 工具 ----------------
  function rand() {
    return Math.random();
  }

  function randRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
  }

  function dist2(ax, ay, bx, by) {
    var dx = ax - bx;
    var dy = ay - by;
    return dx * dx + dy * dy;
  }

  function dist(ax, ay, bx, by) {
    return Math.sqrt(dist2(ax, ay, bx, by));
  }

  function angleDelta(a, b) {
    var d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function angleLerp(a, b, t) {
    return a + angleDelta(a, b) * Math.min(1, Math.max(0, t));
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function isDarkTheme() {
    var attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'dark') return true;
    if (attr === 'light') return false;
    if (document.body && document.body.getAttribute('data-theme') === 'dark') return true;
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function palette() {
    return isDarkTheme() ? PALETTES.dark : PALETTES.light;
  }

  function canRun() {
    return initialized && State.active && !document.hidden && !settingsOpen;
  }

  // ---------------- 地图 ----------------
  function createMaze(seed, spec) {
    spec = spec || { cols: 28, rows: 20, tile: 32, label: '大' };
    var rnd = mulberry32(seed * 1103515245 + 12345);
    var cols = spec.cols, rows = spec.rows, tile = spec.tile;
    var cw = Math.floor((cols - 1) / 2), ch = Math.floor((rows - 1) / 2);
    var walls = new Uint8Array(cols * rows); walls.fill(1);
    function carve(x, y) { if (x > 0 && y > 0 && x < cols - 1 && y < rows - 1) walls[y * cols + x] = 0; }
    var visited = new Uint8Array(cw * ch), stack = [[0, 0]];
    var dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    visited[0] = 1; carve(1, 1);
    while (stack.length) {
      var cur = stack[stack.length - 1], candidates = [];
      for (var i = 0; i < 4; i++) {
        var nx = cur[0] + dirs[i][0], ny = cur[1] + dirs[i][1];
        if (nx >= 0 && ny >= 0 && nx < cw && ny < ch && !visited[ny * cw + nx]) candidates.push([nx, ny]);
      }
      if (!candidates.length) { stack.pop(); continue; }
      var next = candidates[Math.floor(rnd() * candidates.length)];
      visited[next[1] * cw + next[0]] = 1;
      carve(cur[0] * 2 + 1 + next[0] - cur[0], cur[1] * 2 + 1 + next[1] - cur[1]);
      carve(next[0] * 2 + 1, next[1] * 2 + 1); stack.push(next);
    }
    // The ten large maps retain the original generator/seeds (including seed 1).
    var loops = spec.label === '大' ? 10 + Math.floor(rnd() * 9) : Math.max(4, Math.floor(cw * ch * 0.14));
    for (i = 0; i < loops; i++) {
      var wx = 1 + Math.floor(rnd() * (cols - 2)), wy = 1 + Math.floor(rnd() * (rows - 2));
      if ((!walls[wy * cols + wx - 1] && !walls[wy * cols + wx + 1]) || (!walls[(wy - 1) * cols + wx] && !walls[(wy + 1) * cols + wx])) carve(wx, wy);
    }
    var plazas = 1 + Math.floor(rnd() * 2);
    for (i = 0; i < plazas; i++) {
      var px = 2 + Math.floor(rnd() * (cols - 6)), py = 2 + Math.floor(rnd() * (rows - 6));
      for (var oy = 0; oy < 3; oy++) for (var ox = 0; ox < 3; ox++) carve(px + ox, py + oy);
    }
    var map = { walls: walls, cols: cols, rows: rows, tile: tile, label: spec.label, seed: seed, spawns: [], fields: new Map(), reachable: [] };
    // Flood-fill the actual tile graph. Discard any isolated plaza tiles.
    var queue = [cols + 1], seen = new Uint8Array(walls.length); seen[cols + 1] = 1;
    for (var head = 0; head < queue.length; head++) {
      var k = queue[head]; map.reachable.push(k);
      var adjacent = [k - cols, k + cols, k - 1, k + 1];
      for (i = 0; i < 4; i++) {
        var n = adjacent[i];
        if (n >= 0 && n < walls.length && !walls[n] && !seen[n]) { seen[n] = 1; queue.push(n); }
      }
    }
    for (i = 0; i < walls.length; i++) if (!seen[i]) walls[i] = 1;
    map.surfaces = [];
    for (var y = 1; y < rows - 1; y++) for (var x = 1; x < cols - 1; x++) {
      if (walls[y * cols + x]) continue;
      if (walls[y * cols + x - 1]) map.surfaces.push({ axis: 'x', at: x * tile + BULLET_RADIUS });
      if (walls[y * cols + x + 1]) map.surfaces.push({ axis: 'x', at: (x + 1) * tile - BULLET_RADIUS });
      if (walls[(y - 1) * cols + x]) map.surfaces.push({ axis: 'y', at: y * tile + BULLET_RADIUS });
      if (walls[(y + 1) * cols + x]) map.surfaces.push({ axis: 'y', at: (y + 1) * tile - BULLET_RADIUS });
    }
    map.surfaces = map.surfaces.filter(function(v, index, all) { return all.findIndex(function(a) { return a.axis === v.axis && a.at === v.at; }) === index; });
    return map;
  }





  function buildMapPool() {
    var specs = [
      { cols: 28, rows: 20, tile: 32, label: '大' },
      { cols: 21, rows: 15, tile: W / 21, label: '中' },
      { cols: 14, rows: 10, tile: 64, label: '小' }
    ];
    var pool = [];
    specs.forEach(function(spec, tier) {
      for (var i = 0; i < 10; i++) pool.push({ spec: spec, seed: tier * 100 + i + 1, map: null });
    });
    return pool;
  }

  function loadMap(index) {
    var entry = mapPool[index];
    if (!entry.map) entry.map = createMaze(entry.seed, entry.spec);
    return entry.map;
  }

  function useMap(map) {
    State.map = map; TILE = map.tile;
    CFG.cols = map.cols; CFG.rows = map.rows;
    CFG.cellCols = Math.floor((map.cols - 1) / 2); CFG.cellRows = Math.floor((map.rows - 1) / 2);
  }

  function tileCenter(map, k) { return { x: (k % map.cols + 0.5) * map.tile, y: (Math.floor(k / map.cols) + 0.5) * map.tile }; }

  function allocateSpawns(map, count) {
    var selected = [];
    for (var i = 0; i < count; i++) {
      var best = null, bestScore = -1;
      // Soft spread, not fixed corners: some rolls accept nearby (non-overlapping) starts.
      var spread = rand() > 0.18;
      for (var n = 0; n < 32; n++) {
        var p = tileCenter(map, map.reachable[Math.floor(rand() * map.reachable.length)]);
        var jitter = Math.max(0, map.tile / 2 - TANK_RADIUS - 2);
        p.x += randRange(-jitter, jitter); p.y += randRange(-jitter, jitter);
        var nearest = W;
        selected.forEach(function(q) { nearest = Math.min(nearest, dist(p.x, p.y, q.x, q.y)); });
        if (nearest < TANK_RADIUS * 3 || !spotIsFree(map, p.x, p.y, TANK_RADIUS)) continue;
        var score = spread ? Math.min(nearest, W * 0.34) * randRange(0.55, 1.4) : rand() * W;
        if (score > bestScore) { best = p; bestScore = score; }
      }
      if (!best) {
        for (n = 0; n < map.reachable.length; n++) {
          var fallback = tileCenter(map, map.reachable[n]);
          if (selected.every(function(q) { return dist(q.x, q.y, fallback.x, fallback.y) > TANK_RADIUS * 3; })) { best = fallback; break; }
        }
      }
      selected.push(best);
    }
    return selected;
  }

  function tileIsWall(map, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= map.cols || ty >= map.rows) return true;
    return map.walls[ty * map.cols + tx] === 1;
  }

  // 圆与墙格 AABB 的碰撞检测
  function circleHitsWall(map, x, y, r) {
    var tile = map.tile;
    var minTx = Math.floor((x - r) / tile);
    var maxTx = Math.floor((x + r) / tile);
    var minTy = Math.floor((y - r) / tile);
    var maxTy = Math.floor((y + r) / tile);
    for (var ty = minTy; ty <= maxTy; ty++) {
      for (var tx = minTx; tx <= maxTx; tx++) {
        if (!tileIsWall(map, tx, ty)) continue;
        var left = tx * tile;
        var top = ty * tile;
        var cx = clamp(x, left, left + tile);
        var cy = clamp(y, top, top + tile);
        if (dist2(x, y, cx, cy) < r * r) return true;
      }
    }
    return false;
  }

  function spotIsFree(map, x, y, r) {
    if (x < r || y < r || x > W - r || y > H - r) return false;
    return !circleHitsWall(map, x, y, r);
  }

  function hasLineOfSight(map, ax, ay, bx, by) {
    var d = dist(ax, ay, bx, by);
    if (d < 1) return true;
    var steps = Math.ceil(d / 5);
    for (var i = 1; i < steps; i++) {
      var t = i / steps;
      var x = ax + (bx - ax) * t;
      var y = ay + (by - ay) * t;
      if (circleHitsWall(map, x, y, 1.5)) return false;
    }
    return true;
  }

  // 射线追踪（激光 / AI 反弹射击预判），返回折线与命中的坦克
  function traceRay(map, sx, sy, angle, maxBounces, maxDist, owner, hitRadius, prediction) {
    var dx = Math.cos(angle), dy = Math.sin(angle), x = sx, y = sy, travelled = 0, bounces = 0;
    if (owner && dist2(x, y, owner.x, owner.y) < owner.r * owner.r) { x += dx * (owner.r + 4); y += dy * (owner.r + 4); }
    var points = [{ x: x, y: y }], hitTank = null;
    for (var bounce = 0; bounce <= maxBounces && travelled < maxDist; bounce++) {
      var wall = castWall(map, x, y, dx, dy, maxDist - travelled, BULLET_RADIUS);
      var length = wall.distance, nearest = length;
      for (var i = 0; i < cachedTanks.length; i++) {
        var tank = cachedTanks[i]; if (!tank.alive || !canDamage(owner, tank)) continue;
        var tx = tank.x, ty = tank.y;
        if (prediction && tank !== owner) {
          var time = Math.min((travelled + dist(x, y, tx, ty)) / BULLET_SPEED, 1.5);
          var target = predictTarget(tank, time); tx = target.x; ty = target.y;
        }
        var rx = x - tx, ry = y - ty, dot = rx * dx + ry * dy;
        var radius = tank.r + hitRadius, disc = dot * dot - (rx * rx + ry * ry - radius * radius);
        if (disc < 0) continue;
        var distance = -dot - Math.sqrt(disc);
        if (distance < 0 && rx * rx + ry * ry < radius * radius) distance = 0;
        if (distance >= 0 && distance <= nearest) { nearest = distance; hitTank = tank; }
      }
      x += dx * nearest; y += dy * nearest; travelled += nearest;
      points.push({ x: x, y: y });
      if (hitTank || !wall.hit) break;
      bounces++;
      if (bounce === maxBounces) break;
      if (wall.flipX) dx = -dx; if (wall.flipY) dy = -dy;
      x += dx * 0.02; y += dy * 0.02;
    }
    return { points: points, hitTank: hitTank, bounces: bounces, distance: travelled, end: { x: x, y: y } };
  }

  // Grid DDA visits crossed cells instead of taking hundreds of 4px ray steps.
  // Nearby wall boxes are expanded by projectile radius, with exact circular corners.
  function shotIsSafe(tank, angle) {
    if (tank.weapon === 'deathray' || tank.weapon === 'laser' || tank.weapon === 'rc' || tank.weapon === 'homing' || tank.weapon === 'frag') return true;
    var angles = tank.weapon === 'shotgun' ? [angle - 0.24, angle, angle + 0.24] : [angle];
    var speed = tank.weapon === 'rapid' ? RAPID_SPEED : tank.weapon === 'shotgun' ? 580 : BULLET_SPEED;
    var friends = cachedTanks.filter(function(t) { return t.alive && t.team === tank.team; });
    for (var a = 0; a < angles.length; a++) {
      var dx = Math.cos(angles[a]), dy = Math.sin(angles[a]), x = tank.x + dx * (tank.r + 5), y = tank.y + dy * (tank.r + 5);
      if (circleHitsWall(State.map, x, y, BULLET_RADIUS)) return false;
      for (var time = 0.025; time <= (tank.weapon === 'shotgun' ? 0.65 : 2.2); time += 0.025) {
        var distance = speed * 0.025;
        while (distance > 0) {
          var step = Math.min(4, distance); distance -= step;
          var nx = x + dx * step, ny = y + dy * step;
          if (circleHitsWall(State.map, nx, ny, BULLET_RADIUS)) {
            var hitX = circleHitsWall(State.map, nx, y, BULLET_RADIUS), hitY = circleHitsWall(State.map, x, ny, BULLET_RADIUS);
            if (hitX || !hitY) dx = -dx; if (hitY || !hitX) dy = -dy;
          } else { x = nx; y = ny; }
        }
        for (var i = 0; i < friends.length; i++) {
          var future = predictTarget(friends[i], time);
          if (dist2(x, y, future.x, future.y) < (friends[i].r + 5) * (friends[i].r + 5)) return false;
        }
      }
    }
    return true;
  }

  function castWall(map, x, y, dx, dy, maxDist, radius) {
    var tile = map.tile, tx = Math.floor(x / tile), ty = Math.floor(y / tile);
    var sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1;
    var deltaX = Math.abs(dx) < 1e-9 ? Infinity : tile / Math.abs(dx), deltaY = Math.abs(dy) < 1e-9 ? Infinity : tile / Math.abs(dy);
    var nextX = Math.abs(dx) < 1e-9 ? Infinity : ((dx > 0 ? tx + 1 : tx) * tile - x) / dx;
    var nextY = Math.abs(dy) < 1e-9 ? Infinity : ((dy > 0 ? ty + 1 : ty) * tile - y) / dy;
    var best = maxDist, flipX = false, flipY = false, hit = false;
    for (var guard = 0; guard < map.cols + map.rows + 4; guard++) {
      for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) {
        var wx = tx + ox, wy = ty + oy;
        if (!tileIsWall(map, wx, wy)) continue;
        var left = wx * tile, top = wy * tile, right = left + tile, bottom = top + tile;
        var ax = Math.abs(dx) < 1e-9 ? -Infinity : (left - radius - x) / dx;
        var bx = Math.abs(dx) < 1e-9 ? Infinity : (right + radius - x) / dx;
        var ay = Math.abs(dy) < 1e-9 ? -Infinity : (top - radius - y) / dy;
        var by = Math.abs(dy) < 1e-9 ? Infinity : (bottom + radius - y) / dy;
        if (Math.abs(dx) < 1e-9 && (x < left - radius || x > right + radius)) continue;
        if (Math.abs(dy) < 1e-9 && (y < top - radius || y > bottom + radius)) continue;
        var near = Math.max(Math.min(ax, bx), Math.min(ay, by)), far = Math.min(Math.max(ax, bx), Math.max(ay, by));
        if (near > far || far < 0 || near > best) continue;
        near = Math.max(near, 0);
        var px = x + dx * near, py = y + dy * near;
        var nx = px < left ? -1 : px > right ? 1 : 0, ny = py < top ? -1 : py > bottom ? 1 : 0;
        if (nx && ny) {
          var cx = nx < 0 ? left : right, cy = ny < 0 ? top : bottom;
          var rx = x - cx, ry = y - cy, dot = rx * dx + ry * dy;
          var disc = dot * dot - (rx * rx + ry * ry - radius * radius);
          if (disc < 0) continue;
          near = -dot - Math.sqrt(disc);
          if (near < -0.001 || near > best) continue;
        }
        if (near < best - 0.001) { best = near; flipX = !!nx; flipY = !!ny; hit = true; }
        else if (hit && Math.abs(near - best) < 0.001) { flipX = flipX || !!nx; flipY = flipY || !!ny; }
      }
      var boundary = Math.min(nextX, nextY);
      if (best <= boundary || boundary > maxDist) break;
      if (nextX < nextY) { tx += sx; nextX += deltaX; } else { ty += sy; nextY += deltaY; }
    }
    return { distance: best, hit: hit, flipX: flipX, flipY: flipY };
  }

  // ---------------- 坦克 ----------------
  function createTank(key, name, colorKey, x, y, angle) {
    var tank = {
      key: key,
      name: name,
      colorKey: colorKey,
      team: key === 'player' || settings.allies.indexOf(Number(key.slice(2))) >= 0 ? 'player' : key,
      weapon: null, ammo: 0, shieldUntil: 0, remote: null, frag: null,
      x: x,
      y: y,
      r: TANK_RADIUS,
      body: angle || 0,
      turret: angle || 0,
      vx: 0,
      vy: 0,
      alive: true,
      moving: false,
      speed: key === 'player' ? PLAYER_SPEED : AI_SPEED,
      fireCd: 0,
      rapidUntil: 0,
      laserCharges: 0,
      mines: 0,
      ai: null
    };
    if (key !== 'player') {
      tank.ai = {
        level: settings.difficulty,
        steerTimer: randRange(0, 0.05), moveX: 0, moveY: 0,
        think: randRange(0.02, 0.2),
        path: [],
        pathTimer: 0,
        targetKey: null,
        targetTank: null,
        targetTimer: 0,
        aimError: 0,
        dodgeTimer: 0,
        dodgeCd: 0,
        dodgeDir: { x: 0, y: 0 },
        mineCd: 1.5,
        bankCd: 0.5,
        blindCd: 1.2,
        pauseTimer: 0,
        stuckTimer: 0,
        lastX: x,
        lastY: y
      };
      tank.speed = AI_SPEED;
    }
    return tank;
  }

  function tanksList() { return cachedTanks; }

  function livingEnemies(tank) {
    var result = [];
    var list = tanksList();
    for (var i = 0; i < list.length; i++) {
      if (list[i] && enemies(tank, list[i]) && list[i].alive) result.push(list[i]);
    }
    return result;
  }

  function pickNearestEnemy(tank) {
    var list = livingEnemies(tank);
    var best = null;
    var bestD = Infinity;
    for (var i = 0; i < list.length; i++) {
      var d = dist2(tank.x, tank.y, list[i].x, list[i].y);
      if (d < bestD) {
        bestD = d;
        best = list[i];
      }
    }
    return best;
  }

  function moveTank(tank, dirX, dirY, speed, dt) {
    var length = Math.hypot(dirX, dirY), oldX = tank.x, oldY = tank.y;
    if (length > 0.001) {
      dirX /= length; dirY /= length;
      if (!circleHitsWall(State.map, tank.x + dirX * speed * dt, tank.y, tank.r)) tank.x += dirX * speed * dt;
      if (!circleHitsWall(State.map, tank.x, tank.y + dirY * speed * dt, tank.r)) tank.y += dirY * speed * dt;
    }
    tank.vx = dt ? (tank.x - oldX) / dt : 0; tank.vy = dt ? (tank.y - oldY) / dt : 0;
    tank.moving = Math.hypot(tank.vx, tank.vy) > 0.1;
    if (tank.moving) tank.body = angleLerp(tank.body, Math.atan2(tank.vy, tank.vx), 14 * dt);
  }

  function separateTanks() {
    var list = tanksList();
    for (var i = 0; i < list.length; i++) {
      for (var j = i + 1; j < list.length; j++) {
        var a = list[i];
        var b = list[j];
        if (!a || !b || !a.alive || !b.alive) continue;
        var d = dist(a.x, a.y, b.x, b.y);
        var min = a.r + b.r;
        if (d > 0.0001 && d < min) {
          var push = (min - d) / 2;
          var nx = (b.x - a.x) / d;
          var ny = (b.y - a.y) / d;
          if (!circleHitsWall(State.map, a.x - nx * push, a.y - ny * push, a.r)) {
            a.x -= nx * push;
            a.y -= ny * push;
          }
          if (!circleHitsWall(State.map, b.x + nx * push, b.y + ny * push, b.r)) {
            b.x += nx * push;
            b.y += ny * push;
          }
        }
      }
    }
  }

  // ---------------- 子弹 ----------------
  function spawnBullet(tank, angle, rapid, kind, lateral) {
    if (!tank.alive || State.bullets.length >= MAX_BULLETS) return null;
    kind = kind || (rapid ? 'rapid' : 'normal');
    var speed = rapid ? RAPID_SPEED : BULLET_SPEED, radius = rapid ? RAPID_RADIUS : BULLET_RADIUS, life = rapid ? RAPID_LIFE : BULLET_LIFE;
    if (kind === 'homing' || kind === 'rc') { speed = 225; radius = 4; life = 9; }
    if (kind === 'frag') { speed = 240; radius = 5; life = 3; }
    if (kind === 'shard') { speed = 470; radius = 2; life = 1.1; }
    if (kind === 'shotgun') { speed = 580; radius = 1.9; life = 0.65; }
    if (kind === 'double') { speed = 460; life = 2.3; }
    var bx = tank.x + Math.cos(angle) * (tank.r + radius + 2) - Math.sin(angle) * (lateral || 0);
    var by = tank.y + Math.sin(angle) * (tank.r + radius + 2) + Math.cos(angle) * (lateral || 0);
    if (circleHitsWall(State.map, bx, by, radius)) return null;
    var bullet = { x: bx, y: by, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: radius, owner: tank, life: life, age: 0, bounces: 0, rapid: !!rapid, kind: kind };
    State.bullets.push(bullet);
    if (tank === State.player) State.stats.playerShots++; else State.stats.aiShots++;
    return bullet;
  }

  function releaseProjectile(b) {
    if (b.owner.remote === b) b.owner.remote = null;
    if (b.owner.frag === b) b.owner.frag = null;
  }

  function explodeProjectile(b) {
    releaseProjectile(b);
    if (b.kind === 'frag') {
      // Real fragments travel through corridors and bounce; walls block the blast.
      for (var i = 0; i < 24 && State.bullets.length < MAX_BULLETS; i++) {
        var a = i * Math.PI * 2 / 24;
        State.bullets.push({ x: b.x, y: b.y, vx: Math.cos(a) * 470, vy: Math.sin(a) * 470, r: 2, owner: b.owner, life: 1.1, age: 0, bounces: 0, kind: 'shard' });
      }
    } else {
      cachedTanks.forEach(function(tank) {
        if (tank.alive && canDamage(b.owner, tank) && dist(tank.x, tank.y, b.x, b.y) < 34 && hasLineOfSight(State.map, b.x, b.y, tank.x, tank.y)) killTank(tank, b.owner);
      });
    }
    for (var p = 0; p < 12; p++) spawnParticle(b.x, b.y, '#ffb74d', 100, 100, 0.4);
  }

  function steerMissile(b, dt) {
    if (b.kind !== 'rc' && (b.kind !== 'homing' || b.age < 2)) return;
    var target = null, nearest = Infinity, angle = Math.atan2(b.vy, b.vx);
    if (b.kind === 'rc' && b.owner.alive) {
      if (b.owner === State.player && State.aim.touch) {
        var dx = Number(State.input.right) - Number(State.input.left), dy = Number(State.input.down) - Number(State.input.up);
        if (dx || dy) angle = Math.atan2(dy, dx);
      } else angle = b.owner.turret;
    } else {
      cachedTanks.forEach(function(tank) {
        if (!tank.alive || !canDamage(b.owner, tank)) return;
        var d = dist2(tank.x, tank.y, b.x, b.y);
        if (d < nearest) { nearest = d; target = tank; }
      });
      if (target) {
        var point = target;
        if (!hasLineOfSight(State.map, b.x, b.y, target.x, target.y)) {
          var path = findPath(State.map, b.x, b.y, target.x, target.y);
          if (path.length) point = path[0];
        }
        angle = Math.atan2(point.y - b.y, point.x - b.x);
      }
    }
    var current = Math.atan2(b.vy, b.vx), turn = clamp(angleDelta(current, angle), -3.8 * dt, 3.8 * dt);
    b.vx = Math.cos(current + turn) * 225; b.vy = Math.sin(current + turn) * 225;
  }

  function updateBullets(dt) {
    var bullets = State.bullets;
    for (var i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i]; b.life -= dt; b.age += dt;
      if (b.life <= 0) {
        bullets.splice(i, 1);
        if (b.kind === 'frag') explodeProjectile(b); else releaseProjectile(b);
        continue;
      }
      steerMissile(b, dt);
      var speed = Math.hypot(b.vx, b.vy) || 1, dx = b.vx / speed, dy = b.vy / speed, remaining = speed * dt, dead = false;
      while (remaining > 0 && !dead) {
        var step = Math.min(4, remaining); remaining -= step;
        var nx = b.x + dx * step, ny = b.y + dy * step;
        if (circleHitsWall(State.map, nx, ny, b.r)) {
          if (b.kind === 'rc' || b.kind === 'homing') { dead = true; break; }
          var hitX = circleHitsWall(State.map, nx, b.y, b.r), hitY = circleHitsWall(State.map, b.x, ny, b.r);
          if (hitX || !hitY) dx = -dx;
          if (hitY || !hitX) dy = -dy;
          b.vx = dx * speed; b.vy = dy * speed; b.bounces++;
          continue;
        }
        b.x = nx; b.y = ny;
        for (var t = 0; t < cachedTanks.length; t++) {
          var tank = cachedTanks[t];
          if (!tank.alive || !canDamage(b.owner, tank)) continue;
          var shield = tank.shieldUntil > gameTime, rr = tank.r + b.r + (shield ? 8 : 0);
          if (dist2(b.x, b.y, tank.x, tank.y) >= rr * rr) continue;
          if (shield) {
            var normalX = (b.x - tank.x) / rr, normalY = (b.y - tank.y) / rr, dot = dx * normalX + dy * normalY;
            if (dot >= 0) continue;
            var length = Math.hypot(normalX, normalY) || 1; normalX /= length; normalY /= length;
            dot = dx * normalX + dy * normalY;
            dx -= 2 * dot * normalX; dy -= 2 * dot * normalY;
            b.vx = dx * speed; b.vy = dy * speed; b.bounces++;
            b.x = tank.x + normalX * (rr + 0.2); b.y = tank.y + normalY * (rr + 0.2);
            break;
          }
          killTank(tank, b.owner); dead = true; break;
        }
      }
      if (dead) {
        bullets.splice(i, 1);
        if (b.kind === 'frag' || b.kind === 'rc' || b.kind === 'homing') explodeProjectile(b); else releaseProjectile(b);
      }
    }
  }

  // ---------------- 激光 ----------------
  function fireLaser(tank, angle, deathray) {
    if (tank === State.player) State.stats.playerLaserShots++; else State.stats.aiLaserShots++;
    var trace;
    if (deathray) {
      var dx = Math.cos(angle), dy = Math.sin(angle), x = tank.x, y = tank.y;
      var points = [{ x: x, y: y }];
      // Pierce internal walls only. Explicitly stop at the outer maze border.
      for (var d = tank.r + 5; d < W + H; d += 3) {
        x = tank.x + dx * d; y = tank.y + dy * d;
        if (x <= TILE || y <= TILE || x >= (State.map.cols - 1) * TILE || y >= (State.map.rows - 1) * TILE) break;
        cachedTanks.forEach(function(other) {
          if (other.alive && canDamage(tank, other) && dist2(x, y, other.x, other.y) < (other.r + 4) * (other.r + 4)) killTank(other, tank);
        });
      }
      points.push({ x: x, y: y }); trace = { points: points };
    } else {
      trace = traceRay(State.map, tank.x, tank.y, angle, LASER_MAX_BOUNCE, 1500, tank, 2.5);
      if (trace.hitTank) {
        var victim = trace.hitTank;
        if (victim.shieldUntil > gameTime) {
          // A shield reflects the incoming laser back along its traced path.
          var previous = trace.points[trace.points.length - 2];
          var returnAngle = Math.atan2(previous.y - trace.end.y, previous.x - trace.end.x);
          var returnTrace = traceRay(State.map, trace.end.x + Math.cos(returnAngle) * 0.2, trace.end.y + Math.sin(returnAngle) * 0.2, returnAngle, LASER_MAX_BOUNCE, 1500, tank, 2.5);
          if (returnTrace.hitTank && returnTrace.hitTank.shieldUntil <= gameTime && canDamage(tank, returnTrace.hitTank)) killTank(returnTrace.hitTank, tank);
          State.lasers.push({ points: returnTrace.points, life: 0.25, maxLife: 0.25 });
        } else killTank(victim, tank);
      }
    }
    State.lasers.push({ points: trace.points, life: deathray ? 0.45 : 0.3, maxLife: deathray ? 0.45 : 0.3, deathray: !!deathray });
    return true;
  }

  // ---------------- 地雷 ----------------
  function placeMine(tank) {
    if (!tank || !tank.alive || tank.mines <= 0) return false;
    if (State.state !== 'playing') return false;
    var map = State.map;
    var angle = tank.body;
    var candidates = [
      { x: tank.x - Math.cos(angle) * 20, y: tank.y - Math.sin(angle) * 20 },
      { x: tank.x, y: tank.y },
      { x: tank.x + Math.cos(angle) * 20, y: tank.y + Math.sin(angle) * 20 }
    ];
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      if (spotIsFree(map, c.x, c.y, 8)) {
        if (State.mines.length >= 24) return false;
        State.mines.push({
          x: c.x,
          y: c.y,
          r: 7,
          owner: tank,
          arm: 0.7,
          life: 22,
          armed: false,
          phase: 0, triggered: false, hidden: false
        });
        tank.mines--;
        tank.mineCd = 0;
        State.stats.minesPlaced++;
        return true;
      }
    }
    return false;
  }

  function explodeMine(mine) {
    State.stats.mineExplosions++;
    for (var i = 0; i < 16; i++) spawnParticle(mine.x, mine.y, '#ffb74d', 120, 100, 0.5);
    cachedTanks.forEach(function(tank) {
      if (tank.alive && canDamage(mine.owner, tank) && dist(tank.x, tank.y, mine.x, mine.y) < 44 && hasLineOfSight(State.map, mine.x, mine.y, tank.x, tank.y)) killTank(tank, mine.owner);
    });
  }

  function updateMines(dt) {
    for (var i = State.mines.length - 1; i >= 0; i--) {
      var mine = State.mines[i]; mine.life -= dt; mine.phase += dt;
      if (mine.life <= 0) { State.mines.splice(i, 1); continue; }
      if (!mine.armed) {
        mine.arm -= dt;
        // Arm after the placer leaves, avoiding an unavoidable birth collision.
        if (mine.arm <= 0 && dist(mine.x, mine.y, mine.owner.x, mine.owner.y) > 21) { mine.armed = true; mine.hidden = true; }
        continue;
      }
      var touching = cachedTanks.some(function(tank) { return tank.alive && canDamage(mine.owner, tank) && dist(tank.x, tank.y, mine.x, mine.y) < tank.r + mine.r; });
      if (touching) mine.triggered = true;
      if (mine.triggered && !touching) { explodeMine(mine); State.mines.splice(i, 1); }
    }
  }

  // ---------------- 道具 ----------------
  function spawnPowerup(type, x, y) {
    if (State.powerups.length >= 3 || !POWER[type] || !spotIsFree(State.map, x, y, 9)) return false;
    State.powerups.push({
      type: type,
      x: x,
      y: y,
      r: 9,
      life: randRange(12, 16),
      phase: rand() * Math.PI * 2
    });
    State.stats.powerupsSpawned++;
  }

  function randomPowerupSpot(map) {
    // Uniformly sample reachable floor tiles, with uniform within-tile jitter.
    for (var attempt = 0; attempt < 80; attempt++) {
      var pos = tileCenter(map, map.reachable[Math.floor(rand() * map.reachable.length)]);
      var jitter = Math.max(0, map.tile / 2 - 10);
      pos.x += randRange(-jitter, jitter); pos.y += randRange(-jitter, jitter);
      if (!spotIsFree(map, pos.x, pos.y, 9)) continue;
      if (State.powerups.some(function(p) { return dist(p.x, p.y, pos.x, pos.y) < 25; })) continue;
      return pos;
    }
    return null;
  }

  function applyPowerup(tank, type) {
    if (!tank || !tank.alive || !POWER[type]) return;
    if (type === 'mine') tank.mines = 3;
    else if (type === 'shield') tank.shieldUntil = gameTime + 6;
    else {
      tank.weapon = type;
      tank.ammo = type === 'double' ? 10 : type === 'shotgun' ? 3 : type === 'rapid' ? 40 : 1;
      tank.rapidUntil = type === 'rapid' ? gameTime + 5 : 0;
      tank.laserCharges = type === 'laser' ? 1 : 0;
    }
    if (tank === State.player) showMessage('获得' + POWER[type][1] + (type === 'mine' ? ' ×3（E / 右键）' : ''), 1.4);
    State.hudTimer = 0;
  }

  function updatePowerups(dt) {
    var list = State.powerups;
    for (var i = list.length - 1; i >= 0; i--) {
      var p = list[i];
      p.life -= dt;
      p.phase += dt * 2;
      if (p.life <= 0) {
        list.splice(i, 1);
        continue;
      }
      var listTanks = tanksList();
      for (var t = 0; t < listTanks.length; t++) {
        var tank = listTanks[t];
        if (!tank || !tank.alive) continue;
        if (dist(tank.x, tank.y, p.x, p.y) < p.r + tank.r) {
          applyPowerup(tank, p.type);
          State.stats.powerupsPicked++;
          list.splice(i, 1);
          break;
        }
      }
    }

    State.powerSpawnTimer -= dt;
    if (State.powerSpawnTimer <= 0) {
      State.powerSpawnTimer = randRange(4, 7);
      if (State.powerups.length < 3) {
        var spot = randomPowerupSpot(State.map, true);
        if (spot) spawnPowerup(POWERUP_TYPES[Math.floor(rand() * POWERUP_TYPES.length)], spot.x, spot.y);
      }
    }
  }

  // ---------------- 粒子 ----------------
  function spawnParticle(x, y, color, speed, spread, life) {
    if (State.particles.length > 180) return;
    var angle = rand() * Math.PI * 2;
    var s = speed * randRange(0.2, 1);
    State.particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * s,
      vy: Math.sin(angle) * s,
      life: life || 0.4,
      maxLife: life || 0.4,
      size: randRange(1.5, 3.6),
      color: color || '#fff'
    });
  }

  function updateParticles(dt) {
    var list = State.particles;
    for (var i = list.length - 1; i >= 0; i--) {
      var p = list[i];
      p.life -= dt;
      if (p.life <= 0) {
        list.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
  }

  // ---------------- 射击 ----------------
  function canFire(tank) {
    return tank && tank.alive && tank.fireCd <= 0 && State.state === 'playing';
  }

  function tryFire(tank, angle) {
    if (!canFire(tank) || tank.remote) return false;
    if (tank.ai && profile(tank) === PROFILES.nightmare && settings.friendlyFire && !tank.frag && !shotIsSafe(tank, angle == null ? tank.turret : angle)) {
      tank.ai.think = Math.min(tank.ai.think, 0.05); tank.fireCd = 0.1; return false;
    }
    var fireAngle = angle == null ? tank.turret : angle;
    if (tank.frag) {
      if (tank.frag.age < 0.35 || (tank === State.player && !tank.frag.inputReleased)) return false;
      var frag = tank.frag, index = State.bullets.indexOf(frag);
      if (index >= 0) State.bullets.splice(index, 1);
      explodeProjectile(frag); tank.fireCd = 0.5; return true;
    }
    if (tank.weapon === 'rapid' && tank.rapidUntil <= gameTime) { tank.weapon = null; tank.ammo = 0; }
    var weapon = tank.weapon, fired = false;
    if (weapon === 'laser' || weapon === 'deathray') fired = fireLaser(tank, fireAngle, weapon === 'deathray');
    else if (weapon === 'shotgun') {
      for (var i = 0; i < 20; i++) if (spawnBullet(tank, fireAngle + (i - 9.5) * 0.025, false, 'shotgun')) fired = true;
    } else {
      var b = spawnBullet(tank, fireAngle, weapon === 'rapid', weapon || 'normal', weapon === 'double' ? (tank.ammo % 2 ? 3 : -3) : 0);
      fired = !!b;
      if (b && weapon === 'frag') tank.frag = b;
      if (b && weapon === 'rc') tank.remote = b;
    }
    if (!fired) { tank.fireCd = 0.12; return false; }
    if (weapon) { tank.ammo--; if (tank.ammo <= 0) { tank.weapon = null; tank.laserCharges = 0; } }
    var interval = weapon === 'rapid' ? RAPID_INTERVAL : weapon === 'double' ? 0.22 : weapon === 'shotgun' ? 0.7 : FIRE_INTERVAL;
    tank.fireCd = tank.ai ? Math.max(interval, profile(tank).fire * (weapon === 'rapid' || weapon === 'double' ? 0.26 : 1) * randRange(1, 1.15)) : interval;
    State.hudTimer = 0; forecastTimer = 0;
    return true;
  }

  // ---------------- 击杀 / 计分 ----------------
  function scoreOf(key) {
    var tank = cachedTanks.find(function(t) { return t.key === key; });
    return State.scores[tank ? tank.team : key] || 0;
  }


  function killTank(tank, killer) {
    if (!tank || !tank.alive) return;
    tank.alive = false; tank.vx = tank.vy = 0;
    for (var i = 0; i < 18; i++) spawnParticle(tank.x, tank.y, tankColor(tank), 130, 120, 0.55);
    var validKill = killer && enemies(tank, killer);
    if (validKill) State.scores[killer.team] = (State.scores[killer.team] || 0) + 1;
    State.killInfo = { text: tank.name + ' 被击毁', sub: validKill ? killer.name + ' +1 分' : '自伤 / 友伤，不计分' };
    showMessage(State.killInfo.text + ' · ' + State.killInfo.sub, 1.5);
    State.hudTimer = 0;
  }

  function resolveRound() {
    if (State.state !== 'playing') return;
    var teams = [], leaders = [], top = 0;
    cachedTanks.forEach(function(t) { if (t.alive && teams.indexOf(t.team) < 0) teams.push(t.team); });
    Object.keys(State.scores).forEach(function(team) {
      var score = State.scores[team];
      if (score > top) { top = score; leaders = [team]; } else if (score === top) leaders.push(team);
    });
    if (top >= settings.targetScore && leaders.length === 1) State.matchWinner = leaders[0];
    var timedOut = roundElapsed + 1e-9 >= settings.roundTime;
    if (timedOut) roundElapsed = settings.roundTime;
    if (teams.length <= 1 || State.matchWinner || timedOut) {
      State.state = 'roundEnd'; State.roundTimer = 1.9;
      if (timedOut && !State.matchWinner && teams.length > 1) State.killInfo = { text: '时间到', sub: '保留当前比分，下一回合重新开战' };
      else if (!teams.length) State.killInfo = { text: '本回合结束', sub: '全员被击毁，保留比分' };
      else if (!State.killInfo) State.killInfo = { text: '回合结束', sub: '' };
      State.hudTimer = 0;
    }
  }

  // ---------------- AI ----------------


  // 在真实可行走地板图上寻路（包含广场和全部通道）
  function findPath(map, fromX, fromY, toX, toY) {
    var cols = map.cols, tile = map.tile;
    var start = Math.floor(fromY / tile) * cols + Math.floor(fromX / tile);
    var goal = Math.floor(toY / tile) * cols + Math.floor(toX / tile);
    if (map.walls[start] || goal < 0 || goal >= map.walls.length || map.walls[goal]) return [];
    if (clearTankPath(map, fromX, fromY, toX, toY)) return [{ x: toX, y: toY }];
    // Shared, bounded reverse BFS fields: at most one traversal per distinct goal tile.
    var field = map.fields.get(goal);
    if (!field) {
      field = new Int16Array(map.walls.length); field.fill(-1); field[goal] = 0;
      var queue = new Int16Array(map.walls.length), head = 0, tail = 1; queue[0] = goal;
      while (head < tail) {
        var k = queue[head++], neighbors = [k - cols, k + cols, k - 1, k + 1];
        for (var i = 0; i < 4; i++) {
          var n = neighbors[i];
          if (n >= 0 && n < field.length && !map.walls[n] && field[n] < 0) { field[n] = field[k] + 1; queue[tail++] = n; }
        }
      }
      if (map.fields.size >= 12) map.fields.delete(map.fields.keys().next().value);
      map.fields.set(goal, field);
    }
    var path = [], current = start;
    for (var guard = 0; current !== goal && guard < map.walls.length; guard++) {
      var adjacent = [current - cols, current + cols, current - 1, current + 1], next = current;
      for (var j = 0; j < 4; j++) if (field[adjacent[j]] >= 0 && field[adjacent[j]] < field[next]) next = adjacent[j];
      if (next === current) return [];
      path.push(tileCenter(map, next)); current = next;
    }
    if (path.length && !clearTankPath(map, fromX, fromY, path[0].x, path[0].y)) path.unshift(tileCenter(map, start));
    return path;
  }

  function clearTankPath(map, ax, ay, bx, by) {
    var steps = Math.ceil(dist(ax, ay, bx, by) / 6);
    for (var i = 1; i <= steps; i++) if (circleHitsWall(map, ax + (bx - ax) * i / steps, ay + (by - ay) * i / steps, TANK_RADIUS + 0.5)) return false;
    return true;
  }

  function predictTarget(tank, time) {
    var x = tank.x, y = tank.y, count = Math.ceil(time / 0.06);
    if (!count) return { x: x, y: y };
    var dt = time / count;
    for (var i = 0; i < count; i++) {
      if (!circleHitsWall(State.map, x + tank.vx * dt, y, tank.r)) x += tank.vx * dt;
      if (!circleHitsWall(State.map, x, y + tank.vy * dt, tank.r)) y += tank.vy * dt;
    }
    return { x: x, y: y };
  }

  function predictiveAngle(tank, target) {
    var speed = tank.weapon === 'homing' || tank.weapon === 'rc' ? 225 : BULLET_SPEED;
    var rx = target.x - tank.x, ry = target.y - tank.y;
    var a = target.vx * target.vx + target.vy * target.vy - speed * speed;
    var b = 2 * (rx * target.vx + ry * target.vy), c = rx * rx + ry * ry, time = Math.sqrt(c) / speed;
    var discriminant = b * b - 4 * a * c;
    if (Math.abs(a) > 0.001 && discriminant >= 0) {
      var t1 = (-b + Math.sqrt(discriminant)) / (2 * a), t2 = (-b - Math.sqrt(discriminant)) / (2 * a);
      time = t1 > 0 && t2 > 0 ? Math.min(t1, t2) : Math.max(t1, t2, 0);
    }
    if (tank.weapon === 'laser' || tank.weapon === 'deathray') time = 0;
    var predicted = predictTarget(target, Math.min(time, 1.6) * profile(tank).lead);
    return Math.atan2(predicted.y - tank.y, predicted.x - tank.x);
  }

  // 无视线时尝试找一/二次反弹的可行角度（AI 的"高难度"表现）
  function findBankShot(tank, target) {
    var p = profile(tank), base = predictiveAngle(tank, target), candidates = [base];
    var predicted = predictTarget(target, Math.min(dist(tank.x, tank.y, target.x, target.y) / BULLET_SPEED, 0.8));
    var surfaces = State.map.surfaces.slice().sort(function(a, b) { return Math.abs(a.at - tank[a.axis]) - Math.abs(b.at - tank[b.axis]); });
    var limit = p === PROFILES.normal ? 6 : p === PROFILES.original ? 14 : 24;
    for (var i = 0; i < Math.min(limit, surfaces.length); i++) {
      var surface = surfaces[i], image = { x: predicted.x, y: predicted.y };
      image[surface.axis] = 2 * surface.at - image[surface.axis];
      candidates.push(Math.atan2(image.y - tank.y, image.x - tank.x));
      if (p.bounces >= 2 && i < 8) for (var j = 0; j < Math.min(8, surfaces.length); j++) {
        if (surfaces[j].axis === surface.axis) continue;
        var second = { x: image.x, y: image.y };
        second[surfaces[j].axis] = 2 * surfaces[j].at - second[surfaces[j].axis];
        candidates.push(Math.atan2(second.y - tank.y, second.x - tank.x));
      }
    }
    for (i = 0; i < p.banks; i++) candidates.push(base + (i / p.banks) * Math.PI * 2);
    var best = null, bestScore = Infinity;
    for (i = 0; i < candidates.length; i++) {
      var trace = traceRay(State.map, tank.x, tank.y, candidates[i], p.bounces, p === PROFILES.normal ? 650 : 1100, tank, 2.5, tank.weapon !== 'laser');
      if (!trace.hitTank || !enemies(tank, trace.hitTank) || trace.hitTank.shieldUntil > gameTime) continue;
      var score = trace.distance + trace.bounces * 70;
      if (score < bestScore) { best = candidates[i]; bestScore = score; }
      // Prefer a valid direct intercept, leaving the remaining ray budget unused.
      if (i === 0 && trace.bounces === 0) break;
    }
    return best;
  }

  function buildForecast() {
    forecast = [];
    var horizon = PROFILES[settings.difficulty].horizon;
    for (var i = 0; i < State.bullets.length; i++) {
      var b = State.bullets[i];
      if (!State.ais.some(function(t) { return t.alive && canDamage(b.owner, t) && dist2(t.x, t.y, b.x, b.y) < 850 * 850; })) continue;
      var x = b.x, y = b.y, vx = b.vx, vy = b.vy, missile = b.kind === 'rc' || b.kind === 'homing';
      for (var time = 0; time < Math.min(horizon, b.life); time += 0.05) {
        var ax = x, ay = y, remaining = Math.hypot(vx, vy) * 0.05, speed = Math.hypot(vx, vy), ended = false;
        while (remaining > 0) {
          var step = Math.min(4, remaining); remaining -= step;
          var nx = x + vx / speed * step, ny = y + vy / speed * step;
          if (circleHitsWall(State.map, nx, ny, b.r)) {
            if (missile) { ended = true; break; }
            var hitX = circleHitsWall(State.map, nx, y, b.r), hitY = circleHitsWall(State.map, x, ny, b.r);
            if (hitX || !hitY) vx = -vx;
            if (hitY || !hitX) vy = -vy;
          } else { x = nx; y = ny; }
        }
        forecast.push({ ax: ax, ay: ay, bx: x, by: y, t0: time, t1: time + 0.05, r: b.r + (missile ? 9 : 0), owner: b.owner });
        if (ended) break;
      }
    }
  }

  function segmentDistance2(ax, ay, bx, by) {
    var vx = bx - ax, vy = by - ay, t = clamp(-(ax * vx + ay * vy) / (vx * vx + vy * vy || 1), 0, 1);
    return (ax + vx * t) * (ax + vx * t) + (ay + vy * t) * (ay + vy * t);
  }

  // Sample short movement trajectories, score goal progress and future relative collisions.
  // Inspired by DWA/velocity obstacles; this is a bounded game-specific planner, not full ORCA.
  function planMovement(tank, preferredX, preferredY) {
    var p = profile(tank), horizon = p.horizon, samples = Math.ceil(horizon / 0.1), dt = horizon / samples;
    var range = tank.speed * horizon + 40, range2 = range * range;
    var danger = forecast.filter(function(f) { return canDamage(f.owner, tank) && f.t0 <= horizon && segmentDistance2(f.ax - tank.x, f.ay - tank.y, f.bx - tank.x, f.by - tank.y) < range2; });
    if (p === PROFILES.nightmare) {
      cachedTanks.forEach(function(enemy) {
        if (!enemy.alive || !enemies(tank, enemy) || enemy.fireCd > 0.25 || enemy.remote || dist2(tank.x, tank.y, enemy.x, enemy.y) > 420 * 420) return;
        if (!hasLineOfSight(State.map, tank.x, tank.y, enemy.x, enemy.y)) return;
        var delay = Math.max(0.05, enemy.fireCd), dx = Math.cos(enemy.turret), dy = Math.sin(enemy.turret);
        var wall = castWall(State.map, enemy.x, enemy.y, dx, dy, 500, BULLET_RADIUS);
        for (var t = delay; t < Math.min(horizon, delay + wall.distance / BULLET_SPEED); t += 0.05) {
          var d0 = (t - delay) * BULLET_SPEED + enemy.r + 4, d1 = d0 + BULLET_SPEED * 0.05;
          danger.push({ax:enemy.x+dx*d0,ay:enemy.y+dy*d0,bx:enemy.x+dx*d1,by:enemy.y+dy*d1,t0:t,t1:t+0.05,r:3,owner:enemy,anticipated:true});
        }
      });
    }
    var nearMine = State.mines.some(function(m) { return m.armed && canDamage(m.owner, tank) && dist2(tank.x, tank.y, m.x, m.y) < range2; });
    if (!danger.length && !nearMine) return { x: preferredX, y: preferredY };
    var node = tank.ai.path[0], goalDistance = node ? Math.max(8, dist(tank.x, tank.y, node.x, node.y)) : 80;
    var goalX = tank.x + preferredX * goalDistance, goalY = tank.y + preferredY * goalDistance;
    var choices = [{ x: preferredX, y: preferredY }, { x: 0, y: 0 }];
    for (var c = 0; c < p.directions; c++) choices.push({ x: Math.cos(c * Math.PI * 2 / p.directions), y: Math.sin(c * Math.PI * 2 / p.directions) });
    var best = choices[0], bestScore = -Infinity;
    for (c = 0; c < choices.length; c++) {
      var choice = choices[c], length = Math.hypot(choice.x, choice.y) || 1;
      var vx = choice.x / length * tank.speed, vy = choice.y / length * tank.speed, x = tank.x, y = tank.y;
      var positions = [{ x: x, y: y }], score = 0, blocked = 0;
      for (var step = 1; step <= samples; step++) {
        var movingDt = Math.max(0, Math.min(dt, goalDistance / tank.speed - (step - 1) * dt));
        if (!circleHitsWall(State.map, x + vx * movingDt, y, tank.r + 0.5)) x += vx * movingDt; else blocked++;
        if (!circleHitsWall(State.map, x, y + vy * movingDt, tank.r + 0.5)) y += vy * movingDt; else blocked++;
        positions.push({ x: x, y: y });
      }
      score += (goalDistance - dist(x, y, goalX, goalY)) * 3 - blocked * 0.2;
      score -= Math.hypot(vx - tank.vx, vy - tank.vy) * 0.018;
      for (var f = 0; f < danger.length; f++) {
        var hazard = danger[f], index0 = Math.min(samples, Math.floor(hazard.t0 / dt)), index1 = Math.min(samples, Math.ceil(hazard.t1 / dt));
        // Interpolate tank positions at the projectile segment's exact time interval.
        var t0 = hazard.t0 / dt - index0, t1 = hazard.t1 / dt - Math.floor(hazard.t1 / dt);
        var a0 = positions[index0], a1 = positions[Math.min(samples, index0 + 1)];
        var b0 = positions[Math.max(0, index1 - 1)], b1 = positions[index1];
        if (t1 < 0.0001) t1 = 1;
        var tx0 = a0.x + (a1.x - a0.x) * t0, ty0 = a0.y + (a1.y - a0.y) * t0;
        var tx1 = b0.x + (b1.x - b0.x) * t1, ty1 = b0.y + (b1.y - b0.y) * t1;
        var d2 = segmentDistance2(hazard.ax - tx0, hazard.ay - ty0, hazard.bx - tx1, hazard.by - ty1);
        var rr = tank.r + hazard.r + 2;
        if (d2 < rr * rr) score -= (hazard.anticipated ? 4000 : 18000) / (0.35 + hazard.t0);
        else if (d2 < (rr + 18) * (rr + 18)) score -= 250 / (0.4 + hazard.t0);
      }
      for (var m = 0; m < State.mines.length; m++) {
        var mine = State.mines[m];
        if (mine.armed && canDamage(mine.owner, tank) && dist2(x, y, mine.x, mine.y) < 45 * 45) score -= 20000;
      }
      for (var j = 0; j < cachedTanks.length; j++) {
        var other = cachedTanks[j];
        if (other !== tank && other.alive && dist2(x, y, other.x, other.y) < 23 * 23) score -= 350;
      }
      if (score > bestScore) { best = choice; bestScore = score; }
    }
    return best;
  }

  // AI 选目标：有一定概率优先追玩家，避免两个 AI 全程互相打而忽略玩家
  function chooseAITarget(tank) {
    var list = livingEnemies(tank), best = null, score = Infinity;
    for (var i = 0; i < list.length; i++) {
      var target = list[i], distance = dist(tank.x, tank.y, target.x, target.y);
      var visible = hasLineOfSight(State.map, tank.x, tank.y, target.x, target.y);
      var cost = visible ? distance * 0.55 : distance;
      var protectedTarget = target.shieldUntil > gameTime;
      if (protectedTarget) cost += 130;
      // Independent factions still fight each other. Apply only a mild preference
      // for the player's entire faction, with extra weight for a good engagement.
      if (tank.team !== 'player' && target.team === 'player') {
        cost *= 0.94;
        if (visible && distance < 450 && !protectedTarget) cost *= 0.84;
      }
      if (cost < score) { best = target; score = cost; }
    }
    return best;
  }

  function updateAI(tank, dt) {
    if (!tank.alive) return;
    var ai = tank.ai, p = profile(tank);
    ai.think -= dt; ai.steerTimer -= dt; ai.mineCd -= dt;
    if (!ai.targetTank || !ai.targetTank.alive || ai.think <= 0) ai.targetTank = chooseAITarget(tank);
    var target = ai.targetTank;
    if (!target) { moveTank(tank, 0, 0, tank.speed, dt); return; }
    ai.targetKey = target.key;
    if (ai.think <= 0) {
      ai.think = p.think * randRange(0.9, 1.12); State.stats.aiDecisions++;
      var goal = target;
      if (!tank.weapon) {
        var nearest = 340;
        for (var i = 0; i < State.powerups.length; i++) {
          var powerup = State.powerups[i], distance = dist(tank.x, tank.y, powerup.x, powerup.y);
          // Respect travel distance/lifetime, rather than chasing an expiring pickup.
          var powerPath = findPath(State.map, tank.x, tank.y, powerup.x, powerup.y);
          if (distance < nearest && powerPath.length * TILE / tank.speed < powerup.life - 0.6) { goal = powerup; nearest = distance; }
        }
      }
      ai.path = findPath(State.map, tank.x, tank.y, goal.x, goal.y);
      ai.goal = goal; ai.aimError = randRange(-p.error, p.error);
      if (tank.weapon === 'deathray') {
        ai.shot = predictiveAngle(tank, target);
        if (settings.friendlyFire) {
          var rayX = Math.cos(ai.shot), rayY = Math.sin(ai.shot);
          if (cachedTanks.some(function(friend) {
            if (!friend.alive || friend === tank || enemies(tank, friend)) return false;
            var fx = friend.x - tank.x, fy = friend.y - tank.y;
            return fx * rayX + fy * rayY > 0 && Math.abs(fx * rayY - fy * rayX) < friend.r + 7;
          })) ai.shot = null;
        }
      }
      else if (tank.fireCd < p.think * 1.5) ai.shot = findBankShot(tank, target);
      else ai.shot = null;
      // No targetable ray? Follow the enemy with the turret; missile guidance uses it too.
      ai.aim = ai.shot === null ? predictiveAngle(tank, target) : ai.shot;
    }
    while (ai.path.length && dist(tank.x, tank.y, ai.path[0].x, ai.path[0].y) < 5) ai.path.shift();
    var moveX = 0, moveY = 0, node = ai.path[0];
    if (node) { var nd = dist(tank.x, tank.y, node.x, node.y) || 1; moveX = (node.x - tank.x) / nd; moveY = (node.y - tank.y) / nd; }
    // Strafe at close engagement distance rather than repeatedly ramming the target.
    if (ai.goal === target && hasLineOfSight(State.map, tank.x, tank.y, target.x, target.y) && dist(tank.x, tank.y, target.x, target.y) < (p === PROFILES.nightmare ? 240 : 120)) {
      var a = Math.atan2(target.y - tank.y, target.x - tank.x) + (Number(tank.key.slice(2)) % 2 ? 1 : -1) * Math.PI / 2;
      moveX = Math.cos(a); moveY = Math.sin(a);
    }
    if (p === PROFILES.nightmare && ai.goal === target && dist(tank.x, tank.y, target.x, target.y) < 110) {
      var away = Math.atan2(tank.y - target.y, tank.x - target.x); moveX = Math.cos(away); moveY = Math.sin(away);
    }
    if (ai.steerTimer <= 0) {
      ai.steerTimer = p.steer;
      var movement = planMovement(tank, moveX, moveY); ai.moveX = movement.x; ai.moveY = movement.y;
    }
    moveTank(tank, tank.remote ? 0 : ai.moveX, tank.remote ? 0 : ai.moveY, tank.speed, dt);
    var aim = ai.aim == null ? predictiveAngle(tank, target) : ai.aim;
    if (tank.remote) {
      var remotePath = findPath(State.map, tank.remote.x, tank.remote.y, target.x, target.y);
      var remoteGoal = remotePath[0] || target;
      aim = Math.atan2(remoteGoal.y - tank.remote.y, remoteGoal.x - tank.remote.x);
    }
    if (p === PROFILES.nightmare && !tank.remote && hasLineOfSight(State.map, tank.x, tank.y, target.x, target.y)) {
      aim = predictiveAngle(tank, target); ai.shot = aim;
    }
    // Mouse-controlled players can rotate their turret instantly too.
    tank.turret = p === PROFILES.nightmare ? aim + ai.aimError : angleLerp(tank.turret, aim + ai.aimError, (p === PROFILES.normal ? 6 : 18) * dt);
    if (tank.frag && tank.fireCd <= 0) {
      var b = tank.frag;
      if (b.age > 1.3 && livingEnemies(tank).some(function(t) { return dist(t.x, t.y, b.x, b.y) < 180; }) && (!settings.friendlyFire || dist(tank.x, tank.y, b.x, b.y) > 95)) tryFire(tank, tank.turret);
    } else if (ai.shot !== null && tank.fireCd <= 0 && Math.abs(angleDelta(tank.turret, aim)) < (p === PROFILES.normal ? 0.1 : 0.035)) {
      var check = tank.weapon === 'deathray' ? null : traceRay(State.map, tank.x, tank.y, tank.turret, p.bounces, 1100, tank, 2.5, tank.weapon !== 'laser');
      if (tank.weapon === 'deathray' || (check.hitTank && enemies(tank, check.hitTank))) tryFire(tank, tank.turret);
    }
    if (tank.mines > 0 && ai.mineCd <= 0 && dist(tank.x, tank.y, target.x, target.y) < 220) { if (placeMine(tank)) ai.mineCd = 2.5; }
  }


  // ---------------- 玩家操作 ----------------
  function playerAimTarget() {
    // 触摸操作时自动瞄准最近敌人；有鼠标时用鼠标位置
    if (State.aim.touch) {
      var target = pickNearestEnemy(State.player);
      if (target) return target;
    }
    return null;
  }

  function updatePlayer(dt) {
    var player = State.player;
    if (!player || !player.alive) return;
    var input = State.input;
    var dirX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    var dirY = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    moveTank(player, player.remote ? 0 : dirX, player.remote ? 0 : dirY, player.speed, dt);

    var autoTarget = playerAimTarget();
    if (State.aim.touch && player.remote && (dirX || dirY)) { player.turret = Math.atan2(dirY, dirX); autoTarget = null; }
    if (autoTarget) {
      player.turret = angleLerp(player.turret, Math.atan2(autoTarget.y - player.y, autoTarget.x - player.x), 12 * dt);
    } else if (State.aim.has) {
      player.turret = Math.atan2(State.aim.y - player.y, State.aim.x - player.x);
    } else if (dirX || dirY) {
      player.turret = angleLerp(player.turret, Math.atan2(dirY, dirX), 8 * dt);
    }

    if (input.firing) tryFire(player, player.turret);
  }

  // ---------------- 回合流程 ----------------
  function chooseMap() {
    // Independent uniform draws: every map has probability 1/30 each round.
    var index = Math.floor(rand() * mapPool.length);
    State.lastMapIndex = index;
    return { map: loadMap(index), index: index };
  }

  function startRound() {
    var chosen = chooseMap(); useMap(chosen.map); State.mapIndex = chosen.index;
    State.state = 'countdown'; State.roundTimer = 1.15; roundElapsed = 0;
    State.killInfo = null; State.message = null; State.messageTimer = 0;
    State.bullets.length = State.mines.length = State.powerups.length = State.particles.length = State.lasers.length = 0;
    State.powerSpawnTimer = randRange(2.5, 4); State.stats.rounds++;
    forecast = []; forecastTimer = 0;
    var spawns = allocateSpawns(State.map, settings.aiCount + 1); State.map.spawns = spawns;
    function faceTo(spawn) { return Math.atan2(H / 2 - spawn.y, W / 2 - spawn.x); }
    State.player = createTank('player', '玩家', 'player', spawns[0].x, spawns[0].y, faceTo(spawns[0]));
    State.ais = [];
    for (var i = 1; i <= settings.aiCount; i++) State.ais.push(createTank('ai' + i, 'AI-' + i, 'ai' + i, spawns[i].x, spawns[i].y, faceTo(spawns[i])));
    cachedTanks = [State.player].concat(State.ais);
    cachedTanks.forEach(function(t) { if (State.scores[t.team] == null) State.scores[t.team] = 0; });
    State.aim.has = false; clearInput();
    rebuildScoreboard(); bakeMap(); updateHud(true);
  }

  function clearInput() {
    State.input.up = State.input.down = State.input.left = State.input.right = State.input.firing = false;
  }

  function startMatch() {
    if (!State.ready) return;
    State.scores = {};
    State.matchWinner = null;
    State.round = 1;
    State.killInfo = null;
    State.stats = {
      playerShots: 0,
      aiShots: 0,
      playerLaserShots: 0,
      aiLaserShots: 0,
      aiDecisions: 0,
      powerupsSpawned: 0,
      powerupsPicked: 0,
      mineExplosions: 0,
      minesPlaced: 0,
      rounds: 0
    };
    gameTime = 0;
    State.input.firing = false;
    State.input.up = State.input.down = State.input.left = State.input.right = false;
    hideOverlay();
    startRound();
    startLoop();
  }

  function nextRound() {
    if (State.matchWinner) {
      State.state = 'matchEnd';
      State.freezeTimer = 2.4;
      showMatchEndOverlay();
      updateHud(true);
      return;
    }
    State.round++;
    startRound();
  }

  function showMessage(text, seconds) {
    State.message = text;
    State.messageTimer = seconds || 1.2;
  }

  // ---------------- 更新 ----------------
  function update(dt) {
    if (!State.ready) return;
    State.time += dt;
    gameTime += dt;

    if (State.messageTimer > 0) {
      State.messageTimer -= dt;
      if (State.messageTimer <= 0) State.message = null;
    }

    if (State.state === 'countdown') {
      State.roundTimer -= dt;
      if (State.roundTimer <= 0) {
        State.state = 'playing';
      }
      updateParticles(dt);
    } else if (State.state === 'playing') {
      roundElapsed += dt;
      forecastTimer -= dt;
      if (forecastTimer <= 0) { buildForecast(); forecastTimer = 0.05; }
      updatePlayer(dt);
      for (var i = 0; i < State.ais.length; i++) {
        updateAI(State.ais[i], dt);
      }
      separateTanks();
      updateBullets(dt);
      if (State.state === 'playing') updateMines(dt);
      if (State.state === 'playing') updatePowerups(dt);
      resolveRound();

      var list = tanksList();
      for (var t = 0; t < list.length; t++) {
        var tank = list[t];
        if (!tank) continue;
        if (tank.fireCd > 0) tank.fireCd -= dt;
      }
      updateParticles(dt);
      updateHudIfNeeded(dt);
    } else if (State.state === 'roundEnd') {
      State.roundTimer -= dt;
      updateParticles(dt);
      if (State.roundTimer <= 0) nextRound();
    } else if (State.state === 'matchEnd') {
      State.freezeTimer -= dt;
      updateParticles(dt);
      if (State.freezeTimer <= 0 && State.running) {
        stopLoop();
      }
    }

    updateRoundClock();
    // 激光与粒子通用倒计时
    for (var l = State.lasers.length - 1; l >= 0; l--) {
      State.lasers[l].life -= dt;
      if (State.lasers[l].life <= 0) State.lasers.splice(l, 1);
    }
    if (State.state !== 'playing') updateHudIfNeeded(dt);
  }

  function updateHudIfNeeded(dt) {
    State.hudTimer -= dt;
    if (State.hudTimer <= 0) {
      State.hudTimer = 0.25;
      updateHud();
    }
  }

  // ---------------- HUD / Overlay ----------------
  function setText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }

  function updateHud() {
    if (!hudEls) return;
    Object.keys(scoreNodes).forEach(function(team) {
      var node = scoreNodes[team];
      setText(node.score, String(State.scores[team] || 0));
      node.chip.classList.toggle('is-dead', State.state === 'playing' && !cachedTanks.some(function(t) { return t.team === team && t.alive; }));
    });
    setText(hudEls.round, '第 ' + State.round + ' 回合');
    setText(hudEls.first, '先到 ' + settings.targetScore + ' 分');
    updateRoundClock();
    setText(hudEls.map, State.map ? State.map.label + '地图 ' + (State.mapIndex % 10 + 1) + '/10' : '30 张地图');
    var player = State.player, parts = [];
    if (player && player.alive) {
      if (player.remote) parts.push('遥控导弹飞行中');
      if (player.frag) parts.push('再次开火引爆炸弹');
      if (player.weapon && (player.weapon !== 'rapid' || player.rapidUntil > gameTime)) parts.push(POWER[player.weapon][1] + ' ×' + player.ammo);
      if (player.mines) parts.push('地雷 ×' + player.mines);
      if (player.shieldUntil > gameTime) parts.push('护盾 ' + Math.ceil(player.shieldUntil - gameTime) + 's');
    } else if (player) parts.push('观战中');
    setText(hudEls.power, parts.join(' · ') || '无道具');
  }

  function roundRemaining() {
    return Math.max(0, Math.ceil(settings.roundTime - (State.state === 'idle' ? 0 : roundElapsed) - 1e-9));
  }

  function updateRoundClock() {
    if (!hudEls || !hudEls.time) return;
    var remaining = roundRemaining();
    var low = State.state === 'playing' && remaining > 0 && remaining <= 10;
    var key = remaining + ':' + low;
    if (clockKey === key) return;
    clockKey = key;
    setText(hudEls.time, '剩余 ' + String(Math.floor(remaining / 60)).padStart(2, '0') + ':' + String(remaining % 60).padStart(2, '0'));
    hudEls.time.classList.toggle('is-low', low);
  }

  function rebuildScoreboard() {
    var container = panel.querySelector('#tk-scores'); if (!container) return;
    container.replaceChildren(); scoreNodes = {};
    cachedTanks.forEach(function(tank) {
      if (scoreNodes[tank.team]) return;
      var chip = document.createElement('div'), label = document.createElement('span'), score = document.createElement('strong');
      chip.className = 'tk-hud-score'; label.className = 'tk-hud-label';
      chip.style.setProperty('--tank-color', tankColor(tank));
      label.textContent = tank.team === 'player' && settings.allies.length ? '我方' : tank.name;
      chip.title = cachedTanks.filter(function(t) { return t.team === tank.team; }).map(function(t) { return t.name; }).join('、');
      score.textContent = String(State.scores[tank.team] || 0);
      chip.append(label, score); container.append(chip); scoreNodes[tank.team] = { chip: chip, score: score };
    });
  }

  function bindSettings() {
    var dialog = panel.querySelector('#tk-settings'), form = panel.querySelector('#tk-settings-form');
    var difficulty = panel.querySelector('#tk-difficulty'), count = panel.querySelector('#tk-ai-count');
    var allyOptions = panel.querySelector('#tk-ally-options'), friendly = panel.querySelector('#tk-friendly-fire'), score = panel.querySelector('#tk-target-score');
    var roundTime = panel.querySelector('#tk-round-time');
    var opener = panel.querySelector('#tk-settings-btn');
    var notes = { normal: '普通：略有增强，适合轻松对战。', original: '原版：快速反应、预判拦截与反弹攻击，体验高压对战。', nightmare: '吓哭了：多次反弹搜索、长时域弹道预测和密集避弹规划。' };
    function selectedAllies() { return Array.from(allyOptions.querySelectorAll('input:checked')).map(function(input) { return Number(input.value); }); }
    function limitAllies() {
      var selected = selectedAllies(), limit = Math.min(2, Number(count.value) - 1);
      allyOptions.querySelectorAll('input').forEach(function(input) { input.disabled = !input.checked && selected.length >= limit; });
    }
    function renderAllies(selected) {
      var limit = Math.min(2, Number(count.value) - 1);
      selected = selected.filter(function(n) { return n <= Number(count.value); }).slice(0, limit);
      allyOptions.replaceChildren();
      for (var i = 1; i <= Number(count.value); i++) {
        var label = document.createElement('label'), input = document.createElement('input');
        input.type = 'checkbox'; input.value = String(i); input.checked = selected.indexOf(i) >= 0;
        input.addEventListener('change', limitAllies); label.append(input, document.createTextNode('AI-' + i)); allyOptions.append(label);
      }
      limitAllies();
    }
    function close() { if (dialog.open) dialog.close(); }
    opener.addEventListener('click', function() {
      difficulty.value = settings.difficulty; count.value = String(settings.aiCount);
      friendly.value = settings.friendlyFire ? 'on' : 'off'; score.value = String(settings.targetScore);
      roundTime.value = String(settings.roundTime);
      setText(panel.querySelector('#tk-difficulty-note'), notes[difficulty.value]); renderAllies(settings.allies);
      settingsOpen = true; clearInput(); pause(); dialog.showModal();
    });
    difficulty.addEventListener('change', function() { setText(panel.querySelector('#tk-difficulty-note'), notes[difficulty.value]); });
    count.addEventListener('change', function() { renderAllies(selectedAllies()); });
    panel.querySelector('#tk-settings-cancel').addEventListener('click', close);
    dialog.addEventListener('close', function() { settingsOpen = false; clearInput(); opener.focus(); resume(); });
    form.addEventListener('submit', function(event) {
      event.preventDefault();
      if (!form.reportValidity()) return;
      configure({ difficulty: difficulty.value, aiCount: Number(count.value), allies: selectedAllies(), friendlyFire: friendly.value === 'on', targetScore: Number(score.value), roundTime: Number(roundTime.value) }, true);
      close(); settingsOpen = false; startMatch();
    });
  }

  function hideOverlay() {
    if (overlayEl) overlayEl.classList.add('is-hidden');
  }

  function showStartOverlay() {
    if (!overlayEl) return;
    overlayEl.classList.remove('is-hidden'); setText(overlayTitle, '坦克动荡');
    setText(overlayDesc, '准备好出发了吗？'); setText(startBtn, '开始对局'); startBtn.dataset.mode = 'start';
  }

  function showMatchEndOverlay() {
    if (!overlayEl) return;
    overlayEl.classList.remove('is-hidden');
    setText(overlayTitle, State.matchWinner === 'player' ? '你赢了！' : '再挑战一次');
    var result = Object.keys(State.scores).map(function(team) {
      var tank = cachedTanks.find(function(t) { return t.team === team; });
      var name = team === 'player' && settings.allies.length ? '我方' : tank ? tank.name : team;
      return name + ' ' + State.scores[team];
    }).join(' : ');
    setText(overlayDesc, '最终比分 · ' + result); setText(startBtn, '再来一局'); startBtn.dataset.mode = 'restart';
  }

  // ---------------- 绘制 ----------------
  function bakeMap() {
    if (!State.map) return;
    var pal = palette();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!mapCanvas) mapCanvas = document.createElement('canvas');
    mapCanvas.width = Math.round(W * dpr);
    mapCanvas.height = Math.round(H * dpr);
    var mctx = mapCanvas.getContext('2d');
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 地面 + 轻微棋盘纹理
    mctx.fillStyle = pal.floor;
    mctx.fillRect(0, 0, W, H);
    mctx.fillStyle = pal.floorAlt;
    for (var ty = 0; ty < CFG.rows; ty++) {
      for (var tx = 0; tx < CFG.cols; tx++) {
        if ((tx + ty) % 2 === 0) mctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }

    // 墙体
    mctx.fillStyle = pal.wall;
    for (var y = 0; y < CFG.rows; y++) {
      for (var x = 0; x < CFG.cols; x++) {
        if (tileIsWall(State.map, x, y)) mctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
    // 墙顶高光 + 贴边描边
    for (y = 0; y < CFG.rows; y++) {
      for (x = 0; x < CFG.cols; x++) {
        if (!tileIsWall(State.map, x, y)) continue;
        if (!tileIsWall(State.map, x, y - 1)) {
          mctx.fillStyle = pal.wallTop;
          mctx.fillRect(x * TILE, y * TILE, TILE, 4);
        }
        if (!tileIsWall(State.map, x - 1, y)) {
          mctx.fillStyle = pal.wallEdge;
          mctx.fillRect(x * TILE, y * TILE, 2, TILE);
        }
        if (!tileIsWall(State.map, x + 1, y)) {
          mctx.fillStyle = pal.wallEdge;
          mctx.fillRect(x * TILE + TILE - 2, y * TILE, 2, TILE);
        }
        if (!tileIsWall(State.map, x, y + 1)) {
          mctx.fillStyle = pal.wallEdge;
          mctx.fillRect(x * TILE, y * TILE + TILE - 2, TILE, 2);
        }
      }
    }

    // 出生点圆环
    for (var s = 0; s < State.map.spawns.length; s++) {
      var sp = State.map.spawns[s];
      mctx.strokeStyle = pal.pad;
      mctx.lineWidth = 3;
      mctx.beginPath();
      mctx.arc(sp.x, sp.y, 20, 0, Math.PI * 2);
      mctx.stroke();
    }
    bakedDpr = dpr;
    bakedPaletteDark = isDarkTheme();
  }

  function drawTank(tank) {
    var pal = palette();
    var main = tankColor(tank);
    var dark = main;
    var r = tank.r;

    ctx.save();
    ctx.translate(tank.x, tank.y);
    // 车身
    ctx.rotate(tank.body);
    ctx.fillStyle = dark;
    roundRect(-r, -r * 0.95, r * 2, r * 0.34, 2);
    roundRect(-r, r * 0.61, r * 2, r * 0.34, 2);
    ctx.fillStyle = main;
    roundRect(-r * 0.92, -r * 0.68, r * 1.84, r * 1.36, 3);
    // 车头方向标记
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    roundRect(r * 0.42, -r * 0.26, r * 0.42, r * 0.52, 1.5);
    ctx.restore();

    // 炮塔 + 炮管
    ctx.save();
    ctx.translate(tank.x, tank.y);
    ctx.rotate(tank.turret);
    ctx.fillStyle = dark;
    roundRect(r * 0.35, -2.6, r * 1.55, 5.2, 2);
    ctx.fillStyle = main;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(-r * 0.18, -r * 0.18, r * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = main; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(tank.key === 'player' ? '你' : tank.name + (tank.team === 'player' ? ' 友' : ''), tank.x, tank.y - 19);
    if (tank.shieldUntil > gameTime) {
      ctx.strokeStyle = '#39a5db'; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.55 + 0.3 * Math.sin(gameTime * 9);
      ctx.beginPath(); ctx.arc(tank.x, tank.y, tank.r + 9, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    }
    // 玩家标识
    if (tank.key === 'player') {
      ctx.strokeStyle = 'rgba(73,177,245,0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(tank.x, tank.y, r + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function roundRect(x, y, w, h, radius) {
    var rr = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
    ctx.fill();
  }

  function drawPowerup(p) {
    var def = POWER[p.type], pal = palette();
    ctx.save(); ctx.translate(p.x, p.y + Math.sin(p.phase) * 1.5);
    if (p.life < 3) ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(p.life * 7));
    ctx.fillStyle = pal.powerBg; ctx.strokeStyle = def[2]; ctx.lineWidth = 2;
    roundRect(-p.r, -p.r, p.r * 2, p.r * 2, 4); ctx.stroke();
    ctx.fillStyle = def[2]; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(def[0], 0, 0.5);
    ctx.restore();
  }

  function drawMine(mine) {
    if (mine.hidden && mine.owner.team !== 'player' && !mine.triggered) return;
    var pal = palette();
    ctx.save();
    ctx.translate(mine.x, mine.y);
    if (mine.hidden && !mine.triggered) ctx.globalAlpha = 0.25;
    ctx.fillStyle = pal.mine;
    ctx.beginPath();
    ctx.arc(0, 0, mine.r * 0.72, 0, Math.PI * 2);
    ctx.fill();
    if (mine.armed) {
      var blink = 0.5 + 0.5 * Math.sin(mine.phase * 8);
      ctx.fillStyle = pal.danger;
      ctx.globalAlpha = 0.35 + blink * 0.65;
      ctx.beginPath();
      ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.strokeStyle = pal.wallTop;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, mine.r + 1.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - mine.arm / 0.7));
      ctx.stroke();
    }
    ctx.restore();
  }

  function draw() {
    if (!ctx) return;
    var pal = palette();
    if (!mapCanvas || bakedDpr !== Math.min(window.devicePixelRatio || 1, 2) || bakedPaletteDark !== isDarkTheme()) {
      bakeMap();
    }
    ctx.setTransform(State.scaleX, 0, 0, State.scaleY, 0, 0);
    ctx.fillStyle = pal.floor;
    ctx.fillRect(0, 0, W, H);
    if (mapCanvas) ctx.drawImage(mapCanvas, 0, 0, W, H);

    var i;
    for (i = 0; i < State.powerups.length; i++) drawPowerup(State.powerups[i]);
    for (i = 0; i < State.mines.length; i++) drawMine(State.mines[i]);

    if (State.player && State.player.alive && State.player.weapon === 'laser') {
      var guide = traceRay(State.map, State.player.x, State.player.y, State.player.turret, LASER_MAX_BOUNCE, 1500, State.player, 2.5);
      ctx.save(); ctx.strokeStyle = pal.laser; ctx.globalAlpha = 0.35; ctx.lineWidth = 1;
      ctx.setLineDash([7, 5]); strokePolyline(guide.points); ctx.restore();
    }
    // 子弹
    for (i = 0; i < State.bullets.length; i++) {
      var b = State.bullets[i];
      ctx.strokeStyle = pal.bullet;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = b.r * 1.4;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = b.kind === 'frag' ? POWER.frag[2] : b.kind === 'rc' || b.kind === 'homing' ? '#ef8c00' : pal.bullet;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 激光
    for (i = 0; i < State.lasers.length; i++) {
      var laser = State.lasers[i];
      var alpha = laser.life / laser.maxLife;
      ctx.strokeStyle = laser.deathray ? '#a26bea' : pal.laser;
      ctx.globalAlpha = 0.22 * alpha;
      ctx.lineWidth = 14;
      strokePolyline(laser.points);
      ctx.globalAlpha = 0.9 * alpha;
      ctx.lineWidth = 4;
      strokePolyline(laser.points);
      ctx.globalAlpha = 1;
    }

    // 坦克
    var list = tanksList();
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].alive) drawTank(list[i]);
    }

    // 粒子
    for (i = 0; i < State.particles.length; i++) {
      var p = State.particles[i];
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 提示消息 / 回合计时
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (State.state === 'countdown') {
      var count = Math.max(1, Math.ceil(State.roundTimer / 0.4));
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, H / 2 - 66, W, 100);
      ctx.fillStyle = pal.text;
      ctx.font = 'bold 34px system-ui, -apple-system, sans-serif';
      ctx.fillText('第 ' + State.round + ' 回合', W / 2, H / 2 - 32);
      ctx.font = 'bold 56px system-ui, -apple-system, sans-serif';
      ctx.fillText(String(count), W / 2, H / 2 + 30);
    } else if (State.state === 'roundEnd' && State.killInfo) {
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.fillRect(0, H / 2 - 58, W, 116);
      ctx.fillStyle = pal.text;
      ctx.font = 'bold 40px system-ui, -apple-system, sans-serif';
      ctx.fillText(State.killInfo.text, W / 2, H / 2 - 20);
      ctx.font = '20px system-ui, -apple-system, sans-serif';
      ctx.fillText(State.killInfo.sub, W / 2, H / 2 + 28);
    }
    if (State.message) {
      ctx.fillStyle = pal.text;
      ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
      ctx.fillText(State.message, W / 2, H - 26);
    }
  }

  function strokePolyline(points) {
    if (!points || points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }

  // ---------------- 循环 ----------------
  function loop(ts) {
    State.raf = 0;
    if (!canRun() || !State.running) {
      State.running = false;
      return;
    }
    if (!State.lastTime) State.lastTime = ts;
    var dt = (ts - State.lastTime) / 1000;
    State.lastTime = ts;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    State.frames++;
    State.accumulator = Math.min((State.accumulator || 0) + dt, 0.067);
    while (State.accumulator >= 1 / 60) { update(1 / 60); State.accumulator -= 1 / 60; }
    draw();
    if (canRun() && State.running) {
      State.raf = window.requestAnimationFrame(loop);
    } else {
      State.running = false;
    }
  }

  function startLoop() {
    if (!canRun()) {
      draw();
      return;
    }
    if (State.running) return;
    State.running = true;
    State.lastTime = 0; State.accumulator = 0;
    State.raf = window.requestAnimationFrame(loop);
  }

  function stopLoop() {
    State.running = false;
    if (State.raf) {
      window.cancelAnimationFrame(State.raf);
      State.raf = 0;
    }
  }

  function pause() {
    clearInput();
    stopLoop();
  }

  function resume() {
    if (!initialized || !State.active) return;
    if (State.state === 'idle' || State.state === 'matchEnd' || settingsOpen) {
      draw();
      return;
    }
    startLoop();
  }

  // ---------------- 画布尺寸 ----------------
  function resize() {
    if (!canvas) return;
    var rect = canvas.getBoundingClientRect();
    var cssW = rect.width;
    if (!cssW) {
      var parent = canvas.parentElement;
      cssW = parent ? parent.clientWidth : 640;
    }
    if (!cssW) return;
    var cssH = cssW * (H / W);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var bw = Math.round(cssW * dpr);
    var bh = Math.round(cssH * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    State.scaleX = bw / W;
    State.scaleY = bh / H;
    State.dpr = dpr;
    if (bakedDpr !== dpr) bakeMap();
    draw();
  }

  // ---------------- 输入 ----------------
  function isActivePanel() {
    return !!(panel && panel.classList.contains('is-active') && State.active);
  }

  function stopTyping(e) {
    var target = e.target;
    if (!target) return false;
    var tag = (target.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
  }

  function setKey(code, pressed) {
    var input = State.input;
    switch (code) {
      case 'KeyW':
      case 'ArrowUp':
        input.up = pressed;
        break;
      case 'KeyS':
      case 'ArrowDown':
        input.down = pressed;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        input.left = pressed;
        break;
      case 'KeyD':
      case 'ArrowRight':
        input.right = pressed;
        break;
      case 'Space':
        input.firing = pressed;
        break;
      case 'KeyE':
      case 'ShiftLeft':
      case 'ShiftRight':
        if (pressed) placeMine(State.player);
        break;
      default:
        return false;
    }
    return true;
  }

  function bindInput() {
    document.addEventListener('keydown', function(e) {
      if (!isActivePanel() || settingsOpen || stopTyping(e)) return;
      if (setKey(e.code, true)) e.preventDefault();
    });
    document.addEventListener('keyup', function(e) {
      if (!isActivePanel()) return;
      if (setKey(e.code, false)) e.preventDefault();
    });

    canvas.addEventListener('mousemove', function(e) {
      if (!isActivePanel()) return;
      var rect = canvas.getBoundingClientRect();
      if (!rect.width) return;
      State.aim.x = ((e.clientX - rect.left) / rect.width) * W;
      State.aim.y = ((e.clientY - rect.top) / rect.height) * H;
      State.aim.has = true;
      State.aim.touch = false;
    });
    canvas.addEventListener('mousedown', function(e) {
      if (!isActivePanel()) return;
      if (e.button === 2) {
        e.preventDefault();
        placeMine(State.player);
        return;
      }
      if (e.button !== 0) return;
      e.preventDefault();
      State.aim.touch = false;
      State.input.firing = true;
      tryFire(State.player, State.player.turret);
    });
    document.addEventListener('mouseup', function() {
      State.input.firing = false;
    });
    canvas.addEventListener('contextmenu', function(e) {
      e.preventDefault();
    });
    window.addEventListener('blur', function() {
      State.input.firing = false;
      State.input.up = State.input.down = State.input.left = State.input.right = false;
    });

    // 暂停按钮点击后焦点在按钮上时，空格不触发按钮
    if (startBtn) {
      startBtn.addEventListener('click', function() {
        var mode = startBtn.dataset.mode;
        if (mode === 'restart') startMatch();
        else startMatch();
      });
    }

    function releaseFire() { State.input.firing = false; if (State.player && State.player.frag) State.player.frag.inputReleased = true; }
    document.addEventListener('mouseup', releaseFire);
    document.addEventListener('keyup', function(e) { if (e.code === 'Space') releaseFire(); });
    var touchFire = panel.querySelector('#tk-fire-btn');
    if (touchFire) { touchFire.addEventListener('pointerup', releaseFire); touchFire.addEventListener('pointercancel', releaseFire); }
    bindTouch();
  }

  function bindTouch() {
    if (!touchEls || !joystickEl) return;
    var knob = joystickEl.querySelector('.tk-joystick-knob');
    var pointerId = null;
    var joystickVector = { x: 0, y: 0 };
    var joystickActive = false;

    function updateJoystick(clientX, clientY) {
      var rect = joystickEl.getBoundingClientRect();
      if (!rect.width) return;
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var maxR = rect.width * 0.34;
      var dx = clientX - cx;
      var dy = clientY - cy;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var limited = Math.min(len, maxR);
      var nx = (dx / len) * limited;
      var ny = (dy / len) * limited;
      if (knob) knob.style.transform = 'translate(' + nx + 'px, ' + ny + 'px)';
      var strength = limited / maxR;
      joystickVector.x = (dx / len) * strength;
      joystickVector.y = (dy / len) * strength;
      var input = State.input;
      input.left = joystickVector.x < -0.22;
      input.right = joystickVector.x > 0.22;
      input.up = joystickVector.y < -0.22;
      input.down = joystickVector.y > 0.22;
      State.aim.touch = true;
    }

    joystickEl.addEventListener('pointerdown', function(e) {
      joystickActive = true;
      pointerId = e.pointerId;
      joystickEl.setPointerCapture && joystickEl.setPointerCapture(e.pointerId);
      updateJoystick(e.clientX, e.clientY);
      e.preventDefault();
    });
    joystickEl.addEventListener('pointermove', function(e) {
      if (!joystickActive || e.pointerId !== pointerId) return;
      updateJoystick(e.clientX, e.clientY);
      e.preventDefault();
    });
    function endJoystick(e) {
      if (e.pointerId !== pointerId) return;
      joystickActive = false;
      pointerId = null;
      joystickVector.x = 0;
      joystickVector.y = 0;
      if (knob) knob.style.transform = 'translate(0, 0)';
      var input = State.input;
      input.left = input.right = input.up = input.down = false;
    }
    joystickEl.addEventListener('pointerup', endJoystick);
    joystickEl.addEventListener('pointercancel', endJoystick);
    joystickEl.addEventListener('lostpointercapture', endJoystick);

    var fireBtn = touchEls.querySelector('#tk-fire-btn');
    if (fireBtn) {
      fireBtn.addEventListener('pointerdown', function(e) {
        e.preventDefault();
        State.aim.touch = true;
        State.input.firing = true;
      });
      fireBtn.addEventListener('pointerup', function(e) {
        e.preventDefault();
        State.input.firing = false;
      });
      fireBtn.addEventListener('pointercancel', function() {
        State.input.firing = false;
      });
      fireBtn.addEventListener('pointerleave', function() {
        State.input.firing = false;
      });
    }
    var mineBtn = touchEls.querySelector('#tk-mine-btn');
    if (mineBtn) {
      mineBtn.addEventListener('pointerdown', function(e) {
        e.preventDefault();
        placeMine(State.player);
      });
    }

    // 首次触摸后切换到触摸瞄准（自动瞄准）
    panel.addEventListener(
      'touchstart',
      function() {
        State.aim.touch = true;
      },
      { passive: true }
    );
  }

  // ---------------- 初始化 ----------------
  function cacheDom() {
    canvas = panel.querySelector('#tk-canvas');
    stageEl = panel.querySelector('.tk-stage');
    overlayEl = panel.querySelector('#tk-overlay');
    overlayTitle = panel.querySelector('#tk-overlay-title');
    overlayDesc = panel.querySelector('#tk-overlay-desc');
    startBtn = panel.querySelector('#tk-start-btn');
    hudEls = {
      first: panel.querySelector('#tk-first'),
      time: panel.querySelector('#tk-time'),
      map: panel.querySelector('#tk-map'),
      round: panel.querySelector('#tk-round'),
      power: panel.querySelector('#tk-power')
    };
    touchEls = panel.querySelector('#tk-touch');
    joystickEl = panel.querySelector('#tk-joystick');
    if (!canvas) return false;
    ctx = canvas.getContext('2d');
    return !!ctx;
  }

  function init(tabPanel) {
    if (initialized) return true;
    panel = tabPanel || document.querySelector('.lg-game-panel[data-game="tank"]');
    if (!panel) return false;
    if (!cacheDom()) return false;
    var start = nowMs();

    try { configure(JSON.parse(localStorage.getItem('littleTank.settings.v2') || '{}')); } catch (_) { configure({}); }
    mapPool = buildMapPool();
    State.ready = true;
    State.state = 'idle';
    State.mapIndex = Math.floor(rand() * mapPool.length);
    useMap(loadMap(State.mapIndex));

    bindSettings();
    bindInput();
    updateHud();
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(function() {
        resize();
      });
      resizeObserver.observe(stageEl || canvas.parentElement || canvas);
    }
    window.addEventListener('resize', resize);

    if (window.MutationObserver) {
      themeObserver = new MutationObserver(function() {
        bakeMap();
        draw();
      });
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    }

    // 首帧：先画地图预览，再等用户点击开始
    requestAnimationFrame(function() {
      resize();
      if (State.state === 'idle') showStartOverlay();
      draw();
    });
    State.initMs = Math.round((nowMs() - start) * 100) / 100;
    initialized = true;
    return true;
  }

  function nowMs() {
    return window.performance && performance.now ? performance.now() : Date.now();
  }

  function activate() {
    if (!initialized) return;
    // 面板不在前台时只标记，不跑循环
    if (panel && !panel.classList.contains('is-active')) {
      State.active = false;
      return;
    }
    State.active = true;
    resize();
    resume();
  }

  function deactivate() {
    clearInput();
    State.active = false;
    pause();
  }

  // ---------------- 测试钩子（供本地无头验证使用） ----------------
  function snapshot() {
    function tankInfo(t) {
      if (!t) return null;
      return {
        key: t.key,
        x: Math.round(t.x * 10) / 10,
        y: Math.round(t.y * 10) / 10,
        alive: t.alive, team: t.team, weapon: t.weapon, ammo: t.ammo, shield: t.shieldUntil > gameTime,
        turret: Math.round(t.turret * 100) / 100,
        fireCd: Math.round(t.fireCd * 100) / 100,
        mines: t.mines,
        lasers: t.laserCharges,
        rapid: t.rapidUntil > gameTime,
        ai: t.ai
          ? {
              pathLen: t.ai.path.length,
              targetKey: t.ai.targetKey
            }
          : null
      };
    }
    return {
      initialized: initialized,
      active: State.active,
      running: State.running,
      state: State.state,
      round: State.round,
      scores: Object.assign({}, State.scores),
      settings: Object.assign({}, settings, { allies: settings.allies.slice() }),
      roundRemaining: roundRemaining(),
      mapSize: State.map ? State.map.label : null, tile: TILE,
      mapIndex: State.mapIndex,
      mapCount: mapPool ? mapPool.length : 0,
      player: tankInfo(State.player),
      ais: State.ais.map(tankInfo),
      bullets: State.bullets.length,
      mines: State.mines.length,
      mineList: State.mines.map(function(m) {
        return {
          x: Math.round(m.x * 10) / 10,
          y: Math.round(m.y * 10) / 10,
          armed: m.armed,
          owner: m.owner ? m.owner.key : null
        };
      }),
      powerups: State.powerups.length,
      powerupList: State.powerups.map(function(p) {
        return { type: p.type, x: Math.round(p.x), y: Math.round(p.y) };
      }),
      mapHash: (function() {
        if (!State.map) return 0;
        var h = 0;
        for (var i = 0; i < State.map.walls.length; i++) {
          h = ((h * 31) + State.map.walls[i]) | 0;
        }
        return h;
      })(),
      spawns: State.map
        ? State.map.spawns.map(function(s) {
            return { x: s.x, y: s.y };
          })
        : [],
      particles: State.particles.length,
      lasers: State.lasers.length,
      matchWinner: State.matchWinner,
      playerShots: State.stats.playerShots,
      aiShots: State.stats.aiShots,
      playerLaserShots: State.stats.playerLaserShots,
      aiLaserShots: State.stats.aiLaserShots,
      aiDecisions: State.stats.aiDecisions,
      powerupsSpawned: State.stats.powerupsSpawned,
      powerupsPicked: State.stats.powerupsPicked,
      mineExplosions: State.stats.mineExplosions,
      minesPlaced: State.stats.minesPlaced,
      rounds: State.stats.rounds,
      initMs: State.initMs || 0
    };
  }

  function testSimulate(seconds) {
    var steps = Math.round((seconds || 0) * 60);
    for (var i = 0; i < steps; i++) {
      update(1 / 60);
    }
    draw();
  }

  function testKill(victimKey, killerKey) {
    var victim = null;
    var killer = null;
    var list = tanksList();
    for (var i = 0; i < list.length; i++) {
      if (!list[i]) continue;
      if (list[i].key === victimKey) victim = list[i];
      if (list[i].key === killerKey) killer = list[i];
    }
    if (victim) killTank(victim, killer);
  }

  window.LittleTankTrouble = {
    init: init,
    activate: activate,
    deactivate: deactivate,
    pause: pause,
    resume: resume,
    isInitialized: function() {
      return initialized;
    },
    getState: snapshot,
    getSettings: function() { return Object.assign({}, settings, { allies: settings.allies.slice() }); },
    __test: {
      configure: function(value) { configure(value); },
      loadMap: function(index) { return loadMap(index); },
      selectMap: function(index) { useMap(loadMap(index)); State.mapIndex = index; },
      spawns: allocateSpawns,
      path: findPath,
      tanks: tanksList,
      physics: updateBullets,
      releaseFire: function() { if (State.player && State.player.frag) State.player.frag.inputReleased = true; },
      mines: updateMines,
      powers: updatePowerups,
      shoot: tryFire,
      applyPowerup: applyPowerup,
      canDamage: canDamage,
      chooseTarget: chooseAITarget,
      trace: traceRay,
      plan: planMovement,
      forecast: buildForecast,
      resolve: resolveRound,
      rawState: function() { return State; },

      start: startMatch,
      simulate: testSimulate,
      draw: draw,
      state: snapshot,
      setPlayerPos: function(x, y) {
        if (State.player) {
          State.player.x = x;
          State.player.y = y;
        }
      },
      setAIPos: function(index, x, y) {
        if (State.ais[index]) {
          State.ais[index].x = x;
          State.ais[index].y = y;
        }
      },
      aimAt: function(x, y) {
        State.aim.x = x;
        State.aim.y = y;
        State.aim.has = true;
        State.aim.touch = false;
      },
      firePlayer: function(angle) {
        tryFire(State.player, angle == null ? State.player.turret : angle);
      },
      placeMine: function() {
        placeMine(State.player);
      },
      forcePowerup: function(type) {
        applyPowerup(State.player, type);
      },
      spawnPowerupAt: function(type, x, y) {
        spawnPowerup(type, x, y);
      },
      addMineToPlayer: function(n) {
        if (State.player) State.player.mines += n || 2;
      },
      armMines: function() {
        for (var i = 0; i < State.mines.length; i++) {
          State.mines[i].armed = true;
          State.mines[i].arm = 0;
        }
      },
      kill: testKill,
      input: State.input,
      getMap: function() {
        return State.map;
      },
      mapWalls: function() {
        return State.map ? Array.prototype.slice.call(State.map.walls) : null;
      }
    }
  };
})();
