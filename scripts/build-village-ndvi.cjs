'use strict';
// node scripts/build-village-ndvi.cjs /path/to/source-cache
// First run decode-village-bands.cjs for each source in vegetation-provenance.json.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),crypto=require('node:crypto');
const {NODATA,ndviProxy,quantile}=require('./ndvi-utils.cjs');
const folder=path.resolve(__dirname,'../docs/aldeia-da-mata/data'),cache=path.resolve(process.argv[2]||'/tmp'),context={window:{}};
for(const name of ['vegetation-village.js','tree-clusters.js'])vm.runInNewContext(fs.readFileSync(path.join(folder,name),'utf8'),context);
const source=context.window.ALDEIA_VEGETATION_DATA,clusters=context.window.ALDEIA_TREE_CLUSTERS;
function unpack(value,Type){const b=zlib.gunzipSync(Buffer.from(value,'base64'));return new Type(b.buffer,b.byteOffset,b.length/Type.BYTES_PER_ELEMENT);}
const canopy=unpack(source.canopy,Float32Array),points=unpack(source.points,Float32Array),labels=unpack(clusters.canopyLabels,Uint16Array);
function key(x,y,z){return `${x},${y},${z}`;}
const targets=new Map();
const canopyBands=new Uint8Array(canopy.length/2),pointBands=new Uint8Array(points.length/2),canopyMatched=new Uint8Array(canopy.length/4),pointMatched=new Uint8Array(points.length/4);
for(const [values,bands,matched] of [[canopy,canopyBands,canopyMatched],[points,pointBands,pointMatched]])for(let i=0;i<values.length;i+=4){const k=key(values[i],values[i+1],values[i+2]);if(!targets.has(k))targets.set(k,[]);targets.get(k).push({bands,matched,index:i/4});}
const provenance=JSON.parse(fs.readFileSync(path.join(folder,'vegetation-provenance.json'))),tileStats=[];
for(const filename of provenance.sourceFiles){
  const b=fs.readFileSync(path.join(cache,'vegetation-bands-'+filename+'.bin')),values=new Float32Array(b.buffer,b.byteOffset,b.length/4);
  const stats={filename,count:0,redRange:[255,0],nirRange:[255,0],zeroPairs:0,identical:0,saturated:0,valid:0,histogram:Array(101).fill(0)},redValues=new Set(),nirValues=new Set();
  let rSum=0,nSum=0,rr=0,nn=0,rn=0;
  for(let i=0;i<values.length;i+=5){
    const r=values[i+3],n=values[i+4];stats.count++;stats.redRange=[Math.min(stats.redRange[0],r),Math.max(stats.redRange[1],r)];stats.nirRange=[Math.min(stats.nirRange[0],n),Math.max(stats.nirRange[1],n)];stats.zeroPairs+=r+n===0;stats.identical+=r===n;stats.saturated+=r===255||n===255;redValues.add(r);nirValues.add(n);rSum+=r;nSum+=n;rr+=r*r;nn+=n*n;rn+=r*n;
    const v=ndviProxy(r,n);if(v!==NODATA){stats.valid++;stats.histogram[Math.min(100,Math.floor((v/10000+1)*50))]++;}
    const matches=targets.get(key(values[i],values[i+1],values[i+2]));
    if(matches)for(const target of matches)if(!target.matched[target.index]){target.bands[target.index*2]=r;target.bands[target.index*2+1]=n;target.matched[target.index]=1;}
  }
  stats.redUnique=redValues.size;stats.nirUnique=nirValues.size;stats.redNirCorrelation=(stats.count*rn-rSum*nSum)/Math.sqrt((stats.count*rr-rSum*rSum)*(stats.count*nn-nSum*nSum));
  if(stats.redUnique<16||stats.nirUnique<16||stats.identical/stats.count>.95||stats.valid/stats.count<.8)throw Error('RGBNIR channels failed numerical usability checks: '+filename);
  tileStats.push(stats);
}
if(canopyMatched.some(v=>!v)||pointMatched.some(v=>!v))throw Error('Geometry did not match the spectral extraction exactly');
const canopyValues=new Int16Array(canopy.length/4),pointValues=new Int16Array(points.length/4),crownSamples=clusters.catalog.map(()=>[]);
for(let i=0;i<canopyValues.length;i++){canopyValues[i]=ndviProxy(canopyBands[i*2],canopyBands[i*2+1]);if(labels[i]&&canopyValues[i]!==NODATA)crownSamples[labels[i]-1].push(canopyValues[i]/10000);}
for(let i=0;i<pointValues.length;i++)pointValues[i]=ndviProxy(pointBands[i*2],pointBands[i*2+1]);
const crownStats=crownSamples.map((values,i)=>({id:i+1,samples:values.length,totalCells:clusters.catalog[i].cells,median:quantile(values,.5),p10:quantile(values,.1),p90:quantile(values,.9)}));
function hash(array){return crypto.createHash('sha256').update(Buffer.from(array.buffer,array.byteOffset,array.byteLength)).digest('hex');}
const metadata={version:1,name:'NDVI proxy',formula:'(NIR - red) / (NIR + red)',calibration:'Unverified reflectance calibration. Exploratory normalized difference of 8-bit DGT public-viewer colour attributes. Not a calibrated NDVI product or a tree-health assessment.',sourceDate:'04-2024 in the four source filenames; exact photography dates unverified',source:'https://portugal3d.dgterritorio.gov.pt/continente/crato',crs:source.crs,bounds:source.bounds,sourceFiles:provenance.sourceFiles,sourceReturns:tileStats.reduce((n,t)=>n+t.count,0),canopyCount:canopyValues.length,pointCount:pointValues.length,validCanopy:canopyValues.reduce((n,v)=>n+(v!==NODATA),0),validPoints:pointValues.reduce((n,v)=>n+(v!==NODATA),0),canopyHash:hash(canopy),pointHash:hash(points),labelsHash:hash(labels),catalogHash:crypto.createHash('sha256').update(JSON.stringify(clusters.catalog)).digest('hex'),nodata:NODATA,scale:.0001,mask:'Mask either zero channel, either channel at 255 (saturation), or red+NIR <20. Preserve negative values. Unsupported geometry is never filled.',aggregation:'Exact x,y,z match to existing canopy representatives and display points. Per-crown median, p10 and p90 over valid occupied 1 m canopy cells, one sample per cell. No propagation of crown statistics to missing pixels. Reported sample count is canopy cells, not independent aerial pixels.',encoding:'gzip little-endian int16 index x10000; red/NIR pairs are gzip uint8',references:['https://www.dgterritorio.gov.pt/sites/default/files/ficheiros-artigos/Apresentacoes/2025/5-Webinar_LiDAR_15jul2025.pdf','https://www2.dgterritorio.gov.pt/lidar/web/sites/default/files/apresentacoes/LiDAR2024_Jorge_Gomes.pdf','https://science.nasa.gov/earth/earth-observatory/measuring-vegetation-ndvi-evi/'],built:'2026-11-12'};
function pack(array){return zlib.gzipSync(Buffer.from(array.buffer,array.byteOffset,array.byteLength),{level:9}).toString('base64');}
fs.writeFileSync(path.join(folder,'ndvi-village.js'),'window.ALDEIA_NDVI='+JSON.stringify({...metadata,canopy:pack(canopyValues),points:pack(pointValues),canopyBands:pack(canopyBands),pointBands:pack(pointBands),crownStats})+';\n');
fs.writeFileSync(path.join(folder,'ndvi-provenance.json'),JSON.stringify({...metadata,tileStats},null,2)+'\n');
console.log(JSON.stringify({...metadata,crownsWithData:crownStats.filter(t=>t.samples).length},null,2));
