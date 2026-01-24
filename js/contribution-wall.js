/**
 * 文章发表绿墙 - 类似 GitHub 贡献绿墙
 */

(function() {
  'use strict';

  // 颜色级别：0, 1, 2, 3, 4, 5 篇文章对应不同深浅的绿色
  const colors = [
    '#ebedf0',  // 0篇 - 浅灰色（无文章）
    '#c6e48b',  // 1篇 - 浅绿色
    '#7bc96f',  // 2篇 - 中浅绿色
    '#239a3b',  // 3篇 - 中绿色
    '#196127',  // 4篇 - 深绿色
    '#0e4a1a'   // 5篇及以上 - 最深绿色
  ];

  // 获取日期字符串（YYYY-MM-DD）
  function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 获取一年前的日期到今天的所有日期
  function getDateRange() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    
    const dates = [];
    const current = new Date(oneYearAgo);
    
    while (current <= today) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  }

  // 计算每天的文章数
  function calculateDailyCounts(postsData) {
    const counts = {};
    
    postsData.forEach(post => {
      const date = post.date;
      if (date) {
        counts[date] = (counts[date] || 0) + 1;
      }
    });
    
    return counts;
  }

  // 按日期聚合文章数据
  function groupPostsByDate(postsData) {
    const postsByDate = {};
    postsData.forEach(post => {
      const date = post.date;
      if (!date) return;
      if (!postsByDate[date]) {
        postsByDate[date] = [];
      }
      postsByDate[date].push({
        title: post.title || '无标题',
        url: post.url || '#'
      });
    });
    return postsByDate;
  }

  // 获取颜色级别（0-5）
  function getColorLevel(count) {
    if (count === 0) return 0;
    if (count >= 5) return 5;
    return count;
  }

  // 获取星期几（0=周日, 1=周一, ...）
  function getDayOfWeek(date) {
    return date.getDay();
  }

  // 按周组织日期（从周日开始）
  function organizeByWeek(dates) {
    if (dates.length === 0) return [];
    
    const weeks = [];
    const firstDate = dates[0];
    const firstDayOfWeek = getDayOfWeek(firstDate);
    
    // 创建第一周，如果第一天不是周日，前面补空
    let currentWeek = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push(null); // 空日期占位
    }
    
    dates.forEach((date) => {
      const dayOfWeek = getDayOfWeek(date);
      
      // 如果是周日，开始新的一周
      if (dayOfWeek === 0 && currentWeek.length > 0) {
        // 补齐当前周（如果不是7天）
        while (currentWeek.length < 7) {
          currentWeek.push(null);
        }
        weeks.push(currentWeek);
        currentWeek = [];
      }
      
      currentWeek.push(date);
    });
    
    // 添加最后一周，补齐到7天
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
    }
    
    return weeks;
  }

  // 创建工具提示
  function createTooltip() {
    const tooltip = document.createElement('div');
    tooltip.className = 'contribution-tooltip';
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);
    return tooltip;
  }

  // 创建弹窗
  function createModal() {
    const modal = document.createElement('div');
    modal.className = 'contribution-modal';
    modal.innerHTML = `
      <div class="contribution-modal-card" role="dialog" aria-modal="true" aria-label="当日文章列表">
        <div class="contribution-modal-header">
          <div class="contribution-modal-title"></div>
          <button class="contribution-modal-close" type="button" aria-label="关闭">×</button>
        </div>
        <div class="contribution-modal-body"></div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function openModal(modal, titleText, posts) {
    const titleEl = modal.querySelector('.contribution-modal-title');
    const bodyEl = modal.querySelector('.contribution-modal-body');
    titleEl.textContent = titleText;

    if (!posts || posts.length === 0) {
      bodyEl.innerHTML = '<div class="contribution-modal-empty">当日暂无文章</div>';
    } else {
      const listItems = posts.map(post => {
        const safeTitle = post.title || '无标题';
        const url = post.url || '#';
        return `<li><a href="${url}">${safeTitle}</a></li>`;
      }).join('');
      bodyEl.innerHTML = `<ul class="contribution-modal-list">${listItems}</ul>`;
    }

    modal.classList.add('is-open');
  }

  function closeModal(modal) {
    modal.classList.remove('is-open');
  }

  // 显示工具提示
  function showTooltip(tooltip, date, count, x, y) {
    const dateStr = formatDate(date);
    const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', 
                       '七月', '八月', '九月', '十月', '十一月', '十二月'];
    const month = monthNames[date.getMonth()];
    const day = date.getDate();
    const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdayNames[date.getDay()];
    
    tooltip.innerHTML = `
      <strong>${count} 篇文章</strong><br>
      ${weekday}, ${month} ${day}, ${date.getFullYear()}
    `;
    
    // 先设置为可见以获取尺寸
    tooltip.style.display = 'block';
    tooltip.style.visibility = 'hidden';
    tooltip.style.left = '0px';
    tooltip.style.top = '0px';
    
    // 计算位置，确保不超出屏幕
    const tooltipRect = tooltip.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    
    let left = x - tooltipRect.width / 2;
    let top = y - tooltipRect.height - 10;
    
    // 如果超出右边界，调整到左侧
    if (left + tooltipRect.width > windowWidth - 10) {
      left = windowWidth - tooltipRect.width - 10;
    }
    
    // 如果超出左边界，调整到右侧
    if (left < 10) {
      left = 10;
    }
    
    // 如果超出上边界，调整到下方
    if (top < 10) {
      top = y + 20;
    }
    
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
    tooltip.style.visibility = 'visible';
  }

  // 隐藏工具提示
  function hideTooltip(tooltip) {
    tooltip.style.display = 'none';
  }

  // 初始化绿墙
  function initContributionWall() {
    const graphContainer = document.getElementById('contributionGraph');
    if (!graphContainer) return;
    
    // 检查是否有文章数据
    if (!window.postsData || !Array.isArray(window.postsData)) {
      graphContainer.innerHTML = '<p style="text-align: center; color: var(--font-color);">暂无文章数据</p>';
      return;
    }
    
    // 计算每日文章数
    const dailyCounts = calculateDailyCounts(window.postsData);
    const postsByDate = groupPostsByDate(window.postsData);
    
    // 获取日期范围
    const dates = getDateRange();
    
    // 按周组织
    const weeks = organizeByWeek(dates);
    
    // 创建工具提示
    const tooltip = createTooltip();
    const modal = createModal();
    
    // 创建月份标签
    const monthLabels = [];
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', 
                       '7月', '8月', '9月', '10月', '11月', '12月'];
    let lastMonth = -1;
    
    weeks.forEach((week, weekIndex) => {
      // 找到这一周中的第一个有效日期
      let firstDate = null;
      for (let i = 0; i < week.length; i++) {
        if (week[i] !== null) {
          firstDate = week[i];
          break;
        }
      }
      
      if (firstDate) {
        const month = firstDate.getMonth();
        const day = firstDate.getDate();
        
        // 如果是新月份的第一周，或者是第一周，添加月份标签
        if (month !== lastMonth && (weekIndex === 0 || day <= 7)) {
          monthLabels.push({
            weekIndex: weekIndex,
            month: monthNames[month]
          });
          lastMonth = month;
        }
      }
    });
    
    // 创建 HTML
    let html = '<div class="contribution-weeks">';
    
    // 添加星期标签
    html += '<div class="contribution-week-labels">';
    html += '<div class="week-label"></div>'; // 空标签用于月份行
    const weekdayLabels = ['', '周一', '', '周三', '', '周五', ''];
    weekdayLabels.forEach(label => {
      html += `<div class="week-label">${label}</div>`;
    });
    html += '</div>';
    
    // 添加周数据
    weeks.forEach((week, weekIndex) => {
      html += '<div class="contribution-week">';
      
      // 添加月份标签
      const monthLabel = monthLabels.find(m => m.weekIndex === weekIndex);
      if (monthLabel) {
        html += `<div class="month-label">${monthLabel.month}</div>`;
      } else {
        html += '<div class="month-label"></div>';
      }
      
      // 添加日期方块
      week.forEach(date => {
        if (date === null) {
          // 空日期占位
          html += '<div class="contribution-day empty"></div>';
        } else {
          const dateStr = formatDate(date);
          const count = dailyCounts[dateStr] || 0;
          const level = getColorLevel(count);
          const color = colors[level];
          
          html += `<div class="contribution-day" 
                        data-date="${dateStr}" 
                        data-count="${count}"
                        style="background-color: ${color};"
                        title="${dateStr}: ${count} 篇文章"></div>`;
        }
      });
      
      html += '</div>';
    });
    
    html += '</div>';
    graphContainer.innerHTML = html;
    
    // 添加事件监听
    const dayElements = graphContainer.querySelectorAll('.contribution-day:not(.empty)');
    dayElements.forEach(dayEl => {
      dayEl.addEventListener('mouseenter', function(e) {
        const dateStr = this.getAttribute('data-date');
        const count = parseInt(this.getAttribute('data-count') || '0');
        const date = new Date(dateStr);
        const rect = this.getBoundingClientRect();
        showTooltip(tooltip, date, count, rect.left + rect.width / 2, rect.top);
      });
      
      dayEl.addEventListener('mouseleave', function() {
        hideTooltip(tooltip);
      });

      dayEl.addEventListener('click', function() {
        const dateStr = this.getAttribute('data-date');
        const date = new Date(dateStr);
        const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', 
                           '七月', '八月', '九月', '十月', '十一月', '十二月'];
        const month = monthNames[date.getMonth()];
        const day = date.getDate();
        const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const weekday = weekdayNames[date.getDay()];
        const titleText = `${weekday} · ${month}${day}日 · ${date.getFullYear()}`;
        const posts = postsByDate[dateStr] || [];
        openModal(modal, titleText, posts);
      });
    });

    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        closeModal(modal);
      }
    });

    const closeBtn = modal.querySelector('.contribution-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        closeModal(modal);
      });
    }

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeModal(modal);
      }
    });
  }

  // 页面加载完成后初始化
  function init() {
    // 清理旧的工具提示
    const oldTooltip = document.querySelector('.contribution-tooltip');
    if (oldTooltip) {
      oldTooltip.remove();
    }
    const oldModal = document.querySelector('.contribution-modal');
    if (oldModal) {
      oldModal.remove();
    }
    initContributionWall();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 如果使用 PJAX，需要在页面切换后重新初始化
  if (typeof btf !== 'undefined' && btf.addGlobalFn) {
    btf.addGlobalFn('pjaxComplete', init, 'contribution-wall-init');
  } else if (document.addEventListener) {
    document.addEventListener('pjax:complete', init);
  }
})();

