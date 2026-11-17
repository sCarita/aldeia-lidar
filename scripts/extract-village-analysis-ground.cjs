'use strict';
// Reconstruct measured-cell support from every cached source hierarchy level.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const cache=path.resolve(process.argv[2]||'/tmp'),out=path.resolve(process.argv[3]||path.join(cache,'aldeia-village-analysis'));
fs.mkdirSync(out,{recursive:true});
const bounds=[34413,-40493,35077,-39829],resolution=.5,width=1328,height=1328;
const counts=new Uint32Array(width*height),sums=new Float64Array(width*height);
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const workerBytes=fs.readFileSync(path.join(cache,'dgt-worker.js')),wasm=fs.readFileSync(path.join(cache,'dgt-las.wasm'));
const worker=workerBytes.toString().replace('self.onmessage=r=>','self.decoder={init:lt,File:U,decode:nt};self.onmessage=r=>'),self={};
vm.runInNewContext(worker,{self,console,TextDecoder,TextEncoder,WebAssembly,Uint8Array,Uint16Array,Uint32Array,Int32Array,Float32Array,Float64Array,DataView,ArrayBuffer,FinalizationRegistry});
self.decoder.init(new WebAssembly.Module(wasm));
const infos=JSON.parse(fs.readFileSync(path.join(cache,'aldeia-chunk-tasks.json'))),all=JSON.parse(fs.readFileSync(path.join(cache,'parish-max-tasks.json'))),sources=[];
for(const info of infos.filter(i=>i.x+500>bounds[0]&&i.x-500<bounds[2]&&i.y+500>bounds[1]&&i.y-500<bounds[3])){
 const filename=info.filename,tasks=all.filter(t=>t.filename===filename),metadata=new Uint8Array(fs.readFileSync(path.join(cache,'aldeia-lidar-cache',filename+'.meta'))),file=fs.readFileSync(path.join(cache,'aldeia-full-source',filename+'.viewer'));
 const root=tasks.find(t=>t.index===info.rootIndex),expected=fs.readFileSync(path.join(cache,'aldeia-surface-cache',filename+'.'+root.index+'.chunk')),offset=file.indexOf(expected.subarray(0,64))-root.start;
 if(offset<0||offset>1024||!file.subarray(root.start+offset,root.end+offset).equals(expected))throw Error('Source mismatch '+filename);
 let accepted=0,decoded=0;
 for(const t of tasks){
  const r=self.decoder.decode(metadata.slice(0,34745),metadata.slice(34745),new Uint8Array(file.buffer,file.byteOffset+t.start+offset,t.end-t.start),t.index),p=r.points,c=r.classification;decoded+=c.length;
  for(let i=0;i<c.length;i++)if(c[i]===2){const x=p[i*3],y=p[i*3+1],z=p[i*3+2];
   if(x<info.x-500||x>=info.x+500||y<=info.y-500||y>info.y+500)continue;
   const col=Math.floor((x-bounds[0])/resolution),row=Math.floor((bounds[3]-y)/resolution);
   if(col<0||col>=width||row<0||row>=height)continue;
   const j=row*width+col;counts[j]++;sums[j]+=z;accepted++;
  }r.free();
 }
 sources.push({filename,sha256:digest(file),bytes:file.length,payloadOffset:offset,decodedReturns:decoded,acceptedGroundReturnsInHalo:accepted,chunks:tasks});
 console.log(filename,accepted,'ground returns in study halo');
}
fs.writeFileSync(path.join(out,'counts.u32'),Buffer.from(counts.buffer));fs.writeFileSync(path.join(out,'sums.f64'),Buffer.from(sums.buffer));
fs.writeFileSync(path.join(out,'source-support.json'),JSON.stringify({bounds,resolution,width,height,byteOrder:'little-endian',sourceClass:2,workerSha256:digest(workerBytes),wasmSha256:digest(wasm),sources},null,2)+'\n');
