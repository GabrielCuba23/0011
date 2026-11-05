import test from 'node:test';
import assert from 'node:assert/strict';
import {officialUrl,officialDocumentUrl,normalizeBulletins,extractOfficialPdfs,createDocumentLibrary,downloadOfficialPdf,editionDate} from '../lib/documents.js';
const data={data:[{title:'Boletín Hidrológico Piura · prueba',frequency:'mes',publications:[{date:'2026-11-05',fileUrl:'https://www.senamhi.gob.pe/load/file/fixture.pdf'},{date:'2026-11-05',fileUrl:'https://untrusted.example/fixture.pdf'}]}]};
test('official PDF URLs require a reviewed HTTPS host and redirects cannot escape it',async()=>{
 for(const url of ['http://www.senamhi.gob.pe/a.pdf','https://127.0.0.1/a.pdf','https://www.senamhi.gob.pe.attacker.test/a.pdf','https://user:secret@snirh.ana.gob.pe/a.pdf'])assert.throws(()=>officialUrl(url));
 await assert.rejects(downloadOfficialPdf('https://www.senamhi.gob.pe/a.pdf',{fetchImpl:async()=>new Response('',{status:302,headers:{location:'https://127.0.0.1/private'}})}),e=>e.code==='UNSUPPORTED_DOCUMENT_HOST');
});
test('SENAMHI bulletin fields match the public client and invalid hosts and dates are not invented',()=>{
 const normalized=normalizeBulletins(data,{id:'hydrological',label:'Hidrología'});assert.equal(normalized.documents.length,1);assert.equal(normalized.excluded,1);assert.equal(normalized.documents[0].editionDate,'2026-11-05');assert.equal(normalized.documents[0].pdfVerified,false);assert.equal(editionDate('2026-02-31'),null);assert.equal(editionDate('not a date'),null);
});
test('ANA public HTML only contributes explicit official PDF links, not dynamic report pages or JavaScript',()=>{
 const rows=extractOfficialPdfs('<a href="/onrh/docs/boletin.pdf">Boletín de prueba</a><a href="Reportes.aspx?R=PRIOS">Reporte de ríos</a><a href="javascript:alert(1)">Ver</a><a href="https://evil.example/file.pdf">Otro</a>','https://snirh.ana.gob.pe/onrh/');assert.equal(rows.length,1);assert.equal(rows[0].editionDate,null);assert.equal(rows[0].url,'https://snirh.ana.gob.pe/onrh/docs/boletin.pdf');
});
test('library reads real-shaped categories and publications, caches results and preserves provenance on failure',async()=>{
 let time=Date.parse('2026-11-05T15:00:00Z'),offline=false,calls=0;
 const library=createDocumentLibrary({now:()=>time,fetchImpl:async url=>{calls++;if(offline)throw Error('blocked');return new Response(JSON.stringify(url.includes('/categories')?{data:[{id:'hydrological',label:{es:'Hidrología'}}]}:data),{headers:{'content-type':'application/json'}});}});
 const first=await library.get('senamhi');assert.equal(first.documents.length,1);assert.equal(first.categories[0].label,'Hidrología');assert.equal(calls,2);await library.get('senamhi');assert.equal(calls,2);offline=true;time+=601000;const failed=await library.get('senamhi');assert.equal(failed.state,'error');assert.equal(failed.documents[0].retained,true);assert.equal(failed.lastSuccessAt,first.lastSuccessAt);assert.notEqual(failed.checkedAt,first.checkedAt);
});
test('PDF download validates the bytes and rejects a login/error HTML page even if labeled application/pdf',async()=>{
 const response=await downloadOfficialPdf('https://snirh.ana.gob.pe/onrh/test.pdf',{fetchImpl:async()=>new Response('%PDF-1.7\nfixture bytes',{headers:{'content-type':'application/octet-stream'}})});assert.equal(response.buffer.subarray(0,5).toString(),'%PDF-');
 await assert.rejects(downloadOfficialPdf('https://snirh.ana.gob.pe/onrh/test.pdf',{fetchImpl:async()=>new Response('<html>Login</html>',{headers:{'content-type':'application/pdf'}})}),e=>e.code==='NOT_A_PDF');
});
test('an ANA report without a public PDF remains explicitly partial and does not create fictitious documents',async()=>{
 const library=createDocumentLibrary({fetchImpl:async()=>new Response('<form><input name="__VIEWSTATE" value="private-fixture"><a href="Reportes.aspx?R=PRIOS">Reporte</a></form>')});const result=await library.get('ana');assert.equal(result.state,'limited');assert.equal(result.documents.length,0);assert.ok(!JSON.stringify(result).includes('private-fixture'));assert.match(result.sourceInfo.apiEvidence,/No se ha confirmado/);
});

test('ANA handlers returning PDF are recognized by bytes rather than extension',async()=>{
 const library=createDocumentLibrary({fetchImpl:async url=>new Response(url.includes('PRIOS')?'%PDF-1.7\nfixture':'<html/>')});const result=await library.get('ana');assert.equal(result.documents.length,1);assert.equal(result.documents[0].pdfVerified,true);assert.ok(result.documents[0].url.includes('Reportes.aspx'));
});

test('legacy official HTTP document links upgrade to verified HTTPS without permitting foreign origins',()=>{
 assert.equal(officialDocumentUrl('http://www.senamhi.gob.pe/load/file/test.pdf').protocol,'https:');assert.throws(()=>officialDocumentUrl('http://private.example/document.pdf'));
});

test('relative PDF links follow the official portal base while missing URLs are excluded',()=>{
 const result=normalizeBulletins({data:[{title:'Prueba',publications:[{fileUrl:'/assets/test.pdf',date:'2026-11-05'},{date:'2026-11-05'}]}]},{id:'hydrological',label:'Hidrología'});assert.equal(result.documents[0].url,'https://observatorio.senamhi.gob.pe/assets/test.pdf');assert.equal(result.excluded,1);
});

test('ANA connection errors preserve the actionable cause instead of reporting an empty successful catalog',async()=>{const error=Object.assign(new TypeError('fetch failed'),{cause:{code:'CERT_HAS_EXPIRED'}});const library=createDocumentLibrary({fetchImpl:async()=>{throw error;}});const result=await library.get('ana');assert.equal(result.state,'error');assert.equal(result.errorCode,'OFFICIAL_TLS_FAILED');assert.equal(result.lastSuccessAt,null);assert.match(result.notes[0],/certificado HTTPS/);});
