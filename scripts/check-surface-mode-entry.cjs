'use strict';
// Exercise the real surface-viewer entry callbacks, beyond each layer's own UI.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../docs/aldeia-da-mata/surface-viewer.js'),'utf8');
for(const name of['vegetation','aerial'])for(const startIndex of[0,2])for(const desiredMap of[false,true]){
 const factory=name==='vegetation'?'createVegetationViewer':'createAerialComparison';const part=source.slice(source.indexOf(name+'=window.'+factory+'({'));const match=part.match(/\n    enter\(([^)]*)\)\{([\s\S]*?)\n    \},/);assert(match,'Real '+name+' entry callback');
 let modes=[],exits=[];const ctx={desiredMap,view:{index:startIndex,x:4000,y:5000,span:600},patch:{bounds:[30000,-45000,40000,-35000]},fittedView:true,aerial:{deactivate(){exits.push('aerial')}},vegetation:{deactivate(){exits.push('vegetation')}},comparison:{deactivate(){exits.push('land')}},setMode(map){modes.push(map)},closeSheet(){},activatePatch(index){ctx.view.index=index;ctx.patch={bounds:[28500,-44800,39000,-36400]}}};
 vm.runInNewContext('(function('+match[1]+'){'+match[2]+'})(desiredMap)',ctx);assert.equal(modes.length,1);assert.equal(modes[0],name==='vegetation'?true:desiredMap);assert.equal(ctx.view.index,2);assert.equal(ctx.patch.bounds[0]+ctx.view.x,34000);assert.equal(ctx.patch.bounds[1]+ctx.view.y,-40000);assert.equal(ctx.view.span,600);assert(exits.includes('land'));assert(exits.includes(name==='vegetation'?'aerial':'vegetation'));
}
console.log('Surface mode entries passed: Trees enters map without undefined variables; aerial preserves requested map/3D mode; transitions close other modes and retain global target/span.');
