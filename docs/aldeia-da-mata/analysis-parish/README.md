# Aldeia da Mata — whole-parish ground-image review dataset

**Complete: 4,172 patches generated and all data checks passed.** This folder extends the [village review dataset](../analysis-village/README.md) to the full parish. Open **index.html** for the paginated gallery. No archaeological features have been labelled or claimed as discoveries.

## Size and measured resources

The finished folder occupies approximately **5.0 GiB** on this filesystem (about 4.78 GiB of checksummed data). The image export completed in about **4 minutes 49 seconds**, with a measured peak resident memory of **1.50 GiB**. The streamed ground-support pass took about **13 minutes 8 seconds**, with maximum resident memory about **702 MiB**. Timing excludes subsequent full validation and browser QA. About **7.0 GiB** disk space remained after generation. See `build-report.json`, `extraction-report.json`, `cleanup-log.json` and `validation.json`.

Validation passed for **77,969 artifact hashes**, all 4,172 georeferenced patches, 685 context tiles, exact model/source support semantics, full fourfold cell/return coverage and every adjacent overlap in all eight layers. Unique context totals are **148,555,730 valid cells**: **135,558,738 measured** and **12,996,992 interpolated**. Patch totals repeat these cells four times.

## Coverage and files

- **4,172 patches**, each 200 × 200 m, stepping 100 m (50% overlap). North up; 0.5 m cells; 400 × 400 pixels. The grid aligns with all 25 earlier village footprints.
- Exact CAOP2025 parish area: **37.2841 km²**. Every parish interior location has four overlapping crops. Boundary-overhanging squares are retained; cells outside the parish remain missing.
- `patches/<id>/`: four hillshades (45°, 135°, 225°, 315°), elevation, slope, local relief and support PNGs, their `.pgw` world files, and Float32 `terrain.tif`. PNGs have no annotations or feature labels. Assign EPSG:3763 when importing PNG/world-file pairs into GIS.
- `context/tiles/<id>/`: 685 pixel-aligned 250 m context tiles. Each has a georeferenced model TIFF, unsmoothed raw measured-cell mean TIFF, exact integer ground-return count TIFF and support-code PNG (0 missing model, 1 measured cell, 2 interpolated cell). The PNG codes align with the TIFF georeferencing and the tile bounds in the source reports.
- `manifest.json`, CSV and JavaScript: full bounds, support statistics, layer paths and reference-point associations. `gallery-index.js` is the smaller browser catalogue; the gallery loads 24 thumbnails per page. Selected layers and original PNGs load on demand.
- `thumbnails/` and 66 pages under `contact-sheets/`: separate downsized/labelled previews. They do not alter the scientific PNGs.
- `review.csv`: initially unreviewed, preserved on rebuild. It includes CNS entries checked, date checked, visible geometry, alternatives, raw-data checks and prior mapping. `inventoryPointCns` in the manifest only means a published reference point falls within that square; it is not a completed registry check or a site boundary.
- `footprints-epsg3763.json`: projected rings in metres, explicitly **not WGS84 GeoJSON**. `plan.json` retains the original footprint/capacity plan; its `status` describes the planning artifact, not the final build status.
- `provenance.json`, 60 source reports, checksums and validation report retain the evidence and processing settings. Human-edited review fields are deliberately excluded from immutable artifact checksums.

## Terrain, colours and support

Source © **Direção-Geral do Território**, [public mainland LiDAR survey](https://www.dgterritorio.gov.pt/levantamento-lidar-de-portugal-continental-0), **CC BY 4.0**. These are locally derived models and images, not the official MDT raster product. Source filenames include `04-2024`; a more precise capture date is not inferred. Heights are metres in the source Cascais datum; horizontal coordinates are EPSG:3763.

The terrain is the existing maximum-detail 0.5 m model: class-2 ground means, inherited 0.25 m Gaussian smoothing, nearest gap support up to 5 m, parish cell-centre mask and centimetre quantization. The patch exporter applies no extra terrain smoothing. Source and model provenance is recorded in `../data/max-detail-provenance.json`.

Raw support is reconstructed independently from **all 1,083,339,788 source returns** across the same 60 files and every available hierarchy level. All payload, metadata and decoder hashes must match the completed class census. Half-open 1 km source ownership and the 0.5 m parish cell-centre mask match terrain construction. The retained **504,411,342 ground returns** and occupied cells must match every prepared terrain tile before export. This differs slightly from the exact point-in-vector class census; the clipping convention is stated rather than mixing those counts.

Green support means a valid model cell contains at least one accepted raw ground return; its model height is still smoothed. Amber means a valid model cell contains no raw return and is interpolated. Dark means missing model data. Raw means stay missing without a return. Zero is a valid ground-count value. Counts are source records, not a deduplicated shot inventory. Integer count TIFFs preserve exact counts; terrain and raw mean TIFFs use Float32.

Derivatives use central differences requiring finite neighbours, with a **32 m halo** before cropping. Hillshades use 35° sun altitude, height ×1 and ambient/direct weights 0.15/0.85. Elevation uses a single parish-wide range recorded in the manifest; slope uses 0–45°. Local relief subtracts a normalized Gaussian baseline (10 m sigma, 30 m radius), preserves missing cells and uses a fixed −2 to +2 m colour range. Clipped colour cells are counted per patch. Overlaps are pixel-aligned and validated in every layer.

Hillshades use an indexed grayscale PNG palette with a reserved dark NoData colour. Support uses three exact indexed colours. These encodings reduce storage without changing decoded RGB values. The new renderer was also checked against the village fixture: all eight RGB layers and 2,850,760 raw ground counts reproduce exactly under the village's original elevation scale. The parish elevation palette intentionally uses the broader common scale.

## Interpretation and review

Describe visible geometry, check all light directions and support, then consider modern roads, buildings, drainage, cultivation, natural relief and interpolation. Ground classification may remove standing monuments, roofs and vegetation. Seams, sparse ground measurements and occlusion can make misleading shapes. A 0.5 m cell size does not establish equivalent measurement accuracy or resolution for every object.

Check original returns/cross-sections, imagery, historical maps and published surveys. Before considering novelty, check live Endovélico records, works, bibliography and published feature maps, recording CNS and date checked. An empty patch inventory field or a point outside the square does not show that a feature is new. Read the [Endovélico guide](../archaeology.md). Overlapping patches repeat measurements; do not randomly split adjacent crops between training and evaluation.

## Processing, memory and rebuild

The build is serial and resumable. A compressed source payload is held only in one child process; it is hash-checked, decoded and released. Counts/sums are converted into context tiles after each source, and temporary arrays are removed. The full 6.58 GB source-payload set is never retained on disk or held in RAM at once.

Image processing groups patch anchors into roughly 1 km blocks, adding patch-overlap extent and the 32 m halo. It releases block arrays after writing that block. There is no monolithic 353.5-million-cell parish array. A 6 GiB free-disk reserve is checked between sources/blocks; completed outputs can be resumed if space runs short. The original 20 GiB available-space recommendation was conservative; actual bounded working space and output sizes are recorded in the build reports.

Requirements: Node.js and Python 3 with NumPy and Pillow/libtiff. Set `ANALYSIS_PYTHON` to the Python interpreter with those libraries when launching the extractor. The current machine's bundled processing runtime is supported. Preserve the small official `worker.js` and `decoder.wasm` cache; their expected hashes are in `../data/class-census.json`. They originate from the DGT viewer assets referenced by `scripts/audit-parish-classes.cjs`.

```sh
ANALYSIS_PYTHON=/path/to/python3 node scripts/extract-parish-analysis-ground.cjs /tmp/aldeia-class-audit /tmp/aldeia-parish-analysis-work
/path/to/python3 scripts/build-parish-analysis.py
/path/to/python3 scripts/check-parish-analysis.py
```

The extractor skips completed source reports with matching code/census versions and existing context files; the builder verifies context hashes. Blocks resume only with the same processing fingerprint and expected files/sizes. Use `--force` on the image builder after changing the grid/settings or to regenerate a damaged block set. The final validator checks every artifact hash, support/model semantics, GeoTIFF tags, world files, complete fourfold cell/return coverage and every adjacent overlap in all eight image layers. Browser QA is separate.

`cleanup-log.json` records the regenerable caches removed to make space. Installed runtimes, live application/browser state, active updaters, the existing village dataset and all prepared viewer datasets were retained. Logical file sizes can exceed the physical space recovered on APFS because of shared/cloned files.
