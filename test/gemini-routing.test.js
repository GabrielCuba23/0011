import test from 'node:test';
import assert from 'node:assert/strict';
import {generateGemini,normalizeModel} from '../lib/gemini.js';
import {probeGeneration} from '../lib/analyze.js';
const missing=()=>({ok:false,status:404,json:async()=>({error:{status:'NOT_FOUND',message:'models/gemini-retired is not found for API version v1beta'}})});
test('normalizes copied model resource names without allowing arbitrary routes',()=>{assert.equal(normalizeModel(' "models/gemini-flash-latest" '),'gemini-flash-latest');assert.throws(()=>normalizeModel('https://malicious.test/model'));});
test('a model 404 retries once with an available stable Flash, then caches that successful choice',async()=>{
 const urls=[];const fetchImpl=async url=>{urls.push(url);if(url.includes('/models?'))return {ok:true,json:async()=>({models:[{name:'models/gemini-pro-latest',supportedGenerationMethods:['generateContent']},{name:'models/gemini-flash-latest',supportedGenerationMethods:['generateContent']}]})};if(url.includes('/gemini-retired:'))return missing();return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'{"ok":true}'}]}}]})};};
 const options={apiKey:'fallback-fixture-key',model:'gemini-retired',fetchImpl};const result=await generateGemini({contents:[]},options);assert.equal(result.model,'gemini-flash-latest');assert.equal(result.usedFallback,true);assert.equal(urls.length,3);await generateGemini({contents:[]},options);assert.equal(urls.length,4);assert.ok(urls.every(x=>!x.includes('pro-latest')));
});
test('404 on an unknown route, quota and permission failures are never retried or masked',async()=>{
 for(const status of [400,403,404,429]){let calls=0;await assert.rejects(generateGemini({}, {apiKey:'never-retry-fixture-'+status,model:'gemini-test',fetchImpl:async()=>{calls++;return {ok:false,status,json:async()=>({error:{message:'Rejected request'}})};}}));assert.equal(calls,1);}
});
test('generation probe validates a real JSON response rather than trusting the model list',async()=>{
 const result=await probeGeneration({apiKey:'probe-fixture',model:'gemini-test',fetchImpl:async(url,options)=>{assert.ok(url.includes(':generateContent'));const input=JSON.parse(options.body);assert.equal(input.generationConfig.responseMimeType,'application/json');return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'{"ok":true}'}]}}]})};}});assert.equal(result.code,'GENERATION_OK');assert.match(result.message,/todavía no valida una imagen/);
});
test('503 retries the same model once before trying a listed stable Flash alternative',async()=>{
 const calls=[];let count=0;const fetchImpl=async url=>{calls.push(url);if(url.includes('/models?'))return {ok:true,json:async()=>({models:[{name:'models/gemini-flash-lite-latest',supportedGenerationMethods:['generateContent']}]})};count++;if(count<=2)return {ok:false,status:503,json:async()=>({error:{message:'Service unavailable'}})};return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'{}'}]}}]})};};
 let sleeps=0;const result=await generateGemini({},{apiKey:'busy-then-success-fixture',model:'gemini-flash-latest',fetchImpl,sleepImpl:async ms=>{assert.equal(ms,1000);sleeps++;}});assert.equal(result.model,'gemini-flash-lite-latest');assert.equal(result.usedRetry,true);assert.equal(sleeps,1);assert.equal(count,3);assert.equal(calls[0],calls[1]);
});
test('persistent 503 stops after three generations and applies a cooldown without fake success',async()=>{
 let generations=0;const options={apiKey:'persistent-busy-fixture',model:'gemini-flash-latest',sleepImpl:async()=>{},fetchImpl:async url=>{if(url.includes('/models?'))return {ok:true,json:async()=>({models:[{name:'models/gemini-flash-lite-latest',supportedGenerationMethods:['generateContent']}]})};generations++;return {ok:false,status:503,json:async()=>({error:{message:'Unavailable'}})};}};
 await assert.rejects(generateGemini({},options),e=>e.code==='GOOGLE_GENERATION_UNAVAILABLE');assert.equal(generations,3);await assert.rejects(generateGemini({},options),e=>e.code==='PROVIDER_COOLDOWN');assert.equal(generations,3);
});
test('a long Retry-After is respected without retrying early or changing models',async()=>{
 let calls=0;await assert.rejects(generateGemini({},{apiKey:'retry-after-fixture',fetchImpl:async()=>{calls++;return {ok:false,status:503,headers:{get:()=> '60'},json:async()=>({error:{message:'Unavailable'}})};},sleepImpl:async()=>{throw Error('must not retry');}}),e=>e.code==='PROVIDER_UNAVAILABLE');assert.equal(calls,1);
});
