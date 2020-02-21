// @ts-check

import Cesium3DTileStyle from 'cesium/Scene/Cesium3DTileStyle.js';
import Cesium3DTileset from 'cesium/Scene/Cesium3DTileset.js';
import GeoJsonDataSource from 'cesium/DataSources/GeoJsonDataSource.js';
import IonResource from 'cesium/Core/IonResource.js';
import {html, render} from 'lit-html';
import {getSwisstopoImagery} from '../swisstopoImagery.js';
import EarthquakeVisualizer from '../earthquakeVisualization/earthquakeVisualizer.js';
import {layersConfig, layerCategories} from './layerConfigs.js';
import {repeat} from 'lit-html/directives/repeat';

import i18next from 'i18next';
import {getLayerParams, syncLayersParam} from '../permalink';
import {onAccordionTitleClick} from '../utils.js';


function createEarthquakeFromConfig(viewer, config) {
  const earthquakeVisualizer = new EarthquakeVisualizer(viewer);
  if (config.visible) {
    earthquakeVisualizer.setVisible(true);
  }
  config.setVisibility = visible => earthquakeVisualizer.setVisible(visible);
  return earthquakeVisualizer;
}

function createIonGeoJSONFromConfig(viewer, config) {
  return IonResource.fromAssetId(config.assetId)
    .then(resource => GeoJsonDataSource.load(resource))
    .then(dataSource => {
      viewer.dataSources.add(dataSource);
      dataSource.show = !!config.visible;
      config.setVisibility = visible => dataSource.show = !!visible;
      return dataSource;
    });
}

function createIon3DTilesetFromConfig(viewer, config) {
  const primitive = viewer.scene.primitives.add(
    new Cesium3DTileset({
      show: !!config.visible,
      url: IonResource.fromAssetId(config.assetId)
    })
  );
  config.setVisibility = visible => primitive.show = !!visible;
  return primitive;
}

function create3DTilesetFromConfig(viewer, config) {
  const primitive = new Cesium3DTileset({
    url: config.url,
    show: !!config.visible,
  });
  if (config.style) {
    primitive.style = new Cesium3DTileStyle(config.style);
  }
  viewer.scene.primitives.add(primitive);

  config.setVisibility = visible => primitive.show = !!visible;
  return primitive;
}

function createSwisstopoWMTSImageryLayer(viewer, config) {
  let layer = null;
  config.setVisibility = visible => layer.show = !!visible;
  config.setOpacity = opacity => layer.alpha = opacity;

  return getSwisstopoImagery(config.layer).then(l => {
    layer = l;
    viewer.scene.imageryLayers.add(layer);
    layer.alpha = config.opacity || 1;
    layer.show = !!config.visible;
    return layer;
  });
}

const factories = {
  ionGeoJSON: createIonGeoJSONFromConfig,
  ion3dtiles: createIon3DTilesetFromConfig,
  '3dtiles': create3DTilesetFromConfig,
  swisstopoWMTS: createSwisstopoWMTSImageryLayer,
  earthquakes: createEarthquakeFromConfig,
};

function buildLayertree() { // TODO improve
  const layerTree = layerCategories.map(cat => {
    const childCategories = layerCategories.filter(c => c.parent === cat.id);
    const childLayers = layersConfig.filter(l => l.parent === cat.id);
    cat.children = [...childLayers, ...childCategories];
    return cat;
  });
  return layerTree.filter(cat => !cat.parent);
}

function getLayerRender(viewer, config, index) {
  if (!config.promise) {
    const visibleLayers = getLayerParams();
    if (visibleLayers && visibleLayers.length) {
      const layerParams = visibleLayers.find(layer => layer.name === config.layer);
      config.visible = !!layerParams;
      config.opacity = layerParams ? layerParams.opacity : 1;
    } else {
      syncLayersParam(layersConfig);
    }
    config.promise = factories[config.type](viewer, config);
  }
  const changeVisibility = evt => {
    config.setVisibility(evt.target.checked);
    config.visible = evt.target.checked;
    syncLayersParam(layersConfig);
    viewer.scene.requestRender();
  };
  const changeOpacity = evt => {
    config.setOpacity(evt.target.value);
    config.opacity = evt.target.value;
    syncLayersParam(layersConfig);
    viewer.scene.requestRender();
  };


  return html`
    <div class="ui checkbox">
      <input id="layer-item-${index}" type="checkbox" ?checked=${config.visible} @change=${changeVisibility}>
      <label for="layer-item-${index}" data-i18n>${i18next.t(config.label)}</label>
    </div>
    <div class="layer-slider" ?hidden=${!config.setOpacity}>
      <label>opacity: </label>
      <input type="range" min="0" max="1" value=${config.opacity || 1} @input=${changeOpacity} step="0.05">
    </div>
    `;
}

/**
 * @param {import('cesium/Widgets/Viewer/Viewer').default} viewer
 * @param {HTMLElement} target
 */
function doRender(viewer, target) {
  const layerTree = buildLayertree();
  const templates = layerTree.map((layerCategory, index) => {

    const repeatCallback = (child, idx) => {
      const isLayer = !!child.layer;
      return html`
      ${idx !== 0 ? html`<div class="ui divider ngm-layer-divider"></div>` : ''}
      ${isLayer ?
        html`<div>${getLayerRender(viewer, child, idx)}</div>` :
        html`<div class="ui styled accordion ngm-layers-categories">${categoryRender(child)}</div>`
      }
      `;
    };

    const categoryRender = (layerCat) => html`
      <div class="title ngm-layer-title" @click=${onAccordionTitleClick}>
        <i class="dropdown icon"></i>
        ${layerCat.label}
      </div>
      <div class="content ngm-layer-content">
         <div>
        ${repeat(layerCat.children, (child) => child.id || Number((Math.random() * 100).toFixed()), repeatCallback)}
        </div>
      </div>
    `;
    return categoryRender(layerCategory);
  });
  render(templates, target);
}

/**
 * @param {import('cesium/Widgets/Viewer/Viewer').default} viewer
 * @param {HTMLElement} target
 */
export function setupLayers(viewer, target) {
  doRender(viewer, target);
  i18next.on('languageChanged', options => {
    doRender(viewer, target);
  });
}
