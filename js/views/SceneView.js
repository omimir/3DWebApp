import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LightingRig } from '../three/LightingRig.js';
import { createAtmosphere } from '../shaders/AtmosphereShader.js';
import { PostFX } from '../postprocessing/PostFX.js';

// The 3D view: owns the renderer, scene, cameras, controls and render loop,
// and loads glTF models on request. Rendering is on demand, so the page
// stays idle when nothing is moving.
export class SceneView {
  constructor(canvas) {
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x14161b);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.perspectiveCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    this.perspectiveCamera.position.set(4, 3, 6);
    this.orthographicCamera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.01, 400);
    this.orthographicCamera.position.set(4, 3, 6);
    this.camera = this.perspectiveCamera;

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minZoom = 0.4;
    this.controls.maxZoom = 5;
    this.controls.addEventListener('change', () => { this.needsRender = true; });

    this.lighting = new LightingRig(this.scene);
    this.ground = createGroundPlane();
    this.scene.add(this.ground);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.textureLoader = new THREE.TextureLoader();
    this.textureCache = new Map();

    this.clock = new THREE.Clock();
    this.activeModel = null;
    this.atmosphere = null;
    this.framedRadius = 1;
    this.wireframe = false;
    this.anim = null;
    this.postFXEnabled = false;
    this.parts = [];
    this.explodeProgress = 0;
    this.explodeTarget = 0;
    this.swapMaterial = null;
    this.swapBaseColour = null;
    this.swapBaseMap = null;
    this.needsRender = true;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.loadingManager = new THREE.LoadingManager();
    this.loader = new GLTFLoader(this.loadingManager);
    this.postfx = new PostFX(this.renderer, this.scene, this.camera);

    this.resize();
    new ResizeObserver(() => this.resize()).observe(this.canvas.parentElement);
  }

  async loadModel(record) {
    const gltf = await this.loader.loadAsync(record.file);
    const model = gltf.scene;

    // the export carries the blender lights and cameras; the app lights and
    // frames the model itself, so strip them out
    const strip = [];
    model.traverse((object) => {
      if (object.isLight || object.isCamera) strip.push(object);
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    strip.forEach((object) => object.removeFromParent());

    if (this.activeModel) {
      this.scene.remove(this.activeModel);
      disposeModel(this.activeModel);
    }
    this.scene.add(model);
    this.activeModel = model;
    this.swapMaterial = null;
    this.swapBaseColour = null;
    this.swapBaseMap = null;
    this.#frame(model);
    this.#applyClearMaterials(record);
    this.#applyWireframe();
    this.#applyEffects(record.effects);
    this.#setupAnimation(record);
    model.updateMatrixWorld(true);
    this.#recordParts(model);
    this.needsRender = true;
    return gltf;
  }

  setWireframe(on) {
    this.wireframe = on;
    this.#applyWireframe();
    this.needsRender = true;
  }

  setSpotlight(on) {
    this.lighting.setSpotlight(on);
    this.needsRender = true;
  }

  setPostFX(on) {
    this.postFXEnabled = on;
    this.needsRender = true;
  }

  setExploded(on) {
    // explode and the per-model animation move the same parts, so the one
    // being switched on snaps the other back to rest first
    if (on) this.#snapAnimationToRest();
    // the atmosphere shell belongs to the whole globe, so hide it while the
    // globe is taken apart
    if (this.atmosphere) this.atmosphere.visible = !on;
    this.explodeTarget = on ? 1 : 0;
    // a user who asked for reduced motion gets the end state, not the tween
    if (this.reducedMotion) {
      this.explodeProgress = this.explodeTarget;
      for (const part of this.parts) {
        part.object.position.copy(part.rest).addScaledVector(part.offset, this.explodeTarget);
      }
    }
    this.needsRender = true;
  }

  setCameraMode(mode) {
    const next = mode === 'orthographic' ? this.orthographicCamera : this.perspectiveCamera;
    if (next === this.camera) return;
    next.position.copy(this.camera.position);
    this.camera = next;
    this.controls.object = next;
    this.postfx.setCamera(next);
    this.resize();
    if (this.activeModel) this.#frame(this.activeModel);
    this.needsRender = true;
  }

  setAnimating(on) {
    if (on) this.#snapExplodeToRest();
    this.#setAnimationGoal(on);
    this.needsRender = true;
  }

  resetAnimation() {
    this.#snapAnimationToRest();
    this.needsRender = true;
  }

  resetView() {
    if (this.activeModel) this.#frame(this.activeModel);
    this.needsRender = true;
  }

  // applies a texture map to the model's main mesh, or restores the original
  // material when url is null
  applyTexture(url) {
    const mesh = this.#largestMesh();
    if (!mesh) return;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (this.swapMaterial !== material) {
      this.swapMaterial = material;
      this.swapBaseColour = material.color.clone();
      this.swapBaseMap = material.map;
    }
    if (url) {
      material.map = this.#texture(url);
      material.color.setRGB(1, 1, 1);
    } else {
      material.map = this.swapBaseMap;
      material.color.copy(this.swapBaseColour);
    }
    material.needsUpdate = true;
    this.needsRender = true;
  }

  // returns true if the pointer, in normalised device coordinates, hit the model
  pickModel(x, y) {
    if (!this.activeModel) return false;
    this.raycaster.setFromCamera(this.pointer.set(x, y), this.camera);
    return this.raycaster.intersectObject(this.activeModel, true).length > 0;
  }

  #applyEffects(effects) {
    if (this.atmosphere) {
      this.scene.remove(this.atmosphere);
      this.atmosphere.geometry.dispose();
      this.atmosphere.material.dispose();
      this.atmosphere = null;
    }
    if (!effects || !effects.includes('atmosphere')) return;
    const mesh = this.#largestMesh();
    if (!mesh) return;
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    this.atmosphere = createAtmosphere();
    this.atmosphere.scale.set(size.x / 2, size.y / 2, size.z / 2);
    this.atmosphere.position.copy(box.getCenter(new THREE.Vector3()));
    this.scene.add(this.atmosphere);
  }

  // records the model's top-level parts so the exploded view can move them
  // apart along the direction from the model centre
  #recordParts(model) {
    this.parts = [];
    this.explodeProgress = 0;
    this.explodeTarget = 0;
    const centre = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
    for (const child of model.children) {
      const box = new THREE.Box3().setFromObject(child);
      if (box.isEmpty()) continue;
      const direction = box.getCenter(new THREE.Vector3()).sub(centre);
      if (direction.lengthSq() < 1e-6) direction.set(0, 1, 0);
      this.parts.push({
        object: child,
        rest: child.position.clone(),
        offset: direction.normalize().multiplyScalar(this.framedRadius * 0.26),
      });
    }
  }

  // swaps named materials for a transmissive clear plastic, so a model with an
  // opaque body in the file (the bottle) reads as see-through in the viewer
  #applyClearMaterials(record) {
    const names = record.clearMaterials;
    if (!names || names.length === 0) return;
    this.activeModel.traverse((object) => {
      if (!object.isMesh) return;
      const single = !Array.isArray(object.material);
      const materials = single ? [object.material] : object.material;
      let changed = false;
      const next = materials.map((material) => {
        if (!material || !names.includes(material.name)) return material;
        changed = true;
        const clear = makeClearPlastic(material.name);
        material.dispose();
        return clear;
      });
      if (changed) object.material = single ? next[0] : next;
    });
  }

  // builds the active model's own animation from its models.json spec: the
  // bottle cap unscrews, the can tab pops open, the globe sphere spins
  #setupAnimation(record) {
    this.anim = null;
    const spec = record.animation;
    if (!spec) {
      // an imported model has no spec, so Animate just turns the whole model
      this.anim = {
        kind: 'spin',
        part: this.activeModel,
        restQuat: this.activeModel.quaternion.clone(),
        speed: 0,
        goal: 0,
      };
      return;
    }
    const part = this.activeModel.getObjectByName(spec.part);
    if (!part) return;

    if (spec.kind === 'unscrew') {
      this.anim = {
        kind: 'unscrew',
        part,
        restY: part.position.y,
        restRotY: part.rotation.y,
        lift: this.framedRadius * 0.15,
        turns: Math.PI * 6,
        progress: 0,
        goal: 0,
      };
    } else if (spec.kind === 'spin') {
      this.anim = { kind: 'spin', part, restQuat: part.quaternion.clone(), speed: 0, goal: 0 };
    } else if (spec.kind === 'poptab') {
      this.anim = this.#setupTabPivot(part);
    }
  }

  // wraps the tab in a group placed at the rivet on the can's axis, so
  // rotating the group hinges the tab open the way a real ring pull does
  #setupTabPivot(tab) {
    const model = this.activeModel;
    const tabBox = new THREE.Box3().setFromObject(tab);
    const tabCentre = tabBox.getCenter(new THREE.Vector3());
    const tabSize = tabBox.getSize(new THREE.Vector3());
    const modelCentre = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());

    const pivot = new THREE.Vector3(modelCentre.x, tabCentre.y, modelCentre.z);
    // hinge across the tab's shorter side and lift the end away from the rivet
    const axis = tabSize.x >= tabSize.z ? 'z' : 'x';
    const reach = axis === 'z' ? tabCentre.x - pivot.x : tabCentre.z - pivot.z;
    const sign = (reach >= 0 ? 1 : -1) * (axis === 'z' ? 1 : -1);

    const group = new THREE.Group();
    group.position.copy(model.worldToLocal(pivot.clone()));
    model.add(group);
    group.attach(tab);

    return {
      kind: 'poptab',
      group,
      axis,
      openAngle: sign * (Math.PI / 4.5),
      progress: 0,
      goal: 0,
    };
  }

  #setAnimationGoal(on) {
    const a = this.anim;
    if (!a) return;
    if (a.kind === 'spin') {
      a.goal = on ? (this.reducedMotion ? 0.5 : 2.2) : 0;
      return;
    }
    a.goal = on ? 1 : 0;
    // reduced motion gets the end state without the tween
    if (this.reducedMotion) {
      a.progress = a.goal;
      this.#applyPartAnimation(a);
    }
  }

  #applyPartAnimation(a) {
    const t = easeInOutQuad(a.progress);
    if (a.kind === 'unscrew') {
      a.part.position.y = a.restY + a.lift * t;
      a.part.rotation.y = a.restRotY + a.turns * t;
    } else if (a.kind === 'poptab') {
      a.group.rotation[a.axis] = a.openAngle * t;
    }
  }

  #updateAnimation(delta) {
    const a = this.anim;
    if (!a) return;
    if (a.kind === 'spin') {
      // the speed eases toward its goal, so the model spins up and, once the
      // goal is back to zero, coasts to a stop
      const rate = delta * 1.6;
      a.speed += THREE.MathUtils.clamp(a.goal - a.speed, -rate, rate);
      if (Math.abs(a.speed) > 1e-4) {
        a.part.rotateY(a.speed * delta);
        this.needsRender = true;
      }
      return;
    }
    if (a.progress !== a.goal) {
      const step = delta * 1.1;
      a.progress = a.goal > a.progress
        ? Math.min(a.goal, a.progress + step)
        : Math.max(a.goal, a.progress - step);
      this.#applyPartAnimation(a);
      this.needsRender = true;
    }
  }

  #snapAnimationToRest() {
    const a = this.anim;
    if (!a) return;
    if (a.kind === 'spin') {
      a.speed = 0;
      a.goal = 0;
      a.part.quaternion.copy(a.restQuat);
    } else {
      a.progress = 0;
      a.goal = 0;
      this.#applyPartAnimation(a);
    }
    this.needsRender = true;
  }

  #snapExplodeToRest() {
    this.explodeProgress = 0;
    this.explodeTarget = 0;
    for (const part of this.parts) {
      part.object.position.copy(part.rest);
    }
  }

  #texture(url) {
    if (this.textureCache.has(url)) return this.textureCache.get(url);
    const texture = this.textureLoader.load(url, () => { this.needsRender = true; });
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.anisotropy = 8;
    this.textureCache.set(url, texture);
    return texture;
  }

  #largestMesh() {
    let largest = null;
    let mostVertices = -1;
    this.activeModel?.traverse((object) => {
      if (!object.isMesh) return;
      const count = object.geometry.attributes.position?.count ?? 0;
      if (count > mostVertices) {
        mostVertices = count;
        largest = object;
      }
    });
    return largest;
  }

  #applyWireframe() {
    if (!this.activeModel) return;
    this.activeModel.traverse((object) => {
      if (!object.isMesh) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.wireframe = this.wireframe;
    });
  }

  #frame(model) {
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const centre = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).length() / 2 || 1;
    this.framedRadius = radius;

    this.ground.position.y = box.min.y;
    this.lighting.focus(box);

    this.controls.target.copy(centre);
    this.controls.minDistance = radius * 0.7;
    this.controls.maxDistance = radius * 9;

    const offset = new THREE.Vector3(0.7, 0.45, 1).normalize().multiplyScalar(radius * 3.0);
    this.camera.position.copy(centre).add(offset);

    if (this.camera.isPerspectiveCamera) {
      this.camera.near = radius / 50;
      this.camera.far = radius * 80;
    } else {
      this.camera.near = 0.01;
      this.camera.far = radius * 200;
      this.#updateOrthoFrustum();
    }
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  #updateOrthoFrustum() {
    const wrap = this.canvas.parentElement;
    const aspect = (wrap.clientWidth / wrap.clientHeight) || 1;
    const halfHeight = this.framedRadius * 1.6;
    const halfWidth = halfHeight * aspect;
    const camera = this.orthographicCamera;
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
  }

  start() {
    this.renderer.setAnimationLoop(() => this.#tick());
  }

  #tick() {
    const delta = this.clock.getDelta();
    this.controls.update();

    this.#updateAnimation(delta);

    if (this.explodeProgress !== this.explodeTarget) {
      const step = delta * 2.4;
      this.explodeProgress = this.explodeTarget > this.explodeProgress
        ? Math.min(this.explodeTarget, this.explodeProgress + step)
        : Math.max(this.explodeTarget, this.explodeProgress - step);
      const eased = easeInOutQuad(this.explodeProgress);
      for (const part of this.parts) {
        part.object.position.copy(part.rest).addScaledVector(part.offset, eased);
      }
      this.needsRender = true;
    }

    if (this.needsRender) {
      if (this.postFXEnabled) {
        this.postfx.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }
      this.needsRender = false;
    }
  }

  resize() {
    const wrap = this.canvas.parentElement;
    const width = wrap.clientWidth;
    const height = wrap.clientHeight;
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height, false);
    this.postfx.setSize(width, height, this.renderer.getPixelRatio());
    this.perspectiveCamera.aspect = width / height;
    this.perspectiveCamera.updateProjectionMatrix();
    this.#updateOrthoFrustum();
    this.orthographicCamera.updateProjectionMatrix();
    this.needsRender = true;
  }
}

function createGroundPlane() {
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ color: 0x1d2027, roughness: 0.95, metalness: 0 }),
  );
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  return plane;
}

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

// a transmissive clear plastic, used to replace the bottle's opaque body
// material so the bottle reads as a real water bottle
function makeClearPlastic(name) {
  return new THREE.MeshPhysicalMaterial({
    name,
    color: 0xffffff,
    metalness: 0,
    roughness: 0.1,
    transmission: 1,
    thickness: 0.35,
    ior: 1.45,
    transparent: true,
  });
}

// release the GPU resources held by a model before it is replaced
function disposeModel(root) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value && value.isTexture) value.dispose();
      }
      material.dispose();
    }
  });
}
