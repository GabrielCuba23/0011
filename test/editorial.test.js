import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEditorial,validateSelection,analyzeEditorial,permittedArticle,importArticle} from '../lib/editorial.js';
const items=[{id:'n1',title:'Vecinos reclaman protección',text:'La población pide una explicación a la municipalidad.',source:'Medio de prueba',kind:'news',documented:false}];
test('semaphore requires real quotes and does not accept unsupported technical certainty',()=>{
 const result=normalizeEditorial({summary:'Resumen de prueba',actors:[{actor:'Población',color:'rojo',finding:'Reclamo',evidence:[{id:'n1',quote:'Vecinos reclaman protección'}]},{actor:'ANA',color:'verde',finding:'Técnico',evidence:[{id:'n1',quote:'La población pide una explicación'}]},{actor:'Municipalidad',color:'rojo',finding:'Inventado',evidence:[{id:'n1',quote:'Una declaración que nunca se aportó'}]}],topics:[{name:'Tema sin evidencia',sourceIds:['inventado']}]},items);
 assert.equal(result.actors[0].color,'rojo');assert.equal(result.actors[1].color,'amarillo');assert.equal(result.actors[2].color,'sin evidencia');assert.equal(result.topics.length,0);
});
test('editorial selection is bounded and duplicates are rejected',()=>{assert.throws(()=>validateSelection({items:[]}));assert.throws(()=>validateSelection({items:[...items,...items]}));assert.throws(()=>validateSelection({items:Array(31).fill(items[0])}));assert.equal(validateSelection({items}).length,1);});
test('analysis uses only selected inputs and preserves cited IDs',async()=>{
 const result=await analyzeEditorial({items},{apiKey:'test-fixture',fetchImpl:async(url,options)=>{const request=JSON.parse(options.body);assert.match(request.systemInstruction.parts[0].text,/No calcules alcance social/);return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({summary:'Muestra de prueba',actors:[{actor:'Vecinos',color:'rojo',finding:'Reclamo de protección',evidence:[{id:'n1',quote:'Vecinos reclaman protección'}]}],topics:[],limits:'Solo título y extracto'})}]}}]})};}});assert.deepEqual(result.analyzedIds,['n1']);assert.equal(result.actors[0].color,'rojo');
});
test('link import blocks private hosts, unsupported sites and redirect escapes',async()=>{
 for(const url of ['http://rpp.pe/a','https://127.0.0.1/a','https://169.254.169.254/','https://rpp.pe.attacker.test/a','https://user:secret@rpp.pe/a'])assert.throws(()=>permittedArticle(url));
 await assert.rejects(importArticle('https://rpp.pe/a',{fetchImpl:async()=>new Response('',{status:302,headers:{location:'https://169.254.169.254/'}})}));
 const imported=await importArticle('https://rpp.pe/a',{fetchImpl:async()=>new Response('<html><head><meta property="og:title" content="Título de prueba"><meta property="og:site_name" content="Medio"></head><article><p>Este párrafo contiene un reporte periodístico suficientemente largo para su extracción de prueba.</p></article></html>',{headers:{'content-type':'text/html'}})});assert.equal(imported.title,'Título de prueba');assert.equal(imported.verified,false);assert.match(imported.text,/reporte periodístico/);
});
