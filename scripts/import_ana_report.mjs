import {readFile,writeFile} from 'node:fs/promises';
import {basename} from 'node:path';
import {parseAnaXls} from '../lib/ana-rivers.js';
const path=process.argv[2],output=process.argv[3]||'data/ana-rivers-snapshot.json';if(!path)throw Error('Uso: node scripts/import_ana_report.mjs archivo.xls [salida.json]');const result=parseAnaXls(await readFile(path),{filename:basename(path)});await writeFile(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({report:result.reportNumber,queryDate:result.queryDate,printedAt:result.printedAt,counts:result.counts}));
