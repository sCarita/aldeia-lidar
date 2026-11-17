'use strict';
// Build full-parish crowns globally, then package independent 250 m display assets.
// node --expose-gc --max-old-space-size=4096 scripts/build-parish-vegetation.cjs /tmp
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),crypto=require('node:crypto');
const {clusterSparse}=require('./tree-clustering-sparse.cjs'),{ndviProxy,NODATA}=require('./ndvi-utils.cjs');
const cache=path.resolve(process.argv[2]||'/tmp'),input=path.join(cache,'aldeia-parish-vegetation'),folder=path.resolve(__dirname,'../docs/aldeia-da-mata/data');
const infos=JSON.parse(fs.readFileSync(path.join(cache,'aldeia-chunk-tasks.json'))).sort((a,b)=>a.filename.localeCompare(b.filename));
const reports=infos.map(info=>JSON.parse(fs.readFileSync(path.join(input,info.filename+'.json'))));
const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(folder,'metadata.js'),'utf8'),context);
const bounds=[28572,-44804,39124,-36420],width=bounds[2]-bounds[0],height=bounds[3]-bounds[1],count=reports.reduce((n,r)=>n+r.canopyCells,0);
const canopy=new Float32Array(count*4),ndvi=new Int16Array(count),ranges=[];let cursor=0;
function readTyped(file,Type){const b=fs.readFileSync(file);return new Type(b.buffer,b.byteOffset,b.byteLength/Type.BYTES_PER_ELEMENT);}
function hash(array){return crypto.createHash('sha256').update(Buffer.from(array.buffer,array.byteOffset,array.byteLength)).digest('hex');}
for(const report of reports){
  const p=readTyped(path.join(input,report.filename+'.canopy'),Float32Array),bands=readTyped(path.join(input,report.filename+'.canopy-bands'),Uint8Array);
  if(p.length/4!==report.canopyCells||bands.length!==report.canopyCells*2)throw Error('Source cache count mismatch');
  canopy.set(p,cursor*4);for(let i=0;i<report.canopyCells;i++)ndvi[cursor+i]=report.bandStatus==='unusable'?NODATA:ndviProxy(bands[i*2],bands[i*2+1]);
  ranges.push({filename:report.filename,start:cursor,count:report.canopyCells});cursor+=report.canopyCells;
}
console.log('Loaded',count,'parish canopy cells');
const algorithmHash=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'tree-clustering-sparse.cjs'))).digest('hex');
const canopyHash=hash(canopy),savedFile=path.join(input,'global-clusters.json');let grouped;
if(fs.existsSync(savedFile)&&JSON.parse(fs.readFileSync(savedFile)).canopyHash===canopyHash&&JSON.parse(fs.readFileSync(savedFile)).algorithmHash===algorithmHash){
  const saved=JSON.parse(fs.readFileSync(savedFile)),labels=readTyped(path.join(input,'global-labels.bin'),Uint32Array),index=new Int32Array(width*height);index.fill(-1);
  for(let i=0;i<count;i++)index[Math.floor(bounds[3]-canopy[i*4+1])*width+Math.floor(canopy[i*4]-bounds[0])]=i;
  grouped={catalog:saved.catalog,labels,index};console.log('Reusing global segmentation');
}else{
  grouped=clusterSparse(canopy,bounds,width,height,message=>console.log(message));
  fs.writeFileSync(path.join(input,'global-labels.bin'),Buffer.from(grouped.labels.buffer));
  fs.writeFileSync(savedFile,JSON.stringify({canopyHash,algorithmHash,catalog:grouped.catalog}));
}
global.gc?.();
const catalog=grouped.catalog,validCounts=new Uint32Array(catalog.length+1),offsets=new Uint32Array(catalog.length+2);
for(let i=0;i<count;i++)if(grouped.labels[i]&&ndvi[i]!==NODATA)validCounts[grouped.labels[i]]++;
for(let id=1;id<offsets.length;id++)offsets[id]=offsets[id-1]+validCounts[id-1];
const sortedValues=new Int16Array(offsets[offsets.length-1]),positions=offsets.slice();
for(let i=0;i<count;i++){const id=grouped.labels[i];if(id&&ndvi[i]!==NODATA)sortedValues[positions[id]++]=ndvi[i];}
const medians=new Float32Array(catalog.length+1);medians.fill(-2);
for(let id=1;id<=catalog.length;id++){const n=validCounts[id];if(!n)continue;const a=sortedValues.subarray(offsets[id],offsets[id]+n);a.sort();medians[id]=(a[(n-1)>>1]+a[n>>1])/20000;}
// Flag crowns near the official boundary using spatially indexed line segments.
const segments=new Map();
for(const polygon of context.window.ALDEIA_DATA.projectedBoundary)for(const ring of polygon)for(let i=1;i<ring.length;i++){
  const a=ring[i-1],b=ring[i];for(let y=Math.floor(Math.min(a[1],b[1])/250);y<=Math.floor(Math.max(a[1],b[1])/250);y++)for(let x=Math.floor(Math.min(a[0],b[0])/250);x<=Math.floor(Math.max(a[0],b[0])/250);x++){const key=x+','+y;if(!segments.has(key))segments.set(key,[]);segments.get(key).push([a,b]);}
}
for(const tree of catalog){
  const bx=Math.floor(tree.x/250),by=Math.floor(tree.y/250);
  for(let dy=-1;dy<=1&&!tree.edge;dy++)for(let dx=-1;dx<=1&&!tree.edge;dx++)for(const [a,b] of segments.get((bx+dx)+','+(by+dy))||[]){const vx=b[0]-a[0],vy=b[1]-a[1],t=Math.max(0,Math.min(1,((tree.x-a[0])*vx+(tree.y-a[1])*vy)/(vx*vx+vy*vy||1)));if(Math.hypot(tree.x-a[0]-t*vx,tree.y-a[1]-t*vy)<=12){tree.edge=true;break;}}
}
const overview=new Float32Array(catalog.length*8);
for(const t of catalog)overview.set([t.x,t.y,t.z,t.height,t.area,medians[t.id],validCounts[t.id],(t.sparse?1:0)|(t.touching?2:0)|(t.edge?4:0)],(t.id-1)*8);
function encoded(array){const raw=Buffer.from(array.buffer,array.byteOffset,array.byteLength);return {payload:zlib.gzipSync(raw,{level:9}).toString('base64'),sha256:hash(array),rawBytes:raw.length};}
const pipelineHash=crypto.createHash('sha256');for(const name of ['decode-parish-vegetation.cjs','tree-clustering-sparse.cjs','build-parish-vegetation.cjs','ndvi-utils.cjs'])pipelineHash.update(fs.readFileSync(path.join(__dirname,name)));
const overviewPayload=encoded(overview),version='parish-v1-'+canopyHash.slice(0,8)+'-'+hash(ndvi).slice(0,8)+'-'+pipelineHash.digest('hex').slice(0,8);
const output=path.join(folder,'vegetation-parish');fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(folder,'vegetation-parish-overview.js'),'window.ALDEIA_VEGETATION_OVERVIEW='+JSON.stringify({version,count:catalog.length,...overviewPayload})+';\n');
const tiles={};let displayPoints=0,totalBytes=0;
function tileCoordinates(x,y){return [Math.floor(x/250)*250,(Math.ceil(y/250)-1)*250];}
for(const range of ranges){
  const report=reports.find(r=>r.filename===range.filename),points=readTyped(path.join(input,range.filename+'.points'),Float32Array),bands=readTyped(path.join(input,range.filename+'.point-bands'),Uint8Array),tileData=new Map();
  function getTile(x,y){const [tx,ty]=tileCoordinates(x,y),id=`v${tx}_${ty}`;if(!tileData.has(id))tileData.set(id,{id,bounds:[tx,ty,tx+250,ty+250],canopy:[],points:[]});return tileData.get(id);}
  for(let i=range.start;i<range.start+range.count;i++){
    const p=i*4,id=grouped.labels[i],value=ndvi[i]===NODATA?-2:ndvi[i]/10000;
    getTile(canopy[p],canopy[p+1]).canopy.push(canopy[p],canopy[p+1],canopy[p+2],canopy[p+3],id,value,id?medians[id]:-2);
  }
  for(let p=0;p<points.length;p+=4){
    const x=points[p],y=points[p+1],row=Math.floor(bounds[3]-y),col=Math.floor(x-bounds[0]);if(row<0||col<0||row>=height||col>=width)continue;
    const ci=grouped.index[row*width+col];let id=ci>=0?grouped.labels[ci]:0;
    if(points[p+3]<2||(id&&points[p+3]>catalog[id-1].height+.01))id=0;
    const vi=report.bandStatus==='unusable'?NODATA:ndviProxy(bands[p/2],bands[p/2+1]);
    getTile(x,y).points.push(x,y,points[p+2],points[p+3],id,vi===NODATA?-2:vi/10000,id?medians[id]:-2);
  }
  for(const t of tileData.values()){
    if(tiles[t.id])throw Error('Source tiles overlap in packaged asset '+t.id);
    const header=new Uint32Array([t.canopy.length/7,t.points.length/7]),raw=Buffer.concat([Buffer.from(header.buffer),Buffer.from(new Float32Array(t.canopy).buffer),Buffer.from(new Float32Array(t.points).buffer)]);
    const sha256=crypto.createHash('sha256').update(raw).digest('hex'),payload=zlib.gzipSync(raw,{level:9}).toString('base64');
    const script='window.ALDEIA_VEGETATION_TILES=window.ALDEIA_VEGETATION_TILES||{};window.ALDEIA_VEGETATION_TILES['+JSON.stringify(t.id)+']='+JSON.stringify({version,payload})+';\n';
    fs.writeFileSync(path.join(output,t.id+'.js'),script);
    tiles[t.id]={id:t.id,url:'data/vegetation-parish/'+t.id+'.js',bounds:t.bounds,canopyCount:t.canopy.length/7,pointCount:t.points.length/7,sha256,bytes:Buffer.byteLength(script)};
    totalBytes+=tiles[t.id].bytes;displayPoints+=tiles[t.id].pointCount;
  }
  console.log('Packaged',range.filename,tileData.size,'vegetation tiles');
}
const meta={version,crs:'EPSG:3763',bounds,areaKm2:37.2841,tileSize:250,canopyResolution:1,groundResolution:.5,candidateCount:catalog.length,canopyCount:count,pointCount:displayPoints,normalizedReturns:reports.reduce((n,r)=>n+r.accepted,0),sourceCount:reports.length,overviewUrl:'data/vegetation-parish-overview.js',overviewSha256:overviewPayload.sha256,overviewStride:8,recordStride:7,totalBytes,tiles};
fs.writeFileSync(path.join(folder,'vegetation-parish-index.js'),'window.ALDEIA_PARISH_VEGETATION='+JSON.stringify(meta)+';\n');
const provenance={...meta,canopyHash,algorithmHash,ndviHash:hash(ndvi),tiles:Object.values(tiles),method:'All hierarchy levels from 60 cached DGT source files; classes 3–5; heights normalized against existing CAOP2025-masked 0.5 m ground tiles; accepted height 0.1–60 m; highest measured return per 1 m cell; no canopy gap filling. Display uses one selected measured return per 1 m horizontal/1 m height voxel with deterministic 1-in-5 voxel sampling. Crowns are segmented globally before 250 m packaging, so no source or display tile seams split a crown. Global uint32 IDs are shared by all tile members and the parish overview. Sparse global segmentation uses the same height-dependent seeds and growing criteria as the village algorithm, with 32-bit labels and a compact priority heap. Radius <=12 m; >=4 occupied canopy cells per retained crown.',ndvi:'Exploratory (NIR-red)/(NIR+red) from 8-bit DGT viewer colours. Reflectance calibration and exact photography dates unverified. Mask zero/saturated channels and sums <20; preserve negative ratios. Crown median uses one valid value per occupied 1 m canopy cell. Missing medians excluded from active filtering. No tree-health interpretation.',overview:'One measured treetop per crown. Counts and filters cover the whole parish, while detailed vegetation loads within a 750 m square around the target below a 1500 m span. Overview points are hidden beneath fully loaded detail windows.',limitations:'Estimated crowns may merge or split. Understory trees hidden by a taller canopy may be missed. Boundary flags mark peaks within 12 m of the CAOP boundary. IDs are deterministic for this parish dataset and differ from the earlier village-only IDs.',source:'https://portugal3d.dgterritorio.gov.pt/continente/crato',licence:'CC BY 4.0, Direção-Geral do Território',boundarySource:context.window.ALDEIA_DATA.boundarySource,sourceReports:reports,sourceRanges:JSON.parse(fs.readFileSync(path.join(cache,'parish-max-tasks.json'))),built:'2026-11-12'};
fs.writeFileSync(path.join(folder,'vegetation-parish-provenance.json'),JSON.stringify(provenance,null,2)+'\n');
console.log('Finished:',catalog.length,'crowns,',count,'canopy cells,',displayPoints,'display points,',Object.keys(tiles).length,'tiles,',Math.round(totalBytes/1e6),'MB');
