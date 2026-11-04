import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNews,detectRegions,createLiveFeed} from '../lib/news.js';
const now=Date.parse('2026-11-04T15:00:00Z');
const rss=`<rss><channel><item><title>Lluvias en Tumbes</title><link>https://example.com/a</link><source>Medio de prueba</source><pubDate>Wed, 04 Nov 2026 14:00:00 GMT</pubDate><description><![CDATA[<p>El río de Tumbes aumenta.</p>]]></description></item><item><title>Noticia vieja</title><link>https://example.com/b</link><pubDate>Mon, 02 Nov 2026 14:00:00 GMT</pubDate></item></channel></rss>`;
test('live parser filters by publication time, normalizes geography and rejects entity declarations',()=>{
 assert.equal(parseNews(rss,now).length,1);assert.deepEqual(parseNews(rss,now)[0].regions,['Tumbes']);assert.deepEqual(detectRegions('Ancash y San Martín'),['Áncash','San Martín']);assert.throws(()=>parseNews('<!DOCTYPE rss><rss/>',now));assert.throws(()=>parseNews('<html>Blocked</html>',now));
});
test('regional reads are coalesced and cached; expired cache really consults sources again',async()=>{
 let calls=0,time=now;
 const service=createLiveFeed({now:()=>time,fetchImpl:async url=>{calls++;if(url.includes('news.google'))return new Response(rss);if(url.includes('/api/hydrology'))return new Response('{"data":[]}');return new Response('<html>Portal dinámico</html>');}});
 const [a,b]=await Promise.all([service.get('Tumbes'),service.get('Tumbes')]);assert.equal(calls,5);assert.equal(a.items.length,1);assert.equal(b.mode,'live');await service.get('Tumbes');assert.equal(calls,5);time+=301000;await service.get('Tumbes');assert.equal(calls,7);
 await assert.rejects(service.get('Región inventada'));
});
test('failed live queries report failure, retain valid prior items and never replace last success with attempt time',async()=>{
 let time=now,offline=false;
 const service=createLiveFeed({now:()=>time,fetchImpl:async url=>{if(offline)throw Error('offline');if(url.includes('news.google'))return new Response(rss);if(url.includes('/api/hydrology'))return new Response('{"data":[]}');return new Response('<html/>');}});
 await service.get('Tumbes');time+=301000;offline=true;const failed=await service.get('Tumbes');const source=failed.sources.find(x=>x.name==='Noticias · Tumbes');assert.equal(source.state,'error');assert.equal(source.lastSuccessAt,new Date(now).toISOString());assert.notEqual(source.lastSuccessAt,source.checkedAt);assert.equal(failed.items.length,1);
});
