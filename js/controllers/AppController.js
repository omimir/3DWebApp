// Bridges model changes to the 3D view. The model publishes on the bus and
// this controller turns those events into scene view calls.
export class AppController {
  constructor(bus, catalog, sceneView) {
    let currentModelId = null;

    bus.on('model:changed', (id) => {
      currentModelId = id;
      sceneView.loadModel(catalog.get(id)).catch((error) => {
        console.error('model load failed:', error);
      });
    });
    bus.on('wireframe:changed', (on) => sceneView.setWireframe(on));
    bus.on('spotlight:changed', (on) => sceneView.setSpotlight(on));
    bus.on('camera:changed', (mode) => sceneView.setCameraMode(mode));
    bus.on('camera:reset', () => sceneView.resetView());
    bus.on('animation:changed', (on) => sceneView.setAnimating(on));
    bus.on('animation:reset', () => sceneView.resetAnimation());
    bus.on('explode:changed', (on) => sceneView.setExploded(on));
    bus.on('postfx:changed', (on) => sceneView.setPostFX(on));
    bus.on('texture:changed', (textureId) => {
      const model = catalog.get(currentModelId);
      const texture = model && model.textures
        ? model.textures.find((entry) => entry.id === textureId)
        : null;
      sceneView.applyTexture(texture && texture.map ? texture.map : null);
    });
  }
}
