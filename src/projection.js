import proj4 from 'proj4';
import Cartographic from 'cesium/Core/Cartographic.js';

proj4.defs('EPSG:2056', '+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs');

/**
 * @param {import('cesium/Core/Cartesian3').default} cartesian
 * @return {Array<number>}
 */
export function cartesiantoDegrees(cartesian) {
  const cartographic = Cartographic.fromCartesian(cartesian);
  return [
    cartographic.longitude * 180 / Math.PI,
    cartographic.latitude * 180 / Math.PI,
    cartographic.height
  ];
}

/**
 * @param {Array<number>} coordinates
 * @return {Array<number>}
 */
export function degreesToLv95(coordinates) {
  return proj4('EPSG:4326', 'EPSG:2056', coordinates);
}

/**
 * @param {Array<number>} coordinates
 * @return {Array<number>}
 */
export function round(coordinates) {
  return coordinates.map(Math.round);
}