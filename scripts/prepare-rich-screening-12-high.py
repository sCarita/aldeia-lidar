"""Reuse exactly the committed low-run images and protocol for a fresh high-effort run."""
import hashlib,json,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'docs/aldeia-da-mata/analysis-parish/screening-rich-12';OUT=BASE.with_name('screening-rich-12-high');WORK=Path('/private/tmp/aldeia-rich12-high-20261116')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
if OUT.exists() or WORK.exists():raise SystemExit('High-effort experiment already exists; do not overwrite.')
OUT.mkdir();WORK.mkdir();key=json.loads((BASE/'evaluator-key.json').read_text())
assert sha(BASE/'evaluator-key.json')==(BASE/'key-commitment.txt').read_text().strip()
layers=json.loads((BASE/'anonymous-inputs.json').read_text())
for arm,names in layers.items():
 d=WORK/arm;(d/'results').mkdir(parents=True);shutil.copyfile(BASE/'reviewer-protocol.md',d/'PROTOCOL.md')
 (d/'inputs.json').write_text(json.dumps({'cases':[k['case'] for k in key['cases']],'layers':names},indent=2)+'\n')
 for case in key['cases']:
  dest=d/'images'/case['case'];dest.mkdir(parents=True)
  for name in names:
   src=BASE/'packages'/case['case']/(name+'.png');rel=f'{arm}/images/{case["case"]}/{name}.png';assert sha(src)==key['inputHashes'][rel]
   dst=dest/src.name;shutil.copyfile(src,dst);dst.chmod(0o444);assert sha(dst)==key['inputHashes'][rel]
for name in ['reviewer-protocol.md','anonymous-inputs.json','key-commitment.txt','evaluation-protocol.json']:shutil.copyfile(BASE/name,OUT/name)
shutil.copyfile(BASE/'evaluator-key.json','/private/tmp/aldeia-rich12-high-evaluator-key.json')
provenance={'model':'gpt-6-sol','reasoningEffort':'high','images':'Byte-identical to screening-rich-12 packages; 204 image inspections, no new rasters.','sourceExperiment':'../screening-rich-12/','keyCommitment':sha(BASE/'evaluator-key.json'),'sameProtocolSha256':sha(BASE/'reviewer-protocol.md'),'sameEvaluationSha256':sha(BASE/'evaluation-protocol.json'),'blinding':'Six fresh reviewer contexts; anonymous arm folders only; previous outputs, identities and key withheld. Procedural file-access restriction, not OS sandbox.','assignments':{'a':['R01','R02','R03','R04'],'b':['R05','R06','R07','R08'],'c':['R09','R10','R11','R12']},'concurrency':'Two waves, at most three reviewers; separate fresh worker for every arm/group.','limitations':'Same repeated overlapping reference-point crops; no new independently verified visible features or negatives. Historical low run is a one-shot comparison, not a randomized replicated effort experiment.'}
(OUT/'provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
html=(BASE/'index.html').read_text().replace('Landmark input comparison · Aldeia da Mata','Sol high · Landmark input comparison').replace('Do richer views help locate known landmarks?','Sol high: do richer views help locate landmarks?').replace('using Sol low and three concurrent reviewers.','using Sol high and three concurrent reviewers. Image bytes, prompt and evaluation rules match the previous Sol low run.').replace('`packages/${r.case}/${l}.png`','`../screening-rich-12/packages/${r.case}/${l}.png`')
(OUT/'index.html').write_text(html)
print(json.dumps({'work':str(WORK),'casesPerArm':12,'images':len(key['inputHashes']),'keyCommitment':sha(BASE/'evaluator-key.json')},indent=2))
