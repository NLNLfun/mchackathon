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

  els.btnSubmit.onclick = async () => {
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

    try {
      const saved = App.upsertIncident(incident); // 確保 await
      console.log("App.upsertIncident 回傳:", saved);

      // await axios.post('http://localhost:5678/webhook-test/report', incident);
      const res = await fetch('http://localhost:5678/webhook-test/report', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(incident)
      });
      console.log('Passed data to n8n.', await res.json());

      alert('已送出通報，案件編號：' + saved.id + '\n將跳轉至審核頁面');
      window.location.href = 'admin.html';

    } catch(err) {
      console.error('送出通報失敗', err);
      alert('送出通報失敗，請查看 console log');
    }
  };

  // 頁面載入時自動定位
  initUserLocation();
})();
