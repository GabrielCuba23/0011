import test from 'node:test';
import assert from 'node:assert/strict';
import {mediaDirectory,directoryMedia,directoryQueries,allowedPublisherUrl,collectDirectoryFeeds} from '../lib/media-directory.js';
import {buildSearchQueries,parseNews,deduplicateNews} from '../lib/news.js';
import {permittedArticle} from '../lib/editorial.js';
const now=Date.parse('2026-11-05T15:00:00Z');
function rss(host,title='Prueba: lluvias en Piura'){return `<rss><channel><item><title>${title}</title><link>https://${host}/noticia-fixture</link><pubDate>Thu, 05 Nov 2026 14:00:00 GMT</pubDate></item></channel></rss>`;}
test('reviewed workbook catalogue preserves 399 media rows, merges seven repeats and retains all six Piura outlets',()=>{
 assert.equal(mediaDirectory.acceptedRows,399);assert.equal(mediaDirectory.uniqueMedia,392);assert.equal(mediaDirectory.mergedRows,7);assert.equal(Object.keys(mediaDirectory.regions).length,25);const piura=directoryMedia('Piura');assert.equal(piura.length,6);assert.ok(piura.find(x=>x.name==='Cutivalú').websites.includes('https://cutivalu.pe/'));assert.equal(mediaDirectory.entries.filter(e=>!e.websites.length&&!e.socialLinks.length&&!e.shortLinks.length&&!e.directoryLinks.length).length,1);
});
test('directory adds domain-targeted queries while selecting one outlet excludes general queries',()=>{
 const result=buildSearchQueries('Piura',{expanded:true,directory:true});assert.equal(result.queries.length,7);assert.ok(result.queries.some(x=>x.query.includes('site:walac.pe')));const medium=directoryMedia('Piura')[0];const specific=buildSearchQueries('Piura',{directory:true,mediaId:medium.id});assert.ok(specific.queries.every(x=>x.query.includes('site:cutivalu.pe')));assert.ok(directoryQueries('Piura',specific.options,'lluvias').domainsTotal===1);
});
test('publisher requests and link imports remain restricted to reviewed web hosts',()=>{
 const medium=directoryMedia('Piura')[0];assert.equal(allowedPublisherUrl('https://www.cutivalu.pe/feed/',medium).hostname,'www.cutivalu.pe');for(const url of ['https://127.0.0.1/feed/','https://cutivalu.pe.attacker.test/feed/','https://user:secret@cutivalu.pe/feed/','http://cutivalu.pe/feed/'])assert.throws(()=>allowedPublisherUrl(url,medium));assert.equal(permittedArticle('https://walac.pe/noticia').hostname,'walac.pe');assert.throws(()=>permittedArticle('https://www.facebook.com/post'));
});
test('a validated public publisher feed supplies dated news and subsequent reads fetch fresh content',async()=>{
 const medium=directoryMedia('Piura')[0];let calls=0;const options={mediaId:medium.id,scope:'all',terms:''};const handlers={now:()=>now,parseFeed:xml=>parseNews(xml,now),fetchImpl:async()=>{calls++;return new Response(rss('cutivalu.pe',calls===1?'Prueba inicial del agua sin ubicación':'Prueba actualizada de Piura'));}};
 const a=await collectDirectoryFeeds('Piura',options,handlers);assert.equal(a.statuses[0].state,'ok');assert.equal(a.items[0].directoryMediaId,medium.id);assert.equal(a.items[0].sourceType,'publisher-feed');assert.deepEqual(a.items[0].regions,[]);assert.ok(a.items[0].sourceRegions.includes('Piura'));const b=await collectDirectoryFeeds('Piura',options,handlers);assert.match(b.items[0].title,/actualizada/);assert.equal(calls,2);
});
test('homepage-advertised feeds are detected without inventing social access',async()=>{
 const medium=directoryMedia('Piura').find(x=>x.name==='Walac Noticias');let calls=0;const result=await collectDirectoryFeeds('Piura',{mediaId:medium.id,scope:'all',terms:''},{now:()=>now,parseFeed:xml=>parseNews(xml,now),fetchImpl:async url=>{calls++;if(url.endsWith('/feed/'))return new Response('Not found',{status:404});if(url.endsWith('/rss.xml'))return new Response(rss('walac.pe'));return new Response('<html><head><link rel="alternate" type="application/rss+xml" href="/rss.xml"></head></html>');}});assert.equal(calls,3);assert.equal(result.items.length,1);
 const social=mediaDirectory.entries.find(e=>!e.websites.length&&e.socialLinks.length);const none=await collectDirectoryFeeds('',{mediaId:social.id},{parseFeed:()=>[],fetchImpl:async()=>{throw Error('Must not fetch social pages');}});assert.equal(none.checked,0);
});
test('Atom publication dates are supported without treating updated-only old entries as fresh news',()=>{
 const xml='<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Piura: prueba Atom</title><link rel="alternate" href="https://example.com/new"/><published>2026-11-05T14:00:00Z</published></entry><entry><title>Nota antigua actualizada</title><link href="https://example.com/old"/><updated>2026-11-05T14:00:00Z</updated></entry></feed>';const rows=parseNews(xml,now);assert.equal(rows.length,1);assert.equal(rows[0].url,'https://example.com/new');
});

test('same publisher story from Google News and RSS is merged despite display-name differences',()=>{
 const first={id:'google',url:'https://news.google.com/rss/articles/fixture',title:'Lluvias en Piura - Walac Noticias',source:'Walac Noticias',publisherDomain:'walac.pe',publishedAt:'2026-11-05T10:00:00Z'};const second={...first,id:'rss',url:'https://walac.pe/noticia',title:'Lluvias en Piura',source:'Walac Noticias — edición digital'};assert.equal(deduplicateNews([first,second]).length,1);
});
