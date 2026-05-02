const $ = (id) => document.getElementById(id);
const money = (n) => Number(n || 0).toLocaleString('en-US', { style:'currency', currency:'USD' });
const today = () => new Date().toISOString().slice(0,10);

const STORE = 'legal_billing_docs_v2';
const SETTINGS = 'legal_billing_settings_v2';
let docs = JSON.parse(localStorage.getItem(STORE) || '[]');
let editingId = null;
let settings = JSON.parse(localStorage.getItem(SETTINGS) || '{}');

const internalDefaults = {
  invoicePrefix:'FAC',
  quotePrefix:'COT',
  summonsPrefix:'EMP',
  collectionPrefix:'COB'
};

function toast(msg){
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=>el.classList.remove('show'), 2200);
}
function val(id){ return ($(id)?.value || '').trim(); }
function saveAll(){ localStorage.setItem(STORE, JSON.stringify(docs)); renderHistory(); renderStats(); }
function saveSettings(){ localStorage.setItem(SETTINGS, JSON.stringify(settings)); }
function prefixFor(type){
  if(type === 'Cotización') return settings.quotePrefix || internalDefaults.quotePrefix;
  if(type === 'Factura') return settings.invoicePrefix || internalDefaults.invoicePrefix;
  if(type === 'Emplazamiento') return settings.summonsPrefix || internalDefaults.summonsPrefix;
  return settings.collectionPrefix || internalDefaults.collectionPrefix;
}
function nextNumber(type){
  const prefix = prefixFor(type);
  const year = new Date().getFullYear();
  const count = docs.filter(d => d.number?.startsWith(`${prefix}-${year}`)).length + 1;
  return `${prefix}-${year}-${String(count).padStart(4,'0')}`;
}

function setView(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.dataset.view === id));
  $(id).classList.add('active');
  window.scrollTo({top:0, behavior:'smooth'});
}

document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
document.querySelectorAll('[data-jump]').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.jump)));
document.querySelectorAll('[data-new-type]').forEach(btn => btn.addEventListener('click', () => {
  resetForm();
  $('docType').value = btn.dataset.newType;
  $('docNumber').value = nextNumber(btn.dataset.newType);
  setView('form');
}));
$('btnSettings').onclick = () => setView('settings');

function addItemRow(item={desc:'', qty:1, price:0}){
  const row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `
    <label>Descripción<input class="i-desc" value="${escapeHtml(item.desc)}" placeholder="Servicio / concepto" /></label>
    <label>Cant.<input class="i-qty" type="number" step="0.01" value="${Number(item.qty ?? 1)}" /></label>
    <label>Precio<input class="i-price" type="number" step="0.01" value="${Number(item.price ?? 0)}" /></label>
    <button type="button" title="Eliminar">×</button>`;
  row.querySelector('button').onclick = () => { row.remove(); calcTotals(); };
  row.querySelectorAll('input').forEach(i => i.addEventListener('input', calcTotals));
  $('items').appendChild(row);
  calcTotals();
}

function getItems(){
  return [...document.querySelectorAll('.item-row')].map(row => ({
    desc: row.querySelector('.i-desc').value.trim(),
    qty: Number(row.querySelector('.i-qty').value || 0),
    price: Number(row.querySelector('.i-price').value || 0)
  })).filter(i => i.desc || i.qty || i.price);
}

function calcTotals(){
  const items = getItems();
  const subtotal = items.reduce((s,i)=>s + (i.qty * i.price), 0);
  const tax = $('taxEnabled').checked ? subtotal * (Number($('taxRate').value || 0) / 100) : 0;
  const total = subtotal + tax;
  $('subtotalView').textContent = money(subtotal);
  $('taxView').textContent = money(tax);
  $('totalView').textContent = money(total);
  return { subtotal, tax, total };
}

function collectDoc(){
  const totals = calcTotals();
  return {
    id: editingId || crypto.randomUUID(),
    type: $('docType').value,
    number: val('docNumber'),
    date: $('docDate').value,
    status: $('status').value,
    clientName: val('clientName'),
    clientPhone: val('clientPhone'),
    clientEmail: val('clientEmail'),
    clientAddress: val('clientAddress'),
    caseNumber: val('caseNumber'),
    court: val('court'),
    items: getItems(),
    notes: val('notes'),
    taxEnabled: $('taxEnabled').checked,
    taxRate: Number($('taxRate').value || 0),
    ...totals,
    updatedAt: new Date().toISOString()
  };
}

function loadDoc(doc){
  editingId = doc.id;
  $('formTitle').textContent = `Editando ${doc.number || 'documento'}`;
  $('docType').value = doc.type || 'Factura'; $('docNumber').value = doc.number || nextNumber(doc.type || 'Factura'); $('docDate').value = doc.date || today();
  $('status').value = doc.status || 'Pendiente'; $('clientName').value = doc.clientName || '';
  $('clientPhone').value = doc.clientPhone || ''; $('clientEmail').value = doc.clientEmail || '';
  $('clientAddress').value = doc.clientAddress || ''; $('caseNumber').value = doc.caseNumber || '';
  $('court').value = doc.court || ''; $('notes').value = doc.notes || '';
  $('taxEnabled').checked = doc.taxEnabled !== false; $('taxRate').value = doc.taxRate ?? 11.5;
  $('items').innerHTML = ''; (doc.items || []).forEach(addItemRow); if(!doc.items?.length) addItemRow();
  calcTotals(); setView('form');
}

function resetForm(){
  editingId = null;
  $('formTitle').textContent = 'Nuevo documento';
  $('docForm').reset();
  $('docDate').value = today();
  $('docNumber').value = nextNumber($('docType').value || 'Factura');
  $('taxEnabled').checked = true;
  $('taxRate').value = 11.5;
  $('items').innerHTML = '';
  addItemRow({desc:'', qty:1, price:0});
  calcTotals();
}

$('docType').addEventListener('change', () => { if(!editingId) $('docNumber').value = nextNumber($('docType').value); });
$('addItem').onclick = () => addItemRow();
$('btnReset').onclick = resetForm;
['taxEnabled','taxRate'].forEach(id => $(id).addEventListener('input', calcTotals));

$('docForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const doc = collectDoc();
  if(!doc.number || !doc.date || !doc.clientName){ toast('Faltan número, fecha o cliente.'); return; }
  const idx = docs.findIndex(d => d.id === doc.id);
  if(idx >= 0) docs[idx] = doc; else docs.unshift(doc);
  saveAll(); editingId = doc.id; $('formTitle').textContent = `Editando ${doc.number}`; toast('Documento guardado.');
});

function renderStats(){
  $('statDocs').textContent = docs.length;
  $('statPending').textContent = money(docs.filter(d => d.status !== 'Pagado' && d.status !== 'Cancelado').reduce((s,d)=>s+Number(d.total || 0),0));
  $('statPaid').textContent = money(docs.filter(d => d.status === 'Pagado').reduce((s,d)=>s+Number(d.total || 0),0));
}

function renderHistory(){
  const q = ($('search')?.value || '').toLowerCase();
  const status = $('statusFilter')?.value || '';
  const list = $('historyList'); list.innerHTML = '';
  const filtered = docs.filter(d => {
    const matchesText = [d.clientName,d.number,d.caseNumber,d.type,d.court].join(' ').toLowerCase().includes(q);
    const matchesStatus = !status || d.status === status;
    return matchesText && matchesStatus;
  });
  if(!filtered.length){ list.innerHTML = '<p class="empty-state">No hay documentos para mostrar.</p>'; return; }
  filtered.forEach(doc => {
    const el = document.createElement('article'); el.className = 'doc-card';
    const safeStatus = escapeHtml(doc.status || 'Pendiente');
    el.innerHTML = `
      <div class="doc-card-top"><div><h4>${escapeHtml(doc.number || 'Sin número')} · ${escapeHtml(doc.clientName || 'Sin cliente')}</h4><p class="doc-meta">${escapeHtml(doc.type || '')} · ${escapeHtml(doc.date || '')} · Caso: ${escapeHtml(doc.caseNumber || 'N/A')}</p></div><span class="badge ${safeStatus}">${safeStatus}</span></div>
      <div class="doc-total">${money(doc.total)}</div>
      <div class="doc-actions">
        <button data-act="edit">Editar</button><button data-act="pdf">PDF</button><button data-act="paid">Pagada</button><button data-act="delete">Borrar</button>
      </div>`;
    el.querySelector('[data-act="edit"]').onclick = () => loadDoc(doc);
    el.querySelector('[data-act="pdf"]').onclick = () => makePdf(doc, true);
    el.querySelector('[data-act="paid"]').onclick = () => { doc.status='Pagado'; doc.updatedAt = new Date().toISOString(); saveAll(); toast('Marcada como pagada.'); };
    el.querySelector('[data-act="delete"]').onclick = () => { if(confirm('¿Borrar documento?')){ docs = docs.filter(d => d.id !== doc.id); saveAll(); toast('Documento borrado.'); } };
    list.appendChild(el);
  });
}
$('search').addEventListener('input', renderHistory);
$('statusFilter').addEventListener('change', renderHistory);

function businessLine(){
  return [settings.bizAddress, settings.bizPhone, settings.bizEmail].filter(Boolean).join('  |  ');
}

function makePdf(doc = collectDoc(), save = false){
  if(!window.jspdf){ toast('No cargó jsPDF. Abre con internet la primera vez.'); return; }
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit:'pt', format:'letter' });
  const w = pdf.internal.pageSize.getWidth();
  const margin = 42;
  const bizName = settings.bizName || '';
  const bizInfo = businessLine();

  pdf.setFillColor(8,9,13); pdf.rect(0,0,w,98,'F');
  pdf.setFillColor(247,201,72); pdf.rect(0,96,w,2,'F');
  pdf.setTextColor(247,201,72); pdf.setFont('helvetica','bold'); pdf.setFontSize(18);
  pdf.text(bizName || ' ', margin, 36);
  pdf.setTextColor(230,230,230); pdf.setFontSize(9); pdf.setFont('helvetica','normal');
  if(bizInfo) pdf.text(bizInfo, margin, 58, {maxWidth:w-margin*2});
  pdf.setTextColor(255,255,255); pdf.setFont('helvetica','bold'); pdf.setFontSize(20); pdf.text((doc.type || 'Documento').toUpperCase(), w-margin, 38, {align:'right'});
  pdf.setFontSize(10); pdf.text(doc.number || '', w-margin, 60, {align:'right'});

  let y = 124;
  pdf.setTextColor(20,20,20); pdf.setFontSize(11); pdf.setFont('helvetica','bold'); pdf.text('CLIENTE / PARTE', margin, y);
  pdf.setFont('helvetica','normal'); y += 18;
  pdf.text(doc.clientName || 'N/A', margin, y); y += 15;
  pdf.text(`${doc.clientPhone || ''} ${doc.clientEmail || ''}`.trim() || 'N/A', margin, y); y += 15;
  pdf.text(doc.clientAddress || 'N/A', margin, y, {maxWidth:260});

  pdf.setFont('helvetica','bold'); pdf.text('DETALLE', w/2 + 20, 124);
  pdf.setFont('helvetica','normal');
  pdf.text(`Fecha: ${doc.date || today()}`, w/2 + 20, 142);
  pdf.text(`Estatus: ${doc.status || 'Pendiente'}`, w/2 + 20, 157);
  pdf.text(`Caso/Ref.: ${doc.caseNumber || 'N/A'}`, w/2 + 20, 172);
  pdf.text(`Tribunal/Agencia: ${doc.court || 'N/A'}`, w/2 + 20, 187, {maxWidth:230});

  pdf.autoTable({
    startY: 224,
    head: [['Descripción','Cant.','Precio','Total']],
    body: (doc.items || []).map(i => [i.desc || '', i.qty || 0, money(i.price), money((i.qty || 0)*(i.price || 0))]),
    theme:'grid',
    headStyles:{fillColor:[8,9,13],textColor:[247,201,72]},
    styles:{fontSize:9,cellPadding:7,lineColor:[220,220,220]},
    columnStyles:{1:{halign:'right'},2:{halign:'right'},3:{halign:'right'}}
  });
  y = pdf.lastAutoTable.finalY + 18;
  const rightX = w - margin;
  pdf.setFont('helvetica','normal'); pdf.setTextColor(30,30,30); pdf.setFontSize(10);
  pdf.text('Subtotal', rightX - 140, y); pdf.text(money(doc.subtotal), rightX, y, {align:'right'}); y += 16;
  pdf.text(`IVU ${doc.taxEnabled ? doc.taxRate : 0}%`, rightX - 140, y); pdf.text(money(doc.tax), rightX, y, {align:'right'}); y += 22;
  pdf.setFont('helvetica','bold'); pdf.setFontSize(15); pdf.text('TOTAL', rightX - 140, y); pdf.text(money(doc.total), rightX, y, {align:'right'});

  const noteText = doc.notes || settings.legalNote || '';
  if(noteText){
    y += 36; pdf.setFontSize(10); pdf.setFont('helvetica','bold'); pdf.text('Notas / términos', margin, y); y += 14;
    pdf.setFont('helvetica','normal'); pdf.setTextColor(50,50,50);
    pdf.text(noteText, margin, y, {maxWidth:w-margin*2});
  }

  const footerY = 720;
  pdf.setDrawColor(170); pdf.line(margin, footerY, 250, footerY); pdf.line(w-250, footerY, w-margin, footerY);
  pdf.setFontSize(9); pdf.setTextColor(80); pdf.text('Firma autorizada', margin, footerY+14); pdf.text('Firma cliente / recibido', w-250, footerY+14);
  const name = `${doc.number || 'documento'}-${(doc.clientName || 'cliente').replaceAll(' ','_')}.pdf`;
  if(save) pdf.save(name);
  return pdf;
}

$('btnPdf').onclick = () => makePdf(collectDoc(), true);
$('btnShare').onclick = async () => {
  const doc = collectDoc(); const pdf = makePdf(doc, false); if(!pdf) return;
  const blob = pdf.output('blob'); const file = new File([blob], `${doc.number || 'documento'}.pdf`, {type:'application/pdf'});
  if(navigator.canShare && navigator.canShare({files:[file]})) await navigator.share({title:doc.number || 'Documento', text:`${doc.type} ${doc.number}`, files:[file]});
  else { pdf.save(`${doc.number || 'documento'}.pdf`); toast('Compartir directo no disponible. Se descargó el PDF.'); }
};

function loadSettingsForm(){
  ['bizName','bizPhone','bizEmail','bizAddress','invoicePrefix','quotePrefix','summonsPrefix','collectionPrefix','legalNote'].forEach(id => $(id).value = settings[id] || '');
}
$('saveSettings').onclick = (e)=>{
  e.preventDefault();
  ['bizName','bizPhone','bizEmail','bizAddress','invoicePrefix','quotePrefix','summonsPrefix','collectionPrefix','legalNote'].forEach(id => settings[id] = val(id));
  saveSettings(); toast('Ajustes guardados.'); resetForm();
};
$('clearAll').onclick = (e)=>{
  e.preventDefault();
  if(confirm('Esto borra historial y ajustes locales de este navegador.')){
    localStorage.removeItem(STORE); localStorage.removeItem(SETTINGS); docs=[]; settings={}; saveAll(); loadSettingsForm(); resetForm(); toast('Datos locales borrados.');
  }
};
$('exportJson').onclick = () => {
  const blob = new Blob([JSON.stringify({settings, docs}, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'backup-legal-billing.json'; a.click(); URL.revokeObjectURL(a.href);
};
function escapeHtml(str=''){ return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

if('serviceWorker' in navigator){ window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(()=>{})); }
loadSettingsForm(); resetForm(); renderHistory(); renderStats();
