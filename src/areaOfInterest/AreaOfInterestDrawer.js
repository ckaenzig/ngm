import ScreenSpaceEventType from 'cesium/Core/ScreenSpaceEventType.js';
import Cartesian3 from 'cesium/Core/Cartesian3.js';
import CustomDataSource from 'cesium/DataSources/CustomDataSource.js';
import KmlDataSource from 'cesium/DataSources/KmlDataSource.js';
import Entity from 'cesium/DataSources/Entity.js';
import {DEFAULT_AOI_COLOR, CESIUM_NOT_GRAPHICS_ENTITY_PROPS, AOI_DATASOURCE_NAME} from '../constants.js';
import getTemplate from './areaOfInterestTemplate.js';
import i18next from 'i18next';

import {LitElement} from 'lit-element';

import {
  DEFAULT_AOI_COLOR,
  CESIUM_NOT_GRAPHICS_ENTITY_PROPS,
  AOI_DATASOURCE_NAME
} from '../constants.js';
import {updateColor} from './helpers.js';
import {showWarning} from '../message.js';
import {I18nMixin} from '../i18n';
import {CesiumDraw} from '../draw/CesiumDraw.js';

class NgmAreaOfInterestDrawer extends I18nMixin(LitElement) {

  static get properties() {
    return {
      viewer: {type: Object},
      drawMode_: {type: Boolean},
      selectedArea_: {type: Object},
    };
  }

  update(changedProperties) {
    if (!this.aoiInited && this.viewer) {
      this.initAoi();
    }
    super.update(changedProperties);
  }

  initAoi() {
    this.selectedArea_ = null;

    this.areasCounter_ = 0;
    this.areasClickable = false;

    this.viewer_ = viewer;

    this.draw_ = new CesiumDraw(this.viewer_, 'polygon', {
      fillColor: DEFAULT_AOI_COLOR
    });
    this.draw_.active = false;

    this.draw_.addEventListener('drawend', this.endDrawing_.bind(this));

    this.viewer_.screenSpaceEventHandler.setInputAction(this.onClick_.bind(this), ScreenSpaceEventType.LEFT_CLICK);

    this.interestAreasDataSource = new CustomDataSource(AOI_DATASOURCE_NAME);
    this.viewer.dataSources.add(this.interestAreasDataSource);

    this.screenSpaceEventHandler_ = new ScreenSpaceEventHandler(this.viewer.scene.canvas);
    this.screenSpaceEventHandler_.setInputAction(this.onClick_.bind(this), ScreenSpaceEventType.LEFT_CLICK);
    this.interestAreasDataSource.entities.collectionChanged.addEventListener(() => {
      this.viewer.scene.requestRender();
      this.requestUpdate();
    });
    this.aoiInited = true;
  }

  endDrawing_(event) {
    this.draw_.active = false;
    this.draw_.clear();

    this.areasCounter_ += 1;

    // wgs84 to Cartesian3
    const positions = Cartesian3.fromDegreesArrayHeights(event.detail.positions.flat());

    this.interestAreasDataSource.entities.add({
      selectable: false,
      name: `Area ${this.areasCounter_}`,
      polygon: {
        hierarchy: positions,
        material: DEFAULT_AOI_COLOR
      }
    });

    this.doRender_();
  }

  cancelDraw_() {
    this.draw_.active = false;
    this.draw_.clear();
  }

  onClick_(click) {
    if (!this.draw_.active) {
      const pickedObject = this.viewer_.scene.pick(click.position);
      if (pickedObject) {
        if (this.interestAreasDataSource.entities.contains(pickedObject.id)) {
          this.pickArea_(pickedObject.id.id);
        } else if (this.selectedArea_) {
          updateColor(this.selectedArea_, false);
          this.selectedArea_ = null;
        }
      }
    }
  }

  deselectArea() {
    if (this.selectedArea_) {
      updateColor(this.selectedArea_, false);
      this.selectedArea_ = null;
    }
  }

  pickArea_(id) {
    if (this.selectedArea_ && this.selectedArea_.id === id) {
      return;
    }
    const entity = this.interestAreasDataSource.entities.getById(id);
    if (this.selectedArea_) {
      updateColor(this.selectedArea_, false);
      this.selectedArea_ = null;
    }
    this.selectedArea_ = entity;
    updateColor(this.selectedArea_, true);
  }

  get entitiesList_() {
    return this.interestAreasDataSource.entities.values.map(val => {
      return {
        id: val.id,
        name: val.name,
        show: val.isShowing,
        selected: this.selectedArea_ && this.selectedArea_.id === val.id
      };
    });
  }

  onShowHideEntityClick_(id) {
    const entity = this.interestAreasDataSource.entities.getById(id);
    entity.show = !entity.isShowing;
  }

  onRemoveEntityClick_(id) {
    if (id) {
      this.interestAreasDataSource.entities.removeById(id);
    } else {
      this.interestAreasDataSource.entities.removeAll();
      this.areasCounter_ = 0;
    }
  }

  onAddAreaClick_() {
    this.draw_.active = true;
  }

  flyToArea_(id) {
    const entity = this.interestAreasDataSource.entities.getById(id);
    if (!entity.isShowing) {
      entity.show = !entity.isShowing;
    }
    this.viewer.flyTo(entity);
    this.pickArea_(id);
  }

  async uploadArea_(evt) {
    const file = evt.target ? evt.target.files[0] : null;
    if (file) {
      if (!file.name.toLowerCase().includes('.kml')) {
        showWarning(i18next.t('unsupported_file_warning'));
        evt.target.value = null;
        return;
      }
      const kmlDataSource = await KmlDataSource.load(file,
        {
          camera: this.viewer.scene.camera,
          canvas: this.viewer.scene.canvas,
          clampToGround: true
        });
      evt.target.value = null;

      const entity = new Entity();
      kmlDataSource.entities.values.forEach(ent => entity.merge(ent));

      const notOnlyPolygon = entity.propertyNames.some(prop => !CESIUM_NOT_GRAPHICS_ENTITY_PROPS.includes(prop) && !!entity[prop]);

      if (notOnlyPolygon) {
        showWarning(i18next.t('unsupported_kml_warning'));
        return;
      }

      entity.polygon.fill = true;
      entity.polygon.material = DEFAULT_AOI_COLOR;
      this.interestAreasDataSource.entities.add(entity);
      this.viewer.flyTo(entity);
    }
  }

  setAreasClickable(areasClickable) {
    this.areasClickable = areasClickable;
    if (!this.areasClickable) {
      this.deselectArea();
    }
  }

  render() {
    if (!this.viewer) {
      return '';
    }

    return getTemplate.call(this);
  }

  createRenderRoot() {
    return this;
  }

}

customElements.define('ngm-aoi-drawer', NgmAreaOfInterestDrawer);
