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
        { title: '東區消防警報', description: '住宅火警，請避開周邊道路', type: 'fire', severity: 'high', status: 'VerifiedWarned', lat: 24.7906, lng: 120.9975 },
        { title: '光復路車禍', description: '兩車追撞，外側車道回堵', type: 'traffic', severity: 'medium', status: 'Accepted', lat: 24.8021, lng: 120.9890 },
        { title: '路面坑洞', description: '人行道破損，請小心通行', type: 'road', severity: 'low', status: 'Reported', lat: 24.8150, lng: 120.9670 }
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
        createdAt: now,
        updatedAt: now
      }));
      writeArray(STORAGE.incidents, saved);
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
    const subs = readArray(STORAGE.subscriptions);
    const matched = subs.filter(s => shouldNotifyForIncident(incident, s));
    const isWarn = (incident.status === 'VerifiedWarned') || (incident.severity === 'high' && (incident.status === 'Accepted' || incident.status === 'VerifiedWarned'));
    if(isWarn){
      let advice = '';
      if(incident.type === 'fire'){
        advice = '火災警示：保持低姿勢、用濕布掩口鼻、切勿搭電梯。查看官方避難原則 →';
      } else if(incident.type === 'traffic'){
        advice = '車禍警示：請減速慢行，評估改道避開事故路段。';
      } else if(incident.type === 'lighting'){
        advice = '照明故障：注意夜間視線不良，放慢速度與留心路面。';
      } else if(incident.type === 'road'){
        advice = '路面不平：請減速通行，注意行人與騎士安全。';
      } else {
        advice = '注意安全，留心官方後續通報。';
      }
      const msg = `[${typeLabel(incident.type)}] ${incident.severity.toUpperCase()}｜${incident.description || ''} ${advice}`.trim();
      if(matched.length === 0){ addNotification(incident, msg, 'warn'); }
      else { matched.forEach(() => addNotification(incident, msg, 'warn')); }
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
    return ({ fire: '火災', traffic: '車禍', lighting: '照明故障', road: '路面不平', other: '其他' })[type] || type;
  }

  function typeEmoji(type){
    return ({ fire: '🔥', traffic: '🚗', lighting: '💡', road: '🕳️', other: '⚠️' })[type] || '⚠️';
  }

  function statusLabel(status){
    return ({ Reported: 'Reported', Accepted: 'Accepted', VerifiedWarned: 'Verified & Warned', Resolved: 'Resolved', Rejected: 'Rejected' })[status] || status;
  }

  function getIncidents(){ return readArray(STORAGE.incidents); }
  function saveIncidents(list){ writeArray(STORAGE.incidents, list); }

  function upsertIncident(incident){
    const list = getIncidents();
    const idx = list.findIndex(i => i.id === incident.id);
    const nowTs = toTs();
    let saved;

    if(idx >= 0){
      const prev = list[idx];
      const next = { ...prev, ...incident, updatedAt: nowTs };

      if(typeof incident.status === 'string' && incident.status !== prev.status){
        const ns = incident.status;
        if(ns === 'Accepted' && !next.acceptedAt) next.acceptedAt = nowTs;
        if(ns === 'VerifiedWarned' && !next.verifiedAt) next.verifiedAt = nowTs;
        if(ns === 'Resolved' && !next.resolvedAt) next.resolvedAt = nowTs;
        if(ns === 'Rejected' && !next.rejectedAt) next.rejectedAt = nowTs;
      }

      list[idx] = next;
      saveIncidents(list);
      saved = next;
    } else {
      const base = { ...incident, id: generateId('inc'), createdAt: nowTs, updatedAt: nowTs };
      if(base.status === 'Accepted') base.acceptedAt = nowTs;
      if(base.status === 'VerifiedWarned') base.verifiedAt = nowTs;
      if(base.status === 'Resolved') base.resolvedAt = nowTs;
      if(base.status === 'Rejected') base.rejectedAt = nowTs;

      list.unshift(base);
      saveIncidents(list);
      saved = list[0];
      addNotification(saved, `已接收您的通報（${typeLabel(saved.type)}）`, 'info');
    }
    return saved;
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

  function withinMs(ts, windowMs){
    if(!ts) return false;
    const now = toTs();
    return (now - ts) <= windowMs
  }

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
    showInstallPrompt,
    withinMs,
  };
})();
