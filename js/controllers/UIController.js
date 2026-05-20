// Translates user input into model changes. One special listener covers the
// gallery and the control panel so it survives the views re-rendering.
export class UIController {
  constructor(appState) {
    document.addEventListener('click', (event) => {
      const galleryButton = event.target.closest('.gallery-item');
      if (galleryButton) {
        appState.setActiveModel(galleryButton.dataset.model);
        return;
      }
      const textureButton = event.target.closest('[data-texture]');
      if (textureButton) {
        appState.setTexture(textureButton.dataset.texture);
        return;
      }
      const actionButton = event.target.closest('[data-action]');
      if (actionButton) handleAction(actionButton.dataset.action, appState);
    });
  }
}

function handleAction(action, appState) {
  switch (action) {
    case 'toggle-wireframe':
      appState.toggleWireframe();
      break;
    case 'toggle-spotlight':
      appState.toggleSpotlight();
      break;
    case 'camera-perspective':
      appState.setCameraMode('perspective');
      break;
    case 'camera-orthographic':
      appState.setCameraMode('orthographic');
      break;
    case 'camera-reset':
      appState.resetCamera();
      break;
    case 'play-animation':
      appState.toggleAnimation();
      break;
    case 'reset-animation':
      appState.resetAnimation();
      break;
    case 'toggle-explode':
      appState.toggleExplode();
      break;
    case 'toggle-postfx':
      appState.togglePostFX();
      break;
  }
}
