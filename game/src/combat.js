// Nico's shove: a committed swing (wind-up, arc, recovery).

export const MELEE_RANGE=2.3;

const SWING_ACTIVE_SECONDS=0.16;
const RECOVERY_ON_HIT=0.5;
const RECOVERY_ON_WHIFF=0.32;
const ARC_COSINE=0.32;

export function createCombat() {
	let cooldown=0;
	let swingAge=Infinity;

	function facingOf(player) {
		return { x: Math.sin(player.heading),z: Math.cos(player.heading) };
	}

	function arcHit(player,facing,targetPos) {

		const dx=targetPos.x - player.mesh.position.x;
		const dz=targetPos.z - player.mesh.position.z;
		const dist=Math.hypot(dx,dz);
		if (dist > MELEE_RANGE || dist < 0.01) return null;
		if ((dx * facing.x + dz * facing.z) / dist <= ARC_COSINE) return null;
		return { dirX: dx / dist,dirZ: dz / dist,dist };
	}

	return {
		get swinging() {
			return swingAge < SWING_ACTIVE_SECONDS;
		},
		update(dt) {
			if (cooldown > 0) cooldown -= dt;
			swingAge += dt;
		},
		tryAttack(player,pedestrians,cars) {
			if (cooldown > 0) return null;
			swingAge=0;
			const facing=facingOf(player);
			let hit=null;
			let peopleHit=0;
			for (const person of pedestrians) {
				const arc=arcHit(player,facing,person.mesh.position);
				if (!arc) continue;
				person.knockDown();
				peopleHit += 1;
				if (!hit) {
					hit={
						kind: 'pedestrian',
						target: person,
						dirX: arc.dirX,
						dirZ: arc.dirZ,
						power: 1,
					};
				}
			}
			if (peopleHit > 0) {

				cooldown=RECOVERY_ON_HIT;
				hit.peopleHit=peopleHit;
				return hit;
			}
			for (const car of cars) {
				const arc=arcHit(player,facing,car.mesh.position);
				if (!arc) continue;
				car.health=Math.max(5,car.health - 3);
				cooldown=RECOVERY_ON_HIT;
				return { kind: 'car',target: car,dirX: arc.dirX,dirZ: arc.dirZ,power: 0.4 };
			}
			cooldown=RECOVERY_ON_WHIFF;
			return null;
		},
	};
}
