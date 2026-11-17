# Fifty-patch blinded Sol review — 16 November 2026

Completed **50 additional patch reviews**, excluding every patch ID in the earlier ten-patch pilot. Three fresh `gpt-6-sol` workers used low reasoning effort, reviewing 17/17/16 cases with five actual image inspections per case (**250 images**).

## Blinding and selection

Reviewers received only anonymous case IDs, copied PNGs, source-free image settings and a common visual protocol. Original patch IDs, coordinates/world files, registry identifiers, previous results and the evaluator key were withheld. They were not told which images contained known records. PNG chunks were checked for location/text metadata. Input hashes and the evaluator-key commitment were recorded. No named-site/CNS leakage was found in output text. File-access restriction was procedural, not a separate OS sandbox.

The evaluator selected eight new crops containing public reference points across five mapped records, plus 32 high-support, six intermediate-support and four boundary crops without a mapped reference point inside the square. Other crop centres were separated by at least 300 m; reference crops can overlap one another and terrain in the earlier pilot. This is not a random parish survey, and reference-free crops are not verified archaeological negatives.

## Results

Follow-up priorities: **21 low, 6 medium, 22 none, 1 high**. 18 cases contain at least one tentative localized feature flag; 20 candidate annotations were recorded in total.

A candidate centre was within 25 m of a public reference point in **0/8 reference crops**; with the predeclared localized-box filter, **0/8**. These proximity results span **0/5 distinct inventory records** under that filter. They are **not archaeological detection rates**.

The comparison criteria were fixed while reviews were running, before the coordinator read their observations: centre within 50 pixels (25 m), and for a localized flag, box area at most 16,000 pixels (10% of the image) with maximum side 200 pixels (100 m). The threshold is exploratory, not an inventory accuracy tolerance or a surveyed footprint. A point-in-crop does not guarantee a visible structure; buried, removed, diffuse or mislocated features cannot be scored as visible positives. Broad cultivation or rock flags near a point do not establish archaeological recognition.

| Case | Patch | Reference CNS | Follow-up | Nearest candidate centre | Localized flag within 25 m |
| --- | --- | --- | --- | --- | --- |
| B003 | parish-r052-c088 | 39925 · Clara Domingas | low | No candidate | No |
| B004 | parish-r022-c083 | 1064 · Lage do Ouro | low | No candidate | No |
| B008 | parish-r052-c089 | 39925 · Clara Domingas | low | No candidate | No |
| B014 | parish-r029-c040 | 8491 · Coito da Ola | medium | 105.78 m | No |
| B015 | parish-r053-c089 | 39925 · Clara Domingas | low | No candidate | No |
| B030 | parish-r045-c079 | 761 · Anta da Aldeia da Mata/ Tapadão 1/Couto dos Pucarinhos | none | No candidate | No |
| B030 | parish-r045-c079 | 12478 · Tapadão 2 | none | No candidate | No |
| B032 | parish-r030-c040 | 8491 · Coito da Ola | low | 106.46 m | No |
| B047 | parish-r044-c080 | 761 · Anta da Aldeia da Mata/ Tapadão 1/Couto dos Pucarinhos | low | 57.4 m | No |

## What the control result means

In **B047 / Tapadão 1**, the reviewer described a smaller isolated bump below a rough cluster but selected only the rough cluster for follow-up. Its selected centre is about **57 m** from the published point. The other crop containing the Tapadão reference points, B030, received no follow-up. This distinguishes mentioning faint relief from selecting the relevant feature for inspection.

Clara Domingas's three overlapping crops received low follow-up with no localized candidates; the Lage do Ouro crop was described mainly as cultivation/field divisions. The two Coito da Ola crops flagged an angular block away from the reference point. Point positions do not establish the extent or visibility of those records, so these results cannot be called confirmed false negatives.

The single **high** follow-up, B011, concerns block-like raised forms with exposed bedrock, rubble, clearance or modern structures as alternatives. It has not received raw-return, aerial-imagery or inventory/publication verification. Priority is a reviewer suggestion, not a discovery or a calibrated probability.

Before scaling this setup to the parish, establish a small set of independently confirmed *visible* terrain signatures and compare blind localization and alternative explanations on those. This run has not validated automatic archaeological detection.

## Usage

The live shared account meter showed **53% consumed before the task and 54% immediately after the workers finished**, leaving **46%** on that displayed meter. This is a **one-percentage-point interval change**, including coordinator activity and any other account use, not an exact per-agent charge. Rounding and delayed updates prevent a reliable per-patch or remaining-survey estimate. The window resets 17 November 2026 at 14:44:31 Europe/Lisbon. No reset credits were consumed or credits purchased. See [usage-summary.json](usage-summary.json).

Three fresh workers handled 17, 17 and 16 cases concurrently. The worker phase was roughly 3 minutes 34 seconds from launch to the usage check; it excludes preparation and later evaluation. Per-agent token totals were not exposed.

## Files and interpretation

- [All notes, CSV](reviews.csv) · [unblinded structured notes](reviews-unblinded.json).
- [Frozen worker A](worker-a.json), [worker B](worker-b.json), [worker C](worker-c.json).
- [Per-control comparison](control-comparison.json) · [summary](summary.json) · [evaluation protocol](evaluation-protocol.json).
- [Reviewer instructions](reviewer-protocol.md) · [evaluation key](evaluator-key.json).

Original terrain/image artifacts and `review.csv` were not modified. The notes remain preliminary AI visual screening. Live inventory records, bibliography, imagery and original-return cross-sections were not checked in this visual stage. Any possible archaeological interpretation or novelty consideration needs those checks. No new site is established by this batch.
