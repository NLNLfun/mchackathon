(function(){
const map = L.map('map').setView([App.DEFAULT_CENTER.lat, App.DEFAULT_CENTER.lng], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);

const els = {
    drawer: document.getElementById('drawer'),
    overlay: document.getElementById('drawerOverlay'),
    btnMenu: document.getElementById('btnMenu'),
    range: document.getElementById('range'),
    type: document.getElementById('filterType'),
    sev: document.getElementById('filterSeverity'),
    list: document.getElementById('list'),
    btnExport: document.getElementById('btnExport')
};

function openDrawer(){ els.drawer.classList.add('open'); }
function closeDrawer(){ els.drawer.classList.remove('open'); }
els.btnMenu.addEventListener('click', openDrawer);
els.overlay.addEventListener('click', closeDrawer);

const markers = [];
function clearMarkers(){ markers.splice(0).forEach(m => map.removeLayer(m)); }

function windowMs(key){
    if(key === '8h') return 8*60*60*1000;
    if(key === '24h') return 24*60*60*1000;
    return 7*24*60*60*1000; // 7d
}

function getFiltered(){
    const all = App.getIncidents();
    const win = windowMs(els.range.value);
    return all.filter(x => {
    if(x.status !== 'Resolved') return false;
    if(!App.withinMs(x.resolvedAt, win)) return false;
    if(els.type.value && x.type !== els.type.value) return false;
    if(els.sev.value && x.severity !== els.sev.value) return false;
    return true;
    }).sort((a,b) => (b.resolvedAt||0) - (a.resolvedAt||0));
}

function renderMap(items){
    clearMarkers();
    items.forEach(inc => {
    if(!inc.location) return;
    const m = L.circleMarker([inc.location.lat, inc.location.lng], {
        radius: 6,
        color: App.severityColor(inc.severity),
        fillColor: App.severityColor(inc.severity),
        fillOpacity: .5
    }).addTo(map);
    m.bindPopup(`
        <b>${escapeHtml(inc.title || '(未命名案件)')}</b><br>
        ${App.typeLabel(inc.type)}｜${inc.severity.toUpperCase()}｜<span style="color:${App.statusColor(inc.status)}">${App.statusLabel(inc.status)}</span><br>
        結案時間：${fmt(inc.resolvedAt)}<br>
        <small>${escapeHtml(inc.description || '')}</small>
    `);
    markers.push(m);
    });

    const pts = items.filter(i => i.location).map(i => [i.location.lat, i.location.lng]);
    if(pts.length){
    const bounds = L.latLngBounds(pts);
    map.fitBounds(bounds.pad(0.2));
    }
}

function renderList(items){
    els.list.innerHTML = '';
    if(items.length === 0){
    els.list.innerHTML = '<li class="empty">這段期間沒有已結案案件</li>';
    return;
    }
    items.forEach(inc => {
    const li = document.createElement('li');
    li.innerHTML = `
        <div class="title">${escapeHtml(inc.title || '(未命名案件)')}</div>
        <div class="meta">
        <span class="badge" style="border-color:${App.severityColor(inc.severity)}">${inc.severity.toUpperCase()}</span>
        <span class="badge">${App.typeLabel(inc.type)}</span>
        <span class="badge">結案：${fmt(inc.resolvedAt)}</span>
        </div>
        <div class="helper">建立：${fmt(inc.createdAt)}　更新：${fmt(inc.updatedAt)}</div>
    `;
    li.onclick = () => {
        if(!inc.location) return;
        map.setView([inc.location.lat, inc.location.lng], 16);
    };
    els.list.appendChild(li);
    });
}

function exportCSV(items){
    const header = ['id','type','severity','title','description','lat','lng','createdAt','acceptedAt','verifiedAt','resolvedAt','rejectedAt','status','assignedAgency','source'];
    const lines = [header.join(',')].concat(
    items.map(x => {
        const row = {
        id: x.id || '',
        type: x.type || '',
        severity: x.severity || '',
        title: x.title || '',
        description: (x.description || '').replace(/\s+/g,' ').trim(),
        lat: x.location?.lat ?? '',
        lng: x.location?.lng ?? '',
        createdAt: x.createdAt || '',
        acceptedAt: x.acceptedAt || '',
        verifiedAt: x.verifiedAt || '',
        resolvedAt: x.resolvedAt || '',
        rejectedAt: x.rejectedAt || '',
        status: x.status || '',
        assignedAgency: x.assignedAgency || '',
        source: x.source || ''
        };
        return header.map(k => `"${String(row[k]).replace(/"/g,'""')}"`).join(',');
    })
    );
    const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const label = els.range.value;
    a.download = `resolved_${label}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function escapeHtml(s=''){ return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function fmt(ts){ try{ return ts ? new Date(ts).toLocaleString() : ''; } catch{ return ''; } }

function refresh(){
    const items = getFiltered();
    renderMap(items);
    renderList(items);
    els.btnExport.onclick = () => exportCSV(items);
}

[els.range, els.type, els.sev].forEach(el => el.addEventListener('change', refresh));

refresh();
})();
