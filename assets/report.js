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
    btnLocate: document.getElementById('btnLocate'),
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

  function setLatLng(latlng){
    selectedLatLng = latlng;
    els.coords.value = `${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
    if(pin){ pin.setLatLng(latlng); }
    else { pin = L.marker(latlng, { draggable: true }).addTo(map); pin.on('dragend', () => setLatLng(pin.getLatLng())); }
  }

  map.on('click', (e) => setLatLng(e.latlng));

  els.btnLocate.onclick = async () => {
    if(!navigator.geolocation){ alert('此瀏覽器不支援定位'); return; }
    navigator.geolocation.getCurrentPosition(pos => {
      const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      map.setView(latlng, 16);
      setLatLng(latlng);
    }, () => alert('無法取得定位'));
  };

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
    if(!selectedLatLng){ alert('請在地圖上點選事故位置或使用目前位置'); return; }
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
    alert('已送出通報，案件編號：' + saved.id);
    window.location.href = 'index.html';
  };
})();
