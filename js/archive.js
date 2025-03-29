// 归档页面的JavaScript处理
(function() {
  // 获取所有文章数据
  fetch('/api/posts.json')
    .then(response => response.json())
    .then(data => {
      const posts = data.posts || [];
      renderArchive(posts);
    })
    .catch(error => {
      console.error('获取文章数据失败:', error);
      document.getElementById('archive-app').innerHTML = '<div class="archive-empty">加载归档数据时出错，请稍后再试。</div>';
    });

  // 渲染归档页面
  function renderArchive(posts) {
    if (!posts || posts.length === 0) {
      document.getElementById('archive-app').innerHTML = '<div class="archive-empty">暂无文章</div>';
      return;
    }

    // 按年月对文章进行分组
    const groupedPosts = {};
    posts.forEach(post => {
      const date = new Date(post.date);
      const year = date.getFullYear();
      const month = date.getMonth() + 1; // 月份从0开始，需要+1
      
      if (!groupedPosts[year]) {
        groupedPosts[year] = {};
      }
      
      if (!groupedPosts[year][month]) {
        groupedPosts[year][month] = [];
      }
      
      groupedPosts[year][month].push({
        title: post.title,
        date: formatDate(date),
        url: post.path
      });
    });

    // 生成HTML
    let html = '';
    const years = Object.keys(groupedPosts).sort((a, b) => b - a); // 年份降序排列
    
    years.forEach(year => {
      html += `<div class="archive-year">${year}年</div>`;
      
      const months = Object.keys(groupedPosts[year]).sort((a, b) => b - a); // 月份降序排列
      
      months.forEach(month => {
        html += `<div class="archive-month">${month}月</div>`;
        html += '<ul class="archive-post-list">';
        
        groupedPosts[year][month].forEach(post => {
          html += `
            <li class="archive-post-item">
              <span class="archive-post-date">${post.date}</span>
              <a href="${post.url}" class="archive-post-title">${post.title}</a>
            </li>
          `;
        });
        
        html += '</ul>';
      });
    });
    
    document.getElementById('archive-app').innerHTML = html;
  }

  // 格式化日期为 MM-DD 格式
  function formatDate(date) {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${month}-${day}`;
  }
})();
