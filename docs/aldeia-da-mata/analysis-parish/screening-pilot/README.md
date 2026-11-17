# Ten-patch Sol screening pilot — 16 November 2026

The requested lightweight trial completed **ten distinct patch reviews**, using **gpt-6-sol with low reasoning effort**. The exposed subagent controls did not offer a model literally named “Sol small”; this is the Sol configuration used. Three worker agents ran, with at most three concurrent workers plus the coordinator. One worker first reviewed a single control patch, then reviewed three more; the other two reviewed three each. Fresh workers did not inherit the large parent chat.

Each patch was visually screened under hillshades at 45°, 135° and 315°, local relief and support: **50 image inspections in total**. Agents were instructed to stay read-only, consider natural/modern/interpolation alternatives, consult the local inventory snapshot, and avoid novelty/date/use claims. Notes are in [reviews.json](reviews.json). The dataset review sheet and immutable terrain/image artifacts were not modified.

The sample deliberately mixes patches containing known Endovélico reference points with geographically spread, high-support patches. The first two overlap. This is a workflow/usage pilot, not ten independent sites, a random archaeological survey, or an estimate of feature prevalence.

## Findings

| Patch | Inventory reference points inside square | Preliminary note |
| --- | --- | --- |
| parish-r044-c079 | CNS 761 | Irregular raised forms, possible rock/clearance/track/natural relief; raw-return check suggested |
| parish-r045-c080 | CNS 761, 12478 | Small rises and a faint line; medium follow-up in the context of existing records |
| parish-r053-c088 | CNS 39925 | Sinuous break; natural slope/drainage/boundary alternatives; low follow-up |
| parish-r021-c083 | CNS 1064 | Parallel bands; cultivation/land-management alternatives; low follow-up |
| parish-r029-c039 | CNS 8491 | Branching channel and bumps; drainage/track/interpolation alternatives; medium follow-up |
| parish-r029-c030 | None mapped within square | Curving parallel ridges; cultivation/terracing/contour alternatives; low follow-up |
| parish-r017-c026 | None mapped within square | Fine parallel lines; cultivation/forestry/processing alternatives; low follow-up |
| parish-r056-c068 | None mapped within square | Curving linear relief; drainage/boundary/track alternatives; medium follow-up |
| parish-r067-c095 | None mapped within square | Parallel rows, diagonal boundary, small bumps; cultivation/soil-pile alternatives; low follow-up |
| parish-r013-c085 | None mapped within square | Kinked field line toward road; drain/boundary/track/erosion alternatives; low follow-up |

These are preliminary AI observations. Live Endovélico records and publications were not checked in this trial. Reference points are not site boundaries; nearby extents and unlocated entries, including CNS 5817, remain relevant. None of these notes establishes an independent archaeological site. Any follow-up needs original returns/sections, imagery and existing mapping before interpretation or consideration of novelty.

## Usage and capacity

The live account meter showed **52% consumed / 48% remaining** before the pilot, after the first patch, and after all ten. The exposed window is seven days and resets **17 November 2026 at 14:44:31 Europe/Lisbon**. No reset credits were used and no credits were purchased. [usage-summary.json](usage-summary.json) stores only the relevant configuration and usage measurements, without account identifiers.

This session exposes **four total concurrency slots including the coordinator**, so **three worker agents can run simultaneously**. Ten reviews therefore ran across a single control followed by three concurrent groups of three. Ten simultaneous workers are not available in this session.

The account meter's displayed precision, update timing and shared-account activity prevent a reliable per-patch subscription charge or total remaining patch count. No visible percentage change does not mean free inference. This trial establishes that ten small reviews worked with the displayed headroom; it does not establish that all 4,172 patches fit. A further explicitly scoped 25–50 patch calibration batch, with usage checked again, would give more evidence before scaling up. Per-subagent token counts were not exposed.

[Official OpenAI usage guidance](https://learn.chatgpt.com/docs/pricing#what-are-the-usage-limits-for-my-plan) explains that model, context, reasoning, tools and caching affect allowance consumption.
