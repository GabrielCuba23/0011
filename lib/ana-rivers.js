import * as XLSX from '../public/vendor/xlsx.mjs';
import {createHash} from 'node:crypto';
import {requireAnaXls,parseAnaWorkbook} from '../public/ana-river-parser.js';
export function parseAnaXls(buffer,{filename='',origin='uploaded-xls',sourceUrl=null}={}){requireAnaXls(buffer);const book=XLSX.read(buffer,{type:'buffer',cellStyles:true,cellNF:true,cellDates:false,sheetRows:10001});const report=parseAnaWorkbook(book,{filename,fileHash:createHash('sha256').update(buffer).digest('hex'),importedAt:new Date().toISOString()});return {...report,origin,sourceUrl};}
