'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),version='test-v1',assets=new Map(),tiles={};
const overviewRaw=Buffer.from(new Float32Array([100,100,120,0]).buffer);
assets.set('overview.js','window.ALDEIA_BUILDING_OVERVIEW='+JSON.stringify({version,payload:zlib.gzipSync(overviewRaw).toString('base64')})+';');
for(let y=-4;y<9;y++)for(let x=-4;x<13;x++){
  const id=`v${x*250}_${y*250}`,records=new Float32Array([x*250+.5,y*250+249.5,100,0]),raw=Buffer.concat([Buffer.from(new Uint32Array([1,1]).buffer),Buffer.from(records.buffer),Buffer.from(records.buffer)]);
  tiles[id]={id,url:id+'.js',bounds:[x*250,y*250,x*250+250,y*250+250],roofCount:1,pointCount:1,sha256:hash(raw),bytes:raw.length};
  assets.set(id+'.js','window.ALDEIA_BUILDING_TILES=window.ALDEIA_BUILDING_TILES||{};window.ALDEIA_BUILDING_TILES['+JSON.stringify(id)+']='+JSON.stringify({version,payload:zlib.gzipSync(raw).toString('base64')})+';');
}
const symbol=process.argv.includes('--unclassified')?'UNCLASSIFIED':process.argv.includes('--water')?'WATER':process.argv.includes('--bridges')?'BRIDGE':'BUILDING';for(const [key,value] of assets)assets.set(key,value.replaceAll('ALDEIA_BUILDING','ALDEIA_'+symbol));
const manifest={sourceClass:process.argv.includes('--unclassified')?1:process.argv.includes('--water')?9:process.argv.includes('--bridges')?26:6,version,overviewCount:1,overviewUrl:'overview.js',overviewSha256:hash(overviewRaw),tiles};
let requests=0,inflight=0,maxInflight=0,evictions=0,broken=null;
const context={crypto:crypto.webcrypto,Uint8Array,Uint32Array,Int32Array,Float32Array,Blob,Response,DecompressionStream,atob,setTimeout,clearTimeout,console};context.window=context;
context.document={createElement(){return{remove(){}};},head:{appendChild(node){requests++;inflight++;maxInflight=Math.max(maxInflight,inflight);setTimeout(()=>{inflight--;const name=node.src.split('?')[0];if(name===broken){node.onerror();return;}try{vm.runInContext(assets.get(name),context);node.onload();}catch(e){node.onerror();}},30);}}};
vm.createContext(context);vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../docs/aldeia-da-mata/vegetation-parish-loader.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../docs/aldeia-da-mata/buildings-loader.js'),'utf8'),context);
const loader=context.createBuildingLoader(manifest,{evicted(){evictions++;}});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function settle(){await wait(220);let tries=0;while(loader.stats.running||loader.stats.queued){if(tries++>200)throw Error('Loader never settled');await wait(10);}}
async function main(){
  loader.resume();await loader.loadOverview();assert.equal(loader.overview[2],120);
  const start=requests;loader.update({x:125,y:125,span:500,interacting:true});await settle();assert.equal(requests,start,'No tile requests during a gesture');
  for(const x of [125,875,1625,2375]){loader.update({x,y:125,span:500,interacting:false});await settle();assert.equal(loader.stats.loaded,loader.stats.wanted);assert(loader.stats.cached<=12);}
  assert(maxInflight<=2,'At most two tile downloads');assert(evictions>0,'LRU evicts earlier windows');
  broken='v-500_0.js';loader.update({x:-375,y:125,span:500,interacting:false});await settle();assert(loader.error,'Tile failure is visible');assert.equal(loader.stats.running,0,'Failure does not loop');
  broken=null;loader.retry();await settle();assert.equal(loader.error,'');assert.equal(loader.stats.loaded,loader.stats.wanted);
  loader.pause();const paused=requests;loader.update({x:875,y:875,span:500,interacting:false});await settle();assert.equal(requests,paused,'Paused mode makes no tile requests');
  loader.resume();loader.update({x:875,y:875,span:500,interacting:false});await settle();assert.equal(loader.stats.loaded,loader.stats.wanted);assert(loader.stats.cached<=12);
  loader.update({x:125,y:125,span:3000,interacting:false});await settle();assert.equal(loader.stats.wanted,0,'Wide view uses only the overview');
  loader.update({x:2375,y:1125,span:500,interacting:false});await wait(205);
  const gestureRequests=requests;loader.update({x:2375,y:1125,span:500,interacting:true});await wait(150);assert.equal(requests,gestureRequests,'An ongoing queue cannot start more requests during a gesture');
  loader.update({x:2375,y:1125,span:500,interacting:false});await settle();assert.equal(loader.stats.loaded,loader.stats.wanted);
  console.log('Building loader checks passed: integrity, nine-tile windows, two downloads, twelve-tile LRU, gesture pause, retry, mode pause and overview-only wide view.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
