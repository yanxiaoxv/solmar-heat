// Vehicles for Solmar Heat: the car factory (sedans, sports cars, vans and
// police interceptors built from boxes with lit windows and wheels), arcade
// driving physics the player uses, simple road-following traffic, and the
// parked cars that fill the streets ready to be borrowed.

import * as THREE from 'three';
import { ROAD_POSITIONS, resolveCollisions } from './city.js';

export const CAR_KINDS = {
  sedan: { length: 4.4, width: 1.9, height: 0.62, topSpeed: 34, accel: 15, grip: 3.4, label: 'Solmar Sedan' },
  sport: { length: 4.2, width: 1.95, height: 0.5, topSpeed: 46, accel: 22, grip: 3.9, label: 'Rayo Coupe' },
  van: { length: 5.2, width: 2.1, height: 1.05, topSpeed: 27, accel: 11, grip: 2.8, label: 'Portside Van' },
  police: { length: 4.5, width: 1.95, height: 0.6, topSpeed: 42, accel: 20, grip: 3.8, label: 'Solmar Patrol' },
};

const PAINT_COLORS = [0xe84f6a, 0x39b5c4, 0xf7c873, 0xf2f2f2, 0x33415c, 0x7bc47f, 0xff8c42, 0xb388eb];

const glassMaterial = new THREE.MeshPhongMaterial({ color: 0x1c2f42, shininess: 90 });
const tyreMaterial = new THREE.MeshLambertMaterial({ color: 0x17181c });
const hubMaterial = new THREE.MeshLambertMaterial({ color: 0xb9c0c8 });
const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xfff3b0 });
const tailMaterial = new THREE.MeshBasicMaterial({ color: 0xff4455 });

export function createCarMesh(kind, color) {
  const spec = CAR_KINDS[kind];
  const group = new THREE.Group();
  const paint = new THREE.MeshPhongMaterial({ color, shininess: 70 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(spec.width, spec.height, spec.length), paint);
  body.position.y = 0.55 + spec.height / 2;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.82, 0.52, spec.length * 0.48), glassMaterial);
  cabin.position.set(0, 0.55 + spec.height + 0.24, -spec.length * 0.04);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12);
  const hubGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.28, 8);
  const wheels = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const wheel = new THREE.Mesh(wheelGeo, tyreMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx * (spec.width / 2 - 0.05), 0.36, sz * (spec.length / 2 - 0.85));
      group.add(wheel);
      const hub = new THREE.Mesh(hubGeo, hubMaterial);
      hub.rotation.z = Math.PI / 2;
      hub.position.copy(wheel.position);
      group.add(hub);
      wheels.push(wheel);
    }
  }
  for (const sx of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), lightMaterial);
    head.position.set(sx * spec.width * 0.3, 0.78, spec.length / 2 + 0.02);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), tailMaterial);
    tail.position.set(sx * spec.width * 0.3, 0.82, -spec.length / 2 - 0.02);
    group.add(tail);
  }
  if (kind === 'police') {
    const bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0xff3344 }));
    red.position.x = -0.3;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0x3388ff }));
    blue.position.x = 0.3;
    bar.add(red);
    bar.add(blue);
    bar.position.set(0, 0.55 + spec.height + 0.56, -spec.length * 0.04);
    group.add(bar);
    group.userData.lightBar = bar;
  }
  if (kind === 'sport') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.9, 0.08, 0.4), paint);
    spoiler.position.set(0, 1.25, -spec.length / 2 + 0.3);
    group.add(spoiler);
  }
  group.userData.wheels = wheels;
  return group;
}

export class DriveCar {
  constructor(kind, color, x, z, heading) {
    this.kind = kind;
    this.spec = CAR_KINDS[kind];
    this.mesh = createCarMesh(kind, color);
    this.mesh.position.set(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.health = 100;
    this.occupied = false;
    this.mesh.rotation.y = heading;
  }

  get position() {
    return this.mesh.position;
  }

  drive(dt, throttle, steerInput, handbrake, colliders) {
    const spec = this.spec;
    if (throttle > 0) this.speed += spec.accel * throttle * dt;
    else if (throttle < 0) this.speed += (this.speed > 0.5 ? -26 : -spec.accel * 0.55) * dt * -throttle;
    const drag = handbrake ? 3.2 : 0.55;
    this.speed -= this.speed * drag * dt * 0.35;
    if (!throttle) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 3.5 * dt);
    this.speed = Math.max(-spec.topSpeed * 0.38, Math.min(spec.topSpeed, this.speed));
    this.steer += (steerInput * 0.62 - this.steer) * Math.min(1, dt * 7);
    const speedRatio = Math.min(1, Math.abs(this.speed) / 9);
    // Forward is +Z in this build, so a rightward steer adds to the heading.
    this.heading += this.steer * speedRatio * Math.sign(this.speed || 1) * dt * 1.55;
    const beforeX = this.mesh.position.x;
    const beforeZ = this.mesh.position.z;
    this.mesh.position.x += Math.sin(this.heading) * this.speed * dt;
    this.mesh.position.z += Math.cos(this.heading) * this.speed * dt;
    const probe = { x: this.mesh.position.x, z: this.mesh.position.z };
    resolveCollisions(probe, 1.55, colliders);
    if (Math.abs(probe.x - this.mesh.position.x) > 0.01 || Math.abs(probe.z - this.mesh.position.z) > 0.01) {
      const impact = Math.abs(this.speed);
      if (impact > 9) this.health = Math.max(5, this.health - (impact - 8));
      this.speed *= -0.18;
    }
    this.mesh.position.x = probe.x;
    this.mesh.position.z = probe.z;
    void beforeX;
    void beforeZ;
    this.mesh.rotation.y = this.heading;
    const wheels = this.mesh.userData.wheels;
    for (let i = 0; i < wheels.length; i += 1) {
      wheels[i].rotation.x += (this.speed * dt) / 0.36;
      if (i >= 2) wheels[i].rotation.y = this.steer * 0.5;
    }
    const bar = this.mesh.userData.lightBar;
    if (bar) bar.visible = Math.floor(performance.now() / 280) % 2 === 0;
    return Math.abs(this.speed);
  }

  placeAt(x, z, heading) {
    this.mesh.position.set(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.mesh.rotation.y = heading;
  }
}

// Traffic cars cruise rectangular loops around blocks: pick a road, drive to
// the next cross road, turn, repeat. They slow for the car ahead and stop
// politely (for now) at nothing else.
export class TrafficCar extends DriveCar {
  constructor(kind, color, roadIndex, direction, offset) {
    const along = ROAD_POSITIONS[roadIndex];
    super(kind, color, 0, 0, 0);
    this.vertical = direction % 2 === 0;
    this.sign = direction < 2 ? 1 : -1;
    this.lane = (this.vertical ? along : along) + (this.sign > 0 ? 2.9 : -2.9);
    this.progress = -130 + offset * 52;
    this.cruiseSpeed = 10 + (offset % 3) * 2.5;
    this.syncToRoad();
  }

  syncToRoad() {
    if (this.vertical) {
      this.mesh.position.set(this.lane, 0, this.progress);
      this.heading = this.sign > 0 ? 0 : Math.PI;
    } else {
      this.mesh.position.set(this.progress, 0, this.lane);
      this.heading = this.sign > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    this.mesh.rotation.y = this.heading;
  }

  updateTraffic(dt, others) {
    let target = this.cruiseSpeed;
    for (const other of others) {
      if (other === this) continue;
      const dx = other.mesh.position.x - this.mesh.position.x;
      const dz = other.mesh.position.z - this.mesh.position.z;
      const ahead = this.vertical ? dz * this.sign : dx * this.sign;
      const side = this.vertical ? Math.abs(dx) : Math.abs(dz);
      if (ahead > 0 && ahead < 9 && side < 2.2) target = Math.min(target, Math.max(0, (ahead - 5) * 1.6));
    }
    this.speed += Math.max(-18 * dt, Math.min(9 * dt, target - this.speed));
    this.progress += this.speed * dt * this.sign;
    if (this.progress > 138) {
      this.progress = -138;
      this.vertical = !this.vertical;
      const cross = ROAD_POSITIONS[Math.floor(Math.random() * ROAD_POSITIONS.length)];
      this.lane = cross + (this.sign > 0 ? 2.9 : -2.9);
    }
    if (this.progress < -138) {
      this.progress = 138;
      this.vertical = !this.vertical;
      const cross = ROAD_POSITIONS[Math.floor(Math.random() * ROAD_POSITIONS.length)];
      this.lane = cross + (this.sign > 0 ? 2.9 : -2.9);
    }
    this.syncToRoad();
  }
}

export function createParkedCars(scene) {
  const cars = [];
  const spots = [
    ['sport', 0xe84f6a, -22 + 3.1, -44, 0],
    ['sedan', 0x39b5c4, 18.9, 30, Math.PI],
    ['sedan', 0xf7c873, 66 + 3.1, 88, 0],
    ['van', 0xf2f2f2, -62.9, -88, Math.PI],
    ['sport', 0x33415c, 106.9, -30, Math.PI],
    ['sedan', 0x7bc47f, -25.1, 96, Math.PI],
    ['van', 0xff8c42, 44, 110 - 3.1, Math.PI / 2],
    ['sedan', 0xb388eb, -88, -66 + 3.1, -Math.PI / 2],
  ];
  for (const [kind, color, x, z, heading] of spots) {
    const car = new DriveCar(kind, color, x, z, heading);
    scene.add(car.mesh);
    cars.push(car);
  }
  return cars;
}

export function createTraffic(scene) {
  const cars = [];
  const kinds = ['sedan', 'sedan', 'sport', 'van', 'sedan', 'sedan', 'sport', 'sedan'];
  for (let i = 0; i < kinds.length; i += 1) {
    const car = new TrafficCar(kinds[i], PAINT_COLORS[i % PAINT_COLORS.length], i % ROAD_POSITIONS.length, i % 4, i * 0.9 + 0.4);
    scene.add(car.mesh);
    cars.push(car);
  }
  return cars;
}

export function nearestCar(cars, position, maxDistance) {
  let best = null;
  let bestDist = maxDistance;
  for (const car of cars) {
    const dx = car.mesh.position.x - position.x;
    const dz = car.mesh.position.z - position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < bestDist) {
      bestDist = dist;
      best = car;
    }
  }
  return best;
}
