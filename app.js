const $ = (id) => document.getElementById(id);
const money = (n) => Number(n || 0).toLocaleString('en-US', { style:'currency', currency:'USD' });
const today = () => new Date().toISOString().slice(0,10);

const STORE = 'nexus_legal_docs_v1';
const SETTINGS = 'nexus_legal_settings_v1';
let docs = JSON.parse(localStorage.getItem(STORE) || '[]');
let editingId = null;
let settings = JSON.parse(localStorage.getItem(SETTINGS) || '{}');

const defaults = {
  bizName:'Oasis Air Cleaner Services LLC',
  bizPhone:'787-664-3079',
  bizEmail:'servicios@oasisservicespr.com',
  bizAddress:'HC 645 Box 7097, Trujillo Alto, PR 00976',
  invoicePrefix:'FAC',
  quotePrefix:'COT',
  legalNote:'Documento preparado para fines administrativos y de cobro. Las gestiones legales, emplazamientos o diligenciamientos deben validarse conforme a las reglas aplicables y la autorización correspondiente.'
};
settings = {...defaults, ...settings};

function saveAll(){ localStorage.setItem(STORE, JSON.stringify(docs)); renderHistory(); renderStats(); }
function saveSettings(){ localStorage.setItem(SETTINGS, JSON.stringify(settings)); }
function nextNumber(type){
  const prefix = type === 'Cotización' ? settings.quotePrefix : type === 'Factura' ? settings.invoicePrefix : type === 'Emplazamiento' ? 'EMP' : 'COB';
  const year = new Date().getFullYear();
  const count = docs.filter(d => d.number?.startsWith(`${prefix}-${year}`)).length + 1;
  return `${prefix}-${year}-${String(count).padStart(4,'0')}`;
}

function setView(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.dataset.view === id));
  $(id).classList.add('active');
}

document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
document.querySelectorAll('[data-jump]').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.jump)));
$('btnSettings').onclick = () => setView('settings');

function addItemRow(item={desc:'', qty:1, price:0}){
  const row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `
    <label>Descripción<input class="i-desc" value="${escapeHtml(item.desc)}" placeholder="Servicio / concepto" /></label>
    <label>Cant.<input class="i-qty" type="number" step="0.01" value="${item.qty}" /></label>
    <label>Precio<input class="i-price" type="number" step="0.01" value="${item.price}" /></label>
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
    number: $('docNumber').value.trim(),
    date: $('docDate').value,
    status: $('status').value,
    clientName: $('clientName').value.trim(),
    clientPhone: $('clientPhone').value.trim(),
    clientEmail: $('clientEmail').value.trim(),
    clientAddress: $('clientAddress').value.trim(),
    caseNumber: $('caseNumber').value.trim(),
    court: $('court').value.trim(),
    items: getItems(),
    notes: $('notes').value.trim(),
    taxEnabled: $('taxEnabled').checked,
    taxRate: Number($('taxRate').value || 0),
    ...totals,
    updatedAt: new Date().toISOString()
  };
}

function loadDoc(doc){
  editingId = doc.id;
  $('docType').value = doc.type; $('docNumber').value = doc.number; $('docDate').value = doc.date;
  $('status').value = doc.status || 'Pendiente'; $('clientName').value = doc.clientName || '';
  $('clientPhone').value = doc.clientPhone || ''; $('clientEmail').value = doc.clientEmail || '';
  $('clientAddress').value = doc.clientAddress || ''; $('caseNumber').value = doc.caseNumber || '';
  $('court').value = doc.court || ''; $('notes').value = doc.notes || '';
  $('taxEnabled').checked = doc.taxEnabled !== false; $('taxRate').value = doc.taxRate ?? 11.5;
  $('items').innerHTML = ''; (doc.items || []).forEach(addItemRow); if(!doc.items?.length) addItemRow();
  calcTotals(); setView('form');
}

function resetForm(){
  editingId = null; $('docForm').reset(); $('docDate').value = today(); $('docNumber').value = nextNumber($('docType').value);
  $('items').innerHTML = ''; addItemRow({desc:'Gestión / servicio profesional', qty:1, price:0}); calcTotals();
}

$('docType').addEventListener('change', () => { if(!editingId) $('docNumber').value = nextNumber($('docType').value); });
$('addItem').onclick = () => addItemRow();
$('btnReset').onclick = resetForm;
['taxEnabled','taxRate'].forEach(id => $(id).addEventListener('input', calcTotals));

$('docForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const doc = collectDoc();
  const idx = docs.findIndex(d => d.id === doc.id);
  if(idx >= 0) docs[idx] = doc; else docs.unshift(doc);
  saveAll(); editingId = doc.id; alert('Documento guardado.');
});

function renderStats(){
  $('statDocs').textContent = docs.length;
  $('statPending').textContent = money(docs.filter(d => d.status !== 'Pagado' && d.status !== 'Cancelado').reduce((s,d)=>s+d.total,0));
  $('statPaid').textContent = money(docs.filter(d => d.status === 'Pagado').reduce((s,d)=>s+d.total,0));
}

function renderHistory(){
  const q = ($('search')?.value || '').toLowerCase();
  const list = $('historyList'); list.innerHTML = '';
  const filtered = docs.filter(d => [d.clientName,d.number,d.caseNumber,d.type].join(' ').toLowerCase().includes(q));
  if(!filtered.length){ list.innerHTML = '<p class="sub">No hay documentos.</p>'; return; }
  filtered.forEach(doc => {
    const el = document.createElement('article'); el.className = 'doc-card';
    el.innerHTML = `
      <div class="doc-card-top"><div><h4>${escapeHtml(doc.number)} · ${escapeHtml(doc.clientName)}</h4><p class="doc-meta">${escapeHtml(doc.type)} · ${escapeHtml(doc.date)} · Caso: ${escapeHtml(doc.caseNumber || 'N/A')}</p></div><span class="badge">${escapeHtml(doc.status)}</span></div>
      <div class="doc-total">${money(doc.total)}</div>
      <div class="doc-actions">
        <button data-act="edit">Editar</button><button data-act="pdf">PDF</button><button data-act="paid">Pagada</button><button data-act="delete">Borrar</button>
      </div>`;
    el.querySelector('[data-act="edit"]').onclick = () => loadDoc(doc);
    el.querySelector('[data-act="pdf"]').onclick = () => makePdf(doc, true);
    el.querySelector('[data-act="paid"]').onclick = () => { doc.status='Pagado'; saveAll(); };
    el.querySelector('[data-act="delete"]').onclick = () => { if(confirm('¿Borrar documento?')){ docs = docs.filter(d => d.id !== doc.id); saveAll(); } };
    list.appendChild(el);
  });
}
$('search').addEventListener('input', renderHistory);

function makePdf(doc = collectDoc(), save = false){
  if(!window.jspdf){ alert('No cargó jsPDF. Verifica internet la primera vez.'); return; }
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit:'pt', format:'letter' });
  const w = pdf.internal.pageSize.getWidth();
  const margin = 42;
  pdf.setFillColor(8,8,8); pdf.rect(0,0,w,92,'F');
  pdf.setTextColor(247,201,72); pdf.setFont('helvetica','bold'); pdf.setFontSize(18); pdf.text(settings.bizName, margin, 36);
  pdf.setTextColor(230,230,230); pdf.setFontSize(9); pdf.setFont('helvetica','normal');
  pdf.text(`${settings.bizAddress}  |  ${settings.bizPhone}  |  ${settings.bizEmail}`, margin, 56, {maxWidth:w-margin*2});
  pdf.setTextColor(255,255,255); pdf.setFont('helvetica','bold'); pdf.setFontSize(20); pdf.text(doc.type.toUpperCase(), w-margin, 38, {align:'right'});
  pdf.setFontSize(10); pdf.text(doc.number, w-margin, 58, {align:'right'});

  let y = 120;
  pdf.setTextColor(20,20,20); pdf.setFontSize(11); pdf.setFont('helvetica','bold'); pdf.text('CLIENTE / PARTE', margin, y);
  pdf.setFont('helvetica','normal'); y += 18;
  pdf.text(doc.clientName || 'N/A', margin, y); y += 15;
  pdf.text(`${doc.clientPhone || ''} ${doc.clientEmail || ''}`.trim() || 'N/A', margin, y); y += 15;
  pdf.text(doc.clientAddress || 'N/A', margin, y, {maxWidth:260});

  pdf.setFont('helvetica','bold'); pdf.text('DETALLE', w/2 + 20, 120);
  pdf.setFont('helvetica','normal');
  pdf.text(`Fecha: ${doc.date || today()}`, w/2 + 20, 138);
  pdf.text(`Estatus: ${doc.status || 'Pendiente'}`, w/2 + 20, 153);
  pdf.text(`Caso/Ref.: ${doc.caseNumber || 'N/A'}`, w/2 + 20, 168);
  pdf.text(`Tribunal/Agencia: ${doc.court || 'N/A'}`, w/2 + 20, 183, {maxWidth:230});

  pdf.autoTable({
    startY: 220,
    head: [['Descripción','Cant.','Precio','Total']],
    body: (doc.items || []).map(i => [i.desc, i.qty, money(i.price), money(i.qty*i.price)]),
    theme:'grid',
    headStyles:{fillColor:[8,8,8],textColor:[247,201,72]},
    styles:{fontSize:9,cellPadding:7},
    columnStyles:{1:{halign:'right'},2:{halign:'right'},3:{halign:'right'}}
  });
  y = pdf.lastAutoTable.finalY + 18;
  const rightX = w - margin;
  pdf.setFont('helvetica','normal'); pdf.text('Subtotal', rightX - 140, y); pdf.text(money(doc.subtotal), rightX, y, {align:'right'}); y += 16;
  pdf.text(`IVU ${doc.taxEnabled ? doc.taxRate : 0}%`, rightX - 140, y); pdf.text(money(doc.tax), rightX, y, {align:'right'}); y += 20;
  pdf.setFont('helvetica','bold'); pdf.setFontSize(14); pdf.text('TOTAL', rightX - 140, y); pdf.text(money(doc.total), rightX, y, {align:'right'});

  y += 36; pdf.setFontSize(10); pdf.setFont('helvetica','bold'); pdf.text('Notas / términos', margin, y); y += 14;
  pdf.setFont('helvetica','normal'); pdf.setTextColor(50,50,50);
  pdf.text(doc.notes || settings.legalNote, margin, y, {maxWidth:w-margin*2});

  const footerY = 720;
  pdf.setDrawColor(180); pdf.line(margin, footerY, 250, footerY); pdf.line(w-250, footerY, w-margin, footerY);
  pdf.setFontSize(9); pdf.setTextColor(80); pdf.text('Firma autorizada', margin, footerY+14); pdf.text('Firma cliente / recibido', w-250, footerY+14);
  const name = `${doc.number || 'documento'}-${(doc.clientName || 'cliente').replaceAll(' ','_')}.pdf`;
  if(save) pdf.save(name);
  return pdf;
}

$('btnPdf').onclick = () => makePdf(collectDoc(), true);
$('btnShare').onclick = async () => {
  const doc = collectDoc(); const pdf = makePdf(doc, false); if(!pdf) return;
  const blob = pdf.output('blob'); const file = new File([blob], `${doc.number}.pdf`, {type:'application/pdf'});
  if(navigator.canShare && navigator.canShare({files:[file]})) await navigator.share({title:doc.number, text:`${doc.type} ${doc.number}`, files:[file]});
  else { pdf.save(`${doc.number}.pdf`); alert('Tu navegador no permite compartir directo. Se descargó el PDF.'); }
};

function loadSettingsForm(){
  ['bizName','bizPhone','bizEmail','bizAddress','invoicePrefix','quotePrefix','legalNote'].forEach(id => $(id).value = settings[id] || '');
}
$('saveSettings').onclick = (e)=>{ e.preventDefault(); ['bizName','bizPhone','bizEmail','bizAddress','invoicePrefix','quotePrefix','legalNote'].forEach(id => settings[id] = $(id).value.trim()); saveSettings(); alert('Ajustes guardados.'); resetForm(); };
$('clearAll').onclick = (e)=>{ e.preventDefault(); if(confirm('Esto borra historial y ajustes locales.')){ localStorage.removeItem(STORE); docs=[]; saveAll(); } };
$('exportJson').onclick = () => {
  const blob = new Blob([JSON.stringify({settings, docs}, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'backup-nexus-legal-billing.json'; a.click(); URL.revokeObjectURL(a.href);
};
function escapeHtml(str=''){ return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

if('serviceWorker' in navigator){ window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(()=>{})); }
loadSettingsForm(); resetForm(); renderHistory(); renderStats();
