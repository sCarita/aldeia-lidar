"""Fixed anonymous paired input experiment; evaluator key is outside reviewer folders."""
import base64,gzip,hashlib,json,math,random,shutil
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from parish_analysis_common import ROOT,DATA,OUT,window,DARK,sha
DEST=OUT/'screening-rich-12';WORK=Path('/private/tmp/aldeia-rich12-20261116')
if DEST.exists() or WORK.exists():raise SystemExit('Experiment already exists; do not overwrite.')
DEST.mkdir();WORK.mkdir()
def js(p):return json.loads(p.read_text().split('=',1)[1].rstrip(';\n'))
manifest=json.loads((OUT/'manifest.json').read_text());arch=js(DATA/'archaeology-parish.js');sites={s['cns']:s for s in arch['records'] if s['position']}
pool=[p for p in manifest['patches'] if p['inventoryPointCns']];chosen=[]
# Round-robin across records, best interior margins first, retaining distinct crops.
for turn in range(3):
 for cns,s in sorted(sites.items()):
  candidates=[p for p in pool if cns in p['inventoryPointCns'] and p not in chosen]
  def score(p):
   x,y=s['position'];b=p['boundsEPSG3763'];return min(x-b[0],b[2]-x,y-b[1],b[3]-y)
  if candidates and len(chosen)<12:chosen.append(max(candidates,key=score))
assert len(chosen)==12 and set(sites)=={c for p in chosen for c in p['inventoryPointCns']}
random.Random(2026111612).shuffle(chosen)
BASE=['hillshade-045','hillshade-135','hillshade-315','local-relief','support']
EXTRA=['hillshade-225','slope','sky-view-factor','terrain-context','aerial-patch','aerial-context','point-classes']
aerial=js(DATA/'aerial-2025-index.js');source_hashes={};output_hashes={}
def image_source(p):source_hashes[str(p.relative_to(ROOT))]=sha(p);return Image.open(p).convert('RGB')
def photo(b,level):
 scale=.25*2**level;size=128*2**level;x0=math.floor(b[0]/size);y0=math.floor(b[1]/size);x1=math.ceil(b[2]/size);y1=math.ceil(b[3]/size)
 im=Image.new('RGB',((x1-x0)*512,(y1-y0)*512),tuple(DARK))
 for y in range(y0,y1):
  for x in range(x0,x1):
   t=aerial['tiles'].get(f'{level}/{x}/{y}')
   if t:
    p=DATA.parent/t['url'];assert sha(p)==t['sha256'];im.paste(image_source(p),((x-x0)*512,(y1-y-1)*512))
 return im.crop((round((b[0]-x0*size)/scale),round((y1*size-b[3])/scale),round((b[2]-x0*size)/scale),round((y1*size-b[1])/scale)))
def hill(z):
 r,c=np.gradient(z,.5);n=-r;a=np.radians(315);alt=np.radians(35)
 light=(-c*np.sin(a)*np.cos(alt)-n*np.cos(a)*np.cos(alt)+np.sin(alt))/np.sqrt(1+c*c+n*n)
 gray=(255*(.15+.85*np.clip(np.nan_to_num(light),0,1))).astype('uint8');rgb=np.repeat(gray[:,:,None],3,axis=2);rgb[~np.isfinite(light)]=DARK
 return Image.fromarray(rgb)
def svf(z):
 # 16 azimuths, 1..20 m in 1 m steps. Need all horizons supported: no missing interpolation.
 n=400;centre=z[40:440,40:440];total=np.zeros((n,n));valid=np.isfinite(centre)
 for a in np.linspace(0,2*np.pi,16,endpoint=False):
  horizon=np.zeros((n,n));supported=np.ones((n,n),bool)
  for distance in range(1,21):
   dx=round(2*distance*np.cos(a));dy=round(2*distance*np.sin(a));v=z[40+dy:440+dy,40+dx:440+dx];supported &= np.isfinite(v)
   angle=np.arctan2(v-centre,math.hypot(dx,dy)*.5);horizon=np.maximum(horizon,np.nan_to_num(angle))
  total+=np.cos(horizon)**2;valid &= supported
 value=total/16;gray=np.clip((value-.85)/.15*255,0,255).astype('uint8');rgb=np.repeat(gray[:,:,None],3,axis=2);rgb[~valid]=DARK
 return Image.fromarray(rgb),int(valid.sum())
def points(b,background):
 im=background.copy().resize((800,800));draw=ImageDraw.Draw(im);counts={}
 for layer,col in [('buildings',(135,167,192)),('bridges',(229,173,69)),('water',(64,169,219)),('unclassified',(208,156,242))]:
  m=js(DATA/(layer+'-parish-index.js'));count=0
  for t in m['tiles'].values():
   q=t['bounds']
   if q[0]>=b[2] or q[2]<=b[0] or q[1]>=b[3] or q[3]<=b[1]:continue
   p=DATA.parent/t['url'];s=p.read_text();packet=json.loads(s[s.rfind('={')+1:].rstrip(';\n'));raw=gzip.decompress(base64.b64decode(packet['payload']));assert hashlib.sha256(raw).hexdigest()==t['sha256'];source_hashes[str(p.relative_to(ROOT))]=sha(p)
   n=int(np.frombuffer(raw,dtype='<u4',count=1)[0]);v=np.frombuffer(raw,dtype='<f4',offset=8,count=n*4).reshape(-1,4);v=v[(v[:,0]>=b[0])&(v[:,0]<b[2])&(v[:,1]>b[1])&(v[:,1]<=b[3])];count+=len(v)
   for x,y,z,_ in v:
    px=(float(x)-b[0])*4;py=(b[3]-float(y))*4;draw.ellipse((px-1,py-1,px+1,py+1),fill=col)
  counts[layer]=count
 return im,counts
keys=[]
for i,p in enumerate(chosen,1):
 case=f'R{i:02}';b=p['boundsEPSG3763'];rich=DEST/'packages'/case;rich.mkdir(parents=True)
 for layer in BASE+['hillshade-225','slope']:
  src=OUT/p['images'][layer];shutil.copyfile(src,rich/(layer+'.png'));source_hashes[str(src.relative_to(ROOT))]=sha(src)
 z=window([b[0]-20,b[1]-20,b[2]+20,b[3]+20]);sv,valid=svf(z);sv.save(rich/'sky-view-factor.png')
 cb=[b[0]-300,b[1]-300,b[2]+300,b[3]+300];context=hill(window(cb)).resize((800,800),Image.Resampling.LANCZOS);ImageDraw.Draw(context).rectangle((300,300,500,500),outline=(255,191,80),width=2);context.save(rich/'terrain-context.png')
 photo(b,0).save(rich/'aerial-patch.png');context=photo(cb,2);ImageDraw.Draw(context).rectangle((300,300,500,500),outline=(255,191,80),width=2);context.save(rich/'aerial-context.png')
 overlay,pc=points(b,Image.open(rich/'hillshade-315.png').convert('RGB'));overlay.save(rich/'point-classes.png')
 refs=[{'cns':c,'name':sites[c]['name'],'type':sites[c]['type'],'pixelXY':[(sites[c]['position'][0]-b[0])*2,(b[3]-sites[c]['position'][1])*2]}for c in p['inventoryPointCns']]
 keys.append({'case':case,'patchId':p['id'],'boundsEPSG3763':b,'references':refs,'supportStats':p['stats'],'svfSupportedCells':valid,'pointCounts':pc})
 for arm,layers in [('baseline',BASE),('enriched',BASE+EXTRA)]:
  d=WORK/arm/'images'/case;d.mkdir(parents=True)
  for layer in layers:
   src=rich/(layer+'.png');dst=d/src.name;shutil.copyfile(src,dst);dst.chmod(0o444);output_hashes[f'{arm}/images/{case}/{src.name}']=sha(dst)
 print(case,'prepared',flush=True)
protocol='''Review anonymous terrain packages using only your assigned arm directory. Do not read repository guides, inventories, outside files, other workers, previous notes or web sources. Do not spawn agents. Geographic identity and known records are withheld. Do not infer whether a case is a control. Inspect EVERY listed image using view_image.
All patch layers are north-up 200 m squares. Annotation coordinates MUST use 0..400 in both arms, regardless of displayed pixel dimensions. Centre is [200,200]. Context images are 800 m squares at 1 m/pixel; the amber box marks the central 200 m patch, NOT a feature. Aerial patch and point overlay are 800 pixels at .25 m/pixel; divide their image coordinates by two for annotations. Aerial context is 800 pixels at 1 m/pixel. Baseline layers are 400 pixels at .5 m/pixel. Use the context for interpretation, but annotate only inside the central patch.
Hillshades: azimuth in filename, 35 degree altitude, height x1. Local relief: terrain minus 10 m Gaussian baseline, blue low/red high, range +/-2 m. Support: green measured smoothed model, amber interpolated, dark missing. Slope: 0..45 degrees, dark blue through yellow to red. Sky-view factor: 16 directions, 1..20 m horizons, fixed display range .85..1 (black low/white high), dark blue missing if any sampled neighbour is missing; it is a model derivative. Point classes: blue-grey class 6 structures, amber class 26 decks, blue class 9 water, lilac class 1 mixed/unclassified, over terrain; highest measured .5 m cell representatives, no vegetation overlay. Neither classes nor colours label archaeology. Terrain is derived from 2024-named source files; RGB photographs are 2025, exact local dates unverified. Aerial image detail and classification can disagree. No additional physical detail is created by resampling.
Describe visible geometry and plausible natural, modern or processing alternatives. Potential follow-up features include coherent mounds, platforms, stone/structure arrangements, enclosures or ditches. Do not force candidates. Never conclude age, use, archaeology, novelty or absence from images alone.
Output JSON {"cases":[...]} with each case: case; imagesInspected (all supplied layer names); visibleGeometry <=65 words; alternatives <=40 words; supportLimits <=40 words; followUp (none/low/medium/high); candidates (0..3). Each candidate: feature, pixelCentre [x,y], pixelBox [left,top,right,bottom], confidence (low/medium/high), nextCheck. Centres must be inside boxes; all coordinates 0..400. Add evidenceLayers to each candidate listing images supporting the observation. Annotations are approximate. Checkpoint after every case to your assigned output path, inside your arm's results/. Do not alter inputs or other outputs. Report count/path and failures when finished. No usage or time guesses.
'''
for arm,layers in [('baseline',BASE),('enriched',BASE+EXTRA)]:
 d=WORK/arm;(d/'results').mkdir();(d/'PROTOCOL.md').write_text(protocol);(d/'inputs.json').write_text(json.dumps({'cases':[k['case']for k in keys],'layers':layers},indent=2)+'\n')
key={'seed':2026111612,'cases':keys,'note':'All crops contain official reference points; three rounds of best interior margin per mapped record capped at 12. Overlap and repeated sites are intentional; not independent samples. Surface visibility is NOT independently established. Prior reviews were not used to label visibility.','inputHashes':output_hashes,'sourceHashes':source_hashes}
keypath=Path('/private/tmp/aldeia-rich12-evaluator-key.json');keypath.write_text(json.dumps(key,indent=2)+'\n');commit=sha(keypath);(DEST/'key-commitment.txt').write_text(commit+'\n')
evaluation={'primary':'Per crop, any candidate centre within 25 m (50 patch pixels) of any inventory reference point. Same rule in both arms.','localizedSecondary':'Primary, plus box area <=16000 patch pixels and maximum side <=200 patch pixels.','interpretation':'Proximity diagnostic only; reference point accuracy, visible remains and feature boundaries are unverified. No accuracy/recall or confirmed discovery claim.','pairedCounts':['baseline-only','enriched-only','both','neither'],'reviewBudget':'12 baseline x5 images +12 enriched x12 images =204 image inspections; fresh workers, at most three concurrent.','blinding':'Fresh contexts; private key outside anonymous folders. File access restriction is procedural, not an OS sandbox. Reviewers not told sample composition.','freeze':'Raw worker outputs must be hashed before key is joined; no reprompting based on control outcomes.'}
(DEST/'evaluation-protocol.json').write_text(json.dumps(evaluation,indent=2)+'\n');(DEST/'reviewer-protocol.md').write_text(protocol);(DEST/'anonymous-inputs.json').write_text(json.dumps({'baseline':BASE,'enriched':BASE+EXTRA},indent=2)+'\n')
print(json.dumps({'work':str(WORK),'keySha256':commit,'cases':12,'images':204,'records':sorted(sites),'packageBytes':sum(p.stat().st_size for p in (DEST/'packages').rglob('*.png'))},indent=2))
