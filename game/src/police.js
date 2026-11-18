// The Solmar Patrol, second build: interceptors that answer the wanted
// level and hunt as drivers, not as homing missiles. Each unit plans a
// route over the avenue grid — trying both L-shaped paths through the
// intersections and keeping the shorter — then drives it with a pursuit
// controller that aims where the suspect WILL be, backs off instead of
// ramming a stopped suspect, and slows for corners so it stops planting
// itself in tower walls. A unit that still gets stuck reverses out, then
// re-routes via the nearest intersection, and only after a third failure
// gives up the chase entirely: it drops out and the world's spawn logic
// rolls a fresh unit in from blocks away, the way a real patrol hands
// off. Nothing ever teleports across the map.

import { DriveCar } from './vehicles.js';

const PATROL_COLOR = 0xf4f6f8;

function wrapAngle(angle) {
  let wrapped = angle;
  while (wrapped > Math.PI) wrapped -= Math.PI * 2;
  while (wrapped < -Math.PI) wrapped += Math.PI * 2;
  return wrapped;
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function nearestRoadCoordinate(value, roads) {
  let best = roads[0];
  for (const road of roads) {
    if (Math.abs(road - value) < Math.abs(best - value)) best = road;
  }
  return best;
}

function pathLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
  }
  return total;
}

export class PoliceUnit {
  constructor(scene, x, z, heading) {
    this.car = new DriveCar('police', PATROL_COLOR, x, z, heading);
    scene.add(this.car.mesh);
    // Every driver is a slightly different driver: skill scales steering
    // authority and commitment, so a three-car chase does not move like
    // one car copied three times.
    this.skill = 0.9 + Math.random() * 0.2;
    this.route = [];
    this.routeDestination = null;
    this.legFrom = { x, z };
    this.stuckSeconds = 0;
    this.stuckCount = 0;
    this.reverseSeconds = 0;
    this.gaveUp = false;
  }

  get position() {
    return this.car.mesh.position;
  }

  planRoute(target, roads) {
    // Towers make diagonals fiction, so the route runs along avenues.
    // Both L orientations are real options — east-then-south versus
    // south-then-east — and they are not the same length once the start
    // is snapped to its nearest avenue, so price both and keep the cheap
    // one. The suspect's exact position is the final point: the ring of
    // pavement around every block is collider-free, so the last leg can
    // leave the avenue and still arrive.
    const pos = this.car.mesh.position;
    const startX = nearestRoadCoordinate(pos.x, roads);
    const startZ = nearestRoadCoordinate(pos.z, roads);
    const endX = nearestRoadCoordinate(target.x, roads);
    const endZ = nearestRoadCoordinate(target.z, roads);
    const viaEastFirst = [
      { x: startX, z: startZ },
      { x: endX, z: startZ },
      { x: endX, z: endZ },
    ];
    const viaSouthFirst = [
      { x: startX, z: startZ },
      { x: startX, z: endZ },
      { x: endX, z: endZ },
    ];
    const chosen = pathLength(viaEastFirst) <= pathLength(viaSouthFirst) ? viaEastFirst : viaSouthFirst;
    chosen.push({ x: target.x, z: target.z });
    this.route = chosen.filter((point, index, all) => (
      index === 0 || Math.hypot(point.x - all[index - 1].x, point.z - all[index - 1].z) > 4
    ));
    this.routeDestination = { x: target.x, z: target.z };
    this.legFrom = { x: pos.x, z: pos.z };
  }

  update(dt, target, colliders, aggression, roads) {
    if (this.gaveUp) return 0;
    const pos = this.car.mesh.position;
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const dist = Math.hypot(dx, dz);

    const destinationMoved = !this.routeDestination
      || Math.hypot(target.x - this.routeDestination.x, target.z - this.routeDestination.z) > 18;
    if (destinationMoved || this.route.length === 0) this.planRoute(target, roads);
    // Waypoints are consumed only when genuinely reached (3.5 m). The
    // first version of this controller used 7 m and chased points, and
    // the trace showed what that does: the intersection waypoint is
    // eaten while the car is still mid-block, the next leg is steered
    // as a straight line, and the car cuts the corner through a tower.
    while (this.route.length > 1 && Math.hypot(this.route[0].x - pos.x, this.route[0].z - pos.z) < 3.5) {
      this.legFrom = this.route[0];
      this.route.shift();
      this.stuckCount = 0;
    }
    const onFinalLeg = this.route.length <= 1;
    const waypoint = this.route[0] ?? target;

    // Aim point. On a road leg the car follows the avenue LINE, not the
    // waypoint point: project the car onto the leg, then aim a few
    // metres ahead of that projection — the car settles onto the avenue
    // and stays on it. On the final leg, aim where the suspect will be
    // when this unit gets there, predicted from the suspect's own speed
    // and heading, with the lead capped so a fast suspect does not drag
    // the aim point across a tower block.
    let aimX = waypoint.x;
    let aimZ = waypoint.z;
    if (!onFinalLeg) {
      const legDX = waypoint.x - this.legFrom.x;
      const legDZ = waypoint.z - this.legFrom.z;
      const legLength = Math.hypot(legDX, legDZ) || 1;
      const alongRaw = ((pos.x - this.legFrom.x) * legDX + (pos.z - this.legFrom.z) * legDZ) / legLength;
      const along = clamp(alongRaw, 0, legLength);
      const offLine = Math.abs(((pos.x - this.legFrom.x) * legDZ - (pos.z - this.legFrom.z) * legDX) / legLength);
      // Path following only holds near the path. Knocked well off the
      // avenue line — an overshot corner, a shove, a slide — the car
      // must first drive back TO the line (aim at its own projection);
      // aiming ahead from off-line is what dragged the first trace
      // diagonally across a tower block. Near the line, aim ahead of
      // the projection and the car tracks the avenue.
      const lookAhead = offLine > 4 ? along : Math.min(along + 6, legLength);
      aimX = this.legFrom.x + (legDX / legLength) * lookAhead;
      aimZ = this.legFrom.z + (legDZ / legLength) * lookAhead;
    } else {
      const targetSpeed = target.speed ?? 0;
      const timeToReach = clamp(dist / (Math.abs(this.car.speed) + 9), 0, 1.15);
      aimX += Math.sin(target.heading ?? 0) * targetSpeed * timeToReach;
      aimZ += Math.cos(target.heading ?? 0) * targetSpeed * timeToReach;
    }
    const desired = Math.atan2(aimX - pos.x, aimZ - pos.z);
    const diff = wrapAngle(desired - this.car.heading);
    const steer = clamp(diff * 2.1 * this.skill, -1, 1);

    // Speed discipline: the speed a turn can be made at is decided by
    // the angle waiting at the next waypoint, and it has to be shed
    // BEFORE the corner, not during it. The cap is the greater of the
    // bend's own limit (a right angle: ~7 m/s) and a distance ramp
    // (0.85 m/s per metre still to travel), so a long straight stays
    // fast and the braking is progressive instead of a wall at 20 m.
    // The final approach to the suspect uses the distance ramp alone:
    // a unit that arrives at 25 m/s overshoots, loops a whole block
    // and loses the chase it had already won.
    let speedCap = Infinity;
    if (this.route.length >= 2) {
      const inX = this.route[0].x - this.legFrom.x;
      const inZ = this.route[0].z - this.legFrom.z;
      const outX = this.route[1].x - this.route[0].x;
      const outZ = this.route[1].z - this.route[0].z;
      const bend = Math.abs(wrapAngle(Math.atan2(outX, outZ) - Math.atan2(inX, inZ)));
      const distToWaypoint = Math.hypot(this.route[0].x - pos.x, this.route[0].z - pos.z);
      if (bend > 0.35) {
        const bendCap = 24 - Math.min(1, bend / (Math.PI / 2)) * 17;
        speedCap = Math.max(bendCap, distToWaypoint * 0.7);
      }
    } else if (onFinalLeg) {
      speedCap = 3 + dist * 0.7;
    }
    if (Number.isFinite(speedCap)) {
      // A cap is only permission to be fast while FACING the goal. The
      // first final-leg trace looped a whole block at 21 m/s because
      // the distance ramp licensed that speed even with the suspect
      // directly behind the car; facing away now cuts the cap to a
      // third, so the car slows, turns tightly and re-approaches.
      speedCap *= 0.35 + 0.65 * Math.max(0, Math.cos(diff));
    }

    let throttle = 1;
    let handbrake = false;
    if (this.reverseSeconds > 0) {
      // Backing out of whatever just stopped the car, steering against
      // the lock so the nose swings toward the route again.
      this.reverseSeconds -= dt;
      throttle = -0.9;
    } else if (Math.abs(diff) > 2.35 && Math.abs(this.car.speed) >= 3) {
      // Facing the wrong way at speed: brake first. Spinning the wheel
      // under handbrake at 19 m/s just slides the car bodily off the
      // avenue — the second trace's whole failure started there.
      throttle = -0.35;
    } else if (Math.abs(diff) > 2.35) {
      throttle = 0.12;
      handbrake = true;
    } else {
      // Commit less as the wheel turns harder: full throttle through a
      // ninety-degree corner is how v1 units met their walls.
      throttle = 1 - Math.min(0.55, Math.abs(diff) * 0.38);
      if (onFinalLeg && dist < 11 && (target.speed ?? 0) < 2) {
        // Arriving at a stopped or walking suspect: the job is to box
        // them in for the bust meter, not to punt them down the avenue.
        // Inside 4.2 m the unit simply stops and holds — the meter
        // does the rest — and only rolls again if the suspect bolts.
        if (dist < 4.2) {
          // Creep the last metre rather than stopping wherever the
          // momentum died: the bust radius is 3.6 m, and a unit that
          // parks at 3.9 m holds a staring contest, not a suspect.
          if (dist > 3.2) throttle = Math.abs(this.car.speed) > 1.2 ? 0 : 0.25;
          else throttle = Math.abs(this.car.speed) > 0.8 ? -0.5 : 0;
        } else {
          const approachCap = Math.max(0, (dist - 2.4) * 1.15);
          if (Math.abs(this.car.speed) > approachCap + 2.5) throttle = -0.55;
          else if (Math.abs(this.car.speed) > approachCap) throttle = 0;
          else throttle = Math.min(throttle, 0.5);
        }
      }
      if (aggression >= 5) throttle = Math.min(1, throttle * 1.22);
    }
    if (this.reverseSeconds <= 0 && Math.abs(this.car.speed) > speedCap) {
      throttle = Math.abs(this.car.speed) > speedCap + 4 ? -0.4 : Math.min(throttle, 0);
    }

    const speedBefore = Math.abs(this.car.speed);
    this.car.drive(dt, throttle, steer, handbrake, colliders);

    // Stuck bookkeeping: full intent, no motion, suspect still far.
    // First failure reverses out; second adds a re-route through the
    // nearest intersection; third ends this unit's chase for good. The
    // failure count is only forgiven when a waypoint is genuinely
    // reached — an earlier version also forgave it for moving fast,
    // which the reverse-out manoeuvre itself tripped, so a car grinding
    // on a tower corner kept forgiving itself and never escalated.
    const trying = Math.abs(throttle) > 0.3 || handbrake || this.reverseSeconds > 0;
    if (trying && speedBefore < 1.1 && Math.abs(this.car.speed) < 1.1 && dist > 6) {
      this.stuckSeconds += dt;
      if (this.stuckSeconds > 0.85) {
        this.stuckSeconds = 0;
        this.stuckCount += 1;
        if (this.stuckCount === 1) {
          this.reverseSeconds = 0.7;
        } else if (this.stuckCount === 2) {
          this.reverseSeconds = 0.5;
          const snapX = nearestRoadCoordinate(pos.x, roads);
          const snapZ = nearestRoadCoordinate(pos.z, roads);
          this.route = [{ x: snapX, z: snapZ }, { x: target.x, z: target.z }];
          this.legFrom = { x: pos.x, z: pos.z };
          this.routeDestination = { x: target.x, z: target.z };
        } else {
          this.gaveUp = true;
        }
      }
    } else {
      this.stuckSeconds = 0;
    }
    return dist;
  }

  dispose(scene) {
    scene.remove(this.car.mesh);
  }
}

export function spawnPointNear(focus, index) {
  // Fresh units roll in on an avenue 65-85 m out, spread around the
  // compass by index. Snap whichever coordinate is closer to a road so
  // the unit starts on tarmac whichever direction it comes from.
  const angles = [0.7, 2.2, 3.6, 5.3];
  const angle = angles[index % angles.length];
  const distance = 66 + index * 6;
  let x = focus.x + Math.sin(angle) * distance;
  let z = focus.z + Math.cos(angle) * distance;
  x = Math.max(-126, Math.min(126, x));
  z = Math.max(-126, Math.min(140, z));
  const roads = [-110, -66, -22, 22, 66, 110];
  const snappedX = nearestRoadCoordinate(x, roads);
  const snappedZ = nearestRoadCoordinate(z, roads);
  if (Math.abs(snappedX - x) < Math.abs(snappedZ - z)) x = snappedX;
  else z = snappedZ;
  return { x, z, heading: Math.atan2(focus.x - x, focus.z - z) };
}
