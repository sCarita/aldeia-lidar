'use strict';
// Two bounded world-coordinate atlases: parish fallback and a local detail window.
// Sampling uses projected metres, independently of either terrain mesh's UVs.
(function(root){
 function uvAt(x,y,b){return[(x-b[0])/(b[2]-b[0]),(b[3]-y)/(b[3]-b[1])];}
 function atlasBounds(wanted,manifest){
  const tiles=wanted.ids.map(id=>manifest.tiles[id]).filter(t=>t.level===wanted.level);
  if(!tiles.length)return manifest.bounds;
  return [Math.min(...tiles.map(t=>t.bounds[0])),Math.min(...tiles.map(t=>t.bounds[1])),Math.max(...tiles.map(t=>t.bounds[2])),Math.max(...tiles.map(t=>t.bounds[3]))];
 }
 if(typeof module!=='undefined'&&module.exports){module.exports={uvAt,atlasBounds};return;}
 root.createAerialDrape=function(gl){
  const size=Math.min(2048,gl.getParameter(gl.MAX_TEXTURE_SIZE));
  const sheet=document.createElement('canvas');
  const ctx=sheet.getContext('2d');let lastBase='',lastDetail='';
  function texture(){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));return t;}
  gl.activeTexture(gl.TEXTURE0);const base=texture(),detail=texture();let baseBounds=[0,0,1,1],detailBounds=[0,0,1,1];
  function upload(target,bounds,tiles,pixels=size){
   if(sheet.width!==pixels){sheet.width=sheet.height=pixels;}
   ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,pixels,pixels);
   const sx=pixels/(bounds[2]-bounds[0]),sy=pixels/(bounds[3]-bounds[1]);
   tiles.sort((a,b)=>b.level-a.level);
   for(const t of tiles){const b=t.bounds;if(b[0]>=bounds[2]||b[2]<=bounds[0]||b[1]>=bounds[3]||b[3]<=bounds[1])continue;ctx.drawImage(t.img,(b[0]-bounds[0])*sx,(bounds[3]-b[3])*sy,(b[2]-b[0])*sx,(b[3]-b[1])*sy);}
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,target);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,sheet);
  }
  function prepare(imagery,interacting){
   if(!imagery.manifest||interacting)return;
   const {manifest,cache,wanted}=imagery;
   const coarse=[...cache.values()].filter(t=>t.level===manifest.maxLevel);
   const key=coarse.map(t=>t.url).sort().join('|');
   if(key!==lastBase){baseBounds=manifest.bounds;upload(base,baseBounds,coarse,Math.min(1024,size));lastBase=key;}
   // Rebuild only when the committed request window or cached images change.
   const next=wanted.key+':'+imagery.revision;
   if(next!==lastDetail&&wanted.ids.length){detailBounds=atlasBounds(wanted,manifest);upload(detail,detailBounds,[...cache.values()]);lastDetail=next;}
  }
  function bind(uniforms,enabled){
   gl.uniform1f(uniforms.aerialEnabled,enabled?1:0);
   if(enabled){gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,base);gl.uniform1i(uniforms.aerialBase,1);gl.uniform4f(uniforms.aerialBaseBounds,...baseBounds);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,detail);gl.uniform1i(uniforms.aerialDetail,2);gl.uniform4f(uniforms.aerialDetailBounds,...detailBounds);}
   // Sampler types are all sampler2D; units remain valid even while disabled.
   gl.activeTexture(gl.TEXTURE0);
  }
  return{prepare,bind};
 };
})(typeof window!=='undefined'?window:this);
