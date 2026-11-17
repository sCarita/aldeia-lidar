#!/usr/bin/env python3
"""Check spatial coverage, crop overlap, NoData, support and GeoTIFF metadata."""
import csv, hashlib, json
from pathlib import Path
import numpy as np
from PIL import Image
D=Path(__file__).resolve().parents[1]/'docs/aldeia-da-mata/analysis-village'
m=json.loads((D/'manifest.json').read_text());assert len(m['patches'])==25
context=np.asarray(Image.open(D/'context/terrain.tif'));assert context.shape==(1200,1200)
counts=np.asarray(Image.open(D/'context/ground-return-count.tif'))
support=np.asarray(Image.open(D/'context/support-codes.png'))
raw=np.asarray(Image.open(D/'context/raw-ground-mean.tif'))
valid=context!=-9999
assert np.array_equal(valid,support!=0)
assert np.array_equal(support==1,valid&(counts>0))
assert np.array_equal(support==2,valid&(counts==0))
assert np.array_equal(raw!=-9999,counts>0)
assert int(counts.sum())==m['stats']['groundReturns']==2850760
cover=np.zeros(context.shape,dtype='uint8')
for p in m['patches']:
 x,y,w,h=p['pixelWindow'];sl=(slice(y,y+h),slice(x,x+w));cover[sl]+=1
 with Image.open(D/p['terrain']) as im:
  a=np.asarray(im);assert a.shape==(400,400);assert np.array_equal(a,context[sl])
  assert tuple(im.tag_v2[33550])==(.5,.5,0)
  assert tuple(im.tag_v2[33922])==(0.,0.,0.,p['boundsEPSG3763'][0],p['boundsEPSG3763'][3],0.)
  assert tuple(im.tag_v2[34735])[12:16]==(3072,0,1,3763)
  assert im.tag_v2[42113]=='-9999';assert im.tag_v2[339]==(3,)
 s=p['stats'];assert s['measuredCells']+s['interpolatedCells']+s['noDataCells']==160000
 assert s['groundReturns']==int(counts[sl].sum())
 for key,path in p['images'].items():
  im=np.asarray(Image.open(D/path));assert im.shape==(400,400,3)
  full=np.asarray(Image.open(D/m['context'][key]));assert np.array_equal(im,full[sl]),(p['id'],key,'crop seam')
  assert np.all(im[(support[sl]==0)]==m['noDataRGB'])
  world=[float(v) for v in (D/path).with_suffix('.pgw').read_text().splitlines()]
  assert world==[.5,0,0,-.5,p['boundsEPSG3763'][0]+.25,p['boundsEPSG3763'][3]-.25]
assert np.all(cover>0) and cover.max()==4
# Explicit adjacent overlaps agree, including at source terrain tile boundaries.
for p in m['patches']:
 if p['column']<5:
  q=m['patches'][m['patches'].index(p)+1]
  a=np.asarray(Image.open(D/p['terrain']));b=np.asarray(Image.open(D/q['terrain']));assert np.array_equal(a[:,200:],b[:,:200])
for name,expected in json.loads((D/'checksums.json').read_text()).items():assert hashlib.sha256((D/name).read_bytes()).hexdigest()==expected,name
with (D/'review.csv').open() as f:assert len(list(csv.DictReader(f)))==25
print('PASS: 25 georeferenced patches; 200 PNGs; full coverage; exact overlapping crops; support/NoData; raw counts; TIFF tags; world files; checksums.')
