(function(){
  const map = L.map('map').setView([App.DEFAULT_CENTER.lat, App.DEFAULT_CENTER.lng], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);

  const markers = new Map();
  const tbody = document.getElementById('tbody');
  const btnClearNotifications = document.getElementById('btnClearNotifications');

  // fullscreen image modal
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);display:none;align-items:center;justify-content:center;z-index:2000;';
  const modalContent = document.createElement('div');
  modalContent.style.cssText = 'position:relative;max-width:95vw;max-height:95vh;display:flex;flex-direction:column;align-items:center;';
  const modalImg = document.createElement('img');
  modalImg.style.cssText = 'max-width:100%;max-height:90vh;object-fit:contain;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,0.5);';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕ 關閉';
  closeBtn.style.cssText = 'position:absolute;top:-40px;right:0;background:#fff;color:#333;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:14px;';
  modalContent.appendChild(modalImg);
  modalContent.appendChild(closeBtn);
  modal.appendChild(modalContent);
  modal.addEventListener('click', (e) => { if(e.target === modal) modal.style.display = 'none'; });
  closeBtn.addEventListener('click', () => modal.style.display = 'none');
  document.body.appendChild(modal);

  function renderMapMarkers(items){
    markers.forEach(m => map.removeLayer(m));
    markers.clear();
    items.forEach(inc => {
      const color = App.severityColor(inc.severity);
      const m = L.circleMarker([inc.location.lat, inc.location.lng], { radius: 7, color, fillColor: color, fillOpacity: 0.5 }).addTo(map);
      m.bindPopup(`<b>${inc.title}</b><br>${App.typeLabel(inc.type)} | ${inc.severity.toUpperCase()} | ${App.statusLabel(inc.status)}`);
      markers.set(inc.id, m);
    });
  }

  function nextStatusOptions(status){
    switch(status){
      case 'Reported': return ['Accepted','Rejected'];
      case 'Accepted': return ['VerifiedWarned','Rejected'];
      case 'VerifiedWarned': return ['Resolved'];
      case 'Resolved': return [];
      case 'Rejected': return [];
      default: return [];
    }
  }

  function render(){
    const list = App.getIncidents();
    tbody.innerHTML = '';
    list.forEach(inc => {
      const tr = document.createElement('tr');
      const tdTitle = document.createElement('td');
      tdTitle.innerHTML = `<div>${inc.title}</div>`;
      if(Array.isArray(inc.photos) && inc.photos.length){
        const thumbs = document.createElement('div'); thumbs.className = 'thumb-list';
        inc.photos.forEach(p => { 
          const img=document.createElement('img'); 
          img.className='thumb'; 
          img.src=p; 
          img.style.cursor='zoom-in'; 
          img.onclick=()=>{ 
            modalImg.src=p; 
            modal.style.display='flex'; 
          }; 
          thumbs.appendChild(img); 
        });
        tdTitle.appendChild(thumbs);
      }
      tr.appendChild(tdTitle);

      const tdType = document.createElement('td'); tdType.textContent = App.typeLabel(inc.type); tr.appendChild(tdType);
      const tdSev = document.createElement('td'); tdSev.textContent = inc.severity.toUpperCase(); tr.appendChild(tdSev);
      const tdStatus = document.createElement('td'); 
      const statusSpan = document.createElement('span');
      statusSpan.textContent = App.statusLabel(inc.status);
      statusSpan.className = `badge status-${inc.status}`;
      tdStatus.appendChild(statusSpan);
      tr.appendChild(tdStatus);

      const tdAssign = document.createElement('td');
      const inp = document.createElement('input'); inp.type = 'text'; inp.value = inc.assignedAgency || ''; inp.placeholder = '例如：消防局第二大隊';
      inp.onchange = () => { App.upsertIncident({ id: inc.id, assignedAgency: inp.value }); render(); };
      tdAssign.appendChild(inp); tr.appendChild(tdAssign);

      const tdAct = document.createElement('td');
      const select = document.createElement('select');
      const opts = nextStatusOptions(inc.status);
      const def = document.createElement('option'); def.value=''; def.text='變更狀態'; select.appendChild(def);
      opts.forEach(s => { const o=document.createElement('option'); o.value=s; o.text=s; select.appendChild(o); });
      const btnMap = document.createElement('button'); btnMap.textContent = '查看'; btnMap.className='ghost';
      btnMap.onclick = () => { const m = markers.get(inc.id); if(m){ map.setView(m.getLatLng(), 16); m.openPopup(); } };
      const btnWarn = document.createElement('button'); btnWarn.textContent = '發出警示';
      btnWarn.onclick = () => { const updated = App.upsertIncident({ id: inc.id, status: 'VerifiedWarned' }); App.notifyForIncident(updated); render(); };
      select.onchange = () => {
        const newStatus = select.value;
        if(!newStatus) return;
        const updated = App.upsertIncident({ id: inc.id, status: newStatus });
        if(newStatus === 'VerifiedWarned'){ App.notifyForIncident(updated); }
        render();
      };
      tdAct.appendChild(select);
      tdAct.appendChild(btnMap);
      tdAct.appendChild(btnWarn);
      tr.appendChild(tdAct);

      tbody.appendChild(tr);
    });

    renderMapMarkers(App.getIncidents());
  }

  btnClearNotifications.onclick = () => { App.clearNotifications(); alert('已清空通知'); };

  render();
})();
