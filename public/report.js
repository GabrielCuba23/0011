export function formatReport(r){
 const location=[r.region,r.province].filter(Boolean).join(' / ')||'Ubicación por confirmar';
 const reference=r.bridge?`cerca del puente ${r.bridge}`:[r.sector,r.district].filter(Boolean).join(', ')||'ubicación específica por confirmar';
 const impact=r.people?`${r.people} personas (${r.impactType||'reportadas'}). ${r.impactDetail||''}`:'Afectación por confirmar.';
 return `${location.toUpperCase()}: ${r.river?'Río '+r.river:'Río por confirmar'} — ${r.event||'Evento por confirmar'}, ${reference}${r.bridge&&r.sector?', sector '+r.sector:''}. ${impact} Fuente: ${r.source||'sin registrar'}. Verificación: pendiente.`;
}
export function validCoordinates(lat,lon){return lat!==''&&lon!==''&&Number.isFinite(Number(lat))&&Number.isFinite(Number(lon))&&Math.abs(Number(lat))<=90&&Math.abs(Number(lon))<=180;}
