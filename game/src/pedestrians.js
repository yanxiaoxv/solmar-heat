// Pedestrians of Solmar Bay: residents who stroll the sidewalks and the
// promenade in bright holiday clothes, turn at corners, and scatter when a
// car comes at them or trouble starts nearby. Built from the same box-figure
// kit as the player, tinted per person.

import * as THREE from 'three';
import { ROAD_POSITIONS, ROAD_WIDTH } from './city.js';

const SHIRTS = [0xffd166, 0x06d6a0, 0xef476f, 0x118ab2, 0xf78c6b, 0xa8dadc, 0xe0aaff, 0x90be6d];
const SKIN_TONES = [0xc98a5e, 0x8d5a3a, 0xe8b48c, 0x6e4226];

function createPedestrianFigure(shirtColor, skinColor) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const skin = new THREE.MeshLambertMaterial({ color: skinColor });
  const legs = new THREE.MeshLambertMaterial({ color: 0x3a4356 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.7, 0.3), shirt);
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.4, 0.36), skin);
  head.position.y = 1.66;
  group.add(head);
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), legs);
    leg.position.set(sx * 0.14, 0.35, 0);
    group.add(leg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), skin);
    arm.position.set(sx * 0.36, 1.05, 0);
    group.add(arm);
  }
  return group;
}

export class Pedestrian {
  constructor(scene, index) {
    const shirt = SHIRTS[index % SHIRTS.length];
    const skin = SKIN_TONES[index % SKIN_TONES.length];
    this.mesh = createPedestrianFigure(shirt, skin);
    scene.add(this.mesh);
    // Each walker owns one sidewalk loop: a road edge walked end to end.
    this.vertical = index % 2 === 0;
    const road = ROAD_POSITIONS[index % ROAD_POSITIONS.length];
    this.line = road + (index % 3 === 0 ? -(ROAD_WIDTH / 2 + 2.2) : ROAD_WIDTH / 2 + 2.2);
    this.progress = -125 + ((index * 37) % 240);
    this.sign = index % 4 < 2 ? 1 : -1;
    this.speed = 1.6 + (index % 5) * 0.22;
    this.fleeTimer = 0;
    this.fleeX = 0;
    this.fleeZ = 0;
    this.fallTimer = 0;
    this.bobPhase = index * 1.7;
    this.syncPosition();
  }

  syncPosition() {
    if (this.vertical) this.mesh.position.set(this.line, 0, this.progress);
    else this.mesh.position.set(this.progress, 0, this.line);
    this.mesh.rotation.y = this.vertical
      ? (this.sign > 0 ? 0 : Math.PI)
      : (this.sign > 0 ? Math.PI / 2 : -Math.PI / 2);
  }

  scare(fromX, fromZ, radius = 9) {
    const dx = this.mesh.position.x - fromX;
    const dz = this.mesh.position.z - fromZ;
    const dist = Math.hypot(dx, dz);
    if (dist < radius && dist > 0.01) {
      this.fleeTimer = 1.6;
      this.fleeX = dx / dist;
      this.fleeZ = dz / dist;
    }
  }

  knockDown() {
    // Flat on the pavement for a beat, then up and running scared.
    this.fallTimer = 1.5;
    this.fleeTimer = 2.2;
    const angle = Math.random() * Math.PI * 2;
    this.fleeX = Math.sin(angle);
    this.fleeZ = Math.cos(angle);
  }

  update(dt, danger) {
    if (this.fallTimer > 0) {
      this.fallTimer -= dt;
      this.mesh.rotation.x = -Math.PI / 2 * Math.min(1, (1.5 - this.fallTimer) * 5);
      this.mesh.position.y = 0.12;
      if (this.fallTimer <= 0) {
        this.mesh.rotation.x = 0;
        this.mesh.position.y = 0;
      }
      return;
    }
    if (danger) this.scare(danger.x, danger.z, danger.radius ?? 9);
    if (this.fleeTimer > 0) {
      this.fleeTimer -= dt;
      this.mesh.position.x += this.fleeX * 6.4 * dt;
      this.mesh.position.z += this.fleeZ * 6.4 * dt;
      this.mesh.rotation.y = Math.atan2(this.fleeX, this.fleeZ);
    } else {
      this.progress += this.sign * this.speed * dt;
      if (this.progress > 142) this.sign = -1;
      if (this.progress < -132) this.sign = 1;
      this.syncPosition();
    }
    this.bobPhase += dt * 7;
    this.mesh.position.y = Math.abs(Math.sin(this.bobPhase)) * 0.05;
    // Keep walkers inside the city even after a good scare.
    this.mesh.position.x = Math.max(-146, Math.min(146, this.mesh.position.x));
    this.mesh.position.z = Math.max(-146, Math.min(160, this.mesh.position.z));
  }
}

export function createPedestrians(scene, count = 16) {
  const people = [];
  for (let i = 0; i < count; i += 1) people.push(new Pedestrian(scene, i));
  return people;
}

export function scareCrowd(people, x, z, radius = 11) {
  for (const person of people) person.scare(x, z, radius);
}
