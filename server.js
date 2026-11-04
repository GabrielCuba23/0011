import http from 'node:http';
import {createLiveFeed} from './lib/news.js';
import {analyzeEditorial,extractScreenshot,importArticle} from './lib/editorial.js';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash,timingSafeEqual} from 'node:crypto';
import {AnalysisError,analyzeImage,enrichLocations,diagnoseProvider,probeGeneration} from './lib/analyze.js';
const root=fileURLToPath(new URL('./public/',import.meta.url));
const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/report.js':'report.js','/dashboard.js':'dashboard.js','/image-analysis.js':'image-analysis.js','/desk.js':'desk.js','/vendor/leaflet.js':'vendor/leaflet.js','/vendor/leaflet.css':'vendor/leaflet.css','/vendor/images/layers.png':'vendor/images/layers.png','/vendor/images/layers-2x.png':'vendor/images/layers-2x.png','/data/dashboard.json':'../data/dashboard.json'};
const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',json:'application/json; charset=utf-8',png:'image/png'};
const MAX_BODY=14*1024*1024;
function body(req){return new Promise((resolve,reject)=>{let size=0,chunks=[],failed=false;req.on('data',chunk=>{size+=chunk.length;if(size>MAX_BODY){if(!failed){failed=true;chunks=[];reject(new AnalysisError('La imagen supera el tamaño permitido.',413));}}else if(!failed)chunks.push(chunk);});req.on('end',()=>{if(failed)return;try{resolve(JSON.parse(Buffer.concat(chunks).toString()));}catch{reject(new AnalysisError('Solicitud JSON inválida.'));}});req.on('error',()=>reject(new AnalysisError('Carga interrumpida.')));});}
function authorized(req){const expected=process.env.VIGIA_ACCESS_TOKEN;if(!expected)return false;const actual=(req.headers.authorization||'').replace(/^Bearer /,'');const hash=x=>createHash('sha256').update(x).digest();return timingSafeEqual(hash(actual),hash(expected));}
const liveFeed=createLiveFeed();
let active=0;let usage={start:Date.now(),count:0};
http.createServer(async(req,res)=>{
 const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
 const origin=req.headers.origin;let same=false;try{same=new URL(origin).host===req.headers.host;}catch{}
 const allowed=(process.env.ALLOWED_ORIGIN||'').split(',').map(x=>x.trim()).filter(Boolean);
 if(origin){if(!same&&!allowed.includes(origin))return json(403,{error:'Este sitio no está autorizado para consultar el servidor.'});res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600'});return res.end();}
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/api/health')return json(200,{status:'ok',version:'0.4.3'});
 if(path==='/api/capabilities')return json(200,{version:'0.4.3',imageAnalysis:Boolean(process.env.GEMINI_API_KEY&&process.env.VIGIA_ACCESS_TOKEN),newsAnalysis:true,authenticationCheck:true,provider:'Gemini',requiresAccessCode:true});
 if(path==='/api/auth/check'){
  if(req.method!=='GET')return json(405,{error:'Usa GET.'});
  if(!authorized(req))return json(401,{error:'La clave de acceso del observatorio no es válida.',code:'INVALID_ACCESS_CODE'});
  return json(200,{authenticated:true,version:'0.4.3'});
 }
 if(path==='/api/dashboard'){
  if(req.method!=='GET')return json(405,{error:'Usa GET.'});
  try{return json(200,await liveFeed.get(new URL(req.url,'http://localhost').searchParams.get('region')||'',{refresh:new URL(req.url,'http://localhost').searchParams.get('refresh')==='1'}));}
  catch{return json(400,{error:'No se pudo consultar esa región.'});}
 }
 if(['/api/news/analyze','/api/news/extract','/api/news/import','/api/diagnostics/generate'].includes(path)){
  if(req.method!=='POST')return json(405,{error:'Usa POST.'});
  if(!authorized(req))return json(401,{error:'Conecta el servidor e introduce la clave de acceso del observatorio en Análisis de imágenes.'});
  if(!req.headers['content-type']?.startsWith('application/json'))return json(415,{error:'Se requiere JSON.'});
  if(Number(req.headers['content-length'])>MAX_BODY)return json(413,{error:'Carga demasiado grande.'});
  if(Date.now()-usage.start>3600000)usage={start:Date.now(),count:0};
  if(active>=2||usage.count>=(Number(process.env.ANALYSIS_HOURLY_LIMIT)||30))return json(429,{error:'Límite de consultas alcanzado. Intenta más tarde.'});
  active++;usage.count++;
  try{const input=await body(req);const opts={apiKey:process.env.GEMINI_API_KEY,model:process.env.GEMINI_MODEL||'gemini-flash-latest'};
   return json(200,path==='/api/diagnostics/generate'?await probeGeneration(opts):path==='/api/news/analyze'?await analyzeEditorial(input,opts):path==='/api/news/extract'?await extractScreenshot(input,opts):await importArticle(input.url));
  }catch(e){return json(e instanceof AnalysisError?e.status:502,{error:e instanceof AnalysisError?e.message:'No se pudo completar la consulta.',code:e.code||'NEWS_FAILED',providerStatus:e.providerStatus||null,model:e.model||null,apiVersion:e.apiVersion||null});}finally{active--;}
 }
 if(path==='/api/diagnostics/ai'){
  if(req.method!=='GET')return json(405,{error:'Usa GET.'});
  if(!process.env.VIGIA_ACCESS_TOKEN||!authorized(req))return json(401,{error:'La clave de acceso del observatorio no es válida.'});
  try{return json(200,await diagnoseProvider({apiKey:process.env.GEMINI_API_KEY,model:process.env.GEMINI_MODEL||'gemini-flash-latest'}));}
  catch(e){return json(e instanceof AnalysisError?e.status:502,{error:e instanceof AnalysisError?e.message:'No se pudo comprobar el proveedor de IA.',code:e.code||'DIAGNOSTIC_FAILED',providerStatus:e.providerStatus||null,model:e.model||null,apiVersion:e.apiVersion||null});}
 }
 if(path==='/api/analyze-image'){
  if(req.method!=='POST')return json(405,{error:'Usa POST.'});
  if(!process.env.GEMINI_API_KEY||!process.env.VIGIA_ACCESS_TOKEN)return json(503,{error:'El análisis todavía no está activado. Falta configurar el servicio de IA y su clave de acceso en el servidor.'});
  if(!authorized(req))return json(401,{error:'La clave de acceso del observatorio no es válida.'});
  if(!req.headers['content-type']?.startsWith('application/json'))return json(415,{error:'Se requiere JSON.'});
  if(Number(req.headers['content-length'])>MAX_BODY)return json(413,{error:'La imagen supera el tamaño permitido.'});
  if(Date.now()-usage.start>3600000)usage={start:Date.now(),count:0};
  const limit=Number(process.env.ANALYSIS_HOURLY_LIMIT)||30;
  if(active>=2||usage.count>=limit)return json(429,{error:'El servicio está ocupado o alcanzó su límite horario. Intenta más tarde.'});
  active++;usage.count++;
  try{const input=await body(req);const result=await analyzeImage(input,{apiKey:process.env.GEMINI_API_KEY,model:process.env.GEMINI_MODEL||'gemini-flash-latest'});return json(200,await enrichLocations(result));}
  catch(e){return json(e instanceof AnalysisError?e.status:500,{error:e instanceof AnalysisError?e.message:'No se pudo completar el análisis.',code:e.code||'ANALYSIS_FAILED',providerStatus:e.providerStatus||null,model:e.model||null,apiVersion:e.apiVersion||null});}finally{active--;}
 }
 if(!['GET','HEAD'].includes(req.method))return json(405,{error:'Método no permitido.'});
 if(!files[path]){res.writeHead(404);return res.end('No encontrado');}
 try{const data=await readFile(root+files[path]);res.writeHead(200,{'Content-Type':types[files[path].split('.').pop()],'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' blob: data: https://*.tile.openstreetmap.org; style-src 'self'; script-src 'self'; frame-src https://www.openstreetmap.org; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(req.method==='HEAD'?undefined:data);}catch{res.writeHead(500);res.end('Error de lectura');}
}).listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Vigía Perú iniciado en puerto '+(process.env.PORT||3000)));
