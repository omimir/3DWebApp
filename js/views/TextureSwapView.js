// Renders the texture options for the active model into the control panel.
// Models without texture options show a short hint instead.
export class TextureSwapView {
  constructor(root, catalog, bus) {
    this.root = root;
    this.catalog = catalog;
    bus.on('model:changed', (id) => this.#render(id));
  }

  #render(id) {
    const model = this.catalog.get(id);
    const textures = model && model.textures ? model.textures : [];
    this.root.replaceChildren();

    if (textures.length === 0) {
      const hint = document.createElement('p');
      hint.className = 'control-hint';
      hint.textContent = 'This model has no texture options.';
      this.root.append(hint);
      return;
    }

    for (const texture of textures) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-vitrine';
      button.dataset.texture = texture.id;
      button.textContent = texture.label;
      this.root.append(button);
    }
  }
}
