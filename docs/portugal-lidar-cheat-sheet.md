# Portugal DGT LiDAR cheat sheet

Checked 12 November 2026. DGT’s public mainland survey supplies classified 3D points and terrain rasters. For our first terrain inspection, start with one 50 cm MDT tile, then inspect its LAZ points for promising features.

## What to download

| Product | Meaning | Use in this project |
| --- | --- | --- |
| MDT / DTM | Bare-earth terrain model, GeoTIFF | Read landforms beneath vegetation |
| MDS / DSM | Surface model including vegetation and buildings, GeoTIFF | Compare surface cover with terrain |
| LAZ | Compressed, classified point cloud | Check ground returns and cross-sections |

DGT lists raster resolutions of 0.5 m, 2 m and 10 m. [DGT product definitions](https://www.dgterritorio.gov.pt/atividades/cartografia/cartografia-topografica/modelos-digitais)

## Numbers to keep handy

| Property | DGT specification |
| --- | --- |
| Scope | Mainland Portugal |
| Acquisition | April 2024–March 2025 |
| Mean density | 10 points/m² |
| Stated accuracy | 30 cm horizontal, 10 cm vertical |
| Tiles | 1 km × 1 km |
| Horizontal reference | PT-TM06/ETRS89 |
| Height reference | Cascais altimetric datum |
| Point format | LAZ, LAS 1.4-R15, point record format 8 |
| Colour attributes | RGB and near infrared |

Point classes are 1 other, **2 ground**, 3 low vegetation (0–0.5 m), 4 medium vegetation (0.5–2 m), 5 high vegetation (>2 m), 6 buildings, 7 noise, 9 water and 26 bridges. [DGT technical sheet](https://www.dgterritorio.gov.pt/atividades/cartografia/cartografia-topografica/modelos-digitais)

The coordinate codes are **EPSG:3763** horizontally and **EPSG:5780** for Cascais heights. Retain both references when combining datasets. [DGT reference codes](https://www.dgterritorio.gov.pt/dados-abertos)

## Access and reuse

- Download through the [DGT Data Centre](https://cdd.dgterritorio.gov.pt/). DGT also points to the QGIS **DGT CDD Downloader** plugin. [DGT access information](https://www.dgterritorio.gov.pt/atividades/cartografia/cartografia-topografica/modelos-digitais)
- The announcement, published 25 June 2025 and marked updated 24 April 2026, reports approximately **90% availability**, with the northwest still in production. It describes an approximately **200 km² per-access download limit** and a future LiDAR API. Check availability for the actual area before planning downloads. [Download announcement](https://www.dgterritorio.gov.pt/levantamento-lidar-de-portugal-continental-0)
- DGT’s general OGC API page lists other collections. These pages establish a download route, while LiDAR API availability still needs confirmation. [DGT open data](https://www.dgterritorio.gov.pt/dados-abertos)
- Data Centre downloads use **CC BY 4.0**. Credit Direção-Geral do Território and retain the licence and source with derived products. Suggested credit — “Source: Direção-Geral do Território, mainland Portugal LiDAR, 2024–2025. CC BY 4.0.” [DGT licensing](https://www.dgterritorio.gov.pt/dados-abertos)

## Suggested first pass for our project

1. Choose a small area and download its MDT at 0.5 m plus matching LAZ.
2. Open the MDT in QGIS and compare hillshades from several directions.
3. Inspect candidate shapes in the LAZ, especially class 2 ground points and profiles through them.
4. Save tile IDs, source links, coordinate references and rendering settings.
5. Compare candidates with known sites and published mapping before making a novelty claim.

Treat the 0.5 m value as raster cell size. Ground evidence depends on local return coverage and classification. A clear-looking terrain feature still needs the checks described in our project guide.

Access check covers the public DGT pages. Tile downloads, account requirements and the interactive portal’s current limits remain unverified.
