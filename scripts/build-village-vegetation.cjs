// Usage: node scripts/build-village-vegetation.cjs /path/to/source-cache [--reuse]
// Requires DGT worker + WASM, aldeia-chunk-tasks.json, parish-max-tasks.json,
// aldeia-lidar-cache/*.meta, aldeia-surface-cache/*.chunk and full viewer files
// in aldeia-full-source/. Source byte ranges are recorded in vegetation-provenance.json.
// --reuse uses previously decoded vegetation-*.bin files in that cache.
const fs=require('fs'),zlib=require('zlib'),vm=require('vm');
const path=require('node:path'),{execFileSync}=require('node:child_process');
const cache=path.resolve(process.argv[2]||'/tmp');
process.chdir(path.resolve(__dirname,'..'));
const sources=JSON.parse(fs.readFileSync(cache+'/aldeia-chunk-tasks.json')).filter(t=>t.x+500>34250&&t.x-500<35250&&t.y+500> -40750&&t.y-500< -39750);
if(!process.argv.includes('--reuse'))for(const source of sources)execFileSync(process.execPath,[path.join(__dirname,'decode-village-vegetation.cjs'),source.filename,cache],{stdio:'inherit'});
const folder='docs/aldeia-da-mata/data',bounds=[34250,-40750,35250,-39750],width=1000;
const context={window:{}};vm.runInNewContext(fs.readFileSync(folder+'/max-detail-index.js','utf8'),context);
const groundTiles=Object.values(context.window.ALDEIA_MAX_DETAIL.tiles).filter(t=>t.bounds[0]<bounds[2]&&t.bounds[2]>bounds[0]&&t.bounds[1]<bounds[3]&&t.bounds[3]>bounds[1]);
const ground=new Map();for(const t of groundTiles){const s=fs.readFileSync(folder+'/'+t.url.replace('data/',''),'utf8');const data=JSON.parse(s.slice(s.indexOf('={"id"')+1).replace(/;\s*$/,''));const raw=zlib.gunzipSync(Buffer.from(data.heights,'base64'));ground.set(t.id,{...t,values:new Uint16Array(raw.buffer,raw.byteOffset,raw.length/2)});}
function height(x,y){const id='t'+Math.floor(x/250)*250+'_'+Math.floor(y/250)*250,t=ground.get(id);if(!t)return null;const col=Math.floor((x-t.bounds[0])*2),row=Math.floor((t.bounds[3]-y)*2),v=t.values[row*500+col];return v===65535||v===undefined?null:t.zBase+v*.01;}
const canopy=new Float32Array(width*width*4),top=new Float32Array(width*width);top.fill(-1);
const display=[],voxels=new Set();let sourceCount=0,validCount=0,unsupported=0,outliers=0;

for(const source of sources){const raw=fs.readFileSync(cache+'/vegetation-'+source.filename+'.bin'),points=new Float32Array(raw.buffer,raw.byteOffset,raw.length/4);for(let i=0;i<points.length;i+=3){sourceCount++;const x=points[i],y=points[i+1],z=points[i+2],g=height(x,y);if(g===null){unsupported++;continue;}const h=z-g;if(h<.1||h>60){outliers++;continue;}validCount++;const col=Math.floor(x-bounds[0]),row=Math.floor(bounds[3]-y),index=row*width+col;if(col<0||col>=width||row<0||row>=width)continue;if(h>top[index]){top[index]=h;canopy.set([x,y,z,h],index*4);}const key=col+','+row+','+Math.floor(h);if(!voxels.has(key)){voxels.add(key);display.push(x,y,z,h);}}}
const cells=[];for(let i=0;i<top.length;i++)if(top[i]>=0)cells.push(...canopy.subarray(i*4,i*4+4));
// Every display voxel has at most one measured return. Only the displayed points are decimated.
const stride=Math.max(1,Math.ceil(display.length/4/180000)),sample=[];for(let i=0;i<display.length;i+=stride*4)sample.push(...display.slice(i,i+4));
function pack(array){return zlib.gzipSync(Buffer.from(new Float32Array(array).buffer),{level:9,mtime:0}).toString('base64');}
const metadata={id:'village',bounds,crs:'EPSG:3763',resolution:1,sourceCount,validCount,unsupported,outliers,canopyCells:cells.length/4,displayPoints:sample.length/4,displayStride:stride,encoding:'gzip little-endian float32 x,y,elevation,heightAboveGround',method:'Classes 3–5 from all available hierarchy levels. Subtract the existing 0.5 m terrain cell at each return. Omit unsupported ground and heights outside 0.1–60 m. Canopy uses the highest accepted vegetation return per 1 m cell without filling gaps. Display points retain one measured return per 1 m × 1 m × 1 m height voxel, then a deterministic stride to at most 180,000 points. Heights are canopy estimates from the survey date, not current tree inventory.'};
metadata.maxHeight=top.reduce((a,b)=>Math.max(a,b),0);
fs.writeFileSync(folder+'/vegetation-village.js','window.ALDEIA_VEGETATION_DATA='+JSON.stringify({...metadata,points:pack(sample),canopy:pack(cells)})+';\n');
const tasks=JSON.parse(fs.readFileSync(cache+'/parish-max-tasks.json')).filter(t=>sources.some(s=>s.filename===t.filename));
fs.writeFileSync(folder+'/vegetation-provenance.json',JSON.stringify({...metadata,source:'https://portugal3d.dgterritorio.gov.pt/continente/crato',licence:'CC BY 4.0, Direção-Geral do Território',built:'2026-11-12',ground:'max-detail-provenance.json',sourceFiles:sources.map(s=>s.filename),chunks:tasks},null,2)+'\n');console.log(metadata);
