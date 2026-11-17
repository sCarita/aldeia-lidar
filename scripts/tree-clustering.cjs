'use strict';
// Deterministic, height-aware seeded crown growing on measured canopy cells.
// Inputs are x, y, elevation, height-above-ground float tuples. No gaps are filled.
function clusterTrees(canopy,bounds,width,height,overrides={}){
  const settings={minimumHeight:2,minimumPeak:3,minimumCells:4,smoothingRadius:1,peakRadius:2,minimumSeparation:3,maximumSeparation:6,maximumRadius:12,...overrides};
  const n=width*height,raw=new Float32Array(n),smooth=new Float32Array(n),indices=new Int32Array(n);indices.fill(-1);
  for(let i=0;i<canopy.length;i+=4){const col=Math.floor(canopy[i]-bounds[0]),row=Math.floor(bounds[3]-canopy[i+1]);if(col>=0&&col<width&&row>=0&&row<height){const cell=row*width+col;raw[cell]=canopy[i+3];indices[cell]=i;}}
  const valid=[];
  for(let cell=0;cell<n;cell++){
    if(raw[cell]<settings.minimumHeight)continue;
    valid.push(cell);const row=Math.floor(cell/width),col=cell%width;let sum=0,weight=0;
    for(let dy=-settings.smoothingRadius;dy<=settings.smoothingRadius;dy++)for(let dx=-settings.smoothingRadius;dx<=settings.smoothingRadius;dx++){
      const x=col+dx,y=row+dy;if(x<0||x>=width||y<0||y>=height)continue;
      const h=raw[y*width+x];if(h<settings.minimumHeight)continue;
      const w=1/(1+dx*dx+dy*dy);sum+=h*w;weight+=w;
    }
    smooth[cell]=sum/weight;
  }
  const maxima=[];
  for(const cell of valid){
    if(smooth[cell]<settings.minimumPeak)continue;
    const row=Math.floor(cell/width),col=cell%width;let peak=true;
    for(let dy=-settings.peakRadius;dy<=settings.peakRadius&&peak;dy++)for(let dx=-settings.peakRadius;dx<=settings.peakRadius;dx++){
      if(dx*dx+dy*dy>settings.peakRadius**2)continue;
      const x=col+dx,y=row+dy;if(x<0||x>=width||y<0||y>=height)continue;
      const other=y*width+x;
      if(smooth[other]>smooth[cell]+1e-5||(Math.abs(smooth[other]-smooth[cell])<=1e-5&&other<cell)){peak=false;break;}
    }
    if(peak)maxima.push(cell);
  }
  maxima.sort((a,b)=>smooth[b]-smooth[a]||a-b);
  const seeds=[],buckets=new Map(),bucketSize=settings.maximumSeparation;
  for(const cell of maxima){
    const x=cell%width,y=Math.floor(cell/width),bx=Math.floor(x/bucketSize),by=Math.floor(y/bucketSize);
    const separation=Math.max(settings.minimumSeparation,Math.min(settings.maximumSeparation,1+smooth[cell]*.18));let blocked=false;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)for(const seed of buckets.get(`${bx+dx},${by+dy}`)||[]){
      // A lower crown can have its own peak if the horizontal separation supports it.
      if(Math.hypot(x-seed.x,y-seed.y)<Math.min(separation,seed.separation))blocked=true;
    }
    if(blocked)continue;
    const seed={id:seeds.length+1,cell,x,y,h:smooth[cell],separation,radius:Math.min(settings.maximumRadius,2+smooth[cell]*.45)};
    seeds.push(seed);const key=`${bx},${by}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(seed);
  }
  if(seeds.length>65534)throw Error('Too many crown seeds for uint16 labels');
  // Maximum-priority flood. A path loses priority at height drops and long edges.
  const heap=[];
  function push(item){let i=heap.length;heap.push(item);while(i){const p=(i-1)>>1;if(heap[p].score>=item.score)break;heap[i]=heap[p];i=p;}heap[i]=item;}
  function pop(){const top=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1].score>heap[child].score)child++;if(heap[child].score<=last.score)break;heap[i]=heap[child];i=child;}heap[i]=last;}return top;}
  const labels=new Uint16Array(n);
  for(const seed of seeds){labels[seed.cell]=seed.id;push({cell:seed.cell,id:seed.id,score:seed.h,seed:true});}
  while(heap.length){
    const entry=pop();
    if(!entry.seed){if(labels[entry.cell])continue;labels[entry.cell]=entry.id;}
    const seed=seeds[entry.id-1],row=Math.floor(entry.cell/width),col=entry.cell%width;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      if(!dx&&!dy)continue;const x=col+dx,y=row+dy;if(x<0||x>=width||y<0||y>=height)continue;
      const cell=y*width+x;if(labels[cell]||raw[cell]<settings.minimumHeight)continue;
      if(Math.hypot(x-seed.x,y-seed.y)>seed.radius)continue;
      if(smooth[cell]<Math.max(settings.minimumHeight,seed.h*.15)||smooth[cell]>seed.h*1.35)continue;
      const jump=Math.abs(smooth[cell]-smooth[entry.cell]);
      if(jump>Math.max(3,seed.h*.4))continue;
      push({cell,id:entry.id,score:Math.min(entry.score,smooth[cell])-.05*Math.hypot(dx,dy)-.1*jump});
    }
  }
  const groups=seeds.map(seed=>({seed,cells:[],peak:-1,x:0,y:0,edge:false}));
  for(const cell of valid){const id=labels[cell];if(!id)continue;const g=groups[id-1],i=indices[cell];g.cells.push(cell);g.x+=canopy[i];g.y+=canopy[i+1];if(g.peak<0||canopy[i+3]>canopy[g.peak+3])g.peak=i;if(cell%width===0||cell%width===width-1||cell<width||cell>=n-width)g.edge=true;}
  const catalog=[],remap=new Uint16Array(seeds.length+1);
  for(const g of groups){
    if(g.cells.length<settings.minimumCells)continue;
    const id=catalog.length+1;remap[g.seed.id]=id;const i=g.peak;
    catalog.push({id,x:canopy[i],y:canopy[i+1],z:canopy[i+2],height:canopy[i+3],center:[g.x/g.cells.length,g.y/g.cells.length],area:g.cells.length,cells:g.cells.length,edge:g.edge,touching:false,sparse:g.cells.length<8});
  }
  for(let cell=0;cell<n;cell++)labels[cell]=remap[labels[cell]];
  for(const cell of valid){const id=labels[cell];if(!id)continue;const row=Math.floor(cell/width),col=cell%width;for(const [dx,dy] of [[1,0],[0,1]]){if(col+dx>=width||row+dy>=height)continue;const other=labels[cell+dy*width+dx];if(other&&other!==id){catalog[id-1].touching=true;catalog[other-1].touching=true;}}}
  const canopyLabels=new Uint16Array(canopy.length/4);
  for(let i=0;i<canopy.length;i+=4){const col=Math.floor(canopy[i]-bounds[0]),row=Math.floor(bounds[3]-canopy[i+1]);if(col>=0&&col<width&&row>=0&&row<height)canopyLabels[i/4]=labels[row*width+col];}
  return{catalog,canopyLabels,labels,settings};
}
function labelPoints(points,clustering,bounds,width,height){
  const result=new Uint16Array(points.length/4);
  for(let i=0;i<points.length;i+=4){const col=Math.floor(points[i]-bounds[0]),row=Math.floor(bounds[3]-points[i+1]);if(points[i+3]<clustering.settings.minimumHeight||col<0||col>=width||row<0||row>=height)continue;const id=clustering.labels[row*width+col];if(id&&points[i+3]<=clustering.catalog[id-1].height+.01)result[i/4]=id;}
  return result;
}
module.exports={clusterTrees,labelPoints};
