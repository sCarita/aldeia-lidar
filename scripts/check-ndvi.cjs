'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {NODATA,ndviProxy,quantile}=require('./ndvi-utils.cjs');
assert.equal(ndviProxy(50,150),5000);assert.equal(ndviProxy(150,50),-5000);assert.equal(ndviProxy(80,80),0);
for(const pair of [[0,120],[120,0],[255,120],[120,255],[1,5],[NaN,100]])assert.equal(ndviProxy(...pair),NODATA);
assert.equal(quantile([1,2,3,4],.5),2.5);assert.equal(quantile([], .5),null);
const folder=path.resolve(__dirname,'../docs/aldeia-da-mata/data'),context={window:{}};
for(const name of ['vegetation-village.js','tree-clusters.js','ndvi-village.js'])vm.runInNewContext(fs.readFileSync(path.join(folder,name),'utf8'),context);
const veg=context.window.ALDEIA_VEGETATION_DATA,clusters=context.window.ALDEIA_TREE_CLUSTERS,data=context.window.ALDEIA_NDVI;
function unpack(encoded,Type){const b=zlib.gunzipSync(Buffer.from(encoded,'base64'));return new Type(b.buffer,b.byteOffset,b.length/Type.BYTES_PER_ELEMENT);}
function hash(array){return crypto.createHash('sha256').update(Buffer.from(array.buffer,array.byteOffset,array.byteLength)).digest('hex');}
assert.equal(hash(unpack(veg.canopy,Float32Array)),data.canopyHash);assert.equal(hash(unpack(veg.points,Float32Array)),data.pointHash);
const labels=unpack(clusters.canopyLabels,Uint16Array);assert.equal(hash(labels),data.labelsHash);
assert.equal(crypto.createHash('sha256').update(JSON.stringify(clusters.catalog)).digest('hex'),data.catalogHash);
const mapValues=unpack(data.canopy,Int16Array),pointValues=unpack(data.points,Int16Array),samples=clusters.catalog.map(()=>[]);
for(const [values,encodedBands,expected] of [[mapValues,data.canopyBands,data.validCanopy],[pointValues,data.pointBands,data.validPoints]]){
  const bands=unpack(encodedBands,Uint8Array);assert.equal(bands.length,values.length*2);let valid=0;
  for(let i=0;i<values.length;i++){assert.equal(values[i],ndviProxy(bands[i*2],bands[i*2+1]));if(values[i]!==NODATA){assert(values[i]>=-10000&&values[i]<=10000);valid++;}}
  assert.equal(valid,expected);
}
for(let i=0;i<mapValues.length;i++)if(labels[i]&&mapValues[i]!==NODATA)samples[labels[i]-1].push(mapValues[i]/10000);
for(let i=0;i<data.crownStats.length;i++){
  const actual=data.crownStats[i],values=samples[i];assert.equal(actual.id,i+1);assert.equal(actual.samples,values.length);assert.equal(actual.totalCells,clusters.catalog[i].cells);
  for(const [key,q] of [['median',.5],['p10',.1],['p90',.9]])assert.equal(actual[key],quantile(values,q));
}
assert(mapValues.some(v=>v!==NODATA&&v<0),'Negative index values must be preserved');
assert(data.calibration.includes('Unverified'),'Calibration limitation must be carried with the data');
console.log(`Validated ${mapValues.length} canopy indices, ${pointValues.length} point indices and ${data.crownStats.length} crown summaries, with masks and geometry fingerprints.`);
async function checkBrowserLoader(){
  const canopy=unpack(veg.canopy,Float32Array),points=unpack(veg.points,Float32Array);
  const browser={window:{ALDEIA_NDVI:data,crypto:crypto.webcrypto},crypto:crypto.webcrypto,Uint8Array,Int16Array,Float32Array,TextEncoder,Blob,Response,DecompressionStream,atob};
  vm.createContext(browser);vm.runInContext(fs.readFileSync(path.join(folder,'../ndvi-loader.js'),'utf8'),browser);
  const loader=browser.window.createVegetationSpectra(),loaded=await loader.load(canopy,points);
  await loader.verifyClusters(labels,clusters.catalog);
  assert.equal(loaded.mapFloats.filter(v=>v===-2).length,data.canopyCount-data.validCanopy);
  const wrongGeometry=canopy.slice();wrongGeometry[0]+=1;
  await assert.rejects(()=>browser.window.createVegetationSpectra().load(wrongGeometry,points),/do not match/);
  const wrongLabels=labels.slice();wrongLabels[0]=wrongLabels[0]===0?1:0;
  await assert.rejects(()=>loader.verifyClusters(wrongLabels,clusters.catalog),/do not match/);
  const wrongCatalog=JSON.parse(JSON.stringify(clusters.catalog));wrongCatalog[0].height+=1;
  await assert.rejects(()=>loader.verifyClusters(labels,wrongCatalog),/do not match/);
  console.log('Browser loader accepts matching data and rejects altered geometry, crown labels and catalog metrics.');
}
checkBrowserLoader().catch(error=>{console.error(error);process.exitCode=1;});
