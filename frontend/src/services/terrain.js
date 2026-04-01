const TERRAIN_MODE = (process.env.REACT_APP_TERRAIN_MODE || 'analytic').toLowerCase();
const GOOGLE_3D_TILES_API_KEY = process.env.REACT_APP_GOOGLE_3D_TILES_API_KEY || '';
const GOOGLE_3D_TILES_URL = process.env.REACT_APP_GOOGLE_3D_TILES_URL || '';

export function getTerrainConfig() {
  if (TERRAIN_MODE !== 'google-3d-tiles') {
    return {
      mode: 'analytic',
      label: 'Analytic Globe',
      ready: true,
      provider: 'internal-canvas',
      message: 'Running internal analytic globe renderer.'
    };
  }

  const ready = Boolean(GOOGLE_3D_TILES_API_KEY && GOOGLE_3D_TILES_URL);

  return {
    mode: 'google-3d-tiles',
    label: 'Google 3D Tiles',
    ready,
    provider: 'google',
    endpoint: GOOGLE_3D_TILES_URL,
    message: ready
      ? 'Google 3D Tiles credentials detected. Wire Cesium/Google Photorealistic tiles runtime to activate terrain mesh.'
      : 'Google 3D Tiles mode requested but missing REACT_APP_GOOGLE_3D_TILES_API_KEY and/or REACT_APP_GOOGLE_3D_TILES_URL. Falling back to analytic globe.'
  };
}
