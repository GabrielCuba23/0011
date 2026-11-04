import {createHash} from 'node:crypto';
import {AnalysisError,providerFailure} from './provider-errors.js';
const workingModels=new Map();
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
export async function generateGemini(payload,{apiKey,model='gemini-flash-latest',fetchImpl=fetch}={}){
 if(!apiKey?.trim())throw new AnalysisError('Falta configurar la credencial de Gemini.',503,'MISSING_API_KEY');
 const configuredModel=normalizeModel(model),key=createHash('sha256').update(apiKey.trim()+'|'+configuredModel).digest('hex');const saved=workingModels.get(key);let current=saved&&Date.now()-saved.at<21600000?saved.model:configuredModel;const attempted=new Set();const signal=AbortSignal.timeout(90000);
 for(let attempt=0;attempt<2;attempt++){
  attempted.add(current);let response;try{response=await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${current}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey.trim()},body:JSON.stringify(payload),signal});}catch{throw new AnalysisError('No se pudo conectar al servicio de IA o se agotó el tiempo de espera.',502,'PROVIDER_CONNECTION_FAILED');}
  if(response.ok){let body;try{body=await response.json();}catch{throw new AnalysisError('Google devolvió una respuesta no válida.',502,'INVALID_PROVIDER_RESPONSE');}if(workingModels.size>=64)workingModels.clear();workingModels.set(key,{model:current,at:Date.now()});return {body,model:current,configuredModel,usedFallback:current!==configuredModel};}
  const error=await providerFailure(response);error.model=current;error.apiVersion='v1beta';
  if(response.status!==404||error.code!=='MODEL_UNAVAILABLE')throw error;
  workingModels.delete(key);
  if(attempt===1)throw new AnalysisError(`Google rechazó la generación con los modelos disponibles comprobados (${[...attempted].join(', ')}). La lista de modelos no garantiza acceso a generateContent. Ejecuta «Probar generación real» para comprobar el proveedor.`,502,'GENERATION_MODEL_UNAVAILABLE',404);
  const models=await listModels({apiKey,fetchImpl,signal});const next=safeFlashAlternatives(models,attempted)[0];if(!next){error.message=`Google no permite generar con ${current} y no lista otro modelo Flash estable compatible para probar. No se cambió tu clave. Comprueba la generación desde AI Studio con el mismo proyecto.`;throw error;}current=next;
 }
}
export function responseText(body){return body?.candidates?.[0]?.content?.parts?.filter(x=>typeof x.text==='string').map(x=>x.text).join('')||'';}
