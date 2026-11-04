import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/image-analysis.js',import.meta.url),'utf8');
function page(storage,{valid=true,legacy=false,origin='https://server.example'}={}){
 class Element{children=[];value='';checked=false;textContent='';append(...x){this.children.push(...x);}replaceChildren(...x){this.children=x;}scrollIntoView(){}}
 const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
 const context=vm.createContext({document:{getElementById:get,createElement:()=>new Element()},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},URL,location:{origin,hostname:new URL(origin).hostname},AbortSignal,fetch:async(url,options)=>url.endsWith('/api/capabilities')?{ok:true,json:async()=>({imageAnalysis:true,authenticationCheck:!legacy})}:{ok:valid,status:valid?200:401,json:async()=>({authenticated:valid})}});
 vm.runInContext(source,context);return {get,context};
}
const settle=()=>new Promise(r=>setImmediate(r));
test('validated observatory access survives reload and forget removes only credentials',async()=>{
 const storage=new Map([['vigia-desk-v1','preserved-news']]);const first=page(storage);await settle();first.get('analysis-access').value='test-fixture-token';await first.get('connect-analysis').onclick();assert.ok(storage.has('vigia-access-v1'));
 const second=page(storage);await settle();assert.equal(second.get('analysis-access').value,'test-fixture-token');assert.equal(second.get('analysis-connection').textContent,'Acceso al servidor validado');second.get('forget-analysis').onclick();assert.equal(storage.has('vigia-access-v1'),false);assert.equal(storage.get('vigia-desk-v1'),'preserved-news');assert.equal(second.get('analysis-access').value,'');
});
test('invalid keys are not persisted and old backends are not reported as connected',async()=>{
 const storage=new Map();const invalid=page(storage,{valid:false});await settle();invalid.get('analysis-access').value='wrong-fixture';await invalid.get('connect-analysis').onclick();assert.equal(storage.has('vigia-access-v1'),false);assert.match(invalid.get('analysis-status').textContent,/no coincide/);
 const legacy=page(new Map(),{legacy:true});await settle();assert.match(legacy.get('analysis-status').textContent,/versión anterior/);assert.equal(legacy.get('analyze-image').disabled,true);
});
test('stored credentials are scoped to their server and opt-out erases persistent access',async()=>{
 const storage=new Map([['vigia-access-v1',JSON.stringify({server:'https://different.example',token:'fixture'})]]);const current=page(storage);await settle();assert.equal(current.get('analysis-access').value,'');current.get('remember-analysis').checked=false;current.get('remember-analysis').onchange();assert.equal(storage.has('vigia-access-v1'),false);
});
