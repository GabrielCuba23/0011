import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
test('dashboard filters region, source and rolling 24h without counting expired news',async()=>{
 class Element{
  children=[];textContent='';value='';checked=false;
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  addEventListener(){}
  get options(){return this.children;}
 }
 const ids=new Map();const get=id=>{if(!ids.has(id))ids.set(id,new Element());return ids.get(id);};get('region-filter').append(new Element());get('include-national').checked=true;
 const now=Date.now();const row=(region,hours,kind='news')=>({title:'Publicación de prueba',source:kind==='news'?'Prensa':'SENAMHI',url:'https://example.com/',kind,publishedAt:hours===null?null:new Date(now-hours*3600000).toISOString(),regions:region?[region]:[]});
 const data={updatedAt:new Date(now).toISOString(),regions:['Tumbes','Piura'],sources:[],items:[row('Tumbes',1),row('Piura',2),row('Tumbes',25),row('Tumbes',-1),row('',3),row('Tumbes',null,'official')]};
 const context=vm.createContext({document:{getElementById:get,createElement:()=>new Element()},URL,Date,Intl,location:{href:'https://example.com/0011/'},fetch:async()=>({ok:true,json:async()=>data}),setInterval:()=>{}});
 vm.runInContext(await readFile(new URL('../public/dashboard.js',import.meta.url),'utf8'),context);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(String(get('news-count').textContent),'3');
 get('region-filter').value='Tumbes';get('include-national').checked=false;vm.runInContext('renderDashboard()',context);
 assert.equal(String(get('news-count').textContent),'1');assert.equal(String(get('official-count').textContent),'1');
 get('institution-filter').value='SENAMHI';vm.runInContext('renderDashboard()',context);
 assert.equal(String(get('news-count').textContent),'0');assert.equal(String(get('official-count').textContent),'1');
});
