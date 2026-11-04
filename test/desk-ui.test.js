import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
test('news desk deduplicates selection and keeps unknown social counts distinct from observed zero',async()=>{
 class Element{children=[];textContent='';value='';checked=false;style={};append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}scrollIntoView(){}}
 const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};let saved;
 const context=vm.createContext({document:{getElementById:get,createElement:()=>new Element(),addEventListener:()=>{}},localStorage:{getItem:()=>null,setItem:(key,value)=>{saved=JSON.parse(value);}},URL,Date,Intl,location:{href:'https://example.com/',origin:'https://example.com'},setTimeout,crypto});
 vm.runInContext(await readFile(new URL('../public/desk.js',import.meta.url),'utf8'),context);
 vm.runInContext("addArticle({id:'one',title:'Noticia de prueba',source:'Fuente de prueba',url:'https://example.com/a',regions:['Tumbes'],metrics:{comments:0,reactions:null}});addArticle({id:'one',title:'Duplicado',source:'Otro',regions:[]});",context);
 assert.equal(saved.items.length,1);const social=get('desk-social').children.map(x=>x.textContent).join(' ');assert.match(social,/Comentarios: 0/);assert.match(social,/Reacciones: Sin datos/);assert.match(get('desk-analysis').children[0].textContent,/Selecciona publicaciones/);
});
