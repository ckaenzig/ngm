import EarthquakeVisualizer from '../earthquakeVisualization/earthquakeVisualizer.js';
import IonResource from 'cesium/Core/IonResource.js';
import GeoJsonDataSource from 'cesium/DataSources/GeoJsonDataSource.js';
import Cesium3DTileset from 'cesium/Scene/Cesium3DTileset.js';
import Cesium3DTileStyle from 'cesium/Scene/Cesium3DTileStyle.js';
import {getSwisstopoImagery} from '../swisstopoImagery.js';
import {LAYER_TYPES, BILLBOARDS_PREFIX} from '../constants.js';
import HeightReference from 'cesium/Scene/HeightReference.js';
import CustomDataSource from 'cesium/DataSources/CustomDataSource.js';
import Cartographic from 'cesium/Core/Cartographic.js';
import NearFarScalar from 'cesium/Core/NearFarScalar.js';
import VerticalOrigin from 'cesium/Scene/VerticalOrigin.js';
import Rectangle from 'cesium/Core/Rectangle.js';
import Cartesian3 from 'cesium/Core/Cartesian3.js';
import CMath from 'cesium/Core/Math.js';
import Ellipsoid from 'cesium/Core/Ellipsoid.js';

export function createEarthquakeFromConfig(viewer, config) {
  const earthquakeVisualizer = new EarthquakeVisualizer(viewer);
  if (config.visible) {
    earthquakeVisualizer.setVisible(true);
  }
  config.setVisibility = visible => earthquakeVisualizer.setVisible(visible);
  config.setOpacity = opacity => earthquakeVisualizer.setOpacity(opacity);
  return earthquakeVisualizer;
}

export function createIonGeoJSONFromConfig(viewer, config) {
  return IonResource.fromAssetId(config.assetId)
    .then(resource => GeoJsonDataSource.load(resource))
    .then(dataSource => {
      viewer.dataSources.add(dataSource);
      dataSource.show = !!config.visible;
      config.setVisibility = visible => dataSource.show = !!visible;
      return dataSource;
    });
}

export function create3DTilesetFromConfig(viewer, config) {
  const tileset = new Cesium3DTileset({
    url: config.url ? config.url : IonResource.fromAssetId(config.assetId),
    show: !!config.visible,
    maximumScreenSpaceError: 0 // required for billboards render
  });

  if (config.style) {
    tileset.style = new Cesium3DTileStyle(config.style);
  }
  tileset.pickable = config.pickable !== undefined ? config.pickable : false;
  viewer.scene.primitives.add(tileset);

  config.setVisibility = visible => {
    tileset.show = !!visible;
    const dataSource = viewer.dataSources.getByName(getBillboardDataSourceName(config.layer)); // Check for billboards
    if (dataSource.length) {
      dataSource[0].show = !!visible;
    }
  };

  if (!config.opacityDisabled) {
    config.setOpacity = opacity => {
      const style = config.style;
      if (style && (style.color || style.labelColor)) {
        const {propertyName, colorType, colorValue} = styleColorParser(style);
        const color = `${colorType}(${colorValue}, ${opacity})`;
        tileset.style = new Cesium3DTileStyle({...style, [propertyName]: color});
      } else {
        const color = `color("white", ${opacity})`;
        tileset.style = new Cesium3DTileStyle({...style, color});
      }
    };
  }

  if (config.billboards && config.billboards.latPropName && config.billboards.lonPropName) {
    addBillboardsForTileset(viewer, tileset, config);
  }

  return tileset;
}

export function createSwisstopoWMTSImageryLayer(viewer, config) {
  let layer = null;
  config.setVisibility = visible => layer.show = !!visible;
  config.setOpacity = opacity => layer.alpha = opacity;
  config.remove = () => viewer.scene.imageryLayers.remove(layer, false);
  config.add = (toIndex) => {
    const layersLength = viewer.scene.imageryLayers.length;
    if (toIndex > 0 && toIndex < layersLength) {
      const imageryIndex = layersLength - toIndex;
      viewer.scene.imageryLayers.add(layer, imageryIndex);
      return;
    }
    viewer.scene.imageryLayers.add(layer);
  };

  return getSwisstopoImagery(config.layer).then(l => {
    layer = l;
    viewer.scene.imageryLayers.add(layer);
    layer.alpha = config.opacity || 1;
    layer.show = !!config.visible;
    return layer;
  });
}


export function createCesiumObject(viewer, config) {
  const factories = {
    [LAYER_TYPES.ionGeoJSON]: createIonGeoJSONFromConfig,
    [LAYER_TYPES.tiles3d]: create3DTilesetFromConfig,
    [LAYER_TYPES.swisstopoWMTS]: createSwisstopoWMTSImageryLayer,
    [LAYER_TYPES.earthquakes]: createEarthquakeFromConfig,
  };
  return factories[config.type](viewer, config);
}

function styleColorParser(style) {
  const propertyName = style.color ? 'color' : 'labelColor';
  let colorType = style[propertyName].slice(0, style[propertyName].indexOf('('));
  const lastIndex = colorType === 'rgba' ? style[propertyName].lastIndexOf(',') : style[propertyName].indexOf(')');
  const colorValue = style[propertyName].slice(style[propertyName].indexOf('(') + 1, lastIndex);
  colorType = colorType === 'rgb' ? 'rgba' : colorType;
  return {propertyName, colorType, colorValue};
}


/**
 * To avoid incorrect handling of checkboxes during render
 * @param layers
 */
export function syncCheckboxes(layers) {
  layers.forEach(l => {
    const elements = document.getElementsByName(l.layer);
    for (let i = 0; i < elements.length; i++) {
      elements[i].checked = l.visible;
    }
  });
}

/**
 * Adds on terrain billboards for tileset based on longitude and latitude properties
 * @param viewer
 * @param tileset
 * @param config
 */
function addBillboardsForTileset(viewer, tileset, config) {
  const dataSourceName = getBillboardDataSourceName(config.layer);
  viewer.dataSources.add(new CustomDataSource(dataSourceName));

  tileset.tileLoad.addEventListener(tile => {
    for (let i = 0; i < tile.content.featuresLength; i++) {
      const feature = tile.content.getFeature(i);
      const longitude = feature.getProperty(config.billboards.lonPropName);
      const latitude = feature.getProperty(config.billboards.latPropName);
      const position = new Cartographic(longitude, latitude, 20);

      const dataSource = viewer.dataSources.getByName(dataSourceName)[0];
      dataSource.entities.add({
        position: Cartographic.toCartesian(position),
        billboard: {
          image: './src/images/map-pin-solid.svg',
          scale: 0.1,
          translucencyByDistance: new NearFarScalar(6000, 0.9, 60000, 0.1),
          verticalOrigin: VerticalOrigin.BOTTOM,
          heightReference: HeightReference.RELATIVE_TO_GROUND
        }
      });
    }
  });
}

function getBillboardDataSourceName(layer) {
  return `${BILLBOARDS_PREFIX}${layer}`;
}

/**
 * Returns width and length for box
 * @param rectangle
 * @returns {{x: Number, y: Number}}
 */
export function getCartesianBoxSize(rectangle) {
  const sw = Cartographic.toCartesian(Rectangle.southwest(rectangle, new Cartographic()));
  const se = Cartographic.toCartesian(Rectangle.southeast(rectangle, new Cartographic()));
  const nw = Cartographic.toCartesian(Rectangle.northwest(rectangle, new Cartographic()));
  const x = Cartesian3.distance(sw, se); // gets box width
  const y = Cartesian3.distance(sw, nw); // gets box length
  return {x, y};
}

/**
 * Returns rectangle from width height and center point
 * @param width
 * @param height
 * @param center
 * @returns {Rectangle}
 */
export function calculateRectangle(width, height, center) {
  const w = new Cartesian3(center.x, center.y - width / 2, center.z);
  const west = CMath.toDegrees(Ellipsoid.WGS84.cartesianToCartographic(w).longitude);
  const s = new Cartesian3(center.x + height / 2, center.y, center.z);
  const south = CMath.toDegrees(Ellipsoid.WGS84.cartesianToCartographic(s).latitude);
  const e = new Cartesian3(center.x, center.y + width / 2, center.z);
  const east = CMath.toDegrees(Ellipsoid.WGS84.cartesianToCartographic(e).longitude);
  const n = new Cartesian3(center.x - height / 2, center.y, center.z);
  const north = CMath.toDegrees(Ellipsoid.WGS84.cartesianToCartographic(n).latitude);

  return Rectangle.fromDegrees(west, south, east, north);
}
