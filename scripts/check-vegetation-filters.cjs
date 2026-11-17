'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {validRange,matches,treeMatches}=require('../docs/aldeia-da-mata/vegetation-filters.js');
assert(validRange(-1,1));assert(validRange(.3,.3));
for(const range of [[.4,.2],[-1.01,1],[-1,1.01],[NaN,1],[0,Infinity]])assert(!validRange(...range));
assert(matches(.2,.2,.4));assert(matches(.4,.2,.4));assert(matches(-.5,-1,0));assert(matches(0,-1,1));
for(const v of [null,undefined,NaN,-2])assert(!matches(v,-1,1));
assert(!matches(.5,.2,.4));
assert(treeMatches({height:20},{median:.3},20,.2,.4));assert(!treeMatches({height:19.9},{median:.3},20,.2,.4));
assert(!treeMatches({height:30},{median:null},2,-1,1));
// A crown is classified by its median, regardless of an individual branch's value.
assert(treeMatches({height:10},{median:.3},2,.2,.4));assert(!matches(.8,.2,.4));
const folder=path.resolve(__dirname,'../docs/aldeia-da-mata/data'),context={window:{}};
for(const file of ['tree-clusters.js','ndvi-village.js'])vm.runInNewContext(fs.readFileSync(path.join(folder,file),'utf8'),context);
const trees=context.window.ALDEIA_TREE_CLUSTERS.catalog,stats=context.window.ALDEIA_NDVI.crownStats;
function count(height,min,max){return trees.filter(t=>treeMatches(t,stats[t.id-1],height,min,max)).length;}
const all=count(2,-1,1),middle=count(2,.2,.4),tall=count(20,.2,.4);
assert.equal(all,trees.filter(t=>t.height>=2&&Number.isFinite(stats[t.id-1].median)).length);
assert(middle>0&&middle<all);assert(tall<=middle);assert.equal(count(2,.99,1),0);
// GPU float storage must preserve the same range decision at inclusive boundaries.
for(const stat of stats){if(stat.median===null)continue;const stored=Math.fround(stat.median);assert.equal(matches(stored,.2,.4),matches(stat.median,.2,.4));}
console.log(`NDVI range checks passed: ${all} crowns with data, ${middle} in 0.20–0.40, ${tall} also at least 20 m.`);
