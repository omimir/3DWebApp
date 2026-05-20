// The model layer. It holds what the app is currently showing, and announces
// every change on the bus so the views can update themselves.
export class AppState {
  constructor(bus) {
    this.bus = bus;
    this.activeModelId = null;
    this.wireframe = false;
    this.spotlight = false;
    this.cameraMode = 'perspective';
    this.animating = false;
    this.exploded = false;
    this.textureId = 'plain';
    this.postfx = false;
  }

  setActiveModel(id) {
    if (id === this.activeModelId) return;
    this.activeModelId = id;
    this.textureId = 'plain';
    this.exploded = false;
    this.animating = false;
    this.bus.emit('model:changed', id);
  }

  toggleWireframe() {
    this.wireframe = !this.wireframe;
    this.bus.emit('wireframe:changed', this.wireframe);
  }

  toggleSpotlight() {
    this.spotlight = !this.spotlight;
    this.bus.emit('spotlight:changed', this.spotlight);
  }

  setCameraMode(mode) {
    if (mode === this.cameraMode) return;
    this.cameraMode = mode;
    this.bus.emit('camera:changed', mode);
  }

  resetCamera() {
    this.bus.emit('camera:reset');
  }

  setAnimating(on) {
    if (on === this.animating) return;
    this.animating = on;
    // the animation and the exploded view both move the model's parts, so
    // turning one on turns the other off
    if (on && this.exploded) {
      this.exploded = false;
      this.bus.emit('explode:changed', false);
    }
    this.bus.emit('animation:changed', on);
  }

  toggleAnimation() {
    this.setAnimating(!this.animating);
  }

  resetAnimation() {
    this.setAnimating(false);
    this.bus.emit('animation:reset');
  }

  toggleExplode() {
    this.exploded = !this.exploded;
    if (this.exploded && this.animating) {
      this.animating = false;
      this.bus.emit('animation:changed', false);
    }
    this.bus.emit('explode:changed', this.exploded);
  }

  setTexture(textureId) {
    this.textureId = textureId;
    this.bus.emit('texture:changed', textureId);
  }

  togglePostFX() {
    this.postfx = !this.postfx;
    this.bus.emit('postfx:changed', this.postfx);
  }
}
