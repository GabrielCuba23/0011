import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('./public/', import.meta.url));
const files = {'/':'index.html','/app.js':'app.js','/style.css':'style.css','/report.js':'report.js','/dashboard.js':'dashboard.js','/data/dashboard.json':'../data/dashboard.json'};
const types = {html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',json:'application/json; charset=utf-8'};
http.createServer(async (req,res)=>{
 const path = new URL(req.url,'http://localhost').pathname;
 if(path==='/api/health'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({status:'ok',version:'0.1.0'}));}
 if(!files[path]){res.writeHead(404);return res.end('No encontrado');}
 try {const data=await readFile(root+files[path]);res.writeHead(200,{'Content-Type':types[files[path].split('.').pop()],'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' blob: data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(data);}catch{res.writeHead(500);res.end('Error de lectura');}
}).listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Observatorio iniciado en puerto '+(process.env.PORT||3000)));
