'use strict';
(function(root){
 function project(x,y,z,state,width,height){const a=state.yaw*Math.PI/180,p=state.pitch*Math.PI/180,dx=x-state.x,dy=y-state.y;return{x:width/2+(dx*Math.cos(a)-dy*Math.sin(a))*height/state.span,y:height/2-((dx*Math.sin(a)+dy*Math.cos(a))*Math.sin(p)+(z-state.z)*(state.exaggeration||1)*Math.cos(p))*height/state.span};}
 function cluster(points,radius=36){const groups=[];for(const point of points){const nearby=groups.filter(g=>g.some(p=>Math.hypot(point.x-p.x,point.y-p.y)<radius));if(!nearby.length)groups.push([point]);else{const merged=[point,...nearby.flat()];for(const g of nearby)groups.splice(groups.indexOf(g),1);groups.push(merged);}}return groups;}
 if(typeof module!=='undefined'&&module.exports){module.exports={project,cluster};return;}
 root.createArchaeologyOverlay=function(options){
  const data=root.ALDEIA_ARCHAEOLOGY;if(!data)return{render(){}};
  const records=data.records,layer=document.querySelector('#archaeology-markers'),panel=document.querySelector('#archaeology-panel'),launch=document.querySelector('#archaeology-launch'),toggle=document.querySelector('#archaeology-visible'),select=document.querySelector('#archaeology-record'),focus=document.querySelector('#archaeology-focus');let selected=records.find(r=>r.cns===761)||records[0],open=false;const buttons=[];
  for(const r of records){const option=document.createElement('option');option.value=r.cns;option.textContent=r.name+' · CNS '+r.cns+(!r.position?' · no map point':'');select.appendChild(option);}
  const mapped=records.filter(r=>r.position).length;document.querySelector('#archaeology-count').textContent=mapped+' mapped · '+(records.length-mapped)+' without map location · '+data.checked.slice(0,10);
  function details(record){selected=record;select.value=String(record.cns);document.querySelector('#archaeology-name').textContent=record.name;document.querySelector('#archaeology-description').textContent='CNS '+record.cns+' · '+record.type+' · '+record.period;document.querySelector('#archaeology-position').textContent=record.position?'Published inventory reference point · not a site boundary.':'No public map location. This entry is listed without an inferred marker.';document.querySelector('#archaeology-source').href=record.url;focus.disabled=!record.position;options.schedule();}
  function show(value){open=value;panel.hidden=!value;launch.setAttribute('aria-expanded',String(value));if(value)details(selected);options.schedule();}
  launch.onclick=()=>show(!open);document.querySelector('#archaeology-close').onclick=()=>show(false);toggle.onchange=()=>options.schedule();select.onchange=()=>details(records.find(r=>String(r.cns)===select.value));focus.onclick=()=>{if(selected.position){options.focus(...selected.position,450);show(false)}};
  function button(i){if(!buttons[i]){const b=document.createElement('button');b.type='button';b.className='archaeology-marker';layer.appendChild(b);buttons.push(b);}return buttons[i];}
  function render(){
   buttons.forEach(b=>b.hidden=true);layer.hidden=!toggle.checked;options.canvas.parentElement.toggleAttribute('data-archaeology-visible',toggle.checked);if(!toggle.checked)return;
   const state=options.state(),width=options.canvas.clientWidth,height=options.canvas.clientHeight;if(!width||!height)return;
   const points=records.filter(r=>r.position).map(r=>({...project(...r.position,options.elevation(...r.position),state,width,height),record:r})).filter(p=>p.x>=-12&&p.x<=width+12&&p.y>=-12&&p.y<=height+12);
   cluster(points).forEach((group,i)=>{const b=button(i),x=group.reduce((s,p)=>s+p.x,0)/group.length,y=group.reduce((s,p)=>s+p.y,0)/group.length;b.hidden=false;b.style.left=x+'px';b.style.top=y+'px';b.textContent=group.length>1?String(group.length):'◇';b.setAttribute('aria-label',group.length>1?group.length+' archaeological records: '+group.map(p=>p.record.name).join(', '):group[0].record.name+' · CNS '+group[0].record.cns);b.title=group.map(p=>p.record.name+' · CNS '+p.record.cns).join('\n');b.classList.toggle('selected',open&&group.some(p=>p.record===selected));b.onclick=()=>{if(group.length===1){details(group[0].record);show(true);}else{const xs=group.map(p=>p.record.position[0]),ys=group.map(p=>p.record.position[1]);options.focus((Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2,Math.max(300,(Math.max(...xs)-Math.min(...xs))*height/width*2,(Math.max(...ys)-Math.min(...ys))*2));}};});
  }
  details(selected);return{render};
 };
})(typeof window!=='undefined'?window:this);
