import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createAnaRiverFeed} from '../lib/ana-river-source.js';
import {latestAnaCopy} from '../public/ana-river-parser.js';
const cacheDir=new URL('../.ana-cache/',import.meta.url),dataDir=new URL('../data/',import.meta.url);
const readJson=async url=>{try{return JSON.parse(await readFile(url,'utf8'));}catch{return null;}};
const seed=await readJson(new URL('ana-rivers-snapshot.json',dataDir));const cached=await readJson(new URL('report.json',cacheDir));const snapshot=latestAnaCopy([cached,seed].filter(Boolean));const previous=await readJson(new URL('status.json',cacheDir));
const feed=createAnaRiverFeed({snapshot});const result=await feed.get();const status={state:result.state,checkedAt:result.checkedAt,lastSuccessAt:result.lastSuccessAt||(snapshot?.origin==='ana-public-export'&&previous?.reportId===snapshot.id?previous?.lastSuccessAt:null)||null,reportId:result.report?.id||null,errorCode:result.errorCode||null,diagnostics:result.diagnostics||null};
await mkdir(cacheDir,{recursive:true});if(result.report){const text=JSON.stringify(result.report,null,2)+'\n';await writeFile(new URL('ana-rivers-snapshot.json',dataDir),text);await writeFile(new URL('report.json',cacheDir),text);}const stateText=JSON.stringify(status,null,2)+'\n';await writeFile(new URL('ana-rivers-status.json',dataDir),stateText);await writeFile(new URL('status.json',cacheDir),stateText);console.log(JSON.stringify({event:'ana_scheduled_collection',...status}));
