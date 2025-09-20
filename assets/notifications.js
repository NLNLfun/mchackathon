(function(){
  const els = {
    enablePush: document.getElementById('enablePush'),
    enableSound: document.getElementById('enableSound'),
    minSeverity: document.getElementById('minSeverity'),
    typeFire: document.getElementById('type-fire'),
    typeTraffic: document.getElementById('type-traffic'),
    typeDisaster: document.getElementById('type-disaster'),
    typeOther: document.getElementById('type-other'),
    btnSaveSettings: document.getElementById('btnSaveSettings'),
    btnClearAll: document.getElementById('btnClearAll'),
    btnAll: document.getElementById('btnAll'),
    btnUnread: document.getElementById('btnUnread'),
    btnHigh: document.getElementById('btnHigh'),
    btnWarn: document.getElementById('btnWarn'),
    sortBy: document.getElementById('sortBy'),
    notificationList: document.getElementById('notificationList')
  };

  let currentFilter = 'all';
  let notificationSettings = loadNotificationSettings();

  // 載入通知設定
  function loadNotificationSettings(){
    const defaultSettings = {
      enablePush: true,
      enableSound: true,
      minSeverity: 'medium',
      types: ['fire', 'traffic', 'disaster', 'other']
    };
    const saved = localStorage.getItem('notificationSettings');
    return saved ? JSON.parse(saved) : defaultSettings;
  }

  // 儲存通知設定
  function saveNotificationSettings(){
    const settings = {
      enablePush: els.enablePush.checked,
      enableSound: els.enableSound.checked,
      minSeverity: els.minSeverity.value,
      types: []
    };
    
    if(els.typeFire.checked) settings.types.push('fire');
    if(els.typeTraffic.checked) settings.types.push('traffic');
    if(els.typeDisaster.checked) settings.types.push('disaster');
    if(els.typeOther.checked) settings.types.push('other');
    
    localStorage.setItem('notificationSettings', JSON.stringify(settings));
    notificationSettings = settings;
    alert('通知設定已儲存');
  }

  // 載入設定到介面
  function loadSettingsToUI(){
    els.enablePush.checked = notificationSettings.enablePush;
    els.enableSound.checked = notificationSettings.enableSound;
    els.minSeverity.value = notificationSettings.minSeverity;
    els.typeFire.checked = notificationSettings.types.includes('fire');
    els.typeTraffic.checked = notificationSettings.types.includes('traffic');
    els.typeDisaster.checked = notificationSettings.types.includes('disaster');
    els.typeOther.checked = notificationSettings.types.includes('other');
  }

  // 渲染通知列表
  function renderNotifications(){
    const notifications = App.getNotifications();
    
    // 確保所有通知都有嚴重度信息（修復舊通知）
    notifications.forEach(notification => {
      if(!notification.severity && notification.incidentId){
        // 嘗試從事故中獲取嚴重度
        const incidents = App.getIncidents();
        const incident = incidents.find(inc => inc.id === notification.incidentId);
        if(incident){
          notification.severity = incident.severity;
        }
      }
    });
    
    let filteredNotifications = notifications;

    // 根據篩選條件過濾
    switch(currentFilter){
      case 'unread':
        filteredNotifications = notifications.filter(n => !n.read);
        break;
      case 'high':
        filteredNotifications = notifications.filter(n => {
          // 即時獲取事故的最新嚴重度
          let currentSeverity = n.severity;
          if(n.incidentId){
            const incidents = App.getIncidents();
            const incident = incidents.find(inc => inc.id === n.incidentId);
            if(incident){
              currentSeverity = incident.severity;
            }
          }
          return currentSeverity === 'high';
        });
        break;
      case 'warn':
        filteredNotifications = notifications.filter(n => n.level === 'warn');
        break;
    }

    // 排序通知
    const sortBy = els.sortBy.value;
    filteredNotifications = sortNotifications(filteredNotifications, sortBy);

    els.notificationList.innerHTML = '';

    if(filteredNotifications.length === 0){
      els.notificationList.innerHTML = '<div class="empty-notification">沒有符合條件的通知</div>';
      return;
    }

    filteredNotifications.forEach(notification => {
      const notificationEl = createNotificationElement(notification);
      els.notificationList.appendChild(notificationEl);
    });
  }

  // 排序通知
  function sortNotifications(notifications, sortBy){
    return notifications.sort((a, b) => {
      switch(sortBy){
        case 'time-desc':
          return b.createdAt - a.createdAt;
        case 'time-asc':
          return a.createdAt - b.createdAt;
        case 'severity-desc':
          const severityA = getCurrentSeverity(a);
          const severityB = getCurrentSeverity(b);
          return getSeverityOrder(severityB) - getSeverityOrder(severityA);
        case 'severity-asc':
          const severityA2 = getCurrentSeverity(a);
          const severityB2 = getCurrentSeverity(b);
          return getSeverityOrder(severityA2) - getSeverityOrder(severityB2);
        default:
          return b.createdAt - a.createdAt;
      }
    });
  }

  // 獲取通知的當前嚴重度
  function getCurrentSeverity(notification){
    if(notification.incidentId){
      const incidents = App.getIncidents();
      const incident = incidents.find(inc => inc.id === notification.incidentId);
      if(incident){
        return incident.severity;
      }
    }
    return notification.severity;
  }

  // 獲取嚴重度順序
  function getSeverityOrder(severity){
    const order = { 'high': 3, 'medium': 2, 'low': 1 };
    return order[severity] || 0;
  }

  // 調試函數：檢查通知資料
  function debugNotifications(){
    const notifications = App.getNotifications();
    console.log('通知資料：', notifications);
    notifications.forEach(n => {
      const currentSeverity = getCurrentSeverity(n);
      console.log(`通知 ${n.id}: 原始嚴重度=${n.severity}, 當前嚴重度=${currentSeverity}, 時間=${new Date(n.createdAt).toLocaleString()}`);
    });
  }

  // 創建通知元素
  function createNotificationElement(notification){
    // 即時獲取事故的最新嚴重度
    let currentSeverity = notification.severity;
    if(notification.incidentId){
      const incidents = App.getIncidents();
      const incident = incidents.find(inc => inc.id === notification.incidentId);
      if(incident){
        currentSeverity = incident.severity;
      }
    }
    
    const div = document.createElement('div');
    div.className = `notification-item ${notification.read ? 'read' : 'unread'} severity-${currentSeverity || 'unknown'}`;
    
    const timeAgo = getTimeAgo(notification.createdAt);
    const severityIcon = getSeverityIcon(currentSeverity);
    const levelIcon = getLevelIcon(notification.level);
    
    div.innerHTML = `
      <div class="notification-header">
        <div class="notification-icons">
          ${severityIcon} ${levelIcon}
        </div>
        <div class="notification-time">${timeAgo}</div>
      </div>
      <div class="notification-title">${notification.title}</div>
      <div class="notification-message">${notification.message}</div>
      ${notification.incidentId ? '<div class="notification-hint">💡 點擊查看地圖位置</div>' : ''}
      <div class="notification-actions">
        ${!notification.read ? '<button class="mark-read-btn" data-id="' + notification.id + '">標記已讀</button>' : ''}
        <button class="delete-btn" data-id="${notification.id}">刪除</button>
      </div>
    `;

    // 添加事件監聽器
    const markReadBtn = div.querySelector('.mark-read-btn');
    if(markReadBtn){
      markReadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        App.markNotificationRead(notification.id);
        renderNotifications();
      });
    }

    const deleteBtn = div.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteNotification(notification.id);
    });

    // 點擊通知標記為已讀或跳轉到首頁
    div.addEventListener('click', () => {
      if(!notification.read){
        App.markNotificationRead(notification.id);
        renderNotifications();
      }
      
      // 如果有關聯的事故，跳轉到首頁並顯示該事故
      if(notification.incidentId){
        console.log('跳轉到首頁，事故ID:', notification.incidentId);
        // 將事故ID存儲到sessionStorage，供首頁使用
        sessionStorage.setItem('highlightIncidentId', notification.incidentId);
        // 跳轉到首頁
        window.location.href = 'index.html';
      }
    });

    return div;
  }

  // 刪除通知
  function deleteNotification(id){
    const notifications = App.getNotifications();
    const filtered = notifications.filter(n => n.id !== id);
    localStorage.setItem('notifications', JSON.stringify(filtered));
    renderNotifications();
  }

  // 獲取嚴重度圖示
  function getSeverityIcon(severity){
    switch(severity){
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }

  // 獲取級別圖示
  function getLevelIcon(level){
    switch(level){
      case 'warn': return '⚠️';
      case 'info': return 'ℹ️';
      case 'error': return '❌';
      default: return '📢';
    }
  }

  // 獲取時間差
  function getTimeAgo(timestamp){
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if(minutes < 1) return '剛剛';
    if(minutes < 60) return `${minutes}分鐘前`;
    if(hours < 24) return `${hours}小時前`;
    return `${days}天前`;
  }

  // 篩選按鈕事件
  function setupFilterButtons(){
    const filterButtons = [els.btnAll, els.btnUnread, els.btnHigh, els.btnWarn];
    const filters = ['all', 'unread', 'high', 'warn'];

    filterButtons.forEach((btn, index) => {
      btn.addEventListener('click', () => {
        // 移除所有 active 類別
        filterButtons.forEach(b => b.classList.remove('active'));
        // 添加 active 類別到當前按鈕
        btn.classList.add('active');
        // 設定當前篩選
        currentFilter = filters[index];
        // 重新渲染
        renderNotifications();
      });
    });
  }

  // 事件監聽器
  els.btnSaveSettings.addEventListener('click', saveNotificationSettings);
  els.btnClearAll.addEventListener('click', () => {
    if(confirm('確定要清空所有通知嗎？')){
      App.clearNotifications();
      renderNotifications();
    }
  });
  
  // 排序變更事件
  els.sortBy.addEventListener('change', renderNotifications);

  // 初始化
  loadSettingsToUI();
  setupFilterButtons();
  debugNotifications(); // 調試：檢查通知資料
  renderNotifications();

  // 定期更新通知列表
  setInterval(renderNotifications, 30000); // 每30秒更新一次
  
  // 監聽 localStorage 變更，即時更新通知列表
  window.addEventListener('storage', (e) => {
    if(e.key === 'incidents' || e.key === 'notifications'){
      renderNotifications();
    }
  });
  
  // 監聽頁面可見性變更，當頁面重新可見時更新
  document.addEventListener('visibilitychange', () => {
    if(!document.hidden){
      renderNotifications();
    }
  });
})();
