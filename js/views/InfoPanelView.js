// Shows the description of the active model in the info panel.
export class InfoPanelView {
  constructor(element, catalog, bus) {
    this.element = element;
    this.catalog = catalog;
    bus.on('model:changed', (id) => this.#show(id));
  }

  #show(id) {
    const model = this.catalog.get(id);
    this.element.textContent = model ? model.description : '';
  }
}
