# Vitrine

An interactive 3D web app that shows three Blender models in the browser: a
drinks can, a water bottle and a desk globe. Built for the Web 3D Apps
coursework.

It loads glTF models with Three.js. You get an orbit camera with perspective
and orthographic views, a wireframe toggle, lighting controls, an exploded
view, a texture swap for the globe, and an animation built for each model. You
can also import your own glTF files. Two custom GLSL shaders and an optional
post-processing pass sit on top. The code is organised as model, view and
controller in vanilla JavaScript modules.

## Run locally

The app uses ES modules and the fetch API, so it has to be served over HTTP
rather than opened from the file system.

With VS Code, install the recommended Live Preview extension (see
`.vscode/extensions.json`), open `index.html` and choose "Show Preview".

From a terminal:

```bash
npx serve .
```

Open the printed URL and follow the App link.

## Layout

- `index.html` and the other root `.html` files are the site pages
- `css/` holds the theme, layout and component styles
- `js/` holds the application code, split by MVC role: `models/`, `views/` and
  `controllers/`, plus `three/`, `shaders/` and `postprocessing/`
- `js/lib/` holds vendored Three.js and Bootstrap, pinned to fixed versions
- `assets/models/` holds the `.glb` exports and the `.blend` sources
- `assets/textures/` holds the runtime textures for the globe texture swap
- `data/models.json` holds the model metadata loaded at runtime
- `tools/glb_to_x3d.js` converts the glTF exports to X3D

## 3D models

The models are built and textured in Blender, then exported to glTF 2.0
(`.glb`). The `.blend` sources are kept under `assets/models/blend/`.

Blender 5.1 no longer ships an X3D exporter, so `tools/glb_to_x3d.js` converts
the glTF exports to X3D:

```bash
node tools/glb_to_x3d.js
```

The X3D models are published in a separate repository.

## Deployment

The site is static, uses relative paths and vendors its libraries, so it has no
build step. To deploy, upload the project folder (excluding `.git`) to a web
server such as the university ITS web space.

## Dependencies

Vendored under `js/lib/`, at pinned versions:

- Three.js r170
- Bootstrap 5.3.3

Both keep their own licences. Original code in this repository is under the MIT
licence (see `LICENSE`). Third-party code and assets are listed in
`references.html`.
