"""Convert one verified source's bounded support arrays into standalone context tiles."""
import json,sys
from pathlib import Path
import numpy as np
from PIL import Image
from parish_analysis_common import OUT,INDEX,terrain,tiff,sha
work=Path(sys.argv[1]);r=json.loads((work/'source.json').read_text());b=r['bounds'];count=np.memmap(work/'counts.u32',dtype='<u4',mode='r',shape=(2000,2000));sums=np.memmap(work/'sums.f64',dtype='<f8',mode='r',shape=(2000,2000));tiles=[]
for tile_id,t in INDEX['tiles'].items():
 if t['source']!=r['filename']:continue
 x0,y0,x1,y1=t['bounds'];row=round((b[3]-y1)*2);col=round((x0-b[0])*2);c=np.asarray(count[row:row+500,col:col+500]);s=np.asarray(sums[row:row+500,col:col+500]);z=terrain(tile_id);valid=np.isfinite(z);support=np.where(valid,np.where(c>0,1,2),0).astype('uint8');n=int(c.sum());measured=int(np.count_nonzero(c))
 if n!=t['groundPoints']:raise RuntimeError(f'{tile_id}: raw returns {n} != prepared model {t["groundPoints"]}')
 if measured!=t['measuredCells']:raise RuntimeError(f'{tile_id}: occupied ground cells {measured} != prepared model {t["measuredCells"]}')
 if np.any((c>0)&~valid):raise RuntimeError('Measured ground missing in existing model '+tile_id)
 folder=OUT/'context/tiles'/tile_id;folder.mkdir(parents=True,exist_ok=True)
 raw=np.divide(s,c,out=np.full((500,500),np.nan),where=c>0)
 tiff(folder/'terrain.tif',z,t['bounds']);tiff(folder/'raw-ground-mean.tif',raw,t['bounds']);tiff(folder/'ground-return-count.tif',c,t['bounds'],integer=True);Image.fromarray(support).save(folder/'support-codes.png')
 files={str(p.relative_to(OUT)):sha(p) for p in folder.iterdir() if p.is_file()}
 tiles.append({'id':tile_id,'bounds':t['bounds'],'groundReturns':n,'measuredCells':measured,'validCells':int(valid.sum()),'interpolatedCells':int(((c==0)&valid).sum()),'files':files})
r['tiles']=tiles;r['complete']=True
(OUT/'context/sources').mkdir(parents=True,exist_ok=True);(OUT/'context/sources'/(r['filename']+'.json')).write_text(json.dumps(r,indent=2)+'\n')
print(r['filename'],len(tiles),'support context tiles written',flush=True)
