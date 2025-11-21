// 2048 游戏逻辑
(function() {
  'use strict';

  // 游戏状态
  const Game = {
    grid: [],
    score: 0,
    best: 0,
    size: 4,
    won: false,
    over: false
  };

  // 初始化游戏
  function init() {
    // 从localStorage加载最高分
    Game.best = parseInt(localStorage.getItem('2048-best')) || 0;
    document.getElementById('best').textContent = Game.best;

    // 初始化网格
    Game.grid = Array(Game.size).fill(null).map(() => Array(Game.size).fill(0));
    
    // 添加两个初始方块
    addRandomTile();
    addRandomTile();
    
    // 渲染游戏
    render();
    
    // 绑定事件
    bindEvents();
  }

  // 添加随机方块
  function addRandomTile() {
    const emptyCells = [];
    
    for (let i = 0; i < Game.size; i++) {
      for (let j = 0; j < Game.size; j++) {
        if (Game.grid[i][j] === 0) {
          emptyCells.push({row: i, col: j});
        }
      }
    }
    
    if (emptyCells.length > 0) {
      const cell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      Game.grid[cell.row][cell.col] = Math.random() < 0.9 ? 2 : 4;
    }
  }

  // 移动方向处理
  function move(direction) {
    if (Game.over) return false;

    let moved = false;
    const oldGrid = JSON.parse(JSON.stringify(Game.grid));

    switch(direction) {
      case 'up':
        moved = moveUp();
        break;
      case 'down':
        moved = moveDown();
        break;
      case 'left':
        moved = moveLeft();
        break;
      case 'right':
        moved = moveRight();
        break;
    }

    if (moved) {
      addRandomTile();
      render();
      
      if (checkWin() && !Game.won) {
        showMessage('恭喜！你达到了2048！');
        Game.won = true;
      }
      
      if (checkGameOver()) {
        showMessage('游戏结束！');
        Game.over = true;
      }
      
      return true;
    }
    
    return false;
  }

  // 向左移动
  function moveLeft() {
    let moved = false;
    
    for (let i = 0; i < Game.size; i++) {
      const row = Game.grid[i].filter(val => val !== 0);
      const newRow = [];
      let j = 0;
      
      while (j < row.length) {
        if (j < row.length - 1 && row[j] === row[j + 1]) {
          const mergedValue = row[j] * 2;
          newRow.push(mergedValue);
          Game.score += mergedValue;
          j += 2;
          moved = true;
        } else {
          newRow.push(row[j]);
          j++;
        }
      }
      
      while (newRow.length < Game.size) {
        newRow.push(0);
      }
      
      if (JSON.stringify(Game.grid[i]) !== JSON.stringify(newRow)) {
        moved = true;
      }
      
      Game.grid[i] = newRow;
    }
    
    updateScore();
    return moved;
  }

  // 向右移动
  function moveRight() {
    let moved = false;
    
    for (let i = 0; i < Game.size; i++) {
      const row = Game.grid[i].filter(val => val !== 0);
      const newRow = [];
      let j = row.length - 1;
      
      while (j >= 0) {
        if (j > 0 && row[j] === row[j - 1]) {
          const mergedValue = row[j] * 2;
          newRow.unshift(mergedValue);
          Game.score += mergedValue;
          j -= 2;
          moved = true;
        } else {
          newRow.unshift(row[j]);
          j--;
        }
      }
      
      while (newRow.length < Game.size) {
        newRow.unshift(0);
      }
      
      if (JSON.stringify(Game.grid[i]) !== JSON.stringify(newRow)) {
        moved = true;
      }
      
      Game.grid[i] = newRow;
    }
    
    updateScore();
    return moved;
  }

  // 向上移动
  function moveUp() {
    let moved = false;
    
    for (let j = 0; j < Game.size; j++) {
      const column = [];
      for (let i = 0; i < Game.size; i++) {
        if (Game.grid[i][j] !== 0) {
          column.push(Game.grid[i][j]);
        }
      }
      
      const newColumn = [];
      let i = 0;
      
      while (i < column.length) {
        if (i < column.length - 1 && column[i] === column[i + 1]) {
          const mergedValue = column[i] * 2;
          newColumn.push(mergedValue);
          Game.score += mergedValue;
          i += 2;
          moved = true;
        } else {
          newColumn.push(column[i]);
          i++;
        }
      }
      
      while (newColumn.length < Game.size) {
        newColumn.push(0);
      }
      
      for (let i = 0; i < Game.size; i++) {
        if (Game.grid[i][j] !== newColumn[i]) {
          moved = true;
        }
        Game.grid[i][j] = newColumn[i];
      }
    }
    
    updateScore();
    return moved;
  }

  // 向下移动
  function moveDown() {
    let moved = false;
    
    for (let j = 0; j < Game.size; j++) {
      const column = [];
      for (let i = 0; i < Game.size; i++) {
        if (Game.grid[i][j] !== 0) {
          column.push(Game.grid[i][j]);
        }
      }
      
      const newColumn = [];
      let i = column.length - 1;
      
      while (i >= 0) {
        if (i > 0 && column[i] === column[i - 1]) {
          const mergedValue = column[i] * 2;
          newColumn.unshift(mergedValue);
          Game.score += mergedValue;
          i -= 2;
          moved = true;
        } else {
          newColumn.unshift(column[i]);
          i--;
        }
      }
      
      while (newColumn.length < Game.size) {
        newColumn.unshift(0);
      }
      
      for (let i = 0; i < Game.size; i++) {
        if (Game.grid[i][j] !== newColumn[i]) {
          moved = true;
        }
        Game.grid[i][j] = newColumn[i];
      }
    }
    
    updateScore();
    return moved;
  }

  // 检查是否获胜
  function checkWin() {
    for (let i = 0; i < Game.size; i++) {
      for (let j = 0; j < Game.size; j++) {
        if (Game.grid[i][j] === 2048) {
          return true;
        }
      }
    }
    return false;
  }

  // 检查游戏是否结束
  function checkGameOver() {
    // 检查是否有空格
    for (let i = 0; i < Game.size; i++) {
      for (let j = 0; j < Game.size; j++) {
        if (Game.grid[i][j] === 0) {
          return false;
        }
      }
    }
    
    // 检查是否可以合并
    for (let i = 0; i < Game.size; i++) {
      for (let j = 0; j < Game.size; j++) {
        const current = Game.grid[i][j];
        
        // 检查右侧
        if (j < Game.size - 1 && Game.grid[i][j + 1] === current) {
          return false;
        }
        
        // 检查下方
        if (i < Game.size - 1 && Game.grid[i + 1][j] === current) {
          return false;
        }
      }
    }
    
    return true;
  }

  // 更新分数
  function updateScore() {
    document.getElementById('score').textContent = Game.score;
    
    if (Game.score > Game.best) {
      Game.best = Game.score;
      document.getElementById('best').textContent = Game.best;
      localStorage.setItem('2048-best', Game.best);
    }
  }

  // 渲染游戏
  function render() {
    const container = document.getElementById('tile-container');
    container.innerHTML = '';
    
    for (let i = 0; i < Game.size; i++) {
      for (let j = 0; j < Game.size; j++) {
        if (Game.grid[i][j] !== 0) {
          const tile = document.createElement('div');
          tile.className = `tile tile-${Game.grid[i][j]}`;
          tile.textContent = Game.grid[i][j];
          tile.style.gridRow = i + 1;
          tile.style.gridColumn = j + 1;
          container.appendChild(tile);
        }
      }
    }
  }

  // 显示消息
  function showMessage(text) {
    const message = document.getElementById('game-message');
    const messageText = document.getElementById('message-text');
    messageText.textContent = text;
    message.classList.add('show');
  }

  // 隐藏消息
  function hideMessage() {
    const message = document.getElementById('game-message');
    message.classList.remove('show');
  }

  // 新游戏
  function newGame() {
    Game.grid = Array(Game.size).fill(null).map(() => Array(Game.size).fill(0));
    Game.score = 0;
    Game.won = false;
    Game.over = false;
    
    document.getElementById('score').textContent = '0';
    hideMessage();
    
    addRandomTile();
    addRandomTile();
    render();
  }

  // 绑定事件
  function bindEvents() {
    // 键盘事件
    document.addEventListener('keydown', function(e) {
      if (!Game.over) {
        switch(e.key) {
          case 'ArrowUp':
          case 'w':
          case 'W':
            e.preventDefault();
            move('up');
            break;
          case 'ArrowDown':
          case 's':
          case 'S':
            e.preventDefault();
            move('down');
            break;
          case 'ArrowLeft':
          case 'a':
          case 'A':
            e.preventDefault();
            move('left');
            break;
          case 'ArrowRight':
          case 'd':
          case 'D':
            e.preventDefault();
            move('right');
            break;
        }
      }
    });

    // 新游戏按钮
    document.getElementById('new-game').addEventListener('click', newGame);
    
    // 重新开始按钮
    document.getElementById('restart-btn').addEventListener('click', function() {
      hideMessage();
      newGame();
    });

    // 触摸事件支持（移动端）
    let touchStartX = 0;
    let touchStartY = 0;
    
    document.addEventListener('touchstart', function(e) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    });
    
    document.addEventListener('touchend', function(e) {
      if (!touchStartX || !touchStartY) return;
      
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      
      const diffX = touchStartX - touchEndX;
      const diffY = touchStartY - touchEndY;
      
      if (Math.abs(diffX) > Math.abs(diffY)) {
        // 水平滑动
        if (diffX > 30) {
          move('left');
        } else if (diffX < -30) {
          move('right');
        }
      } else {
        // 垂直滑动
        if (diffY > 30) {
          move('up');
        } else if (diffY < -30) {
          move('down');
        }
      }
      
      touchStartX = 0;
      touchStartY = 0;
    });
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

