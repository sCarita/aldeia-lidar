#!/usr/bin/env python3
"""Build north-up village review patches from the existing full-detail terrain.
Requires numpy and Pillow; no network. Run ground-support extraction first.
"""
import base64, csv, gzip, hashlib, io, json, math, re, shutil, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, TiffImagePlugin
ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'docs/aldeia-da-mata/data'
OUT=ROOT/'docs/aldeia-da-mata/analysis-village'
CACHE=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/aldeia-village-analysis')
OUT.mkdir(parents=True,exist_ok=True)
B=[34445,-40461,35045,-39861]; RES=.5; HALO=64; N=1200
HB=[B[0]-32,B[1]-32,B[2]+32,B[3]+32]; H=N+2*HALO
index=json.loads((DATA/'max-detail-index.js').read_text().split('=',1)[1].rstrip(';\n'))
z=np.full((H,H),np.nan,dtype=np.float64); used=[]
sha=lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
for tile in index['tiles'].values():
 x0,y0,x1,y1=tile['bounds']
 if x1<=HB[0] or x0>=HB[2] or y1<=HB[1] or y0>=HB[3]:continue
 p=DATA/tile['url'].removeprefix('data/');s=p.read_text();payload=json.loads(s[s.index('={"id"')+1:].rstrip(';\n'))
 a=np.frombuffer(gzip.decompress(base64.b64decode(payload['heights'])),dtype='<u2').reshape(500,500)
 a=np.where(a==65535,np.nan,tile['zBase']+a*.01)
 left=max(x0,HB[0]);right=min(x1,HB[2]);top=min(y1,HB[3]);bottom=max(y0,HB[1])
 r,c=int((HB[3]-top)/RES),int((left-HB[0])/RES);ar,ac=int((y1-top)/RES),int((left-x0)/RES);h,w=int((top-bottom)/RES),int((right-left)/RES)
 z[r:r+h,c:c+w]=a[ar:ar+h,ac:ac+w]
 used.append({**tile,'sha256':sha(p)})
counts=np.fromfile(CACHE/'counts.u32',dtype='<u4').reshape(H,H)
sums=np.fromfile(CACHE/'sums.f64',dtype='<f8').reshape(H,H)
valid=np.isfinite(z)
support=np.where(valid,np.where(counts>0,1,2),0).astype('uint8')
# Derivatives: central differences require valid neighbours. No new hole filling.
row,col=np.gradient(z,RES);east=col;north=-row
slope=np.where(valid,np.degrees(np.arctan(np.hypot(east,north))),np.nan)
# Normalized separable Gaussian; 10 m sigma, 3 sigma support, computed with halo.
k=np.exp(-.5*(np.arange(-60,61)/20)**2);k/=k.sum()
def blur(a):
 return np.apply_along_axis(lambda v:np.convolve(v,k,mode='same'),0,np.apply_along_axis(lambda v:np.convolve(v,k,mode='same'),1,a))
weights=blur(valid.astype(float));baseline=blur(np.nan_to_num(z))/np.maximum(weights,1e-9)
relief=np.where(valid,z-baseline,np.nan)
C=(slice(HALO,HALO+N),slice(HALO,HALO+N))
zs=z[C];lo,hi=float(np.nanmin(zs)),float(np.nanmax(zs))
DARK=np.array([13,17,23],dtype=np.uint8)
def palette(v,stops):
 v=np.clip(v,0,1); xp=np.linspace(0,1,len(stops));return np.stack([np.interp(v,xp,[s[c] for s in stops]) for c in range(3)],axis=-1)
def image(a,v,stops):
 rgb=palette(np.nan_to_num(v),stops).astype('uint8');rgb[~np.isfinite(a)]=DARK;return rgb
layers={};settings=[]
for az in [45,135,225,315]:
 azr,alt=np.radians(az),np.radians(35)
 light=(-east*np.sin(azr)*np.cos(alt)-north*np.cos(azr)*np.cos(alt)+np.sin(alt))/np.sqrt(1+east**2+north**2)
 light=np.where(valid,light,np.nan)
 v=.15+.85*np.clip(light,0,1)
 key=f'hillshade-{az:03}';layers[key]=image(light,v,[(0,0,0),(255,255,255)])[C]
 settings.append({'id':key,'label':f'Hillshade · light {az}°','azimuthDegrees':az,'altitudeDegrees':35,'ambient':.15,'heightExaggeration':1})
layers['elevation']=image(z,(z-lo)/(hi-lo),[(29,51,63),(51,109,117),(133,167,128),(224,204,142),(250,237,206)])[C]
layers['slope']=image(slope,slope/45,[(19,35,54),(52,119,153),(239,195,105),(224,94,76)])[C]
layers['local-relief']=image(relief,(relief+2)/4,[(47,104,177),(220,226,225),(185,77,55)])[C]
layers['support']=np.array([[13,17,23],[63,185,80],[210,153,34]],dtype='uint8')[support[C]]
settings += [{'id':'elevation','label':'Elevation','rangeMetres':[lo,hi],'palette':['#1d333f','#336d75','#85a780','#e0cc8e','#faedce']},{'id':'slope','label':'Slope','rangeDegrees':[0,45],'palette':['#132336','#347799','#efc369','#e05e4c']},{'id':'local-relief','label':'Local relief','rangeMetres':[-2,2],'baselineGaussianSigmaMetres':10,'baselineRadiusMetres':30,'palette':['#2f68b1','#dce2e1','#b94d37']},{'id':'support','label':'Ground support','categories':{'0':'NoData · dark','1':'Measured cell · green','2':'Interpolated cell · amber'}}]
def world(p,b):p.with_suffix('.pgw').write_text(f'0.5\n0\n0\n-0.5\n{b[0]+.25}\n{b[3]-.25}\n')
def tiff(p,a,b,nodata):
 a=np.where(np.isfinite(a),a,nodata).astype('float32')
 tags=TiffImagePlugin.ImageFileDirectory_v2()
 for tag,value,typ in [(33550,(.5,.5,0.),12),(33922,(0.,0.,0.,float(b[0]),float(b[3]),0.),12),(34735,(1,1,0,4,1024,0,1,1,1025,0,1,1,3072,0,1,3763,3076,0,1,9001),3),(42113,str(nodata),2),(270,'Locally derived DGT ground terrain; EPSG:3763; heights in metres, Cascais datum. See provenance.json.',2)]:tags[tag]=value;tags.tagtype[tag]=typ
 Image.fromarray(a).save(p,compression='tiff_adobe_deflate',tiffinfo=tags)
def stats(a,s,c):
 return {'validCells':int(np.isfinite(a).sum()),'measuredCells':int((s==1).sum()),'interpolatedCells':int((s==2).sum()),'noDataCells':int((s==0).sum()),'groundReturns':int(c.sum()),'elevationMinMetres':float(np.nanmin(a)),'elevationMaxMetres':float(np.nanmax(a))}
# Context images, full study terrain, raw measured-cell means, and return counts.
context=OUT/'context';context.mkdir(exist_ok=True)
for key,a in layers.items():
 p=context/(key+'.png');Image.fromarray(a).save(p);world(p,B)
tiff(context/'terrain.tif',zs,B,-9999)
raw=np.divide(sums,counts,out=np.full_like(sums,np.nan),where=counts>0)[C]
tiff(context/'raw-ground-mean.tif',raw,B,-9999)
tiff(context/'ground-return-count.tif',counts[C],B,-9999)
Image.fromarray(support[C]).save(context/'support-codes.png');world(context/'support-codes.png',B)
patches=[]
for r in range(5):
 for c in range(5):
  pid=f'village-r{r+1:02}-c{c+1:02}';folder=OUT/'patches'/pid;folder.mkdir(parents=True,exist_ok=True)
  y,x=r*200,c*200;sl=(slice(y,y+400),slice(x,x+400));b=[B[0]+c*100,B[3]-r*100-200,B[0]+c*100+200,B[3]-r*100]
  assets={}
  for key,a in layers.items():
   p=folder/(key+'.png');Image.fromarray(a[sl]).save(p);world(p,b);assets[key]=str(p.relative_to(OUT))
  tiff(folder/'terrain.tif',zs[sl],b,-9999)
  record={'id':pid,'row':r+1,'column':c+1,'boundsEPSG3763':b,'pixelWindow':[x,y,400,400],'stats':stats(zs[sl],support[C][sl],counts[C][sl]),'images':assets,'terrain':str((folder/'terrain.tif').relative_to(OUT))}
  record['stats']['localReliefClippedCells']=int((np.abs(relief[C][sl])>2).sum());record['stats']['slopeClippedCells']=int((slope[C][sl]>45).sum())
  patches.append(record)
manifest={'name':'Aldeia da Mata · village ground-image review dataset','version':1,'created':'2026-11-12','crs':'EPSG:3763','verticalDatum':'Cascais','boundsEPSG3763':B,'areaSquareMetres':360000,'resolutionMetres':RES,'northUp':True,'patchSizeMetres':200,'strideMetres':100,'overlapPercent':50,'imagePixels':[400,400],'rowOrder':'north to south','columnOrder':'west to east','noDataRGB':DARK.tolist(),'stats':stats(zs,support[C],counts[C]),'layers':settings,'patches':patches,'context':{k:'context/'+k+'.png' for k in layers}}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');(OUT/'manifest.js').write_text('window.VILLAGE_ANALYSIS='+json.dumps(manifest)+';\n')
with (OUT/'manifest.csv').open('w',newline='') as f:
 w=csv.writer(f);w.writerow(['id','xmin','ymin','xmax','ymax','crs','pixel_size_m','valid_cells','measured_cells','interpolated_cells','nodata_cells','ground_returns','terrain']);
 for p in patches:w.writerow([p['id'],*p['boundsEPSG3763'],'EPSG:3763',.5,*[p['stats'][k] for k in ['validCells','measuredCells','interpolatedCells','noDataCells','groundReturns']],p['terrain']])
# Never replace a human-edited review table on rebuild.
if not (OUT/'review.csv').exists():
 with (OUT/'review.csv').open('w',newline='') as f:
  w=csv.writer(f);w.writerow(['patch_id','status','visible_geometry','alternative_explanations','raw_ground_check','prior_mapping_check','confidence','notes']);w.writerows([[p['id'],'unreviewed','','','','','',''] for p in patches])
(OUT/'footprints-epsg3763.json').write_text(json.dumps({'crs':'EPSG:3763','note':'Projected coordinates in metres; deliberately not WGS84 GeoJSON.','patches':[{'id':p['id'],'ring':[[p['boundsEPSG3763'][i],p['boundsEPSG3763'][j]] for i,j in [(0,1),(2,1),(2,3),(0,3),(0,1)]]} for p in patches]},indent=2)+'\n')
source=json.loads((CACHE/'source-support.json').read_text())
provenance={'source':'Direção-Geral do Território (DGT), public LiDAR viewer','sourcePage':'https://www.dgterritorio.gov.pt/levantamento-lidar-de-portugal-continental-0','attribution':'Source © Direção-Geral do Território, CC BY 4.0. Locally derived images and ground model.','referenceArticle':'https://pietromiotti.com/latest/maya-site/','referenceScope':'Inspired by image-based terrain screening. Article does not publish patch dimensions or overlap; these parameters are our own. No feature labels or discovery claims.','terrainProcessingReference':'../data/max-detail-provenance.json','terrainProcessingReferenceSha256':sha(DATA/'max-detail-provenance.json'),'terrainMethod':'Class 2 ground mean per 0.5 m cell; source model uses 0.25 m Gaussian smoothing, nearest gap support up to 5 m, CAOP2025 mask; centimetre-quantized stored tiles. No additional terrain smoothing here.','derivatives':'North-up ENU central differences at 0.5 m. Derivatives require valid immediate neighbours; otherwise dark NoData. Hillshades use ambient 0.15, direct 0.85, sun altitude 35 degrees, no exaggeration. All layers calculated over a 32 m halo before pixel-aligned cropping.','localRelief':'Terrain minus normalized separable Gaussian (sigma 10 m, radius 30 m); ignores missing cells and restores original validity. Common colour range +/-2 m.','supportMask':'0 invalid model; 1 valid model with at least one raw ground return in cell; 2 valid model without raw returns in cell. Measured cells still contain smoothed model values. Counts use all cached hierarchy levels and the same per-source 1 km footprint as model construction.','overlapWarning':'Overlapping crops are not independent samples. For training/evaluation split by non-overlapping spatial blocks, not random patch IDs.','sourceSupport':source,'terrainTiles':used}
(OUT/'provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
# Legible, separate contact sheet: analysis pixels above remain unannotated.
sheet=Image.new('RGB',(1100,1190),(13,17,23));draw=ImageDraw.Draw(sheet)
draw.text((20,15),'ALDEIA DA MATA / VILLAGE GROUND PATCHES',fill='#e6edf3');draw.text((20,36),'200 m squares / 100 m stride / 0.5 m cells / north up / light NW',fill='#8b949e')
for p in patches:
 im=Image.open(OUT/p['images']['hillshade-315']).resize((200,200));x=10+(p['column']-1)*220;y=75+(p['row']-1)*222;sheet.paste(im,(x,y));draw.text((x,y+204),p['id'],fill='#c9d1d9')
sheet.save(OUT/'contact-sheet.jpg',quality=92)
checksums={str(p.relative_to(OUT)):sha(p) for p in sorted(OUT.rglob('*')) if p.is_file() and (p.suffix in ['.png','.tif','.pgw'] or p.name in ['manifest.json','provenance.json','footprints-epsg3763.json'])}
(OUT/'checksums.json').write_text(json.dumps(checksums,indent=2)+'\n')
print(json.dumps({'patches':len(patches),'stats':manifest['stats'],'elevationRange':[lo,hi],'out':str(OUT)},indent=2))
