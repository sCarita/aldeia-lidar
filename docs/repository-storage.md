# Source code, documentation and local datasets

Git stores the HTML/CSS/JavaScript application, processing and validation scripts,
project guides, dataset manifests and provenance, checksums, and screening reports
with their frozen review outputs. Generated JavaScript catalogs used by the
galleries and experiment viewers are included.

The multi-gigabyte generated datasets remain local and are excluded by
`.gitignore`: aerial JPEG tiles, detailed terrain/vegetation/structure tile
payloads and overviews, archived village vegetation packets, terrain grids,
analysis PNG/TIFF images, contact sheets and world files. Existing tracked sample
data from earlier commits remains tracked.

A fresh checkout contains the source and documentation, but needs these excluded
assets to reproduce the complete local viewer. Copy the prepared datasets from an
existing installation, keeping each payload bundle together with its matching
manifest and provenance, or rebuild them using the documented scripts and source
inputs. Local paths in historical processing reports are records of the original
run, not portable download locations.

See [AGENTS.md](../AGENTS.md), the [parish patch dataset guide](aldeia-da-mata/analysis-parish/README.md),
and the relevant provenance records for rebuild and validation requirements.
The high-effort experiment viewer also requires the original
`analysis-parish/screening-rich-12/packages/` images.

Committing source does not publish or back up the excluded local datasets.
