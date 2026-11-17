// Hand-to-hand combat for Solmar Heat: Nico's shove. On foot, a click throws
// a short swing in front of him; a pedestrian caught in the arc goes down,
// gets up angry and runs, and doing it in front of the patrol is a crime.
// Cars dent instead of falling over. It is deliberately simple in M2 — the
// story fights in M3 build on the same swing.

export const MELEE_RANGE = 2.3;
export const MELEE_COOLDOWN = 0.45;

export function createCombat() {
  let cooldown = 0;
  let swingTimer = 0;

  return {
    get swinging() {
      return swingTimer > 0;
    },
    update(dt) {
      if (cooldown > 0) cooldown -= dt;
      if (swingTimer > 0) swingTimer -= dt;
    },
    tryAttack(player, pedestrians, cars) {
      if (cooldown > 0) return null;
      cooldown = MELEE_COOLDOWN;
      swingTimer = 0.22;
      const facingX = Math.sin(player.heading);
      const facingZ = Math.cos(player.heading);
      let hit = null;
      for (const person of pedestrians) {
        const dx = person.mesh.position.x - player.mesh.position.x;
        const dz = person.mesh.position.z - player.mesh.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > MELEE_RANGE || dist < 0.01) continue;
        const dot = (dx * facingX + dz * facingZ) / dist;
        if (dot > 0.35) {
          person.knockDown();
          hit = hit ?? { kind: 'pedestrian', target: person };
        }
      }
      if (!hit) {
        for (const car of cars) {
          const dx = car.mesh.position.x - player.mesh.position.x;
          const dz = car.mesh.position.z - player.mesh.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 2.6 && dist > 0.01) {
            const dot = (dx * facingX + dz * facingZ) / dist;
            if (dot > 0.2) {
              car.health = Math.max(5, car.health - 3);
              hit = { kind: 'car', target: car };
              break;
            }
          }
        }
      }
      return hit;
    },
  };
}
