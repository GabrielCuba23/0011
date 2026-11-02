import {readFile, mkdir, writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
let html=await read('public/index.html');
let js=await read('public/app.js');
const helpers=(await read('public/report.js')).replaceAll('export function','function');
js=js.replace("import {formatReport,validCoordinates} from './report.js';",helpers);
js=js.replace('crypto.randomUUID()',"(globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+Math.random().toString(36).slice(2))");
html=html.replace('<link rel="stylesheet" href="/style.css">','<style>'+await read('public/style.css')+'</style>')
.replace('<script type="module" src="/app.js"></script>','<script type="module">'+js+'</script>')
.replace('class="brand" href="/"','class="brand" href="#"')
.replace('<script type="module" src="/dashboard.js"></script>','<script type="module">'+await read('public/dashboard.js')+'</script>');
await mkdir(new URL('dist/',root),{recursive:true});
await writeFile(new URL('dist/index.html',root),html);
await writeFile(new URL('dist/Vigia-Peru.html',root),html);
console.log('Sitio estático generado en dist/');

await mkdir(new URL('dist/data/',root),{recursive:true});
await writeFile(new URL('dist/data/dashboard.json',root),await read('data/dashboard.json'));
