import EarthquakeVisualizer from '../earthquakeVisualization/earthquakeVisualizer.js';
import IonResource from 'cesium/Core/IonResource.js';
import GeoJsonDataSource from 'cesium/DataSources/GeoJsonDataSource.js';
import Cesium3DTileset from 'cesium/Scene/Cesium3DTileset.js';
import Cesium3DTileStyle from 'cesium/Scene/Cesium3DTileStyle.js';
import {getSwisstopoImagery} from '../swisstopoImagery.js';
import {LAYER_TYPES} from '../constants.js';
import Cartesian3 from 'cesium/Core/Cartesian3.js';
import Color from 'cesium/Core/Color.js';
import HeightReference from 'cesium/Scene/HeightReference.js';
import CustomDataSource from 'cesium/DataSources/CustomDataSource.js';
import Cartographic from 'cesium/Source/Core/Cartographic';

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
    show: !!config.visible
  });
  if (config.assetId === 68857) { // TODO temp
    tileset.allTilesLoaded.addEventListener(function () {
      for (let i = 0; i < tileset.root.content.featuresLength; i++) {
        const feature = tileset.root.content.getFeature(i);
        const longitude = feature.getProperty('Longitude');
        const latitude = feature.getProperty('Latitude');
        const height = feature.getProperty('Height');
        const position = new Cartographic(longitude, latitude, height);
        const dataSource = viewer.dataSources.getByName('billboards').length
          ? viewer.dataSources.getByName('billboards')[0]
          : viewer.dataSources.add(new CustomDataSource('billboards'));
        dataSource.entities.add({
          position: Cartographic.toCartesian(position),
          ellipsoid: {
            radii: new Cartesian3(10, 10, 10),
            material: new Color(0, 0, 0),
            heightReference: HeightReference.RELATIVE_TO_GROUND
          }
        });
      }
    });

    console.log(tileset);

    // GeoJsonDataSource.load('./src/layers/BH_Location.geojson').then(dataSource => {
    //   console.log(viewer.scene);
    //   console.log(tileset, dataSource);
    //   viewer.dataSources.add(dataSource);
    //   dataSource.show = true;
    //   return dataSource;
    // });
  }
  if (config.style) {
    tileset.style = new Cesium3DTileStyle(config.style);
  }
  tileset.pickable = config.pickable !== undefined ? config.pickable : false;
  viewer.scene.primitives.add(tileset);

  config.setVisibility = visible => tileset.show = !!visible;
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
