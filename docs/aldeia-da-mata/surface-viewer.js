'use strict';

const terrainData = window.ALDEIA_TERRAIN;
const canvas = document.querySelector('#terrain');
const statusElement = document.querySelector('#status');
const gl = canvas.getContext('webgl', { alpha: false, antialias: true });

if (!terrainData || !gl) {
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
    float elevation(vec2 p) {
      vec4 texel = texture2D(heights,p);
      return zBase + (texel.r*255.0+texel.g*65280.0)*0.01;
    }
    void main() {
      terrainUV = uv;
      vec2 p = vec2(uv.x*extent.x,(1.0-uv.y)*extent.y)-center;
      float z = (elevation(uv)-zCenter)*exaggeration;
      float right = p.x*cos(rotation.x)-p.y*sin(rotation.x);
      float forward = p.x*sin(rotation.x)+p.y*cos(rotation.x);
      float up = forward*sin(rotation.y)+z*cos(rotation.y);
      float depth = forward*cos(rotation.y)-z*sin(rotation.y);
      gl_Position = vec4(right*2.0/span/aspect,up*2.0/span,depth/10000.0,1.0);
    }`;
  const fragmentSource = `
    precision highp float;
    uniform sampler2D heights;
    uniform vec2 texelSize;
    uniform vec2 elevationRange;
    uniform vec3 sunlight;
    uniform float zBase;
    uniform float exaggeration;
    uniform float palette;
    varying vec2 terrainUV;
    float readHeight(vec2 uv,float fallback) {
      vec4 texel=texture2D(heights,uv);
      if(texel.b<0.5)return fallback;
      return zBase+(texel.r*255.0+texel.g*65280.0)*0.01;
    }
    void main() {
      vec4 cell=texture2D(heights,terrainUV);
      if(cell.b<0.5)discard;
      float z=readHeight(terrainUV,0.0);
      float east=readHeight(terrainUV+vec2(texelSize.x,0.0),z);
      float west=readHeight(terrainUV-vec2(texelSize.x,0.0),z);
      float north=readHeight(terrainUV-vec2(0.0,texelSize.y),z);
      float south=readHeight(terrainUV+vec2(0.0,texelSize.y),z);
      // The distance between opposite neighbours is one metre.
      vec3 normal=normalize(vec3(-(east-west)*exaggeration,-(north-south)*exaggeration,1.0));
      float shade=0.25+0.75*max(dot(normal,sunlight),0.0);
      float h=clamp((z-elevationRange.x)/(elevationRange.y-elevationRange.x),0.0,1.0);
      vec3 color=mix(vec3(0.29,0.40,0.28),vec3(0.76,0.70,0.45),h);
      if(palette>0.5&&palette<1.5)color=vec3(0.9);
      if(palette>1.5)color=h<0.5
        ?mix(vec3(0.17,0.36,0.63),vec3(0.34,0.66,0.50),h*2.0)
        :mix(vec3(0.34,0.66,0.50),vec3(0.96,0.81,0.44),(h-0.5)*2.0);
      gl_FragColor=vec4(color*shade,1.0);
    }`;
  const program = gl.createProgram();
  gl.attachShader(program,compile(gl.VERTEX_SHADER,vertexSource));
  gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const uniforms = {};
  for (const name of ['heights','extent','center','zCenter','zBase','exaggeration','span','aspect','rotation','texelSize','elevationRange','sunlight','palette']) {
    uniforms[name]=gl.getUniformLocation(program,name);
  }
  const buffer=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  const uvAttribute=gl.getAttribLocation(program,'uv');
  gl.enableVertexAttribArray(uvAttribute);
  gl.vertexAttribPointer(uvAttribute,2,gl.FLOAT,false,8,0);
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.035,0.055,0.078,1);

  const patches=terrainData.patches.map(patch=>{
    const decoded=atob(patch.heights);
    const bytes=new Uint8Array(decoded.length);
    for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);
    return {...patch,values:new Uint16Array(bytes.buffer),heights:null};
  });
  const sum=patches.reduce((total,patch)=>total+patch.groundPoints,0);
  document.querySelector('#ground-count').textContent=(sum/1e6).toFixed(2)+' M';
  const view={index:0,map:false,x:0,y:0,yaw:25,pitch:55,span:700};
  let patch,texture,vertexCount;

  function resetView() {
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
    patch=patches[index];
    view.index=index;
    if(texture)gl.deleteTexture(texture);
    texture=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    const rgba=new Uint8Array(patch.values.length*4);
    for(let i=0;i<patch.values.length;i++) {
      const value=patch.values[i];
      rgba[i*4]=value&255;rgba[i*4+1]=value>>8;
      rgba[i*4+2]=value===65535?0:255;rgba[i*4+3]=255;
    }
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,patch.width,patch.height,0,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
    const vertices=[];
    const step=4;
    for(let row=0;row<patch.height-1;row+=step) {
      for(let col=0;col<patch.width-1;col+=step) {
        const right=Math.min(col+step,patch.width-1);
        const bottom=Math.min(row+step,patch.height-1);
        // Omit triangles touching a vertex without terrain support.
        const indices=[row*patch.width+col,row*patch.width+right,bottom*patch.width+col,bottom*patch.width+right];
        if(indices.some(i=>patch.values[i]===65535))continue;
        const a=[(col+.5)/patch.width,(row+.5)/patch.height];
        const b=[(right+.5)/patch.width,(row+.5)/patch.height];
        const c=[(col+.5)/patch.width,(bottom+.5)/patch.height];
        const d=[(right+.5)/patch.width,(bottom+.5)/patch.height];
        vertices.push(...a,...c,...b,...b,...c,...d);
      }
    }
    const mesh=new Float32Array(vertices);
    gl.bufferData(gl.ARRAY_BUFFER,mesh,gl.STATIC_DRAW);
    vertexCount=mesh.length/2;
    document.querySelectorAll('[data-patch]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.patch)===index)));
    document.querySelector('#patch-title').textContent=patch.title.toUpperCase();
    document.querySelector('#coverage-label').textContent=(patch.measuredFraction*100).toFixed(1)+'% cells directly measured';
    document.querySelector('#height-range').textContent=patch.zRange[0].toFixed(1)+'–'+patch.zRange[1].toFixed(1)+' m · Cascais datum';
    document.querySelector('#marker').textContent=index===0?'Village reference':'Anta do Tapadão · approx.';
    statusElement.textContent=patch.groundPoints.toLocaleString('en')+' detailed ground returns · '+(patch.validFraction*100).toFixed(1)+'% grid supported within 5 m of a measurement.';
    resetView();
  }
  function zoom(factor) {
    view.span=Math.max(25,Math.min(3000,view.span*factor));
    schedule();
  }
  function pan(dx,dy) {
    const units=view.span/canvas.clientHeight;
    const yaw=view.yaw*Math.PI/180;
    const groundY=dy*units/Math.sin(view.pitch*Math.PI/180);
    view.x-=dx*units*Math.cos(yaw)+groundY*Math.sin(yaw);
    view.y+=dx*units*Math.sin(yaw)-groundY*Math.cos(yaw);
    const width=patch.bounds[2]-patch.bounds[0],height=patch.bounds[3]-patch.bounds[1];
    view.x=Math.max(-width/2,Math.min(width*1.5,view.x));
    view.y=Math.max(-height/2,Math.min(height*1.5,view.y));
    schedule();
  }
  function setMode(map) {
    view.map=map;
    view.pitch=map?90:55;
    view.yaw=map?0:25;
    document.querySelector('#three').setAttribute('aria-pressed',String(!map));
    document.querySelector('#map-view').setAttribute('aria-pressed',String(map));
    schedule();
  }
  function updateMarker(exaggeration) {
    const x=patch.center[0]-patch.bounds[0]-view.x;
    const y=patch.center[1]-patch.bounds[1]-view.y;
    const col=Math.floor((patch.center[0]-patch.bounds[0])/.5);
    const row=Math.floor((patch.bounds[3]-patch.center[1])/.5);
    const value=patch.values[row*patch.width+col];
    const z=(patch.zBase+value*.01-(patch.zRange[0]+patch.zRange[1])/2)*exaggeration;
    const yaw=view.yaw*Math.PI/180,pitch=view.pitch*Math.PI/180;
    const right=x*Math.cos(yaw)-y*Math.sin(yaw);
    const up=(x*Math.sin(yaw)+y*Math.cos(yaw))*Math.sin(pitch)+z*Math.cos(pitch);
    const px=canvas.clientWidth/2+right*canvas.clientHeight/view.span;
    const py=canvas.clientHeight/2-up*canvas.clientHeight/view.span;
    const marker=document.querySelector('#marker');
    marker.style.display=value===65535||px<0||px>canvas.clientWidth||py<0||py>canvas.clientHeight?'none':'block';
    marker.style.left=px+'px';marker.style.top=py+'px';
  }
  function render() {
    const width=canvas.clientWidth,height=canvas.clientHeight;
    const ratio=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
    gl.viewport(0,0,canvas.width,canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    const exaggeration=Number(document.querySelector('#exaggeration').value);
    const azimuth=Number(document.querySelector('#azimuth').value)*Math.PI/180;
    const altitude=Number(document.querySelector('#altitude').value)*Math.PI/180;
    gl.uniform1i(uniforms.heights,0);
    gl.uniform2f(uniforms.extent,patch.bounds[2]-patch.bounds[0],patch.bounds[3]-patch.bounds[1]);
    gl.uniform2f(uniforms.center,view.x,view.y);
    gl.uniform1f(uniforms.zCenter,(patch.zRange[0]+patch.zRange[1])/2);
    gl.uniform1f(uniforms.zBase,patch.zBase);
    gl.uniform1f(uniforms.exaggeration,exaggeration);
    gl.uniform1f(uniforms.span,view.span);
    gl.uniform1f(uniforms.aspect,width/height);
    gl.uniform2f(uniforms.rotation,view.yaw*Math.PI/180,view.pitch*Math.PI/180);
    gl.uniform2f(uniforms.texelSize,1/patch.width,1/patch.height);
    gl.uniform2f(uniforms.elevationRange,...patch.zRange);
    gl.uniform3f(uniforms.sunlight,Math.sin(azimuth)*Math.cos(altitude),Math.cos(azimuth)*Math.cos(altitude),Math.sin(altitude));
    gl.uniform1f(uniforms.palette,['relief','gray','height'].indexOf(document.querySelector('#palette').value));
    gl.drawArrays(gl.TRIANGLES,0,vertexCount);
    document.querySelector('#azimuth-value').value=document.querySelector('#azimuth').value+'°';
    document.querySelector('#altitude-value').value=document.querySelector('#altitude').value+'°';
    document.querySelector('#exaggeration-value').value=exaggeration+'×';
    document.querySelector('#scene-info').textContent=(view.map?'SHADED MAP':'3D SURFACE')+' · view span '+Math.round(view.span)+' m';
    updateMarker(exaggeration);
  }
  let frame;
  function schedule() { cancelAnimationFrame(frame);frame=requestAnimationFrame(render); }

  document.querySelectorAll('[data-patch]').forEach(button=>button.onclick=()=>activatePatch(Number(button.dataset.patch)));
  document.querySelector('#three').onclick=()=>setMode(false);
  document.querySelector('#map-view').onclick=()=>setMode(true);
  document.querySelector('#reset').onclick=resetView;
  document.querySelector('#zoom-in').onclick=()=>zoom(.75);
  document.querySelector('#zoom-out').onclick=()=>zoom(1/.75);
  for(const id of ['azimuth','altitude','exaggeration'])document.querySelector('#'+id).oninput=schedule;
  document.querySelector('#palette').onchange=schedule;
  const pointers=new Map();
  canvas.oncontextmenu=event=>event.preventDefault();
  canvas.addEventListener('pointerdown',event=>{
    canvas.focus();canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  });
  canvas.addEventListener('pointermove',event=>{
    const previous=pointers.get(event.pointerId);
    if(!previous)return;
    const next={x:event.clientX,y:event.clientY};
    if(pointers.size===2) {
      const other=[...pointers.entries()].find(([id])=>id!==event.pointerId)[1];
      const before=Math.hypot(previous.x-other.x,previous.y-other.y);
      const after=Math.hypot(next.x-other.x,next.y-other.y);
      pan((next.x-previous.x)/2,(next.y-previous.y)/2);
      if(before>1&&after>1)zoom(before/after);
    } else if(view.map||event.shiftKey||event.buttons===2)pan(next.x-previous.x,next.y-previous.y);
    else {
      view.yaw+=(next.x-previous.x)*.35;
      view.pitch=Math.max(15,Math.min(85,view.pitch+(next.y-previous.y)*.25));
      schedule();
    }
    pointers.set(event.pointerId,next);
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,event=>pointers.delete(event.pointerId));
  canvas.addEventListener('wheel',event=>{
    event.preventDefault();zoom(Math.exp(Math.max(-100,Math.min(100,event.deltaY))*.002));
  },{passive:false});
  canvas.addEventListener('keydown',event=>{
    const actions={ArrowLeft:()=>pan(40,0),ArrowRight:()=>pan(-40,0),ArrowUp:()=>pan(0,-40),ArrowDown:()=>pan(0,40),'+':()=>zoom(.8),'=':()=>zoom(.8),'-':()=>zoom(1.25),Home:resetView};
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
  window.addEventListener('resize',schedule);
  canvas.addEventListener('webglcontextlost',event=>{
    event.preventDefault();statusElement.textContent='The graphics context was interrupted. Reload this page to restore the terrain.';
  });
  activatePatch(0);
}
