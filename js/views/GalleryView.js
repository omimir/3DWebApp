// Renders the model gallery and keeps the active item highlighted. It
// re-renders when a model is imported into the catalog.
export class GalleryView {
  constructor(root, catalog, bus) {
    this.root = root;
    this.catalog = catalog;
    this.#render();
    bus.on('catalog:changed', () => this.#render());
    bus.on('model:changed', (id) => this.#highlight(id));
  }

  #render() {
    this.root.replaceChildren();
    for (const model of this.catalog.models) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'gallery-item';
      button.dataset.model = model.id;
      button.textContent = model.name;
      button.setAttribute('aria-pressed', 'false');
      item.append(button);
      this.root.append(item);
    }
  }

  #highlight(activeId) {
    for (const button of this.root.querySelectorAll('.gallery-item')) {
      const active = button.dataset.model === activeId;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
  }
}
