'use strict';
window.createVegetationSpectra=function(){
  let data=null,pending=null;
  async function unpack(encoded,Type){
    const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
    return new Type(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  }
  async function hash(bytes){
    if(!window.crypto?.subtle)throw Error('Spectral validation needs localhost or HTTPS.');
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
  }
  async function verifyClusters(labels,catalog){
    if(!data)return;
    const [labelHash,catalogHash]=await Promise.all([hash(labels),hash(new TextEncoder().encode(JSON.stringify(catalog)))]);
    if(labelHash!==data.labelsHash||catalogHash!==data.catalogHash)throw Error('NDVI summaries do not match the crown dataset. Rebuild the NDVI layer.');
  }
  async function load(canopy,points){
    if(data)return data;
    if(pending)return pending;
    pending=(async()=>{
      if(!window.ALDEIA_NDVI)await new Promise((resolve,reject)=>{
        const script=document.createElement('script');script.src='data/ndvi-village.js';
        script.onload=resolve;script.onerror=()=>{script.remove();reject(Error('NDVI download failed. Tap Retry.'));};document.head.appendChild(script);
      });
      const source=window.ALDEIA_NDVI;
      const [mapValues,pointValues,mapHash,pointHash]=await Promise.all([unpack(source.canopy,Int16Array),unpack(source.points,Int16Array),hash(canopy),hash(points)]);
      if(mapValues.length!==canopy.length/4||pointValues.length!==points.length/4||mapHash!==source.canopyHash||pointHash!==source.pointHash)throw Error('NDVI values do not match the vegetation geometry. Rebuild the NDVI layer.');
      const toFloat=values=>Float32Array.from(values,v=>v===source.nodata?-2:v*source.scale);
      data={...source,mapValues,pointValues,mapFloats:toFloat(mapValues),pointFloats:toFloat(pointValues)};
      return data;
    })();
    try{return await pending;}finally{pending=null;}
  }
  function crown(id){return data?.crownStats[id-1]||null;}
  return{get data(){return data;},load,verifyClusters,crown};
};
