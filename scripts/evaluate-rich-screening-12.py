"""Freeze anonymous outputs, validate, then join the precommitted evaluator key."""
import collections,csv,hashlib,json,math,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/aldeia-da-mata/analysis-parish/screening-rich-12';WORK=Path('/private/tmp/aldeia-rich12-20261116')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
keypath=Path('/private/tmp/aldeia-rich12-evaluator-key.json')
assert sha(keypath)==(OUT/'key-commitment.txt').read_text().strip()
key=json.loads(keypath.read_text());protocol=json.loads((OUT/'anonymous-inputs.json').read_text());raw_hashes={};arms={}
for arm in ['baseline','enriched']:
 rows=[]
 for worker,ids in [('a',range(1,5)),('b',range(5,9)),('c',range(9,13))]:
  p=WORK/arm/'results'/(worker+'.json');raw=json.loads(p.read_text());cases=raw['cases'];assert {c['case'] for c in cases}=={f'R{i:02}' for i in ids}
  assert not re.search(r'Tapad[aã]o|Domingas|Coito|Lage do Ouro|Aldeia|\bCNS\b',p.read_text(),re.I),'Place/record leakage in notes'
  for c in cases:
   assert set(c['imagesInspected'])==set(protocol[arm]);assert c['followUp'] in ['none','low','medium','high'];assert len(c['candidates'])<=3
   for q in c['candidates']:
    x,y=q['pixelCentre'];l,t,r,b=q['pixelBox'];assert 0<=l<=x<=r<=400 and 0<=t<=y<=b<=400
    assert q['confidence'] in ['low','medium','high'];assert q['evidenceLayers'] and set(q['evidenceLayers'])<=set(protocol[arm])
  dst=OUT/(arm+'-'+worker+'.json');dst.write_bytes(p.read_bytes());raw_hashes[dst.name]=sha(dst);rows+=cases
 assert len(rows)==12 and len({c['case'] for c in rows})==12
 arms[arm]={c['case']:c for c in rows}
# All raw output hashes frozen before associating any reference point with observations.
(OUT/'frozen-output-hashes.json').write_text(json.dumps(raw_hashes,indent=2)+'\n')
for f,h in key['inputHashes'].items():assert sha(WORK/f)==h
for f,h in key['sourceHashes'].items():assert sha(ROOT/f)==h
joined=[];paired=collections.Counter();localized=collections.Counter();priorities={arm:dict(collections.Counter(c['followUp']for c in arms[arm].values()))for arm in arms}
for k in key['cases']:
 row={**k,'reviews':{}}
 for arm in arms:
  c=arms[arm][k['case']];matches=[]
  for ref in k['references']:
   ds=[]
   for q in c['candidates']:
    x,y=q['pixelCentre'];rx,ry=ref['pixelXY'];l,t,r,b=q['pixelBox'];d=math.hypot(x-rx,y-ry)*.5
    ds.append({'distanceMetres':d,'localized':(r-l)*(b-t)<=16000 and max(r-l,b-t)<=200})
   matches.append({'cns':ref['cns'],'nearestCandidateMetres':min((d['distanceMetres']for d in ds),default=None),'within25m':any(d['distanceMetres']<=25 for d in ds),'localizedWithin25m':any(d['distanceMetres']<=25 and d['localized']for d in ds)})
  row['reviews'][arm]={**c,'referenceComparison':matches,'anyWithin25m':any(m['within25m']for m in matches),'anyLocalizedWithin25m':any(m['localizedWithin25m']for m in matches)}
 a,b=[row['reviews'][arm]['anyWithin25m']for arm in ['baseline','enriched']];label='both'if a and b else'baseline-only'if a else'enriched-only'if b else'neither';paired[label]+=1
 a,b=[row['reviews'][arm]['anyLocalizedWithin25m']for arm in ['baseline','enriched']];localized['both'if a and b else'baseline-only'if a else'enriched-only'if b else'neither']+=1
 joined.append(row)
summary={'patches':12,'uniqueMappedRecords':len({r['cns'] for k in key['cases']for r in k['references']}),'reviews':24,'imageInspections':204,'model':'gpt-6-sol','reasoningEffort':'low','maxConcurrentReviewers':3,'freshReviewerContexts':6,'pairing':{k:paired[k]for k in ['baseline-only','enriched-only','both','neither']},'localizedPairing':{k:localized[k]for k in ['baseline-only','enriched-only','both','neither']},'priorities':priorities,'arms':{arm:{'nearReferenceCrops':sum(r['reviews'][arm]['anyWithin25m']for r in joined),'localizedNearReferenceCrops':sum(r['reviews'][arm]['anyLocalizedWithin25m']for r in joined),'candidateAnnotations':sum(len(c['candidates'])for c in arms[arm].values()),'casesWithCandidates':sum(bool(c['candidates'])for c in arms[arm].values())}for arm in arms},'limitations':['All 12 crops contain reference points; repeated/overlapping crops across five records are not independent.','Record points do not define feature extents or establish visible surviving remains; proximity is not identification, precision or recall.','No verified negative controls or independently annotated visible landmark boundaries; no general survey accuracy estimate.','Different fresh workers and one run per arm: reviewer variation and richer image budget are confounded with input changes. No attribution to a single added layer.','Procedural blinding, not technical filesystem isolation; outputs checked for obvious place/record strings.','No live inventory, publication, field or original full-resolution point-cloud verification performed by reviewers.']}
(OUT/'evaluator-key.json').write_bytes(keypath.read_bytes())
for name,obj in [('comparison.json',joined),('summary.json',summary)]: (OUT/name).write_text(json.dumps(obj,indent=2)+'\n')
(OUT/'comparison.js').write_text('window.RICH12='+json.dumps({'summary':summary,'cases':joined},separators=(',',':'))+';\n')
with (OUT/'comparison.csv').open('w',newline='')as f:
 w=csv.writer(f);w.writerow(['case','patch','CNS','baseline_priority','enriched_priority','baseline_within25m','enriched_within25m','baseline_candidates','enriched_candidates'])
 for r in joined:w.writerow([r['case'],r['patchId'],';'.join(str(s['cns'])for s in r['references']),r['reviews']['baseline']['followUp'],r['reviews']['enriched']['followUp'],r['reviews']['baseline']['anyWithin25m'],r['reviews']['enriched']['anyWithin25m'],len(r['reviews']['baseline']['candidates']),len(r['reviews']['enriched']['candidates'])])
print(json.dumps(summary,indent=2))
