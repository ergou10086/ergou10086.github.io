// 2048 游戏逻辑（littleGame）
// 性能要点：默认页立即初始化；只保留 16 个 tile 元素做增量渲染；
// 键盘/触摸事件只在 2048 面板激活时响应，避免影响其他游戏。
(function() {
  'use strict';

  var root = null;
  var panel = null;
  var boardEl = null;
  var container = null;
  var tileEls = [];      // tileEls[row][col] 复用元素池
  var tileVals = [];     // 上次渲染的数值，用于跳过无变化的格子

  var perf = (window.__lgPerf = window.__lgPerf || { init: {}, tabs: [] });

  var Game = {
    grid: [],
    score: 0,
    best: 0,
    size: 4,
    won: false,
    over: false,
    initialized: false
  };

  function $(id) {
    return document.getElementById(id);
  }

  function now() {
    return window.performance && performance.now ? performance.now() : Date.now();
  }

  function readBest() {
    try {
      return parseInt(localStorage.getItem('2048-best'), 10) || 0;
    } catch (e) {
      return 0;
    }
  }

  function saveBest(value) {
    try {
      localStorage.setItem('2048-best', String(value));
    } catch (e) {
      /* 隐私模式下忽略 */
    }
  }

  function isActive() {
    return !!(panel && panel.classList.contains('is-active'));
  }

  function emptyGrid() {
    var grid = [];
    for (var i = 0; i < Game.size; i++) {
      var row = [];
      for (var j = 0; j < Game.size; j++) row.push(0);
      grid.push(row);
    }
    return grid;
  }

  function addRandomTile() {
    var emptyCells = [];
    for (var i = 0; i < Game.size; i++) {
      for (var j = 0; j < Game.size; j++) {
        if (Game.grid[i][j] === 0) emptyCells.push([i, j]);
      }
    }
    if (emptyCells.length === 0) return;
    var cell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    Game.grid[cell[0]][cell[1]] = Math.random() < 0.9 ? 2 : 4;
  }

  // 单行/列合并：line 已经按"移动方向"排好向，返回 { out, gained, moved }
  function slideLine(line) {
    var vals = [];
    var i;
    for (i = 0; i < line.length; i++) {
      if (line[i] !== 0) vals.push(line[i]);
    }
    var out = [];
    var gained = 0;
    for (i = 0; i < vals.length; i++) {
      if (i + 1 < vals.length && vals[i] === vals[i + 1]) {
        var merged = vals[i] * 2;
        out.push(merged);
        gained += merged;
        i++;
      } else {
        out.push(vals[i]);
      }
    }
    while (out.length < Game.size) out.push(0);
    var moved = false;
    for (i = 0; i < Game.size; i++) {
      if (out[i] !== line[i]) {
        moved = true;
        break;
      }
    }
    return { out: out, gained: gained, moved: moved };
  }

  var DIRS = {
    left: { reverse: false, vertical: false },
    right: { reverse: true, vertical: false },
    up: { reverse: false, vertical: true },
    down: { reverse: true, vertical: true }
  };

  function move(direction) {
    var conf = DIRS[direction];
    if (!conf || Game.over) return false;

    var moved = false;
    var gained = 0;

    for (var i = 0; i < Game.size; i++) {
      var line = [];
      for (var j = 0; j < Game.size; j++) {
        var r = conf.vertical ? j : i;
        var c = conf.vertical ? i : j;
        line.push(Game.grid[r][c]);
      }
      if (conf.reverse) line.reverse();
      var res = slideLine(line);
      if (res.moved) moved = true;
      gained += res.gained;
      if (conf.reverse) res.out.reverse();
      for (var k = 0; k < Game.size; k++) {
        var rr = conf.vertical ? k : i;
        var cc = conf.vertical ? i : k;
        Game.grid[rr][cc] = res.out[k];
      }
    }

    if (!moved) return false;

    Game.score += gained;
    addRandomTile();
    render();
    updateScore();

    if (!Game.won && checkWin()) {
      Game.won = true;
      showMessage('恭喜！你达到了 2048！');
    }
    if (checkGameOver()) {
      Game.over = true;
      showMessage('游戏结束！');
    }
    return true;
  }

  function checkWin() {
    for (var i = 0; i < Game.size; i++) {
      for (var j = 0; j < Game.size; j++) {
        if (Game.grid[i][j] === 2048) return true;
      }
    }
    return false;
  }

  function checkGameOver() {
    var i;
    var j;
    for (i = 0; i < Game.size; i++) {
      for (j = 0; j < Game.size; j++) {
        if (Game.grid[i][j] === 0) return false;
      }
    }
    for (i = 0; i < Game.size; i++) {
      for (j = 0; j < Game.size; j++) {
        var current = Game.grid[i][j];
        if (j < Game.size - 1 && Game.grid[i][j + 1] === current) return false;
        if (i < Game.size - 1 && Game.grid[i + 1][j] === current) return false;
      }
    }
    return true;
  }

  function updateScore() {
    var scoreEl = $('score');
    var bestEl = $('best');
    if (scoreEl && scoreEl.textContent !== String(Game.score)) {
      scoreEl.textContent = Game.score;
    }
    if (Game.score > Game.best) {
      Game.best = Game.score;
      saveBest(Game.best);
    }
    if (bestEl && bestEl.textContent !== String(Game.best)) {
      bestEl.textContent = Game.best;
    }
  }

  // 一次性建好 16 个 tile 元素，之后只改 class/textContent/display
  function buildTilePool() {
    if (tileEls.length || !container) return;
    for (var i = 0; i < Game.size; i++) {
      var rowEls = [];
      var rowVals = [];
      for (var j = 0; j < Game.size; j++) {
        var el = document.createElement('div');
        el.className = 'tile';
        el.style.gridRow = String(i + 1);
        el.style.gridColumn = String(j + 1);
        el.style.display = 'none';
        container.appendChild(el);
        rowEls.push(el);
        rowVals.push(0);
      }
      tileEls.push(rowEls);
      tileVals.push(rowVals);
    }
  }

  function render() {
    if (!container) return;
    buildTilePool();
    for (var i = 0; i < Game.size; i++) {
      for (var j = 0; j < Game.size; j++) {
        var value = Game.grid[i][j];
        var el = tileEls[i] && tileEls[i][j];
        if (!el) continue;
        if (value === tileVals[i][j]) continue;
        tileVals[i][j] = value;
        if (value === 0) {
          el.style.display = 'none';
          if (el.textContent !== '') el.textContent = '';
          el.className = 'tile';
        } else {
          el.className = 'tile tile-' + value;
          el.textContent = String(value);
          el.style.display = '';
        }
      }
    }
  }

  function showMessage(text) {
    var message = $('game-message');
    var messageText = $('message-text');
    if (!message || !messageText) return;
    messageText.textContent = text;
    message.classList.add('show');
  }

  function hideMessage() {
    var message = $('game-message');
    if (message) message.classList.remove('show');
  }

  function newGame() {
    Game.grid = emptyGrid();
    Game.score = 0;
    Game.won = false;
    Game.over = false;
    hideMessage();
    var scoreEl = $('score');
    if (scoreEl) scoreEl.textContent = '0';
    addRandomTile();
    addRandomTile();
    render();
    updateScore();
  }

  function stopIfTyping(e) {
    var target = e.target;
    if (!target) return false;
    var tag = (target.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
  }

  function bindEvents() {
    document.addEventListener('keydown', function(e) {
      if (!isActive() || stopIfTyping(e)) return;
      var handled = true;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          move('up');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          move('down');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          move('left');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          move('right');
          break;
        default:
          handled = false;
      }
      if (handled) e.preventDefault();
    });

    var newGameBtn = $('new-game');
    if (newGameBtn) newGameBtn.addEventListener('click', newGame);

    var restartBtn = $('restart-btn');
    if (restartBtn) {
      restartBtn.addEventListener('click', function() {
        hideMessage();
        newGame();
      });
    }

    // 触摸滑动只绑定在棋盘上，并且只在该面板激活时处理
    var touchStartX = 0;
    var touchStartY = 0;
    var touchActive = false;

    if (boardEl) {
      boardEl.addEventListener('touchstart', function(e) {
        if (!isActive() || !e.touches.length) return;
        touchActive = true;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }, { passive: true });

      boardEl.addEventListener('touchend', function(e) {
        if (!touchActive || !isActive()) return;
        touchActive = false;
        if (!e.changedTouches.length) return;
        var diffX = touchStartX - e.changedTouches[0].clientX;
        var diffY = touchStartY - e.changedTouches[0].clientY;
        if (Math.abs(diffX) > Math.abs(diffY)) {
          if (diffX > 30) move('left');
          else if (diffX < -30) move('right');
        } else {
          if (diffY > 30) move('up');
          else if (diffY < -30) move('down');
        }
      }, { passive: true });
    }
  }

  function init() {
    if (Game.initialized) return true;
    root = document.getElementById('littleGame');
    if (!root) return false;
    panel = root.querySelector('.lg-game-panel[data-game="2048"]');
    container = document.getElementById('tile-container');
    boardEl = panel && panel.querySelector('.game-board-container');
    if (!panel || !container) return false;

    var start = now();
    Game.grid = emptyGrid();
    Game.best = readBest();
    var bestEl = $('best');
    if (bestEl) bestEl.textContent = Game.best;

    addRandomTile();
    addRandomTile();
    render();
    updateScore();
    bindEvents();
    Game.initialized = true;
    perf.init['2048'] = Math.round((now() - start) * 100) / 100;
    return true;
  }

  function activate() {
    // 2048 没有循环/计时器，切回时无需额外处理
  }

  function deactivate() {
    // 同上
  }

  window.__lg2048 = {
    init: init,
    activate: activate,
    deactivate: deactivate,
    isInitialized: function() {
      return Game.initialized;
    },
    getState: function() {
      return { grid: Game.grid, score: Game.score, over: Game.over, won: Game.won };
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
