# Sol high: repeated twelve-patch blind comparison

[Open high-effort side-by-side viewer](index.html) · [Previous Sol low experiment](../screening-rich-12/index.html) · [Machine-readable effort comparison](effort-comparison.json)

## Results

The same twelve patches were reviewed again with `gpt-6-sol`, **high** reasoning effort. Six fresh workers completed 24 reviews / 204 reported image inspections, in two waves of three. No worker saw both input arms. Known records and prior results remained hidden from reviewers.

| Run | Inputs | Candidate annotations | Crops with candidates | Crops with centre within 25 m | Priority none / low / medium / high |
|---|---|---:|---:|---:|---|
| Sol low | Previous five images | 5 | 5 | 1 / 12 | 4 / 6 / 2 / 0 |
| Sol low | Richer twelve images | 0 | 0 | 0 / 12 | 12 / 0 / 0 / 0 |
| Sol high | Previous five images | 6 | 6 | 0 / 12 | 6 / 6 / 0 / 0 |
| Sol high | Richer twelve images | 1 | 1 | 0 / 12 | 11 / 1 / 0 / 0 |

High-run paired input result: 0 baseline only, 0 enriched only, 0 both, 12 neither, under the same reference-point proximity rule. Localized secondary results are in summary.json.

The single low-run baseline proximity result was R04 near CNS 761; low effort did not identify its archaeological type. High-effort notes, alternatives and exact per-record distances are retained in comparison.json; no archaeological label is inferred from the distance metric.

High-run proximity cases:

No selected candidate centre was within 25 m of a reference point.

## Same inputs and scoring

The twelve crop IDs, image bytes, input layer lists and reviewer protocol are identical to the low run. Baseline has hillshades 45/135/315, local relief and support. Enriched adds hillshade 225, slope, sky-view factor, 800 m terrain context, patch/context 2025 RGB and the source-class overlay. Image files remain in ../screening-rich-12/packages/ and are reused by the high viewer; there is no duplicated permanent raster bundle. Anonymous reviewer copies were made separately in /private/tmp/aldeia-rich12-high-20261116. High reviewers were not told the sample's site composition, names, coordinates, record types, previous outcomes or any target point. Original case numbering and four-case worker assignments were preserved.

Primary diagnostic remains a selected candidate centre within 25 m / 50 patch pixels of an official reference point. Secondary also requires a box of at most 16,000 patch pixels and maximum side 200 pixels. Annotation coordinates always use the original 0..400 patch frame. No thresholds or prompts were revised after seeing results.

The original key commitment and evaluation protocol were copied before dispatch. The coordinator already knew earlier outcomes; reviewer blinding used fresh empty contexts and explicit restrictions to anonymous arm directories. This was procedural blinding, not an OS filesystem sandbox. All six worker outputs were frozen and hashed before the high-run key join. Obvious place/record strings, complete case/image lists, candidate coordinates and evidence-layer names were checked, along with every input and source hash. The published evaluator key is an exact copy of the prior committed key. Existing low outputs and parish scientific data/review.csv were not edited.

## Interpretation limits

Twelve overlapping reference-point crops cover five mapped records. These are not twelve independent sites. Registry points do not establish visible surviving remains, exact monument footprints or the nature of any selected shape. No visible geometry was independently labelled and no verified negative controls were added. Proximity is therefore not archaeological identification, precision, recall or a validated detection rate. One run per effort/input arm, with different fresh workers, cannot distinguish reasoning-effort effects from reviewer variation. The enriched arm also receives more images. Do not infer a general Sol high advantage or disadvantage from this sample alone. Read the notes and inspect actual visible landmark geometry before selecting a calibration/held-out benchmark.

## Usage

Before preparation/reviews: **57% consumed / 43% remaining**. After all six reviewers: **57% consumed / 43% remaining**. The meter is shared across the account, rounded and potentially delayed. The interval includes coordinator work and any other account activity. No exact token/per-model cost is available; an unchanged reading does not imply zero consumption. No reset credit or purchase was used. usage-summary.json preserves snapshot times and window fields.

## Cases

| Case | Original patch | Reference CNS | High baseline priority / candidates | High enriched priority / candidates | Within 25 m, baseline / enriched |
|---|---|---|---|---|---|
| R01 | parish-r029-c040 | 8491 | low / 1 | none / 0 | no / no |
| R02 | parish-r029-c039 | 8491 | none / 0 | none / 0 | no / no |
| R03 | parish-r021-c082 | 1064 | low / 1 | low / 1 | no / no |
| R04 | parish-r045-c080 | 761, 12478 | low / 1 | none / 0 | no / no |
| R05 | parish-r044-c079 | 761 | none / 0 | none / 0 | no / no |
| R06 | parish-r030-c039 | 8491 | none / 0 | none / 0 | no / no |
| R07 | parish-r045-c079 | 761, 12478 | low / 1 | none / 0 | no / no |
| R08 | parish-r053-c088 | 39925 | none / 0 | none / 0 | no / no |
| R09 | parish-r044-c080 | 761 | low / 1 | none / 0 | no / no |
| R10 | parish-r053-c089 | 39925 | none / 0 | none / 0 | no / no |
| R11 | parish-r022-c082 | 1064 | none / 0 | none / 0 | no / no |
| R12 | parish-r022-c083 | 1064 | low / 1 | none / 0 | no / no |

## Artifacts and reproduction

Frozen baseline-a/b/c.json and enriched-a/b/c.json, frozen-output-hashes.json, comparison.json/CSV/JS, effort-comparison.json, summary.json, usage-summary.json, provenance.json, the precommitted key/protocol and this guide are stored here. The browser viewer has optional post-review reference circles and candidate boxes; these overlays were never in the reviewer images.

`scripts/prepare-rich-screening-12-high.py` verifies and copies the fixed anonymous packages; it refuses to overwrite an existing experiment. `scripts/evaluate-rich-screening-12-high.py` validates/finalizes the six completed worker outputs and joins the committed key. `scripts/report-rich-screening-12-high.py` builds the comparison with the frozen low run. These scripts do not dispatch agents. Preserve the original low package folder when copying the high viewer. DGT imagery credit and processing/source limitations remain in the original package provenance; the separate public archaeology snapshot has separate reuse limitations.
