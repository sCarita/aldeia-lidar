#!/usr/bin/env python3
"""Build the complete parish patch bundle in bounded, resumable spatial blocks."""
import argparse,csv,gc,hashlib,json,math,resource,shutil,sys,time
from collections import defaultdict
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from parish_analysis_common import ROOT,DATA,OUT,INDEX,DARK,terrain,window,world,tiff,sha,colour
parser=argparse.ArgumentParser();parser.add_argument('--limit-blocks',type=int);parser.add_argument('--force',action='store_true');args=parser.parse_args()
plan=json.loads((OUT/'plan.json').read_text());patches=plan['patches'];N=400;HALO=32
code=hashlib.sha256(Path(__file__).read_bytes()+Path(__file__).with_name('parish_analysis_common.py').read_bytes()).hexdigest();model_hash=sha(DATA/'max-detail-index.js');fingerprint=hashlib.sha256((code+model_hash).encode()).hexdigest()
source_files=sorted((OUT/'context/sources').glob('*.json'));sources=[json.loads(p.read_text()) for p in source_files]
if len(sources)!=60 or sum(len(s['tiles']) for s in sources)!=len(INDEX['tiles']):raise RuntimeError('Complete verified support context required before patch generation')
for s in sources:
 for t in s['tiles']:
  for f,h in t['files'].items():
   if not (OUT/f).exists() or sha(OUT/f)!=h:raise RuntimeError('Ground-support checksum mismatch '+f)
# One common elevation scale from every prepared model cell, including detail extremes.
lo,hi=float('inf'),float('-inf')
for tid in INDEX['tiles']:
 a=terrain(tid)
 if np.isfinite(a).any():lo=min(lo,float(np.nanmin(a)));hi=max(hi,float(np.nanmax(a)))
settings=[{'id':f'hillshade-{az:03}','label':f'Hillshade · light {az}°','azimuthDegrees':az,'altitudeDegrees':35,'heightExaggeration':1,'ambient':.15}for az in[45,135,225,315]]+[
 {'id':'elevation','label':'Elevation','rangeMetres':[lo,hi]}, {'id':'slope','label':'Slope','rangeDegrees':[0,45]}, {'id':'local-relief','label':'Local relief','rangeMetres':[-2,2],'baselineGaussianSigmaMetres':10,'baselineRadiusMetres':30}, {'id':'support','label':'Ground support','categories':{'0':'NoData','1':'Measured cell','2':'Interpolated cell'}}]
layer_ids=[s['id']for s in settings]
arch_text=(DATA/'archaeology-parish.js').read_text();arch=json.loads(arch_text.split('=',1)[1].rstrip(';\n'))
groups=defaultdict(list)
for p in patches:
 row=int(p['id'].split('-r')[1].split('-')[0])-1;col=int(p['id'].split('-c')[1])-1;groups[(row//10,col//10)].append(p)
(OUT/'blocks').mkdir(exist_ok=True);(OUT/'thumbnails').mkdir(exist_ok=True)
k=np.exp(-.5*(np.arange(-60,61)/20)**2);k/=k.sum()
def blur(a):return np.apply_along_axis(lambda v:np.convolve(v,k,mode='same'),0,np.apply_along_axis(lambda v:np.convolve(v,k,mode='same'),1,a))
def derivatives(bounds):
 z=window(bounds);count=window(bounds,'counts');valid=np.isfinite(z);support=np.where(valid,np.where(count>0,1,2),0).astype('uint8');row,col=np.gradient(z,.5);east=col;north=-row;slope=np.where(valid,np.degrees(np.arctan(np.hypot(east,north))),np.nan)
 weights=blur(valid.astype(float));baseline=blur(np.nan_to_num(z))/np.maximum(weights,1e-9);relief=np.where(valid,z-baseline,np.nan);del weights,baseline
 layers={};gray_palette=[]
 for i in range(256):gray_palette.extend(DARK.tolist() if i==0 else[i,i,i])
 for az in[45,135,225,315]:
  a,alt=np.radians(az),np.radians(35);light=(-east*np.sin(a)*np.cos(alt)-north*np.cos(a)*np.cos(alt)+np.sin(alt))/np.sqrt(1+east**2+north**2);light=np.where(valid,light,np.nan);gray=np.interp(np.nan_to_num(.15+.85*np.clip(light,0,1)),[0,1],[0,255]).astype('uint8');gray[~np.isfinite(light)]=0;layers[f'hillshade-{az:03}']=gray
 layers['elevation']=colour(z,(z-lo)/(hi-lo),[(29,51,63),(51,109,117),(133,167,128),(224,204,142),(250,237,206)])
 layers['slope']=colour(slope,slope/45,[(19,35,54),(52,119,153),(239,195,105),(224,94,76)])
 layers['local-relief']=colour(relief,(relief+2)/4,[(47,104,177),(220,226,225),(185,77,55)])
 layers['support']=support
 return z,count,support,slope,relief,layers,gray_palette
records=[];blocks=sorted(groups);complete_blocks=0;began=time.time()
for block in blocks:
 block_id=f'b{block[0]:02}-{block[1]:02}';ledger=OUT/'blocks'/(block_id+'.json');items=groups[block]
 if ledger.exists() and not args.force:
  old=json.loads(ledger.read_text())
  if old.get('fingerprint')==fingerprint and all((OUT/f).exists() and (OUT/f).stat().st_size==n for f,n in old['sizes'].items()):
   records.extend(old['patches']);complete_blocks+=1;print(block_id,'cached',complete_blocks,'/',len(blocks),flush=True);continue
 if shutil.disk_usage(OUT).free<6*1024**3:raise RuntimeError('Free disk below 6 GiB reserve; resume after making space.')
 b=[min(p['boundsEPSG3763'][0]for p in items)-HALO,min(p['boundsEPSG3763'][1]for p in items)-HALO,max(p['boundsEPSG3763'][2]for p in items)+HALO,max(p['boundsEPSG3763'][3]for p in items)+HALO]
 z,count,support,slope,relief,layers,gray_palette=derivatives(b);block_records=[];sizes={};hashes={}
 for p in items:
  pb=p['boundsEPSG3763'];r=round((b[3]-pb[3])*2);c=round((pb[0]-b[0])*2);sl=(slice(r,r+N),slice(c,c+N));folder=OUT/'patches'/p['id'];folder.mkdir(parents=True,exist_ok=True);images={}
  for key,a in layers.items():
   data=a[sl];im=Image.fromarray(data)
   if key.startswith('hillshade'):
    im=Image.fromarray(data,'P');im.putpalette(gray_palette)
   elif key=='support':
    im=Image.fromarray(data,'P');im.putpalette([13,17,23,63,185,80,210,153,34]+[0]*759)
   target=folder/(key+'.png');im.save(target,compress_level=6,**({'bits':2}if key=='support' else{}));world(target,pb);images[key]=str(target.relative_to(OUT))
  tiff(folder/'terrain.tif',z[sl],pb);a=z[sl];s=support[sl];valid=np.isfinite(a);stats={'validCells':int(valid.sum()),'measuredCells':int((s==1).sum()),'interpolatedCells':int((s==2).sum()),'noDataCells':int((s==0).sum()),'groundReturns':int(count[sl].sum()),'elevationMinMetres':float(np.nanmin(a))if valid.any()else None,'elevationMaxMetres':float(np.nanmax(a))if valid.any()else None,'localReliefClippedCells':int((np.abs(relief[sl])>2).sum()),'slopeClippedCells':int((slope[sl]>45).sum())}
  thumb=OUT/'thumbnails'/(p['id']+'.jpg')
  # Thumbnail only: labelled/downsized material never alters scientific patch pixels.
  im=Image.open(folder/'hillshade-315.png').convert('RGB').resize((160,160));im.save(thumb,quality=82)
  references=[a['cns']for a in arch['records']if a['position'] and pb[0]<=a['position'][0]<pb[2] and pb[1]<a['position'][1]<=pb[3]]
  record={**p,'stats':stats,'images':images,'terrain':str((folder/'terrain.tif').relative_to(OUT)),'thumbnail':str(thumb.relative_to(OUT)),'inventoryPointCns':references,'block':block_id};block_records.append(record)
  for target in [*folder.iterdir(),thumb]:
   if target.is_file():rel=str(target.relative_to(OUT));sizes[rel]=target.stat().st_size;hashes[rel]=sha(target)
 ledger.write_text(json.dumps({'fingerprint':fingerprint,'boundsWithHalo':b,'patches':block_records,'sizes':sizes,'hashes':hashes},indent=2)+'\n');records.extend(block_records);complete_blocks+=1
 del z,count,support,slope,relief,layers;gc.collect();print(block_id,'ready',complete_blocks,'/',len(blocks),'patches',len(records),'freeGiB',round(shutil.disk_usage(OUT).free/1024**3,2),flush=True)
 if args.limit_blocks and complete_blocks>=args.limit_blocks:print('Benchmark limit reached; rerun without --limit-blocks to resume.');sys.exit(0)
records.sort(key=lambda p:p['id']);assert len(records)==plan['patchCount']
manifest={'name':'Aldeia da Mata · whole-parish ground-image review dataset','version':1,'created':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'crs':'EPSG:3763','verticalDatum':'Cascais','boundsEPSG3763':list(map(float,[min(p['boundsEPSG3763'][0]for p in records),min(p['boundsEPSG3763'][1]for p in records),max(p['boundsEPSG3763'][2]for p in records),max(p['boundsEPSG3763'][3]for p in records)])),'areaSquareMetres':plan['parishAreaSquareMetres'],'resolutionMetres':.5,'northUp':True,'patchSizeMetres':200,'strideMetres':100,'overlapPercent':50,'imagePixels':[400,400],'noDataRGB':DARK.tolist(),'layers':settings,'patches':records,'contextTiles':len(INDEX['tiles']),'contextStats':{key:sum(t[key]for s in sources for t in s['tiles'])for key in['groundReturns','measuredCells','validCells','interpolatedCells']},'fingerprint':fingerprint,'archaeologySnapshot':arch['checked']}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');(OUT/'manifest.js').write_text('window.PARISH_ANALYSIS='+json.dumps(manifest,separators=(',',':'))+';\n')
with (OUT/'manifest.csv').open('w',newline='')as f:
 w=csv.writer(f);w.writerow(['id','xmin','ymin','xmax','ymax','crs','pixel_size_m','valid_cells','measured_cells','interpolated_cells','nodata_cells','ground_returns','inventory_point_cns','terrain'])
 for p in records:w.writerow([p['id'],*p['boundsEPSG3763'],'EPSG:3763',.5,*[p['stats'][k]for k in['validCells','measuredCells','interpolatedCells','noDataCells','groundReturns']],';'.join(map(str,p['inventoryPointCns'])),p['terrain']])
review=OUT/'review.csv'
if not review.exists():
 with review.open('w',newline='')as f:
  w=csv.writer(f);w.writerow(['patch_id','status','visible_geometry','alternative_explanations','raw_ground_check','endovelico_cns_checked','endovelico_check_date','prior_mapping_check','confidence','notes']);w.writerows([[p['id'],'unreviewed','','','','','','','','']for p in records])
(OUT/'footprints-epsg3763.json').write_text(json.dumps({'crs':'EPSG:3763','note':'Projected coordinates in metres, not WGS84 GeoJSON.','patches':[{'id':p['id'],'ring':[[p['boundsEPSG3763'][i],p['boundsEPSG3763'][j]]for i,j in[(0,1),(2,1),(2,3),(0,3),(0,1)]]}for p in records]},separators=(',',':'))+'\n')
# Paged contact sheets avoid allocating a parish-sized preview.
contact=OUT/'contact-sheets';contact.mkdir(exist_ok=True);pages=[]
for start in range(0,len(records),64):
 items=records[start:start+64];sheet=Image.new('RGB',(1152,1220),(13,17,23));draw=ImageDraw.Draw(sheet);draw.text((12,10),f'ALDEIA DA MATA / PARISH GROUND PATCHES / {start//64+1}',fill='#e6edf3')
 for i,p in enumerate(items):
  x=8+(i%8)*143;y=40+(i//8)*147;im=Image.open(OUT/p['thumbnail']).resize((135,135));sheet.paste(im,(x,y));draw.text((x,y+135),p['id'].removeprefix('parish-'),fill='#c9d1d9')
 target=contact/f'page-{start//64+1:03}.jpg';sheet.save(target,quality=85);pages.append(str(target.relative_to(OUT)))
provenance={'source':'Direção-Geral do Território, public LiDAR viewer','sourcePage':'https://www.dgterritorio.gov.pt/levantamento-lidar-de-portugal-continental-0','attribution':'Source © Direção-Geral do Território, CC BY 4.0. Locally derived terrain images and ground support.','referenceArticle':'https://pietromiotti.com/latest/maya-site/','referenceScope':'Image-screening inspiration only; patch dimensions/overlap are local choices. No feature labels or discovery claims.','terrainMethod':'Existing maximum-detail 0.5 m class-2 ground means; inherited 0.25 m Gaussian smoothing, maximum 5 m gap support, CAOP2025 cell-centre mask and centimetre quantization. No extra terrain smoothing.','terrainIndexSha256':model_hash,'terrainProvenanceSha256':sha(DATA/'max-detail-provenance.json'),'censusSha256':sha(DATA/'class-census.json'),'derivatives':'Common parish elevation range; central differences at 0.5 m; light azimuths 45/135/225/315, sun altitude 35 degrees, ambient 0.15/direct 0.85, no exaggeration. Spatial blocks have a 32 m halo before crop.','localRelief':'Terrain minus normalized Gaussian baseline, sigma 10 m, radius 30 m; valid/missing mask retained. Colour range +/-2 m.','support':'0 missing model, 1 valid model with raw class-2 return in cell, 2 valid model without raw return. Raw counts/sums independently reconstructed and matched to every terrain tile. Measured model cells remain smoothed.','losslessPngEncoding':'Hillshades use indexed grayscale colours with a reserved dark NoData palette entry; support uses three exact indexed colours. Decoded RGB pixels are unchanged; TIFF terrain retains Float32 values.','context':'685 standalone georeferenced tiles, each with model, raw measured mean, exact integer counts and support codes. No huge full-parish raster preview is allocated.','sourceSupport':[{'filename':s['filename'],'accepted':s['accepted'],'decoded':s['decoded'],'report':'context/sources/'+s['filename']+'.json'}for s in sources],'overlapWarning':'Crops overlap; use separated spatial blocks for training/evaluation. Verify original returns and alternatives. Endovélico point associations are references, not completed novelty checks or site footprints.','archaeologySnapshot':arch['checked'],'processingFingerprint':fingerprint,'contactSheets':pages}
(OUT/'provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
(OUT/'gallery-index.js').write_text('window.PARISH_PATCH_GALLERY='+json.dumps({'name':manifest['name'],'created':manifest['created'],'layers':settings,'contextTiles':list(INDEX['tiles']),'patches':[{'id':p['id'],'b':p['boundsEPSG3763'],'v':p['stats']['validCells'],'m':p['stats']['measuredCells'],'i':p['stats']['interpolatedCells'],'g':p['stats']['groundReturns'],'c':p['inventoryPointCns']}for p in records]},separators=(',',':'))+';\n')
checks={}
for p in source_files:checks[str(p.relative_to(OUT))]=sha(p)
for ledger in (OUT/'blocks').glob('*.json'):checks.update(json.loads(ledger.read_text())['hashes'])
for s in sources:
 for t in s['tiles']:checks.update(t['files'])
for name in['plan.json','manifest.json','manifest.csv','manifest.js','gallery-index.js','provenance.json','footprints-epsg3763.json']+pages:checks[name]=sha(OUT/name)
(OUT/'checksums.json').write_text(json.dumps(checks,separators=(',',':'))+'\n')
peak=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*(1 if sys.platform=='darwin' else 1024)
(OUT/'build-report.json').write_text(json.dumps({'patches':len(records),'blocks':len(blocks),'elapsedSeconds':time.time()-began,'peakRssBytes':peak,'dataBytes':sum((OUT/f).stat().st_size for f in checks),'freeDiskBytes':shutil.disk_usage(OUT).free},indent=2)+'\n')
print('COMPLETE',len(records),'patches; peak RSS GiB',round(peak/1024**3,3),flush=True)
