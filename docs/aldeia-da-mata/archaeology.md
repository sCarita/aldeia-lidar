# Archaeological records around Aldeia da Mata

Snapshot checked on **16 November 2026**. Source: **Património Cultural, I.P.**, Endovélico / Portal do Arqueólogo and its official public GeoPortal.

In the [terrain explorer](surface.html), gold ◇ buttons mark published inventory reference points. Tap a numbered group to zoom in, or open **Sites** to choose a record, focus its position, hide the markers or open the official record. Markers work with terrain maps, 3D surfaces, aerial swipe/3D colours and the Trees explorer. They are independent of vegetation and other point-class filters.

The public parish search returned six entries. Five have points inside the exact CAOP2025 parish polygon. One has no public map position and is retained in the list without a marker.

| CNS | Inventory name | Type | Period | Position |
| --- | --- | --- | --- | --- |
| [5817](https://arqueologia.patrimoniocultural.pt/index.php?sid=sitios&subsid=51630) | Aldeia da Mata | Achado(s) Isolado(s) | Romano | Not available on the public map |
| [761](https://arqueologia.patrimoniocultural.pt/index.php?sid=sitios&subsid=54036) | Anta da Aldeia da Mata / Tapadão 1 / Couto dos Pucarinhos | Anta/Dólmen | Neo-Calcolítico | Published map point |
| [39925](https://arqueologia.patrimoniocultural.pt/index.php?sid=sitios&subsid=3623847) | Clara Domingas | Anta/Dólmen | Neo-Calcolítico | Published map point |
| [8491](https://arqueologia.patrimoniocultural.pt/index.php?sid=sitios&subsid=53266) | Coito da Ola | Vestígios Diversos | Moderno | Published map point |
| [1064](https://arqueologia.patrimoniocultural.pt/index.php?sid=sitios&subsid=47577) | Lage do Ouro | Necrópole | Romano | Published map point |
| [12478](https://arqueologia.patrimoniocultural.pt/index.php?sid=sitios&subsid=55561) | Tapadão 2 | Anta/Dólmen | Neo-Calcolítico | Published map point |

These are inventory descriptions and periods, not classifications inferred from our LiDAR. A CNS is the **Código Nacional de Sítio**; it is separate from the portal's internal `subsid` identifier. The original approximate Tapadão camera preset remains available; the gold marker uses the official published map geometry. Its reference position differs slightly from the older preset.

## Before considering novelty

For every candidate, record the date checked, the nearby or potentially related CNS entries, links to their live records, the relevant bibliography/maps, and whether each source actually covers the candidate. Inspect the record's works and bibliography rather than relying on its point alone. A point is a reference location, not the site's extent. A feature some distance from a point may still belong to that known site.

Keep separate conclusions for **matched to a known record**, **possibly related**, **checked but unresolved**, and **not yet checked**. An empty area in this overlay does not establish that a site is new: unlocated records, incomplete publication and later inventory updates can all matter. Compare published feature maps and original ground returns as well as Endovélico. Proposed dates and uses remain tentative.

## Sources and scope

- [Official Endovélico information](https://www.patrimoniocultural.gov.pt/profissionais/arqueologia/endovelico-sistema-de-informacao-e-gestao-arqueologica/).
- [Portal do Arqueólogo](https://arqueologia.patrimoniocultural.pt/index.php?sid=sitios): anonymous public parish search, Crato → Aldeia da Mata. All six results fit on one page.
- [Official GeoPortal](https://pcip.maps.arcgis.com/apps/webappviewer/index.html?id=5cb4735d7d7743a39a16d7269a753a4a): its published “Sítios Arqueológicos” layer supplies point geometry in EPSG:3763. The service name contains `20190207`; that name is not used as a claim about the age of each record.
- [Provenance](data/archaeology-parish-provenance.json) retains exact query parameters/URL, source hashes, boundary hash, retrieval timestamp and limitations. [Public map response](data/archaeology-public-map-source.json) retains the ten bounding-box results; exact polygon clipping excludes five outside the parish. [Normalized public parish results](data/archaeology-public-parish-source.json) retain the six-row list and the checked unlocated entry.

Only public anonymous inventory facts and published map positions are included. No authenticated reports/coordinates, photographs or descriptive texts are republished. No explicit reuse licence appeared in the ArcGIS item metadata when checked; this project retains attribution and makes no open-licence assertion for the inventory. The DGT imagery's CC BY attribution does not apply to these separate records.

## Rebuild and validate

Re-fetch the public map query and parish search described in provenance, plus the public CNS 5817 page. The parish form needs `isnewsearch=1`, `isclearsearch=0`, `concelho=1796`, `freguesia=5444` and an empty `s` field. Omitting the search flag returns the unfiltered national list; the builder rejects that response.

Run `node scripts/build-parish-archaeology.cjs MAP_RESPONSE.json PARISH_SEARCH.html ALDEIA_RECORD.html` from the repository. It checks complete single-page results, exact polygon membership, joins by CNS, and refuses an unlocated record without checked type/period information. It is currently specific to this six-record snapshot: review new/unlocated entries when refreshing rather than silently guessing their positions.

Run `node scripts/check-parish-archaeology.cjs`. It checks source hashes, independent polygon clipping, CNS joins, source coordinates, the unlocated record, map/3D projection, grouping, selection, focus and visibility. Check the browser after renderer/layout changes. Keep all archaeology data files together when copying the site.
