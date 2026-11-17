'use strict';
(function(root){
  function tileId(x,y){return 'v'+Math.floor(x/250)*250+'_'+(Math.ceil(y/250)-1)*250;}
  function focusWindow(state,manifest){
    if(state.span>1500)return {key:'overview',ids:[],bounds:null};
    const tx=Math.floor(state.x/250),ty=Math.ceil(state.y/250)-1,ids=[];
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const id='v'+(tx+dx)*250+'_'+(ty+dy)*250;if(manifest.tiles[id])ids.push(id);}
    ids.sort((a,b)=>{const aa=manifest.tiles[a].bounds,bb=manifest.tiles[b].bounds;return Math.hypot((aa[0]+aa[2])/2-state.x,(aa[1]+aa[3])/2-state.y)-Math.hypot((bb[0]+bb[2])/2-state.x,(bb[1]+bb[3])/2-state.y);});
    return {key:tx+','+ty,ids,bounds:[(tx-1)*250,(ty-1)*250,(tx+2)*250,(ty+2)*250]};
  }
  const api={tileId,focusWindow};
  if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}
  root.ParishVegetationUtils=api;
  root.createParishVegetationLoader=function(manifest,options={}){
    const cache=new Map(),errors=new Map(),pending=new Map();let overview=null,overviewPromise=null,overviewError='',wanted={key:'overview',ids:[],bounds:null},queue=[],running=0,timer=null,scheduledKey='',active=true,interacting=false;
    const cacheLimit=12,concurrency=2;
    async function digest(bytes){if(!root.crypto?.subtle)throw Error('Vegetation validation needs localhost or HTTPS.');return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');}
    async function unpack(encoded,expected){const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)),raw=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();if(await digest(raw)!==expected)throw Error('Vegetation integrity check failed. Refresh the data folder.');return raw;}
    function script(url){return new Promise((resolve,reject)=>{const node=document.createElement('script');node.src=url;node.onload=()=>{node.remove();resolve();};node.onerror=()=>{node.remove();reject(Error('Vegetation tile download failed. Tap Retry.'));};document.head.appendChild(node);});}
    function changed(){options.changed?.();}
    function prune(){while(cache.size>cacheLimit){let removed=false;for(const [id,tile] of cache){if(wanted.ids.includes(id))continue;cache.delete(id);options.evicted?.(tile);removed=true;break;}if(!removed)break;}}
    async function loadOverview(){
      if(overview)return overview;if(overviewPromise)return overviewPromise;
      overviewPromise=(async()=>{try{
        overviewError='';await script(manifest.overviewUrl+'?v='+manifest.overviewSha256.slice(0,16));const source=root.ALDEIA_VEGETATION_OVERVIEW;delete root.ALDEIA_VEGETATION_OVERVIEW;
        if(!source||source.version!==manifest.version)throw Error('Parish vegetation versions do not match. Refresh the page.');
        const raw=await unpack(source.payload,manifest.overviewSha256),catalog=new Float32Array(raw);
        if(catalog.length!==manifest.candidateCount*8)throw Error('Parish crown catalog has the wrong size.');
        const records=new Float32Array(manifest.candidateCount*7),buckets=new Map();
        for(let i=0;i<manifest.candidateCount;i++){
          const p=i*8;records.set([catalog[p],catalog[p+1],catalog[p+2],catalog[p+3],i+1,catalog[p+5],catalog[p+5]],i*7);
          const id=tileId(catalog[p],catalog[p+1]);if(!buckets.has(id))buckets.set(id,[]);buckets.get(id).push(i+1);
        }
        overview={catalog,records,buckets};delete root.ALDEIA_VEGETATION_OVERVIEW;changed();return overview;
      }catch(e){overviewError=e.message;changed();throw e;}finally{overviewPromise=null;}})();return overviewPromise;
    }
    async function loadTile(id){
      const meta=manifest.tiles[id];await script(meta.url+'?v='+meta.sha256.slice(0,16));const source=root.ALDEIA_VEGETATION_TILES?.[id];if(root.ALDEIA_VEGETATION_TILES)delete root.ALDEIA_VEGETATION_TILES[id];
      if(!source||source.version!==manifest.version)throw Error('Vegetation tile version mismatch. Refresh the page.');
      const raw=await unpack(source.payload,meta.sha256);delete root.ALDEIA_VEGETATION_TILES[id];
      const header=new Uint32Array(raw,0,2),canopyCount=header[0],pointCount=header[1];
      if(canopyCount!==meta.canopyCount||pointCount!==meta.pointCount||raw.byteLength!==8+(canopyCount+pointCount)*28)throw Error('Vegetation tile has the wrong geometry size.');
      const canopy=new Float32Array(raw,8,canopyCount*7),points=new Float32Array(raw,8+canopyCount*28,pointCount*7),cells=new Int32Array(62500);cells.fill(-1);
      for(let i=0;i<canopyCount;i++){const p=i*7,col=Math.floor(canopy[p]-meta.bounds[0]),row=Math.floor(meta.bounds[3]-canopy[p+1]);if(col>=0&&col<250&&row>=0&&row<250)cells[row*250+col]=i;}
      const tile={...meta,canopy,points,cells,rawBytes:raw.byteLength};cache.delete(id);cache.set(id,tile);prune();return tile;
    }
    function pump(){
      if(!active||interacting)return;
      while(running<concurrency&&queue.length){
        const id=queue.shift();if(cache.has(id)||pending.has(id)||errors.has(id)||!wanted.ids.includes(id))continue;
        running++;const task=loadTile(id).catch(e=>errors.set(id,e.message)).finally(()=>{running--;pending.delete(id);prune();changed();pump();});pending.set(id,task);
      }
    }
    function commit(next){wanted=next;queue=next.ids.filter(id=>!cache.has(id)&&!pending.has(id)&&!errors.has(id));for(const id of next.ids)if(cache.has(id)){const t=cache.get(id);cache.delete(id);cache.set(id,t);}prune();pump();changed();}
    function update(state){
      interacting=!!state.interacting;
      if(!overview)return;
      const next=focusWindow(state,manifest);
      if(interacting){queue=[];clearTimeout(timer);timer=null;scheduledKey='';return;}
      if(next.key!==wanted.key)queue=[];
      if(next.key===wanted.key&&next.ids.every(id=>cache.has(id)||pending.has(id)||errors.has(id)||queue.includes(id))){pump();return;}
      if(next.key===scheduledKey)return;
      clearTimeout(timer);scheduledKey=next.key;timer=setTimeout(()=>{timer=null;scheduledKey='';if(active)commit(next);},180);
    }
    function tree(id){if(!overview||id<1||id>manifest.candidateCount)return null;const a=overview.catalog,p=(id-1)*8,flags=a[p+7];return {id,x:a[p],y:a[p+1],z:a[p+2],height:a[p+3],area:a[p+4],median:a[p+5]<-1?null:a[p+5],samples:a[p+6],totalCells:a[p+4],sparse:!!(flags&1),touching:!!(flags&2),edge:!!(flags&4)};}
    function visible(state){const next=focusWindow(state,manifest);return next.ids.map(id=>cache.get(id)).filter(Boolean);}
    function mask(state){const next=focusWindow(state,manifest);return next.ids.length&&next.ids.every(id=>cache.has(id))?next.bounds:null;}
    function nearby(x,y,radius){if(!overview)return[];const ids=[];for(let ty=Math.floor((y-radius)/250);ty<=Math.floor((y+radius)/250);ty++)for(let tx=Math.floor((x-radius)/250);tx<=Math.floor((x+radius)/250);tx++){const list=overview.buckets.get('v'+tx*250+'_'+ty*250);if(list)ids.push(...list);}return ids;}
    return{manifest,loadOverview,update,tree,visible,mask,nearby,get overview(){return overview;},get error(){return overviewError||wanted.ids.map(id=>errors.get(id)).find(Boolean)||'';},get stats(){return{cached:cache.size,cacheLimit,running,queued:queue.length,loaded:wanted.ids.filter(id=>cache.has(id)).length,wanted:wanted.ids.length,rawBytes:[...cache.values()].reduce((n,t)=>n+t.rawBytes,0)};},retry(){overviewError='';errors.clear();if(!overview)loadOverview().catch(()=>{});queue=wanted.ids.filter(id=>!cache.has(id)&&!pending.has(id));pump();},pause(){active=false;clearTimeout(timer);timer=null;scheduledKey='';queue=[];},resume(){active=true;}}
  };
})(typeof window!=='undefined'?window:this);
