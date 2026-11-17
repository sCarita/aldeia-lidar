'use strict';

const terrainData = window.ALDEIA_TERRAIN;
const canvas = document.querySelector('#terrain');
const statusElement = document.querySelector('#status');
const gl = canvas.getContext('webgl', { alpha: false, antialias: true });

if (!terrainData || !window.ALDEIA_PARISH_TERRAIN || !window.ALDEIA_DATA || !gl) {
  statusElement.textContent = 'The surface viewer needs WebGL and data/terrain.js. Check that WebGL is enabled and the local folder is complete.';
} else {
  startSurfaceViewer();
}

function startSurfaceViewer() {
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  const vertexSource = `
    precision highp float;
    attribute vec2 uv;
    uniform sampler2D heights;
    uniform vec2 extent;
    uniform vec2 center;
    uniform float zCenter;
    uniform float zBase;
    uniform float exaggeration;
    uniform float span;
    uniform float aspect;
    uniform vec2 rotation;
    varying vec2 terrainUV;
    varying vec2 worldXY;
    uniform vec2 origin;
    float elevation(vec2 p) {
      vec4 texel = texture2D(heights,p);
      return zBase + (texel.r*255.0+texel.g*65280.0)*0.01;
    }
    void main() {
      terrainUV = uv;
      worldXY = vec2(uv.x*extent.x,(1.0-uv.y)*extent.y)+origin;
      vec2 p = vec2(uv.x*extent.x,(1.0-uv.y)*extent.y)-center;
      float z = (elevation(uv)-zCenter)*exaggeration;
      float right = p.x*cos(rotation.x)-p.y*sin(rotation.x);
      float forward = p.x*sin(rotation.x)+p.y*cos(rotation.x);
      float up = forward*sin(rotation.y)+z*cos(rotation.y);
      float depth = forward*cos(rotation.y)-z*sin(rotation.y);
      gl_Position = vec4(right*2.0/span/aspect,up*2.0/span,depth/40000.0,1.0);
    }`;
  const fragmentSource = `
    precision highp float;
    uniform sampler2D heights;
    uniform vec2 texelSize;
    uniform vec2 cellSize;
    uniform vec2 elevationRange;
    uniform vec3 sunlight;
    uniform float zBase;
    uniform float exaggeration;
    uniform float palette;
    varying vec2 terrainUV;
    varying vec2 worldXY;
    uniform vec4 focusBounds;
    uniform float maskFocus;
    uniform float aerialEnabled;
    uniform sampler2D aerialBase;
    uniform sampler2D aerialDetail;
    uniform vec4 aerialBaseBounds;
    uniform vec4 aerialDetailBounds;
    vec4 aerialSample(sampler2D image,vec4 bounds){
      vec2 p=vec2((worldXY.x-bounds.x)/(bounds.z-bounds.x),(bounds.w-worldXY.y)/(bounds.w-bounds.y));
      if(p.x<0.0||p.x>1.0||p.y<0.0||p.y>1.0)return vec4(0.0);
      return texture2D(image,p);
    }
    float readHeight(vec2 uv,float fallback) {
      vec4 texel=texture2D(heights,uv);
      if(texel.b<0.5)return fallback;
      return zBase+(texel.r*255.0+texel.g*65280.0)*0.01;
    }
    void main() {
      if(maskFocus>0.5 && worldXY.x>=focusBounds.x && worldXY.y>=focusBounds.y && worldXY.x<focusBounds.z && worldXY.y<focusBounds.w)discard;
      vec4 cell=texture2D(heights,terrainUV);
      if(cell.b<0.5)discard;
      float z=readHeight(terrainUV,0.0);
      float east=readHeight(terrainUV+vec2(texelSize.x,0.0),z);
      float west=readHeight(terrainUV-vec2(texelSize.x,0.0),z);
      float north=readHeight(terrainUV-vec2(0.0,texelSize.y),z);
      float south=readHeight(terrainUV+vec2(0.0,texelSize.y),z);
      vec3 normal=normalize(vec3(-(east-west)*exaggeration/(2.0*cellSize.x),-(north-south)*exaggeration/(2.0*cellSize.y),1.0));
      float shade=0.25+0.75*max(dot(normal,sunlight),0.0);
      float h=clamp((z-elevationRange.x)/(elevationRange.y-elevationRange.x),0.0,1.0);
      vec3 color=mix(vec3(0.29,0.40,0.28),vec3(0.76,0.70,0.45),h);
      if(palette>0.5&&palette<1.5)color=vec3(0.9);
      if(palette>1.5)color=h<0.5
        ?mix(vec3(0.17,0.36,0.63),vec3(0.34,0.66,0.50),h*2.0)
        :mix(vec3(0.34,0.66,0.50),vec3(0.96,0.81,0.44),(h-0.5)*2.0);
      if(aerialEnabled>0.5){
        vec4 photo=aerialSample(aerialDetail,aerialDetailBounds);
        if(photo.a<0.5)photo=aerialSample(aerialBase,aerialBaseBounds);
        if(photo.a>0.5){gl_FragColor=vec4(photo.rgb*(0.82+0.18*max(dot(normal,sunlight),0.0)),1.0);return;}
      }
      gl_FragColor=vec4(color*shade,1.0);
    }`;
  const program = gl.createProgram();
  gl.attachShader(program,compile(gl.VERTEX_SHADER,vertexSource));
  gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const uniforms = {};
  for (const name of ['heights','extent','center','zCenter','zBase','exaggeration','span','aspect','rotation','texelSize','cellSize','elevationRange','sunlight','palette','origin','focusBounds','maskFocus','aerialEnabled','aerialBase','aerialDetail','aerialBaseBounds','aerialDetailBounds']) {
    uniforms[name]=gl.getUniformLocation(program,name);
  }
  const buffer=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  const uvAttribute=gl.getAttribLocation(program,'uv');
  gl.enableVertexAttribArray(uvAttribute);
  gl.vertexAttribPointer(uvAttribute,2,gl.FLOAT,false,8,0);
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.035,0.055,0.078,1);

  const patches=[...terrainData.patches,window.ALDEIA_PARISH_TERRAIN].map(patch=>{
    const decoded=atob(patch.heights);
    const bytes=new Uint8Array(decoded.length);
    for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);
    patch.heights=null;
    return {...patch,values:new Uint16Array(bytes.buffer)};
  });
  const mobileLayout=window.matchMedia('(max-width: 800px), (pointer: coarse)');
  const pointers=new Map();
  let gestureMode='pan';
  let comparison=null;
  let vegetation=null,aerial=null,archaeology=null;
  const aerialDrape=window.createAerialDrape(gl);
  let fittedView=true;
  const view={index:2,map:mobileLayout.matches,x:0,y:0,yaw:25,pitch:55,span:12000};
  const locations=[
    {center:patches[0].center,label:'Village · open detail',index:0,marker:document.querySelector('#marker-village')},
    {center:patches[1].center,label:'Tapadão · open detail',index:1,marker:document.querySelector('#marker-tapadao')}
  ];
  let patch,texture,vertexCount;
  const meshCache=new Map();
  const maximumDetail=window.ALDEIA_MAX_DETAIL;
  const detailLoader=maximumDetail && window.createTerrainDetailLoader ? window.createTerrainDetailLoader(maximumDetail) : null;
  let focus=null,focusTexture=null,focusBuffer=null,focusVertexCount=0;
  let detailTimer=null,detailGeneration=0,lastDetailKey='';
  let detailState='Zoom in for 0.5 m terrain';


  function createMesh(surface) {
    const step=Math.max(1,Math.round(surface.meshResolution/surface.resolution));
    const vertices=new Float32Array(Math.ceil((surface.width-1)/step)*Math.ceil((surface.height-1)/step)*12);
    let cursor=0;
    for(let row=0;row<surface.height-1;row+=step) {
      for(let col=0;col<surface.width-1;col+=step) {
        const right=Math.min(col+step,surface.width-1);
        const bottom=Math.min(row+step,surface.height-1);
        const indices=[row*surface.width+col,row*surface.width+right,bottom*surface.width+col,bottom*surface.width+right];
        if(indices.some(i=>surface.values[i]===65535))continue;
        for(const [x,y] of [[col,row],[col,bottom],[right,row],[right,row],[col,bottom],[right,bottom]]) {
          vertices[cursor++]=(x+.5)/surface.width;
          vertices[cursor++]=(y+.5)/surface.height;
        }
      }
    }
    return vertices.slice(0,cursor);
  }
  function resetView() {
    if(!canvas.clientWidth||!canvas.clientHeight)return;
    fittedView=true;
    view.x=(patch.bounds[2]-patch.bounds[0])/2;
    view.y=(patch.bounds[3]-patch.bounds[1])/2;
    view.yaw=view.map?0:25;
    view.pitch=view.map?90:55;
    const width=patch.bounds[2]-patch.bounds[0];
    const height=patch.bounds[3]-patch.bounds[1];
    view.span=Math.max(width/(canvas.clientWidth/canvas.clientHeight),height)*1.25;
    schedule();
  }
  function activatePatch(index) {
    if((vegetation?.active||aerial?.active)&&index!==2){
      const destination=patches[index];activatePatch(2);
      view.x=destination.center[0]-patch.bounds[0];view.y=destination.center[1]-patch.bounds[1];
      view.span=Math.max((destination.bounds[2]-destination.bounds[0])*canvas.clientHeight/canvas.clientWidth,destination.bounds[3]-destination.bounds[1])*1.25;
      fittedView=false;schedule();return;
    }
    detailGeneration++;
    clearTimeout(detailTimer);
    lastDetailKey='';
    focus=null;
    if(focusTexture)gl.deleteTexture(focusTexture);
    if(focusBuffer)gl.deleteBuffer(focusBuffer);
    focusTexture=null;focusBuffer=null;
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.vertexAttribPointer(uvAttribute,2,gl.FLOAT,false,8,0);
    patch=patches[index];
    view.index=index;
    if(texture)gl.deleteTexture(texture);
    texture=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    const maximumSize=gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const reduction=Math.ceil(Math.max(patch.width,patch.height)/maximumSize);
    if(reduction>1) {
      const width=Math.ceil(patch.width/reduction),height=Math.ceil(patch.height/reduction);
      const values=new Uint16Array(width*height);
      for(let row=0;row<height;row++)for(let col=0;col<width;col++) {
        values[row*width+col]=patch.values[Math.min(row*reduction,patch.height-1)*patch.width+Math.min(col*reduction,patch.width-1)];
      }
      patch={...patch,width,height,values,resolution:patch.resolution*reduction};
    }
    const rgba=new Uint8Array(patch.values.length*4);
    for(let i=0;i<patch.values.length;i++) {
      const value=patch.values[i];
      rgba[i*4]=value&255;rgba[i*4+1]=value>>8;
      rgba[i*4+2]=value===65535?0:255;rgba[i*4+3]=255;
    }
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,patch.width,patch.height,0,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
    let mesh=meshCache.get(index);
    if(!mesh) {
      mesh=createMesh(patch);
      meshCache.set(index,mesh);
    }
    gl.bufferData(gl.ARRAY_BUFFER,mesh,gl.STATIC_DRAW);
    vertexCount=mesh.length/2;
    document.querySelectorAll('[data-patch]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.patch)===index)));
    document.querySelector('#patch-title').textContent=patch.title.toUpperCase();
    document.querySelector('#coverage-label').textContent=(patch.measuredFraction*100).toFixed(1)+'% cells directly measured';
    document.querySelector('#height-range').textContent=patch.zRange[0].toFixed(1)+'–'+patch.zRange[1].toFixed(1)+' m · Cascais datum';
    document.querySelector('#ground-count').textContent=(patch.groundPoints/1e6).toFixed(2)+' M';
    document.querySelector('#grid-resolution').textContent=patch.resolution+' m';
    document.querySelector('#mesh-resolution').textContent=Math.max(patch.meshResolution,patch.resolution)+' m';
    statusElement.textContent=patch.groundPoints.toLocaleString('en')+' ground returns in selected view · '+(patch.validFraction*100).toFixed(1)+'% supported within '+(patch.maxGapDistance||5)+' m of a measurement.';
    resetView();
  }
  function terrainHeight(x,y) {
    if(focus && useDetail()) {
      const globalX=x+patch.bounds[0],globalY=y+patch.bounds[1];
      const col=Math.floor((globalX-focus.bounds[0])/.5);
      const row=Math.floor((focus.bounds[3]-globalY)/.5);
      if(col>=0&&col<focus.width&&row>=0&&row<focus.height) {
        const value=focus.values[row*focus.width+col];
        if(value!==65535)return focus.zBase+value*.01;
      }
    }
    const col=Math.floor(x/(patch.bounds[2]-patch.bounds[0])*patch.width);
    const row=Math.floor((1-y/(patch.bounds[3]-patch.bounds[1]))*patch.height);
    const middle=(patch.zRange[0]+patch.zRange[1])/2;
    if(col<0||col>=patch.width||row<0||row>=patch.height)return middle;
    const value=patch.values[row*patch.width+col];
    return value===65535?middle:patch.zBase+value*.01;
  }
  function cameraElevation(){
    return view.map?(patch.zRange[0]+patch.zRange[1])/2:terrainHeight(view.x,view.y);
  }
  function screenToGround(clientX,clientY) {
    const rect=canvas.getBoundingClientRect(),yaw=view.yaw*Math.PI/180,pitch=view.pitch*Math.PI/180;
    const right=(clientX-rect.left-rect.width/2)*view.span/rect.height;
    const up=(rect.height/2-clientY+rect.top)*view.span/rect.height;
    const middle=cameraElevation();
    const exaggeration=Number(document.querySelector('#exaggeration').value);
    let x=view.x,y=view.y,z=0;
    for(let i=0;i<3;i++) {
      const forward=(up-z*Math.cos(pitch))/Math.sin(pitch);
      x=view.x+right*Math.cos(yaw)+forward*Math.sin(yaw);
      y=view.y-right*Math.sin(yaw)+forward*Math.cos(yaw);
      z=(terrainHeight(x,y)-middle)*exaggeration;
    }
    return {x,y};
  }
  function constrainCenter() {
    const width=patch.bounds[2]-patch.bounds[0],height=patch.bounds[3]-patch.bounds[1];
    view.x=Math.max(-width/2,Math.min(width*1.5,view.x));
    view.y=Math.max(-height/2,Math.min(height*1.5,view.y));
  }
  function zoom(factor,clientX,clientY) {
    fittedView=false;
    const anchored=clientX!==undefined;
    const before=anchored?screenToGround(clientX,clientY):null;
    const maximum=Math.max(patch.bounds[2]-patch.bounds[0],patch.bounds[3]-patch.bounds[1])*2.5;
    view.span=Math.max(25,Math.min(maximum,view.span*factor));
    if(anchored) {
      const after=screenToGround(clientX,clientY);
      view.x+=before.x-after.x;view.y+=before.y-after.y;
      constrainCenter();
    }
    schedule();
  }
  function pan(dx,dy) {
    fittedView=false;
    const yaw=view.yaw*Math.PI/180,units=view.span/canvas.clientHeight;
    const north=dy*units/Math.sin(view.pitch*Math.PI/180);
    view.x-=dx*units*Math.cos(yaw)-north*Math.sin(yaw);
    view.y+=dx*units*Math.sin(yaw)+north*Math.cos(yaw);
    constrainCenter();
    schedule();
  }
  function setMode(map) {
    if(!map&&comparison?.active)comparison.deactivate();
    aerial?.cameraMode(map);
    view.map=map;
    view.pitch=map?90:55;
    view.yaw=map?0:25;
    document.querySelector('#three').setAttribute('aria-pressed',String(!map));
    document.querySelector('#map-view').setAttribute('aria-pressed',String(map));
    if(map)gestureMode='pan';
    updateMobileControls();
    schedule();
  }
  function updateNavigation(exaggeration) {
    const markerPositions=[];
    const yaw=view.yaw*Math.PI/180,pitch=view.pitch*Math.PI/180;
    for(const location of locations) {
      const localX=location.center[0]-patch.bounds[0],localY=location.center[1]-patch.bounds[1];
      const x=localX-view.x,y=localY-view.y;
      const z=(terrainHeight(localX,localY)-cameraElevation())*exaggeration;
      const right=x*Math.cos(yaw)-y*Math.sin(yaw);
      const up=(x*Math.sin(yaw)+y*Math.cos(yaw))*Math.sin(pitch)+z*Math.cos(pitch);
      const px=canvas.clientWidth/2+right*canvas.clientHeight/view.span;
      const py=canvas.clientHeight/2-up*canvas.clientHeight/view.span;
      const inPatch=localX>=0&&localY>=0&&localX<=patch.bounds[2]-patch.bounds[0]&&localY<=patch.bounds[3]-patch.bounds[1];
      location.marker.style.display=!document.querySelector('#show-markers').checked||!inPatch||px<0||px>canvas.clientWidth||py<0||py>canvas.clientHeight?'none':'block';
      location.marker.style.left=px+'px';location.marker.style.top=py+'px';
      markerPositions.push({x:px,y:py,visible:location.marker.style.display!=='none'});
    }
    const cluster=document.querySelector('#location-cluster');
    const clustered=mobileLayout.matches&&markerPositions.every(point=>point.visible)&&
      Math.abs(markerPositions[0].x-markerPositions[1].x)<110&&Math.abs(markerPositions[0].y-markerPositions[1].y)<70;
    cluster.style.display=clustered?'block':'none';
    if(clustered) {
      for(const location of locations)location.marker.style.display='none';
      cluster.style.left=((markerPositions[0].x+markerPositions[1].x)/2)+'px';
      cluster.style.top=((markerPositions[0].y+markerPositions[1].y)/2)+'px';
    }
    document.querySelector('#compass-needle').style.transform='rotate('+(-view.yaw)+'deg)';
    const target=100*view.span/canvas.clientHeight;
    const order=10**Math.floor(Math.log10(target));
    const scale=[1,2,5,10].map(value=>value*order).filter(value=>value<=target).pop()||order;
    document.querySelector('#scale-line').style.width=(scale*canvas.clientHeight/view.span)+'px';
    document.querySelector('#scale-label').textContent=scale>=1000?(scale/1000)+' km':scale+' m';
    const mini=document.querySelector('#navigation-map');
    const width=mini.clientWidth,height=mini.clientHeight,ratio=Math.min(devicePixelRatio||1,2);
    if(!width||!height)return;
    const pixelWidth=Math.round(width*ratio),pixelHeight=Math.round(height*ratio);
    if(mini.width!==pixelWidth||mini.height!==pixelHeight){mini.width=pixelWidth;mini.height=pixelHeight;}
    const ctx=mini.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);
    ctx.clearRect(0,0,width,height);
    const [xmin,ymin,xmax,ymax]=window.ALDEIA_DATA.bounds;
    const mapScale=Math.min((width-20)/(xmax-xmin),(height-20)/(ymax-ymin));
    const offsetX=(width-(xmax-xmin)*mapScale)/2,offsetY=(height-(ymax-ymin)*mapScale)/2;
    const project=(x,y)=>[offsetX+(x-xmin)*mapScale,offsetY+(ymax-y)*mapScale];
    ctx.beginPath();
    for(const polygon of window.ALDEIA_DATA.projectedBoundary)for(const ring of polygon) {
      ring.forEach(([x,y],index)=>{const point=project(x,y);if(index)ctx.lineTo(...point);else ctx.moveTo(...point)});
      ctx.closePath();
    }
    ctx.fillStyle='#174781';ctx.fill('evenodd');ctx.strokeStyle='#58a6ff';ctx.stroke();
    for(const detail of patches.slice(0,2)) {
      const [x,y]=project(detail.bounds[0],detail.bounds[3]);
      ctx.fillStyle='#e3b34155';ctx.strokeStyle='#e3b341';
      ctx.fillRect(x,y,(detail.bounds[2]-detail.bounds[0])*mapScale,(detail.bounds[3]-detail.bounds[1])*mapScale);
      ctx.strokeRect(x,y,(detail.bounds[2]-detail.bounds[0])*mapScale,(detail.bounds[3]-detail.bounds[1])*mapScale);
    }
    const centerX=patch.bounds[0]+view.x,centerY=patch.bounds[1]+view.y;
    ctx.beginPath();
    const halfWidth=view.span*canvas.clientWidth/canvas.clientHeight/2,halfHeight=view.span/Math.sin(pitch)/2;
    for(const [index,[right,forward]] of [[-halfWidth,-halfHeight],[halfWidth,-halfHeight],[halfWidth,halfHeight],[-halfWidth,halfHeight]].entries()) {
      const x=centerX+right*Math.cos(yaw)+forward*Math.sin(yaw);
      const y=centerY-right*Math.sin(yaw)+forward*Math.cos(yaw);
      if(index)ctx.lineTo(...project(x,y));else ctx.moveTo(...project(x,y));
    }
    ctx.closePath();ctx.strokeStyle='#ffffff';ctx.stroke();
    const [cx,cy]=project(centerX,centerY);
    ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(cx,cy,3,0,Math.PI*2);ctx.fill();
    mini.mapToWorld=(clientX,clientY)=>{
      const rect=mini.getBoundingClientRect();
      return [xmin+(clientX-rect.left-offsetX)/mapScale,ymax-(clientY-rect.top-offsetY)/mapScale];
    };
  }
  function useDetail() {
    const quality=document.querySelector('#quality').value;
    return detailLoader && quality!=='overview' && (quality==='maximum'||view.span<=1500);
  }
  function requestDetail() {
    if(pointers.size>0) {
      clearTimeout(detailTimer);
      if(lastDetailKey){detailGeneration++;lastDetailKey='';}
      detailState='Navigating…';
      return;
    }
    if(!useDetail()) {
      detailState=detailLoader?'Zoom in for 0.5 m terrain':'Maximum-detail data is unavailable';
      clearTimeout(detailTimer);
      if(lastDetailKey) { detailGeneration++;lastDetailKey=''; }
      return;
    }
    const centerX=patch.bounds[0]+view.x,centerY=patch.bounds[1]+view.y;
    const aspect=canvas.clientWidth/canvas.clientHeight;
    const half=Math.min(375,Math.max(100,view.span*Math.max(aspect,1/Math.sin(view.pitch*Math.PI/180))*.65));
    const bounds=[Math.floor((centerX-half)/250)*250,Math.floor((centerY-half)/250)*250,Math.ceil((centerX+half)/250)*250,Math.ceil((centerY+half)/250)*250];
    const meshResolution=view.span<200?.5:view.span<700?1:2;
    const key=bounds.join(',')+'|'+meshResolution;
    if(key===lastDetailKey)return;
    clearTimeout(detailTimer);
    lastDetailKey=key;
    const generation=++detailGeneration;
    detailState='Loading 0.5 m terrain…';
    detailTimer=setTimeout(async()=>{
      try {
        const loaded=await detailLoader.loadWindow(bounds,meshResolution);
        if(generation!==detailGeneration||!useDetail())return;
        if(pointers.size){lastDetailKey='';return;}
        if(focusTexture)gl.deleteTexture(focusTexture);
        if(focusBuffer)gl.deleteBuffer(focusBuffer);
        focus=null;focusTexture=null;focusBuffer=null;
        if(!loaded.validCells) {
          detailState='No prepared terrain at this location';
          schedule();return;
        }
        focus=loaded;
        focusTexture=gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D,focusTexture);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        const rgba=new Uint8Array(focus.values.length*4);
        for(let i=0;i<focus.values.length;i++) {
          const value=focus.values[i];
          rgba[i*4]=value&255;rgba[i*4+1]=value>>8;
          rgba[i*4+2]=value===65535?0:255;rgba[i*4+3]=255;
        }
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,focus.width,focus.height,0,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
        const mesh=createMesh(focus);
        focusBuffer=gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER,focusBuffer);
        gl.bufferData(gl.ARRAY_BUFFER,mesh,gl.STATIC_DRAW);
        focusVertexCount=mesh.length/2;
        detailState='0.5 m terrain · '+meshResolution+' m mesh';
        schedule();
      } catch(error) {
        if(generation!==detailGeneration)return;
        detailState='Detail loading failed. Use Retry detail.';
        document.querySelector('#detail-error').textContent=error.message;
        document.querySelector('#retry-detail').hidden=false;
        schedule();
      }
    },180);
  }
  function drawSurface(surface,surfaceTexture,surfaceBuffer,count,maskFocus) {
    gl.useProgram(program);gl.enableVertexAttribArray(uvAttribute);
    const width=canvas.clientWidth,height=canvas.clientHeight;
    const exaggeration=Number(document.querySelector('#exaggeration').value);
    const azimuth=Number(document.querySelector('#azimuth').value)*Math.PI/180;
    const altitude=Number(document.querySelector('#altitude').value)*Math.PI/180;
    aerialDrape.bind(uniforms,aerial?.draped);
    gl.bindTexture(gl.TEXTURE_2D,surfaceTexture);
    gl.bindBuffer(gl.ARRAY_BUFFER,surfaceBuffer);
    gl.vertexAttribPointer(uvAttribute,2,gl.FLOAT,false,8,0);
    gl.uniform1i(uniforms.heights,0);
    gl.uniform2f(uniforms.origin,surface.bounds[0],surface.bounds[1]);
    gl.uniform2f(uniforms.extent,surface.bounds[2]-surface.bounds[0],surface.bounds[3]-surface.bounds[1]);
    gl.uniform2f(uniforms.center,patch.bounds[0]+view.x-surface.bounds[0],patch.bounds[1]+view.y-surface.bounds[1]);
    gl.uniform1f(uniforms.zCenter,cameraElevation());
    gl.uniform1f(uniforms.zBase,surface.zBase);
    gl.uniform1f(uniforms.exaggeration,exaggeration);
    gl.uniform1f(uniforms.span,view.span);
    gl.uniform1f(uniforms.aspect,width/height);
    gl.uniform2f(uniforms.rotation,view.yaw*Math.PI/180,view.pitch*Math.PI/180);
    gl.uniform2f(uniforms.texelSize,1/surface.width,1/surface.height);
    gl.uniform2f(uniforms.cellSize,(surface.bounds[2]-surface.bounds[0])/surface.width,(surface.bounds[3]-surface.bounds[1])/surface.height);
    gl.uniform2f(uniforms.elevationRange,...patch.zRange);
    gl.uniform3f(uniforms.sunlight,Math.sin(azimuth)*Math.cos(altitude),Math.cos(azimuth)*Math.cos(altitude),Math.sin(altitude));
    gl.uniform1f(uniforms.palette,['relief','gray','height'].indexOf(document.querySelector('#palette').value));
    gl.uniform1f(uniforms.maskFocus,maskFocus?1:0);
    gl.uniform4f(uniforms.focusBounds,...(focus?focus.bounds:[0,0,0,0]));
    gl.drawArrays(gl.TRIANGLES,0,count);
  }
  function render() {
    const width=canvas.clientWidth,height=canvas.clientHeight;
    if(!width||!height)return;
    const limit=mobileLayout.matches?(pointers.size?1:1.5):2;
    const ratio=Math.min(devicePixelRatio||1,limit);
    const pixelWidth=Math.round(width*ratio),pixelHeight=Math.round(height*ratio);
    if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){canvas.width=pixelWidth;canvas.height=pixelHeight;}
    gl.viewport(0,0,canvas.width,canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    const exaggeration=Number(document.querySelector('#exaggeration').value);
    const showFocus=useDetail() && focus;
    // Update tile selection before drawing; uploads are paused throughout gestures.
    aerial?.render();
    if(aerial?.draped)aerialDrape.prepare(aerial.imagery,pointers.size>0);
    drawSurface(patch,texture,buffer,vertexCount,showFocus);
    if(showFocus)drawSurface(focus,focusTexture,focusBuffer,focusVertexCount,false);
    vegetation?.render();
    requestDetail();
    document.querySelector('#detail-status').textContent=detailState;
    document.querySelector('#mobile-detail-status').textContent=detailState;
    document.querySelector('#ground-count').textContent=((showFocus?focus.groundPoints:patch.groundPoints)/1e6).toFixed(2)+' M';
    document.querySelector('#ground-count-label').textContent=showFocus?'Ground returns in focus tiles':'Ground returns in base view';
    document.querySelector('#coverage-label').textContent=showFocus?'0.5 m focus loaded':(patch.measuredFraction*100).toFixed(1)+'% base cells directly measured';
    document.querySelector('#grid-resolution').textContent=showFocus?'0.5 m':patch.resolution+' m';
    document.querySelector('#mesh-resolution').textContent=showFocus?focus.meshResolution+' m':Math.max(patch.meshResolution,patch.resolution)+' m';
    document.querySelector('#azimuth-value').value=document.querySelector('#azimuth').value+'°';
    document.querySelector('#altitude-value').value=document.querySelector('#altitude').value+'°';
    document.querySelector('#exaggeration-value').value=exaggeration+'×';
    const gridLabel=showFocus?'0.5 m detail'+(patch.resolution!==.5?' / '+patch.resolution+' m context':''):patch.resolution+' m grid';
    document.querySelector('#scene-info').textContent=(view.map?'SHADED MAP':'3D SURFACE')+' · '+gridLabel+' · span '+Math.round(view.span)+' m · E '+Math.round(patch.bounds[0]+view.x)+' / N '+Math.round(patch.bounds[1]+view.y);
    updateNavigation(exaggeration);
    archaeology?.render();
    comparison?.render();
  }
  let frame;
  function schedule() { cancelAnimationFrame(frame);frame=requestAnimationFrame(render); }

  document.querySelectorAll('[data-patch]').forEach(button=>button.onclick=()=>activatePatch(Number(button.dataset.patch)));
  document.querySelector('#three').onclick=()=>setMode(false);
  document.querySelector('#map-view').onclick=()=>setMode(true);
  document.querySelector('#reset').onclick=resetView;
  document.querySelector('#parish-home').onclick=()=>activatePatch(2);
  document.querySelector('#fit-overlay').onclick=()=>activatePatch(2);
  document.querySelector('#north-up').onclick=()=>{fittedView=false;view.yaw=0;schedule()};
  for(const location of locations)location.marker.onclick=()=>activatePatch(location.index);
  document.querySelector('#navigation-map').onclick=event=>{
    const [x,y]=event.currentTarget.mapToWorld(event.clientX,event.clientY);
    const parish=patches[2];
    const col=Math.floor((x-parish.bounds[0])/parish.resolution);
    const row=Math.floor((parish.bounds[3]-y)/parish.resolution);
    if(col<0||col>=parish.width||row<0||row>=parish.height||parish.values[row*parish.width+col]===65535)return;
    if(view.index!==2)activatePatch(2);
    view.x=x-patch.bounds[0];view.y=y-patch.bounds[1];
    view.span=Math.min(view.span,2500);
    fittedView=false;
    constrainCenter();closeSheet();schedule();
  };
  function focusAt(clientX,clientY) {
    const target=screenToGround(clientX,clientY);
    view.x=target.x;view.y=target.y;
    zoom(.5);constrainCenter();schedule();
  }
  canvas.addEventListener('dblclick',event=>{
    if(!mobileLayout.matches&&!comparison?.active&&!vegetation?.active)focusAt(event.clientX,event.clientY);
  });
  document.querySelector('#zoom-in').onclick=()=>zoom(.75);
  document.querySelector('#zoom-out').onclick=()=>zoom(1/.75);
  for(const id of ['azimuth','altitude','exaggeration'])document.querySelector('#'+id).oninput=schedule;
  document.querySelector('#palette').onchange=schedule;
  function retryDetail() {
    detailGeneration++;
    lastDetailKey='';
    document.querySelector('#detail-error').textContent='';
    document.querySelector('#retry-detail').hidden=true;
    schedule();
  }
  document.querySelector('#quality').onchange=retryDetail;
  document.querySelector('#show-markers').onchange=schedule;
  document.querySelector('#retry-detail').onclick=retryDetail;
  let lastTap=null;
  canvas.oncontextmenu=event=>event.preventDefault();
  canvas.addEventListener('pointerdown',event=>{
    event.preventDefault();
    canvas.focus({preventScroll:true});
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId,{
      x:event.clientX,y:event.clientY,
      startX:event.clientX,startY:event.clientY,
      started:performance.now(),multi:false
    });
    if(pointers.size>1) {
      lastTap=null;
      comparison?.cancelDrag();
      for(const pointer of pointers.values())pointer.multi=true;
    } else comparison?.pointerDown(event);
    schedule();
  });
  canvas.addEventListener('pointermove',event=>{
    const previous=pointers.get(event.pointerId);
    if(!previous)return;
    event.preventDefault();
    const next={...previous,x:event.clientX,y:event.clientY};
    if(pointers.size===1&&comparison?.pointerMove(event)){pointers.set(event.pointerId,next);return;}
    if(pointers.size===2) {
      const other=[...pointers.entries()].find(([id])=>id!==event.pointerId)[1];
      const before=Math.hypot(previous.x-other.x,previous.y-other.y);
      const after=Math.hypot(next.x-other.x,next.y-other.y);
      pan((next.x-previous.x)/2,(next.y-previous.y)/2);
      if(before>12&&after>12)zoom(Math.max(.8,Math.min(1.25,before/after)),(next.x+other.x)/2,(next.y+other.y)/2);
    } else if(view.map||event.shiftKey||event.buttons===2||(mobileLayout.matches&&gestureMode==='pan')) {
      pan(next.x-previous.x,next.y-previous.y);
    } else {
      fittedView=false;
      view.yaw+=(next.x-previous.x)*.25;
      view.pitch=Math.max(20,Math.min(85,view.pitch+(next.y-previous.y)*.18));
      schedule();
    }
    if(Math.hypot(next.x-next.startX,next.y-next.startY)>8)lastTap=null;
    pointers.set(event.pointerId,next);
  });
  function finishPointer(event) {
    const pointer=pointers.get(event.pointerId);
    if(!pointer)return;
    pointers.delete(event.pointerId);
    const now=performance.now();
    const shortTap=event.type==='pointerup'&&!pointer.multi&&
      now-pointer.started<300&&Math.hypot(event.clientX-pointer.startX,event.clientY-pointer.startY)<8;
    const handled=comparison?.pointerUp(event)||(shortTap&&(comparison?.tap(event)||vegetation?.tap(event)));
    if(handled){lastTap=null;schedule();return;}
    const tapped=shortTap&&event.pointerType==='touch';
    if(tapped) {
      if(lastTap&&now-lastTap.time<320&&Math.hypot(event.clientX-lastTap.x,event.clientY-lastTap.y)<28) {
        focusAt(event.clientX,event.clientY);lastTap=null;
      } else lastTap={x:event.clientX,y:event.clientY,time:now};
    }
    schedule();
  }
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,finishPointer);
  canvas.addEventListener('wheel',event=>{
    event.preventDefault();zoom(Math.exp(Math.max(-100,Math.min(100,event.deltaY))*.002),event.clientX,event.clientY);
  },{passive:false});
  canvas.addEventListener('keydown',event=>{
    if(comparison?.keyDown(event))return;
    const actions={ArrowLeft:()=>pan(40,0),ArrowRight:()=>pan(-40,0),ArrowUp:()=>pan(0,40),ArrowDown:()=>pan(0,-40),'+':()=>zoom(.8),'=':()=>zoom(.8),'-':()=>zoom(1.25),Home:()=>activatePatch(2),q:()=>{view.yaw-=10;schedule()},e:()=>{view.yaw+=10;schedule()}};
    if(actions[event.key]){event.preventDefault();actions[event.key]()}
  });
  document.querySelector('#fullscreen').onclick=async()=>{
    try {
      if(document.fullscreenElement)await document.exitFullscreen();
      else await document.querySelector('#viewer').requestFullscreen();
    } catch { statusElement.textContent='Fullscreen is unavailable in this browser. The surface is ready in the page.'; }
  };
  document.addEventListener('fullscreenchange',()=>{
    document.querySelector('#fullscreen').textContent=document.fullscreenElement?'Exit fullscreen':'Fullscreen';schedule();
  });
  window.addEventListener('resize',()=>{
    if(fittedView)resetView();else schedule();
  });
  canvas.addEventListener('webglcontextlost',event=>{
    event.preventDefault();statusElement.textContent='The graphics context was interrupted. Reload this page to restore the terrain.';
  });
  const viewer=document.querySelector('#viewer');
  const settings=document.querySelector('#settings-sheet');
  const places=document.querySelector('#places-sheet');
  const locationControls=document.querySelector('#location-controls');
  const originalLocationParent=locationControls.parentElement;
  const originalLocationNext=locationControls.nextSibling;
  const backdrop=document.querySelector('#sheet-backdrop');
  let activeSheet=null,previousFocus=null;

  function updateMobileControls() {
    document.querySelector('#move-mode').setAttribute('aria-pressed',String(gestureMode==='pan'));
    document.querySelector('#rotate-mode').setAttribute('aria-pressed',String(gestureMode==='orbit'));
    document.querySelector('#mobile-gesture-hint').textContent=gestureMode==='pan'
      ?'Drag to move · pinch to zoom':'Drag to rotate · pinch to zoom';
  }
  function closeSheet() {
    activeSheet=null;
    viewer.removeAttribute('data-sheet');
    places.hidden=true;
    backdrop.hidden=true;
    settings.removeAttribute('role');
    settings.removeAttribute('aria-modal');
    places.removeAttribute('aria-modal');
    document.querySelector('#open-places').setAttribute('aria-expanded','false');
    document.querySelector('#open-settings').setAttribute('aria-expanded','false');
    if(previousFocus && document.contains(previousFocus))previousFocus.focus({preventScroll:true});
    previousFocus=null;
    schedule();
  }
  function openSheet(name) {
    if(activeSheet===name){closeSheet();return;}
    previousFocus=document.activeElement;
    activeSheet=name;
    viewer.dataset.sheet=name;
    places.hidden=name!=='places';
    backdrop.hidden=false;
    document.querySelector('#open-places').setAttribute('aria-expanded',String(name==='places'));
    document.querySelector('#open-settings').setAttribute('aria-expanded',String(name==='settings'));
    const panel=name==='places'?places:settings;
    panel.setAttribute('role','dialog');
    panel.setAttribute('aria-modal','true');
    panel.querySelector('[data-close-sheet]').focus({preventScroll:true});
    schedule();
  }
  function synchronizeMobileLayout() {
    closeSheet();
    if(mobileLayout.matches)places.appendChild(locationControls);
    else {
      document.body.classList.remove('reading-docs');
      originalLocationParent.insertBefore(locationControls,originalLocationNext);
    }
    updateMobileControls();
    if(fittedView)resetView();else schedule();
  }
  document.querySelector('#open-places').onclick=()=>openSheet('places');
  document.querySelector('#location-cluster').onclick=()=>openSheet('places');
  document.querySelector('#open-settings').onclick=()=>openSheet('settings');
  document.querySelectorAll('[data-close-sheet]').forEach(button=>button.onclick=closeSheet);
  backdrop.onclick=closeSheet;
  document.querySelectorAll('[data-mobile-patch]').forEach(button=>button.onclick=()=>{
    activatePatch(Number(button.dataset.mobilePatch));closeSheet();
  });
  document.querySelector('#move-mode').onclick=()=>{gestureMode='pan';comparison?.setPan();updateMobileControls();closeSheet()};
  document.querySelector('#rotate-mode').onclick=()=>{
    gestureMode='orbit';
    if(view.map)setMode(false);
    updateMobileControls();closeSheet();
  };
  document.querySelector('#about-data').onclick=()=>{
    closeSheet();document.body.classList.add('reading-docs');window.scrollTo(0,0);
  };
  document.querySelector('#return-to-map').onclick=()=>{
    document.body.classList.remove('reading-docs');
    if(fittedView)resetView();else schedule();
  };
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&activeSheet){event.preventDefault();closeSheet();return;}
    if(event.key!=='Tab'||!activeSheet)return;
    const panel=activeSheet==='places'?places:settings;
    const controls=[...panel.querySelectorAll('button,input,select,a[href]')].filter(element=>element.getClientRects().length&&!element.disabled);
    const first=controls[0],last=controls[controls.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  mobileLayout.addEventListener('change',synchronizeMobileLayout);
  comparison=window.createLandComparison({
    canvas,schedule,
    enterMap(){aerial?.deactivate();vegetation?.deactivate();setMode(true);closeSheet();},
    changed(){
      updateMobileControls();
      if(fittedView)resetView();else schedule();
    },
    cameraCenter(){return {x:patch.bounds[0]+view.x,y:patch.bounds[1]+view.y};},
    toWorld(clientX,clientY){
      const point=screenToGround(clientX,clientY);
      return {x:point.x+patch.bounds[0],y:point.y+patch.bounds[1]};
    },
    toScreen(point){
      const rect=canvas.getBoundingClientRect(),yaw=view.yaw*Math.PI/180;
      const x=point.x-patch.bounds[0]-view.x,y=point.y-patch.bounds[1]-view.y;
      return {
        x:rect.left+rect.width/2+(x*Math.cos(yaw)-y*Math.sin(yaw))*rect.height/view.span,
        y:rect.top+rect.height/2-(x*Math.sin(yaw)+y*Math.cos(yaw))*rect.height/view.span
      };
    },
    fit(points){
      const xmin=Math.min(...points.map(point=>point.x)),xmax=Math.max(...points.map(point=>point.x));
      const ymin=Math.min(...points.map(point=>point.y)),ymax=Math.max(...points.map(point=>point.y));
      activatePatch(2);
      view.x=(xmin+xmax)/2-patch.bounds[0];view.y=(ymin+ymax)/2-patch.bounds[1];
      view.span=Math.max(50,(xmax-xmin)/(canvas.clientWidth/canvas.clientHeight),ymax-ymin)*1.5;
      fittedView=false;schedule();
    }
  });
  function focusVegetationVillage(){
    activatePatch(2);
    view.x=patches[0].center[0]-patch.bounds[0];
    view.y=patches[0].center[1]-patch.bounds[1];
    view.span=Math.max(250,650*canvas.clientHeight/canvas.clientWidth);
    fittedView=false;schedule();
  }
  vegetation=window.createVegetationViewer({
    gl,canvas,schedule,
    state(){return {x:patch.bounds[0]+view.x,y:patch.bounds[1]+view.y,z:cameraElevation(),
      yaw:view.yaw,pitch:view.pitch,span:view.span,map:view.map,interacting:pointers.size>0,mobile:mobileLayout.matches,exaggeration:Number(document.querySelector('#exaggeration').value)};},
    toWorld(clientX,clientY){const p=screenToGround(clientX,clientY);return{x:p.x+patch.bounds[0],y:p.y+patch.bounds[1]};},
    enter(){
      aerial?.deactivate();comparison?.deactivate();
      if(view.index!==2){const x=patch.bounds[0]+view.x,y=patch.bounds[1]+view.y,span=view.span;activatePatch(2);view.x=x-patch.bounds[0];view.y=y-patch.bounds[1];view.span=span;fittedView=false;}
      setMode(true);closeSheet();
    },
    changed(){if(fittedView)resetView();else schedule();},
    village(){focusVegetationVillage();},
    focusStructure(point){
      if(view.index!==2)activatePatch(2);
      view.x=point[0]-patch.bounds[0];view.y=point[1]-patch.bounds[1];
      view.span=Math.max(200,300*canvas.clientHeight/canvas.clientWidth);
      fittedView=false;schedule();
    },
    mode(map){setMode(map);}
  });
  aerial=window.createAerialComparison({canvas,schedule,boundary:window.ALDEIA_DATA.projectedBoundary,
    state(){return{x:patch.bounds[0]+view.x,y:patch.bounds[1]+view.y,yaw:view.yaw,span:view.span,pitch:view.pitch,map:view.map,interacting:pointers.size>0,mobile:mobileLayout.matches};},
    enter(map){
      vegetation?.deactivate();comparison?.deactivate();
      if(view.index!==2){const x=patch.bounds[0]+view.x,y=patch.bounds[1]+view.y,span=view.span;activatePatch(2);view.x=x-patch.bounds[0];view.y=y-patch.bounds[1];view.span=span;fittedView=false;}
      setMode(map);closeSheet();
    },
    mode(map){setMode(map);},
    changed(){updateMobileControls();if(fittedView)resetView();else schedule();},
    village(){focusVegetationVillage();},parish(){activatePatch(2);resetView();}
  });
  archaeology=window.createArchaeologyOverlay({canvas,schedule,
    state(){return{x:patch.bounds[0]+view.x,y:patch.bounds[1]+view.y,z:cameraElevation(),yaw:view.yaw,pitch:view.pitch,span:view.span,exaggeration:Number(document.querySelector('#exaggeration').value)};},
    elevation(x,y){return terrainHeight(x-patch.bounds[0],y-patch.bounds[1]);},
    focus(x,y,span){if(view.index!==2)activatePatch(2);view.x=x-patch.bounds[0];view.y=y-patch.bounds[1];view.span=span;fittedView=false;constrainCenter();closeSheet();schedule();}
  });
  activatePatch(2);
  synchronizeMobileLayout();
  setMode(view.map);
}
