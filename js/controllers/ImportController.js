// Imports a glTF binary the visitor chooses from disk and adds it to the
// gallery as a new model for the current session. The file is read through an
// object URL so nothing leaves the browser.
export class ImportController {
  constructor(button, input, catalog, appState) {
    let count = 0;
    button.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
      const file = input.files[0];
      input.value = '';
      if (!file) return;
      count += 1;
      const id = `imported-${count}`;
      catalog.add({
        id,
        name: file.name.replace(/\.glb$/i, '') || `Imported ${count}`,
        file: URL.createObjectURL(file),
        description: `An imported model, loaded in the browser from ${file.name}.`,
      });
      appState.setActiveModel(id);
    });
  }
}
