const byId=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
let payload;
const date=value=>new Intl.DateTimeFormat('es-PE',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Lima'}).format(new Date(value));
const safe=url=>{try{return ['https:','http:'].includes(new URL(url).protocol);}catch{return false;}};
function renderDashboard(){
 if(!payload)return;
 const region=byId('region-filter').value;const institution=byId('institution-filter').value;
 const now=Date.now();const fresh=x=>x.publishedAt&&now-new Date(x.publishedAt).getTime()>=0&&now-new Date(x.publishedAt).getTime()<=86400000;
 const visible=payload.items.filter(x=>(!region||x.regions.includes(region)||(!x.regions.length&&byId('include-national').checked))&&(!institution||(institution==='news'?x.kind==='news':x.source===institution)));
 const news=visible.filter(x=>x.kind==='news'&&fresh(x));const official=visible.filter(x=>x.kind==='official');
 byId('news-count').textContent=news.length;byId('official-count').textContent=official.length;byId('region-title').textContent=region||'Todo el Perú';
 for(const [id,rows,empty] of [['news-items',news,'No hay noticias de las últimas 24 horas para esta selección. Comprueba el estado de las fuentes; esto no significa ausencia de eventos.'],['official-items',official,'No hay documentos extraídos para esta selección. Consulta los portales oficiales y revisa el estado de conexión.']]){
  const list=byId(id);list.replaceChildren();if(!rows.length)list.append(el('p',empty,'empty'));
  for(const x of rows.slice(0,100)){
   const card=el('article',null,'report-card');card.append(el('span',x.kind==='news'?'PRENSA · NO ES CONFIRMACIÓN OFICIAL':'DOCUMENTO OFICIAL · FECHA POR CONFIRMAR','tag'));
   card.append(el('h3',x.title));card.append(el('p',x.source+' · '+(x.publishedAt?date(x.publishedAt)+' (hora Perú)':'No se incluye como publicación de las últimas 24 horas')));
   if(x.kind==='official'&&x.summary)card.append(el('p',x.summary));
   card.append(el('small',x.regions.length?'Mención geográfica: '+x.regions.join(', '):'Sin región identificada en el texto; puede tener alcance nacional.'));
   if(x.retained)card.append(el('small','Documento de una consulta anterior; fuente sin actualización disponible.'));
   if(safe(x.url)){const a=el('a','Leer en la fuente ↗');a.href=x.url;a.target='_blank';a.rel='noopener noreferrer';card.append(a);}list.append(card);
  }
 }
 const statuses=byId('source-status');statuses.replaceChildren();
 for(const s of payload.sources){const box=el('article',null,'source-card');box.append(el('span',s.state==='ok'?'CONSULTA COMPLETADA':s.state==='limited'?'COBERTURA PARCIAL':'SIN CONEXIÓN',s.state==='ok'?'tag':'tag warning'));box.append(el('h3',s.name),el('p',s.message),el('small','Consulta: '+date(s.checkedAt)));if(safe(s.url)){const a=el('a','Abrir portal ↗');a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';box.append(a);}statuses.append(box);}
}
async function loadDashboard(){
 byId('dashboard-updated').textContent='Cargando información…';
 try{const res=await fetch(new URL('data/dashboard.json',location.href),{cache:'no-store'});if(!res.ok)throw Error('HTTP '+res.status);const data=await res.json();if(!Array.isArray(data.items)||!Array.isArray(data.sources)||!Array.isArray(data.regions))throw Error('Formato de datos inválido');payload=data;
 const select=byId('region-filter');if(select.options.length===1)for(const region of data.regions){const option=el('option',region);option.value=region;select.append(option);}
 const age=Date.now()-new Date(data.updatedAt).getTime();byId('dashboard-updated').textContent='Última recopilación: '+date(data.updatedAt)+' (Perú). '+(age>7200000?'Datos sin actualizar hace más de 2 horas. ':'')+'Actualización programada cada hora, sujeta a disponibilidad de GitHub Actions.';renderDashboard();
 }catch{byId('dashboard-updated').textContent='No se pudieron cargar los datos. La recopilación puede no haberse publicado todavía. Recarga después del despliegue; revisa GitHub Actions si persiste.';}
}
for(const id of ['region-filter','institution-filter','include-national'])byId(id).addEventListener('change',renderDashboard);
byId('refresh-dashboard').onclick=loadDashboard;loadDashboard();setInterval(()=>{if(payload)renderDashboard();},60000);
