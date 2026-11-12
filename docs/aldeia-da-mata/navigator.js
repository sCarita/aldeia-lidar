'use strict';

const dataset = window.ALDEIA_DATA;
const cloud = document.querySelector('#cloud');
const status = document.querySelector('#status');
const gl = cloud.getContext('webgl', { antialias: false, alpha: false });

if (!gl || !dataset || !window.ALDEIA_POINTS_BASE64) {
  status.textContent = 'This navigator needs WebGL and the two files in the data folder. Check that WebGL is enabled and the folder is complete.';
} else {
  initializeNavigator();
}

function initializeNavigator() {
  const decoded = atob(window.ALDEIA_POINTS_BASE64);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index++) bytes[index] = decoded.charCodeAt(index);
  const points = new Float32Array(bytes.buffer);
  window.ALDEIA_POINTS_BASE64 = null;

  function shader(type, source) {
    const result = gl.createShader(type);
    gl.shaderSource(result, source);
    gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(result));
    return result;
  }

  const program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, `
    attribute vec4 point;
    uniform vec3 center;
    uniform vec2 rotation;
    uniform vec2 viewport;
    uniform float span;
    uniform float pointSize;
    uniform float pixelRatio;
    uniform float layer;
    uniform float colourMode;
    uniform vec2 zRange;
    varying vec3 color;
    varying float enabled;
    void main() {
      vec3 position = point.xyz - center;
      float yaw = rotation.x;
      float pitch = rotation.y;
      float right = position.x*cos(yaw) - position.y*sin(yaw);
      float forward = position.x*sin(yaw) + position.y*cos(yaw);
      float up = forward*sin(pitch) + position.z*cos(pitch);
      float depth = forward*cos(pitch) - position.z*sin(pitch);
      gl_Position = vec4(right*2.0/span*viewport.y/viewport.x, up*2.0/span, depth/30000.0, 1.0);
      gl_PointSize = pointSize*pixelRatio;
      bool vegetation = point.w >= 3.0 && point.w <= 5.0;
      bool ground = point.w == 2.0;
      bool building = point.w == 6.0;
      enabled = float(layer == 0.0 || (layer == 1.0 && ground) ||
        (layer == 2.0 && vegetation) || (layer == 3.0 && building));
      float height = clamp((point.z-zRange.x)/(zRange.y-zRange.x),0.0,1.0);
      color = ground ? mix(vec3(0.55,0.39,0.19), vec3(0.91,0.76,0.44),height)
        : vegetation ? mix(vec3(0.20,0.40,0.22), vec3(0.56,0.81,0.40),height)
        : vec3(0.52,0.76,0.98);
      if (colourMode > 0.5) {
        color = height < 0.5 ? mix(vec3(0.18,0.37,0.69),vec3(0.25,0.78,0.64),height*2.0)
          : mix(vec3(0.25,0.78,0.64),vec3(0.98,0.80,0.36),(height-0.5)*2.0);
      }
    }`));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    varying vec3 color;
    varying float enabled;
    void main() {
      if (enabled < 0.5 || distance(gl_PointCoord,vec2(0.5)) > 0.5) discard;
      gl_FragColor = vec4(color,1.0);
    }`));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW);
  const attribute = gl.getAttribLocation(program, 'point');
  gl.enableVertexAttribArray(attribute);
  gl.vertexAttribPointer(attribute, 4, gl.FLOAT, false, 16, 0);
  const uniforms = {};
  for (const name of ['center','rotation','viewport','span','pointSize','pixelRatio','layer','colourMode','zRange']) {
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.035, 0.055, 0.078, 1);

  const [xmin, ymin, xmax, ymax] = dataset.bounds;
  const [zmin, zmax] = dataset.elevationRange;
  const view = { x:(xmin+xmax)/2, y:(ymin+ymax)/2, z:(zmin+zmax)/2, span:14000, yaw:0, pitch:55, layer:0 };
  const tileSelect = document.querySelector('#tile');
  for (const [index,tile] of dataset.tiles.entries()) {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = tile.filename.replace('_v01.laz','');
    tileSelect.appendChild(option);
  }

  function wholeParish() {
    view.x=(xmin+xmax)/2;
    view.y=(ymin+ymax)/2;
    view.yaw=0;
    view.pitch=55;
    const aspect=cloud.clientWidth/cloud.clientHeight;
    view.span=Math.max((xmax-xmin)/aspect,ymax-ymin)*1.25;
    document.querySelector('#tilt').value=view.pitch;
    tileSelect.value='';
    schedule();
  }
  function goToTile(index) {
    const tile=dataset.tiles[index];
    view.x=tile.x;
    view.y=tile.y;
    view.span=1600;
    tileSelect.value=index;
    schedule();
  }
  function zoom(factor) {
    view.span=Math.max(50,Math.min(40000,view.span*factor));
    schedule();
  }
  function pan(dx,dy) {
    const units=view.span/cloud.clientHeight;
    const groundY=dy*units/Math.sin(view.pitch*Math.PI/180);
    const yaw=view.yaw*Math.PI/180;
    view.x-=dx*units*Math.cos(yaw)+groundY*Math.sin(yaw);
    view.y+=dx*units*Math.sin(yaw)-groundY*Math.cos(yaw);
    // Keep the navigation target close to the bundled parish.
    view.x=Math.max(xmin-2000,Math.min(xmax+2000,view.x));
    view.y=Math.max(ymin-2000,Math.min(ymax+2000,view.y));
    schedule();
  }

  function paintMap(canvas, showTiles) {
    const width=canvas.clientWidth, height=canvas.clientHeight;
    const ratio=Math.min(devicePixelRatio || 1,2);
    canvas.width=Math.round(width*ratio);
    canvas.height=Math.round(height*ratio);
    const ctx=canvas.getContext('2d');
    ctx.scale(ratio,ratio);
    const scale=Math.min((width-28)/(xmax-xmin),(height-28)/(ymax-ymin));
    const offsetX=(width-(xmax-xmin)*scale)/2, offsetY=(height-(ymax-ymin)*scale)/2;
    function project(x,y) { return [offsetX+(x-xmin)*scale, offsetY+(ymax-y)*scale]; }
    ctx.beginPath();
    for (const polygon of dataset.projectedBoundary) {
      for (const ring of polygon) {
        ring.forEach(([x,y],index)=>{
          const [px,py]=project(x,y);
          if (!index) ctx.moveTo(px,py); else ctx.lineTo(px,py);
        });
        ctx.closePath();
      }
    }
    ctx.fillStyle='#174781';
    ctx.fill('evenodd');
    ctx.strokeStyle='#58a6ff';
    ctx.stroke();
    if (showTiles) {
      ctx.save();
      ctx.clip('evenodd');
      ctx.strokeStyle='#79c0ff66';
      for (const tile of dataset.tiles) {
        const [left,top]=project(tile.x-500,tile.y+500);
        ctx.strokeRect(left,top,1000*scale,1000*scale);
      }
      ctx.restore();
    }
    const [vx,vy]=project(...dataset.village);
    ctx.fillStyle='#e3b341';
    ctx.fillRect(vx-3,vy-3,6,6);
    if(showTiles) {
      ctx.fillStyle='#e6edf3';
      ctx.font='12px -apple-system, sans-serif';
      ctx.fillText('Aldeia da Mata',vx+9,vy-8);
    } else {
      const [cx,cy]=project(view.x,view.y);
      ctx.strokeStyle='#ffffff';
      ctx.beginPath();ctx.arc(cx,cy,5,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx-9,cy);ctx.lineTo(cx+9,cy);ctx.moveTo(cx,cy-9);ctx.lineTo(cx,cy+9);ctx.stroke();
    }
    canvas.mapToWorld=(clientX,clientY)=>{
      const bounds=canvas.getBoundingClientRect();
      return [xmin+(clientX-bounds.left-offsetX)/scale,ymax-(clientY-bounds.top-offsetY)/scale];
    };
  }

  function render() {
    const width=cloud.clientWidth,height=cloud.clientHeight;
    const ratio=Math.min(devicePixelRatio || 1,2);
    cloud.width=Math.round(width*ratio);cloud.height=Math.round(height*ratio);
    gl.viewport(0,0,cloud.width,cloud.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform3f(uniforms.center,view.x,view.y,view.z);
    gl.uniform2f(uniforms.rotation,view.yaw*Math.PI/180,view.pitch*Math.PI/180);
    gl.uniform2f(uniforms.viewport,width,height);
    gl.uniform1f(uniforms.span,view.span);
    gl.uniform1f(uniforms.pointSize,Number(document.querySelector('#size').value));
    gl.uniform1f(uniforms.pixelRatio,ratio);
    gl.uniform1f(uniforms.layer,view.layer);
    gl.uniform1f(uniforms.colourMode,document.querySelector('#colour').value==='elevation'?1:0);
    gl.uniform2f(uniforms.zRange,zmin,zmax);
    gl.drawArrays(gl.POINTS,0,dataset.pointCount);
    const counts=dataset.classCounts;
    const count=[dataset.pointCount,counts[2],counts[3]+counts[4]+counts[5],counts[6]][view.layer];
    document.querySelector('#visible-count').textContent=count.toLocaleString('en')+' points in selected layer';
    document.querySelector('#view-status').textContent='View span '+(view.span>=1000?(view.span/1000).toFixed(2)+' km':Math.round(view.span)+' m')+' · E '+Math.round(view.x)+' / N '+Math.round(view.y);
    document.querySelector('#tilt-label').value=Math.round(view.pitch)+'°';
    document.querySelector('#size-label').value=document.querySelector('#size').value;
    paintMap(document.querySelector('#mini'),false);
    paintMap(document.querySelector('#parish-map'),true);
  }
  let frame;
  function schedule() { cancelAnimationFrame(frame);frame=requestAnimationFrame(render); }

  document.querySelector('#overview').onclick=wholeParish;
  document.querySelector('#reset').onclick=wholeParish;
  document.querySelector('#village').onclick=()=>{
    [view.x,view.y]=dataset.village;
    view.span=1500;
    tileSelect.value='';
    schedule();
  };
  tileSelect.onchange=()=>{if(tileSelect.value!=='')goToTile(Number(tileSelect.value))};
  document.querySelector('#top').onclick=()=>{view.pitch=90;view.yaw=0;document.querySelector('#tilt').value=90;schedule()};
  document.querySelector('#perspective').onclick=()=>{view.pitch=55;document.querySelector('#tilt').value=55;schedule()};
  document.querySelector('#tilt').oninput=event=>{view.pitch=Number(event.target.value);schedule()};
  document.querySelector('#size').oninput=schedule;
  document.querySelector('#colour').onchange=schedule;
  document.querySelector('#zoom-in').onclick=()=>zoom(.7);
  document.querySelector('#zoom-out').onclick=()=>zoom(1/.7);
  document.querySelectorAll('[data-layer]').forEach(button=>button.onclick=()=>{
    view.layer=['all','ground','vegetation','buildings'].indexOf(button.dataset.layer);
    document.querySelectorAll('[data-layer]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));
    schedule();
  });
  for (const [id,selectTile] of [['#mini',false],['#parish-map',true]]) {
    const map=document.querySelector(id);
    map.onclick=event=>{
      const [x,y]=map.mapToWorld(event.clientX,event.clientY);
      if (selectTile) {
        const index=dataset.tiles.findIndex(tile=>Math.abs(tile.x-x)<=500&&Math.abs(tile.y-y)<=500);
        if(index<0)return;
        goToTile(index);
        document.querySelector('#viewer').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
      } else { view.x=x;view.y=y;schedule(); }
    };
  }

  const pointers=new Map();
  cloud.oncontextmenu=event=>event.preventDefault();
  cloud.addEventListener('pointerdown',event=>{
    cloud.focus();
    cloud.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  });
  cloud.addEventListener('pointermove',event=>{
    const previous=pointers.get(event.pointerId);
    if(!previous)return;
    const next={x:event.clientX,y:event.clientY};
    if(pointers.size===2) {
      const other=[...pointers.entries()].find(([id])=>id!==event.pointerId)[1];
      const before=Math.hypot(previous.x-other.x,previous.y-other.y);
      const after=Math.hypot(next.x-other.x,next.y-other.y);
      pan((next.x-previous.x)/2,(next.y-previous.y)/2);
      if(after>1&&before>1)zoom(before/after);
    } else if(event.shiftKey || event.buttons===2) {
      pan(next.x-previous.x,next.y-previous.y);
    } else {
      view.yaw+=(next.x-previous.x)*.35;
      view.pitch=Math.max(15,Math.min(90,view.pitch+(next.y-previous.y)*.25));
      document.querySelector('#tilt').value=view.pitch;
      schedule();
    }
    pointers.set(event.pointerId,next);
  });
  for (const name of ['pointerup','pointercancel','lostpointercapture']) {
    cloud.addEventListener(name,event=>pointers.delete(event.pointerId));
  }
  cloud.addEventListener('wheel',event=>{
    event.preventDefault();
    zoom(Math.exp(Math.max(-100,Math.min(100,event.deltaY))*.002));
  },{passive:false});
  cloud.addEventListener('keydown',event=>{
    const actions={
      ArrowLeft:()=>pan(50,0),ArrowRight:()=>pan(-50,0),
      ArrowUp:()=>pan(0,-50),ArrowDown:()=>pan(0,50),
      '+':()=>zoom(.8),'=':()=>zoom(.8),'-':()=>zoom(1.25),Home:wholeParish
    };
    if(actions[event.key]){event.preventDefault();actions[event.key]()}
  });
  document.querySelector('#fullscreen').onclick=async()=>{
    try {
      if(document.fullscreenElement)await document.exitFullscreen();
      else await document.querySelector('#viewer').requestFullscreen();
    } catch {
      status.textContent='Fullscreen is unavailable in this browser. The navigator is ready in the page.';
    }
  };
  document.addEventListener('fullscreenchange',()=>{
    document.querySelector('#fullscreen').textContent=document.fullscreenElement?'Exit fullscreen':'Fullscreen';
    schedule();
  });
  window.addEventListener('resize',schedule);
  cloud.addEventListener('webglcontextlost',event=>{
    event.preventDefault();status.textContent='The graphics context was interrupted. Reload this page to restore the cloud.';
  });
  wholeParish();
  status.textContent='Overview sample loaded locally · 60 source tiles · parish boundary clipping applied.';
}
