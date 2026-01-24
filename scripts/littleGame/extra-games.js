// littleGame 页面：切换、扫雷、五子棋
(function() {
  'use strict';

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function initTabs(root) {
    const tabs = root.querySelectorAll('.lg-tab-btn');
    const panels = root.querySelectorAll('.lg-game-panel');

    function setActive(game) {
      tabs.forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.game === game);
      });
      panels.forEach(panel => {
        panel.classList.toggle('is-active', panel.dataset.game === game);
      });
      root.setAttribute('data-active-game', game);
    }

    tabs.forEach(btn => {
      btn.addEventListener('click', function() {
        setActive(btn.dataset.game);
      });
    });

    const defaultTab = root.querySelector('.lg-tab-btn.is-active') || tabs[0];
    if (defaultTab) {
      setActive(defaultTab.dataset.game);
    }
  }

  // 扫雷
  function initMinesweeper(root) {
    const sizeInput = root.querySelector('#ms-size');
    const minesInput = root.querySelector('#ms-mines');
    const startBtn = root.querySelector('#ms-start');
    const resetBtn = root.querySelector('#ms-reset');
    const statusEl = root.querySelector('#ms-status');
    const boardEl = root.querySelector('#ms-board');

    if (!sizeInput || !minesInput || !startBtn || !resetBtn || !boardEl) return;

    const MIN_SIZE = 6;
    const MAX_SIZE = 20;
    const MIN_MINES = 1;
    const MAX_MINES = 200;

    let msState = null;

    function normalizeInputs() {
      const size = clamp(parseInt(sizeInput.value || '10', 10), MIN_SIZE, MAX_SIZE);
      sizeInput.value = String(size);
      const maxForSize = Math.min(MAX_MINES, size * size - 1);
      minesInput.max = String(maxForSize);
      const mines = clamp(parseInt(minesInput.value || '10', 10), MIN_MINES, maxForSize);
      minesInput.value = String(mines);
      return { size, mines };
    }

    function buildBoard(size, mines) {
      msState = {
        size,
        mines,
        revealed: 0,
        gameOver: false,
        board: Array(size).fill(null).map(() =>
          Array(size).fill(null).map(() => ({
            mine: false,
            revealed: false,
            flagged: false,
            adjacent: 0
          }))
        )
      };

      const positions = new Set();
      while (positions.size < mines) {
        const pos = Math.floor(Math.random() * size * size);
        positions.add(pos);
      }
      positions.forEach(pos => {
        const r = Math.floor(pos / size);
        const c = pos % size;
        msState.board[r][c].mine = true;
      });

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (msState.board[r][c].mine) continue;
          let count = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const nr = r + dr;
              const nc = c + dc;
              if (nr >= 0 && nr < size && nc >= 0 && nc < size && msState.board[nr][nc].mine) {
                count++;
              }
            }
          }
          msState.board[r][c].adjacent = count;
        }
      }
    }

    function renderBoard() {
      const size = msState.size;
      const cellSize = clamp(Math.floor(520 / size), 22, 36);
      boardEl.style.setProperty('--ms-cols', String(size));
      boardEl.style.setProperty('--ms-cell-size', cellSize + 'px');
      boardEl.innerHTML = '';

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const cellBtn = document.createElement('button');
          cellBtn.type = 'button';
          cellBtn.className = 'ms-cell';
          cellBtn.dataset.row = String(r);
          cellBtn.dataset.col = String(c);
          boardEl.appendChild(cellBtn);
          updateCellUI(cellBtn, msState.board[r][c]);
        }
      }
    }

    function updateCellUI(btn, cell) {
      btn.classList.toggle('revealed', cell.revealed);
      btn.classList.toggle('flagged', cell.flagged);
      btn.classList.toggle('mine', cell.revealed && cell.mine);
      btn.textContent = '';
      if (cell.flagged && !cell.revealed) {
        btn.textContent = '旗';
      }
      if (cell.revealed) {
        if (cell.mine) {
          btn.textContent = '雷';
        } else if (cell.adjacent > 0) {
          btn.textContent = String(cell.adjacent);
        }
      }
    }

    function revealCell(r, c) {
      const cell = msState.board[r][c];
      if (cell.revealed || cell.flagged || msState.gameOver) return;
      cell.revealed = true;
      msState.revealed++;
      if (cell.mine) {
        msState.gameOver = true;
        statusEl.textContent = '踩雷了，游戏结束';
        revealAllMines();
        return;
      }

      if (cell.adjacent === 0) {
        const queue = [[r, c]];
        while (queue.length) {
          const [cr, cc] = queue.shift();
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = cr + dr;
              const nc = cc + dc;
              if (nr < 0 || nr >= msState.size || nc < 0 || nc >= msState.size) continue;
              const ncell = msState.board[nr][nc];
              if (ncell.revealed || ncell.flagged) continue;
              ncell.revealed = true;
              msState.revealed++;
              if (ncell.adjacent === 0 && !ncell.mine) {
                queue.push([nr, nc]);
              }
            }
          }
        }
      }

      if (msState.revealed >= msState.size * msState.size - msState.mines) {
        msState.gameOver = true;
        statusEl.textContent = '胜利！已排除全部地雷';
      }
    }

    function revealAllMines() {
      for (let r = 0; r < msState.size; r++) {
        for (let c = 0; c < msState.size; c++) {
          const cell = msState.board[r][c];
          if (cell.mine) {
            cell.revealed = true;
          }
        }
      }
      syncBoardUI();
    }

    function toggleFlag(r, c) {
      const cell = msState.board[r][c];
      if (cell.revealed || msState.gameOver) return;
      cell.flagged = !cell.flagged;
    }

    function syncBoardUI() {
      const buttons = boardEl.querySelectorAll('.ms-cell');
      buttons.forEach(btn => {
        const r = parseInt(btn.dataset.row, 10);
        const c = parseInt(btn.dataset.col, 10);
        updateCellUI(btn, msState.board[r][c]);
      });
    }

    function startGame() {
      const { size, mines } = normalizeInputs();
      buildBoard(size, mines);
      renderBoard();
      statusEl.textContent = '游戏开始';
    }

    boardEl.addEventListener('click', function(e) {
      const target = e.target;
      if (!target.classList.contains('ms-cell') || !msState) return;
      const r = parseInt(target.dataset.row, 10);
      const c = parseInt(target.dataset.col, 10);
      revealCell(r, c);
      syncBoardUI();
    });

    boardEl.addEventListener('contextmenu', function(e) {
      const target = e.target;
      if (!target.classList.contains('ms-cell') || !msState) return;
      e.preventDefault();
      const r = parseInt(target.dataset.row, 10);
      const c = parseInt(target.dataset.col, 10);
      toggleFlag(r, c);
      syncBoardUI();
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
  }

  // 五子棋
  function initGomoku(root) {
    const boardEl = root.querySelector('#gm-board');
    const resetBtn = root.querySelector('#gm-reset');
    const statusEl = root.querySelector('#gm-status');

    if (!boardEl || !resetBtn || !statusEl) return;

    const SIZE = 15;
    const EMPTY = 0;
    const BLACK = 1;
    const WHITE = 2;

    let board = [];
    let gameOver = false;
    let current = BLACK;

    function initBoard() {
      board = Array(SIZE).fill(null).map(() => Array(SIZE).fill(EMPTY));
      gameOver = false;
      current = BLACK;
      statusEl.textContent = '我方先手：黑子';
      renderBoard();
    }

    function renderBoard() {
      const cellSize = clamp(Math.floor(520 / SIZE), 24, 36);
      boardEl.style.setProperty('--gm-cols', String(SIZE));
      boardEl.style.setProperty('--gm-cell-size', cellSize + 'px');
      boardEl.innerHTML = '';

      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          const cellBtn = document.createElement('button');
          cellBtn.type = 'button';
          cellBtn.className = 'gm-cell';
          cellBtn.dataset.row = String(r);
          cellBtn.dataset.col = String(c);
          if (board[r][c] !== EMPTY) {
            const piece = document.createElement('span');
            piece.className = 'gm-piece ' + (board[r][c] === BLACK ? 'black' : 'white');
            cellBtn.appendChild(piece);
          }
          boardEl.appendChild(cellBtn);
        }
      }
    }

    function checkWin(r, c, player) {
      const dirs = [
        [1, 0],
        [0, 1],
        [1, 1],
        [1, -1]
      ];
      return dirs.some(dir => {
        const [dr, dc] = dir;
        let count = 1;
        let i = r + dr;
        let j = c + dc;
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
        return count >= 5;
      });
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
      let count = 1;
      let openEnds = 0;
      let i = r + dr;
      let j = c + dc;
      while (i >= 0 && i < SIZE && j >= 0 && j < SIZE && board[i][j] === player) {
        count++;
        i += dr;
        j += dc;
      }
      if (i >= 0 && i < SIZE && j >= 0 && j < SIZE && board[i][j] === EMPTY) {
        openEnds++;
      }
      i = r - dr;
      j = c - dc;
      while (i >= 0 && i < SIZE && j >= 0 && j < SIZE && board[i][j] === player) {
        count++;
        i -= dr;
        j -= dc;
      }
      if (i >= 0 && i < SIZE && j >= 0 && j < SIZE && board[i][j] === EMPTY) {
        openEnds++;
      }
      return scorePattern(count, openEnds);
    }

    function evaluatePoint(r, c, player) {
      const dirs = [
        [1, 0],
        [0, 1],
        [1, 1],
        [1, -1]
      ];
      let score = 0;
      dirs.forEach(dir => {
        score += lineScore(r, c, dir[0], dir[1], player);
      });
      return score;
    }

    function aiMove() {
      let bestScore = -1;
      let bestMove = null;
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (board[r][c] !== EMPTY) continue;
          const aiScore = evaluatePoint(r, c, WHITE);
          const playerScore = evaluatePoint(r, c, BLACK);
          const score = Math.max(aiScore, playerScore * 0.9) + aiScore * 0.1;
          if (score > bestScore) {
            bestScore = score;
            bestMove = { r, c };
          }
        }
      }
      if (!bestMove) return;
      board[bestMove.r][bestMove.c] = WHITE;
      if (checkWin(bestMove.r, bestMove.c, WHITE)) {
        gameOver = true;
        statusEl.textContent = '电脑获胜';
      } else {
        statusEl.textContent = '轮到你了（黑子）';
      }
      renderBoard();
    }

    boardEl.addEventListener('click', function(e) {
      const target = e.target.closest('.gm-cell');
      if (!target || gameOver) return;
      const r = parseInt(target.dataset.row, 10);
      const c = parseInt(target.dataset.col, 10);
      if (board[r][c] !== EMPTY) return;
      if (current !== BLACK) return;
      board[r][c] = BLACK;
      renderBoard();
      if (checkWin(r, c, BLACK)) {
        gameOver = true;
        statusEl.textContent = '恭喜获胜';
        return;
      }
      current = WHITE;
      statusEl.textContent = '电脑思考中...';
      setTimeout(function() {
        aiMove();
        current = BLACK;
      }, 200);
    });

    resetBtn.addEventListener('click', initBoard);
    initBoard();
  }

  function init() {
    const root = document.getElementById('littleGame');
    if (!root) return;
    initTabs(root);
    initMinesweeper(root);
    initGomoku(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

