'use strict';
window.createVegetationViewer=function(options){
  const {gl,canvas,schedule}=options,manifest=window.ALDEIA_PARISH_VEGETATION,filters=window.VegetationFilters;
  const panel=document.querySelector('#vegetation-tools'),result=document.querySelector('#vegetation-result'),marker=document.querySelector('#vegetation-marker'),viewer=document.querySelector('#viewer');
  const launches=[...document.querySelectorAll('[data-vegetation-launch]')],colourSelect=document.querySelector('#vegetation-colour'),ndviToggle=document.querySelector('#vegetation-filter-ndvi');
  const ndviMin=document.querySelector('#vegetation-ndvi-min'),ndviMax=document.querySelector('#vegetation-ndvi-max'),heightSelect=document.querySelector('#vegetation-minimum');
  const clusterButton=document.querySelector('#vegetation-clusters'),clusterSummary=document.querySelector('#vegetation-cluster-summary'),legend=document.querySelector('.vegetation-legend'),note=document.querySelector('#vegetation-tools .vegetation-note');
  let active=false,clusterMode=false,selected=null,message='',overviewBuffer=null,countKey='',matchingCount=0;
  const gpu=new Map();
  const loader=window.createParishVegetationLoader(manifest,{changed:schedule,evicted(tile){const buffers=gpu.get(tile.id);if(buffers){gl.deleteBuffer(buffers.canopy);gl.deleteBuffer(buffers.points);gpu.delete(tile.id);}}});
  const buildingToggle=document.querySelector('#vegetation-buildings'),buildings=window.createBuildingViewer({gl,canvas,schedule});
  const bridgeToggle=document.querySelector('#vegetation-bridges'),bridges=window.createBuildingViewer({gl,canvas,schedule,manifest:window.ALDEIA_PARISH_BRIDGES,colour:[.96,.65,.28],label:'Bridges'});
  const waterToggle=document.querySelector('#vegetation-water'),water=window.createBuildingViewer({gl,canvas,schedule,manifest:window.ALDEIA_PARISH_WATER,colour:[.12,.70,.96],label:'Water'});
  const unclassifiedToggle=document.querySelector('#vegetation-unclassified'),unclassified=window.createBuildingViewer({gl,canvas,schedule,manifest:window.ALDEIA_PARISH_UNCLASSIFIED,colour:[.80,.58,.96],label:'Unclassified'});
  const vegetationToggle=document.querySelector('#vegetation-visible');
  function wantsNDVI(){return colourSelect.value==='ndvi';}
  function needsNDVI(){return wantsNDVI()||ndviToggle.checked;}
  function range(){return{min:ndviMin.valueAsNumber,max:ndviMax.valueAsNumber};}
  function validFilter(){const r=range();return !ndviToggle.checked||filters.validRange(r.min,r.max);}
  function treePasses(tree){const r=range();return tree&&tree.height>=Number(heightSelect.value)&&(!ndviToggle.checked||filters.matches(tree.median,r.min,r.max));}
  function recordPasses(array,p){const r=range();return array[p+3]>=Number(heightSelect.value)&&(!ndviToggle.checked||filters.matches(array[p+(clusterMode?6:5)],r.min,r.max));}
  function clearSelection(){selected=null;message='';marker.hidden=true;}
  function countMatching(){
    if(!loader.overview||!validFilter())return 0;
    const r=range(),minimum=Number(heightSelect.value),key=[minimum,ndviToggle.checked,r.min,r.max].join(',');if(key===countKey)return matchingCount;
    countKey=key;matchingCount=0;const a=loader.overview.catalog;
    for(let p=0;p<a.length;p+=8)if(a[p+3]>=minimum&&(!ndviToggle.checked||filters.matches(a[p+5]<-1?null:a[p+5],r.min,r.max)))matchingCount++;
    return matchingCount;
  }
  function selectTree(id){const tree=loader.tree(id);if(!tree)return;selected={...tree,h:tree.height};message='';}
  function selectionText(){
    if(!selected)return message;
    let text=selected.id?'Tree #'+selected.id+' · ≈ '+selected.height.toFixed(1)+' m · ≈ '+selected.area+' m² crown':'≈ '+selected.h.toFixed(1)+' m above ground';
    if(needsNDVI())text+=' · NDVI proxy '+(selected.id?'median ':'')+(selected.median===null||selected.median===undefined?'masked':selected.median.toFixed(3))+(selected.id?' ('+selected.samples+'/'+selected.totalCells+' cells)':'');
    return text;
  }
  function updateUI(state){
    const visible=vegetationToggle.checked,r=range(),invalid=!validFilter(),stats=loader.stats,overviewOnly=state.span>1500,nearWindow=window.ParishVegetationUtils.focusWindow(state,manifest),nearLoaded=loader.visible(state).length;
    heightSelect.disabled=colourSelect.disabled=clusterButton.disabled=ndviToggle.disabled=!visible;
    ndviMin.disabled=!visible||!ndviToggle.checked;ndviMax.disabled=!visible||!ndviToggle.checked;
    ndviMin.setAttribute('aria-invalid',String(visible&&ndviToggle.checked&&invalid));ndviMax.setAttribute('aria-invalid',String(visible&&ndviToggle.checked&&invalid));
    document.querySelector('#vegetation-filter-note').textContent=!visible||!ndviToggle.checked?'':invalid?'Enter −1 ≤ Min ≤ Max ≤ 1.':clusterMode||overviewOnly?'Crown medians · missing medians excluded':'Detail samples · overview uses crown medians';
    document.querySelector('#vegetation-status').textContent=!visible?'Vegetation hidden':loader.error||(!loader.overview?'Loading parish crowns…':overviewOnly?'Whole-parish crown overview · zoom for canopy':nearWindow.ids.length?'Parish · '+nearLoaded+'/'+nearWindow.ids.length+' nearby detail tiles':'No nearby vegetation tiles · parish overview');
    const buildingStatus=buildings.status(state);if(buildingStatus)document.querySelector('#vegetation-status').textContent+=' · '+buildingStatus;
    const bridgeStatus=bridges.status(state);if(bridgeStatus)document.querySelector('#vegetation-bridge-focus').title=bridgeStatus;if(bridges.error)document.querySelector('#vegetation-status').textContent+=' · '+bridges.error;
    const waterStatus=water.status(state);if(waterStatus)document.querySelector('#vegetation-water-focus').title=waterStatus;if(water.error)document.querySelector('#vegetation-status').textContent+=' · '+water.error;
    const unclassifiedStatus=unclassified.status(state);if(unclassifiedStatus)document.querySelector('#vegetation-unclassified-focus').title=unclassifiedStatus;if(unclassified.error)document.querySelector('#vegetation-status').textContent+=' · '+unclassified.error;
    document.querySelector('#vegetation-retry').hidden=(!visible||!loader.error)&&!buildings.error&&!bridges.error&&!water.error&&!unclassified.error;
    clusterButton.setAttribute('aria-pressed',String(clusterMode));
    clusterSummary.textContent=!visible?'Vegetation hidden':!loader.overview?'Loading parish crowns…':invalid?'Check NDVI range':clusterMode?countMatching().toLocaleString('en')+' parish crown candidates':'Parish-wide coverage · zoom for canopy';
    document.querySelector('#vegetation-clear-tree').hidden=!selected;
    legend.hidden=!visible||(clusterMode&&!wantsNDVI());legend.classList.toggle('ndvi-legend',wantsNDVI());
    document.querySelector('#vegetation-legend-low').textContent=wantsNDVI()?'-1':'0 m';document.querySelector('#vegetation-legend-high').textContent=wantsNDVI()?'+1':'25 m+';
    document.querySelector('#vegetation-legend-caption').textContent=wantsNDVI()?'8-bit colour ratio · grey = masked':'';
    note.textContent=!visible?'Other landscape layers remain available.':needsNDVI()?'Survey-date colour proxy · calibration unverified.':selected?.edge?'Near parish boundary · crown may be incomplete.':selected?.sparse?'Sparse crown · few occupied cells.':selected?.touching?'Touches adjoining crowns · boundary uncertain.':'Estimated crowns · adjoining trees may merge or split.';
    document.querySelector('#vegetation-map').textContent=!visible?'Map':wantsNDVI()?'NDVI map':'Height map';
    document.querySelector('#vegetation-map').setAttribute('aria-pressed',String(state.map));document.querySelector('#vegetation-3d').setAttribute('aria-pressed',String(!state.map));
    result.textContent=!visible?'Vegetation is hidden. Toggle it on to inspect trees.':selectionText()||(overviewOnly?'Tap a treetop · zoom in for detailed vegetation.':clusterMode?'Tap a crown for its height, area and proxy value.':state.map?'Tap vegetation to estimate height.':'Use Tree clusters to select a treetop in 3D.');
    launches.forEach(button=>button.setAttribute('aria-pressed',String(active)));
  }
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
  const program=gl.createProgram();
  gl.attachShader(program,shader(gl.VERTEX_SHADER,`
    precision highp float;
    attribute vec4 point;
    attribute float treeId;
    attribute float ndviValue;
    attribute float filterValue;
    uniform vec3 center;
    uniform vec2 rotation;
    uniform float span,aspect,exaggeration,size,minimum,clusterMode,selectedTree,spectralMode,filterEnabled;
    uniform vec2 ndviRange;
    uniform vec4 maskBounds;
    uniform float maskEnabled;
    varying vec3 color;
    vec3 crownColor(float id){
      float hue=fract(id*.61803398875);
      vec3 p=abs(fract(vec3(hue)+vec3(0.0,2.0/3.0,1.0/3.0))*6.0-3.0);
      return mix(vec3(1.0),clamp(p-1.0,0.0,1.0),.65)*.95;
    }
    void main(){
      vec2 p=point.xy-center.xy;float z=(point.z-center.z)*exaggeration;
      float right=p.x*cos(rotation.x)-p.y*sin(rotation.x);
      float forward=p.x*sin(rotation.x)+p.y*cos(rotation.x);
      float up=forward*sin(rotation.y)+z*cos(rotation.y);
      float depth=forward*cos(rotation.y)-z*sin(rotation.y);
      gl_Position=vec4(right*2.0/span/aspect,up*2.0/span,depth/40000.0,1.0);
      if(point.w<minimum||(filterEnabled>.5&&(filterValue< -1.0||filterValue<ndviRange.x-0.0000001||filterValue>ndviRange.y+0.0000001)))gl_Position=vec4(2.0,2.0,2.0,1.0);
      if(maskEnabled>.5&&point.x>=maskBounds.x&&point.x<maskBounds.z&&point.y>maskBounds.y&&point.y<=maskBounds.w)gl_Position=vec4(2.0,2.0,2.0,1.0);
      gl_PointSize=size;
      float h=clamp(point.w/25.0,0.0,1.0);
      color=h<.5?mix(vec3(.1,.48,.33),vec3(.47,.86,.37),h*2.0):mix(vec3(.47,.86,.37),vec3(1.0,.81,.3),(h-.5)*2.0);
      if(clusterMode>.5)color=treeId>.5?crownColor(treeId):vec3(.38,.42,.45);
      if(spectralMode>.5){
        color=ndviValue< -1.0?vec3(.42,.45,.48):ndviValue<0.0
          ?mix(vec3(.55,.32,.04),vec3(.96,.91,.76),ndviValue+1.0)
          :mix(vec3(.96,.91,.76),vec3(.0,.40,.37),ndviValue);
      }
      if(clusterMode>.5&&selectedTree>.5&&spectralMode<.5){
        if(abs(treeId-selectedTree)>.1)color*=.35;
        else color=vec3(1.0,.97,.72);
      }
    }`));
  gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`
    precision mediump float;
    varying vec3 color;
    void main(){
      if(distance(gl_PointCoord,vec2(.5))>.5)discard;
      gl_FragColor=vec4(color,1.0);
    }`));
  gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  const attribute=gl.getAttribLocation(program,'point'),treeAttribute=gl.getAttribLocation(program,'treeId'),ndviAttribute=gl.getAttribLocation(program,'ndviValue'),filterAttribute=gl.getAttribLocation(program,'filterValue'),uniforms={};
  for(const name of ['center','rotation','span','aspect','exaggeration','size','minimum','clusterMode','selectedTree','spectralMode','filterEnabled','ndviRange','maskBounds','maskEnabled'])uniforms[name]=gl.getUniformLocation(program,name);
  function upload(array){const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,array,gl.STATIC_DRAW);return buffer;}
  function project(x,y,z,state){const yaw=state.yaw*Math.PI/180,pitch=state.pitch*Math.PI/180,dx=x-state.x,dy=y-state.y,dz=(z-state.z)*state.exaggeration;return{x:canvas.clientWidth/2+(dx*Math.cos(yaw)-dy*Math.sin(yaw))*canvas.clientHeight/state.span,y:canvas.clientHeight/2-((dx*Math.sin(yaw)+dy*Math.cos(yaw))*Math.sin(pitch)+dz*Math.cos(pitch))*canvas.clientHeight/state.span};}
  function draw(buffer,count,state,step,size,mask){
    if(!count)return;const stride=28*step;
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    for(const [location,n,offset] of [[attribute,4,0],[treeAttribute,1,16],[ndviAttribute,1,20],[filterAttribute,1,clusterMode?24:20]]){gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,n,gl.FLOAT,false,stride,offset);}
    gl.uniform1f(uniforms.size,size);gl.uniform1f(uniforms.maskEnabled,mask?1:0);gl.uniform4f(uniforms.maskBounds,...(mask||[0,0,0,0]));
    gl.drawArrays(gl.POINTS,0,Math.ceil(count/step));
  }
  function tileVisible(tile,state){const dx=(tile.bounds[0]+tile.bounds[2])/2-state.x,dy=(tile.bounds[1]+tile.bounds[3])/2-state.y;const radius=Math.max(state.span,state.span*canvas.clientWidth/canvas.clientHeight)*(state.map ? .75 : 1)+200;return Math.abs(dx)<radius&&Math.abs(dy)<radius;}
  function render(){
    if(!active)return;
    const state=options.state();buildings.render(state);bridges.render(state);water.render(state);unclassified.render(state);if(vegetationToggle.checked)loader.update(state);updateUI(state);
    if(!vegetationToggle.checked||!loader.overview||!validFilter()){marker.hidden=true;return;}
    if(!overviewBuffer)overviewBuffer=upload(loader.overview.records);
    const ratio=canvas.width/canvas.clientWidth;const desiredTiles=loader.visible(state).filter(tile=>tileVisible(tile,state));let tiles=desiredTiles;
    for(const tile of tiles)if(!gpu.has(tile.id)&&!state.interacting)gpu.set(tile.id,{canopy:upload(tile.canopy),points:upload(tile.points)});
    tiles=tiles.filter(t=>gpu.has(t.id));
    const mask=loader.mask(state),readyMask=mask&&desiredTiles.every(t=>gpu.has(t.id))?mask:null;
    gl.useProgram(program);
    gl.uniform1f(uniforms.filterEnabled,ndviToggle.checked?1:0);const r=range();gl.uniform2f(uniforms.ndviRange,Number.isFinite(r.min)?r.min:-1,Number.isFinite(r.max)?r.max:1);
    gl.uniform1f(uniforms.spectralMode,wantsNDVI()?1:0);gl.uniform1f(uniforms.clusterMode,clusterMode?1:0);gl.uniform1f(uniforms.selectedTree,selected?.id||0);
    gl.uniform3f(uniforms.center,state.x,state.y,state.z);gl.uniform2f(uniforms.rotation,state.yaw*Math.PI/180,state.pitch*Math.PI/180);
    gl.uniform1f(uniforms.span,state.span);gl.uniform1f(uniforms.aspect,canvas.clientWidth/canvas.clientHeight);gl.uniform1f(uniforms.exaggeration,state.exaggeration);gl.uniform1f(uniforms.minimum,Number(heightSelect.value));
    draw(overviewBuffer,manifest.candidateCount,state,1,Math.max(1.5,1.6*ratio),readyMask);
    const total=tiles.reduce((n,t)=>n+(state.map?t.canopyCount:t.pointCount),0),budget=state.mobile?(state.interacting?130000:450000):800000,step=Math.max(1,Math.min(8,Math.ceil(total/budget)));
    for(const tile of tiles){const b=gpu.get(tile.id);draw(state.map?b.canopy:b.points,state.map?tile.canopyCount:tile.pointCount,state,step,state.map?Math.max(1.5,Math.min(30,1.45*canvas.height/state.span)):2.5*ratio,null);}
    for(const location of [attribute,treeAttribute,ndviAttribute,filterAttribute])gl.disableVertexAttribArray(location);
    marker.hidden=!selected;if(selected){const p=project(selected.x,selected.y,selected.z,state);marker.style.left=p.x+'px';marker.style.top=p.y+'px';marker.hidden=p.x<0||p.y<0||p.x>canvas.clientWidth||p.y>canvas.clientHeight;}
  }
  function pickOverview(event,state){
    const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top,radius=Math.max(10,state.span*canvas.clientWidth/canvas.clientHeight);
    const ids=loader.nearby(state.x,state.y,radius);let best=null,distance=18;
    for(const id of ids){const t=loader.tree(id);if(!treePasses(t))continue;const screen=project(t.x,t.y,t.z,state),d=Math.hypot(screen.x-x,screen.y-y);if(d<distance){distance=d;best=t;}}
    if(best)selectTree(best.id);else message='No matching treetop near this tap. Zoom in to inspect canopy.';
  }
  function tap(event){
    if(!active||!vegetationToggle.checked||!loader.overview)return false;clearSelection();if(!validFilter())return true;
    const state=options.state();
    if(!state.map){if(!clusterMode&&state.span<=1500)return false;pickOverview(event,state);schedule();return true;}
    const point=options.toWorld(event.clientX,event.clientY),radius=Math.max(1.5,Math.min(5,state.span/canvas.clientHeight*10)),tiles=loader.visible(state);
    const containing=tiles.find(t=>point.x>=t.bounds[0]&&point.x<t.bounds[2]&&point.y>t.bounds[1]&&point.y<=t.bounds[3]);
    if(!containing){pickOverview(event,state);schedule();return true;}
    let best=null,bestDistance=Infinity,bestHeight=-Infinity;
    for(const tile of tiles){
      if(point.x+radius<tile.bounds[0]||point.x-radius>=tile.bounds[2]||point.y+radius<=tile.bounds[1]||point.y-radius>tile.bounds[3])continue;
      const col=Math.floor(point.x-tile.bounds[0]),row=Math.floor(tile.bounds[3]-point.y),r=Math.ceil(radius)+1,a=tile.canopy;
      for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const c=col+dx,y=row+dy;if(c<0||c>=250||y<0||y>=250)continue;const i=tile.cells[y*250+c];if(i<0)continue;const p=i*7;if(!recordPasses(a,p)||(clusterMode&&!a[p+4]))continue;const distance=Math.hypot(a[p]-point.x,a[p+1]-point.y);if(distance>radius)continue;if((clusterMode&&distance<bestDistance)||(!clusterMode&&a[p+3]>bestHeight)){best={array:a,p};bestDistance=distance;bestHeight=a[p+3];}}
    }
    if(best){const a=best.array,p=best.p;if(clusterMode)selectTree(a[p+4]);else selected={x:a[p],y:a[p+1],z:a[p+2],h:a[p+3],median:a[p+5]<-1?null:a[p+5]};}
    else message='No vegetation matching these filters near this tap.';
    schedule();return true;
  }
  function setActive(value){active=value;buildings.setActive(active&&buildingToggle.checked);bridges.setActive(active&&bridgeToggle.checked);water.setActive(active&&waterToggle.checked);unclassified.setActive(active&&unclassifiedToggle.checked);panel.hidden=!active;marker.hidden=true;viewer.toggleAttribute('data-vegetation-active',active);launches.forEach(button=>button.setAttribute('aria-pressed',String(active)));if(active){clearSelection();options.enter();if(vegetationToggle.checked){loader.resume();loader.loadOverview().catch(()=>{});}else loader.pause();}else loader.pause();options.changed();schedule();}
  launches.forEach(button=>button.onclick=()=>setActive(!active));document.querySelector('#vegetation-exit').onclick=()=>setActive(false);
  document.querySelector('#vegetation-village').onclick=()=>{options.village();clearSelection();schedule();};
  document.querySelector('#vegetation-map').onclick=()=>{options.mode(true);schedule();};document.querySelector('#vegetation-3d').onclick=()=>{options.mode(false);schedule();};
  function filterChanged(){clearSelection();countKey='';schedule();}
  heightSelect.onchange=filterChanged;ndviToggle.onchange=filterChanged;ndviMin.oninput=filterChanged;ndviMax.oninput=filterChanged;
  colourSelect.onchange=schedule;clusterButton.onclick=()=>{clusterMode=!clusterMode;clearSelection();schedule();};document.querySelector('#vegetation-clear-tree').onclick=()=>{clearSelection();schedule();};
  vegetationToggle.onchange=()=>{clearSelection();if(active&&vegetationToggle.checked){loader.resume();loader.loadOverview().catch(()=>{});}else loader.pause();schedule();};
  buildingToggle.onchange=()=>{buildings.setActive(active&&buildingToggle.checked);schedule();};
  bridgeToggle.onchange=()=>{bridges.setActive(active&&bridgeToggle.checked);schedule();};
  document.querySelector('#vegetation-bridge-focus').disabled=!window.ALDEIA_PARISH_BRIDGES.focus;
  document.querySelector('#vegetation-bridge-focus').onclick=()=>{const point=window.ALDEIA_PARISH_BRIDGES.focus;if(!point)return;bridgeToggle.checked=true;bridges.setActive(active);clearSelection();options.focusStructure?.(point);schedule();};
  waterToggle.onchange=()=>{water.setActive(active&&waterToggle.checked);schedule();};
  document.querySelector('#vegetation-water-focus').disabled=!window.ALDEIA_PARISH_WATER.focus;
  document.querySelector('#vegetation-water-focus').onclick=()=>{const point=window.ALDEIA_PARISH_WATER.focus;if(!point)return;waterToggle.checked=true;water.setActive(active);clearSelection();options.focusStructure?.(point);schedule();};
  unclassifiedToggle.onchange=()=>{unclassified.setActive(active&&unclassifiedToggle.checked);schedule();};
  document.querySelector('#vegetation-unclassified-focus').disabled=!window.ALDEIA_PARISH_UNCLASSIFIED.focus;
  document.querySelector('#vegetation-unclassified-focus').onclick=()=>{const point=window.ALDEIA_PARISH_UNCLASSIFIED.focus;if(!point)return;unclassifiedToggle.checked=true;unclassified.setActive(active);clearSelection();options.focusStructure?.(point);schedule();};
  document.querySelector('#vegetation-retry').onclick=()=>{if(vegetationToggle.checked)loader.retry();if(buildingToggle.checked)buildings.retry();if(bridgeToggle.checked)bridges.retry();if(waterToggle.checked)water.retry();if(unclassifiedToggle.checked)unclassified.retry();};
  return{get active(){return active;},render,tap,deactivate(){if(active)setActive(false);},get diagnostics(){return {...loader.stats,buildings:buildings.diagnostics,bridges:bridges.diagnostics,water:water.diagnostics,unclassified:unclassified.diagnostics};}};
};
