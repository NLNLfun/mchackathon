(function(){
  const map = L.map('map').setView([App.DEFAULT_CENTER.lat, App.DEFAULT_CENTER.lng], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);

  const markers = new Map();

  const els = {
    list: document.getElementById('incidentList'),
    type: document.getElementById('filterType'),
    sev: document.getElementById('filterSeverity'),
    status: document.getElementById('filterStatus'),
    toasts: document.getElementById('toastContainer'),
    drawer: document.getElementById('drawer'),
    overlay: document.getElementById('drawerOverlay'),
    btnMenu: document.getElementById('btnMenu')
  };

  function openDrawer(){ els.drawer.classList.add('open'); }
  function closeDrawer(){ els.drawer.classList.remove('open'); }
  els.btnMenu.addEventListener('click', () => openDrawer());
  els.overlay.addEventListener('click', () => closeDrawer());

  function popupHtml(inc){
    const actions = [];
    if(inc.type === 'fire'){
      actions.push(`<button data-act="evac" class=\"btn\">避難原則</button>`);
    } else if(inc.type === 'traffic'){
      actions.push(`<button data-act="reroute" class=\"btn\">改道路線</button>`);
    } else if(inc.type === 'disaster'){
      actions.push(`<button data-act="disaster" class=\"btn\">天災應對</button>`);
    } else {
      actions.push(`<button data-act="other" class=\"btn\">相關建議</button>`);
    }
    actions.push(`<button data-act="like" class=\"btn\" style=\"background:${App.severityColor(inc.severity)};color:#fff;border-color:${App.severityColor(inc.severity)}\">👍 ${inc.likes || 0}</button>`);
    return `
      <div style=\"min-width:220px\"><b>${inc.title}</b><br>${App.typeLabel(inc.type)} | ${inc.severity.toUpperCase()}<br><span style=\"color:${App.statusColor(inc.status)}\">${App.statusLabel(inc.status)}</span>
      <div style=\"margin-top:6px\">${inc.description || ''}</div>
      <div class=\"actions\" style=\"margin-top:8px\">${actions.join(' ')}</div></div>`;
  }

  function attachPopupActions(container, inc){
    const evac = container.querySelector('[data-act="evac"]');
    if(evac){ evac.addEventListener('click', (e) => { e.stopPropagation(); window.open('https://www.tfdp.com.tw/cht/index.php?code=list&flag=detail&ids=55&article_id=152', '_blank'); }); }
    const reroute = container.querySelector('[data-act="reroute"]');
    if(reroute){ reroute.addEventListener('click', (e) => { e.stopPropagation(); alert('建議：避開事故路段，使用替代道路。'); }); }
    const disaster = container.querySelector('[data-act="disaster"]');
    if(disaster){ disaster.addEventListener('click', (e) => { e.stopPropagation(); alert('天災應對：請遠離危險區域，注意官方疏散指示，避免進入積水或受災區域。'); }); }
    const other = container.querySelector('[data-act="other"]');
    if(other){ other.addEventListener('click', (e) => { e.stopPropagation(); alert('相關建議：請注意安全，可撥打 1999 市民專線通報相關問題。'); }); }
    const like = container.querySelector('[data-act="like"]');
    if(like){ like.addEventListener('click', (e) => { e.stopPropagation(); const updated = App.likeIncident(inc.id); if(updated){ like.textContent = `👍 ${updated.likes}`; refresh(); } }); }
  }

  function renderMarkers(data){
    markers.forEach(m => map.removeLayer(m));
    markers.clear();
    data.forEach(inc => {
      const color = App.severityColor(inc.severity);
      const emoji = App.typeEmoji(inc.type);
      // 根據嚴重度設定外框顏色
      let borderColor = '#fff'; // 低嚴重度：白色
      if(inc.severity === 'medium') borderColor = '#f59e0b'; // 中嚴重度：橙色
      else if(inc.severity === 'high') borderColor = '#dc2626'; // 高嚴重度：紅色
      
      const marker = L.marker([inc.location.lat, inc.location.lng], {
        icon: L.divIcon({
          html: `<div style="font-size:24px;line-height:1;text-align:center;text-shadow:1px 1px 3px rgba(0,0,0,0.7);background:${color};border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:3px solid ${borderColor};box-shadow:0 2px 8px rgba(0,0,0,0.3);">${emoji}</div>`,
          className: 'custom-marker',
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        })
      }).addTo(map);
      marker.bindPopup(popupHtml(inc));
      marker.on('popupopen', (e) => {
        const node = e.popup.getElement();
        attachPopupActions(node, inc);
      });
      markers.set(inc.id, marker);
    });
  }

  function renderList(data){
    els.list.innerHTML = '';
    data.forEach(inc => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="title">${inc.title}</div>
        <div class="meta">
          <span class="badge" style="border-color:${App.severityColor(inc.severity)}">${inc.severity.toUpperCase()}</span>
          <span class="badge" style="border-color:${App.statusColor(inc.status)}">${App.statusLabel(inc.status)}</span>
          <span class="badge">${App.typeLabel(inc.type)}</span>
        </div>
        <div class="helper">更新：${new Date(inc.updatedAt).toLocaleString()}</div>
      `;
      li.onclick = () => {
        const m = markers.get(inc.id);
        if(m){ map.setView(m.getLatLng(), 16); m.openPopup(); closeDrawer(); }
      };
      els.list.appendChild(li);
    });
  }

  function getFiltered(){
    const type = els.type.value;
    const sev = els.sev.value;
    const status = els.status.value;
    return App.getIncidents().filter(i => (
      i.status !== 'Rejected' && // 過濾掉被拒絕的事故
      (!type || i.type === type) &&
      (!sev || i.severity === sev) &&
      (!status || i.status === status)
    ));
  }

  function refresh(){
    const data = getFiltered();
    renderMarkers(data);
    renderList(data);
  }

  ['change'].forEach(evt => {
    els.type.addEventListener(evt, refresh);
    els.sev.addEventListener(evt, refresh);
    els.status.addEventListener(evt, refresh);
  });

  // Persistent toasts until user clicks "知道了"
  function createActionButtons(n){
    const actions = document.createElement('div');
    actions.className = 'actions';
    let inc = null;
    if(n.incidentId){ inc = App.getIncidents().find(i => i.id === n.incidentId) || null; }
    const type = inc ? inc.type : null;

    if(n.level === 'warn' && type === 'fire'){
      const btn = document.createElement('button'); btn.className = 'btn primary'; btn.textContent = '查看避難原則';
      btn.onclick = (e) => { e.stopPropagation(); window.open('https://www.tfdp.com.tw/cht/index.php?code=list&flag=detail&ids=55&article_id=152', '_blank'); };
      actions.appendChild(btn);
    }
    if(n.level === 'warn' && type === 'traffic'){
      const btn = document.createElement('button'); btn.className = 'btn'; btn.textContent = '規劃改道路線';
      btn.onclick = (e) => { e.stopPropagation(); alert('建議：避開事故路段，使用替代道路。'); };
      actions.appendChild(btn);
    }
    if(n.level === 'warn' && type === 'disaster'){
      const btn = document.createElement('button'); btn.className = 'btn'; btn.textContent = '天災應對';
      btn.onclick = (e) => { e.stopPropagation(); alert('天災應對：請遠離危險區域，注意官方疏散指示，避免進入積水或受災區域。'); };
      actions.appendChild(btn);
    }
    if(n.level === 'warn' && type === 'other'){
      const btn = document.createElement('button'); btn.className = 'btn'; btn.textContent = '相關建議';
      btn.onclick = (e) => { e.stopPropagation(); alert('相關建議：請注意安全，可撥打 1999 市民專線通報相關問題。'); };
      actions.appendChild(btn);
    }

    const btnClose = document.createElement('button'); btnClose.className = 'btn'; btnClose.textContent = '知道了';
    btnClose.onclick = (e) => { e.stopPropagation(); App.markNotificationRead(n.id); renderToasts(); };
    actions.appendChild(btnClose);
    return actions;
  }

  function renderToasts(){
    const list = App.getNotifications().filter(n => !n.read).slice(0, 5);
    els.toasts.innerHTML = '';
    list.forEach(n => {
      const div = document.createElement('div');
      div.className = `toast ${n.level === 'warn' ? 'warn' : 'info'}`;
      const icon = document.createElement('div'); icon.className = 'icon'; icon.textContent = n.level === 'warn' ? '⚠️' : '🔔';
      const body = document.createElement('div'); body.className = 'body';
      body.innerHTML = `<div class=\"title\">${n.title}</div><div>${n.message}</div><div class=\"time\">${new Date(n.createdAt).toLocaleTimeString()}</div>`;
      body.appendChild(createActionButtons(n));
      div.appendChild(icon); div.appendChild(body);
      div.onclick = () => { if(n.incidentId){ const inc = App.getIncidents().find(i => i.id === n.incidentId); if(inc){ const m = markers.get(inc.id); if(m){ map.setView(m.getLatLng(), 16); m.openPopup(); }}} };
      els.toasts.appendChild(div);
    });
  }

  refresh();
  renderToasts();
  setInterval(() => { renderToasts(); }, 3000);
})();
