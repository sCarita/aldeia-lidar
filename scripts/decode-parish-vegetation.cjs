'use strict';
// Decode one complete cached DGT source, normalize against CAOP-masked ground tiles.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib');
const {ndviProxy,NODATA}=require('./ndvi-utils.cjs');
const filename=process.argv[2],cache=path.resolve(process.argv[3]||'/tmp');
const output=path.join(cache,'aldeia-parish-vegetation');fs.mkdirSync(output,{recursive:true});
const reportFile=path.join(output,filename+'.json');
if(fs.existsSync(reportFile)&&!process.argv.includes('--force')){console.log(filename,'cached');process.exit(0);}
const folder=path.resolve(__dirname,'../docs/aldeia-da-mata/data'),context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(folder,'max-detail-index.js'),'utf8'),context);
const info=JSON.parse(fs.readFileSync(path.join(cache,'aldeia-chunk-tasks.json'))).find(t=>t.filename===filename);
const bounds=[info.x-500,info.y-500,info.x+500,info.y+500],ground=[];
for(let y=0;y<4;y++)for(let x=0;x<4;x++){
  const id=`t${bounds[0]+x*250}_${bounds[1]+y*250}`,tile=context.window.ALDEIA_MAX_DETAIL.tiles[id];
  if(!tile)continue;const source=fs.readFileSync(path.join(folder,tile.url.replace('data/','')),'utf8');
  const payload=JSON.parse(source.slice(source.indexOf('={"id"')+1).replace(/;\s*$/,'')),raw=zlib.gunzipSync(Buffer.from(payload.heights,'base64'));
  ground[y*4+x]={...tile,values:new Uint16Array(raw.buffer,raw.byteOffset,raw.length/2)};
}
const worker=fs.readFileSync(path.join(cache,'dgt-worker.js'),'utf8').replace('self.onmessage=r=>','self.decoder={init:lt,File:U,decode:nt};self.onmessage=r=>'),self={};
vm.runInNewContext(worker,{self,console,TextDecoder,TextEncoder,WebAssembly,Uint8Array,Uint16Array,Uint32Array,Int32Array,Float32Array,Float64Array,DataView,ArrayBuffer,FinalizationRegistry});
self.decoder.init(new WebAssembly.Module(fs.readFileSync(path.join(cache,'dgt-las.wasm'))));
const tasks=JSON.parse(fs.readFileSync(path.join(cache,'parish-max-tasks.json'))).filter(t=>t.filename===filename);
const metadata=new Uint8Array(fs.readFileSync(path.join(cache,'aldeia-lidar-cache',filename+'.meta'))),file=fs.readFileSync(path.join(cache,'aldeia-full-source',filename+'.viewer'));
const root=tasks.find(t=>t.index===info.rootIndex),expected=fs.readFileSync(path.join(cache,'aldeia-surface-cache',filename+'.'+root.index+'.chunk'));
const offset=file.indexOf(expected.subarray(0,64))-root.start;
if(offset<0||offset>1024||!file.subarray(root.start+offset,root.end+offset).equals(expected))throw Error('Source payload mismatch '+filename);
const top=new Float32Array(1e6);top.fill(-1);const canopy=new Float32Array(4e6),bands=new Uint8Array(2e6),seen=new Set(),points=[],pointBands=[];
const stats={filename,bounds,chunks:tasks.length,decodedReturns:0,vegetationReturns:0,accepted:0,unsupportedGround:0,rejectedHeight:0,outsideSource:0,bandMissing:0,validBands:0,redRange:[255,0],nirRange:[255,0],redUnique:0,nirUnique:0,identicalBands:0};
const redSeen=new Set(),nirSeen=new Set();
for(const task of tasks){
  const result=self.decoder.decode(metadata.slice(0,34745),metadata.slice(34745),new Uint8Array(file.buffer,file.byteOffset+task.start+offset,task.end-task.start),task.index);
  const p=result.points,c=result.classification,rgb=result.colors,nir=result.nir;stats.decodedReturns+=c.length;
  const hasBands=rgb.length===c.length*3&&nir.length===c.length;
  for(let i=0;i<c.length;i++){
    if(c[i]<3||c[i]>5)continue;stats.vegetationReturns++;
    const x=p[i*3],y=p[i*3+1],z=p[i*3+2],lx=x-bounds[0],ly=y-bounds[1];
    if(lx<0||ly<0||lx>=1000||ly>=1000){stats.outsideSource++;continue;}
    const g=ground[Math.floor(ly/250)*4+Math.floor(lx/250)];
    if(!g){stats.unsupportedGround++;continue;}
    const gc=Math.floor((x-g.bounds[0])*2),gr=Math.floor((g.bounds[3]-y)*2),v=g.values[gr*500+gc];
    if(v===undefined||v===65535){stats.unsupportedGround++;continue;}
    const h=z-(g.zBase+v*.01);if(h<.1||h>60){stats.rejectedHeight++;continue;}stats.accepted++;
    const r=hasBands?rgb[i*3]:0,n=hasBands?nir[i]:0;
    if(!hasBands)stats.bandMissing++;else{redSeen.add(r);nirSeen.add(n);stats.redRange[0]=Math.min(stats.redRange[0],r);stats.redRange[1]=Math.max(stats.redRange[1],r);stats.nirRange[0]=Math.min(stats.nirRange[0],n);stats.nirRange[1]=Math.max(stats.nirRange[1],n);stats.identicalBands+=r===n;}
    if(ndviProxy(r,n)!==NODATA)stats.validBands++;
    const col=Math.floor(lx),row=Math.floor(bounds[3]-y);if(row<0||row>=1000)continue;const cell=row*1000+col;
    if(h>top[cell]){top[cell]=h;canopy.set([x,y,z,h],cell*4);bands.set([r,n],cell*2);}
    const key=cell*64+Math.floor(h);
    // Stable 1-in-5 voxel sampling, independent of source hierarchy and point order.
    const hash=(Math.imul(key^0x9e3779b9,0x85ebca6b)>>>0);
    if(hash%5===0&&!seen.has(key)){seen.add(key);points.push(x,y,z,h);pointBands.push(r,n);}
  }
  result.free();
}
const selected=[],selectedBands=[];
for(let i=0;i<top.length;i++)if(top[i]>=0){selected.push(...canopy.subarray(i*4,i*4+4));selectedBands.push(bands[i*2],bands[i*2+1]);}
for(const [suffix,values] of [['canopy',new Float32Array(selected)],['canopy-bands',new Uint8Array(selectedBands)],['points',new Float32Array(points)],['point-bands',new Uint8Array(pointBands)]])fs.writeFileSync(path.join(output,filename+'.'+suffix),Buffer.from(values.buffer));
stats.redUnique=redSeen.size;stats.nirUnique=nirSeen.size;stats.canopyCells=selected.length/4;stats.displayPoints=points.length/4;
stats.bandStatus=stats.accepted===0?'no vegetation':stats.redUnique<2||stats.nirUnique<2||stats.identicalBands/stats.accepted>.95?'unusable':'variable RGBNIR; calibration unverified';
fs.writeFileSync(reportFile,JSON.stringify(stats)+'\n');console.log(filename,stats.accepted,'normalized returns,',stats.canopyCells,'canopy cells,',stats.displayPoints,'display points');
