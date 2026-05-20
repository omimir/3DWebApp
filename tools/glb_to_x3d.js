// Converts the exported .glb models to X3D. Blender 5.1 no longer ships an
// X3D exporter, so this reads each glb container directly and writes an
// equivalent X3D scene (geometry, normals and a base material colour).
// Run from the repository root: node tools/glb_to_x3d.js
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const GLB_DIR = path.join(REPO_ROOT, 'assets', 'models', 'glb');
const X3D_DIR = path.join(REPO_ROOT, '..', 'web3d-vitrine-x3d', 'x3d');
const MODELS = ['can', 'bottle', 'globe'];

const COMPONENT = {
  5120: Int8Array, 5121: Uint8Array, 5122: Int16Array,
  5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array,
};
const TYPE_COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function parseGlb(buffer) {
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) json = JSON.parse(data.toString('utf8'));
    else if (type === 0x004e4942) bin = data;
    offset += 8 + length;
  }
  return { json, bin };
}

function readAccessor(gltf, bin, index) {
  const accessor = gltf.accessors[index];
  const view = gltf.bufferViews[accessor.bufferView];
  const Type = COMPONENT[accessor.componentType];
  const length = accessor.count * TYPE_COMPONENTS[accessor.type];
  const start = bin.byteOffset + (view.byteOffset || 0) + (accessor.byteOffset || 0);
  if (start % Type.BYTES_PER_ELEMENT === 0) {
    return new Type(bin.buffer, start, length);
  }
  // a misaligned accessor cannot back a typed-array view, so copy it out
  const aligned = new Uint8Array(length * Type.BYTES_PER_ELEMENT);
  aligned.set(new Uint8Array(bin.buffer, start, aligned.length));
  return new Type(aligned.buffer);
}

function multiply(a, b) {
  const out = new Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1]
        + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

function localMatrix(node) {
  if (node.matrix) return node.matrix.slice();
  const [tx, ty, tz] = node.translation || [0, 0, 0];
  const [x, y, z, w] = node.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale || [1, 1, 1];
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

const fmt = (n) => Number.isFinite(n) ? +n.toFixed(5) : 0;

function point(m, p) {
  return [
    fmt(m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]),
    fmt(m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]),
    fmt(m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]),
  ];
}

function direction(m, d) {
  const x = m[0] * d[0] + m[4] * d[1] + m[8] * d[2];
  const y = m[1] * d[0] + m[5] * d[1] + m[9] * d[2];
  const z = m[2] * d[0] + m[6] * d[1] + m[10] * d[2];
  const length = Math.hypot(x, y, z) || 1;
  return [fmt(x / length), fmt(y / length), fmt(z / length)];
}

function materialColour(gltf, materialIndex) {
  const pbr = materialIndex !== undefined && gltf.materials
    ? gltf.materials[materialIndex].pbrMetallicRoughness
    : null;
  const base = pbr && pbr.baseColorFactor;
  return base ? `${fmt(base[0])} ${fmt(base[1])} ${fmt(base[2])}` : '0.78 0.78 0.78';
}

function shapeXml(gltf, bin, primitive, worldMatrix) {
  const positions = readAccessor(gltf, bin, primitive.attributes.POSITION);
  const points = [];
  for (let i = 0; i < positions.length; i += 3) {
    points.push(point(worldMatrix, [positions[i], positions[i + 1], positions[i + 2]]).join(' '));
  }

  let normalXml = '';
  if (primitive.attributes.NORMAL !== undefined) {
    const normals = readAccessor(gltf, bin, primitive.attributes.NORMAL);
    const vectors = [];
    for (let i = 0; i < normals.length; i += 3) {
      vectors.push(direction(worldMatrix, [normals[i], normals[i + 1], normals[i + 2]]).join(' '));
    }
    normalXml = `\n          <Normal vector='${vectors.join(', ')}'/>`;
  }

  const indices = primitive.indices !== undefined
    ? Array.from(readAccessor(gltf, bin, primitive.indices)).join(' ')
    : [...Array(points.length).keys()].join(' ');

  return `      <Shape>
        <Appearance><Material diffuseColor='${materialColour(gltf, primitive.material)}'/></Appearance>
        <IndexedTriangleSet solid='false' index='${indices}'>
          <Coordinate point='${points.join(', ')}'/>${normalXml}
        </IndexedTriangleSet>
      </Shape>`;
}

function collectShapes(gltf, bin, nodeIndex, parentMatrix, shapes) {
  const node = gltf.nodes[nodeIndex];
  const worldMatrix = multiply(parentMatrix, localMatrix(node));
  if (node.mesh !== undefined) {
    for (const primitive of gltf.meshes[node.mesh].primitives) {
      shapes.push(shapeXml(gltf, bin, primitive, worldMatrix));
    }
  }
  for (const child of node.children || []) {
    collectShapes(gltf, bin, child, worldMatrix, shapes);
  }
}

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

fs.mkdirSync(X3D_DIR, { recursive: true });
for (const name of MODELS) {
  const glbPath = path.join(GLB_DIR, `${name}.glb`);
  if (!fs.existsSync(glbPath)) {
    console.log('[skip] missing', glbPath);
    continue;
  }
  const { json, bin } = parseGlb(fs.readFileSync(glbPath));
  const scene = json.scenes[json.scene || 0];
  const shapes = [];
  for (const nodeIndex of scene.nodes) {
    collectShapes(json, bin, nodeIndex, IDENTITY, shapes);
  }
  const x3d = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE X3D PUBLIC "ISO//Web3D//DTD X3D 3.3//EN" "https://www.web3d.org/specifications/x3d-3.3.dtd">
<X3D profile='Interchange' version='3.3'>
  <head>
    <meta name='title' content='${name}'/>
    <meta name='description' content='Vitrine ${name} model, converted from glTF.'/>
  </head>
  <Scene>
${shapes.join('\n')}
  </Scene>
</X3D>
`;
  fs.writeFileSync(path.join(X3D_DIR, `${name}.x3d`), x3d);
  console.log(`[ok] ${name}: ${shapes.length} shapes`);
}
