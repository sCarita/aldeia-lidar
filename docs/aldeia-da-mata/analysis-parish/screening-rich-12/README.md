# Twelve-patch paired input experiment

Completed 16 November 2026. [Open side-by-side comparison](index.html). The enriched package did not improve reference-point localisation in this run. Baseline produced one candidate centre within 25 m; enriched produced none. Neither result establishes archaeological recognition.

## Inputs and selection

Twelve 200 m crops contain public official-GeoPortal/Endovélico reference points across five mapped records (CNS 761, 12478, 39925, 1064, 8491). Selection round-robins through records, choosing unused crops with greatest reference-point distance from the edge, then caps at 12 and shuffles with seed 2026111612. Several crops overlap and include the same record. Some overlap earlier runs, but all six reviewers had fresh contexts without prior reviews. These are 12 crops, not 12 independent sites. No record was invented or positioned using an unlocated entry.

Landmark reference points are independently recorded, but surviving visible feature geometry was **not independently annotated or verified** before this experiment. Inventory points neither guarantee visible remains nor define monument boundaries. This is a localisation diagnostic, not a validated object-detection benchmark.

Baseline: the previous five 400 × 400 images — hillshades 45°, 135°, 315°, local relief and measured/interpolated/missing support.

Enriched: those five plus hillshade 225°, slope, sky-view factor, an 800 m terrain context, 2025 RGB imagery of the 200 m patch, an 800 m RGB context, and a ground-background overlay of measured source-class 1/6/9/26 representatives. Twelve images per patch. Context amber outlines mark the patch footprint only. No site markers, coordinates, place names, original patch IDs, world files or record labels were supplied. No feature-centred zoom was used, which would have disclosed the target location.

The patch aerial and point overlay are 800 × 800 pixels; context images are 800 × 800 pixels. All reviewer annotations use the original 0..400 patch coordinate frame. Terrain resolution remains 0.5 m; resampling creates no new measurements. The overlay uses existing highest measured 0.5 m cells, not a newly decoded full cloud or inferred solid surface. No new profiles or vegetation surface were generated. Sky-view factor uses a local 16-direction cosine-squared horizon approximation, samples 1..20 m every metre and masks cells with any sampled missing neighbour; display range is fixed at 0.85..1. Flat, wall and missing-input checks passed. See provenance.json for processing fingerprints.

RGB credit: Informação geográfica cedida pela Direção-Geral do Território · CC BY 4.0. 2025 photography and 2024-named LiDAR files are different dates; exact local acquisition dates are unverified. The archaeological snapshot is a separate public-record source with separate reuse limitations; see the [archaeology guide](../../archaeology.md).

## Review and blinding

Six fresh `gpt-6-sol` workers, low reasoning effort. First wave: three workers × four baseline cases. After those completed, a second wave of three fresh workers × four enriched cases. Maximum three concurrent reviewers; 24 reviews and 204 reported image inspections (60 baseline, 144 enriched), with no reported failures. No reviewer saw both arms. They were not told the sample's known-site composition, site types or evaluation-point locations.

Workers received only anonymous arm folders under /private/tmp/aldeia-rich12-20261116. Restrictions on outside reads were procedural rather than an OS sandbox. Every PNG was checked for unexpected metadata chunks. Input hashes, evaluator-key commitment and evaluation rules were fixed before reviews. The coordinator did not read observations while choosing cases or adjusting evaluation. All six raw output files were copied and hashed before observations were joined to the hidden key. Basic case/image counts, annotation bounds, evidence-layer names, source/input hashes and absence of obvious site-name/CNS strings in raw notes passed validation.

Primary diagnostic, fixed before review: any selected candidate centre within 25 m (50 patch pixels) of a reference point. Secondary adds a maximum 100 m box side and maximum 4,000 m² box area. Both rules yield the same counts. These distances are exploratory and do not establish correct feature identity. There are no verified negative controls, so precision and false-positive rate cannot be estimated. One run per arm with different reviewers cannot isolate individual added layers or separate reviewer variability from input effects. This is also a comparison of different image budgets.

## Results

| Measure | Previous five images | Enriched twelve images |
|---|---:|---:|
| Crops reviewed | 12 | 12 |
| Crops with selected candidates | 5 | 0 |
| Candidate annotations | 5 | 0 |
| Crops with a candidate centre within 25 m | 1 | 0 |
| Follow-up none / low / medium / high | 4 / 6 / 2 / 0 | 12 / 0 / 0 / 0 |

Paired outcome: one baseline-only proximity result, zero enriched-only, zero in both and eleven in neither.

The baseline-only case R04 is around Tapadão. Its low-confidence “Small isolated rise with adjacent linear mark” centre is about 3 m from CNS 761. It did not identify a dolmen: it offered rock, shrub/root mound, spoil and disturbance alternatives. The enriched reviewer described small raised spots but selected none, offering exposed boulders/bedrock, shrubs and track disturbance as explanations. On adjacent R09 both reviewers described the larger rock cluster; neither selected a candidate near the smaller reference-point location. Thus the experiment gives no evidence of improved recognition from adding these views. The aerial images often supported ordinary landscape explanations, but the absence of verified negatives means suppression of flags cannot be called improved specificity.

| Case | Original patch | Reference CNS | Baseline priority / candidates | Enriched priority / candidates | Within 25 m, baseline / enriched |
|---|---|---|---|---|---|
| R01 | parish-r029-c040 | 8491 | medium / 1 | none / 0 | no / no |
| R02 | parish-r029-c039 | 8491 | none / 0 | none / 0 | no / no |
| R03 | parish-r021-c082 | 1064 | none / 0 | none / 0 | no / no |
| R04 | parish-r045-c080 | 761, 12478 | low / 1 | none / 0 | yes / no |
| R05 | parish-r044-c079 | 761 | low / 1 | none / 0 | no / no |
| R06 | parish-r030-c039 | 8491 | none / 0 | none / 0 | no / no |
| R07 | parish-r045-c079 | 761, 12478 | none / 0 | none / 0 | no / no |
| R08 | parish-r053-c088 | 39925 | low / 1 | none / 0 | no / no |
| R09 | parish-r044-c080 | 761 | medium / 1 | none / 0 | no / no |
| R10 | parish-r053-c089 | 39925 | low / 0 | none / 0 | no / no |
| R11 | parish-r022-c082 | 1064 | low / 0 | none / 0 | no / no |
| R12 | parish-r022-c083 | 1064 | low / 0 | none / 0 | no / no |

## Usage and storage

Before preparation/reviews: 57% consumed, 43% remaining. After all six reviewers: 57% consumed, 43% remaining. The account meter is shared, rounded and potentially delayed. An unchanged integer reading does not mean zero cost; exact tokens or model-only cost are unavailable. No reset credits or purchases were used. Times and meter fields are recorded in usage-summary.json. The package PNGs total 50,737,684 bytes (about 48.4 MiB), plus small reports and an anonymous temporary review copy.

## Next interpretation step

Before scaling, independently inspect the known monument's actual visible stones/footprint in imagery and source measurements. Annotate that visible geometry, then develop a separate labelled calibration set with examples of small stone arrangements and convincing natural/modern lookalikes. Keep a held-out blind evaluation set with verified visible features and verified comparison cases. Do not train the prompt using these results and then report the same twelve crops as independent validation. Record dates, source coverage and published mapping before any archaeological or novelty claim.

## Files and reproduction

- packages/: all twelve image layers for every anonymous case, without reference overlays.
- index.html / comparison.js: offline-capable browser comparison with optional post-review reference and candidate overlays.
- baseline-a/b/c.json and enriched-a/b/c.json: frozen raw outputs; frozen-output-hashes.json records hashes.
- comparison.json / CSV: paired notes and per-record proximity diagnostics.
- evaluator-key.json: post-review unblinding key, source hashes and input hashes; commitment in key-commitment.txt.
- evaluation-protocol.json and reviewer-protocol.md: rules fixed before output inspection.
- provenance.json, summary.json and usage-summary.json: processing and results.

`scripts/prepare-rich-screening-12.py` builds this fixed historical sample with NumPy/Pillow and refuses to overwrite an existing experiment. Reviewer assignments and raw outputs are documented above. `python3 scripts/evaluate-rich-screening-12.py` validates and joins completed outputs in the existing temporary arm folders. It does not run agents. Preserve frozen outputs and the key for future independent checks. The main parish review.csv and immutable scientific assets/checksums were not changed.
