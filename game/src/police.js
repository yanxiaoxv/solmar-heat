// The Solmar Patrol: interceptors that answer the wanted level. Each unit
// steers its DriveCar with a pursuit controller — aim at where the target
// will be, ease off when alongside, reverse out when it overshoots — and
// the unit count follows the stars: one per star, up to four, with a fifth
// star making the same cars drive harder instead of adding a fifth.

import { DriveCar } from './vehicles.js';

const PATROL_COLOR = 0xf4f6f8;

function wrapAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function nearestRoad(value, roads) {
  let best = roads[0];
  for (const road of roads) if (Math.abs(road - value) < Math.abs(best - value)) best = road;
  return best;
}

export class PoliceUnit {
  constructor(scene, x, z, heading) {
    this.car = new DriveCar('police', PATROL_COLOR, x, z, heading);
    scene.add(this.car.mesh);
    this.stuckTimer = 0;
    this.reverseTimer = 0;
    this.stuckEvents = 0;
    this.route = [];
    this.routeTarget = null;
  }

  get position() {
    return this.car.mesh.position;
  }

  planRoute(target, roads) {
    // The patrol thinks in roads, not straight lines: towers block every
    // diagonal, so the route runs along avenues through intersections in
    // an L, and only the last leg cuts across to the suspect. The ring of
    // pavement around each block is collider-free, so the last leg works
    // even when the suspect ducks between towers.
    const pos = this.car.mesh.position;
    const startX = nearestRoad(pos.x, roads);
    const startZ = nearestRoad(pos.z, roads);
    const endX = nearestRoad(target.x, roads);
    const endZ = nearestRoad(target.z, roads);
    this.route = [
      { x: startX, z: startZ },
      { x: endX, z: startZ },
      { x: endX, z: endZ },
      { x: target.x, z: target.z },
    ].filter((point, index, all) => index === 0 || Math.hypot(point.x - all[index - 1].x, point.z - all[index - 1].z) > 4);
    this.routeTarget = { x: target.x, z: target.z };
  }

  update(dt, target, colliders, aggression, roads) {
    const pos = this.car.mesh.position;
    if (!this.routeTarget || Math.hypot(target.x - this.routeTarget.x, target.z - this.routeTarget.z) > 14) {
      this.planRoute(target, roads);
    }
    while (this.route.length > 1 && Math.hypot(this.route[0].x - pos.x, this.route[0].z - pos.z) < 8) {
      this.route.shift();
    }
    const waypoint = this.route[0] ?? target;
    const onFinalLeg = this.route.length <= 1;
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const dist = Math.hypot(dx, dz);
    // Aim at the current route waypoint; on the final leg, aim a little
    // ahead of a moving target so chases cut corners.
    const lead = onFinalLeg ? Math.min(1.1, dist / 26) * (target.speed ?? 0) : 0;
    const aimX = waypoint.x + Math.sin(target.heading ?? 0) * lead;
    const aimZ = waypoint.z + Math.cos(target.heading ?? 0) * lead;
    const desired = Math.atan2(aimX - pos.x, aimZ - pos.z);
    const diff = wrapAngle(desired - this.car.heading);
    const steer = Math.max(-1, Math.min(1, diff * 1.9));

    let throttle = 1;
    let handbrake = false;
    if (this.reverseTimer > 0) {
      this.reverseTimer -= dt;
      throttle = -0.85;
    } else if (Math.abs(diff) > 2.2) {
      throttle = 0.15;
      handbrake = true;
    } else if (onFinalLeg && dist < 5 && (target.speed ?? 0) < 1.5) {
      // Arriving at a stopped suspect: pull up alongside, do not ram through.
      throttle = dist < 2.8 ? -0.4 : 0.25;
    } else if (onFinalLeg && dist < 9) {
      throttle = 0.55;
    }
    if (aggression >= 5) throttle = Math.min(1, throttle * 1.25);

    const speedBefore = Math.abs(this.car.speed);
    this.car.drive(dt, throttle, steer, handbrake, colliders);
    // Stuck detection: full throttle and barely moving means a wall won.
    // Reverse out twice; on the third failure the unit re-routes — it
    // repositions to the avenue nearest the suspect, the way a real patrol
    // abandons a blocked alley and comes around the other side.
    if (throttle > 0.8 && speedBefore < 1.2 && Math.abs(this.car.speed) < 1.2 && dist > 6) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 0.9) {
        this.stuckTimer = 0;
        this.stuckEvents += 1;
        if (this.stuckEvents >= 3) {
          this.stuckEvents = 0;
          const snapX = nearestRoad(target.x, roads);
          const snapZ = nearestRoad(target.z, roads);
          if (Math.abs(snapX - target.x) < Math.abs(snapZ - target.z)) {
            this.car.placeAt(snapX, target.z, Math.atan2(target.x - snapX, target.z - target.z + 0.001));
          } else {
            this.car.placeAt(target.x, snapZ, Math.atan2(target.x - target.x + 0.001, target.z - snapZ));
          }
          this.routeTarget = null;
        } else {
          this.reverseTimer = 0.65;
        }
      }
    } else {
      this.stuckTimer = 0;
    }
    return dist;
  }

  dispose(scene) {
    scene.remove(this.car.mesh);
  }
}

export function spawnPointNear(focus, index) {
  // Units roll in from avenues roughly 65-85 m out, on a road, spread by index.
  const angles = [0.4, 2.5, 4.2, 5.6];
  const angle = angles[index % angles.length];
  const distance = 68 + index * 7;
  let x = focus.x + Math.sin(angle) * distance;
  let z = focus.z + Math.cos(angle) * distance;
  x = Math.max(-126, Math.min(126, x));
  z = Math.max(-126, Math.min(140, z));
  // Snap to the nearest avenue so the unit starts on tarmac, not in a tower.
  const roads = [-110, -66, -22, 22, 66, 110];
  let best = roads[0];
  for (const road of roads) if (Math.abs(road - x) < Math.abs(best - x)) best = road;
  x = best;
  return { x, z, heading: Math.atan2(focus.x - x, focus.z - z) };
}
