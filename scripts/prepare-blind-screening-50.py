"""Prepare anonymized PNG-only review inputs; keep the evaluator key separate."""
import hashlib,json,math,random,shutil,struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];DATA=ROOT/'docs/aldeia-da-mata/analysis-parish';WORK=Path('/private/tmp/aldeia-blind50-20261116');KEY=Path('/private/tmp/aldeia-blind50-evaluator-key.json');SEED=2026111650
if WORK.exists() or KEY.exists():raise SystemExit('Blind batch already exists; do not silently re-randomize it.')
m=json.loads((DATA/'manifest.json').read_text());prior={p['patchId'] for p in json.loads((DATA/'screening-pilot/reviews.json').read_text())['patches']};text=(ROOT/'docs/aldeia-da-mata/data/archaeology-parish.js').read_text();ar=json.loads(text.split('=',1)[1].rstrip(';\n'));sites={r['cns']:r for r in ar['records']if r['position']};rng=random.Random(SEED);pool=[p for p in m['patches']if p['id']not in prior];positive=[p for p in pool if p['inventoryPointCns']];chosen=[]
# At least one new crop per mapped record; favour reference points away from crop edges.
for cns in sorted(sites):
 candidates=[p for p in positive if cns in p['inventoryPointCns'] and p not in chosen]
 def margin(p):
  x,y=sites[cns]['position'];b=p['boundsEPSG3763'];return min(x-b[0],b[2]-x,y-b[1],b[3]-y)
 chosen.append(max(candidates,key=margin))
rest=[p for p in positive if p not in chosen];rng.shuffle(rest);chosen+=rest[:3];positive_ids={p['id']for p in chosen};assert len(chosen)==8
buckets=[('high_support',32,lambda p:p['stats']['validCells']>=152000 and p['stats']['measuredCells']>=128000),('intermediate_support',6,lambda p:104000<=p['stats']['validCells']<152000 and p['stats']['measuredCells']>=80000),('boundary_support',4,lambda p:16000<=p['stats']['validCells']<104000)]
strata={p['id']:'reference_point_crop'for p in chosen}
def centre(p):b=p['boundsEPSG3763'];return b[0]+100,b[1]+100
for name,count,test in buckets:
 candidates=[p for p in pool if not p['inventoryPointCns']and test(p)];rng.shuffle(candidates);n=0
 for p in candidates:
  x,y=centre(p)
  if any(math.hypot(x-centre(q)[0],y-centre(q)[1])<300 for q in chosen):continue
  chosen.append(p);strata[p['id']]=name;n+=1
  if n==count:break
 if n!=count:raise RuntimeError('Could not fill '+name)
assert len(chosen)==50 and len({p['id']for p in chosen})==50 and not prior.intersection(p['id']for p in chosen)
rng.shuffle(chosen);layers=['hillshade-045','hillshade-135','hillshade-315','local-relief','support'];cases=[];key=[];input_hashes={}
for n,p in enumerate(chosen,1):
 case=f'B{n:03}';folder=WORK/'images'/case;folder.mkdir(parents=True)
 for layer in layers:
  src=DATA/p['images'][layer];dst=folder/(layer+'.png');shutil.copyfile(src,dst);dst.chmod(0o444);b=dst.read_bytes();offset=8;chunks=[]
  while offset<len(b):
   length=struct.unpack('>I',b[offset:offset+4])[0];kind=b[offset+4:offset+8].decode('ascii');chunks.append(kind);offset+=length+12
  if set(chunks)-{'IHDR','PLTE','IDAT','IEND','tRNS'}:raise RuntimeError('Unexpected PNG metadata '+str(dst)+str(chunks))
  input_hashes[case+'/'+layer+'.png']=hashlib.sha256(b).hexdigest()
 cases.append(case);b=p['boundsEPSG3763'];refs=[]
 for cns in p['inventoryPointCns']:
  s=sites[cns];x,y=s['position'];refs.append({'cns':cns,'name':s['name'],'type':s['type'],'pixelXY':[(x-b[0])*2,(b[3]-y)*2],'url':s['url']})
 key.append({'case':case,'patchId':p['id'],'boundsEPSG3763':b,'stratum':strata[p['id']],'referencePointCrop':p['id']in positive_ids,'references':refs,'supportStats':p['stats']})
(WORK/'results').mkdir();(WORK/'inputs.json').write_text(json.dumps({'cases':cases,'images':layers,'pixels':[400,400],'northUp':True,'pixelSizeMetres':.5,'patchSizeMetres':200,'displayNotes':{'hillshade':'Azimuths 45/135/315 degrees, altitude 35 degrees, height x1.','localRelief':'Terrain minus a 10 m Gaussian baseline; blue low/red high; +/-2 m display range.','support':'Green measured model cells; amber interpolated model cells; dark missing model. Measured model heights are smoothed.'}},indent=2)+'\n')
protocol='''# Anonymous terrain image review protocol
Review only your assigned case IDs in this directory, using the five PNGs listed in inputs.json. Do not read files outside this anonymous input directory, repository guides, inventories, web pages, previous reviews or other workers' results. Do not spawn agents. Do not infer geographic identity. The user requires a metadata-blind visual screening stage.

These are 200 m north-up ground-model squares, 400 x 400 pixels at 0.5 m. Inspect ALL FIVE images for every case using view_image. Read one case at a time, using all three lights, local relief and support. Record observable geometry and reasonable natural/modern/processing alternatives. Consider coherent mounds/platforms, enclosures, ditches or arrangements where visible, but do not force a candidate into every image. Agriculture, rock, erosion, tracks, classification and missing/interpolated cells are alternatives. Never infer age, use, archaeology, novelty or absence of archaeology from images alone.

For each case produce: case; imagesInspected (five names); visibleGeometry (<=65 words); alternatives (<=40 words); supportLimits (<=40 words); followUp (none/low/medium/high); candidates (0-3 localized features worth further checking). Each candidate has feature, pixelCentre [x,y], pixelBox [left,top,right,bottom] in 0..400 coordinates (origin top-left, y increases south), confidence (low/medium/high), and nextCheck. Boxes/centres are approximate visual annotations, not calculated field coordinates. If only broad field texture or no localized follow-up feature is visible, candidates can be empty. Keep all claims tentative. Ensure centre is inside its box.

Write your own assigned output JSON as {"cases":[...]} in results/. Checkpoint it after each case. Do not modify images, inputs or any other output. At completion report case count, image count and output path; do not repeat every note in chat. If a file cannot be inspected, record the failure rather than inventing an observation. No account-usage or elapsed-time estimates unless actually measured.
'''
(WORK/'PROTOCOL.md').write_text(protocol)
private={'seed':SEED,'workDirectory':str(WORK),'cases':key,'imagesPerCase':layers,'inputHashes':input_hashes,'selectionNotes':'50 additional IDs excluding the prior ten; 8 reference-point crops across 5 mapped inventory records; 32 high-support, 6 intermediate-support, 4 boundary crops without points in crop. Reference-free crops are not verified negatives. Other crops are separated >=300 m from selected crop centres. Controls may overlap each other and earlier pilot terrain.','archaeologySnapshot':ar['checked']};KEY.write_text(json.dumps(private,indent=2)+'\n');digest=hashlib.sha256(KEY.read_bytes()).hexdigest();(WORK/'key-commitment.txt').write_text(digest+'\n')
print(json.dumps({'work':str(WORK),'privateKey':str(KEY),'keySha256':digest,'caseCount':50,'controls':8,'mappedRecords':len(sites),'workers':{'a':cases[:17],'b':cases[17:34],'c':cases[34:]},'pngCount':len(input_hashes)},indent=2))
