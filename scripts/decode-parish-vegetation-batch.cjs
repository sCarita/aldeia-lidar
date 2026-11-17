'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const cache=path.resolve(process.argv[2]||'/tmp'),files=JSON.parse(fs.readFileSync(path.join(cache,'aldeia-chunk-tasks.json'))).map(t=>t.filename).sort();
let cursor=0,finished=0;
async function worker(){while(cursor<files.length){const filename=files[cursor++];await new Promise((resolve,reject)=>{const p=spawn(process.execPath,[path.join(__dirname,'decode-parish-vegetation.cjs'),filename,cache,...(process.argv.includes('--force')?['--force']:[])],{stdio:'inherit'});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error(filename+' failed '+code)));});console.log('Completed',++finished,'of',files.length);}}
Promise.all([worker(),worker()]).catch(e=>{console.error(e);process.exitCode=1;});
