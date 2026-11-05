import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSearchQueries,searchOptions,parseNews,deduplicateNews,geography,createLiveFeed} from '../lib/news.js';
test('expanded Piura search varies themes and localities, preserving exact time window and keyword input limits',()=>{
 const {queries,options}=buildSearchQueries('Piura',{expanded:true,hours:168,terms:'Poechos Chira'});assert.equal(queries.length,6);assert.ok(queries.some(x=>x.query.includes('Sullana')));assert.ok(queries.some(x=>x.query.includes('descolmatación')));assert.ok(queries.every(x=>x.query.includes('when:7d')&&x.query.includes('Poechos Chira')));assert.equal(options.hours,168);assert.throws(()=>searchOptions({hours:1}));assert.throws(()=>searchOptions({terms:'x'.repeat(161)}));assert.equal(buildSearchQueries('Piura',{expanded:false}).queries.length,1);
});
test('explicit 7-day window includes older articles while 24 hours does not',()=>{
 const now=Date.parse('2026-11-05T15:00:00Z');const xml='<rss><channel><item><title>Piura: reporte de prueba</title><link>https://example.com/older</link><pubDate>Mon, 02 Nov 2026 14:00:00 GMT</pubDate></item></channel></rss>';assert.equal(parseNews(xml,now,24).length,0);assert.equal(parseNews(xml,now,168).length,1);
});
test('search duplicates merge URLs or same outlet/title/day, but preserve distinct outlets and provenance',()=>{
 const a={id:'1',url:'https://example.com/a?utm_source=x',title:'Reporte de Piura',source:'Medio A',publishedAt:'2026-11-05T10:00:00Z',matchedQueries:['Ríos']};const rows=deduplicateNews([a,{...a,id:'2',url:'https://example.com/a?utm_source=y',matchedQueries:['Lluvias']},{...a,id:'3',url:'https://example.com/copy'},{...a,id:'4',source:'Medio B',url:'https://example.com/b'}]);assert.equal(rows.length,2);assert.deepEqual(rows[0].matchedQueries,['Ríos','Lluvias']);assert.equal(rows[0].url,'https://example.com/a');
});
test('locality-based region hints are explicit and ambiguous names alone are not treated as confirmed geography',()=>{
 assert.deepEqual(geography('Lluvias en Sullana y Talara').regions,['Piura']);assert.equal(geography('Lluvias en Sullana').localityHints[0].locality,'Sullana');assert.deepEqual(geography('Lluvias en Huancabamba, Pasco').regions,['Pasco']);
});
test('expanded batches tolerate one failed query and cache windows separately',async()=>{
 let requests=0;const service=createLiveFeed({now:()=>Date.parse('2026-11-05T15:00:00Z'),fetchImpl:async url=>{requests++;if(url.includes('news.google')){const q=new URL(url).searchParams.get('q');if(q.includes('drenaje'))throw Error('query unavailable');return new Response('<rss><channel/></rss>');}if(url.includes('/api/hydrology'))return new Response('{"data":[]}');return new Response('<html/>');}});
 const a=await service.get('Piura',{expanded:true,hours:24});assert.equal(a.search.queriesPlanned,6);assert.equal(a.search.queriesSucceeded,5);assert.equal(a.sources[0].state,'limited');const before=requests;await service.get('Piura',{expanded:true,hours:24});assert.equal(requests,before);await service.get('Piura',{expanded:true,hours:168});assert.ok(requests>before);
});
