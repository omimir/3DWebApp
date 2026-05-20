import * as THREE from 'three';

// A fresnel term: bright at the silhouette, fading to nothing where the
// surface faces the camera. That falloff is what reads as a glow.
const vertexShader = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = viewPosition.xyz;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const fragmentShader = /* glsl */`
  uniform vec3 uColour;
  uniform float uPower;
  uniform float uStrength;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vec3 viewDirection = normalize(-vViewPosition);
    float facing = max(dot(viewDirection, normalize(vNormal)), 0.0);
    float rim = pow(1.0 - facing, uPower);
    gl_FragColor = vec4(uColour, rim * uStrength);
  }
`;

// A glowing shell that hugs the globe to suggest an atmosphere. The shell is
// drawn additively so the rim adds light over the globe and the background
// without an opaque edge. The caller scales the unit shell to the globe's
// bounds, so the rim follows the surface even where it is not a true sphere.
export function createAtmosphere() {
  // a unit shell with a 1.5% margin; once scaled to the globe the rim sits
  // just outside the surface and reads as a faint haze, not a hard bubble
  const geometry = new THREE.SphereGeometry(1.015, 64, 48);
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uColour: { value: new THREE.Color(0x9ec8ec) },
      uPower: { value: 3.0 },
      uStrength: { value: 0.55 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return new THREE.Mesh(geometry, material);
}
