// The player character, Lucia Marrero's younger cousin Nico Vega in our own
// story: a low-poly figure built from boxes and a capsule, with a walk cycle
// that swings arms and legs. On foot he walks, runs and shoves; in a car the
// figure hides and the DriveCar takes over.

import * as THREE from 'three';
import { resolveCollisions } from './city.js';
import { WALK_SPEED, RUN_SPEED, PLAYER_RADIUS } from './config.js';

export function createPlayerAvatar() {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5e });
  const shirt = new THREE.MeshLambertMaterial({ color: 0xff6b4a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2b3a55 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x241a12 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.34), shirt);
  torso.position.y = 1.12;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.44, 0.4), skin);
  head.position.y = 1.78;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.46), hair);
  cap.position.y = 2.03;
  group.add(cap);

  const limbs = [];
  function limb(material, x, y, h) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.17, h, 0.17), material);
    mesh.position.y = -h / 2;
    mesh.castShadow = true;
    pivot.add(mesh);
    group.add(pivot);
    limbs.push(pivot);
    return pivot;
  }
  const armL = limb(skin, -0.42, 1.46, 0.68);
  const armR = limb(skin, 0.42, 1.46, 0.68);
  const legL = limb(pants, -0.17, 0.74, 0.72);
  const legR = limb(pants, 0.17, 0.74, 0.72);
  group.userData.limbs = { armL, armR, legL, legR };
  return group;
}

export class Player {
  constructor(scene, x, z) {
    this.mesh = createPlayerAvatar();
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this.heading = Math.PI;
    this.walkPhase = 0;
    this.moving = false;
  }

  get position() {
    return this.mesh.position;
  }

  updateOnFoot(dt, axis, cameraYaw, running, colliders) {
    const speed = running ? RUN_SPEED : WALK_SPEED;
    let mx = 0;
    let mz = 0;
    if (axis.x !== 0 || axis.z !== 0) {
      const sin = Math.sin(cameraYaw);
      const cos = Math.cos(cameraYaw);
      // Camera-relative movement: forward on screen is away from the camera.
      const forwardX = -sin;
      const forwardZ = -cos;
      const rightX = cos;
      const rightZ = -sin;
      mx = forwardX * -axis.z + rightX * axis.x;
      mz = forwardZ * -axis.z + rightZ * axis.x;
      const len = Math.hypot(mx, mz) || 1;
      mx /= len;
      mz /= len;
      this.heading = Math.atan2(mx, mz);
      this.moving = true;
    } else {
      this.moving = false;
    }
    this.mesh.position.x += mx * speed * dt;
    this.mesh.position.z += mz * speed * dt;
    const probe = { x: this.mesh.position.x, z: this.mesh.position.z };
    resolveCollisions(probe, PLAYER_RADIUS, colliders);
    this.mesh.position.x = probe.x;
    this.mesh.position.z = probe.z;
    this.mesh.rotation.y = this.heading;
    // Walk cycle: opposite arm and leg swing together.
    if (this.moving) this.walkPhase += dt * (running ? 11 : 8);
    const swing = this.moving ? Math.sin(this.walkPhase) * 0.6 : 0;
    const { armL, armR, legL, legR } = this.mesh.userData.limbs;
    armL.rotation.x = swing;
    armR.rotation.x = -swing;
    legL.rotation.x = -swing;
    legR.rotation.x = swing;
    if (!this.moving) {
      armL.rotation.x *= 0.8;
      armR.rotation.x *= 0.8;
      legL.rotation.x *= 0.8;
      legR.rotation.x *= 0.8;
    }
    return this.moving ? speed : 0;
  }

  setVisible(visible) {
    this.mesh.visible = visible;
  }

  placeAt(x, z, heading) {
    this.mesh.position.set(x, 0, z);
    this.heading = heading;
    this.mesh.rotation.y = heading;
  }
}
