(function(){
  const map = L.map('map').setView([App.DEFAULT_CENTER.lat, App.DEFAULT_CENTER.lng], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);

  const els = {
    radius: document.getElementById('radius'),
    minSeverity: document.getElementById('minSeverity'),
    coords: document.getElementById('coords'),
    btnLocate: document.getElementById('btnLocate'),
    btnSave: document.getElementById('btnSave'),
    subList: document.getElementById('subList'),
    drawer: document.getElementById('drawer'),
    overlay: document.getElementById('drawerOverlay'),
    btnMenu: document.getElementById('btnMenu')
  };

  function openDrawer(){ els.drawer.classList.add('open'); }
  function closeDrawer(){ els.drawer.classList.remove('open'); }
  els.btnMenu.addEventListener('click', () => openDrawer());
  els.overlay.addEventListener('click', () => closeDrawer());

  let center = { lat: App.DEFAULT_CENTER.lat, lng: App.DEFAULT_CENTER.lng };
  let marker = L.marker(center, { draggable: true }).addTo(map);
  let circle = L.circle(center, { radius: Number(els.radius.value), color: '#2563eb' }).addTo(map);

  function updateCoords(){ els.coords.value = `${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}`; }
  updateCoords();

  function updateCircle(){ circle.setLatLng(center); circle.setRadius(Number(els.radius.value)); }

  map.on('click', e => { center = e.latlng; marker.setLatLng(center); updateCoords(); updateCircle(); });
  marker.on('dragend', () => { center = marker.getLatLng(); updateCoords(); updateCircle(); });
  els.radius.addEventListener('change', updateCircle);

  els.btnLocate.onclick = () => {
    if(!navigator.geolocation){ alert('此瀏覽器不支援定位'); return; }
    navigator.geolocation.getCurrentPosition(pos => {
      center = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      map.setView(center, 15);
      marker.setLatLng(center);
      updateCoords();
      updateCircle();
    }, () => alert('無法取得定位'));
  };

  function getSelectedCategories(){
    return Array.from(document.querySelectorAll('input[name="cat"]:checked')).map(i => i.value);
  }

  const drawnSubs = new Map();

  function renderExistingSubscriptions(){
    const subs = App.getSubscriptions();
    subs.forEach(s => {
      if(!drawnSubs.has(s.id)){
        const mk = L.marker([s.center.lat, s.center.lng], {
          icon: L.divIcon({
            html: '<div style="background:#6b7280;color:#fff;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:10px;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,0.3);">📌</div>',
            className: 'sub-marker',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          })
        }).addTo(map).bindPopup(`已訂閱：${s.categories.join(', ')}`);
        const c = L.circle([s.center.lat, s.center.lng], { 
          radius: s.radiusMeters, 
          color: '#6b7280', 
          fillColor: '#6b7280', 
          fillOpacity: 0.1,
          weight: 2
        }).addTo(map).bindPopup(`訂閱範圍：${s.radiusMeters}m`);
        drawnSubs.set(s.id, { mk, c });
      }
    });
  }

  function highlightSubscription(s){
    if(drawnSubs.has(s.id)){
      const { mk, c } = drawnSubs.get(s.id);
      map.setView(mk.getLatLng(), 15);
      c.setStyle({ color: '#ef4444', fillOpacity: 0.2 });
      setTimeout(() => c.setStyle({ color: '#6b7280', fillOpacity: 0.1 }), 1500);
      return;
    }
    const mk = L.marker([s.center.lat, s.center.lng]).addTo(map);
    const c = L.circle([s.center.lat, s.center.lng], { radius: s.radiusMeters, color: '#2563eb' }).addTo(map);
    drawnSubs.set(s.id, { mk, c });
    map.fitBounds(c.getBounds());
  }

  function renderSubs(){
    const subs = App.getSubscriptions();
    els.subList.innerHTML = '';
    subs.forEach(s => {
      const li = document.createElement('li');
      li.innerHTML = `<div class="title">半徑 ${s.radiusMeters}m，${s.categories.join(', ')}，≥${s.minSeverity.toUpperCase()}</div>`;
      const box = document.createElement('div');
      const btnDel = document.createElement('button'); btnDel.textContent = '刪除';
      btnDel.onclick = (e) => { 
        e.stopPropagation(); 
        const list = App.getSubscriptions().filter(x => x.id !== s.id); 
        App.saveSubscriptions(list); 
        // 移除地圖上的標記
        if(drawnSubs.has(s.id)){
          const { mk, c } = drawnSubs.get(s.id);
          map.removeLayer(mk);
          map.removeLayer(c);
          drawnSubs.delete(s.id);
        }
        renderSubs(); 
      };
      box.appendChild(btnDel);
      li.appendChild(box);
      li.onclick = () => { highlightSubscription(s); closeDrawer(); };
      els.subList.appendChild(li);
    });
  }

  els.btnSave.onclick = () => {
    const categories = getSelectedCategories();
    if(categories.length === 0){ alert('請至少選擇一個類別'); return; }
    const sub = {
      center,
      radiusMeters: Number(els.radius.value) || 0,
      categories,
      minSeverity: els.minSeverity.value
    };
    const saved = App.upsertSubscription(sub);
    alert('已儲存訂閱');
    renderSubs();
    renderExistingSubscriptions(); // 重新渲染地圖上的訂閱範圍
    highlightSubscription(saved);
  };

  renderSubs();
  renderExistingSubscriptions(); // 頁面載入時顯示已訂閱範圍
})();
