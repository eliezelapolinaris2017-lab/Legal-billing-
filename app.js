const STORE='docs_pro_records_v1';
const SETTINGS='docs_pro_settings_v1';
const $=id=>document.getElementById(id);
const clean=v=>String(v||'').trim();
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
const today=()=>new Date().toISOString().slice(0,10);
const escapeHtml=s=>String(s||'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const baseTheme={colorBg:'#050505',colorPanel:'#111111',colorAccent:'#d6aa38',colorText:'#f5f5f5'};
let docs=JSON.parse(localStorage.getItem(STORE)||'[]').filter(d=>['Factura','Cotización','Cobro legal','Cobro de dinero'].includes(d.type)).map(d=>d.type==='Cobro de dinero'?{...d,type:'Cobro legal'}:d);
let settings={...JSON.parse(localStorage.getItem(SETTINGS)||'{}')};
let editingId=null;

function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1600)}
function saveDocs(){localStorage.setItem(STORE,JSON.stringify(docs));renderAll()}
function saveSettings(){localStorage.setItem(SETTINGS,JSON.stringify(settings));applySettings()}
function getTheme(){return {...baseTheme,...settings}}
function applySettings(){
  const s=getTheme();
  document.documentElement.style.setProperty('--bg',s.colorBg);
  document.documentElement.style.setProperty('--panel',s.colorPanel);
  document.documentElement.style.setProperty('--panel2',shade(s.colorPanel,18));
  document.documentElement.style.setProperty('--accent',s.colorAccent);
  document.documentElement.style.setProperty('--text',s.colorText);
  document.documentElement.style.setProperty('--muted',mix(s.colorText,s.colorBg,.58));
  document.documentElement.style.setProperty('--accentText',contrastText(s.colorAccent));
  $('appTitle').textContent=settings.appName||'Docs Pro';
  renderLogo();
  const meta=document.querySelector('meta[name="theme-color"]'); if(meta) meta.content=s.colorBg;
}
function hexToRgb(hex){hex=String(hex||'#000000').replace('#','');if(hex.length===3)hex=hex.split('').map(x=>x+x).join('');const n=parseInt(hex,16);return{r:(n>>16)&255,g:(n>>8)&255,b:n&255}}
function rgbToHex({r,g,b}){return'#'+[r,g,b].map(x=>Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,'0')).join('')}
function mix(a,b,t){const A=hexToRgb(a),B=hexToRgb(b);return rgbToHex({r:A.r*(1-t)+B.r*t,g:A.g*(1-t)+B.g*t,b:A.b*(1-t)+B.b*t})}
function shade(hex,amt){const c=hexToRgb(hex);return rgbToHex({r:c.r+amt,g:c.g+amt,b:c.b+amt})}
function contrastText(hex){const c=hexToRgb(hex);return ((c.r*299+c.g*587+c.b*114)/1000)>150?'#070707':'#ffffff'}
function renderLogo(){
  const mark=$('brandMark');
  const preview=$('logoPreview');
  const initials=(settings.appInitials||'DP').slice(0,3).toUpperCase();
  if(mark) mark.innerHTML=settings.logoDataUrl?`<img src="${settings.logoDataUrl}" alt="">`:`<span id="brandInitials">${escapeHtml(initials)}</span>`;
  if(preview) preview.innerHTML=settings.logoDataUrl?`<img src="${settings.logoDataUrl}" alt="">`:'Logo';
}
function readLogoFile(file){
  if(!file)return;
  if(file.size>900000){toast('Logo muy pesado');return}
  const reader=new FileReader();
  reader.onload=()=>{settings.logoDataUrl=reader.result;saveSettings();toast('Logo guardado')};
  reader.readAsDataURL(file);
}

function prefix(type){return ({'Factura':settings.invoicePrefix||'FAC','Cotización':settings.quotePrefix||'COT','Cobro legal':settings.collectionPrefix||'COB'}[type]||'DOC')}
function nextNumber(type){const p=prefix(type), y=new Date().getFullYear(); const count=docs.filter(d=>String(d.number||'').startsWith(`${p}-${y}`)).length+1; return `${p}-${y}-${String(count).padStart(4,'0')}`}
function setView(id){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));document.querySelectorAll('[data-view-target]').forEach(b=>b.classList.toggle('active',b.dataset.viewTarget===id));window.scrollTo({top:0,behavior:'smooth'})}
document.querySelectorAll('[data-view-target]').forEach(b=>b.onclick=()=>setView(b.dataset.viewTarget));
document.querySelectorAll('[data-new]').forEach(b=>b.onclick=()=>{resetForm();$('docType').value=b.dataset.new;$('docNumber').value=nextNumber(b.dataset.new);setView('form')});

function addItemRow(item={desc:'',qty:1,price:0}){const row=document.createElement('div');row.className='item';row.innerHTML=`<label>Descripción<input class="i-desc" value="${escapeHtml(item.desc)}"></label><label>Cant.<input class="i-qty" type="number" step="0.01" value="${item.qty??1}"></label><label>Precio<input class="i-price" type="number" step="0.01" value="${item.price??0}"></label><button type="button">×</button>`;row.querySelector('button').onclick=()=>{row.remove();calcTotals()};row.querySelectorAll('input').forEach(i=>i.addEventListener('input',calcTotals));$('items').appendChild(row);calcTotals()}
function getItems(){return [...document.querySelectorAll('.item')].map(r=>({desc:clean(r.querySelector('.i-desc').value),qty:Number(r.querySelector('.i-qty').value||0),price:Number(r.querySelector('.i-price').value||0)})).filter(i=>i.desc||i.qty||i.price)}
function calcTotals(){const subtotal=getItems().reduce((s,i)=>s+i.qty*i.price,0);const tax=$('taxEnabled').checked?subtotal*(Number($('taxRate').value||0)/100):0;const total=subtotal+tax;$('subtotalView').textContent=money(subtotal);$('taxView').textContent=money(tax);$('totalView').textContent=money(total);return{subtotal,tax,total}}
function collectDoc(){return{ id:editingId||crypto.randomUUID(), type:$('docType').value, number:clean($('docNumber').value), date:$('docDate').value, status:$('status').value, clientName:clean($('clientName').value), clientPhone:clean($('clientPhone').value), clientEmail:clean($('clientEmail').value), clientAddress:clean($('clientAddress').value), caseNumber:clean($('caseNumber').value), court:clean($('court').value), items:getItems(), notes:clean($('notes').value), taxEnabled:$('taxEnabled').checked, taxRate:Number($('taxRate').value||0), ...calcTotals(), updatedAt:new Date().toISOString()}}
function resetForm(){editingId=null;$('formTitle').textContent='Nuevo';$('docForm').reset();$('docDate').value=today();$('docNumber').value=nextNumber($('docType').value||'Factura');$('taxEnabled').checked=true;$('taxRate').value=11.5;$('items').innerHTML='';addItemRow();calcTotals()}
function loadDoc(d){editingId=d.id;$('formTitle').textContent=d.number||'Documento';$('docType').value=d.type||'Factura';$('docNumber').value=d.number||nextNumber(d.type||'Factura');$('docDate').value=d.date||today();$('status').value=d.status||'Pendiente';['clientName','clientPhone','clientEmail','clientAddress','caseNumber','court','notes'].forEach(id=>$(id).value=d[id]||'');$('taxEnabled').checked=d.taxEnabled!==false;$('taxRate').value=d.taxRate??11.5;$('items').innerHTML='';(d.items&&d.items.length?d.items:[{}]).forEach(addItemRow);calcTotals();setView('form')}
$('docType').onchange=()=>{if(!editingId)$('docNumber').value=nextNumber($('docType').value)};$('addItem').onclick=()=>addItemRow();$('btnReset').onclick=resetForm;['taxEnabled','taxRate'].forEach(id=>$(id).addEventListener('input',calcTotals));
$('docForm').onsubmit=e=>{e.preventDefault();const d=collectDoc();if(!d.number||!d.date||!d.clientName){toast('Falta información');return}const i=docs.findIndex(x=>x.id===d.id);i>=0?docs[i]=d:docs.unshift(d);editingId=d.id;saveDocs();toast('Guardado')};

function renderStats(){$('statDocs').textContent=docs.length;$('statPending').textContent=money(docs.filter(d=>!['Pagado','Cancelado'].includes(d.status)).reduce((s,d)=>s+Number(d.total||0),0));$('statPaid').textContent=money(docs.filter(d=>d.status==='Pagado').reduce((s,d)=>s+Number(d.total||0),0))}
function renderHistory(){const q=clean($('search')?.value).toLowerCase();const st=$('statusFilter')?.value||'';const list=$('historyList');list.innerHTML='';const arr=docs.filter(d=>[d.clientName,d.number,d.caseNumber,d.type,d.court].join(' ').toLowerCase().includes(q)&&(!st||d.status===st));if(!arr.length){list.innerHTML='<div class="empty">Sin documentos</div>';return}arr.forEach(d=>{const el=document.createElement('article');el.className='doc';el.innerHTML=`<div class="doc-top"><div><h4>${escapeHtml(d.number)} · ${escapeHtml(d.clientName)}</h4><p>${escapeHtml(d.type)} · ${escapeHtml(d.date||'')}</p></div><span class="badge ${escapeHtml(d.status)}">${escapeHtml(d.status)}</span></div><div class="amount">${money(d.total)}</div><div class="doc-actions"><button data-a="edit">Editar</button><button data-a="pdf">PDF</button><button data-a="paid">Pagada</button><button data-a="del">Borrar</button></div>`;el.querySelector('[data-a="edit"]').onclick=()=>loadDoc(d);el.querySelector('[data-a="pdf"]').onclick=()=>makePdf(d,true);el.querySelector('[data-a="paid"]').onclick=()=>{d.status='Pagado';d.updatedAt=new Date().toISOString();saveDocs();toast('Pagada')};el.querySelector('[data-a="del"]').onclick=()=>{if(confirm('¿Borrar?')){docs=docs.filter(x=>x.id!==d.id);saveDocs();toast('Borrado')}};list.appendChild(el)})}
$('search').oninput=renderHistory;$('statusFilter').onchange=renderHistory;

function line(){return [settings.bizAddress,settings.bizPhone,settings.bizEmail].filter(Boolean).join('  |  ')}
function pdfColor(hex){const c=hexToRgb(hex);return[c.r,c.g,c.b]}
function makePdf(doc=collectDoc(),download=false){if(!window.jspdf){toast('PDF no disponible');return null}const {jsPDF}=window.jspdf;const pdf=new jsPDF({unit:'pt',format:'letter'});const w=pdf.internal.pageSize.getWidth(),m=42;const th=getTheme();const bg=pdfColor(th.colorBg), ac=pdfColor(th.colorAccent), tx=pdfColor(th.colorText);pdf.setFillColor(bg[0],bg[1],bg[2]);pdf.rect(0,0,w,86,'F');pdf.setFillColor(ac[0],ac[1],ac[2]);pdf.rect(0,84,w,2,'F');let headerX=m;if(settings.logoDataUrl){try{pdf.addImage(settings.logoDataUrl,'PNG',m,18,48,48);headerX=m+62}catch(e){try{pdf.addImage(settings.logoDataUrl,'JPEG',m,18,48,48);headerX=m+62}catch(_){}}}pdf.setTextColor(ac[0],ac[1],ac[2]);pdf.setFont('helvetica','bold');pdf.setFontSize(17);pdf.text(settings.bizName||'',headerX,34,{maxWidth:275});pdf.setTextColor(tx[0],tx[1],tx[2]);pdf.setFont('helvetica','normal');pdf.setFontSize(9);if(line())pdf.text(line(),headerX,54,{maxWidth:300});pdf.setTextColor(tx[0],tx[1],tx[2]);pdf.setFont('helvetica','bold');pdf.setFontSize(18);pdf.text(String(doc.type||'').toUpperCase(),w-m,34,{align:'right'});pdf.setFontSize(10);pdf.text(doc.number||'',w-m,56,{align:'right'});let y=118;pdf.setTextColor(25);pdf.setFontSize(10);pdf.setFont('helvetica','bold');pdf.text('CLIENTE',m,y);pdf.text('DETALLE',w/2+20,y);pdf.setFont('helvetica','normal');y+=18;[doc.clientName,doc.clientPhone,doc.clientEmail,doc.clientAddress].filter(Boolean).forEach(v=>{pdf.text(String(v),m,y,{maxWidth:245});y+=14});let dy=136;[`Fecha: ${doc.date||''}`,`Estatus: ${doc.status||''}`,doc.caseNumber?`Caso/Ref.: ${doc.caseNumber}`:'',doc.court?`Agencia/Tribunal: ${doc.court}`:''].filter(Boolean).forEach(v=>{pdf.text(v,w/2+20,dy,{maxWidth:230});dy+=14});pdf.autoTable({startY:220,head:[['Descripción','Cant.','Precio','Total']],body:(doc.items||[]).map(i=>[i.desc||'',i.qty||0,money(i.price),money(i.qty*i.price)]),theme:'grid',headStyles:{fillColor:bg,textColor:ac},styles:{fontSize:9,cellPadding:7,lineColor:[220,220,220]},columnStyles:{1:{halign:'right'},2:{halign:'right'},3:{halign:'right'}}});y=pdf.lastAutoTable.finalY+18;const rx=w-m;pdf.setTextColor(30);pdf.setFontSize(10);pdf.text('Subtotal',rx-140,y);pdf.text(money(doc.subtotal),rx,y,{align:'right'});y+=16;pdf.text('IVU',rx-140,y);pdf.text(money(doc.tax),rx,y,{align:'right'});y+=22;pdf.setFont('helvetica','bold');pdf.setFontSize(15);pdf.text('TOTAL',rx-140,y);pdf.text(money(doc.total),rx,y,{align:'right'});const note=doc.notes||settings.legalNote||'';if(note){y+=36;pdf.setFontSize(10);pdf.text('Notas',m,y);y+=14;pdf.setFont('helvetica','normal');pdf.text(note,m,y,{maxWidth:w-m*2})}const fy=720;pdf.setDrawColor(160);pdf.line(m,fy,250,fy);pdf.line(w-250,fy,w-m,fy);pdf.setFontSize(9);pdf.setTextColor(80);pdf.text('Firma',m,fy+14);pdf.text('Recibido',w-250,fy+14);const name=`${doc.number||'documento'}.pdf`;if(download)pdf.save(name);return pdf}
$('btnPdf').onclick=()=>makePdf(collectDoc(),true);
$('btnShare').onclick=async()=>{const d=collectDoc(),pdf=makePdf(d,false);if(!pdf)return;const file=new File([pdf.output('blob')],`${d.number||'documento'}.pdf`,{type:'application/pdf'});if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({title:d.number||'Documento',files:[file]})}else{pdf.save(file.name);toast('PDF descargado')}};

function loadSettings(){['appName','appInitials','bizName','bizPhone','bizEmail','bizAddress','invoicePrefix','quotePrefix','collectionPrefix','legalNote'].forEach(id=>$(id).value=settings[id]||'');Object.keys(baseTheme).forEach(id=>$(id).value=settings[id]||baseTheme[id]);renderLogo()}
$('settingsForm').onsubmit=e=>{e.preventDefault();['appName','appInitials','bizName','bizPhone','bizEmail','bizAddress','invoicePrefix','quotePrefix','collectionPrefix','legalNote','colorBg','colorPanel','colorAccent','colorText'].forEach(id=>settings[id]=clean($(id).value));saveSettings();resetForm();toast('Guardado')};
['colorBg','colorPanel','colorAccent','colorText'].forEach(id=>$(id).addEventListener('input',()=>{settings[id]=$(id).value;applySettings()}));
$('logoInput').addEventListener('change',e=>readLogoFile(e.target.files[0]));
$('removeLogo').onclick=()=>{delete settings.logoDataUrl;saveSettings();$('logoInput').value='';toast('Logo eliminado')};
$('resetTheme').onclick=()=>{Object.assign(settings,baseTheme);Object.keys(baseTheme).forEach(id=>$(id).value=baseTheme[id]);saveSettings();toast('Tema base')};
$('clearAll').onclick=()=>{if(confirm('¿Borrar todo?')){localStorage.removeItem(STORE);localStorage.removeItem(SETTINGS);docs=[];settings={};loadSettings();applySettings();resetForm();renderAll();toast('Borrado')}};
$('exportJson').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({settings,docs},null,2)],{type:'application/json'}));a.download='backup.json';a.click();URL.revokeObjectURL(a.href)};
function renderAll(){renderStats();renderHistory()}
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
applySettings();loadSettings();resetForm();renderAll();
