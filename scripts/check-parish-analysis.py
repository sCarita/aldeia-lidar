#!/usr/bin/env python3
"""Independent coverage, context, georeferencing, overlap and integrity validation."""
import ast,csv,json,sys
from functools import lru_cache
from pathlib import Path
import numpy as np
from PIL import Image
from parish_analysis_common import ROOT,OUT,DATA,INDEX,DARK,window,sha,colour
# Compile only production derivative functions; no generation/import side effects.
node=ast.parse((ROOT/'scripts/build-parish-analysis.py').read_text());functions=[n for n in node.body if isinstance(n,ast.FunctionDef)and n.name in['blur','derivatives']];env={'np':np,'window':window,'DARK':DARK,'colour':colour,'lo':150.,'hi':320.};k=np.exp(-.5*(np.arange(-60,61)/20)**2);env['k']=k/k.sum();exec(compile(ast.Module(body=functions,type_ignores=[]),'production-derivatives','exec'),env)
def probe():
 # Different working windows must produce exactly identical shared pixel crops.
 a=[28500,-38400,28700,-38200];b=[28600,-38400,28800,-38200]
 x=env['derivatives']([a[0]-32,a[1]-32,a[2]+32,a[3]+32]);y=env['derivatives']([b[0]-32,b[1]-32,b[2]+32,b[3]+32])
 for key in x[5]:assert np.array_equal(x[5][key][64:464,264:464],y[5][key][64:464,64:264]),('Derivative overlap',key)
 print('Derivative halo/overlap probe passed for every layer.',flush=True)
 # Reproduce the established village fixture before using a parish-wide scale.
 village=ROOT/'docs/aldeia-da-mata/analysis-village';v=json.loads((village/'manifest.json').read_text());b=v['boundsEPSG3763'];old_range=next(l['rangeMetres']for l in v['layers']if l['id']=='elevation');env['lo'],env['hi']=old_range;sample=env['derivatives']([b[0]-32,b[1]-32,b[2]+32,b[3]+32])
 assert np.array_equal(window(b,'counts'),np.asarray(Image.open(village/'context/ground-return-count.tif')))
 for key,a in sample[5].items():
  a=a[64:1264,64:1264]
  if key.startswith('hillshade'):im=Image.fromarray(a,'P');im.putpalette(sample[6]);a=np.asarray(im.convert('RGB'))
  elif key=='support':a=np.array([[13,17,23],[63,185,80],[210,153,34]],dtype='uint8')[a]
  assert np.array_equal(a,np.asarray(Image.open(village/'context'/(key+'.png')).convert('RGB'))),('Village fixture',key)
 print('Village fixture passed: all eight RGB layers and exact raw counts.',flush=True)
probe()
if '--probe' in sys.argv:sys.exit(0)
m=json.loads((OUT/'manifest.json').read_text());plan=json.loads((OUT/'plan.json').read_text());assert len(m['patches'])==plan['patchCount']==4172;assert m['imagePixels']==[400,400];assert m['northUp'];assert m['resolutionMetres']==.5
expected={p['id']:p for p in plan['patches']};seen=set();sources=[json.loads(p.read_text())for p in sorted((OUT/'context/sources').glob('*.json'))];assert len(sources)==60;tiles=[t for s in sources for t in s['tiles']];assert len(tiles)==len(INDEX['tiles'])==685
context_totals={k:0 for k in['groundReturns','measuredCells','interpolatedCells','validCells']}
for t in tiles:
 folder=OUT/'context/tiles'/t['id'];c=np.asarray(Image.open(folder/'ground-return-count.tif'));z=np.asarray(Image.open(folder/'terrain.tif'));raw=np.asarray(Image.open(folder/'raw-ground-mean.tif'));support=np.asarray(Image.open(folder/'support-codes.png'));valid=z!=-9999
 assert np.array_equal(valid,support!=0);assert np.array_equal(support==1,valid&(c>0));assert np.array_equal(support==2,valid&(c==0));assert np.array_equal(raw!=-9999,c>0);assert int(c.sum())==INDEX['tiles'][t['id']]['groundPoints'];assert np.count_nonzero(c)==INDEX['tiles'][t['id']]['measuredCells']
 for key in context_totals:context_totals[key]+=t[key]
assert context_totals==m['contextStats'];assert context_totals['groundReturns']==INDEX['groundPoints']==504411342
patch_totals={k:0 for k in context_totals}
for n,p in enumerate(m['patches']):
 assert p['id']not in seen;seen.add(p['id']);b=p['boundsEPSG3763'];assert b==expected[p['id']]['boundsEPSG3763'];assert b[2]-b[0]==b[3]-b[1]==200
 with Image.open(OUT/p['terrain'])as im:
  a=np.asarray(im);assert a.shape==(400,400);assert tuple(im.tag_v2[33550])==(.5,.5,0);assert tuple(im.tag_v2[33922])==(0.,0.,0.,b[0],b[3],0.);assert tuple(im.tag_v2[34735])[12:16]==(3072,0,1,3763);assert im.tag_v2[42113]=='-9999';assert im.tag_v2[339]==(3,)
 source=window(b);assert np.array_equal(a,np.where(np.isfinite(source),source,-9999).astype('float32'));c=window(b,'counts');valid=a!=-9999;s=p['stats'];assert s['validCells']==np.count_nonzero(valid);assert s['measuredCells']==np.count_nonzero(valid&(c>0));assert s['interpolatedCells']==np.count_nonzero(valid&(c==0));assert s['groundReturns']==int(c.sum());assert s['measuredCells']+s['interpolatedCells']+s['noDataCells']==160000
 for key in context_totals:patch_totals[key]+=s[key]
 for key,file in p['images'].items():
  rgb=np.asarray(Image.open(OUT/file).convert('RGB'));assert rgb.shape==(400,400,3);assert np.all(rgb[~valid]==DARK);w=[float(v)for v in (OUT/file).with_suffix('.pgw').read_text().splitlines()];assert w==[.5,0,0,-.5,b[0]+.25,b[3]-.25]
 support=np.asarray(Image.open(OUT/p['images']['support']).convert('RGB'));assert np.array_equal(np.all(support==[63,185,80],axis=2),valid&(c>0));assert np.array_equal(np.all(support==[210,153,34],axis=2),valid&(c==0))
 if n%500==0:print('Patch semantics',n,'/',len(m['patches']),flush=True)
assert patch_totals=={k:4*v for k,v in context_totals.items()},'Full fourfold coverage of every prepared cell and return'
# Every adjacent 100 m overlap must be pixel-identical in all eight image layers.
by_bounds={tuple(p['boundsEPSG3763']):p for p in m['patches']}
@lru_cache(maxsize=256)
def rgb(file):return np.asarray(Image.open(OUT/file).convert('RGB'))
for key in m['patches'][0]['images']:
 for p in m['patches']:
  b=p['boundsEPSG3763'];a=rgb(p['images'][key]);right=by_bounds.get((b[0]+100,b[1],b[2]+100,b[3]));down=by_bounds.get((b[0],b[1]-100,b[2],b[3]-100))
  if right:assert np.array_equal(a[:,200:],rgb(right['images'][key])[:,:200]),('Right seam',p['id'],key)
  if down:assert np.array_equal(a[200:],rgb(down['images'][key])[:200]),('Down seam',p['id'],key)
 rgb.cache_clear();print('All overlaps passed:',key,flush=True)
checks=json.loads((OUT/'checksums.json').read_text())
for n,(file,h)in enumerate(checks.items()):
 assert sha(OUT/file)==h,file
 if n%10000==0:print('Checksums',n,'/',len(checks),flush=True)
with (OUT/'review.csv').open()as f:assert {r['patch_id']for r in csv.DictReader(f)}==seen
result={'passed':True,'patches':len(m['patches']),'contextTiles':len(tiles),'checksums':len(checks),'contextStats':context_totals,'checks':['Exact source/model cell and return counts','Terrain and support semantics','GeoTIFF CRS/NoData/world files','Every adjacent overlap in eight layers','All artifact hashes','Complete review sheet']}
(OUT/'validation.json').write_text(json.dumps(result,indent=2)+'\n');print('PASS:',json.dumps(result),flush=True)
