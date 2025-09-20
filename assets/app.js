(function(){
  const STORAGE = {
    incidents: 'incidents',
    subscriptions: 'subscriptions',
    notifications: 'notifications'
  };

  const DEFAULT_CENTER = { lat: 24.8036, lng: 120.9686 }; // 新竹市中心近似

  function readArray(key){
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch(e){ return []; }
  }
  function writeArray(key, value){ localStorage.setItem(key, JSON.stringify(value)); }

  function generateId(prefix){ return `${prefix}_${Math.random().toString(36).slice(2,10)}_${Date.now().toString(36)}`; }

  function toTs(date = new Date()){ return date.getTime(); }

  function ensureSeeds(){
    const incidents = readArray(STORAGE.incidents);
    if(incidents.length === 0){
      const seeds = [
        { title: '東區消防警報', description: '住宅火警，請避開周邊道路', type: 'fire', severity: 'high', status: 'VerifiedWarned', lat: 24.7906, lng: 120.9975, likes: 23 },
        { title: '光復路車禍', description: '兩車追撞，外側車道回堵', type: 'traffic', severity: 'medium', status: 'Accepted', lat: 24.8021, lng: 120.9890, likes: 8 },
        { title: '暴雨積水', description: '道路積水嚴重，請繞道通行', type: 'disaster', severity: 'high', status: 'VerifiedWarned', lat: 24.8150, lng: 120.9670, likes: 15 },
        { title: '清大路口車禍', description: '機車與汽車擦撞，已處理完畢', type: 'traffic', severity: 'low', status: 'Resolved', lat: 24.7950, lng: 120.9950, likes: 5 },
        { title: '路燈故障', description: '民生路路燈故障，已修復', type: 'other', severity: 'low', status: 'Resolved', lat: 24.8080, lng: 120.9800, likes: 3 },
        { title: '路面坑洞', description: '中正路路面坑洞，已填補', type: 'other', severity: 'medium', status: 'Resolved', lat: 24.8000, lng: 120.9700, likes: 7 },
        // 新增更多歷史紀錄
        { title: '交大校門口車禍', description: '機車與行人擦撞，已處理完畢', type: 'traffic', severity: 'medium', status: 'Resolved', lat: 24.7865, lng: 120.9965, likes: 12 },
        { title: '竹科園區火警', description: '辦公大樓火警，已撲滅', type: 'fire', severity: 'high', status: 'Resolved', lat: 24.7750, lng: 121.0100, likes: 18 },
        { title: '東門圓環積水', description: '暴雨造成積水，已排除', type: 'disaster', severity: 'medium', status: 'Resolved', lat: 24.8050, lng: 120.9750, likes: 9 },
        { title: '新竹火車站路燈故障', description: '站前路燈故障，已修復', type: 'other', severity: 'low', status: 'Resolved', lat: 24.8015, lng: 120.9715, likes: 4 },
        { title: '香山區道路塌陷', description: '道路塌陷，已修復', type: 'other', severity: 'high', status: 'Resolved', lat: 24.7600, lng: 120.9200, likes: 14 },
        { title: '南寮漁港車禍', description: '漁港附近車禍，已處理', type: 'traffic', severity: 'low', status: 'Resolved', lat: 24.8500, lng: 120.9300, likes: 6 },
        { title: '關東橋市場火警', description: '市場攤位火警，已撲滅', type: 'fire', severity: 'medium', status: 'Resolved', lat: 24.8200, lng: 121.0200, likes: 11 },
        { title: '頭前溪橋積水', description: '橋面積水，已排除', type: 'disaster', severity: 'low', status: 'Resolved', lat: 24.8300, lng: 121.0000, likes: 8 },
        { title: '科學園區路燈故障', description: '園區路燈故障，已修復', type: 'other', severity: 'low', status: 'Resolved', lat: 24.7800, lng: 121.0050, likes: 3 },
        { title: '新竹高鐵站車禍', description: '高鐵站前車禍，已處理', type: 'traffic', severity: 'medium', status: 'Resolved', lat: 24.8085, lng: 121.0400, likes: 10 }
      ];
      const now = toTs();
      const saved = seeds.map(s => ({
        id: generateId('inc'),
        title: s.title,
        description: s.description,
        type: s.type,
        severity: s.severity,
        status: s.status,
        location: { lat: s.lat, lng: s.lng, address: '' },
        assignedAgency: '',
        source: s.status === 'Reported' ? 'public' : 'official',
        likes: s.likes || 0,
        createdAt: now,
        updatedAt: now
      }));
      writeArray(STORAGE.incidents, saved);
    } else {
      // 為現有事故添加讚數（如果沒有的話）
      const updated = incidents.map(inc => ({
        ...inc,
        likes: inc.likes !== undefined ? inc.likes : Math.floor(Math.random() * 15) + 1
      }));
      writeArray(STORAGE.incidents, updated);
    }
    if(readArray(STORAGE.subscriptions).length === 0){
      writeArray(STORAGE.subscriptions, []);
    }
    if(readArray(STORAGE.notifications).length === 0){
      writeArray(STORAGE.notifications, []);
    }
  }

  function severityOrder(sev){ return sev === 'high' ? 3 : sev === 'medium' ? 2 : 1; }

  function haversineMeters(a, b){
    const R = 6371000;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const la1 = toRad(a.lat), la2 = toRad(b.lat);
    const h = Math.sin(dLat/2)**2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng/2)**2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function shouldNotifyForIncident(incident, subscription){
    if(!subscription) return false;
    if(subscription.categories.length && !subscription.categories.includes(incident.type)) return false;
    if(severityOrder(incident.severity) < severityOrder(subscription.minSeverity || 'low')) return false;
    const dist = haversineMeters(subscription.center, incident.location);
    return dist <= (subscription.radiusMeters || 0);
  }

  function addNotification(incident, message, level){
    const list = readArray(STORAGE.notifications);
    list.unshift({
      id: generateId('ntf'),
      incidentId: incident ? incident.id : null,
      title: incident ? incident.title : '通知',
      message,
      level: level || 'info',
      createdAt: toTs(),
      read: false
    });
    writeArray(STORAGE.notifications, list.slice(0, 100));
  }

  function notifyForIncident(incident){
    // 只有經過審核證實的事故才發送警告通知
    if(incident.status !== 'VerifiedWarned'){
      return; // 未證實的事故不發送警告
    }
    
    const subs = readArray(STORAGE.subscriptions);
    const matched = subs.filter(s => shouldNotifyForIncident(incident, s));
    
    let advice = '';
    if(incident.type === 'fire'){
      advice = '消防警示：保持低姿勢、用濕布掩口鼻、切勿搭電梯。查看官方避難原則 →';
    } else if(incident.type === 'traffic'){
      advice = '交通警示：請減速慢行，評估改道避開事故路段。';
    } else if(incident.type === 'disaster'){
      advice = '天災警示：請遠離危險區域，注意官方疏散指示。';
    } else {
      advice = '注意安全，留心官方後續通報。';
    }
    const msg = `[${typeLabel(incident.type)}] ${incident.severity.toUpperCase()}｜${incident.description || ''} ${advice}`.trim();
    
    // 如果有訂閱匹配，發送通知
    if(matched.length > 0){
      addNotification(incident, msg, 'warn');
    }
  }

  function severityColor(sev){
    return sev === 'high' ? '#dc2626' : sev === 'medium' ? '#f59e0b' : '#3b82f6';
  }
  function statusColor(status){
    switch(status){
      case 'Reported': return '#3b82f6';
      case 'Accepted': return '#16a34a';
      case 'VerifiedWarned': return '#d97706';
      case 'Resolved': return '#10b981';
      case 'Rejected': return '#ef4444';
      default: return '#6b7280';
    }
  }

  function typeLabel(type){
    return ({ 
      disaster: '天災', 
      fire: '消防', 
      traffic: '交通', 
      other: '其他' 
    })[type] || type;
  }

  function typeEmoji(type){
    return ({ 
      disaster: '🌊', 
      fire: '🔥', 
      traffic: '🚗', 
      other: '⚠️' 
    })[type] || '⚠️';
  }

  function statusLabel(status){
    return ({ Reported: 'Reported', Accepted: 'Accepted', VerifiedWarned: 'Verified & Warned', Resolved: 'Resolved', Rejected: 'Rejected' })[status] || status;
  }

  function getIncidents(){ return readArray(STORAGE.incidents); }
  function saveIncidents(list){ writeArray(STORAGE.incidents, list); }

  function upsertIncident(incident){
    const list = getIncidents();
    const idx = list.findIndex(i => i.id === incident.id);
    if(idx >= 0){ list[idx] = { ...list[idx], ...incident, updatedAt: toTs() }; }
    else { list.unshift({ ...incident, id: generateId('inc'), likes: 0, createdAt: toTs(), updatedAt: toTs() }); }
    saveIncidents(list);
    const saved = idx >= 0 ? list[idx] : list[0];
    if(!incident.id){ addNotification(saved, `已接收您的通報（${typeLabel(saved.type)}`, 'info'); }
    return saved;
  }

  function likeIncident(incidentId){
    const list = getIncidents();
    const idx = list.findIndex(i => i.id === incidentId);
    if(idx >= 0){
      list[idx].likes = (list[idx].likes || 0) + 1;
      list[idx].updatedAt = toTs();
      saveIncidents(list);
      return list[idx];
    }
    return null;
  }

  function getSubscriptions(){ return readArray(STORAGE.subscriptions); }
  function saveSubscriptions(list){ writeArray(STORAGE.subscriptions, list); }
  function upsertSubscription(sub){
    const list = getSubscriptions();
    const idx = list.findIndex(s => s.id === sub.id);
    if(idx >= 0){ list[idx] = { ...list[idx], ...sub }; }
    else { list.unshift({ ...sub, id: generateId('sub') }); }
    saveSubscriptions(list);
    addNotification(null, '已儲存訂閱規則，將在符合條件時通知您。', 'info');
    return idx >= 0 ? list[idx] : list[0];
  }

  function getNotifications(){ return readArray(STORAGE.notifications); }
  function markNotificationRead(id){
    const list = getNotifications();
    const idx = list.findIndex(n => n.id === id);
    if(idx >= 0){ list[idx].read = true; writeArray(STORAGE.notifications, list); }
  }
  function clearNotifications(){ writeArray(STORAGE.notifications, []); }

  // PWA install prompt capture
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; });
  async function showInstallPrompt(){ if(deferredPrompt){ deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; } else { alert('若瀏覽器支援，稍後會出現安裝提示。'); } }

  ensureSeeds();

  window.App = {
    DEFAULT_CENTER,
    STORAGE,
    readArray, writeArray,
    generateId, toTs,
    getIncidents, upsertIncident, saveIncidents,
    getSubscriptions, upsertSubscription, saveSubscriptions,
    getNotifications, markNotificationRead, clearNotifications,
    severityColor, statusColor, typeLabel, typeEmoji, statusLabel,
    haversineMeters,
    notifyForIncident,
    likeIncident,
    showInstallPrompt,
  };
})();
