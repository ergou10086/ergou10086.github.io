// 坦克动荡（Tank Trouble 风格）—— littleGame 内的俯视迷宫坦克对战
// 参考 Tank Trouble（BANANAPEEL202）：随机迷宫、子弹撞墙反弹、一炮淘汰、
// 回合制计分（先到 5 分）、极简 Canvas 美术、2 个 AI、三种地面道具。
// 性能要点：
//  1. 脚本由 extra-games.js 首次点击 tab 时才动态加载；
//  2. 只在面板激活且游戏运行时跑 requestAnimationFrame，切换 tab / 页面隐藏即暂停；
//  3. 静态墙体预渲染到离屏 canvas，每帧只 drawImage + 少量动态对象。
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
    mapCount: 13,         // 13 张程序化大地图
    targetScore: 5
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
  var POWERUP_TYPES = ['mine', 'laser', 'rapid'];
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
    return initialized && State.active && !document.hidden;
  }

  // ---------------- 地图 ----------------
  function createMaze(seed) {
    var rnd = mulberry32(seed * 1103515245 + 12345);
    var cw = CFG.cellCols;
    var ch = CFG.cellRows;
    var cols = CFG.cols;
    var rows = CFG.rows;
    var walls = new Uint8Array(cols * rows);
    var i;
    var j;
    for (i = 0; i < walls.length; i++) walls[i] = 1;

    var visited = new Uint8Array(cw * ch);
    var stack = [];
    var startX = 0;
    var startY = 0;
    visited[startY * cw + startX] = 1;
    openCellTile(walls, cols, startX, startY);
    stack.push([startX, startY]);

    var dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    while (stack.length) {
      var cur = stack[stack.length - 1];
      var candidates = [];
      for (i = 0; i < dirs.length; i++) {
        var nx = cur[0] + dirs[i][0];
        var ny = cur[1] + dirs[i][1];
        if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
        if (visited[ny * cw + nx]) continue;
        candidates.push([nx, ny]);
      }
      if (!candidates.length) {
        stack.pop();
        continue;
      }
      var next = candidates[Math.floor(rnd() * candidates.length)];
      visited[next[1] * cw + next[0]] = 1;
      // 打通两个单元之间的墙
      var midX = cur[0] * 2 + 1 + (next[0] - cur[0]);
      var midY = cur[1] * 2 + 1 + (next[1] - cur[1]);
      openTile(walls, cols, midX, midY);
      openCellTile(walls, cols, next[0], next[1]);
      stack.push(next);
    }

    // 增加环路：随机打通额外的墙，让绕行通道更多（不打通最外圈）
    var loops = 10 + Math.floor(rnd() * 9);
    for (i = 0; i < loops; i++) {
      var wx = 1 + Math.floor(rnd() * (cols - 2));
      var wy = 1 + Math.floor(rnd() * (rows - 2));
      if (!walls[wy * cols + wx]) continue;
      var leftOpen = wx > 0 && !walls[wy * cols + wx - 1];
      var rightOpen = wx < cols - 1 && !walls[wy * cols + wx + 1];
      var topOpen = wy > 0 && !walls[(wy - 1) * cols + wx];
      var bottomOpen = wy < rows - 1 && !walls[(wy + 1) * cols + wx];
      if ((leftOpen && rightOpen) || (topOpen && bottomOpen)) {
        walls[wy * cols + wx] = 0;
      }
    }

    // 随机开 1~2 个小广场，增加对枪空间
    var plazas = 1 + Math.floor(rnd() * 2);
    for (i = 0; i < plazas; i++) {
      var px = 2 + Math.floor(rnd() * (cols - 6));
      var py = 2 + Math.floor(rnd() * (rows - 6));
      for (var oy = 0; oy < 3; oy++) {
        for (var ox = 0; ox < 3; ox++) {
          openTile(walls, cols, px + ox, py + oy);
        }
      }
    }

    // 出生点：玩家左下，AI-1 同侧偏中（较快接敌），AI-2 右上远处包抄
    var spawnCells = [
      [0, ch - 1],
      [7, ch - 1],
      [11, 1]
    ];
    var spawns = [];
    for (i = 0; i < spawnCells.length; i++) {
      var spawn = cellToWorld(spawnCells[i][0], spawnCells[i][1]);
      spawns.push(spawn);
      var sx = Math.floor(spawn.x / TILE);
      var sy = Math.floor(spawn.y / TILE);
      walls[sy * cols + sx] = 0;
    }

    return { walls: walls, cols: cols, rows: rows, spawns: spawns, seed: seed };
  }

  function openTile(walls, cols, x, y) {
    if (x <= 0 || y <= 0 || x >= CFG.cols - 1 || y >= CFG.rows - 1) return;
    walls[y * cols + x] = 0;
  }

  function openCellTile(walls, cols, cx, cy) {
    openTile(walls, cols, cx * 2 + 1, cy * 2 + 1);
  }

  function cellToWorld(cx, cy) {
    return { x: (cx * 2 + 1.5) * TILE, y: (cy * 2 + 1.5) * TILE };
  }

  function worldToCell(x, y) {
    var cx = clamp(Math.round((x / TILE - 1.5) / 2), 0, CFG.cellCols - 1);
    var cy = clamp(Math.round((y / TILE - 1.5) / 2), 0, CFG.cellRows - 1);
    return { cx: cx, cy: cy };
  }

  function buildMapPool() {
    var pool = [];
    for (var i = 0; i < CFG.mapCount; i++) {
      pool.push(createMaze(i + 1));
    }
    return pool;
  }

  function tileIsWall(map, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= map.cols || ty >= map.rows) return true;
    return map.walls[ty * map.cols + tx] === 1;
  }

  // 圆与墙格 AABB 的碰撞检测
  function circleHitsWall(map, x, y, r) {
    var minTx = Math.floor((x - r) / TILE);
    var maxTx = Math.floor((x + r) / TILE);
    var minTy = Math.floor((y - r) / TILE);
    var maxTy = Math.floor((y + r) / TILE);
    for (var ty = minTy; ty <= maxTy; ty++) {
      for (var tx = minTx; tx <= maxTx; tx++) {
        if (!tileIsWall(map, tx, ty)) continue;
        var left = tx * TILE;
        var top = ty * TILE;
        var cx = clamp(x, left, left + TILE);
        var cy = clamp(y, top, top + TILE);
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
  function traceRay(map, sx, sy, angle, maxBounces, maxDist, ignoreTank, hitRadius) {
    var dx = Math.cos(angle);
    var dy = Math.sin(angle);
    var x = sx;
    var y = sy;
    var points = [{ x: x, y: y }];
    var bounces = 0;
    var travelled = 0;
    var step = 4;
    var hitTank = null;
    var tanks = [State.player].concat(State.ais);
    var guard = 0;

    while (travelled < maxDist && guard < 1200) {
      guard++;
      var nx = x + dx * step;
      var ny = y + dy * step;
      if (circleHitsWall(map, nx, ny, 0.8)) {
        var hitX = circleHitsWall(map, nx, y, 0.8);
        var hitY = circleHitsWall(map, x, ny, 0.8);
        if (hitX && !hitY) dx = -dx;
        else if (hitY && !hitX) dy = -dy;
        else {
          dx = -dx;
          dy = -dy;
        }
        points.push({ x: x, y: y, bounce: true });
        bounces++;
        if (bounces > maxBounces) break;
        continue;
      }
      x = nx;
      y = ny;
      travelled += step;

      for (var i = 0; i < tanks.length; i++) {
        var tank = tanks[i];
        if (!tank || !tank.alive) continue;
        // 自己的子弹/激光不会打到自己，避免反弹自伤（也让 AI 的盲射不会自杀送分）
        if (tank === ignoreTank) continue;
        if (dist2(x, y, tank.x, tank.y) < (tank.r + hitRadius) * (tank.r + hitRadius)) {
          hitTank = tank;
          break;
        }
      }
      if (hitTank) break;
    }
    points.push({ x: x, y: y });
    return { points: points, hitTank: hitTank, bounces: bounces, end: { x: x, y: y } };
  }

  // ---------------- 坦克 ----------------
  function createTank(key, name, colorKey, x, y, angle) {
    var tank = {
      key: key,
      name: name,
      colorKey: colorKey,
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
        think: randRange(0.1, 0.3),
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

  function tanksList() {
    return [State.player].concat(State.ais);
  }

  function livingEnemies(tank) {
    var result = [];
    var list = tanksList();
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i] !== tank && list[i].alive) result.push(list[i]);
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
    var len = Math.sqrt(dirX * dirX + dirY * dirY);
    if (len < 0.0001) {
      tank.moving = false;
      tank.vx = 0;
      tank.vy = 0;
      return;
    }
    dirX /= len;
    dirY /= len;
    var dx = dirX * speed * dt;
    var dy = dirY * speed * dt;
    var moved = false;
    if (!circleHitsWall(State.map, tank.x + dx, tank.y, tank.r)) {
      tank.x += dx;
      moved = true;
    }
    if (!circleHitsWall(State.map, tank.x, tank.y + dy, tank.r)) {
      tank.y += dy;
      moved = true;
    }
    tank.moving = moved;
    tank.vx = moved ? dirX * speed : 0;
    tank.vy = moved ? dirY * speed : 0;
    if (moved) {
      tank.body = angleLerp(tank.body, Math.atan2(dirY, dirX), 14 * dt);
    }
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
  function spawnBullet(tank, angle, rapid) {
    if (!tank.alive || State.bullets.length >= MAX_BULLETS) return false;
    var speed = rapid ? RAPID_SPEED : BULLET_SPEED;
    var radius = rapid ? RAPID_RADIUS : BULLET_RADIUS;
    var bx = tank.x + Math.cos(angle) * (tank.r + 4);
    var by = tank.y + Math.sin(angle) * (tank.r + 4);
    State.bullets.push({
      x: bx,
      y: by,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: radius,
      owner: tank,
      life: rapid ? RAPID_LIFE : BULLET_LIFE,
      age: 0,
      bounces: 0,
      rapid: !!rapid
    });
    if (tank === State.player) State.stats.playerShots++;
    else State.stats.aiShots++;
    spawnParticle(bx, by, palette().player, 3, 40, 0.18);
    return true;
  }

  function updateBullets(dt) {
    var map = State.map;
    var bullets = State.bullets;
    for (var i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i];
      b.life -= dt;
      b.age += dt;
      if (b.life <= 0) {
        bullets.splice(i, 1);
        continue;
      }
      var speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1;
      var dx = b.vx / speed;
      var dy = b.vy / speed;
      var remaining = speed * dt;
      var dead = false;
      while (remaining > 0 && !dead) {
        var step = Math.min(6, remaining);
        remaining -= step;
        var nx = b.x + dx * step;
        var ny = b.y + dy * step;
        if (circleHitsWall(map, nx, ny, b.r)) {
          var hitX = circleHitsWall(map, nx, b.y, b.r);
          var hitY = circleHitsWall(map, b.x, ny, b.r);
          if (hitX && !hitY) dx = -dx;
          else if (hitY && !hitX) dy = -dy;
          else {
            dx = -dx;
            dy = -dy;
          }
          b.bounces++;
          spawnParticle(b.x, b.y, palette().wallTop, 2, 34, 0.22);
          b.vx = dx * speed;
          b.vy = dy * speed;
          continue;
        }
        b.x = nx;
        b.y = ny;
        // 命中坦克
        var list = tanksList();
        for (var t = 0; t < list.length; t++) {
          var tank = list[t];
          if (!tank || !tank.alive) continue;
          if (tank === b.owner) continue;
          var rr = tank.r + b.r;
          if (dist2(b.x, b.y, tank.x, tank.y) < rr * rr) {
            killTank(tank, b.owner);
            dead = true;
            break;
          }
        }
      }
      if (dead) {
        bullets.splice(i, 1);
        if (State.state !== 'playing') return;
      }
    }
  }

  // ---------------- 激光 ----------------
  function fireLaser(tank, angle) {
    var map = State.map;
    if (tank === State.player) State.stats.playerLaserShots++;
    else State.stats.aiLaserShots++;
    var trace = traceRay(map, tank.x, tank.y, angle, LASER_MAX_BOUNCE, 1500, tank, 2.5);
    State.lasers.push({
      points: trace.points,
      life: 0.32,
      maxLife: 0.32
    });
    spawnParticle(
      tank.x + Math.cos(angle) * (tank.r + 4),
      tank.y + Math.sin(angle) * (tank.r + 4),
      palette().laser,
      6,
      90,
      0.3
    );
    if (trace.hitTank) killTank(trace.hitTank, tank);
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
        State.mines.push({
          x: c.x,
          y: c.y,
          r: 7,
          owner: tank,
          arm: 0.7,
          life: 22,
          armed: false,
          phase: 0
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
    var pal = palette();
    State.stats.mineExplosions++;
    for (var i = 0; i < 22; i++) {
      spawnParticle(
        mine.x,
        mine.y,
        i % 2 ? pal.danger : '#ffb74d',
        randRange(40, 180),
        randRange(30, 150),
        randRange(0.3, 0.7)
      );
    }
    var list = tanksList();
    for (var t = 0; t < list.length; t++) {
      var tank = list[t];
      // 地雷只伤害敌人，布雷者本人不会踩到自己的雷
      if (tank && tank.alive && tank !== mine.owner && dist(tank.x, tank.y, mine.x, mine.y) < 44) {
        killTank(tank, mine.owner);
        return;
      }
    }
  }

  function updateMines(dt) {
    var list = State.mines;
    for (var i = list.length - 1; i >= 0; i--) {
      var mine = list[i];
      mine.life -= dt;
      mine.phase += dt;
      if (mine.life <= 0) {
        list.splice(i, 1);
        continue;
      }
      if (!mine.armed) {
        mine.arm -= dt;
        if (mine.arm <= 0) mine.armed = true;
        continue;
      }
      var listTanks = tanksList();
      for (var t = 0; t < listTanks.length; t++) {
        var tank = listTanks[t];
        if (!tank || !tank.alive || tank === mine.owner) continue;
        if (dist(tank.x, tank.y, mine.x, mine.y) < 15) {
          explodeMine(mine);
          list.splice(i, 1);
          return;
        }
      }
    }
  }

  // ---------------- 道具 ----------------
  function spawnPowerup(type, x, y) {
    State.powerups.push({
      type: type,
      x: x,
      y: y,
      r: 11,
      life: 24,
      phase: rand() * Math.PI * 2
    });
    State.stats.powerupsSpawned++;
  }

  function randomPowerupSpot(map, avoidTanks) {
    for (var attempt = 0; attempt < 60; attempt++) {
      var cx = Math.floor(rand() * CFG.cellCols);
      var cy = Math.floor(rand() * CFG.cellRows);
      var pos = cellToWorld(cx, cy);
      if (!spotIsFree(map, pos.x, pos.y, 14)) continue;
      var ok = true;
      if (avoidTanks) {
        var list = tanksList();
        for (var i = 0; i < list.length; i++) {
          if (list[i] && list[i].alive && dist(list[i].x, list[i].y, pos.x, pos.y) < 90) {
            ok = false;
            break;
          }
        }
      }
      for (var p = 0; p < State.powerups.length; p++) {
        if (dist(State.powerups[p].x, State.powerups[p].y, pos.x, pos.y) < 80) {
          ok = false;
          break;
        }
      }
      if (ok) return pos;
    }
    return null;
  }

  function applyPowerup(tank, type) {
    if (!tank || !tank.alive) return;
    if (type === 'mine') {
      tank.mines = Math.min(3, tank.mines + 2);
    } else if (type === 'laser') {
      tank.laserCharges = 1;
    } else if (type === 'rapid') {
      tank.rapidUntil = Math.max(tank.rapidUntil, gameTime) + 5;
    }
    if (tank === State.player) {
      var labels = { mine: '获得地雷 ×2（E / 右键放置）', laser: '获得激光（下一次射击）', rapid: '获得速射子弹 5 秒' };
      showMessage(labels[type] || '获得道具', 1.4);
    }
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
      State.powerSpawnTimer = randRange(5, 8);
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
    if (!canFire(tank)) return false;
    var pal = palette();
    var fireAngle = angle == null ? tank.turret : angle;
    if (tank.laserCharges > 0) {
      tank.laserCharges--;
      fireLaser(tank, fireAngle);
      tank.fireCd = 0.9;
    } else {
      var rapid = tank.rapidUntil > gameTime;
      spawnBullet(tank, fireAngle, rapid);
      if (tank.ai) {
        // AI 的射击间隔故意留余量，避免"枪枪锁头"
        tank.fireCd = rapid ? randRange(0.26, 0.4) : randRange(1.05, 1.75);
      } else {
        tank.fireCd = rapid ? RAPID_INTERVAL : FIRE_INTERVAL;
      }
    }
    State.hudTimer = 0;
    return true;
  }

  // ---------------- 击杀 / 计分 ----------------
  function scoreOf(key) {
    return State.scores[key] || 0;
  }

  function pickOpponentAI(forTank) {
    var best = null;
    var bestScore = -1;
    for (var i = 0; i < State.ais.length; i++) {
      var ai = State.ais[i];
      if (!ai) continue;
      var s = scoreOf(ai.key);
      if (s > bestScore) {
        bestScore = s;
        best = ai;
      }
    }
    return best;
  }

  function killTank(tank, killer) {
    if (!tank || !tank.alive) return;
    tank.alive = false;
    tank.vx = 0;
    tank.vy = 0;
    var pal = palette();
    var color = tank.key === 'player' ? pal.player : tank.key === 'ai1' ? pal.ai1 : pal.ai2;
    for (var i = 0; i < 26; i++) {
      spawnParticle(tank.x, tank.y, i % 3 ? color : '#ffb74d', randRange(50, 200), randRange(40, 160), randRange(0.35, 0.8));
    }

    var scorer = killer;
    if (!scorer || scorer === tank || !scorer.key) {
      scorer = tank.key === 'player' ? pickOpponentAI(tank) : State.player;
    }
    if (scorer && scorer.key) {
      State.scores[scorer.key] = scoreOf(scorer.key) + 1;
    }

    var victimName = tank.key === 'player' ? '玩家' : tank.name;
    var killerName = scorer ? (scorer.key === 'player' ? '玩家' : scorer.name) : '未知';
    var text;
    if (tank.key === 'player') text = '你被击毁了';
    else text = '击毁 ' + victimName;
    State.killInfo = {
      text: text,
      sub: killerName + ' +1 分'
    };
    State.state = 'roundEnd';
    State.roundTimer = 1.9;
    State.hudTimer = 0;

    var winner = null;
    if (scoreOf('player') >= CFG.targetScore) winner = 'player';
    else {
      for (var a = 0; a < State.ais.length; a++) {
        if (State.ais[a] && scoreOf(State.ais[a].key) >= CFG.targetScore) {
          winner = State.ais[a].key;
          break;
        }
      }
    }
    if (winner) {
      State.matchWinner = winner;
      State.freezeTimer = 2.4;
    }
  }

  // ---------------- AI ----------------
  function cellCenter(cx, cy) {
    return cellToWorld(cx, cy);
  }

  function passageOpen(map, cx, cy, dx, dy) {
    var tx = cx * 2 + 1 + dx;
    var ty = cy * 2 + 1 + dy;
    return !tileIsWall(map, tx, ty);
  }

  // A* 在迷宫单元图上寻路
  function findPath(map, fromX, fromY, toX, toY) {
    var start = worldToCell(fromX, fromY);
    var goal = worldToCell(toX, toY);
    var cw = CFG.cellCols;
    var ch = CFG.cellRows;
    var sk = start.cy * cw + start.cx;
    var gk = goal.cy * cw + goal.cx;
    if (sk === gk) return [];

    var open = [];
    var gScore = {};
    var came = {};
    var closed = {};
    gScore[sk] = 0;
    open.push({ key: sk, cx: start.cx, cy: start.cy, f: 0 });

    var dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    var guard = 0;
    while (open.length && guard < 800) {
      guard++;
      // 取 f 最小的节点
      var bestIdx = 0;
      for (var i = 1; i < open.length; i++) {
        if (open[i].f < open[bestIdx].f) bestIdx = i;
      }
      var current = open.splice(bestIdx, 1)[0];
      if (current.key === gk) {
        // 回溯
        var path = [];
        var k = current.key;
        while (k !== undefined && k !== sk) {
          var cx2 = k % cw;
          var cy2 = Math.floor(k / cw);
          path.push(cellCenter(cx2, cy2));
          k = came[k];
        }
        path.reverse();
        return path;
      }
      if (closed[current.key]) continue;
      closed[current.key] = true;

      for (var d = 0; d < dirs.length; d++) {
        var nx = current.cx + dirs[d][0];
        var ny = current.cy + dirs[d][1];
        if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
        if (!passageOpen(map, current.cx, current.cy, dirs[d][0], dirs[d][1])) continue;
        var nk = ny * cw + nx;
        if (closed[nk]) continue;
        var tentative = gScore[current.key] + 1;
        if (gScore[nk] !== undefined && tentative >= gScore[nk]) continue;
        gScore[nk] = tentative;
        came[nk] = current.key;
        var h = Math.abs(nx - goal.cx) + Math.abs(ny - goal.cy);
        open.push({ key: nk, cx: nx, cy: ny, f: tentative + h });
      }
    }
    return [];
  }

  function predictiveAngle(tank, target) {
    var d = dist(tank.x, tank.y, target.x, target.y);
    var flight = d / BULLET_SPEED;
    var lead = 0.75;
    var px = target.x + target.vx * flight * lead;
    var py = target.y + target.vy * flight * lead;
    return Math.atan2(py - tank.y, px - tank.x) + tank.ai.aimError;
  }

  // 无视线时尝试找一/二次反弹的可行角度（AI 的"高难度"表现）
  function findBankShot(tank, target) {
    var base = Math.atan2(target.y - tank.y, target.x - tank.x);
    for (var i = -8; i <= 8; i++) {
      var angle = base + i * (Math.PI / 24);
      var trace = traceRay(State.map, tank.x, tank.y, angle, 2, 720, tank, 9);
      if (trace.hitTank === target) return angle;
    }
    return null;
  }

  // AI 选目标：有一定概率优先追玩家，避免两个 AI 全程互相打而忽略玩家
  function chooseAITarget(tank) {
    var enemies = livingEnemies(tank);
    if (!enemies.length) return null;
    var player = State.player;
    if (player && player.alive && Math.random() < 0.65) return player;
    var best = enemies[0];
    var bestD = dist2(tank.x, tank.y, best.x, best.y);
    for (var i = 1; i < enemies.length; i++) {
      var d = dist2(tank.x, tank.y, enemies[i].x, enemies[i].y);
      if (d < bestD) {
        bestD = d;
        best = enemies[i];
      }
    }
    return best;
  }

  function updateAI(tank, dt) {
    var ai = tank.ai;
    if (!tank.alive) return;
    ai.think -= dt;
    ai.pathTimer -= dt;
    ai.dodgeCd -= dt;
    ai.mineCd -= dt;
    ai.bankCd -= dt;
    ai.blindCd -= dt;
    ai.targetTimer -= dt;

    if (!ai.targetTank || !ai.targetTank.alive || ai.targetTimer <= 0) {
      ai.targetTank = chooseAITarget(tank);
      ai.targetTimer = randRange(2.6, 4.6);
      ai.targetKey = ai.targetTank ? ai.targetTank.key : null;
    }
    var target = ai.targetTank;
    if (!target) return;

    // 定期重新决策：选目标 / 追道具 / 重新寻路
    if (ai.think <= 0) {
      ai.think = randRange(0.22, 0.42);
      State.stats.aiDecisions++;
      ai.aimError = randRange(-0.1, 0.1);

      var wantPowerup = null;
      var nearestPowerD = Infinity;
      for (var p = 0; p < State.powerups.length; p++) {
        var pu = State.powerups[p];
        var pd = dist(tank.x, tank.y, pu.x, pu.y);
        if (pd < nearestPowerD) {
          nearestPowerD = pd;
          wantPowerup = pu;
        }
      }
      var chasePowerup = wantPowerup && nearestPowerD < 300 && rand() < 0.45;
      var goalX = chasePowerup ? wantPowerup.x : target.x;
      var goalY = chasePowerup ? wantPowerup.y : target.y;

      // 被追得太近时偶尔后撤，避免贴脸送人头
      var dTarget = dist(tank.x, tank.y, target.x, target.y);
      if (dTarget < 70 && rand() < 0.25) {
        goalX = tank.x - (target.x - tank.x);
        goalY = tank.y - (target.y - tank.y);
      }

      ai.path = findPath(State.map, tank.x, tank.y, goalX, goalY);
      ai.pathTimer = randRange(0.6, 1.1);
      ai.pauseTimer = rand() < 0.08 ? randRange(0.1, 0.25) : 0;
    }

    if (ai.pathTimer <= 0) {
      ai.pathTimer = randRange(0.6, 1.0);
      ai.path = findPath(State.map, tank.x, tank.y, target.x, target.y);
    }

    var moveX = 0;
    var moveY = 0;
    if (ai.pauseTimer > 0) {
      ai.pauseTimer -= dt;
    } else if (ai.dodgeTimer > 0) {
      ai.dodgeTimer -= dt;
      moveX = ai.dodgeDir.x;
      moveY = ai.dodgeDir.y;
    } else if (ai.path.length) {
      var node = ai.path[0];
      var nd = dist(tank.x, tank.y, node.x, node.y);
      if (nd < 9) {
        ai.path.shift();
        if (!ai.path.length) {
          ai.path = findPath(State.map, tank.x, tank.y, target.x, target.y);
        }
      } else {
        moveX = (node.x - tank.x) / nd;
        moveY = (node.y - tank.y) / nd;
      }
    }

    // 卡住检测：几乎没动就抖动一下重新寻路
    var movedDist = dist(tank.x, tank.y, ai.lastX, ai.lastY);
    if (movedDist < 0.8 && (moveX || moveY)) {
      ai.stuckTimer += dt;
      if (ai.stuckTimer > 0.45) {
        ai.stuckTimer = 0;
        ai.path = findPath(State.map, tank.x, tank.y, target.x, target.y);
        ai.think = 0;
      }
    } else {
      ai.stuckTimer = 0;
    }
    ai.lastX = tank.x;
    ai.lastY = tank.y;

    moveTank(tank, moveX, moveY, tank.speed, dt);

    // 瞄准：有视线时预判，无视线时尝试反弹射击
    var los = hasLineOfSight(State.map, tank.x, tank.y, target.x, target.y);
    var aim = predictiveAngle(tank, target);
    tank.turret = angleLerp(tank.turret, aim, 4.5 * dt);

    if (tank.fireCd <= 0) {
      if (los) {
        if (Math.abs(angleDelta(tank.turret, aim)) < 0.16) {
          tryFire(tank, tank.turret + randRange(-0.05, 0.05));
        }
      } else if (ai.bankCd <= 0) {
        ai.bankCd = randRange(0.9, 1.6);
        var bankAngle = findBankShot(tank, target);
        if (bankAngle !== null) {
          tank.turret = bankAngle;
          tryFire(tank, bankAngle);
        }
        // 盲射骚扰：没有视线时朝预判方向打一发，靠迷宫反弹碰运气
        if (tank.fireCd <= 0 && ai.blindCd <= 0 && dist(tank.x, tank.y, target.x, target.y) < 520) {
          var blind = predictiveAngle(tank, target) + randRange(-0.22, 0.22);
          tank.turret = blind;
          tryFire(tank, blind);
          ai.blindCd = randRange(2.2, 3.4);
        }
      }
    }

    // 走位躲子弹
    if (ai.dodgeTimer <= 0 && ai.dodgeCd <= 0) {
      var threat = detectBulletThreat(tank);
      if (threat && rand() < 0.62) {
        ai.dodgeTimer = 0.32;
        ai.dodgeCd = 0.9;
        // 垂直于子弹方向侧移
        var perp = { x: -threat.vy, y: threat.vx };
        var plen = Math.sqrt(perp.x * perp.x + perp.y * perp.y) || 1;
        perp.x /= plen;
        perp.y /= plen;
        // 选择远离子弹路径的一侧
        var cross = (tank.x - threat.x) * perp.x + (tank.y - threat.y) * perp.y;
        if (cross > 0) {
          perp.x = -perp.x;
          perp.y = -perp.y;
        }
        ai.dodgeDir = perp;
      }
    }

    // 附近有已布置的地雷也躲一下
    if (ai.dodgeTimer <= 0 && ai.dodgeCd <= 0) {
      for (var m = 0; m < State.mines.length; m++) {
        var mine = State.mines[m];
        if (mine.owner === tank) continue;
        var md = dist(tank.x, tank.y, mine.x, mine.y);
        if (mine.armed && md < 55) {
          ai.dodgeTimer = 0.3;
          ai.dodgeCd = 1.0;
          ai.dodgeDir = {
            x: (tank.x - mine.x) / (md || 1),
            y: (tank.y - mine.y) / (md || 1)
          };
          break;
        }
      }
    }

    // 有地雷时在追人路上布雷
    if (tank.mines > 0 && ai.mineCd <= 0 && dist(tank.x, tank.y, target.x, target.y) < 170 && rand() < dt * 0.9) {
      if (placeMine(tank)) ai.mineCd = 2.4;
    }
  }

  function detectBulletThreat(tank) {
    for (var i = 0; i < State.bullets.length; i++) {
      var b = State.bullets[i];
      if (b.owner === tank && b.bounces === 0) continue;
      var rx = b.x - tank.x;
      var ry = b.y - tank.y;
      var d2 = rx * rx + ry * ry;
      if (d2 > 150 * 150) continue;
      var rvx = b.vx;
      var rvy = b.vy;
      var v2 = rvx * rvx + rvy * rvy;
      if (v2 < 1) continue;
      var t = -(rx * rvx + ry * rvy) / v2;
      if (t < 0 || t > 0.65) continue;
      var closestX = rx + rvx * t;
      var closestY = ry + rvy * t;
      if (closestX * closestX + closestY * closestY < 34 * 34) return b;
    }
    return null;
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
    moveTank(player, dirX, dirY, player.speed, dt);

    var autoTarget = playerAimTarget();
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
    var idx = Math.floor(rand() * mapPool.length);
    if (mapPool.length > 1 && idx === State.lastMapIndex) {
      idx = (idx + 1 + Math.floor(rand() * (mapPool.length - 1))) % mapPool.length;
    }
    State.lastMapIndex = idx;
    return { map: mapPool[idx], index: idx };
  }

  function startRound() {
    var chosen = chooseMap();
    State.map = chosen.map;
    State.mapIndex = chosen.index;
    State.state = 'countdown';
    State.roundTimer = 1.15;
    State.killInfo = null;
    State.message = null;
    State.messageTimer = 0;
    State.bullets.length = 0;
    State.mines.length = 0;
    State.powerups.length = 0;
    State.particles.length = 0;
    State.lasers.length = 0;
    State.powerSpawnTimer = randRange(2.2, 3.4);
    State.stats.rounds++;

    var spawns = State.map.spawns;
    var center = { x: W / 2, y: H / 2 };
    function faceTo(spawn) {
      return Math.atan2(center.y - spawn.y, center.x - spawn.x);
    }
    State.player = createTank('player', '玩家', 'player', spawns[0].x, spawns[0].y, faceTo(spawns[0]));
    State.ais = [
      createTank('ai1', 'AI-1', 'ai1', spawns[1].x, spawns[1].y, faceTo(spawns[1])),
      createTank('ai2', 'AI-2', 'ai2', spawns[2].x, spawns[2].y, faceTo(spawns[2]))
    ];
    State.aim.has = false;
    State.input.firing = false;
    bakeMap();
    updateHud(true);
  }

  function startMatch() {
    if (!State.ready) return;
    State.scores = { player: 0, ai1: 0, ai2: 0 };
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
      updatePlayer(dt);
      for (var i = 0; i < State.ais.length; i++) {
        updateAI(State.ais[i], dt);
      }
      separateTanks();
      updateBullets(dt);
      if (State.state === 'playing') updateMines(dt);
      if (State.state === 'playing') updatePowerups(dt);

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

  function updateHud(force) {
    if (!hudEls) return;
    setText(hudEls.playerScore, String(scoreOf('player')));
    setText(hudEls.ai1Score, String(scoreOf('ai1')));
    setText(hudEls.ai2Score, String(scoreOf('ai2')));
    setText(hudEls.round, '第 ' + State.round + ' 回合');
    var power = '无道具';
    var player = State.player;
    if (player && player.alive) {
      if (player.laserCharges > 0) power = '激光就绪（射击时发射）';
      else if (player.rapidUntil > gameTime) power = '速射子弹 ' + Math.ceil(player.rapidUntil - gameTime) + 's';
      else if (player.mines > 0) power = '地雷 ×' + player.mines + '（E / 右键）';
    }
    setText(hudEls.power, power);
  }

  function hideOverlay() {
    if (overlayEl) overlayEl.classList.add('is-hidden');
  }

  function showStartOverlay() {
    if (!overlayEl) return;
    overlayEl.classList.remove('is-hidden');
    setText(overlayTitle, '坦克动荡');
    setText(
      overlayDesc,
      '俯视迷宫坦克对战 · 子弹撞墙反弹 · 一炮淘汰 · 先到 5 分获胜'
    );
    setText(startBtn, '开始对局');
    startBtn.dataset.mode = 'start';
  }

  function showMatchEndOverlay() {
    if (!overlayEl) return;
    var win = State.matchWinner === 'player';
    overlayEl.classList.remove('is-hidden');
    setText(overlayTitle, win ? '你赢了！' : '憾负');
    var ai1 = scoreOf('ai1');
    var ai2 = scoreOf('ai2');
    setText(overlayDesc, '最终比分 — 玩家 ' + scoreOf('player') + ' : AI-1 ' + ai1 + ' : AI-2 ' + ai2);
    setText(startBtn, '再来一局');
    startBtn.dataset.mode = 'restart';
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
    var main = tank.key === 'player' ? pal.player : tank.key === 'ai1' ? pal.ai1 : pal.ai2;
    var dark = tank.key === 'player' ? pal.playerDark : tank.key === 'ai1' ? pal.ai1Dark : pal.ai2Dark;
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
    var pal = palette();
    var colors = { mine: '#ffb300', laser: pal.laser, rapid: pal.rapid };
    var color = colors[p.type] || pal.player;
    var bob = Math.sin(p.phase) * 2;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.fillStyle = pal.powerBg;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    if (p.type === 'mine') {
      ctx.beginPath();
      ctx.arc(0, 0, 4.2, 0, Math.PI * 2);
      ctx.fill();
      for (var i = 0; i < 6; i++) {
        var a = (Math.PI * 2 * i) / 6 + p.phase * 0.5;
        ctx.save();
        ctx.rotate(a);
        ctx.fillRect(5, -1, 3.4, 2);
        ctx.restore();
      }
    } else if (p.type === 'laser') {
      ctx.beginPath();
      ctx.moveTo(-2.5, -6);
      ctx.lineTo(2.5, -1);
      ctx.lineTo(-0.5, -1);
      ctx.lineTo(2.5, 6);
      ctx.lineTo(-2.5, 0.5);
      ctx.lineTo(0.8, 0.5);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(-3.4, 0, 2.1, 0, Math.PI * 2);
      ctx.arc(0, 0, 2.1, 0, Math.PI * 2);
      ctx.arc(3.4, 0, 2.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMine(mine) {
    var pal = palette();
    ctx.save();
    ctx.translate(mine.x, mine.y);
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
      ctx.fillStyle = pal.bullet;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 激光
    for (i = 0; i < State.lasers.length; i++) {
      var laser = State.lasers[i];
      var alpha = laser.life / laser.maxLife;
      ctx.strokeStyle = pal.laser;
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
    update(dt);
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
    State.lastTime = 0;
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
    stopLoop();
  }

  function resume() {
    if (!initialized || !State.active) return;
    if (State.state === 'idle') {
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
      if (!isActivePanel() || stopTyping(e)) return;
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
      playerScore: panel.querySelector('#tk-score-player'),
      ai1Score: panel.querySelector('#tk-score-ai1'),
      ai2Score: panel.querySelector('#tk-score-ai2'),
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

    mapPool = buildMapPool();
    State.ready = true;
    State.state = 'idle';
    State.map = mapPool[Math.floor(Math.random() * mapPool.length)];

    bindInput();
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
      showStartOverlay();
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
        alive: t.alive,
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
      scores: { player: scoreOf('player'), ai1: scoreOf('ai1'), ai2: scoreOf('ai2') },
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
    __test: {
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
