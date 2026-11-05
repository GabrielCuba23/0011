"""Read workbook values/hyperlinks as untrusted data; never evaluate formulas."""
import argparse,csv,hashlib,ipaddress,json,re,unicodedata
from pathlib import Path
from urllib.parse import urlsplit,urlunsplit
REGIONS=['Amazonas','Áncash','Apurímac','Arequipa','Ayacucho','Cajamarca','Callao','Cusco','Huancavelica','Huánuco','Ica','Junín','La Libertad','Lambayeque','Lima','Loreto','Madre de Dios','Moquegua','Pasco','Piura','Puno','San Martín','Tacna','Tumbes','Ucayali']
def norm(s):return ''.join(c for c in unicodedata.normalize('NFD',s.casefold()) if not unicodedata.combining(c))
def clean_url(value):
 value=value.strip().rstrip('.,;)]}').replace('\\n','').replace('\\r','')
 if not re.match(r'^https?://',value,re.I):value='https://'+value
 try:
  p=urlsplit(value);host=(p.hostname or '').encode('idna').decode('ascii').lower()
  if not re.fullmatch(r'(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}',host):return None
  if p.scheme not in ('https','http') or not host or '.' not in host or p.username or p.password or p.port not in (None,80,443):return None
  if host.endswith(('.local','.internal','.localhost','.test','.example')):return None
  try:ipaddress.ip_address(host);return None
  except ValueError:pass
  if re.search(r'(?:^|&)(access_token|api_key|apikey|secret|token)=',p.query,re.I):return None
  return urlunsplit((p.scheme,host,p.path or '/',p.query,''))
 except (ValueError,UnicodeError):return None
def link_type(url):
 host=urlsplit(url).hostname.removeprefix('www.')
 for domain,kind in [('facebook.com','facebook'),('fb.com','facebook'),('fb.watch','facebook'),('instagram.com','instagram'),('youtube.com','youtube'),('youtu.be','youtube'),('tiktok.com','tiktok'),('x.com','x'),('twitter.com','x'),('wa.me','whatsapp'),('t.me','telegram')]:
  if host==domain or host.endswith('.'+domain):return kind
 if host in ['tinyurl.com','bit.ly','t.co','goo.gl','shorturl.at']:return 'shortener'
 if host in ['findglocal.com','linktr.ee']:return 'directory'
 return 'website'
def extract(text,hyperlink=None):
 text=str(text or '').replace('\\n','\n').replace('\\r','\n');found=re.findall(r'https?://[^\s<>"\']+',text,re.I)
 found+=re.findall(r'(?i)\bweb\s*:\s*((?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:/[^\s<>]*)?)',text)
 if hyperlink:found.append(hyperlink)
 out=[]
 for raw in found:
  u=clean_url(raw)
  if u and u not in out:out.append(u)
 return out

def import_workbook(path):
 from openpyxl import load_workbook
 workbook=load_workbook(path,data_only=True,read_only=False);groups={};issues=[];raw_rows=0
 for sheet in workbook:
  for cells in sheet.iter_rows(min_row=2):
   values=[c.value for c in cells[:3]]
   if not any(v is not None for v in values):continue
   raw_rows+=1;area,name,text=[str(v).strip() if v is not None else '' for v in values]
   region=next((r for r in REGIONS if norm(area.split('/')[0].strip())==norm(r)),None)
   links=extract(text,cells[2].hyperlink.target if cells[2].hyperlink else None)
   if not name or not region:issues.append({'sheet':sheet.title,'row':cells[0].row,'issue':'Missing medium or unknown region'});continue
   websites=[u for u in links if link_type(u)=='website'];social=[{'url':u,'platform':link_type(u)} for u in links if link_type(u) not in ['website','shortener','directory']];short=[u for u in links if link_type(u)=='shortener'];directories=[u for u in links if link_type(u)=='directory']
   identity=norm(name)+'|'+(urlsplit(websites[0]).hostname.removeprefix('www.') if websites else social[0]['url'] if social else short[0] if short else directories[0] if directories else '')
   if identity not in groups:groups[identity]={'id':hashlib.sha256(identity.encode()).hexdigest()[:20],'name':name,'regions':[],'areas':[],'websites':[],'socialLinks':[],'shortLinks':[],'directoryLinks':[],'sourceRows':[],'feedStatus':'pending','accessNote':'Publicación y disponibilidad por comprobar; el directorio no confirma que el sitio siga activo.'}
   entry=groups[identity]
   for key,values in [('regions',[region]),('areas',[area]),('websites',websites),('socialLinks',social),('shortLinks',short),('directoryLinks',directories)]:
    for value in values:
     if value not in entry[key]:entry[key].append(value)
   entry['sourceRows'].append({'sheet':sheet.title,'row':cells[0].row})
   if not links:issues.append({'sheet':sheet.title,'row':cells[0].row,'issue':'No usable URL'})
 entries=list(groups.values());regions={r:sum(r in e['regions'] for e in entries) for r in REGIONS}
 return {'schemaVersion':1,'sourceFile':Path(path).name,'rawRows':raw_rows,'acceptedRows':sum(len(e['sourceRows']) for e in entries),'uniqueMedia':len(entries),'mergedRows':raw_rows-len(entries)-sum(x['issue']=='Missing medium or unknown region' for x in issues),'regions':regions,'counts':{'withWebsite':sum(bool(e['websites']) for e in entries),'withSocialLinks':sum(bool(e['socialLinks']) for e in entries),'withShortLinks':sum(bool(e['shortLinks']) for e in entries),'socialOnly':sum(bool(e['socialLinks']) and not e['websites'] for e in entries)},'entries':entries,'issues':issues}
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('workbook');parser.add_argument('--output',default='data/media-directory.json');parser.add_argument('--csv',default='data/media-directory-review.csv');args=parser.parse_args();result=import_workbook(args.workbook);Path(args.output).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 with open(args.csv,'w',encoding='utf-8-sig',newline='') as f:
  writer=csv.writer(f);writer.writerow(['Medio','Regiones','Cobertura declarada','Webs','Redes','Acortadores por resolver','Estado RSS','Filas originales'])
  for e in result['entries']:writer.writerow(["'"+e['name'] if e['name'].startswith(('=','+','-','@')) else e['name'],' | '.join(e['regions']),' | '.join(e['areas']),' | '.join(e['websites']),' | '.join(x['url'] for x in e['socialLinks']),' | '.join(e['shortLinks']),'Pendiente de comprobar',' | '.join(str(x['row']) for x in e['sourceRows'])])
 print(json.dumps({k:v for k,v in result.items() if k not in ('entries',)},ensure_ascii=False))
