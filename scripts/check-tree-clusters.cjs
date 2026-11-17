'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib');
const {clusterTrees,labelPoints}=require('./tree-clustering.cjs');
function scene(crowns,width=40,height=30,groundSlope=0){
  const points=[];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    let h=0;for(const tree of crowns){const d=Math.hypot(x-tree.x,y-tree.y);if(d<=tree.r)h=Math.max(h,tree.h*(1-.65*(d/tree.r)**2));}
    if(h>=2)points.push(x+.5,height-y-.5,100+groundSlope*x+h,h);
  }
  return {points:new Float32Array(points),bounds:[0,0,width,height],width,height};
}
function run(s){return clusterTrees(s.points,s.bounds,s.width,s.height);}
const isolated=scene([{x:10,y:15,r:4,h:12},{x:28,y:15,r:4,h:8}]);
const a=run(isolated);assert.equal(a.catalog.length,2,'Separated crowns');
assert.deepEqual(a.catalog.map(t=>Math.round(t.height)).sort((a,b)=>a-b),[8,12]);
assert.deepEqual([...a.canopyLabels],[...run(isolated).canopyLabels],'Deterministic labels');
const slope=run(scene([{x:10,y:15,r:4,h:12},{x:28,y:15,r:4,h:8}],40,30,2));
assert.deepEqual([...a.canopyLabels],[...slope.canopyLabels],'Ground slope cannot change normalized-height clustering');
const touching=run(scene([{x:12,y:15,r:5,h:12},{x:20,y:15,r:5,h:10}]));
assert.equal(touching.catalog.length,2,'Adjoining crowns with separate peaks');assert(touching.catalog.every(t=>t.touching));
const different=run(scene([{x:12,y:15,r:5,h:20},{x:20,y:15,r:4,h:6}]));
assert.equal(different.catalog.length,2,'Nearby crowns of differing height');
const edge=run(scene([{x:0,y:10,r:5,h:12}]));assert(edge.catalog[0].edge,'Coverage-edge flag');
const tiny=run({points:new Float32Array([1.5,1.5,110,10]),bounds:[0,0,4,4],width:4,height:4});assert.equal(tiny.catalog.length,0,'Isolated spikes rejected by minimum crown support');
const low=run(scene([{x:10,y:15,r:4,h:2.5}]));assert.equal(low.catalog.length,0,'Low vegetation is not seeded as a tree');
const lowerPoint=new Float32Array([isolated.points[0],isolated.points[1],100.5,.5]);assert.equal(labelPoints(lowerPoint,a,isolated.bounds,40,30)[0],0,'Ground-level returns are unassigned');
const folder=path.resolve(__dirname,'../docs/aldeia-da-mata/data'),context={window:{}};
for(const file of ['vegetation-village.js','tree-clusters.js'])vm.runInNewContext(fs.readFileSync(path.join(folder,file),'utf8'),context);
const source=context.window.ALDEIA_VEGETATION_DATA,bundle=context.window.ALDEIA_TREE_CLUSTERS;
function unpack(value,Type){const b=zlib.gunzipSync(Buffer.from(value,'base64'));return new Type(b.buffer,b.byteOffset,b.byteLength/Type.BYTES_PER_ELEMENT);}
const canopy=unpack(source.canopy,Float32Array),points=unpack(source.points,Float32Array),labels=unpack(bundle.canopyLabels,Uint16Array),pointLabels=unpack(bundle.pointLabels,Uint16Array);
assert.equal(labels.length,canopy.length/4);assert.equal(pointLabels.length,points.length/4);
const counts=new Uint32Array(bundle.catalog.length+1),maxima=new Float32Array(counts.length),cellMap=new Map();
for(let i=0;i<labels.length;i++){
  const id=labels[i];assert(id<=bundle.catalog.length);const x=canopy[i*4],y=canopy[i*4+1],h=canopy[i*4+3];
  cellMap.set(Math.floor(source.bounds[3]-y)*1000+Math.floor(x-source.bounds[0]),id);
  if(id){assert(h>=2);counts[id]++;maxima[id]=Math.max(maxima[id],h);}
}
for(const tree of bundle.catalog){assert(tree.id>=1);assert.equal(tree.cells,counts[tree.id]);assert.equal(tree.area,tree.cells);assert.equal(tree.height,maxima[tree.id]);assert(tree.cells>=4);}
for(let i=0;i<pointLabels.length;i++){
  const id=pointLabels[i];assert(id<=bundle.catalog.length);
  if(id){assert(points[i*4+3]>=2);const key=Math.floor(source.bounds[3]-points[i*4+1])*1000+Math.floor(points[i*4]-source.bounds[0]);assert.equal(id,cellMap.get(key));assert(points[i*4+3]<=bundle.catalog[id-1].height+.01);}
}
assert.equal(bundle.assignedCanopyCells,labels.reduce((n,id)=>n+!!id,0));assert.equal(bundle.assignedDisplayPoints,pointLabels.reduce((n,id)=>n+!!id,0));
console.log(`Synthetic segmentation checks and ${bundle.catalog.length} bundled crown candidates passed.`);
