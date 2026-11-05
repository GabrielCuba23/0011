import {AnalysisError} from './provider-errors.js';
export function transportFailure(cause,{stage='generate',model=null,started=Date.now(),aborted=false,logImpl=console.warn}={}){
 const raw=cause?.cause?.code||cause?.code;const transportCode=typeof raw==='string'&&/^[A-Z0-9_]{2,60}$/.test(raw)?raw:null;
 let code='PROVIDER_CONNECTION_FAILED',message='No se pudo establecer o mantener la conexión con Google.';
 if(aborted||cause?.name==='TimeoutError'||cause?.name==='AbortError'){code='GENERATION_TIMEOUT';message='Se agotó el plazo de la solicitud a Google. No significa que la clave sea inválida ni que el análisis haya terminado.';}
 else if(['ENOTFOUND','EAI_AGAIN'].includes(transportCode)){code='PROVIDER_DNS_ERROR';message='El servidor no pudo resolver la dirección de Google. Hay un fallo de conectividad DNS.';}
 else if(['UND_ERR_CONNECT_TIMEOUT','ETIMEDOUT'].includes(transportCode)){code='PROVIDER_CONNECT_TIMEOUT';message='La conexión de red con Google no se estableció a tiempo.';}
 else if(['CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','DEPTH_ZERO_SELF_SIGNED_CERT','ERR_TLS_CERT_ALTNAME_INVALID','SELF_SIGNED_CERT_IN_CHAIN'].includes(transportCode)){code='PROVIDER_TLS_ERROR';message='La verificación TLS de la conexión con Google falló. Debe corregirse la confianza del servidor; no se desactivó la verificación.';}
 else if(['ECONNRESET','EPIPE','UND_ERR_SOCKET'].includes(transportCode)){code='PROVIDER_CONNECTION_RESET';message='La conexión con Google se interrumpió durante la solicitud.';}
 const elapsedMs=Math.max(0,Date.now()-started);const error=new AnalysisError(message,502,code);Object.assign(error,{model,stage,transportCode,elapsedMs});
 logImpl(JSON.stringify({event:'gemini_transport_failure',code,stage,model,transportCode,elapsedMs}));return error;
}
export async function checkGoogleReachability({fetchImpl=fetch}={}){
 const started=Date.now();try{const response=await fetchImpl('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1',{signal:AbortSignal.timeout(12000)});await response.body?.cancel?.().catch(()=>{});return {reachable:true,http:response.status,elapsedMs:Date.now()-started};}catch(cause){const raw=cause?.cause?.code||cause?.code;return {reachable:false,timeout:cause?.name==='TimeoutError',transportCode:typeof raw==='string'&&/^[A-Z0-9_]{2,60}$/.test(raw)?raw:null,elapsedMs:Date.now()-started};}
}
