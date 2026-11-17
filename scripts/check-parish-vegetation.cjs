'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {clusterSparse}=require('./tree-clustering-sparse.cjs'),{tileId,focusWindow}=require('../docs/aldeia-da-mata/vegetation-parish-loader.js'),filters=require('../docs/aldeia-da-mata/vegetation-filters.js');
function scene(){const a=[];for(let y=0;y<35;y++)for(let x=230;x<275;x++){let h=0;for(const t of [{x:245,y:18,r:8,h:12},{x:258,y:18,r:7,h:9}]){const d=Math.hypot(x-t.x,y-t.y);if(d<=t.r)h=Math.max(h,t.h*(1-.65*(d/t.r)**2));}if(h>=2)a.push(x+.5,35-y-.5,100+h,h);}return new Float32Array(a);}
const synthetic=scene(),grouped=clusterSparse(synthetic,[0,0,520,35],520,35);assert.equal(grouped.catalog.length,2);
const sides=new Map();for(let i=0;i<grouped.labels.length;i++){const id=grouped.labels[i];if(!id)continue;if(!sides.has(id))sides.set(id,new Set());sides.get(id).add(synthetic[i*4]<250?'west':'east');}assert([...sides.values()].some(s=>s.size===2),'One crown must retain one ID across the virtual tile edge');
const reversed=new Float32Array(synthetic.length);for(let i=0;i<synthetic.length;i+=4)reversed.set(synthetic.subarray(i,i+4),synthetic.length-i-4);
const reverseClusters=clusterSparse(reversed,[0,0,520,35],520,35);for(let i=0;i<grouped.labels.length;i++)assert.equal(grouped.labels[i],reverseClusters.labels[grouped.labels.length-1-i],'IDs independent of source order');
assert.equal(tileId(35000,-40000),'v35000_-40250','Y grid edge belongs to the south tile');
const folder=path.resolve(__dirname,'../docs/aldeia-da-mata/data'),c={window:{}};
for(const f of ['vegetation-parish-index.js','vegetation-parish-overview.js'])vm.runInNewContext(fs.readFileSync(path.join(folder,f),'utf8'),c);
const meta=c.window.ALDEIA_PARISH_VEGETATION,source=c.window.ALDEIA_VEGETATION_OVERVIEW;
const overviewBytes=zlib.gunzipSync(Buffer.from(source.payload,'base64'));
assert.equal(crypto.createHash('sha256').update(overviewBytes).digest('hex'),meta.overviewSha256);
const catalog=new Float32Array(overviewBytes.buffer,overviewBytes.byteOffset,overviewBytes.length/4);assert.equal(catalog.length,meta.candidateCount*8);assert(meta.candidateCount>65535,'Parish IDs require more than 16 bits');
const total=meta.canopyCount,ids=new Uint32Array(total),values=new Int16Array(total),counts=new Uint32Array(meta.candidateCount+1),valid=new Uint32Array(meta.candidateCount+1),peaks=new Float32Array(meta.candidateCount+1),crossTile=new Map();
const width=meta.bounds[2]-meta.bounds[0],height=meta.bounds[3]-meta.bounds[1],bitmap=new Uint8Array(Math.ceil(width*height/8));
let at=0,pointTotal=0,bytesTotal=0,ndviValid=0;
const tileMetas=Object.values(meta.tiles);
for(const tile of tileMetas){
  const context={window:{}};const text=fs.readFileSync(path.join(folder,tile.url.replace(/^data\//,'')),'utf8');bytesTotal+=Buffer.byteLength(text);vm.runInNewContext(text,context);
  const packet=context.window.ALDEIA_VEGETATION_TILES[tile.id];assert.equal(packet.version,meta.version);
  const bytes=zlib.gunzipSync(Buffer.from(packet.payload,'base64'));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),tile.sha256);
  const header=new Uint32Array(bytes.buffer,bytes.byteOffset,2),a=new Float32Array(bytes.buffer,bytes.byteOffset+8,header[0]*7),p=new Float32Array(bytes.buffer,bytes.byteOffset+8+header[0]*28,header[1]*7);
  assert.equal(header[0],tile.canopyCount);assert.equal(header[1],tile.pointCount);assert.equal(bytes.length,8+(header[0]+header[1])*28);pointTotal+=header[1];
  function checkRecord(array,i){
    const x=array[i],y=array[i+1],h=array[i+3],id=array[i+4],ndvi=array[i+5],median=array[i+6];assert.equal(tileId(x,y),tile.id);assert(h>=.099&&h<=60.001);assert(Number.isInteger(id)&&id>=0&&id<=meta.candidateCount);assert(ndvi===-2||(ndvi>=-1&&ndvi<=1));
    if(id){const ci=(id-1)*8;assert(h>=1.999&&h<=catalog[ci+3]+.011);assert.equal(median,catalog[ci+5]);}else assert.equal(median,-2);
  }
  for(let i=0;i<a.length;i+=7){
    checkRecord(a,i);const x=a[i],y=a[i+1],id=a[i+4],v=a[i+5],cell=Math.floor(meta.bounds[3]-y)*width+Math.floor(x-meta.bounds[0]);assert(cell>=0&&cell<width*height);const mask=1<<(cell&7),byte=cell>>3;assert(!(bitmap[byte]&mask),'Canopy cells must not be duplicated across tiles');bitmap[byte]|=mask;
    ids[at]=id;values[at]=v===-2?-32768:Math.round(v*10000);at++;if(v!==-2)ndviValid++;
    if(id){counts[id]++;peaks[id]=Math.max(peaks[id],a[i+3]);if(v!==-2)valid[id]++;if(!crossTile.has(id))crossTile.set(id,tile.id);else if(crossTile.get(id)!==tile.id)crossTile.set(id,true);}
  }
  for(let i=0;i<p.length;i+=7)checkRecord(p,i);
}
assert.equal(at,total);assert.equal(pointTotal,meta.pointCount);assert.equal(bytesTotal,meta.totalBytes);
const offsets=new Uint32Array(meta.candidateCount+2);for(let id=1;id<offsets.length;id++)offsets[id]=offsets[id-1]+valid[id-1];
const sorted=new Int16Array(offsets[offsets.length-1]),position=offsets.slice();for(let i=0;i<at;i++)if(ids[i]&&values[i]!==-32768)sorted[position[ids[i]]++]=values[i];
for(let id=1;id<=meta.candidateCount;id++){
  const ci=(id-1)*8;assert.equal(counts[id],catalog[ci+4]);assert.equal(valid[id],catalog[ci+6]);assert.equal(peaks[id],catalog[ci+3]);assert(counts[id]>=4);
  if(valid[id]){const a=sorted.subarray(offsets[id],offsets[id]+valid[id]);a.sort();const median=(a[(a.length-1)>>1]+a[a.length>>1])/20000;assert(Math.abs(median-catalog[ci+5])<1e-7);}else assert.equal(catalog[ci+5],-2);
}
const crossing=[...crossTile.values()].filter(v=>v===true).length;assert(crossing>0);
for(const state of [{x:34745,y:-40161,span:500},{x:36419,y:-40688,span:500},{x:30000,y:-38000,span:500}]){const w=focusWindow(state,meta);assert(w.ids.length<=9);assert(w.ids.length>0);assert(w.bounds[2]-w.bounds[0]===750);}
assert.equal(focusWindow({x:34745,y:-40161,span:2000},meta).ids.length,0);
let middle=0,tall=0;for(let p=0;p<catalog.length;p+=8)if(filters.matches(catalog[p+5]<-1?null:catalog[p+5],.2,.4)){middle++;if(catalog[p+3]>=20)tall++;}
console.log(`Validated ${tileMetas.length} tiles, ${total} unique canopy cells, ${pointTotal} points, ${meta.candidateCount} global crown metrics and NDVI medians; ${crossing} crowns cross tile edges. Range 0.2–0.4: ${middle}, including ${tall} at least 20 m. Valid canopy spectral samples: ${ndviValid}.`);
