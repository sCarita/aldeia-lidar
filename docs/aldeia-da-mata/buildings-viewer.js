'use strict';
window.createBuildingViewer=function({gl,canvas,schedule,manifest=window.ALDEIA_PARISH_BUILDINGS,colour=[.64,.76,.91],label='Buildings'}){
 const gpu=new Map();let enabled=false,overviewBuffer=null;
 const loader=window.createBuildingLoader(manifest,{changed:schedule,evicted(t){const b=gpu.get(t.id);if(b){gl.deleteBuffer(b.roofs);gl.deleteBuffer(b.points);gpu.delete(t.id)}}});
 function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
 const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,`
 precision highp float;
 attribute vec4 point;
 uniform vec3 center;
 uniform vec2 rotation;
 uniform float span,aspect,exaggeration,size,maskEnabled;
 uniform vec4 maskBounds;
 varying mediump float tone;
 void main(){
  vec2 p=point.xy-center.xy;float z=(point.z-center.z)*exaggeration;
  float right=p.x*cos(rotation.x)-p.y*sin(rotation.x),forward=p.x*sin(rotation.x)+p.y*cos(rotation.x);
  float up=forward*sin(rotation.y)+z*cos(rotation.y),depth=forward*cos(rotation.y)-z*sin(rotation.y);
  gl_Position=vec4(right*2.0/span/aspect,up*2.0/span,depth/40000.0,1.0);
  if(maskEnabled>.5&&point.x>=maskBounds.x&&point.x<maskBounds.z&&point.y>maskBounds.y&&point.y<=maskBounds.w)gl_Position=vec4(2.0,2.0,2.0,1.0);
  gl_PointSize=size;tone=.86+.14*fract(point.z*.13);
 }`));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`
 precision mediump float;uniform vec3 structureColour;varying mediump float tone;void main(){gl_FragColor=vec4(structureColour*tone,1.0);}`));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 const attribute=gl.getAttribLocation(program,'point'),u={};for(const name of ['center','rotation','span','aspect','exaggeration','size','maskEnabled','maskBounds','structureColour'])u[name]=gl.getUniformLocation(program,name);
 function upload(a){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,a,gl.STATIC_DRAW);return b;}
 function draw(buffer,count,size,mask,step=1){if(!count)return;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,4,gl.FLOAT,false,16*step,0);gl.uniform1f(u.size,size);gl.uniform1f(u.maskEnabled,mask?1:0);gl.uniform4f(u.maskBounds,...(mask||[0,0,0,0]));gl.drawArrays(gl.POINTS,0,Math.ceil(count/step));}
 function render(state){if(!enabled)return;loader.update(state);if(!loader.overview)return;if(!overviewBuffer)overviewBuffer=upload(loader.overview);
  let tiles=loader.visible(state);for(const t of tiles)if(!gpu.has(t.id)&&!state.interacting)gpu.set(t.id,{roofs:upload(t.roofs),points:upload(t.points)});const ready=tiles.every(t=>gpu.has(t.id));tiles=tiles.filter(t=>gpu.has(t.id));
  gl.useProgram(program);gl.uniform3f(u.structureColour,...colour);gl.uniform3f(u.center,state.x,state.y,state.z);gl.uniform2f(u.rotation,state.yaw*Math.PI/180,state.pitch*Math.PI/180);gl.uniform1f(u.span,state.span);gl.uniform1f(u.aspect,canvas.clientWidth/canvas.clientHeight);gl.uniform1f(u.exaggeration,state.exaggeration);
  const ratio=canvas.width/canvas.clientWidth;draw(overviewBuffer,manifest.overviewCount,Math.max(1.5,Math.min(12,4*canvas.height/state.span)),ready?loader.mask(state):null);
  const total=tiles.reduce((n,t)=>n+(state.map?t.roofCount:t.pointCount),0),budget=state.mobile?(state.interacting?60000:200000):400000,step=Math.max(1,Math.min(12,Math.ceil(total/budget)));
  for(const t of tiles)draw(gpu.get(t.id)[state.map?'roofs':'points'],state.map?t.roofCount:t.pointCount,state.map?Math.max(1.5,Math.min(20,.65*canvas.height/state.span)):Math.max(1.5,2*ratio),null,step);
  gl.disableVertexAttribArray(attribute);
 }
 return{render,setActive(value){if(enabled===value)return;enabled=value;if(value){loader.resume();loader.loadOverview().catch(()=>{})}else loader.pause();schedule()},retry:()=>loader.retry(),status(state){if(!enabled)return'';if(loader.error)return loader.error;if(!loader.overview)return'Loading '+label.toLowerCase()+'…';const n=window.ParishVegetationUtils.focusWindow(state,manifest).ids.length;return state.span>1500?label+' overview':n?label+' '+loader.visible(state).length+'/'+n:'No classified '+label.toLowerCase()+' nearby'},get error(){return enabled?loader.error:''},get diagnostics(){return loader.stats}};
};
