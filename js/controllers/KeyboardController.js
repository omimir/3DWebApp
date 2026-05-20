// Arrow keys cycle the model gallery, so the gallery is usable without a
// mouse. The listener sits on the gallery, so it only fires while a gallery
// button has focus and does not capture arrow keys meant for the page.
export class KeyboardController {
  constructor(galleryRoot, catalog, appState) {
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'];
    galleryRoot.addEventListener('keydown', (event) => {
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      const ids = catalog.models.map((model) => model.id);
      const current = Math.max(0, ids.indexOf(appState.activeModelId));
      const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
      const next = (current + (forward ? 1 : ids.length - 1)) % ids.length;
      appState.setActiveModel(ids[next]);
      galleryRoot.querySelector(`[data-model="${ids[next]}"]`)?.focus();
    });
  }
}
