import test from 'node:test';
import assert from 'node:assert/strict';
import {transportFailure,checkGoogleReachability} from '../lib/transport.js';
import {probeGeneration} from '../lib/analyze.js';
test('transport diagnosis distinguishes timeout, DNS, TLS and reset without logging arbitrary error details',()=>{
 for(const [networkCode,expected] of [['ENOTFOUND','PROVIDER_DNS_ERROR'],['CERT_HAS_EXPIRED','PROVIDER_TLS_ERROR'],['ECONNRESET','PROVIDER_CONNECTION_RESET'],['UND_ERR_CONNECT_TIMEOUT','PROVIDER_CONNECT_TIMEOUT']]){const logs=[];const cause=Object.assign(Error('secret-fixture-never-log'),{cause:{code:networkCode}});const error=transportFailure(cause,{model:'gemini-test',logImpl:x=>logs.push(x)});assert.equal(error.code,expected);assert.ok(!logs.join('').includes('secret-fixture-never-log'));assert.equal(error.transportCode,networkCode);}
 const timeout=transportFailure(Object.assign(Error(),{name:'TimeoutError'}),{aborted:true,logImpl:()=>{}});assert.equal(timeout.code,'GENERATION_TIMEOUT');
});
test('public reachability test sends no API key and does not confuse HTTP 403 with a network failure',async()=>{
 const result=await checkGoogleReachability({fetchImpl:async(url,options)=>{assert.equal(options.headers,undefined);assert.ok(!url.includes('key='));return {status:403};}});assert.equal(result.reachable,true);assert.equal(result.http,403);
});
test('failed generation can report that the public route was reachable without claiming authorization',async()=>{
 await assert.rejects(probeGeneration({apiKey:'fixture-unused',model:'gemini-test',fetchImpl:async(url)=>{if(!url.includes(':generateContent'))return {status:403};throw Object.assign(Error('never show private details'),{cause:{code:'ECONNRESET'}});}}),error=>{assert.equal(error.code,'PROVIDER_CONNECTION_RESET');assert.equal(error.network.reachable,true);assert.match(error.message,/no demuestra acceso al modelo/);assert.ok(!error.message.includes('private details'));return true;});
});
