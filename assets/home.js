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
    } else if(inc.type === 'lighting'){
      actions.push(`<button data-act="1999" class=\"btn\">通報1999</button>`);
    } else if(inc.type === 'road'){
      actions.push(`<button data-act="public-works" class=\"btn\">工務建議</button>`);
    }
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
    const n1999 = container.querySelector('[data-act="1999"]');
    if(n1999){ n1999.addEventListener('click', (e) => { e.stopPropagation(); alert('建議：撥打 1999 市民專線通報照明故障。'); }); }
    const pw = container.querySelector('[data-act="public-works"]');
    if(pw){ pw.addEventListener('click', (e) => { e.stopPropagation(); alert('建議：向市府工務單位回報路面坑洞，並注意慢行。'); }); }
  }

  function renderMarkers(data){
    markers.forEach(m => map.removeLayer(m));
    markers.clear();
    data.forEach(inc => {
      const color = App.severityColor(inc.severity);
      const emoji = App.typeEmoji(inc.type);
      const marker = L.marker([inc.location.lat, inc.location.lng], {
        icon: L.divIcon({
          html: `<div style="font-size:24px;line-height:1;text-align:center;text-shadow:1px 1px 3px rgba(0,0,0,0.7);background:${color};border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${emoji}</div>`,
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
    if(n.level === 'warn' && type === 'lighting'){
      const btn = document.createElement('button'); btn.className = 'btn'; btn.textContent = '通報 1999';
      btn.onclick = (e) => { e.stopPropagation(); alert('建議：撥打 1999 市民專線通報照明故障。'); };
      actions.appendChild(btn);
    }
    if(n.level === 'warn' && type === 'road'){
      const btn = document.createElement('button'); btn.className = 'btn'; btn.textContent = '回報工務單位';
      btn.onclick = (e) => { e.stopPropagation(); alert('建議：透過市府工務管道回報路面坑洞，避免事故。'); };
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
