import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

// A soft darkening towards the frame edges, the way a studio photograph falls
// off at the corners. It runs after tone mapping, so the darkening lands on
// the final image rather than the raw linear render.
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    uAmount: { value: 0.82 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uAmount;
    varying vec2 vUv;
    void main() {
      vec4 colour = texture2D(tDiffuse, vUv);
      float edge = length(vUv - 0.5) * 1.414;
      float vignette = smoothstep(1.0, 0.35, edge);
      colour.rgb *= mix(1.0, vignette, uAmount);
      gl_FragColor = colour;
    }
  `,
};

// The post-processing pipeline: scene render, bloom on the bright highlights,
// tone mapping, a studio vignette, then anti-aliasing. Bloom strength is
// reduced when the user asks for reduced motion.
export class PostFX {
  constructor(renderer, scene, camera) {
    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), reducedMotion ? 0.3 : 0.65, 0.5, 0.8);
    this.composer.addPass(this.bloom);

    this.composer.addPass(new OutputPass());

    this.vignette = new ShaderPass(VignetteShader);
    this.composer.addPass(this.vignette);

    this.fxaa = new ShaderPass(FXAAShader);
    this.composer.addPass(this.fxaa);
  }

  setCamera(camera) {
    this.renderPass.camera = camera;
  }

  setSize(width, height, pixelRatio) {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    this.fxaa.material.uniforms.resolution.value.set(
      1 / (width * pixelRatio),
      1 / (height * pixelRatio),
    );
  }

  render() {
    this.composer.render();
  }
}
