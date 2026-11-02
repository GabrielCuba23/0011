import test from 'node:test';
import assert from 'node:assert/strict';
import {AnalysisError,validateInput,analyzeImage,normalizeAnalysis,geocodeCandidate} from '../lib/analyze.js';
const image=Buffer.from([137,80,78,71,13,10,26,10,0]).toString('base64');
const input={image,mimeType:'image/png',question:'Quel río aparece?'};
test('rejects nonimages, invalid base64 and oversized uploads before contacting IA',()=>{
 for(const payload of [{...input,mimeType:'text/html'},{...input,image:'bad'},{...input,image:Buffer.from('not a photo').toString('base64')},{...input,question:''},{...input,image:'a'.repeat(14*1024*1024)}])assert.throws(()=>validateInput(payload),AnalysisError);
 assert.equal(validateInput(input).mimeType,'image/png');
});
test('missing credentials fail explicitly; no invented analysis',async()=>{
 await assert.rejects(analyzeImage(input),e=>e.status===503);
});
test('provider sends image and schema server-side; normalized results never verify places or fabricate impact',async()=>{
 let called=false;
 const result=await analyzeImage(input,{apiKey:'test-fixture-key',fetchImpl:async(url,options)=>{called=true;assert.ok(url.includes(':generateContent'));assert.equal(options.headers['x-goog-api-key'],'test-fixture-key');const body=JSON.parse(options.body);assert.equal(body.contents[0].parts[1].inlineData.data,image);assert.ok(body.systemInstruction.parts[0].text.includes('No inventes lugares'));return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({summary:'Río y puente visibles.',observations:['Baranda visible'],candidates:[{name:'Puente de prueba',region:'Tumbes',reason:'Referencia aportada',confidence:'alta',verified:true,lat:123}],event:'Sin datos suficientes',questions:[],impact:'1000 afectados'})}]}}]})};}});
 assert.ok(called);assert.equal(result.candidates[0].verified,false);assert.equal(result.candidates[0].confidence,'baja');assert.equal(result.candidates[0].lat,undefined);assert.match(result.impact,/por confirmar/);assert.ok(!JSON.stringify(result).includes('test-fixture-key'));
});
test('provider outages and malformed answers do not become successful results',async()=>{
 await assert.rejects(analyzeImage(input,{apiKey:'fixture',fetchImpl:async()=>({ok:false,status:429})}),e=>e.status===502);
 await assert.rejects(analyzeImage(input,{apiKey:'fixture',fetchImpl:async()=>({ok:true,json:async()=>({candidates:[]})})}),e=>e.status===502);
 assert.throws(()=>normalizeAnalysis({summary:'nothing'}),AnalysisError);
});
test('map coordinates come from geocoder results and remain unverified name matches',async()=>{
 const result=await geocodeCandidate({name:'Referencia de prueba',region:'Tumbes'},{fetchImpl:async url=>{assert.ok(url.includes('countrycodes=pe'));return {ok:true,json:async()=>[{lat:'-3.5',lon:'-80.3',display_name:'Lugar de prueba'}]};}});
 assert.equal(result.lat,-3.5);assert.match(result.verification,/no ubicación confirmada/);
});
