'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const bridgeMode=process.argv.includes('--bridges'),waterMode=process.argv.includes('--water'),unclassifiedMode=process.argv.includes('--unclassified'),layer=unclassifiedMode?'unclassified':waterMode?'water':bridgeMode?'bridges':'buildings',symbol=unclassifiedMode?'UNCLASSIFIED':waterMode?'WATER':bridgeMode?'BRIDGE':'BUILDING';
const folder=path.resolve(__dirname,'../docs/aldeia-da-mata/data'),c={window:{}};vm.runInNewContext(fs.readFileSync(path.join(folder,layer+'-parish-index.js'),'utf8'),c);const m=c.window['ALDEIA_PARISH_'+layer.toUpperCase()],hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function script(p){const s={window:{}};vm.runInNewContext(fs.readFileSync(p,'utf8'),s);return s.window;}
const o=script(path.join(folder,layer+'-parish-overview.js'))['ALDEIA_'+symbol+'_OVERVIEW'];assert.equal(o.version,m.version);const raw=zlib.gunzipSync(Buffer.from(o.payload,'base64'));assert.equal(hash(raw),m.overviewSha256);assert.equal(raw.length,m.overviewCount*16);
const overview=new Float32Array(raw.buffer,raw.byteOffset,raw.length/4),roofSet=new Set(),overviewCells=new Set();let roofs=0,points=0,bytes=0;
const key=(a,p)=>a[p]+','+a[p+1]+','+a[p+2];
for(const t of Object.values(m.tiles)){
 const file=path.join(folder,t.url.replace('data/','')),packet=script(file)['ALDEIA_'+symbol+'_TILES'][t.id];assert.equal(packet.version,m.version);const raw=zlib.gunzipSync(Buffer.from(packet.payload,'base64'));assert.equal(hash(raw),t.sha256);const h=new Uint32Array(raw.buffer,raw.byteOffset,2);assert.equal(h[0],t.roofCount);assert.equal(h[1],t.pointCount);assert.equal(raw.length,8+(h[0]+h[1])*16);
 const roof=new Float32Array(raw.buffer,raw.byteOffset+8,h[0]*4),p3=new Float32Array(raw.buffer,raw.byteOffset+8+h[0]*16,h[1]*4),cells=new Set(),voxels=new Set();
 for(const [a,isRoof] of [[roof,true],[p3,false]])for(let p=0;p<a.length;p+=4){assert(Number.isFinite(a[p])&&Number.isFinite(a[p+1])&&Number.isFinite(a[p+2]));assert(a[p]>=t.bounds[0]&&a[p]<t.bounds[2]&&a[p+1]>t.bounds[1]&&a[p+1]<=t.bounds[3]);assert.equal(a[p+3],0);const cell=isRoof?Math.floor(a[p]*2)+','+Math.ceil(a[p+1]*2):Math.floor(a[p])+','+Math.ceil(a[p+1])+','+Math.floor(a[p+2]);const set=isRoof?cells:voxels;assert(!set.has(cell),'Duplicate cell/voxel in '+t.id);set.add(cell);if(isRoof)roofSet.add(key(a,p));}
 roofs+=h[0];points+=h[1];bytes+=fs.statSync(file).size;
}
assert.equal(roofs,m.roofCount);assert.equal(points,m.pointCount);assert.equal(bytes,m.totalBytes);assert(roofs>0&&points>0);
for(let p=0;p<overview.length;p+=4){assert(roofSet.has(key(overview,p)),'Overview is a measured roof representative');const k=Math.floor(overview[p]/4)+','+Math.ceil(overview[p+1]/4);assert(!overviewCells.has(k));overviewCells.add(k);}
const provenance=JSON.parse(fs.readFileSync(path.join(folder,layer+'-parish-provenance.json')));assert.equal(provenance.sourceReports.length,60);assert.equal(provenance.sourceReports.reduce((n,s)=>n+s.accepted,0),m.sourceReturns);
// Verify each packaged sample is present unchanged in the decoded class-6 cache.
const cache=path.resolve(process.argv[2]||'/tmp','aldeia-parish-'+layer),expectedRoofs=new Set(),expectedPoints=new Set();
for(const r of provenance.sourceReports)for(const suffix of ['roofs','points']){const b=fs.readFileSync(path.join(cache,r.filename+'.'+suffix)),a=new Float32Array(b.buffer,b.byteOffset,b.length/4),set=suffix==='roofs'?expectedRoofs:expectedPoints;for(let p=0;p<a.length;p+=4)set.add(key(a,p));}
for(const k of roofSet)assert(expectedRoofs.has(k));assert.equal(expectedRoofs.size,m.roofCount);assert.equal(expectedPoints.size,m.pointCount);
for(const t of Object.values(m.tiles)){const packet=script(path.join(folder,t.url.replace('data/','')))['ALDEIA_'+symbol+'_TILES'][t.id],b=zlib.gunzipSync(Buffer.from(packet.payload,'base64')),a=new Float32Array(b.buffer,b.byteOffset+8+t.roofCount*16,t.pointCount*4);for(let p=0;p<a.length;p+=4)assert(expectedPoints.has(key(a,p)));}
if(waterMode||unclassifiedMode){const census=JSON.parse(fs.readFileSync(path.join(folder,'class-census.json')));assert.equal(m.sourceReturns,census.parishClassCounts[unclassifiedMode?1:9]);assert.equal(m.sourceClass,unclassifiedMode?1:9);}
console.log(layer+' checks passed:',m.sourceReturns,'class '+(unclassifiedMode?1:waterMode?9:bridgeMode?26:6)+' returns;',roofs,'roof cells;',points,'3D points;',Object.keys(m.tiles).length,'tiles. Checksums, version, sizes, spatial ownership, cell/voxel uniqueness, overview membership and measured-source agreement verified.');
