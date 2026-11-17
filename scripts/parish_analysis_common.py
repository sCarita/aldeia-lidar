"""Shared, bounded terrain/support IO and georeferencing for parish review images."""
import base64,gzip,hashlib,json,math
from functools import lru_cache
from pathlib import Path
import numpy as np
from PIL import Image,TiffImagePlugin
ROOT=Path(__file__).resolve().parents[1];DATA=ROOT/'docs/aldeia-da-mata/data';OUT=ROOT/'docs/aldeia-da-mata/analysis-parish';RES=.5
INDEX=json.loads((DATA/'max-detail-index.js').read_text().split('=',1)[1].rstrip(';\n'))
DARK=np.array([13,17,23],dtype='uint8')
def sha(p):
 h=hashlib.sha256()
 with Path(p).open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
@lru_cache(maxsize=24)
def terrain(tile_id):
 t=INDEX['tiles'].get(tile_id)
 if not t:return None
 s=(DATA/t['url'].removeprefix('data/')).read_text();p=json.loads(s[s.index('={"id"')+1:].rstrip(';\n'));a=np.frombuffer(gzip.decompress(base64.b64decode(p['heights'])),dtype='<u2').reshape(500,500)
 return np.where(a==65535,np.nan,t['zBase']+a*.01)
@lru_cache(maxsize=24)
def counts(tile_id):
 p=OUT/'context/tiles'/tile_id/'ground-return-count.tif'
 return np.asarray(Image.open(p),dtype=np.uint32) if p.exists() else None

def window(bounds,kind='terrain'):
 width=round((bounds[2]-bounds[0])/RES);height=round((bounds[3]-bounds[1])/RES)
 a=np.full((height,width),np.nan,dtype=np.float64) if kind=='terrain' else np.zeros((height,width),dtype=np.uint32)
 for y in range(math.floor(bounds[1]/250)*250,math.ceil(bounds[3]/250)*250,250):
  for x in range(math.floor(bounds[0]/250)*250,math.ceil(bounds[2]/250)*250,250):
   tile_id=f't{x}_{y}';t=INDEX['tiles'].get(tile_id)
   if not t:continue
   source=terrain(tile_id) if kind=='terrain' else counts(tile_id)
   if source is None:
    if kind=='counts':raise RuntimeError('Missing ground support '+tile_id)
    continue
   left=max(x,bounds[0]);right=min(x+250,bounds[2]);top=min(y+250,bounds[3]);bottom=max(y,bounds[1])
   r=round((bounds[3]-top)/RES);c=round((left-bounds[0])/RES);sr=round((y+250-top)/RES);sc=round((left-x)/RES);h=round((top-bottom)/RES);w=round((right-left)/RES)
   a[r:r+h,c:c+w]=source[sr:sr+h,sc:sc+w]
 return a

def world(p,b):Path(p).with_suffix('.pgw').write_text(f'0.5\n0\n0\n-0.5\n{b[0]+.25}\n{b[3]-.25}\n')
def tiff(p,a,b,nodata=-9999,integer=False):
 p=Path(p);tags=TiffImagePlugin.ImageFileDirectory_v2()
 for tag,value,typ in [(33550,(.5,.5,0.),12),(33922,(0.,0.,0.,float(b[0]),float(b[3]),0.),12),(34735,(1,1,0,4,1024,0,1,1,1025,0,1,1,3072,0,1,3763,3076,0,1,9001),3),(42113,str(nodata),2),(270,'Locally derived DGT ground data; EPSG:3763; heights in metres, Cascais datum. See provenance.json.',2)]:tags[tag]=value;tags.tagtype[tag]=typ
 if integer:
  # Counts are <=2^31-1 and remain exact signed 32-bit integers, including zero.
  if np.max(a)>2147483647:raise ValueError('Ground count overflow')
  a=a.astype('int32')
 else:a=np.where(np.isfinite(a),a,nodata).astype('float32')
 Image.fromarray(a).save(p,compression='tiff_adobe_deflate',tiffinfo=tags)
def palette(v,stops):
 v=np.clip(np.nan_to_num(v),0,1);xp=np.linspace(0,1,len(stops));return np.stack([np.interp(v,xp,[s[c] for s in stops])for c in range(3)],axis=-1).astype('uint8')
def colour(a,v,stops):
 rgb=palette(v,stops);rgb[~np.isfinite(a)]=DARK;return rgb
