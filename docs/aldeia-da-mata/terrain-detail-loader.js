'use strict';

// Local script assets also work when the guide is opened directly from disk.
window.createTerrainDetailLoader = function createTerrainDetailLoader(manifest) {
  const cache = new Map();
  const pending = new Map();
  const cacheLimit = 48;

  async function loadTile(info) {
    if (cache.has(info.id)) {
      const values = cache.get(info.id);
      cache.delete(info.id);
      cache.set(info.id, values);
      return values;
    }
    if (pending.has(info.id)) return pending.get(info.id);
    const request = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timeout = setTimeout(() => {
        script.remove();
        reject(new Error('Timed out loading terrain tile ' + info.id));
      }, 30000);
      script.src = info.url;
      script.onerror = () => {
        clearTimeout(timeout);
        script.remove();
        reject(new Error('Could not load terrain tile ' + info.id));
      };
      script.onload = async () => {
        clearTimeout(timeout);
        script.remove();
        try {
          const payload = window.ALDEIA_MAX_TILES[info.id];
          delete window.ALDEIA_MAX_TILES[info.id];
          const decoded = atob(payload.heights);
          const compressed = new Uint8Array(decoded.length);
          for (let i = 0; i < decoded.length; i++) compressed[i] = decoded.charCodeAt(i);
          const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
          const buffer = await new Response(stream).arrayBuffer();
          const values = new Uint16Array(buffer);
          if (values.length !== info.width * info.height) throw new Error('Invalid terrain tile size');
          cache.set(info.id, values);
          while (cache.size > cacheLimit) cache.delete(cache.keys().next().value);
          resolve(values);
        } catch (error) {
          reject(error);
        }
      };
      document.head.appendChild(script);
    });
    pending.set(info.id, request);
    try {
      return await request;
    } finally {
      pending.delete(info.id);
    }
  }

  async function loadWindow(bounds, meshResolution) {
    if (!window.DecompressionStream) throw new Error('This browser does not support local terrain decompression');
    const resolution = manifest.resolution;
    const width = Math.round((bounds[2] - bounds[0]) / resolution);
    const height = Math.round((bounds[3] - bounds[1]) / resolution);
    const values = new Uint16Array(width * height);
    values.fill(65535);
    const tiles = Object.values(manifest.tiles).filter(tile =>
      tile.bounds[0] < bounds[2] && tile.bounds[2] > bounds[0] &&
      tile.bounds[1] < bounds[3] && tile.bounds[3] > bounds[1]);
    const loaded = await Promise.all(tiles.map(async tile => ({ tile, values: await loadTile(tile) })));
    const zBase = tiles.length ? Math.min(...tiles.map(tile => tile.zBase)) : 0;
    let minimum = Infinity, maximum = -Infinity, validCells = 0;
    for (const item of loaded) {
      const tile = item.tile;
      const offsetX = Math.round((tile.bounds[0] - bounds[0]) / resolution);
      const offsetY = Math.round((bounds[3] - tile.bounds[3]) / resolution);
      const elevationOffset = Math.round((tile.zBase - zBase) * 100);
      for (let row = 0; row < tile.height; row++) {
        for (let col = 0; col < tile.width; col++) {
          const value = item.values[row * tile.width + col];
          if (value === 65535) continue;
          const converted = value + elevationOffset;
          values[(row + offsetY) * width + col + offsetX] = converted;
          minimum = Math.min(minimum, converted);
          maximum = Math.max(maximum, converted);
          validCells++;
        }
      }
    }
    return {
      id: 'focus',
      title: 'Maximum-detail focus',
      bounds, width, height, resolution, meshResolution, zBase, values,
      zRange: validCells ? [zBase + minimum * .01, zBase + maximum * .01] : [0, 1],
      groundPoints: tiles.reduce((sum, tile) => sum + tile.groundPoints, 0),
      validCells
    };
  }

  return { loadWindow };
};
