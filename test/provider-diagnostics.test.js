import test from 'node:test';
import assert from 'node:assert/strict';
import {providerFailure,diagnoseProvider} from '../lib/analyze.js';
test('provider rejection distinguishes invalid key, restrictions, missing model and request bugs without reflecting secrets',async()=>{
 for(const [status,reason,code] of [[400,'API_KEY_INVALID','API_KEY_INVALID'],[403,'API_KEY_HTTP_REFERRER_BLOCKED','KEY_RESTRICTED'],[403,'SERVICE_DISABLED','SERVICE_DISABLED'],[404,'','MODEL_UNAVAILABLE'],[429,'','QUOTA_EXCEEDED'],[400,'','INVALID_PROVIDER_REQUEST']]){
  const error=await providerFailure({status,json:async()=>({error:{message:status===404?'models/gemini-test is not found for API version v1beta':'request rejected: secret-fixture-value',details:[{reason}]}})});
  assert.equal(error.code,code);assert.equal(error.providerStatus,status);assert.ok(!error.message.includes('secret-fixture-value'));
 }
});
test('model-list check does not claim image generation succeeded and returns no credentials',async()=>{
 const options={apiKey:' fixture-key ',model:'gemini-test',fetchImpl:async(url,req)=>{assert.ok(url.includes('/models?'));assert.equal(req.headers['x-goog-api-key'],'fixture-key');return {ok:true,json:async()=>({models:[{name:'models/gemini-test',supportedGenerationMethods:['generateContent']},{name:'models/embedding-test',supportedGenerationMethods:['embedContent']}]})};}};
 const result=await diagnoseProvider(options);assert.equal(result.ok,true);assert.deepEqual(result.models,['gemini-test']);assert.match(result.message,/no comprueba/);assert.ok(!JSON.stringify(result).includes('fixture-key'));
 const missing=await diagnoseProvider({...options,model:'gemini-unavailable'});assert.equal(missing.ok,false);assert.equal(missing.code,'MODEL_UNAVAILABLE');
});

test('a generic route 404 is not diagnosed as a missing model',async()=>{
 const error=await providerFailure({status:404,json:async()=>({error:{message:'Unknown API route'}})});assert.equal(error.code,'PROVIDER_ENDPOINT_NOT_FOUND');
});
