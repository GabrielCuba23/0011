import {readFile, mkdir, writeFile, cp} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
let html=await read('public/index.html');
let js=await read('public/app.js');
const helpers=(await read('public/report.js')).replaceAll('export function','function');
js=js.replace(/^import \{[^}]+\} from '\.\/report\.js';/m,helpers);
js=js.replace('crypto.randomUUID()',"(globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+Math.random().toString(36).slice(2))");
html=html.replace('<link rel="stylesheet" href="/style.css">','<style>'+await read('public/style.css')+'</style>')
.replace('<script type="module" src="/app.js"></script>','<script type="module">'+js+'</script>')
.replace('class="brand" href="/"','class="brand" href="#"')
.replace('<script type="module" src="/dashboard.js"></script>','<script type="module">'+await read('public/dashboard.js')+'</script>')
.replace('<script type="module" src="/image-analysis.js"></script>','<script type="module">'+await read('public/image-analysis.js')+'</script>')
.replace('<script type="module" src="/desk.js"></script>','<script type="module">'+await read('public/desk.js')+'</script>')
.replace('<script type="module" src="/media.js"></script>','<script type="module">'+await read('public/media.js')+'</script>')
.replace('<script type="module" src="/documents.js"></script>','<script type="module">'+await read('public/documents.js')+'</script>')
.replace('<script type="module" src="/ana-rivers.js"></script>','<script type="module" src="./ana-rivers.js"></script>')
.replaceAll('href="/vendor/','href="./vendor/').replaceAll('src="/vendor/','src="./vendor/');
await mkdir(new URL('dist/',root),{recursive:true});
await writeFile(new URL('dist/index.html',root),html);
await writeFile(new URL('dist/Vigia-Peru.html',root),html);
console.log('Sitio estático generado en dist/');

await mkdir(new URL('dist/data/',root),{recursive:true});
await writeFile(new URL('dist/data/dashboard.json',root),await read('data/dashboard.json'));

await cp(new URL('public/vendor/',root),new URL('dist/vendor/',root),{recursive:true});

for(const file of ['media-directory.json','media-directory-review.csv'])await writeFile(new URL('dist/data/'+file,root),await read('data/'+file));

for(const file of ['ana-rivers.js','ana-river-parser.js'])await cp(new URL('public/'+file,root),new URL('dist/'+file,root));
await cp(new URL('data/ana-rivers-snapshot.json',root),new URL('dist/data/ana-rivers-snapshot.json',root));
