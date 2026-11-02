import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
test('image interface requires a connected service and keeps inconclusive images without a false map pin',async()=>{
 class Element{children=[];textContent='';value='';checked=false;hidden=false;disabled=false;append(...n){this.children.push(...n);}replaceChildren(...n){this.children=n;}scrollIntoView(){}}
 const ids=new Map();const get=id=>{if(!ids.has(id))ids.set(id,new Element());return ids.get(id);};
 const context=vm.createContext({document:{getElementById:get,createElement:()=>new Element()},localStorage:{getItem:()=>'',setItem:()=>{}},URL,location:{origin:'https://example.com'},fetch:async()=>({ok:true,json:async()=>({imageAnalysis:false})}),AbortSignal});
 vm.runInContext(await readFile(new URL('../public/image-analysis.js',import.meta.url),'utf8'),context);await new Promise(r=>setImmediate(r));
 assert.equal(get('analyze-image').disabled,true);assert.equal(get('analysis-connection').textContent,'Análisis sin activar');
 vm.runInContext("showResult({summary:'Sin indicios suficientes',observations:[],candidates:[],impact:'Por confirmar',questions:['¿Tienes una referencia?']})",context);
 assert.ok(get('map-title').textContent.includes('sin ubicación confirmada'));assert.ok(!get('analysis-map').src.includes('marker='));assert.equal(get('geo-candidates').children.length,1);
});
