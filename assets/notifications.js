(function(){
  const els = {
    enablePush: document.getElementById('enablePush'),
    enableSound: document.getElementById('enableSound'),
    minPriority: document.getElementById('minPriority'),
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
    notificationList: document.getElementById('notificationList')
  };

  let currentFilter = 'all';
  let notificationSettings = loadNotificationSettings();

  // 載入通知設定
  function loadNotificationSettings(){
    const defaultSettings = {
      enablePush: true,
      enableSound: true,
      minPriority: 'medium',
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
      minPriority: els.minPriority.value,
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
    els.minPriority.value = notificationSettings.minPriority;
    els.typeFire.checked = notificationSettings.types.includes('fire');
    els.typeTraffic.checked = notificationSettings.types.includes('traffic');
    els.typeDisaster.checked = notificationSettings.types.includes('disaster');
    els.typeOther.checked = notificationSettings.types.includes('other');
  }

  // 渲染通知列表
  function renderNotifications(){
    const notifications = App.getNotifications();
    let filteredNotifications = notifications;

    // 根據篩選條件過濾
    switch(currentFilter){
      case 'unread':
        filteredNotifications = notifications.filter(n => !n.read);
        break;
      case 'high':
        filteredNotifications = notifications.filter(n => n.priority === 'high');
        break;
      case 'warn':
        filteredNotifications = notifications.filter(n => n.level === 'warn');
        break;
    }

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

  // 創建通知元素
  function createNotificationElement(notification){
    const div = document.createElement('div');
    div.className = `notification-item ${notification.read ? 'read' : 'unread'} priority-${notification.priority}`;
    
    const timeAgo = getTimeAgo(notification.createdAt);
    const priorityIcon = getPriorityIcon(notification.priority);
    const levelIcon = getLevelIcon(notification.level);
    
    div.innerHTML = `
      <div class="notification-header">
        <div class="notification-icons">
          ${priorityIcon} ${levelIcon}
        </div>
        <div class="notification-time">${timeAgo}</div>
      </div>
      <div class="notification-title">${notification.title}</div>
      <div class="notification-message">${notification.message}</div>
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

    // 點擊通知標記為已讀
    div.addEventListener('click', () => {
      if(!notification.read){
        App.markNotificationRead(notification.id);
        renderNotifications();
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

  // 獲取優先級圖示
  function getPriorityIcon(priority){
    switch(priority){
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

  // 初始化
  loadSettingsToUI();
  setupFilterButtons();
  renderNotifications();

  // 定期更新通知列表
  setInterval(renderNotifications, 30000); // 每30秒更新一次
})();
