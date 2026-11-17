// Procedural city of Solmar Bay: a sunlit grid of avenues, pastel towers,
// palms, a marina beach and open water, all built from boxes and planes with
// no external assets. The city exports its building colliders, its road
// network (for traffic and the minimap) and named landmarks the missions use.

import * as THREE from 'three';
import { createSeededRandom } from './random.js';

export const CITY_HALF = 132;
export const ROAD_POSITIONS = [-110, -66, -22, 22, 66, 110];
export const ROAD_WIDTH = 13;
export const BLOCK_SPAN = 44;

const BUILDING_PALETTE = [0xf2d8a7, 0xe8b4a0, 0xa8d8d8, 0xf5efe0, 0xd9a7c7, 0x9fc6e8, 0xf7c873, 0xcfe8b0];
const ROOF_PALETTE = [0xb5654a, 0x8a7f72, 0x6b8e9f, 0x99785f];

export const LANDMARKS = [
  { id: 'marina', name: 'Solmar Marina', x: 22, z: 148 },
  { id: 'plaza', name: 'Coral Plaza', x: -22, z: -22 },
  { id: 'depot', name: 'Portside Depot', x: 110, z: 66 },
  { id: 'hotel', name: 'Hotel Brisa', x: -66, z: 22 },
  { id: 'garage', name: 'Rayo Garage', x: 66, z: -66 },
];

function seededRandom(seed) {
  return createSeededRandom(seed);
}

function makeWindowTexture(baseColor, seed) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 64, 128);
  const rand = seededRandom(seed);
  for (let y = 6; y < 120; y += 12) {
    for (let x = 6; x < 58; x += 12) {
      const lit = rand() > 0.45;
      ctx.fillStyle = lit ? 'rgba(255,236,170,0.92)' : 'rgba(38,64,86,0.85)';
      ctx.fillRect(x, y, 7, 8);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function isOnRoad(x, z) {
  for (const road of ROAD_POSITIONS) {
    if (Math.abs(x - road) < ROAD_WIDTH / 2 + 1.5) return true;
    if (Math.abs(z - road) < ROAD_WIDTH / 2 + 1.5 && z < 138) return true;
  }
  return false;
}

export function buildCity(scene, seed = 7) {
  const rand = seededRandom(seed * 7919 + 13);
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  // Ground, roads and sidewalks.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 420),
    new THREE.MeshLambertMaterial({ color: 0x77a86b }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  group.add(ground);

  // Road markings are painted into the asphalt texture itself — one canvas
  // per orientation — instead of hundreds of separate dash meshes. Draw
  // calls stay low enough for modest GPUs to hold a steady frame rate.
  function makeRoadMaterial(alongX) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#3c4148';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#d8d2c0';
    ctx.fillRect(4, 0, 3, 128);
    ctx.fillRect(121, 0, 3, 128);
    ctx.fillStyle = '#f7e08a';
    ctx.fillRect(61, 8, 6, 52);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    if (alongX) texture.repeat.set(23, 1);
    else texture.repeat.set(1, 23);
    texture.anisotropy = 4;
    return new THREE.MeshLambertMaterial({ map: texture });
  }
  const roadMaterialV = makeRoadMaterial(false);
  const roadMaterialH = makeRoadMaterial(true);
  const walkMaterial = new THREE.MeshLambertMaterial({ color: 0xcfc4ae });
  for (const pos of ROAD_POSITIONS) {
    const vertical = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, 300), roadMaterialV);
    vertical.rotation.x = -Math.PI / 2;
    vertical.position.set(pos, 0.01, 8);
    vertical.receiveShadow = true;
    group.add(vertical);
    const horizontal = new THREE.Mesh(new THREE.PlaneGeometry(300, ROAD_WIDTH), roadMaterialH);
    horizontal.rotation.x = -Math.PI / 2;
    horizontal.position.set(0, 0.01, pos);
    horizontal.receiveShadow = true;
    group.add(horizontal);
    for (const side of [-1, 1]) {
      const walkV = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 300), walkMaterial);
      walkV.rotation.x = -Math.PI / 2;
      walkV.position.set(pos + side * (ROAD_WIDTH / 2 + 1.2), 0.02, 8);
      group.add(walkV);
      const walkH = new THREE.Mesh(new THREE.PlaneGeometry(300, 2.4), walkMaterial);
      walkH.rotation.x = -Math.PI / 2;
      walkH.position.set(0, 0.02, pos + side * (ROAD_WIDTH / 2 + 1.2));
      group.add(walkH);
    }
  }

  // Buildings fill each block: one or two towers per block with lit windows.
  // Window materials are cached per palette colour so towers share textures.
  const roofMaterialCache = ROOF_PALETTE.map((color) => new THREE.MeshLambertMaterial({ color }));
  const sideMaterialCache = new Map();
  function sideMaterialFor(paletteIndex, variant) {
    const key = `${paletteIndex}:${variant}`;
    if (!sideMaterialCache.has(key)) {
      const base = `#${BUILDING_PALETTE[paletteIndex].toString(16).padStart(6, '0')}`;
      sideMaterialCache.set(key, new THREE.MeshLambertMaterial({ map: makeWindowTexture(base, 1000 + paletteIndex * 37 + variant * 101) }));
    }
    return sideMaterialCache.get(key);
  }
  for (let bx = 0; bx < ROAD_POSITIONS.length - 1; bx += 1) {
    for (let bz = 0; bz < ROAD_POSITIONS.length - 1; bz += 1) {
      const cx = (ROAD_POSITIONS[bx] + ROAD_POSITIONS[bx + 1]) / 2;
      const cz = (ROAD_POSITIONS[bz] + ROAD_POSITIONS[bz + 1]) / 2;
      const towers = rand() > 0.4 ? 2 : 1;
      for (let t = 0; t < towers; t += 1) {
        const w = 11 + rand() * 7;
        const d = 11 + rand() * 7;
        const h = 12 + rand() * 34 + (Math.abs(cx) < 30 && Math.abs(cz) < 30 ? 12 : 0);
        const ox = towers === 1 ? 0 : (t === 0 ? -8 : 8);
        const oz = towers === 1 ? 0 : (t === 0 ? 6 : -7);
        const paletteIndex = Math.floor(rand() * BUILDING_PALETTE.length);
        const sideMaterial = sideMaterialFor(paletteIndex, Math.floor(rand() * 3));
        const roofMaterial = roofMaterialCache[Math.floor(rand() * roofMaterialCache.length)];
        const tower = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, d),
          [sideMaterial, sideMaterial, roofMaterial, roofMaterial, sideMaterial, sideMaterial],
        );
        tower.position.set(cx + ox, h / 2, cz + oz);
        tower.castShadow = true;
        tower.receiveShadow = true;
        group.add(tower);
        colliders.push({ minX: cx + ox - w / 2, maxX: cx + ox + w / 2, minZ: cz + oz - d / 2, maxZ: cz + oz + d / 2 });
      }
    }
  }

  // Palms line the avenues and the beach promenade. All trunks share one
  // instanced mesh and all crowns another: two draw calls for the whole
  // city's greenery instead of two per tree.
  const palmSpots = [];
  function addPalm(x, z) {
    palmSpots.push({ x, z, tilt: (rand() - 0.5) * 0.14, spin: rand() * Math.PI });
  }
  for (const pos of ROAD_POSITIONS) {
    for (let t = -128; t < 140; t += 22) {
      if (rand() > 0.35) addPalm(pos + ROAD_WIDTH / 2 + 3.4, t + rand() * 6);
      if (rand() > 0.55) addPalm(t + rand() * 6, pos - ROAD_WIDTH / 2 - 3.4);
    }
  }
  for (let x = -130; x < 140; x += 13) addPalm(x + rand() * 4, 141 + rand() * 3);
  {
    const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8a6844 });
    const leafMaterial = new THREE.MeshLambertMaterial({ color: 0x2f9e5f, side: THREE.DoubleSide });
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.34, 5.4, 6), trunkMaterial, palmSpots.length);
    const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(2.6, 1.1, 7), leafMaterial, palmSpots.length);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const scale = new THREE.Vector3(1, 1, 1);
    palmSpots.forEach((spot, index) => {
      euler.set(0, spot.spin, spot.tilt);
      quaternion.setFromEuler(euler);
      matrix.compose(new THREE.Vector3(spot.x, 2.7, spot.z), quaternion, scale);
      trunks.setMatrixAt(index, matrix);
      euler.set(Math.PI, spot.spin, 0);
      quaternion.setFromEuler(euler);
      matrix.compose(new THREE.Vector3(spot.x, 5.6, spot.z), quaternion, scale);
      crowns.setMatrixAt(index, matrix);
    });
    trunks.castShadow = true;
    group.add(trunks);
    group.add(crowns);
  }

  // Beach and bay water to the south.
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(420, 42), new THREE.MeshLambertMaterial({ color: 0xf0d9a0 }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.0, 156);
  sand.receiveShadow = true;
  group.add(sand);
  const waterMaterial = new THREE.MeshPhongMaterial({ color: 0x1d7fa8, shininess: 120, transparent: true, opacity: 0.92 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(420, 90), waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.12, 218);
  group.add(water);

  // Marina pier and moored boats near the first landmark.
  const pierMaterial = new THREE.MeshLambertMaterial({ color: 0x9a7d5a });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(4, 0.6, 34), pierMaterial);
  pier.position.set(22, 0.35, 182);
  group.add(pier);
  const hullColors = [0xe84f6a, 0xf5f5f5, 0x39b5c4, 0xf7c873];
  for (let i = 0; i < 4; i += 1) {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1.1, 7), new THREE.MeshLambertMaterial({ color: hullColors[i] }));
    hull.position.set(16 + (i % 2) * 12, 0.5, 172 + i * 8);
    group.add(hull);
  }

  // Street lamps at every intersection corner, again instanced: posts in
  // one mesh, glowing heads in another.
  {
    const lampSpots = [];
    for (const x of ROAD_POSITIONS) {
      for (const z of ROAD_POSITIONS) {
        lampSpots.push({ x: x + ROAD_WIDTH / 2 + 1, z: z + ROAD_WIDTH / 2 + 1 });
      }
    }
    const posts = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.09, 0.09, 5, 5),
      new THREE.MeshLambertMaterial({ color: 0x444a52 }),
      lampSpots.length,
    );
    const heads = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.32, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
      lampSpots.length,
    );
    const matrix = new THREE.Matrix4();
    lampSpots.forEach((spot, index) => {
      matrix.makeTranslation(spot.x, 2.5, spot.z);
      posts.setMatrixAt(index, matrix);
      matrix.makeTranslation(spot.x, 5.05, spot.z);
      heads.setMatrixAt(index, matrix);
    });
    group.add(posts);
    group.add(heads);
  }

  let elapsed = 0;
  function update(dt) {
    elapsed += dt;
    water.position.y = 0.12 + Math.sin(elapsed * 0.8) * 0.05;
  }

  return { group, colliders, update };
}

export function resolveCollisions(position, radius, colliders) {
  // Circle against building AABBs: push the circle out along the smaller axis.
  for (const box of colliders) {
    const nearX = Math.max(box.minX, Math.min(position.x, box.maxX));
    const nearZ = Math.max(box.minZ, Math.min(position.z, box.maxZ));
    const dx = position.x - nearX;
    const dz = position.z - nearZ;
    const distSq = dx * dx + dz * dz;
    if (distSq > radius * radius) continue;
    if (distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      position.x = nearX + (dx / dist) * radius;
      position.z = nearZ + (dz / dist) * radius;
    } else {
      const left = position.x - box.minX;
      const right = box.maxX - position.x;
      const top = position.z - box.minZ;
      const bottom = box.maxZ - position.z;
      const smallest = Math.min(left, right, top, bottom);
      if (smallest === left) position.x = box.minX - radius;
      else if (smallest === right) position.x = box.maxX + radius;
      else if (smallest === top) position.z = box.minZ - radius;
      else position.z = box.maxZ + radius;
    }
  }
  position.x = Math.max(-148, Math.min(148, position.x));
  position.z = Math.max(-148, Math.min(168, position.z));
}
