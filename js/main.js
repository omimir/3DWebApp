import { EventBus } from './core/EventBus.js';
import { AppState } from './models/AppState.js';
import { ModelCatalog } from './models/ModelCatalog.js';
import { SceneView } from './views/SceneView.js';
import { GalleryView } from './views/GalleryView.js';
import { ControlPanelView } from './views/ControlPanelView.js';
import { InfoPanelView } from './views/InfoPanelView.js';
import { TextureSwapView } from './views/TextureSwapView.js';
import { UIController } from './controllers/UIController.js';
import { AppController } from './controllers/AppController.js';
import { RaycastController } from './controllers/RaycastController.js';
import { KeyboardController } from './controllers/KeyboardController.js';
import { ImportController } from './controllers/ImportController.js';

async function start() {
  const bus = new EventBus();
  const appState = new AppState(bus);

  const canvas = document.getElementById('scene-canvas');
  const sceneView = new SceneView(canvas);
  sceneView.start();

  const catalog = await ModelCatalog.load('data/models.json', bus);
  const galleryRoot = document.getElementById('model-gallery');

  new GalleryView(galleryRoot, catalog, bus);
  new ControlPanelView(bus);
  new InfoPanelView(document.getElementById('model-description'), catalog, bus);
  new TextureSwapView(document.getElementById('texture-controls'), catalog, bus);
  new AppController(bus, catalog, sceneView);
  new UIController(appState);
  new RaycastController(canvas, sceneView, appState);
  new KeyboardController(galleryRoot, catalog, appState);
  new ImportController(
    document.getElementById('import-button'),
    document.getElementById('import-input'),
    catalog,
    appState,
  );

  appState.setActiveModel(catalog.models[0].id);
}

start().catch((error) => {
  console.error('app failed to start:', error);
});
