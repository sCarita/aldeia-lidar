#!/usr/bin/env python3
"""Prepare local RGB tiles from the official DGT 2025 WMS, in EPSG:3763.
Requires numpy/Pillow and curl. Downloads are resumable; TLS certificate checks stay on.
"""
import concurrent.futures, hashlib, json, math, shutil, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];DATA=ROOT/'docs/aldeia-da-mata/data';OUT=DATA/'aerial-2025';CACHE=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/aldeia-aerial-2025-source');CACHE.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
s=(DATA/'metadata.js').read_text();meta=json.loads(s.split('=',1)[1].rstrip(';\n'));polys=meta['projectedBoundary'];bounds=meta['bounds']
segments=[(a,b) for poly in polys for ring in poly for a,b in zip(ring,ring[1:]) if a!=b]
A=np.array([a for a,b in segments]);B=np.array([b for a,b in segments]);
def inside(x,y):
 mask=(A[:,1]>y)!=(B[:,1]>y);a=A[mask];b=B[mask]
 return bool(np.count_nonzero(x<a[:,0]+(y-a[:,1])*(b[:,0]-a[:,0])/(b[:,1]-a[:,1]))%2)
def intersects(r):
 x0,y0,x1,y1=r
 if np.any((A[:,0]>=x0)&(A[:,0]<=x1)&(A[:,1]>=y0)&(A[:,1]<=y1)):return True
 if any(inside(x,y) for x,y in [(x0,y0),(x1,y0),(x0,y1),(x1,y1)]):return True
 mask=(np.maximum(A[:,0],B[:,0])>=x0)&(np.minimum(A[:,0],B[:,0])<=x1)&(np.maximum(A[:,1],B[:,1])>=y0)&(np.minimum(A[:,1],B[:,1])<=y1)
 for a,b in zip(A[mask],B[mask]):
  lo,hi=0,1
  for p,q in [(-(b[0]-a[0]),a[0]-x0),(b[0]-a[0],x1-a[0]),(-(b[1]-a[1]),a[1]-y0),(b[1]-a[1],y1-a[1])]:
   if p==0:
    if q<0:break
   elif p<0:lo=max(lo,q/p)
   else:hi=min(hi,q/p)
   if lo>hi:break
  else:return True
 return False
BASE='https://cartografia.dgterritorio.gov.pt/wms/ortos2025'
def url(b,w,h):return BASE+'?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=Ortos2025-RGB&STYLES=&CRS=EPSG:3763&BBOX='+','.join(map(str,b))+f'&WIDTH={w}&HEIGHT={h}&FORMAT=image/jpeg'
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def download(job):
 x,y=job;b=[x,y,x+1024,y+1024];p=CACHE/f'{x}_{y}.jpg';u=url(b,4096,4096)
 if not p.exists():
  error=''
  for attempt in range(5):
   tmp=p.with_suffix('.part')
   result=subprocess.run(['curl','-fLsS','--tls-max','1.2','--http1.1','--connect-timeout','12','--max-time','120',u,'-o',str(tmp)],capture_output=True,text=True)
   if result.returncode==0:
    try:
     with Image.open(tmp) as im:
      if im.size!=(4096,4096):raise ValueError('Wrong image dimensions')
      im.verify()
     tmp.replace(p);break
    except Exception as e:error=str(e)
   else:error=result.stderr
  else:raise RuntimeError(f'{p.name}: {error}')
 print('Aerial source ready',p.name,flush=True)
 return {'file':p.name,'bounds':b,'width':4096,'height':4096,'resolution':.25,'url':u,'sha256':digest(p),'bytes':p.stat().st_size}
jobs=[(x,y)for y in range(math.floor(bounds[1]/1024)*1024,math.ceil(bounds[3]/1024)*1024,1024)for x in range(math.floor(bounds[0]/1024)*1024,math.ceil(bounds[2]/1024)*1024,1024)if intersects([x,y,x+1024,y+1024])]
print('Downloading',len(jobs),'native 0.25 m source blocks',flush=True)
# Reuse a single verified HTTPS connection: the public server intermittently
# stalls new handshakes. One curl process shares its connection across URLs.
remaining=[(x,y)for x,y in jobs if not (CACHE/f'{x}_{y}.jpg').exists()]
for attempt in range(3):
 if not remaining:break
 args=['curl','-fLsS','--tls-max','1.2','--http1.1','--connect-timeout','8','--max-time','90','--retry','4','--retry-all-errors','--retry-delay','1','--write-out','%{filename_effective} %{response_code}\n']
 for x,y in remaining:args+=['--url',url([x,y,x+1024,y+1024],4096,4096),'--output',str(CACHE/f'{x}_{y}.part')]
 process=subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 for line in process.stdout:print(line.strip(),flush=True)
 process.wait()
 todo=[]
 for x,y in remaining:
  part=CACHE/f'{x}_{y}.part'
  try:
   with Image.open(part) as im:
    if im.size!=(4096,4096):raise ValueError('Wrong image dimensions')
    im.verify()
   part.replace(CACHE/f'{x}_{y}.jpg')
  except Exception:todo.append((x,y))
 remaining=todo
if remaining:raise RuntimeError(f'{len(remaining)} imagery source blocks unavailable; rerun to resume')
sources=[download(job)for job in jobs]
tiles={};levels={}
def save(z,x,y,im):
 size=128*2**z;b=[x*size,y*size,(x+1)*size,(y+1)*size];folder=OUT/str(z);folder.mkdir(exist_ok=True);p=folder/f'{x}_{y}.jpg';im.save(p,quality=90,optimize=True)
 t={'id':f'{z}/{x}/{y}','level':z,'x':x,'y':y,'bounds':b,'url':str(p.relative_to(DATA.parent)),'width':512,'height':512,'resolution':.25*2**z,'bytes':p.stat().st_size,'sha256':digest(p)};tiles[t['id']]=t;levels.setdefault(z,[]).append(t)
for src in sources:
 x0,y0,_,_=src['bounds']
 with Image.open(CACHE/src['file']) as original:
  original=original.convert('RGB')
  for row in range(8):
   for col in range(8):
    x=x0//128+col;y=y0//128+(7-row);b=[x*128,y*128,(x+1)*128,(y+1)*128]
    if intersects(b):save(0,x,y,original.crop((col*512,row*512,(col+1)*512,(row+1)*512)))
for z in range(1,8):
 parents={(t['x']//2,t['y']//2)for t in levels[z-1]}
 for x,y in sorted(parents):
  mosaic=Image.new('RGB',(1024,1024))
  for dy in range(2):
   for dx in range(2):
    child=tiles.get(f'{z-1}/{x*2+dx}/{y*2+dy}')
    if child:
     with Image.open(DATA.parent/child['url']) as im:mosaic.paste(im,(dx*512,(1-dy)*512))
  save(z,x,y,mosaic.resize((512,512),Image.Resampling.LANCZOS))
 print('Built imagery level',z,'tiles',len(levels[z]),flush=True)
version='ortos2025-'+hashlib.sha256(''.join(s['sha256']for s in sources).encode()).hexdigest()[:16]
manifest={'version':version,'year':2025,'crs':'EPSG:3763','nativeResolution':.25,'tilePixels':512,'maxLevel':7,'bounds':bounds,'tiles':tiles,'levels':{z:len(v)for z,v in levels.items()},'bytes':sum(t['bytes']for t in tiles.values()),'attribution':'Informação geográfica cedida pela Direção-Geral do Território','licence':'CC BY 4.0','source':BASE,'layer':'Ortos2025-RGB'}
(DATA/'aerial-2025-index.js').write_text('window.ALDEIA_AERIAL_2025='+json.dumps(manifest,separators=(',',':'))+';\n')
(DATA/'aerial-2025-provenance.json').write_text(json.dumps({**manifest,'sources':sources,'sourceMetadata':'https://snig.dgterritorio.gov.pt/rndg/srv/api/records/96d83932-f957-40d6-a2ea-3a25751c4b2d','sourcePage':'https://www.dgterritorio.gov.pt/atividades/cartografia/cartografia-topografica/ortofotos/ortofotos-digitais','acquisitionNote':'2025 national orthophotography. Parish falls in Lote 3; published lot acquisition range 26 April to 15 July 2025; exact photo dates at individual locations not established.','method':'WMS 1.3.0 RGB GetMap in native EPSG:3763. Native source blocks 1024 m square, 4096 pixels, 0.25 m/px. JPEG display tiles 512 px; coarser levels combine four children with Lanczos downsampling. Tiles intersect the CAOP2025 boundary and may extend beyond it; the viewer clips images to the vector parish boundary. JPEG display encoding is lossy. Source native grid is not stretched or reprojected. No NIR/NDVI inference.','boundarySource':meta['boundarySource']},indent=2)+'\n')
print(json.dumps({'sourceBlocks':len(sources),'tiles':len(tiles),'bytes':manifest['bytes'],'levels':manifest['levels']}),flush=True)
