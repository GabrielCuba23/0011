"""Public-source collection for the static dashboard. No credentials required."""
import os
import concurrent.futures, datetime as dt, email.utils, hashlib, html, json, re, unicodedata
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlencode, urlparse
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET
REGIONS=['Amazonas','Áncash','Apurímac','Arequipa','Ayacucho','Cajamarca','Callao','Cusco','Huancavelica','Huánuco','Ica','Junín','La Libertad','Lambayeque','Lima','Loreto','Madre de Dios','Moquegua','Pasco','Piura','Puno','San Martín','Tacna','Tumbes','Ucayali']
ROOT=Path(__file__).resolve().parents[1]
def norm(s): return ''.join(c for c in unicodedata.normalize('NFD',s.lower()) if not unicodedata.combining(c))
def regions(text):
 t=norm(text)
 return [r for r in REGIONS if re.search(r'(?<!\w)'+re.escape(norm(r))+r'(?!\w)',t)]
def strip(text): return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',text))).strip()
def fetch(url):
 with urlopen(Request(url,headers={'User-Agent':'VigiaPeru/0.2 public-source-monitor','Accept':'text/html,application/rss+xml,application/xml'}),timeout=20) as r:
  data=r.read(5_000_001)
  if len(data)>5_000_000: raise ValueError('Respuesta demasiado grande')
  return data.decode(r.headers.get_content_charset() or 'utf-8',errors='replace')
def stamp(d): return d.astimezone(dt.timezone.utc).isoformat()
def make(title,url,source,kind,date=None,summary=''):
 return {'id':hashlib.sha256(url.encode()).hexdigest()[:20],'title':title,'url':url,'source':source,'kind':kind,'publishedAt':stamp(date) if date else None,'regions':regions(title+' '+summary),'summary':summary[:700]}
def parse_rss(text,now):
 out=[]
 for item in ET.fromstring(text).findall('.//item'):
  title=strip(item.findtext('title',''));url=item.findtext('link','').strip()
  try: date=email.utils.parsedate_to_datetime(item.findtext('pubDate',''))
  except (ValueError,TypeError): continue
  if not date.tzinfo: date=date.replace(tzinfo=dt.timezone.utc)
  if not dt.timedelta(0)<=now-date<=dt.timedelta(hours=24): continue
  if urlparse(url).scheme not in ('http','https') or not title: continue
  source=item.findtext('source','Medio de prensa');summary=strip(item.findtext('description',''))
  out.append(make(title,url,source,'news',date,summary))
 return out
class Links(HTMLParser):
 def __init__(self): super().__init__();self.links=[];self.current=None;self.hidden=0
 def handle_starttag(self,tag,attrs):
  d=dict(attrs)
  if tag=='a': self.current=[(d.get('href') or ''),[]]
  if tag=='img' and self.current: self.current[1].append((d.get('alt') or ''))
 def handle_data(self,data):
  if self.current:self.current[1].append(data)
 def handle_endtag(self,tag):
  if tag=='a' and self.current:self.links.append((self.current[0],strip(' '.join(self.current[1]))));self.current=None
def parse_official(text,url,name):
 p=Links();p.feed(text);out=[]
 for href,title in p.links:
  full=urljoin(url,href)
  if urlparse(full).scheme not in ('http','https'): continue
  if not re.search(r'comunicado|bolet[ií]n|informe|aviso|alerta',title,re.I): continue
  if len(title)<18:continue
  # Only document/detail links; navigation sections are not publications.
  if not re.search(r'\.pdf(?:\?|$)|comunicado[^/]+/|/\d{4}/\d{2}/|[?&](?:id|codigo)=',full,re.I):continue
  out.append(make(title,full,name,'official'))
 return list({x['url']:x for x in out}.values())[:60]
def parse_hydro(payload):
 rows=payload.get('data') if isinstance(payload,dict) else None
 if not isinstance(rows,list):raise ValueError('La API no devolvió la lista de avisos esperada')
 out=[]
 for row in rows:
  if not isinstance(row,dict) or not isinstance(row.get('id'),(int,str)):continue
  title=strip(str(row.get('title') or 'Aviso hidrológico'))
  details=[]
  for key,label in [('waterBody','Río'),('stationName','Estación'),('department','Departamento'),('startDate','Inicio de vigencia'),('endDate','Fin de vigencia')]:
   value=row.get(key)
   if isinstance(value,(str,int,float)) and value!='':details.append(f'{label}: {value}')
  summary=' · '.join(details)
  item=make(title,'https://observatorio.senamhi.gob.pe/gestion-riesgo-desastres/avisos-hidrologicos/'+str(row['id']),'SENAMHI','official',summary=summary)
  out.append(item)
 return out
SOURCES=[('ENFEN','https://enfen.imarpe.gob.pe/'),('SENAMHI','https://observatorio.senamhi.gob.pe/gestion-riesgo-desastres/avisos-hidrologicos'),('ANA · ONRH','https://snirh.ana.gob.pe/onrh/Reportes.aspx?R=PRIOS')]
def collect(now=None):
 now=now or dt.datetime.now(dt.timezone.utc);items=[];statuses=[]
 def official(entry):
  name,url=entry
  try:
   rows=parse_hydro(json.loads(fetch('https://servicios.senamhi.gob.pe/api/hydrology/warnings'))) if name=='SENAMHI' else parse_official(fetch(url),url,name)
   return rows,{'name':name,'url':url,'state':'ok' if rows else 'limited','message':f'{len(rows)} publicaciones consultadas; fecha de publicación por confirmar.' if rows else 'Portal consultado, sin publicaciones extraíbles en HTML. Los paneles interactivos requieren un conector específico.','checkedAt':stamp(now)}
  except Exception as e:return [],{'name':name,'url':url,'state':'error','message':'No se pudo consultar: '+str(e)[:180],'checkedAt':stamp(now)}
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  for rows,status in pool.map(official,SOURCES): items.extend(rows);statuses.append(status)
 queries=['Perú']+REGIONS
 def news(region):
  q=f'"{region}" (lluvias OR inundación OR desborde OR huaico OR sequía OR SENAMHI OR ENFEN OR "caudal") when:1d'
  url='https://news.google.com/rss/search?'+urlencode({'q':q,'hl':'es-419','gl':'PE','ceid':'PE:es-419'})
  try:return parse_rss(fetch(url),now),None
  except Exception as e:return [],region+': '+str(e)[:100]
 errors=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
  for rows,error in pool.map(news,queries):
   items.extend(rows)
   if error:errors.append(error)
 statuses.append({'name':'Noticias · Google News RSS','url':'https://news.google.com/','state':'error' if len(errors)==len(queries) else 'limited' if errors else 'ok','message':f'Consultas completadas: {len(queries)-len(errors)}/{len(queries)}. Solo publicaciones fechadas dentro de las últimas 24 horas. '+(' | '.join(errors[:3])),'checkedAt':stamp(now)})
 # Retain prior official documents if a source is unavailable, marked as retained.
 previous=ROOT/'data/dashboard.json'
 if previous.exists():
  try:
   old=json.loads(previous.read_text());failed={s['name'] for s in statuses if s['state']!='ok'}
   for row in old.get('items',[]):
    if row.get('kind')=='official' and row.get('source') in failed:
     items.append(dict(row,retained=True))
  except (ValueError,OSError):pass
 unique={}
 for row in items:
  if row['id'] not in unique:unique[row['id']]=row
 result={'updatedAt':stamp(now),'regions':REGIONS,'sources':statuses,'items':sorted(unique.values(),key=lambda x:x['publishedAt'] or '',reverse=True)}
 previous.parent.mkdir(exist_ok=True);previous.write_text(json.dumps(result,ensure_ascii=False,indent=2))

 if os.environ.get('GITHUB_STEP_SUMMARY'):
  summary='## Recopilación de fuentes\n\n'+f'Publicaciones recopiladas: {len(unique)}.\n\n'+'\n'.join(f"- {x['name']}: {x['state']} — {html.escape(x['message'])}" for x in statuses)
  with open(os.environ['GITHUB_STEP_SUMMARY'],'a') as f:f.write(summary+'\n')
 print(json.dumps({'items':len(unique),'sources':statuses},ensure_ascii=False))
 return result
if __name__=='__main__':collect()
