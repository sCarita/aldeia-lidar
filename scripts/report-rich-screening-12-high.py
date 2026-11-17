"""Summarize the frozen high run beside the existing low run, without altering either review."""
import json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'docs/aldeia-da-mata/analysis-parish/screening-rich-12';OUT=BASE.with_name('screening-rich-12-high')
high=json.loads((OUT/'summary.json').read_text());low=json.loads((BASE/'summary.json').read_text());hr=json.loads((OUT/'comparison.json').read_text());lr=json.loads((BASE/'comparison.json').read_text());old={r['case']:r for r in lr};usage=json.loads((OUT/'usage-summary.json').read_text())
assert high['reasoningEffort']=='high' and low['reasoningEffort']=='low'
for r in hr:assert r['patchId']==old[r['case']]['patchId'] and r['references']==old[r['case']]['references']
effort={'model':'gpt-6-sol','sameInputsProtocolAndScoring':True,'patches':12,'arms':{},'cases':[]}
for arm in ['baseline','enriched']:
 counts={'low-only':0,'high-only':0,'both':0,'neither':0}
 for r in hr:
  l=old[r['case']]['reviews'][arm]['anyWithin25m'];h=r['reviews'][arm]['anyWithin25m'];counts['both'if l and h else'low-only'if l else'high-only'if h else'neither']+=1
 effort['arms'][arm]={'low':low['arms'][arm],'high':high['arms'][arm],'pairedReferenceProximity':counts}
for r in hr:effort['cases'].append({'case':r['case'],'patchId':r['patchId'],'references':r['references'],'arms':{arm:{'low':old[r['case']]['reviews'][arm],'high':r['reviews'][arm]}for arm in ['baseline','enriched']}})
(OUT/'effort-comparison.json').write_text(json.dumps(effort,indent=2)+'\n')
def used(s):
 limits=s['rateLimitsByLimitId'];return limits.get('codex',next(iter(limits.values())))['primary']['usedPercent']
before=used(usage['before']);after=used(usage['after']);table=[]
for name,s in [('Sol low',low),('Sol high',high)]:
 for arm,label in [('baseline','Previous five images'),('enriched','Richer twelve images')]:
  q=s['arms'][arm];p=s['priorities'][arm];table.append(f"| {name} | {label} | {q['candidateAnnotations']} | {q['casesWithCandidates']} | {q['nearReferenceCrops']} / 12 | {p.get('none',0)} / {p.get('low',0)} / {p.get('medium',0)} / {p.get('high',0)} |")
percase=[];details=[]
for r in hr:
 a=r['reviews']['baseline'];b=r['reviews']['enriched'];percase.append(f"| {r['case']} | {r['patchId']} | {', '.join(str(q['cns'])for q in r['references'])} | {a['followUp']} / {len(a['candidates'])} | {b['followUp']} / {len(b['candidates'])} | {'yes'if a['anyWithin25m']else'no'} / {'yes'if b['anyWithin25m']else'no'} |")
 for arm,q in r['reviews'].items():
  for ref in q['referenceComparison']:
   if ref['within25m']:details.append(f"- {r['case']}, {arm}, CNS {ref['cns']}: nearest selected centre {ref['nearestCandidateMetres']:.1f} m away. This is proximity, not verified identification.")
report=f'''# Sol high: repeated twelve-patch blind comparison

[Open high-effort side-by-side viewer](index.html) · [Previous Sol low experiment](../screening-rich-12/index.html) · [Machine-readable effort comparison](effort-comparison.json)

## Results

The same twelve patches were reviewed again with `gpt-6-sol`, **high** reasoning effort. Six fresh workers completed 24 reviews / 204 reported image inspections, in two waves of three. No worker saw both input arms. Known records and prior results remained hidden from reviewers.

| Run | Inputs | Candidate annotations | Crops with candidates | Crops with centre within 25 m | Priority none / low / medium / high |
|---|---|---:|---:|---:|---|
'''+ '\n'.join(table)+f'''

High-run paired input result: {high['pairing']['baseline-only']} baseline only, {high['pairing']['enriched-only']} enriched only, {high['pairing']['both']} both, {high['pairing']['neither']} neither, under the same reference-point proximity rule. Localized secondary results are in summary.json.

The single low-run baseline proximity result was R04 near CNS 761; low effort did not identify its archaeological type. High-effort notes, alternatives and exact per-record distances are retained in comparison.json; no archaeological label is inferred from the distance metric.

High-run proximity cases:

'''+ ('\n'.join(details)if details else'No selected candidate centre was within 25 m of a reference point.')+'''

## Same inputs and scoring

The twelve crop IDs, image bytes, input layer lists and reviewer protocol are identical to the low run. Baseline has hillshades 45/135/315, local relief and support. Enriched adds hillshade 225, slope, sky-view factor, 800 m terrain context, patch/context 2025 RGB and the source-class overlay. Image files remain in ../screening-rich-12/packages/ and are reused by the high viewer; there is no duplicated permanent raster bundle. Anonymous reviewer copies were made separately in /private/tmp/aldeia-rich12-high-20261116. High reviewers were not told the sample's site composition, names, coordinates, record types, previous outcomes or any target point. Original case numbering and four-case worker assignments were preserved.

Primary diagnostic remains a selected candidate centre within 25 m / 50 patch pixels of an official reference point. Secondary also requires a box of at most 16,000 patch pixels and maximum side 200 pixels. Annotation coordinates always use the original 0..400 patch frame. No thresholds or prompts were revised after seeing results.

The original key commitment and evaluation protocol were copied before dispatch. The coordinator already knew earlier outcomes; reviewer blinding used fresh empty contexts and explicit restrictions to anonymous arm directories. This was procedural blinding, not an OS filesystem sandbox. All six worker outputs were frozen and hashed before the high-run key join. Obvious place/record strings, complete case/image lists, candidate coordinates and evidence-layer names were checked, along with every input and source hash. The published evaluator key is an exact copy of the prior committed key. Existing low outputs and parish scientific data/review.csv were not edited.

## Interpretation limits

Twelve overlapping reference-point crops cover five mapped records. These are not twelve independent sites. Registry points do not establish visible surviving remains, exact monument footprints or the nature of any selected shape. No visible geometry was independently labelled and no verified negative controls were added. Proximity is therefore not archaeological identification, precision, recall or a validated detection rate. One run per effort/input arm, with different fresh workers, cannot distinguish reasoning-effort effects from reviewer variation. The enriched arm also receives more images. Do not infer a general Sol high advantage or disadvantage from this sample alone. Read the notes and inspect actual visible landmark geometry before selecting a calibration/held-out benchmark.

## Usage

'''+f'''Before preparation/reviews: **{before}% consumed / {100-before}% remaining**. After all six reviewers: **{after}% consumed / {100-after}% remaining**. The meter is shared across the account, rounded and potentially delayed. The interval includes coordinator work and any other account activity. No exact token/per-model cost is available; an unchanged reading does not imply zero consumption. No reset credit or purchase was used. usage-summary.json preserves snapshot times and window fields.

## Cases

| Case | Original patch | Reference CNS | High baseline priority / candidates | High enriched priority / candidates | Within 25 m, baseline / enriched |
|---|---|---|---|---|---|
'''+ '\n'.join(percase)+'''

## Artifacts and reproduction

Frozen baseline-a/b/c.json and enriched-a/b/c.json, frozen-output-hashes.json, comparison.json/CSV/JS, effort-comparison.json, summary.json, usage-summary.json, provenance.json, the precommitted key/protocol and this guide are stored here. The browser viewer has optional post-review reference circles and candidate boxes; these overlays were never in the reviewer images.

`scripts/prepare-rich-screening-12-high.py` verifies and copies the fixed anonymous packages; it refuses to overwrite an existing experiment. `scripts/evaluate-rich-screening-12-high.py` validates/finalizes the six completed worker outputs and joins the committed key. `scripts/report-rich-screening-12-high.py` builds the comparison with the frozen low run. These scripts do not dispatch agents. Preserve the original low package folder when copying the high viewer. DGT imagery credit and processing/source limitations remain in the original package provenance; the separate public archaeology snapshot has separate reuse limitations.
'''
(OUT/'README.md').write_text(report)
# Present the effort comparison in the HTML without modifying any observations.
html=(OUT/'index.html').read_text();start='<!-- effort-comparison -->';end='<!-- /effort-comparison -->'
if start in html:html=html[:html.index(start)]+html[html.index(end)+len(end):]
markup=start+'<article><h2>Same inputs: Sol low versus Sol high</h2><table><thead><tr><th>Run</th><th>Inputs</th><th>Within 25 m</th><th>Candidates</th></tr></thead><tbody>'
for name,s in [('Low',low),('High',high)]:
 for arm,label in [('baseline','Previous'),('enriched','Richer')]:
  q=s['arms'][arm];markup+=f'<tr><td>{name}</td><td>{label}</td><td>{q["nearReferenceCrops"]}/12</td><td>{q["candidateAnnotations"]}</td></tr>'
markup+='</tbody></table><p>Proximity diagnostic only; visible landmark geometry is unverified. One run per arm cannot isolate reasoning effort from reviewer variation.</p><a href="../screening-rich-12/index.html">Open previous Sol low reviews</a></article>'+end
html=html.replace('<div class="controls">',markup+'<div class="controls">',1);(OUT/'index.html').write_text(html)
print(json.dumps({'low':low['arms'],'high':high['arms'],'beforeUsed':before,'afterUsed':after},indent=2))
