export class AnalysisError extends Error{constructor(message,status=400,code='ANALYSIS_ERROR',providerStatus=null){super(message);this.status=status;this.code=code;this.providerStatus=providerStatus;}}
export async function providerFailure(response){
 let body;try{body=await response.json();}catch{}
 const error=body?.error||{};
 const reasons=(Array.isArray(error.details)?error.details:[]).map(x=>x?.reason).filter(x=>typeof x==='string');
 const message=typeof error.message==='string'?error.message.toLowerCase():'';
 let code='PROVIDER_REJECTED', explanation='Google rechazó la consulta. Revisa la configuración de Gemini en Render.';
 if(reasons.includes('API_KEY_INVALID')||/api key not valid|api_key_invalid|invalid api key/.test(message)){code='API_KEY_INVALID';explanation='Google indica que la clave de Gemini no es válida. En Render → Environment, corrige GEMINI_API_KEY usando una clave de AI Studio y guarda el cambio.';}
 else if(/expired|leaked/.test(message)){code='API_KEY_UNUSABLE';explanation='Google indica que la clave expiró o fue bloqueada. Sustituye GEMINI_API_KEY en Render por una nueva clave de AI Studio.';}
 else if(reasons.some(x=>['API_KEY_HTTP_REFERRER_BLOCKED','API_KEY_IP_ADDRESS_BLOCKED','API_KEY_SERVICE_BLOCKED'].includes(x))){code='KEY_RESTRICTED';explanation='Las restricciones de la clave no permiten esta llamada desde el servidor. Revisa en Google Cloud las restricciones y el acceso a Generative Language API de esa clave.';}
 else if(reasons.includes('SERVICE_DISABLED')){code='SERVICE_DISABLED';explanation='Generative Language API está deshabilitada para el proyecto de esa clave. Habilítala en el proyecto correspondiente de Google Cloud.';}
 else if(reasons.includes('BILLING_DISABLED')||/billing/.test(message)){code='BILLING_REQUIRED';explanation='Google solicita revisar la facturación del proyecto de AI Studio. Comprueba allí el estado y los requisitos del modelo elegido.';}
 else if(/models?\/gemini|model[^.]{0,160}(not found|no longer available|not supported)|not supported for generatecontent/.test(message)||reasons.includes('MODEL_NOT_FOUND')){code='MODEL_UNAVAILABLE';explanation='El modelo configurado no está disponible para esta clave o versión de API. Usa «Diagnosticar IA» para consultar los modelos y actualiza GEMINI_MODEL en Render.';}
 else if(response.status===404){code='PROVIDER_ENDPOINT_NOT_FOUND';explanation='La ruta de generación devolvió HTTP 404 sin identificar un modelo ausente. No se ha demostrado que la clave o el modelo sean incorrectos. Revisa la conexión del proveedor y ejecuta la prueba de generación real.';}
 else if(/location|country|region is not supported/.test(message)){code='LOCATION_UNSUPPORTED';explanation='Google no admite esta solicitud desde la ubicación del servidor o del proyecto. Revisa la disponibilidad regional de Gemini.';}
 else if(response.status===429){code='QUOTA_EXCEEDED';explanation='Google rechazó la consulta por cuota o límite de solicitudes. Revisa los límites del proyecto y del modelo en AI Studio.';}
 else if(response.status===401||response.status===403){code='ACCESS_DENIED';explanation='Google denegó el acceso. Comprueba que GEMINI_API_KEY pertenece al proyecto correcto y tiene acceso a Generative Language API y al modelo configurado.';}
 else if(response.status===400){code='INVALID_PROVIDER_REQUEST';explanation='Google rechazó el formato de la solicitud o una opción no admitida por el modelo. Diagnostica el modelo; este error también puede requerir corregir el conector de Vigía.';}
 else if(response.status>=500){code='PROVIDER_UNAVAILABLE';explanation='El servicio de Google está temporalmente indisponible. Intenta más tarde.';}
 return new AnalysisError(explanation,502,code,response.status);
}
