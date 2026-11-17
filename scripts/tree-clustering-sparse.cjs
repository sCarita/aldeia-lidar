'use strict';
// Parish-scale variant of tree-clustering.cjs. One global segmentation precedes tiling.
// A dense integer lookup supports neighbourhood queries; measured values stay sparse.
function clusterSparse(canopy,bounds,width,height,progress=()=>{}){
  const count=canopy.length/4,index=new Int32Array(width*height);index.fill(-1);
  const smooth=new Float32Array(count),labels=new Uint32Array(count),best=new Float32Array(count);best.fill(-Infinity);
  const valid=new Uint32Array(count);let validCount=0;
  for(let i=0;i<count;i++){
    const col=Math.floor(canopy[i*4]-bounds[0]),row=Math.floor(bounds[3]-canopy[i*4+1]);
    if(col<0||col>=width||row<0||row>=height)throw Error('Canopy outside global bounds');
    const cell=row*width+col;if(index[cell]!==-1)throw Error('Duplicate global canopy cell');index[cell]=i;
    if(canopy[i*4+3]>=2)valid[validCount++]=i;
  }
  function at(x,y){return x<0||y<0||x>=width||y>=height?-1:index[y*width+x];}
  progress('Smoothing '+validCount+' supported canopy cells');
  for(let v=0;v<validCount;v++){
    const i=valid[v],x=Math.floor(canopy[i*4]-bounds[0]),y=Math.floor(bounds[3]-canopy[i*4+1]);let sum=0,weights=0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const other=at(x+dx,y+dy);if(other<0||canopy[other*4+3]<2)continue;
      const w=1/(1+dx*dx+dy*dy);sum+=canopy[other*4+3]*w;weights+=w;
    }smooth[i]=sum/weights;
  }
  const maxima=[];
  for(let v=0;v<validCount;v++){
    const i=valid[v];if(smooth[i]<3)continue;
    const x=Math.floor(canopy[i*4]-bounds[0]),y=Math.floor(bounds[3]-canopy[i*4+1]);let peak=true;
    for(let dy=-2;dy<=2&&peak;dy++)for(let dx=-2;dx<=2;dx++){
      if(dx*dx+dy*dy>4)continue;const other=at(x+dx,y+dy);if(other<0)continue;
      if(smooth[other]>smooth[i]+1e-5||(Math.abs(smooth[other]-smooth[i])<=1e-5&&(dy<0||(dy===0&&dx<0)))){peak=false;break;}
    }if(peak)maxima.push(i);
  }
  maxima.sort((a,b)=>smooth[b]-smooth[a]||Math.floor(bounds[3]-canopy[a*4+1])-Math.floor(bounds[3]-canopy[b*4+1])||canopy[a*4]-canopy[b*4]);
  const seeds=[],buckets=new Map();
  for(const i of maxima){
    const x=Math.floor(canopy[i*4]-bounds[0]),y=Math.floor(bounds[3]-canopy[i*4+1]),bx=Math.floor(x/6),by=Math.floor(y/6),separation=Math.max(3,Math.min(6,1+smooth[i]*.18));let blocked=false;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)for(const seed of buckets.get(`${bx+dx},${by+dy}`)||[])if(Math.hypot(x-seed.x,y-seed.y)<Math.min(separation,seed.separation))blocked=true;
    if(blocked)continue;
    const seed={i,x,y,h:smooth[i],separation,radius:Math.min(12,2+smooth[i]*.45)};seeds.push(seed);
    const key=`${bx},${by}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(seed);
  }
  if(seeds.length>=2**24)throw Error('Crown IDs exceed exact WebGL float integers');
  progress('Growing '+seeds.length+' globally seeded crowns');
  let capacity=1<<19,size=0,heapCells=new Uint32Array(capacity),heapIds=new Uint32Array(capacity),heapScores=new Float32Array(capacity);
  function push(cell,id,score){
    if(size===capacity){capacity*=2;for(const key of ['cells','ids','scores']){const old=key==='cells'?heapCells:key==='ids'?heapIds:heapScores,next=key==='scores'?new Float32Array(capacity):new Uint32Array(capacity);next.set(old);if(key==='cells')heapCells=next;else if(key==='ids')heapIds=next;else heapScores=next;}}
    let i=size++;while(i){const parent=(i-1)>>1;if(heapScores[parent]>=score)break;heapCells[i]=heapCells[parent];heapIds[i]=heapIds[parent];heapScores[i]=heapScores[parent];i=parent;}
    heapCells[i]=cell;heapIds[i]=id;heapScores[i]=score;
  }
  function pop(){
    const cell=heapCells[0],id=heapIds[0],score=heapScores[0];size--;
    if(size){const c=heapCells[size],s=heapScores[size],tree=heapIds[size];let i=0;while(i*2+1<size){let child=i*2+1;if(child+1<size&&heapScores[child+1]>heapScores[child])child++;if(heapScores[child]<=s)break;heapCells[i]=heapCells[child];heapIds[i]=heapIds[child];heapScores[i]=heapScores[child];i=child;}heapCells[i]=c;heapIds[i]=tree;heapScores[i]=s;}
    return[cell,id,score];
  }
  for(let s=0;s<seeds.length;s++){const seed=seeds[s];labels[seed.i]=s+1;best[seed.i]=seed.h;push(seed.i,s+1,seed.h);}
  while(size){
    const [i,id,score]=pop();if(score<best[i])continue;
    if(labels[i]&&labels[i]!==id)continue;labels[i]=id;
    const seed=seeds[id-1],x=Math.floor(canopy[i*4]-bounds[0]),y=Math.floor(bounds[3]-canopy[i*4+1]);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy,other=at(nx,ny);
      if(other<0||labels[other]||canopy[other*4+3]<2||Math.hypot(nx-seed.x,ny-seed.y)>seed.radius)continue;
      if(smooth[other]<Math.max(2,seed.h*.15)||smooth[other]>seed.h*1.35)continue;
      const jump=Math.abs(smooth[other]-smooth[i]);if(jump>Math.max(3,seed.h*.4))continue;
      const priority=Math.fround(Math.min(score,smooth[other])-.05*Math.hypot(dx,dy)-.1*jump);
      if(priority<=best[other])continue;best[other]=priority;push(other,id,priority);
    }
  }
  const counts=new Uint32Array(seeds.length+1),peaks=new Int32Array(seeds.length+1);peaks.fill(-1);
  for(let i=0;i<count;i++){const id=labels[i];if(!id)continue;counts[id]++;if(peaks[id]<0||canopy[i*4+3]>canopy[peaks[id]*4+3])peaks[id]=i;}
  const remap=new Uint32Array(seeds.length+1),catalog=[];
  for(let id=1;id<counts.length;id++)if(counts[id]>=4){remap[id]=catalog.length+1;const p=peaks[id];catalog.push({id:catalog.length+1,x:canopy[p*4],y:canopy[p*4+1],z:canopy[p*4+2],height:canopy[p*4+3],area:counts[id],sparse:counts[id]<8,touching:false,edge:false});}
  for(let i=0;i<count;i++)labels[i]=remap[labels[i]];
  for(let v=0;v<validCount;v++){
    const i=valid[v],id=labels[i];if(!id)continue;const x=Math.floor(canopy[i*4]-bounds[0]),y=Math.floor(bounds[3]-canopy[i*4+1]);
    for(const [dx,dy] of [[1,0],[0,1]]){const other=at(x+dx,y+dy),otherId=other<0?0:labels[other];if(otherId&&otherId!==id){catalog[id-1].touching=true;catalog[otherId-1].touching=true;}}
  }
  progress('Retained '+catalog.length+' parish-wide crown candidates');
  return{labels,index,catalog};
}
module.exports={clusterSparse};
