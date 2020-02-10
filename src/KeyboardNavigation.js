
import {setCameraHeight} from './utils.js';

const upCodes = ['KeyQ', 'Space', 'NumpadAdd'];
const downCodes = ['KeyE', 'NumpadSubtract'];
const forwardCodes = ['KeyW', 'ArrowUp'];
const backwardCodes = ['KeyS', 'ArrowDown'];
const leftCodes = ['KeyA', 'ArrowLeft'];
const rightCodes = ['KeyD', 'ArrowRight'];

export default class KeyboardNavigation {

  /**
   * @param {import('cesium/Scene/Scene').default} scene
   * @param {number} moveAmount
   * @param {number} boostFactor
   */
  constructor(scene, moveAmount = 50, boostFactor = 4) {

    this.scene_ = scene;

    this.moveAmount_ = moveAmount;

    this.boostFactor_ = boostFactor;

    this.flags_ = {
      booster: false,
      moveUp: false,
      moveDown: false,
      moveForward: false,
      moveBackward: false,
      moveLeft: false,
      moveRight: false,
      rotateLeft: false,
      rotateRight: false
    };

    const onKey = this.onKey_.bind(this);
    const onPostRender = this.onPostRender_.bind(this);

    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKey);
    this.scene_.postRender.addEventListener(onPostRender);
  }

  onKey_(event) {
    if (targetNotEditable(event.target)) {
      const pressed = event.type === 'keydown';
      if (upCodes.includes(event.code)) {
        this.flags_.moveUp = pressed;
      } else if (downCodes.includes(event.code)) {
        this.flags_.moveDown = pressed;
      } else if (forwardCodes.includes(event.code)) {
        this.flags_.moveForward = pressed;
      } else if (backwardCodes.includes(event.code)) {
        this.flags_.moveBackward = pressed;
      } else if (leftCodes.includes(event.code)) {
        if (event.ctrlKey) {
          this.flags_.rotateLeft = pressed;
          this.flags_.moveLeft = false;
        } else {
          this.flags_.moveLeft = pressed;
          this.flags_.rotateLeft = false;
        }
      } else if (rightCodes.includes(event.code)) {
        if (event.ctrlKey) {
          this.flags_.rotateRight = pressed;
          this.flags_.moveRight = false;
        } else {
          this.flags_.moveRight = pressed;
          this.flags_.rotateRight = false;
        }
      }
      this.flags_.booster = event.shiftKey;
      this.scene_.requestRender();
    }
  }

  onPostRender_() {
    const camera = this.scene_.camera;

    const moveAmount = this.moveAmount_ * (this.flags_.booster ? this.boostFactor_ : 1);

    if (this.flags_.moveUp) {
      setCameraHeight(camera, camera.positionCartographic.height + moveAmount);
    }
    if (this.flags_.moveDown) {
      setCameraHeight(camera, camera.positionCartographic.height - moveAmount);
    }
    if (this.flags_.moveForward) {
      camera.moveForward(moveAmount);
    }
    if (this.flags_.moveBackward) {
      camera.moveBackward(moveAmount);
    }
    if (this.flags_.moveLeft) {
      camera.moveLeft(moveAmount);
    }
    if (this.flags_.moveRight) {
      camera.moveRight(moveAmount);
    }
    if (this.flags_.rotateLeft) {
      camera.lookLeft();
    }
    if (this.flags_.rotateRight) {
      camera.lookRight();
    }

  }
}


const notEditableTypes = ['checkbox', 'range'];

/**
 * @param {HTMLElement} target
 * @return {boolean}
 */
function targetNotEditable(target) {
  return target.tagName !== 'INPUT' || notEditableTypes.includes(target.type);
}