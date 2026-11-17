'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const cache=path.resolve(process.argv[2]||'/tmp'),files=JSON.parse(fs.readFileSync(path.join(cache,'aldeia-chunk-tasks.json'))).map(t=>t.filename).sort();let cursor=0,done=0;
async function worker(){while(cursor<files.length){const name=files[cursor++];await new Promise((resolve,reject)=>{const p=spawn(process.execPath,[path.join(__dirname,'decode-parish-buildings.cjs'),name,cache,...(process.argv.includes('--force')?['--force']:[]),...(process.argv.includes('--bridges')?['--bridges']:[])],{stdio:'inherit'});p.on('error',reject);p.on('exit',c=>c===0?resolve():reject(Error(name+' failed')));});console.log(process.argv.includes('--bridges')?'Bridges:':'Buildings:',++done,'/',files.length);}}
Promise.all([worker(),worker()]).catch(e=>{console.error(e);process.exitCode=1;});
