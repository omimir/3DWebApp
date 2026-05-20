import * as THREE from 'three';

// The studio lighting: a hemisphere fill, a shadow-casting key light, a soft
// side fill, and a spotlight the UI can switch on and off.
export class LightingRig {
  constructor(scene) {
    this.hemisphere = new THREE.HemisphereLight(0xdce4f2, 0x0e0f13, 0.7);
    scene.add(this.hemisphere);

    this.key = new THREE.DirectionalLight(0xffffff, 2.2);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.bias = -0.0006;
    scene.add(this.key);
    scene.add(this.key.target);

    this.fill = new THREE.DirectionalLight(0xb9ccff, 0.5);
    scene.add(this.fill);

    this.spotlight = new THREE.SpotLight(0xffffff, 0, 0, Math.PI / 7, 0.35, 1.4);
    this.spotlight.castShadow = true;
    this.spotlight.shadow.mapSize.set(1024, 1024);
    this.spotlight.visible = false;
    scene.add(this.spotlight);
    scene.add(this.spotlight.target);
  }

  // place the lights and the key light's shadow frustum around a model
  focus(box) {
    const centre = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).length() / 2 || 1;

    this.key.position.copy(centre).add(new THREE.Vector3(radius * 2, radius * 3, radius * 2));
    this.key.target.position.copy(centre);
    const shadowCam = this.key.shadow.camera;
    shadowCam.left = shadowCam.bottom = -radius * 1.7;
    shadowCam.right = shadowCam.top = radius * 1.7;
    shadowCam.near = 0.1;
    shadowCam.far = radius * 14;
    shadowCam.updateProjectionMatrix();

    this.fill.position.copy(centre).add(new THREE.Vector3(-radius * 3, radius * 1.5, -radius * 2));

    this.spotlight.position.copy(centre).add(new THREE.Vector3(0, radius * 4, radius * 0.6));
    this.spotlight.target.position.copy(centre);
  }

  setSpotlight(on) {
    this.spotlight.visible = on;
    this.spotlight.intensity = on ? 900 : 0;
  }
}
