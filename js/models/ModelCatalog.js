// The set of models the app can show, loaded from data/models.json and
// extended at runtime when the user imports a file.
export class ModelCatalog {
  constructor(models, bus) {
    this.models = models;
    this.bus = bus;
    this.byId = new Map(models.map((model) => [model.id, model]));
  }

  static async load(url, bus) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`could not load ${url}: ${response.status}`);
    }
    const data = await response.json();
    return new ModelCatalog(data.models, bus);
  }

  get(id) {
    return this.byId.get(id);
  }

  add(model) {
    this.models.push(model);
    this.byId.set(model.id, model);
    this.bus.emit('catalog:changed');
  }
}
