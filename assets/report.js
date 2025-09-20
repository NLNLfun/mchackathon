(function(){
  const map = L.map('map').setView([App.DEFAULT_CENTER.lat, App.DEFAULT_CENTER.lng], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);

  const els = {
    type: document.getElementById('type'),
    severity: document.getElementById('severity'),
    title: document.getElementById('title'),
    description: document.getElementById('description'),
    coords: document.getElementById('coords'),
    photos: document.getElementById('photos'),
    preview: document.getElementById('preview'),
    btnSubmit: document.getElementById('btnSubmit'),
    drawer: document.getElementById('drawer'),
    overlay: document.getElementById('drawerOverlay'),
    btnMenu: document.getElementById('btnMenu')
  };

  function openDrawer(){ els.drawer.classList.add('open'); }
  function closeDrawer(){ els.drawer.classList.remove('open'); }
  els.btnMenu.addEventListener('click', () => openDrawer());
  els.overlay.addEventListener('click', () => closeDrawer());

  let selectedLatLng = null;
  let pin = null;
  let photoDataUrls = [];
  let userLocation = null;
  let userCircle = null;
  const REPORT_RADIUS = 800; // 800公尺範圍內可通報

  function setLatLng(latlng){
    if(!userLocation) {
      alert('請先等待定位完成');
      return;
    }
    const distance = App.haversineMeters(userLocation, latlng);
    if(distance > REPORT_RADIUS){
      alert(`通報範圍限制：只能在您位置 ${REPORT_RADIUS} 公尺範圍內通報事故`);
      return;
    }
    selectedLatLng = latlng;
    els.coords.value = `${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
    if(pin){ pin.setLatLng(latlng); }
    else { 
      pin = L.marker(latlng, { 
        draggable: true,
        icon: L.divIcon({
          html: '<div style="background:#ef4444;color:#fff;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:12px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);">📍</div>',
          className: 'incident-marker',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        })
      }).addTo(map); 
      pin.on('dragend', () => setLatLng(pin.getLatLng())); 
    }
  }

  map.on('click', (e) => {
    console.log('Map clicked at:', e.latlng); // 除錯用
    setLatLng(e.latlng);
    // 點擊事故位置後直接跳出選單
    openDrawer();
  });

  // 自動定位並設定通報範圍
  function initUserLocation(){
    if(!navigator.geolocation){ 
      alert('此瀏覽器不支援定位，將使用預設位置'); 
      userLocation = { lat: App.DEFAULT_CENTER.lat, lng: App.DEFAULT_CENTER.lng };
      showUserLocation();
      return;
    }
    navigator.geolocation.getCurrentPosition(pos => {
      userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      showUserLocation();
    }, () => {
      alert('無法取得定位，將使用預設位置');
      userLocation = { lat: App.DEFAULT_CENTER.lat, lng: App.DEFAULT_CENTER.lng };
      showUserLocation();
    });
  }

  // 利用地址搜尋地圖
  const addrInput = document.getElementById('addrInput');
  const addrDropdown = document.getElementById('addrDropdown');
  let addrResults = [];
  let addrActive = -1;
  let addrTimer = null;

  function debounce(fn, ms){
    return (...args) => { clearTimeout(addrTimer); addrTimer = setTimeout(() => fn(...args), ms); };
  }

  async function geocode(q){
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', q);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('accept-language', 'zh-TW');
    url.searchParams.set('countrycodes', 'tw');   // 只找台灣；要找全球就刪掉這行
    url.searchParams.set('limit', '8');

    const r = await fetch(url.toString(), { headers: { 'Accept': 'application/json' }});
    if(!r.ok) throw new Error('geocode failed');
    return r.json();
  }

  function renderAddrList(list){
    addrDropdown.innerHTML = '';
    addrActive = -1;
    if(!list.length){ addrDropdown.classList.remove('open'); return; }

    list.forEach((it, idx) => {
      const div = document.createElement('div');
      div.className = 'addr-item';
      const main = it.display_name.split(',').slice(0,2).join('，'); // 前兩段做主標
      const sub  = it.display_name;
      div.innerHTML = `<div>${main}</div><small class="addr-sub">${sub}</small>`;
      div.addEventListener('click', () => pickAddr(idx));
      addrDropdown.appendChild(div);
    });
    addrDropdown.classList.add('open');
  }

  async function doSearch(q){
    if(!q || q.trim().length < 2){ addrDropdown.classList.remove('open'); return; }
    try{
      addrResults = await geocode(q.trim());
      renderAddrList(addrResults);
    }catch(e){
      console.warn(e);
      addrDropdown.classList.remove('open');
    }
  }

  function pickAddr(i){
    const it = addrResults[i];
    if(!it) return;
    const lat = parseFloat(it.lat), lng = parseFloat(it.lon);

    map.setView({lat, lng}, 17);
    setLatLng({lat, lng});   

    addrInput.value = it.display_name;
    addrDropdown.classList.remove('open');
  }

  addrInput.addEventListener('keydown', (e) => {
    const items = Array.from(addrDropdown.querySelectorAll('.addr-item'));
    if(!items.length) return;

    if(e.key === 'ArrowDown'){
      e.preventDefault();
      addrActive = (addrActive + 1) % items.length;
    }else if(e.key === 'ArrowUp'){
      e.preventDefault();
      addrActive = (addrActive - 1 + items.length) % items.length;
    }else if(e.key === 'Enter'){
      e.preventDefault();
      if(addrActive >= 0) pickAddr(addrActive);
      return;
    }else if(e.key === 'Escape'){
      addrDropdown.classList.remove('open');
      return;
    }else{
      return;
    }
    items.forEach((n, i) => n.classList.toggle('active', i === addrActive));
    items[addrActive].scrollIntoView({ block: 'nearest' });
  });

  addrInput.addEventListener('input', debounce((e) => {
    doSearch(e.target.value);
  }, 300));

  document.addEventListener('click', (e) => {
    if(!addrDropdown.contains(e.target) && e.target !== addrInput){
      addrDropdown.classList.remove('open');
    }
  });
  // 利用地址搜尋地圖end

  function showUserLocation(){
    if(!userLocation) return;
    map.setView(userLocation, 15);
    // 顯示使用者位置標記
    L.marker(userLocation, { 
      icon: L.divIcon({
        html: '<div style="background:#10b981;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);">📍</div>',
        className: 'user-location',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      })
    }).addTo(map).bindPopup('您的位置');
    // 顯示通報範圍
    userCircle = L.circle(userLocation, { 
      radius: REPORT_RADIUS, 
      color: '#2563eb', 
      fillColor: '#2563eb', 
      fillOpacity: 0.1,
      weight: 2,
      interactive: false // 讓圓圈不阻擋點擊事件
    }).addTo(map);
    
    // 自動設定座標欄位為使用者目前位置
    selectedLatLng = userLocation;
    els.coords.value = `${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}`;
  }


  function readFileAsDataURL(file){
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  els.photos.addEventListener('change', async () => {
    const files = Array.from(els.photos.files || []);
    photoDataUrls = [];
    els.preview.innerHTML = '';
    for(const f of files.slice(0, 6)){
      const dataUrl = await readFileAsDataURL(f);
      photoDataUrls.push(dataUrl);
      const img = document.createElement('img'); img.className = 'thumb'; img.src = dataUrl; els.preview.appendChild(img);
    }
  });

  els.btnSubmit.onclick = () => {
    if(!selectedLatLng){ alert('請等待定位完成或在地圖上點選事故位置'); return; }
    const title = els.title.value.trim();
    if(!title){ alert('請輸入標題'); return; }
    const incident = {
      title,
      description: els.description.value.trim(),
      type: els.type.value,
      severity: els.severity.value,
      status: 'Reported',
      location: { lat: selectedLatLng.lat, lng: selectedLatLng.lng, address: '' },
      assignedAgency: '',
      source: 'public',
      photos: photoDataUrls
    };
    const saved = App.upsertIncident(incident);
    sessionStorage.setItem('highlightIncidentId', saved.id);
    window.location.href = 'index.html';
  };

  // 頁面載入時自動定位
  initUserLocation();
})();
