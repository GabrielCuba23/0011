import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
test('Pages build embeds all application modules without unresolved imports',async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 execFileSync(process.execPath,['scripts/build.mjs'],{cwd:root});
 const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
 assert.ok(html.includes('function formatReport'));
 assert.ok(html.includes('geo-workspace'));
 assert.ok(!html.includes("from './report.js'"));
 for(const module of ['app','dashboard','image-analysis','desk','media','documents'])assert.ok(!html.includes(`src="/${module}.js"`));
 assert.ok(!html.includes('id="latitude"'));
});
