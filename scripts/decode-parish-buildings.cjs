'use strict';
// Extract measured class 6 buildings or --bridges class 26. No fabricated geometry.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const bridgeMode=process.argv.includes('--bridges'),sourceClass=bridgeMode?26:6;
const filename=process.argv[2],cache=path.resolve(process.argv[3]||'/tmp'),out=path.join(cache,bridgeMode?'aldeia-parish-bridges':'aldeia-parish-buildings');fs.mkdirSync(out,{recursive:true});
if(fs.existsSync(path.join(out,filename+'.json'))&&!process.argv.includes('--force')){console.log(filename,'cached');process.exit(0);}
const context={window:{}};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../docs/aldeia-da-mata/data/metadata.js'),'utf8'),context);
const polygons=context.window.ALDEIA_DATA.projectedBoundary;
function inside(x,y){return polygons.some(poly=>{let value=false;for(let k=0;k<poly.length;k++){let hit=false;const ring=poly[k];for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!=(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}if(k===0)value=hit;else if(hit)value=false;}return value;});}
const info=JSON.parse(fs.readFileSync(path.join(cache,'aldeia-chunk-tasks.json'))).find(t=>t.filename===filename),bounds=[info.x-500,info.y-500,info.x+500,info.y+500];
const worker=fs.readFileSync(path.join(cache,'dgt-worker.js'),'utf8').replace('self.onmessage=r=>','self.decoder={init:lt,File:U,decode:nt};self.onmessage=r=>'),self={};
vm.runInNewContext(worker,{self,console,TextDecoder,TextEncoder,WebAssembly,Uint8Array,Uint16Array,Uint32Array,Int32Array,Float32Array,Float64Array,DataView,ArrayBuffer,FinalizationRegistry});self.decoder.init(new WebAssembly.Module(fs.readFileSync(path.join(cache,'dgt-las.wasm'))));
const tasks=JSON.parse(fs.readFileSync(path.join(cache,'parish-max-tasks.json'))).filter(t=>t.filename===filename),metadata=new Uint8Array(fs.readFileSync(path.join(cache,'aldeia-lidar-cache',filename+'.meta'))),file=fs.readFileSync(path.join(cache,'aldeia-full-source',filename+'.viewer'));
const root=tasks.find(t=>t.index===info.rootIndex),expected=fs.readFileSync(path.join(cache,'aldeia-surface-cache',filename+'.'+root.index+'.chunk')),offset=file.indexOf(expected.subarray(0,64))-root.start;
if(offset<0||offset>1024||!file.subarray(root.start+offset,root.end+offset).equals(expected))throw Error('Source mismatch '+filename);
const roofs=new Map(),points=[],voxels=new Set(),boundary=new Map();let decoded=0,buildingReturns=0,accepted=0;
for(const task of tasks){const result=self.decoder.decode(metadata.slice(0,34745),metadata.slice(34745),new Uint8Array(file.buffer,file.byteOffset+task.start+offset,task.end-task.start),task.index),p=result.points,c=result.classification;decoded+=c.length;
 for(let i=0;i<c.length;i++)if(c[i]===sourceClass){buildingReturns++;const x=p[i*3],y=p[i*3+1],z=p[i*3+2];if(!Number.isFinite(z)||x<bounds[0]||x>=bounds[2]||y<=bounds[1]||y>bounds[3])continue;
  const col=Math.floor((x-bounds[0])*2),row=Math.floor((bounds[3]-y)*2),cell=row*2000+col;if(!boundary.has(cell))boundary.set(cell,inside(bounds[0]+(col+.5)/2,bounds[3]-(row+.5)/2));if(!boundary.get(cell))continue;accepted++;
  const previous=roofs.get(cell);if(!previous||z>previous[2])roofs.set(cell,[x,y,z,0]);
  const key=Math.floor(x)+','+Math.ceil(y)+','+Math.floor(z);if(!voxels.has(key)){voxels.add(key);points.push(x,y,z,0);}
 }result.free();}
const roof=new Float32Array([...roofs.values()].flat()),display=new Float32Array(points);
for(const [suffix,array] of [['roofs',roof],['points',display]])fs.writeFileSync(path.join(out,filename+'.'+suffix),Buffer.from(array.buffer));
fs.writeFileSync(path.join(out,filename+'.json'),JSON.stringify({filename,sourceClass,bounds,decoded,buildingReturns,accepted,roofCells:roofs.size,displayPoints:points.length/4,chunks:tasks.length})+'\n');console.log(filename,accepted,'class '+sourceClass+' returns,',roofs.size,'roof cells');
