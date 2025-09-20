(function(){
  const map = L.map('map').setView([App.DEFAULT_CENTER.lat, App.DEFAULT_CENTER.lng], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);

  const markers = new Map();
  const markerClusterGroup = L.markerClusterGroup({
    chunkedLoading: true,
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true
  });
  map.addLayer(markerClusterGroup);

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

  const imgModal = document.createElement('div');
  imgModal.className = 'img-modal';
  imgModal.innerHTML = `
    <div class="img-modal-backdrop"></div>
    <div class="img-modal-body">
      <button class="img-close">✕</button>
      <img class="img-view" alt="photo" />
      <button class="img-nav prev">‹</button>
      <button class="img-nav next">›</button>
      <div class="img-counter"></div>
    </div>
  `;
  document.body.appendChild(imgModal);

  const imgEl = imgModal.querySelector('.img-view');
  const btnClose = imgModal.querySelector('.img-close');
  const btnPrev = imgModal.querySelector('.img-nav.prev');
  const btnNext = imgModal.querySelector('.img-nav.next');
  const counterEl = imgModal.querySelector('.img-counter');
  let gallery = []; // 直接放 dataURL 陣列
  let idx = 0;

  function showIdx(i){
    if(!gallery.length) return;
    idx = (i + gallery.length) % gallery.length;
    imgEl.src = gallery[idx];
    counterEl.textContent = `${idx + 1} / ${gallery.length}`;
  }
  function openGallery(arr){
    gallery = Array.isArray(arr) ? arr.filter(Boolean) : [];
    if(!gallery.length) return;
    showIdx(0);
    imgModal.classList.add('open');
  }
  function closeGallery(){
    imgModal.classList.remove('open');
    gallery = [];
  }

  btnClose.onclick = closeGallery;
  imgModal.querySelector('.img-modal-backdrop').onclick = closeGallery;
  btnPrev.onclick = () => showIdx(idx - 1);
  btnNext.onclick = () => showIdx(idx + 1);
  document.addEventListener('keydown', (e) => {
    if(!imgModal.classList.contains('open')) return;
    if(e.key === 'Escape') closeGallery();
    if(e.key === 'ArrowLeft') showIdx(idx - 1);
    if(e.key === 'ArrowRight') showIdx(idx + 1);
  });

  function openDrawer(){ els.drawer.classList.add('open'); }
  function closeDrawer(){ els.drawer.classList.remove('open'); }
  els.btnMenu.addEventListener('click', () => openDrawer());
  els.overlay.addEventListener('click', () => closeDrawer());

  function popupHtml(inc){
    const actions = [];
    if(inc.type === 'fire'){
      actions.push(`<button data-act="evac" class="btn">避難原則</button>`);
    } else if(inc.type === 'traffic'){
      actions.push(`<button data-act="reroute" class="btn">改道路線</button>`);
    } else if(inc.type === 'disaster'){
      actions.push(`<button data-act="disaster" class="btn">天災應對</button>`);
    } else {
      actions.push(`<button data-act="other" class="btn">相關建議</button>`);
    }
    actions.push(
      `<button data-act="like" class="btn" style="background:${App.severityColor(inc.severity)};color:#fff;border-color:${App.severityColor(inc.severity)}">👍 ${inc.likes || 0}</button>`
    );

    // 有照片才顯示
    const photosBtn = (inc.photos && inc.photos.length)
      ? `<button data-act="photos" class="btn ghost small photos-btn"> 相片 (${inc.photos.length})</button>`
      : '';

    return `
      <div style="min-width:220px">
        <b>${inc.title}</b><br>
        <div class="pills">
          <span class="badge cat-${inc.type}">${App.typeLabel(inc.type)}</span>
          <span class="badge sev-${inc.severity.toUpperCase()}">${inc.severity.toUpperCase()}</span>
          <span class="badge status-${inc.status}">${App.statusLabel(inc.status)}</span>
        </div>
        <div style="margin-top:6px">${inc.description || ''}</div>
        <div class="muted" style="margin-top:6px">
          回報時間：${new Date(inc.createdAt || inc.updatedAt).toLocaleString()}
        </div>
        <div class="popup-footer">
          <div class="actions">${actions.join(' ')}</div>
          ${photosBtn}
        </div>
      </div>`;
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
    const photosBtn = container.querySelector('[data-act="photos"]');
    if (photosBtn && inc.photos && inc.photos.length) {
      photosBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openGallery(inc.photos);
      });
    }
  }

  function renderMarkers(data){
    // 清除現有標記
    markerClusterGroup.clearLayers();
    markers.clear();
    
    // 檢查是否有需要高亮的事故
    const highlightIncidentId = sessionStorage.getItem('highlightIncidentId');
    if(highlightIncidentId){
      console.log('首頁載入，需要高亮的事故ID:', highlightIncidentId);
    }
    
    data.forEach(inc => {
      const color = App.severityColor(inc.severity);
      const emoji = App.typeEmoji(inc.type);
      // 所有嚴重度都使用白色外框
      const borderColor = '#fff';
      
      // 如果是需要高亮的事故，使用特殊樣式
      const isHighlighted = highlightIncidentId === inc.id;
      const highlightStyle = isHighlighted ? 'border:5px solid #ff6b6b;box-shadow:0 0 20px rgba(255,107,107,0.8);' : '';
      
      const marker = L.marker([inc.location.lat, inc.location.lng], {
        icon: L.divIcon({
          html: `<div style="font-size:24px;line-height:1;text-align:center;text-shadow:1px 1px 3px rgba(0,0,0,0.7);background:${color};border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:3px solid ${borderColor};box-shadow:0 2px 8px rgba(0,0,0,0.3);${highlightStyle}">${emoji}</div>`,
          className: 'custom-marker',
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        })
      });
      
      marker.bindPopup(popupHtml(inc));
      marker.on('popupopen', (e) => {
        const node = e.popup.getElement();
        attachPopupActions(node, inc);
      });
      
      // 添加到群組而不是直接添加到地圖
      markerClusterGroup.addLayer(marker);
      markers.set(inc.id, marker);
      
      // 如果是需要高亮的事故，自動打開彈窗並縮放到該位置
      if(isHighlighted){
        console.log('高亮事故:', inc.title, '位置:', inc.location);
        setTimeout(() => {
          map.setView([inc.location.lat, inc.location.lng], 16);
          // 監聽地圖移動完成事件
          map.once('moveend', () => {
            setTimeout(() => {
              console.log('嘗試打開彈窗:', inc.title);
              marker.openPopup();
              // 清除高亮標記
              sessionStorage.removeItem('highlightIncidentId');
            }, 300);
          });
        }, 500);
      }
    });
  }

  function renderList(data){
    els.list.innerHTML = '';
    
    // 檢查是否有需要高亮的事故
    const highlightIncidentId = sessionStorage.getItem('highlightIncidentId');
    
    data.forEach(inc => {
      const li = document.createElement('li');
      
      // 如果是需要高亮的事故，添加特殊樣式
      const isHighlighted = highlightIncidentId === inc.id;
      if(isHighlighted){
        li.style.cssText = 'background: #fff3cd; border-left: 4px solid #ff6b6b; border-radius: 4px; margin: 2px 0;';
      }
      
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
      i.status !== 'Resolved' &&  // 結案的放到 history 就好
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
