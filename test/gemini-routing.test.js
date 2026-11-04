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
