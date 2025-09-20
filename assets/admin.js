(function(){
  const map = L.map('map').setView([App.DEFAULT_CENTER.lat, App.DEFAULT_CENTER.lng], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);

  const markers = new Map();
  const tbody = document.getElementById('tbody');
  const btnClearNotifications = document.getElementById('btnClearNotifications');
  const selectAll = document.getElementById('selectAll');
  const batchControls = document.getElementById('batchControls');
  const batchInfo = document.getElementById('batchInfo');
  const auditLog = document.getElementById('auditLog');
  
  let selectedIncidents = new Set();

  // 審核歷史記錄功能
  function addAuditLog(incidentId, action, details, oldValue = null, newValue = null){
    const auditLogs = JSON.parse(localStorage.getItem('auditLogs') || '[]');
    const auditEntry = {
      id: generateId('audit'),
      incidentId: incidentId,
      action: action,
      details: details,
      oldValue: oldValue,
      newValue: newValue,
      timestamp: Date.now(),
      user: 'Admin' // 在真實系統中會是實際的用戶名
    };
    auditLogs.unshift(auditEntry);
    localStorage.setItem('auditLogs', JSON.stringify(auditLogs.slice(0, 1000))); // 保留最近1000條記錄
    renderAuditLog();
  }

  function generateId(prefix){
    return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function renderAuditLog(){
    const auditLogs = JSON.parse(localStorage.getItem('auditLogs') || '[]');
    auditLog.innerHTML = '';
    
    if(auditLogs.length === 0){
      auditLog.innerHTML = '<div class="empty-notification">暫無審核記錄</div>';
      return;
    }

    auditLogs.slice(0, 20).forEach(log => { // 只顯示最近20條
      const div = document.createElement('div');
      div.className = 'audit-item';
      
      const time = new Date(log.timestamp).toLocaleString();
      const changeText = log.oldValue && log.newValue ? 
        ` (${log.oldValue} → ${log.newValue})` : '';
      
      div.innerHTML = `
        <div class="audit-time">${time}</div>
        <div class="audit-action">${log.action}</div>
        <div class="audit-details">${log.details}${changeText}</div>
      `;
      
      auditLog.appendChild(div);
    });
  }

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
      tr.dataset.incidentId = inc.id;
      
      // 添加選擇框
      const tdSelect = document.createElement('td');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selectedIncidents.has(inc.id);
      checkbox.addEventListener('change', () => {
        if(checkbox.checked){
          selectedIncidents.add(inc.id);
        } else {
          selectedIncidents.delete(inc.id);
        }
        updateBatchControls();
      });
      tdSelect.appendChild(checkbox);
      tr.appendChild(tdSelect);
      
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
      // 為標題添加點擊事件，讓標題可點擊來顯示地圖位置
      tdTitle.style.cursor = 'pointer';
      tdTitle.onclick = () => {
        const m = markers.get(inc.id);
        if(m){ 
          map.setView(m.getLatLng(), 16); 
          m.openPopup(); 
        }
      };
      tr.appendChild(tdTitle);

      const tdType = document.createElement('td'); tdType.textContent = App.typeLabel(inc.type); tr.appendChild(tdType);
      
      // 嚴重度編輯欄位
      const tdSev = document.createElement('td');
      const severitySelect = document.createElement('select');
      severitySelect.style.cssText = 'width: 100%; padding: 4px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;';
      
      const severityOptions = [
        { value: 'low', text: 'LOW' },
        { value: 'medium', text: 'MEDIUM' },
        { value: 'high', text: 'HIGH' }
      ];
      
      severityOptions.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.text;
        if(opt.value === inc.severity) option.selected = true;
        severitySelect.appendChild(option);
      });
      
      severitySelect.onchange = () => {
        const newSeverity = severitySelect.value;
        const oldSeverity = inc.severity;
        App.upsertIncident({ id: inc.id, severity: newSeverity });
        addAuditLog(inc.id, '修改嚴重度', `事故「${inc.title}」嚴重度變更`, oldSeverity, newSeverity);
        render(); // 重新渲染以更新地圖標記顏色
      };
      
      tdSev.appendChild(severitySelect);
      tr.appendChild(tdSev);
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

  // 批量操作功能
  function updateBatchControls(){
    const count = selectedIncidents.size;
    if(count > 0){
      batchControls.classList.remove('hidden');
      batchInfo.textContent = `已選擇 ${count} 個項目`;
    } else {
      batchControls.classList.add('hidden');
    }
  }

  function performBatchAction(action){
    if(selectedIncidents.size === 0) return;
    
    const actionText = {
      'accept': '批量接受',
      'reject': '批量拒絕', 
      'resolve': '批量結案'
    };
    
    if(!confirm(`確定要${actionText[action]} ${selectedIncidents.size} 個事故嗎？`)){
      return;
    }

    const incidents = App.getIncidents();
    selectedIncidents.forEach(id => {
      const incident = incidents.find(inc => inc.id === id);
      if(incident){
        const oldStatus = incident.status;
        let newStatus;
        
        switch(action){
          case 'accept':
            newStatus = 'Accepted';
            break;
          case 'reject':
            newStatus = 'Rejected';
            break;
          case 'resolve':
            newStatus = 'Resolved';
            break;
        }
        
        App.upsertIncident({ id: id, status: newStatus });
        addAuditLog(id, `批量${actionText[action]}`, `事故「${incident.title}」狀態變更`, oldStatus, newStatus);
      }
    });
    
    selectedIncidents.clear();
    updateBatchControls();
    render();
  }

  // 事件監聽器
  btnClearNotifications.onclick = () => { App.clearNotifications(); alert('已清空通知'); };
  
  selectAll.addEventListener('change', (e) => {
    const checkboxes = tbody.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
      cb.checked = e.target.checked;
      if(e.target.checked){
        selectedIncidents.add(cb.closest('tr').dataset.incidentId);
      } else {
        selectedIncidents.delete(cb.closest('tr').dataset.incidentId);
      }
    });
    updateBatchControls();
  });

  document.getElementById('batchAccept').addEventListener('click', () => performBatchAction('accept'));
  document.getElementById('batchReject').addEventListener('click', () => performBatchAction('reject'));
  document.getElementById('batchResolve').addEventListener('click', () => performBatchAction('resolve'));
  document.getElementById('batchCancel').addEventListener('click', () => {
    selectedIncidents.clear();
    selectAll.checked = false;
    updateBatchControls();
    render();
  });

  render();
  renderAuditLog();
})();
