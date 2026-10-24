// littleGame 页面编排：Tab 切换 + 按需初始化 + 扫雷/五子棋逻辑。
// 性能要点：
// 1. 2048 在 DOMContentLoaded 时立即初始化（默认面板），其余游戏首次点击 tab 才初始化；
// 2. 坦克脚本（tank.js）只在首次点击"坦克动荡" tab 时动态注入，并显示 loading 态；
// 3. 扫雷翻开只更新变化的格子（不再全量 sync）；
// 4. 五子棋只增量更新落子格，AI 只评估已有棋子附近的候选点；
// 5. 切走 tab / 页面隐藏时暂停各自的计时器与循环，状态保留。
(function() {
  'use strict';

  if (window.__lgOrchestrator) return; // 防止 pjax 重复初始化

  var perf = (window.__lgPerf = window.__lgPerf || { init: {}, tabs: [] });
  var SCRIPT_SRC = (document.currentScript && document.currentScript.src) || '';
  var SCRIPT_BASE = SCRIPT_SRC
    ? SCRIPT_SRC.replace(/extra-games\.js.*$/, '')
    : '/scripts/littleGame/';

  var root = null;
  var managers = {};
  var initialized = {};
  var activeGame = null;
  var loadingEls = {};

  function now() {
    return window.performance && performance.now ? performance.now() : Date.now();
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getPanel(name) {
    return root ? root.querySelector('.lg-game-panel[data-game="' + name + '"]') : null;
  }

  function setLoading(name, text) {
    var panel = getPanel(name);
    if (!panel) return;
    var el = loadingEls[name];
    if (!el) {
      el = document.createElement('div');
      el.className = 'lg-loading';
      panel.appendChild(el);
      loadingEls[name] = el;
    }
    el.textContent = text || '加载中…';
    panel.classList.add('is-loading');
  }

  function clearLoading(name) {
    var panel = getPanel(name);
    var el = loadingEls[name];
    if (el && el.parentNode) el.parentNode.removeChild(el);
    delete loadingEls[name];
    if (panel) panel.classList.remove('is-loading');
  }

  function showError(name, message) {
    var panel = getPanel(name);
    if (!panel) return;
    var el = loadingEls[name];
    if (!el) {
      el = document.createElement('div');
      el.className = 'lg-loading lg-loading-error';
      panel.appendChild(el);
      loadingEls[name] = el;
    }
    el.textContent = message || '加载失败，请刷新页面重试';
    panel.classList.add('is-loading');
  }

  // ---------- 扫雷 ----------
  function initMinesweeper() {
    var panel = getPanel('minesweeper');
    if (!panel) return false;
    var sizeInput = panel.querySelector('#ms-size');
    var minesInput = panel.querySelector('#ms-mines');
    var startBtn = panel.querySelector('#ms-start');
    var resetBtn = panel.querySelector('#ms-reset');
    var statusEl = panel.querySelector('#ms-status');
    var boardEl = panel.querySelector('#ms-board');
    if (!sizeInput || !minesInput || !startBtn || !resetBtn || !boardEl) return false;

    var MIN_SIZE = 6;
    var MAX_SIZE = 20;
    var MIN_MINES = 1;
    var MAX_MINES = 200;
    var state = null;
    var cellEls = [];

    function normalizeInputs() {
      var size = clamp(parseInt(sizeInput.value || '10', 10), MIN_SIZE, MAX_SIZE);
      sizeInput.value = String(size);
      var maxForSize = Math.min(MAX_MINES, size * size - 1);
      minesInput.max = String(maxForSize);
      var mines = clamp(parseInt(minesInput.value || '10', 10), MIN_MINES, maxForSize);
      minesInput.value = String(mines);
      return { size: size, mines: mines };
    }

    function buildBoard(size, mines) {
      state = {
        size: size,
        mines: mines,
        revealed: 0,
        gameOver: false,
        board: []
      };
      var r;
      var c;
      for (r = 0; r < size; r++) {
        var row = [];
        for (c = 0; c < size; c++) {
          row.push({ mine: false, revealed: false, flagged: false, adjacent: 0 });
        }
        state.board.push(row);
      }
      var positions = {};
      var placed = 0;
      while (placed < mines) {
        var pos = Math.floor(Math.random() * size * size);
        if (positions[pos]) continue;
        positions[pos] = true;
        placed++;
        var pr = Math.floor(pos / size);
        var pc = pos % size;
        state.board[pr][pc].mine = true;
      }
      for (r = 0; r < size; r++) {
        for (c = 0; c < size; c++) {
          if (state.board[r][c].mine) continue;
          var count = 0;
          for (var dr = -1; dr <= 1; dr++) {
            for (var dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              var nr = r + dr;
              var nc = c + dc;
              if (nr >= 0 && nr < size && nc >= 0 && nc < size && state.board[nr][nc].mine) count++;
            }
          }
          state.board[r][c].adjacent = count;
        }
      }
    }

    function updateCellUI(btn, cell) {
      var cls = 'ms-cell';
      if (cell.revealed) cls += ' revealed';
      if (cell.flagged) cls += ' flagged';
      if (cell.revealed && cell.mine) cls += ' mine';
      if (btn.className !== cls) btn.className = cls;
      var text = '';
      if (cell.flagged && !cell.revealed) text = '旗';
      else if (cell.revealed) {
        if (cell.mine) text = '雷';
        else if (cell.adjacent > 0) text = String(cell.adjacent);
      }
      if (btn.textContent !== text) btn.textContent = text;
    }

    function renderBoard() {
      var size = state.size;
      var cellSize = clamp(Math.floor(520 / size), 22, 36);
      boardEl.style.setProperty('--ms-cols', String(size));
      boardEl.style.setProperty('--ms-cell-size', cellSize + 'px');
      boardEl.textContent = '';
      cellEls = [];
      var frag = document.createDocumentFragment();
      for (var r = 0; r < size; r++) {
        var rowEls = [];
        for (var c = 0; c < size; c++) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'ms-cell';
          btn.dataset.row = String(r);
          btn.dataset.col = String(c);
          updateCellUI(btn, state.board[r][c]);
          frag.appendChild(btn);
          rowEls.push(btn);
        }
        cellEls.push(rowEls);
      }
      boardEl.appendChild(frag);
    }

    // 只刷新变化的格子
    function updateCells(cells) {
      for (var i = 0; i < cells.length; i++) {
        var r = cells[i][0];
        var c = cells[i][1];
        var btn = cellEls[r] && cellEls[r][c];
        if (btn) updateCellUI(btn, state.board[r][c]);
      }
    }

    function revealCell(r, c) {
      if (!state || state.gameOver) return;
      var startCell = state.board[r][c];
      if (startCell.revealed || startCell.flagged) return;
      var changed = [];
      var queue = [[r, c]];
      var size = state.size;
      while (queue.length) {
        var item = queue.pop();
        var cr = item[0];
        var cc = item[1];
        var cell = state.board[cr][cc];
        if (cell.revealed || cell.flagged) continue;
        cell.revealed = true;
        state.revealed++;
        changed.push([cr, cc]);
        if (cell.mine) {
          state.gameOver = true;
          statusEl.textContent = '踩雷了，游戏结束';
          revealAllMines(changed);
          updateCells(changed);
          return;
        }
        if (cell.adjacent === 0) {
          for (var dr = -1; dr <= 1; dr++) {
            for (var dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              var nr = cr + dr;
              var nc = cc + dc;
              if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
              var ncell = state.board[nr][nc];
              if (!ncell.revealed && !ncell.flagged) queue.push([nr, nc]);
            }
          }
        }
      }
      updateCells(changed);
      if (state.revealed >= state.size * state.size - state.mines) {
        state.gameOver = true;
        statusEl.textContent = '胜利！已排除全部地雷';
      }
    }

    function revealAllMines(changed) {
      for (var r = 0; r < state.size; r++) {
        for (var c = 0; c < state.size; c++) {
          var cell = state.board[r][c];
          if (cell.mine && !cell.revealed) {
            cell.revealed = true;
            changed.push([r, c]);
          }
        }
      }
    }

    function toggleFlag(r, c) {
      if (!state || state.gameOver) return;
      var cell = state.board[r][c];
      if (cell.revealed) return;
      cell.flagged = !cell.flagged;
      updateCells([[r, c]]);
    }

    function startGame() {
      var conf = normalizeInputs();
      buildBoard(conf.size, conf.mines);
      renderBoard();
      statusEl.textContent = '游戏开始';
    }

    boardEl.addEventListener('click', function(e) {
      var target = e.target.closest ? e.target.closest('.ms-cell') : null;
      if (!target || !state) return;
      revealCell(parseInt(target.dataset.row, 10), parseInt(target.dataset.col, 10));
    });

    boardEl.addEventListener('contextmenu', function(e) {
      var target = e.target.closest ? e.target.closest('.ms-cell') : null;
      if (!target || !state) return;
      e.preventDefault();
      toggleFlag(parseInt(target.dataset.row, 10), parseInt(target.dataset.col, 10));
    });

    sizeInput.addEventListener('change', normalizeInputs);
    minesInput.addEventListener('change', normalizeInputs);
    startBtn.addEventListener('click', startGame);
    resetBtn.addEventListener('click', function() {
      sizeInput.value = '10';
      minesInput.value = '15';
      normalizeInputs();
      startGame();
    });

    normalizeInputs();
    startGame();
    managers.minesweeper = {
      activate: function() {},
      deactivate: function() {}
    };
    return true;
  }

  // ---------- 五子棋 ----------
  function initGomoku() {
    var panel = getPanel('gomoku');
    if (!panel) return false;
    var boardEl = panel.querySelector('#gm-board');
    var resetBtn = panel.querySelector('#gm-reset');
    var statusEl = panel.querySelector('#gm-status');
    if (!boardEl || !resetBtn || !statusEl) return false;

    var SIZE = 15;
    var EMPTY = 0;
    var BLACK = 1;
    var WHITE = 2;
    var DIRS4 = [[1, 0], [0, 1], [1, 1], [1, -1]];

    var board = [];
    var gameOver = false;
    var current = BLACK;
    var cellEls = [];
    var occupied = [];
    var aiTimer = null;
    var aiPending = false;

    function buildEmpty() {
      board = [];
      for (var r = 0; r < SIZE; r++) {
        var row = [];
        for (var c = 0; c < SIZE; c++) row.push(EMPTY);
        board.push(row);
      }
    }

    function initBoard() {
      buildEmpty();
      gameOver = false;
      current = BLACK;
      aiPending = false;
      if (aiTimer) {
        clearTimeout(aiTimer);
        aiTimer = null;
      }
      statusEl.textContent = '我方先手：黑子';
      // 重置时只清理已有棋子，不重建 225 个格子
      for (var i = 0; i < occupied.length; i++) {
        var pos = occupied[i];
        board[pos[0]][pos[1]] = EMPTY;
        var btn = cellEls[pos[0]] && cellEls[pos[0]][pos[1]];
        if (btn && btn.firstChild) btn.textContent = '';
      }
      occupied.length = 0;
    }

    function buildCells() {
      var cellSize = clamp(Math.floor(520 / SIZE), 24, 36);
      boardEl.style.setProperty('--gm-cols', String(SIZE));
      boardEl.style.setProperty('--gm-cell-size', cellSize + 'px');
      boardEl.textContent = '';
      cellEls = [];
      var frag = document.createDocumentFragment();
      for (var r = 0; r < SIZE; r++) {
        var rowEls = [];
        for (var c = 0; c < SIZE; c++) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'gm-cell';
          btn.dataset.row = String(r);
          btn.dataset.col = String(c);
          frag.appendChild(btn);
          rowEls.push(btn);
        }
        cellEls.push(rowEls);
      }
      boardEl.appendChild(frag);
    }

    // 单格增量更新
    function paintCell(r, c, player) {
      var btn = cellEls[r] && cellEls[r][c];
      if (!btn) return;
      if (player === EMPTY) {
        btn.textContent = '';
        return;
      }
      var piece = document.createElement('span');
      piece.className = 'gm-piece ' + (player === BLACK ? 'black' : 'white');
      btn.textContent = '';
      btn.appendChild(piece);
    }

    function place(r, c, player) {
      board[r][c] = player;
      occupied.push([r, c]);
      paintCell(r, c, player);
    }

    function checkWin(r, c, player) {
      for (var d = 0; d < DIRS4.length; d++) {
        var dr = DIRS4[d][0];
        var dc = DIRS4[d][1];
        var count = 1;
        var i = r + dr;
        var j = c + dc;
        while (i >= 0 && i < SIZE && j >= 0 && j < SIZE && board[i][j] === player) {
          count++;
          i += dr;
          j += dc;
        }
        i = r - dr;
        j = c - dc;
        while (i >= 0 && i < SIZE && j >= 0 && j < SIZE && board[i][j] === player) {
          count++;
          i -= dr;
          j -= dc;
        }
        if (count >= 5) return true;
      }
      return false;
    }

    function scorePattern(count, openEnds) {
      if (count >= 5) return 100000;
      if (count === 4 && openEnds === 2) return 10000;
      if (count === 4 && openEnds === 1) return 1200;
      if (count === 3 && openEnds === 2) return 300;
      if (count === 3 && openEnds === 1) return 60;
      if (count === 2 && openEnds === 2) return 30;
      if (count === 2 && openEnds === 1) return 8;
      return 2;
    }

    function lineScore(r, c, dr, dc, player) {
      var count = 1;
      var openEnds = 0;
      var i = r + dr;
      var j = c + dc;
      while (i >= 0 && i < SIZE && j >= 0 && j < SIZE && board[i][j] === player) {
        count++;
        i += dr;
        j += dc;
      }
      if (i >= 0 && i < SIZE && j >= 0 && j < SIZE && board[i][j] === EMPTY) openEnds++;
      i = r - dr;
      j = c - dc;
      while (i >= 0 && i < SIZE && j >= 0 && j < SIZE && board[i][j] === player) {
        count++;
        i -= dr;
        j -= dc;
      }
      if (i >= 0 && i < SIZE && j >= 0 && j < SIZE && board[i][j] === EMPTY) openEnds++;
      return scorePattern(count, openEnds);
    }

    function evaluatePoint(r, c, player) {
      var score = 0;
      for (var d = 0; d < DIRS4.length; d++) {
        score += lineScore(r, c, DIRS4[d][0], DIRS4[d][1], player);
      }
      return score;
    }

    // 只评估已有棋子周围 2 格内的空点，避免全盘 225 点扫描
    function buildCandidates() {
      var seen = {};
      var candidates = [];
      for (var i = 0; i < occupied.length; i++) {
        var r = occupied[i][0];
        var c = occupied[i][1];
        for (var dr = -2; dr <= 2; dr++) {
          for (var dc = -2; dc <= 2; dc++) {
            if (dr === 0 && dc === 0) continue;
            var nr = r + dr;
            var nc = c + dc;
            if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
            var key = nr * SIZE + nc;
            if (seen[key] || board[nr][nc] !== EMPTY) continue;
            seen[key] = true;
            candidates.push([nr, nc]);
          }
        }
      }
      if (!candidates.length) candidates.push([7, 7]);
      return candidates;
    }

    function aiMove() {
      aiTimer = null;
      aiPending = false;
      if (gameOver) return;
      var candidates = buildCandidates();
      var bestScore = -1;
      var bestMove = null;
      for (var i = 0; i < candidates.length; i++) {
        var r = candidates[i][0];
        var c = candidates[i][1];
        var aiScore = evaluatePoint(r, c, WHITE);
        var playerScore = evaluatePoint(r, c, BLACK);
        var score = Math.max(aiScore, playerScore * 0.9) + aiScore * 0.1 + Math.random() * 0.01;
        if (score > bestScore) {
          bestScore = score;
          bestMove = candidates[i];
        }
      }
      if (!bestMove) return;
      place(bestMove[0], bestMove[1], WHITE);
      if (checkWin(bestMove[0], bestMove[1], WHITE)) {
        gameOver = true;
        statusEl.textContent = '电脑获胜';
      } else {
        current = BLACK;
        statusEl.textContent = '轮到你了（黑子）';
      }
    }

    function scheduleAi() {
      if (aiTimer) clearTimeout(aiTimer);
      aiTimer = setTimeout(function() {
        aiTimer = null;
        // 面板不在前台时挂起，切回来再落子
        if (!isActiveGame('gomoku')) {
          aiPending = true;
          return;
        }
        aiMove();
      }, 200);
    }

    boardEl.addEventListener('click', function(e) {
      var target = e.target.closest ? e.target.closest('.gm-cell') : null;
      if (!target || gameOver || current !== BLACK) return;
      var r = parseInt(target.dataset.row, 10);
      var c = parseInt(target.dataset.col, 10);
      if (board[r][c] !== EMPTY) return;
      place(r, c, BLACK);
      if (checkWin(r, c, BLACK)) {
        gameOver = true;
        statusEl.textContent = '恭喜获胜';
        return;
      }
      current = WHITE;
      statusEl.textContent = '电脑思考中...';
      scheduleAi();
    });

    resetBtn.addEventListener('click', initBoard);

    buildCells();
    initBoard();
    managers.gomoku = {
      activate: function() {
        if (aiPending) scheduleAi();
      },
      deactivate: function() {
        if (aiTimer) {
          clearTimeout(aiTimer);
          aiTimer = null;
          aiPending = true;
        }
      }
    };
    return true;
  }

  // ---------- 坦克（懒加载） ----------
  var tankLoadPromise = null;
  var tankLoadStart = 0;

  function loadTankScript() {
    if (window.LittleTankTrouble) return Promise.resolve(true);
    if (tankLoadPromise) return tankLoadPromise;
    tankLoadStart = now();
    setLoading('tank', '正在加载坦克引擎…');
    tankLoadPromise = new Promise(function(resolve, reject) {
      var script = document.createElement('script');
      script.src = SCRIPT_BASE + 'tank.js';
      script.async = true;
      script.onload = function() {
        perf.tankLoadMs = Math.round((now() - tankLoadStart) * 100) / 100;
        resolve(true);
      };
      script.onerror = function() {
        tankLoadPromise = null;
        reject(new Error('tank.js 加载失败'));
      };
      document.body.appendChild(script);
    });
    return tankLoadPromise;
  }

  function loadTank() {
    return loadTankScript().then(function() {
      var panel = getPanel('tank');
      if (!panel || !window.LittleTankTrouble) throw new Error('坦克模块不可用');
      var start = now();
      window.LittleTankTrouble.init(panel);
      perf.init['tank'] = Math.round((now() - start) * 100) / 100;
      managers.tank = window.LittleTankTrouble;
      clearLoading('tank');
      return true;
    }).catch(function(err) {
      showError('tank', '坦克脚本加载失败：' + (err && err.message ? err.message : err));
      throw err;
    });
  }

  function isActiveGame(name) {
    return activeGame === name && !!root && root.getAttribute('data-active-game') === name;
  }

  function ensureInitialized(name) {
    if (initialized[name]) return Promise.resolve(true);
    if (name === '2048') {
      var ok2048 = !!(window.__lg2048 && window.__lg2048.init());
      if (!ok2048 && !window.__lg2048) {
        // 2048 脚本未加载时，避免整个页面失效
        return Promise.reject(new Error('2048 脚本未加载'));
      }
      managers['2048'] = window.__lg2048;
      initialized[name] = true;
      return Promise.resolve(true);
    }
    if (name === 'minesweeper') {
      if (!initMinesweeper()) return Promise.reject(new Error('扫雷面板缺失'));
      initialized[name] = true;
      return Promise.resolve(true);
    }
    if (name === 'gomoku') {
      if (!initGomoku()) return Promise.reject(new Error('五子棋面板缺失'));
      initialized[name] = true;
      return Promise.resolve(true);
    }
    if (name === 'tank') {
      return loadTank().then(function() {
        initialized[name] = true;
        return true;
      });
    }
    return Promise.resolve(false);
  }

  function setActiveClasses(name) {
    var tabs = root.querySelectorAll('.lg-tab-btn');
    for (var i = 0; i < tabs.length; i++) {
      var active = tabs[i].dataset.game === name;
      if (tabs[i].classList.contains('is-active') !== active) {
        tabs[i].classList.toggle('is-active', active);
      }
    }
    var panels = root.querySelectorAll('.lg-game-panel');
    for (var p = 0; p < panels.length; p++) {
      var panelActive = panels[p].dataset.game === name;
      if (panels[p].classList.contains('is-active') !== panelActive) {
        panels[p].classList.toggle('is-active', panelActive);
      }
    }
    root.setAttribute('data-active-game', name);
  }

  function switchTo(name, silent) {
    if (!root || !name) return Promise.resolve(false);
    if (name === activeGame && initialized[name]) return Promise.resolve(true);
    var started = now();
    var firstTime = !initialized[name];

    // 暂停上一个游戏
    if (activeGame && managers[activeGame] && managers[activeGame].deactivate) {
      try {
        managers[activeGame].deactivate();
      } catch (err) {
        /* 单个游戏暂停失败不影响切换 */
      }
    }

    setActiveClasses(name);
    activeGame = name;

    return ensureInitialized(name).then(function() {
      var manager = managers[name];
      if (manager && manager.activate) {
        try {
          manager.activate();
        } catch (err) {
          /* 激活失败时保留面板，交给用户重试 */
        }
      }
      if (!silent && firstTime) {
        perf.tabs.push({
          game: name,
          first: true,
          ms: Math.round((now() - started) * 100) / 100
        });
      }
      return true;
    });
  }

  function initTabs() {
    var tabs = root.querySelectorAll('.lg-tab-btn');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function(e) {
        var name = e.currentTarget.dataset.game;
        if (name) switchTo(name);
      });
    }
  }

  function bindPageLifecycle() {
    document.addEventListener('visibilitychange', function() {
      var manager = activeGame && managers[activeGame];
      if (!manager) return;
      if (document.hidden && manager.deactivate) manager.deactivate();
      else if (!document.hidden && manager.activate) manager.activate();
    });
    window.addEventListener('pagehide', function() {
      var manager = activeGame && managers[activeGame];
      if (manager && manager.deactivate) manager.deactivate();
    });
    window.addEventListener('pageshow', function() {
      var manager = activeGame && managers[activeGame];
      if (manager && manager.activate) manager.activate();
    });
  }

  function init() {
    root = document.getElementById('littleGame');
    if (!root) return;
    initTabs();
    bindPageLifecycle();
    var defaultTab = root.querySelector('.lg-tab-btn.is-active') || root.querySelector('.lg-tab-btn');
    if (defaultTab) switchTo(defaultTab.dataset.game, true);
  }

  window.__lgOrchestrator = {
    switchTo: switchTo,
    isInitialized: function(name) {
      return !!initialized[name];
    },
    getActiveGame: function() {
      return activeGame;
    },
    getMetrics: function() {
      return {
        init: perf.init,
        tabs: perf.tabs,
        tankLoadMs: perf.tankLoadMs || 0
      };
    }
  };
  window.__lgSwitchTo = switchTo;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
