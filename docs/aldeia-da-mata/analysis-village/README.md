# Aldeia da Mata village — ground-image review dataset

This dataset prepares terrain images for later visual review. It follows the image-screening idea in [Pietro Miotti’s article](https://pietromiotti.com/latest/maya-site/), read 12 November 2026. The article does not publish patch dimensions or overlap. The parameters below are local choices, not a reproduction of its exact pipeline. No features have been identified or labelled in this dataset.

Open **index.html** for the gallery, or **contact-sheet.jpg** for a printable index. The gallery also works directly from local files when the folder is kept together.

## Coverage and patch scheme

- Existing village study square: **600 × 600 m**, EPSG:3763 bounds **[34445, -40461, 35045, -39861]**. This is a small square around the village reference, not the parish or a surveyed settlement boundary. Anta do Tapadão is outside it.
- **25 patches**, each **200 × 200 m**, stepping **100 m** in both directions (50% overlap). IDs use rows north to south and columns west to east.
- **0.5 m cells**, 400 × 400 pixels per patch; north up. Grid size does not imply equivalent measurement accuracy or the ability to resolve every 0.5 m object.
- All images share fixed settings and scales. They are exact crops from full-area derivatives computed with a 32 m halo. PNGs contain no labels or annotations; the separate contact sheet does.

## Files and layers

`patches/<id>/` contains four hillshades (sun azimuth 45°, 135°, 225°, 315°, altitude 35°, height ×1), elevation, slope, local relief, and ground-support PNGs. Each PNG has a `.pgw` world file; assign EPSG:3763 when importing into GIS. Elevation uses one common study-area min/max; slope colours cover 0–45°; local relief colours cover −2 to +2 m. Values beyond those last two ranges clip in the colour images, with per-patch counts in the manifest. Local relief subtracts a normalized Gaussian baseline with 10 m sigma and 30 m radius. It is a visualization, not proof of an artificial feature.

Each patch also has a Float32 **terrain.tif** GeoTIFF with embedded EPSG:3763, 0.5 m pixel size, north-up corner coordinates and NoData −9999. Terrain heights are metres in the source Cascais datum. `context/` holds all full-area images, the model, a raw measured-cell mean GeoTIFF, ground-return counts and an integer support-code PNG (0 missing, 1 measured, 2 interpolated). Counts are raw class 2 records, not a deduplicated inventory. The raw mean is unsmoothed and remains missing wherever no return falls in a cell. Zero count is a valid value in the count GeoTIFF.

`manifest.json`, `manifest.csv` and `manifest.js` index bounds, pixel windows, data support and image paths. `footprints-epsg3763.json` records projected rings in metres; it is explicitly **not WGS84 GeoJSON**. `provenance.json` records the exact source chunks, hashes, decoder hashes, terrain tile hashes and processing settings. `checksums.json` hashes data artifacts. `review.csv` starts unreviewed; rebuilding preserves an existing review file.

## Ground model and data quality

Source © **Direção-Geral do Território**, [public mainland LiDAR survey](https://www.dgterritorio.gov.pt/levantamento-lidar-de-portugal-continental-0), **CC BY 4.0**. These are locally derived images and terrain, not the official MDT raster product. Source filenames contain `04-2024`; this dataset does not establish a more precise capture date.

The model uses our existing maximum-detail 0.5 m tiles: class 2 ground means from all available hierarchy levels, Gaussian smoothing of 0.25 m, nearest interpolation within a 5 m support limit, CAOP2025 mask and stored centimetre quantization. The original detailed construction is recorded in `../data/max-detail-provenance.json`. The patch builder does not smooth the model again. Gradients require finite immediate neighbours and are missing next to unsupported holes; local relief ignores missing cells in its baseline and restores the original missing mask.

Support is reconstructed independently from every cached hierarchy level in the four source files intersecting the study halo, using the same per-source 1 km footprint as model construction. Green means a valid model cell contains at least one raw ground return. Amber means a valid model cell contains no raw return and is interpolated. A green cell still contains a smoothed model height. Dark means missing data, not a pit or bare ground. Counts and percentages in each patch include overlap; only the context statistics describe the unique study square.

Ground classification may remove buildings, stonework and vegetation. Occlusion, classification errors, interpolation and source seams can create misleading shapes. Cross-source smoothing is inherited from the existing terrain tiles; inspect source boundaries and raw returns when a shape follows a seam.

## Review approach

1. Describe visible geometry before proposing a function. Check the same place under all four light directions, elevation and local relief.
2. Check support. Consider modern roads, buildings, garden walls, drainage, cultivation, natural ridges and interpolation as alternative explanations.
3. Record a candidate in `review.csv`, including the patch ID, location, geometry and alternatives. Overlapping patches may show the same object; keep one candidate record and cross-reference it.
4. Verify against original ground returns and cross-sections, maps and imagery. The model and raw mean support that check but do not replace the original cloud. Do not infer a date, use or discovery from an image alone.
5. Compare published mapping before claiming novelty. The reference article’s November correction credits prior mapping of its site in 2025.

For machine learning, overlapping crops must not be randomly split between training and evaluation: adjacent images share terrain pixels. Split by separated spatial blocks or collect a distinct evaluation area.

## Rebuild

Requirements: Node.js; Python 3 with NumPy and Pillow (libtiff enabled). No network requests are made by these scripts.

```sh
node scripts/extract-village-analysis-ground.cjs /path/to/source-cache /tmp/aldeia-village-analysis
python3 scripts/build-village-analysis.py /tmp/aldeia-village-analysis
python3 scripts/check-village-analysis.py
```

The source cache must contain `dgt-worker.js`, `dgt-las.wasm`, `aldeia-chunk-tasks.json`, `parish-max-tasks.json`, source metadata under `aldeia-lidar-cache/`, original root chunks under `aldeia-surface-cache/`, and complete `.viewer` payloads under `aldeia-full-source/`. The four filenames, hashes and byte ranges are in `provenance.json`. The builder also needs this repository’s `data/max-detail-index.js` and terrain tile scripts. Keep the source provenance with exported patches.
