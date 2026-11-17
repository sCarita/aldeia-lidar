// Decode cached official DGT viewer chunks. Called by build-village-vegetation.cjs.
const fs=require('fs'),vm=require('vm');
const filename=process.argv[2];
const cache=process.argv[3]||'/tmp';
const source=fs.readFileSync(cache+'/dgt-worker.js','utf8').replace('self.onmessage=r=>','self.decoder={init:lt,File:U,decode:nt};self.onmessage=r=>');
const self={};
vm.runInNewContext(source,{self,console,TextDecoder,TextEncoder,WebAssembly,Uint8Array,Uint16Array,Uint32Array,Int32Array,Float32Array,Float64Array,DataView,ArrayBuffer,FinalizationRegistry});
self.decoder.init(new WebAssembly.Module(fs.readFileSync(cache+'/dgt-las.wasm')));
const tasks=JSON.parse(fs.readFileSync(cache+'/parish-max-tasks.json')).filter(task=>task.filename===filename);
const info=JSON.parse(fs.readFileSync(cache+'/aldeia-chunk-tasks.json')).find(tile=>tile.filename===filename);
const metadata=new Uint8Array(fs.readFileSync(cache+'/aldeia-lidar-cache/'+filename+'.meta'));
const file=fs.readFileSync(cache+'/aldeia-full-source/'+filename+'.viewer');
const root=tasks.find(task=>task.index===info.rootIndex);
const expected=fs.readFileSync(cache+'/aldeia-surface-cache/'+filename+'.'+root.index+'.chunk');
const offset=file.indexOf(expected.subarray(0,64))-root.start;
if(offset<0||offset>1024||!file.subarray(root.start+offset,root.end+offset).equals(expected))throw Error('Source payload does not match cached metadata '+filename);
const output=fs.openSync(cache+'/vegetation-'+filename+'.bin','w');
let total=0;
for(const task of tasks) {
 const result=self.decoder.decode(metadata.slice(0,34745),metadata.slice(34745),new Uint8Array(file.buffer,file.byteOffset+task.start+offset,task.end-task.start),task.index);
 const p=result.points,c=result.classification,selected=[];
 for(let i=0;i<c.length;i++) {
  if(c[i]<3||c[i]>5)continue;
  const x=p[i*3],y=p[i*3+1];
  if(x<34250||x>=35250||y< -40750||y>= -39750)continue;
  selected.push(x,y,p[i*3+2]);total++;
 }
 fs.writeSync(output,Buffer.from(new Float32Array(selected).buffer));result.free();
}
fs.closeSync(output);console.log(filename,total,'vegetation returns');
