import {createHash} from 'node:crypto';
import {AnalysisError,providerFailure} from './provider-errors.js';
const workingModels=new Map();
const cooldowns=new Map();
export function normalizeModel(value='gemini-flash-latest'){
 let name=String(value).trim();if((name.startsWith('"')&&name.endsWith('"'))||(name.startsWith("'")&&name.endsWith("'")))name=name.slice(1,-1).trim();name=name.replace(/^models\//,'');
 if(!/^gemini-[a-zA-Z0-9][a-zA-Z0-9.-]{0,100}$/.test(name))throw new AnalysisError('GEMINI_MODEL debe contener solo el nombre del modelo, por ejemplo gemini-flash-latest.',503,'INVALID_MODEL_CONFIGURATION');return name;
}
export async function listModels({apiKey,fetchImpl=fetch,signal=AbortSignal.timeout(20000)}={}){
 if(!apiKey?.trim())throw new AnalysisError('Falta configurar GEMINI_API_KEY en Render.',503,'MISSING_API_KEY');
 let response;try{response=await fetchImpl('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',{headers:{'x-goog-api-key':apiKey.trim()},signal});}catch{throw new AnalysisError('El servidor no pudo conectar con Google. No se comprobó la clave.',502,'PROVIDER_CONNECTION_FAILED');}
 if(!response.ok)throw await providerFailure(response);let body;try{body=await response.json();}catch{throw new AnalysisError('Google no devolvió una lista de modelos válida.',502,'INVALID_MODEL_LIST');}
 if(!Array.isArray(body.models))throw new AnalysisError('Google devolvió una lista de modelos no reconocida.',502,'INVALID_MODEL_LIST');
 return body.models.filter(x=>x?.supportedGenerationMethods?.includes('generateContent')&&/^models\/gemini-[a-zA-Z0-9.-]+$/.test(x.name)).map(x=>x.name.replace('models/','')).slice(0,100);
}
function safeFlashAlternatives(models,attempted){
 const allowed=models.filter(m=>!attempted.has(m)&&/^gemini-(?:flash(?:-lite)?-latest|\d+(?:\.\d+)?-flash(?:-lite)?)$/.test(m));
 return allowed.sort((a,b)=>{const priority=x=>x==='gemini-flash-latest'?0:x==='gemini-flash-lite-latest'?1:2;return priority(a)-priority(b)||b.localeCompare(a,undefined,{numeric:true});});
}
export async function generateGemini(payload,{apiKey,model='gemini-flash-latest',fetchImpl=fetch,sleepImpl=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 if(!apiKey?.trim())throw new AnalysisError('Falta configurar la credencial de Gemini.',503,'MISSING_API_KEY');
 const configuredModel=normalizeModel(model),key=createHash('sha256').update(apiKey.trim()+'|'+configuredModel).digest('hex');
 const pause=cooldowns.get(key);if(pause&&pause>Date.now()){const seconds=Math.ceil((pause-Date.now())/1000);throw new AnalysisError('La última generación falló por indisponibilidad de Google. Espera '+seconds+' segundos antes de volver a probar; no se ha realizado otra llamada.',503,'PROVIDER_COOLDOWN',503);}cooldowns.delete(key);
 const saved=workingModels.get(key);let current=saved&&Date.now()-saved.at<21600000?saved.model:configuredModel;const attempted=new Set();const signal=AbortSignal.timeout(90000);let retried=false,switched=false;
 const unavailable=()=>{if(cooldowns.size>=64)cooldowns.clear();cooldowns.set(key,Date.now()+30000);const e=new AnalysisError('Google sigue sin completar la generación después de los intentos limitados con '+[...attempted].join(', ')+'. No se produjo ningún análisis. Se suspenderán nuevos intentos durante 30 segundos. Si también falla generar directamente en AI Studio con el mismo proyecto, la indisponibilidad debe resolverse con Google.',503,'GOOGLE_GENERATION_UNAVAILABLE',503);e.model=current;return e;};
 for(let attempt=0;attempt<3;attempt++){
  attempted.add(current);let response;try{response=await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${current}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey.trim()},body:JSON.stringify(payload),signal});}catch{throw new AnalysisError('No se pudo conectar al servicio de IA o se agotó el tiempo de espera.',502,'PROVIDER_CONNECTION_FAILED');}
  if(response.ok){let body;try{body=await response.json();}catch{throw new AnalysisError('Google devolvió una respuesta no válida.',502,'INVALID_PROVIDER_RESPONSE');}if(workingModels.size>=64)workingModels.clear();workingModels.set(key,{model:current,at:Date.now()});return {body,model:current,configuredModel,usedFallback:current!==configuredModel,usedRetry:retried};}
  const retryHeader=response.headers?.get?.('retry-after');let retryAfter=retryHeader?Number(retryHeader):0;if(retryHeader&&!Number.isFinite(retryAfter))retryAfter=Math.max(0,(Date.parse(retryHeader)-Date.now())/1000);if(!Number.isFinite(retryAfter))retryAfter=0;
  const error=await providerFailure(response);error.model=current;error.apiVersion='v1beta';
  const missing=response.status===404&&error.code==='MODEL_UNAVAILABLE',busy=response.status===503&&error.code==='PROVIDER_UNAVAILABLE';
  if(!missing&&!busy)throw error;
  workingModels.delete(key);
  if(busy&&retryAfter>5){if(cooldowns.size>=64)cooldowns.clear();cooldowns.set(key,Date.now()+Math.min(retryAfter,3600)*1000);error.message='Google solicitó esperar '+Math.ceil(retryAfter)+' segundos antes de reintentar. No se envió otra generación ni se cambió la clave.';throw error;}
  if(busy&&!retried&&attempt<2){retried=true;await sleepImpl(Math.max(1000,retryAfter*1000));if(signal.aborted)throw new AnalysisError('Se agotó el tiempo de espera para la generación.',502,'PROVIDER_CONNECTION_FAILED');continue;}
  if(switched||attempt===2){if(busy)throw unavailable();throw new AnalysisError('Google no permite generar con los modelos comprobados: '+[...attempted].join(', ')+'. No se completó el análisis.',502,'GENERATION_MODEL_UNAVAILABLE',404);}
  let models;try{models=await listModels({apiKey,fetchImpl,signal});}catch(listError){if(busy)throw unavailable();throw listError;}const next=safeFlashAlternatives(models,attempted)[0];
  if(!next){if(busy)throw unavailable();error.message='Google no permite generar con '+current+' y no lista otro Flash estable compatible. No se cambió tu clave. Comprueba la generación desde AI Studio con el mismo proyecto.';throw error;}
  current=next;switched=true;
 }
}
export function responseText(body){return body?.candidates?.[0]?.content?.parts?.filter(x=>typeof x.text==='string').map(x=>x.text).join('')||'';}
