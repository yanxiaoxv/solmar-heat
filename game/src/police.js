// The Solmar Patrol: drivers, not homing missiles. No teleports.

import { DriveCar } from './vehicles.js';
import { ROAD_X,ROAD_Z } from './city.js';

const PATROL_COLOR=0xf4f6f8;

function wrapAngle(angle) {
	let wrapped=angle;
	while (wrapped > Math.PI) wrapped -= Math.PI * 2;
	while (wrapped < -Math.PI) wrapped += Math.PI * 2;
	return wrapped;
}

function clamp(value,low,high) {
	return Math.max(low,Math.min(high,value));
}

function nearestRoadCoordinate(value,roads) {

	let best=roads[0];
	for (const road of roads) {
		if (Math.abs(road - value) < Math.abs(best - value)) best=road;
	}
	return best;
}

function pathLength(points) {
	let total=0;
	for (let i=1; i < points.length; i += 1) {
		total += Math.hypot(points[i].x - points[i - 1].x,points[i].z - points[i - 1].z);
	}
	return total;
}

export class PoliceUnit {
	constructor(scene,x,z,heading) {
		this.car=new DriveCar('police',PATROL_COLOR,x,z,heading);
		scene.add(this.car.mesh);

		this.skill=0.9 + Math.random() * 0.2;
		this.route=[];
		this.routeDestination=null;
		this.legFrom={ x,z };
		this.stuckSeconds=0;
		this.stuckCount=0;
		this.reverseSeconds=0;
		this.gaveUp=false;
	}

	get position() {
		return this.car.mesh.position;
	}

	planRoute(target,roads) {

		const pos=this.car.mesh.position;
		const startX=nearestRoadCoordinate(pos.x,roads.x);
		const startZ=nearestRoadCoordinate(pos.z,roads.z);
		const endX=nearestRoadCoordinate(target.x,roads.x);
		const endZ=nearestRoadCoordinate(target.z,roads.z);
		const viaEastFirst=[
			{ x: startX,z: startZ },
			{ x: endX,z: startZ },
			{ x: endX,z: endZ },
		];
		const viaSouthFirst=[
			{ x: startX,z: startZ },
			{ x: startX,z: endZ },
			{ x: endX,z: endZ },
		];
		const chosen=pathLength(viaEastFirst) <= pathLength(viaSouthFirst) ? viaEastFirst : viaSouthFirst;
		chosen.push({ x: target.x,z: target.z });
		this.route=chosen.filter((point,index,all) => (
			index === 0 || Math.hypot(point.x - all[index - 1].x,point.z - all[index - 1].z) > 4
		));
		this.routeDestination={ x: target.x,z: target.z };
		this.legFrom={ x: pos.x,z: pos.z };
	}

	update(dt,target,colliders,aggression,roads) {
		if (this.gaveUp) return 0;
		const pos=this.car.mesh.position;
		const dx=target.x - pos.x;
		const dz=target.z - pos.z;
		const dist=Math.hypot(dx,dz);

		const destinationMoved=!this.routeDestination
			|| Math.hypot(target.x - this.routeDestination.x,target.z - this.routeDestination.z) > 18;
		if (destinationMoved || this.route.length === 0) this.planRoute(target,roads);

		while (this.route.length > 1 && Math.hypot(this.route[0].x - pos.x,this.route[0].z - pos.z) < 3.5) {
			this.legFrom=this.route[0];
			this.route.shift();
			this.stuckCount=0;
		}
		const onFinalLeg=this.route.length <= 1;
		const waypoint=this.route[0] ?? target;

		let aimX=waypoint.x;
		let aimZ=waypoint.z;
		if (!onFinalLeg) {
			const legDX=waypoint.x - this.legFrom.x;
			const legDZ=waypoint.z - this.legFrom.z;
			const legLength=Math.hypot(legDX,legDZ) || 1;
			const alongRaw=((pos.x - this.legFrom.x) * legDX + (pos.z - this.legFrom.z) * legDZ) / legLength;
			const along=clamp(alongRaw,0,legLength);
			const offLine=Math.abs(((pos.x - this.legFrom.x) * legDZ - (pos.z - this.legFrom.z) * legDX) / legLength);

			const lookAhead=offLine > 4 ? along : Math.min(along + 6,legLength);
			aimX=this.legFrom.x + (legDX / legLength) * lookAhead;
			aimZ=this.legFrom.z + (legDZ / legLength) * lookAhead;
		} else {
			const targetSpeed=target.speed ?? 0;
			const timeToReach=clamp(dist / (Math.abs(this.car.speed) + 9),0,1.15);
			aimX += Math.sin(target.heading ?? 0) * targetSpeed * timeToReach;
			aimZ += Math.cos(target.heading ?? 0) * targetSpeed * timeToReach;
		}
		const desired=Math.atan2(aimX - pos.x,aimZ - pos.z);
		const diff=wrapAngle(desired - this.car.heading);
		const steer=clamp(diff * 2.1 * this.skill,-1,1);

		let speedCap=Infinity;
		if (this.route.length >= 2) {
			const inX=this.route[0].x - this.legFrom.x;
			const inZ=this.route[0].z - this.legFrom.z;
			const outX=this.route[1].x - this.route[0].x;
			const outZ=this.route[1].z - this.route[0].z;
			const bend=Math.abs(wrapAngle(Math.atan2(outX,outZ) - Math.atan2(inX,inZ)));
			const distToWaypoint=Math.hypot(this.route[0].x - pos.x,this.route[0].z - pos.z);
			if (bend > 0.35) {
				const bendCap=24 - Math.min(1,bend / (Math.PI / 2)) * 17;
				speedCap=Math.max(bendCap,distToWaypoint * 0.7);
			}
		} else if (onFinalLeg) {
			speedCap=3 + dist * 0.7;
		}
		if (Number.isFinite(speedCap)) {
			speedCap *= 0.35 + 0.65 * Math.max(0,Math.cos(diff));
		}

		let throttle=1;
		let handbrake=false;
		if (this.reverseSeconds > 0) {
			this.reverseSeconds -= dt;
			throttle=-0.9;
		} else if (Math.abs(diff) > 2.35 && Math.abs(this.car.speed) >= 3) {

			throttle=-0.35;
		} else if (Math.abs(diff) > 2.35) {
			throttle=0.12;
			handbrake=true;
		} else {
			throttle=1 - Math.min(0.55,Math.abs(diff) * 0.38);
			if (onFinalLeg && dist < 11 && (target.speed ?? 0) < 2) {

				if (dist < 4.2) {
					if (dist > 3.2) throttle=Math.abs(this.car.speed) > 1.2 ? 0 : 0.25;
					else throttle=Math.abs(this.car.speed) > 0.8 ? -0.5 : 0;
				} else {
					const approachCap=Math.max(0,(dist - 2.4) * 1.15);
					if (Math.abs(this.car.speed) > approachCap + 2.5) throttle=-0.55;
					else if (Math.abs(this.car.speed) > approachCap) throttle=0;
					else throttle=Math.min(throttle,0.5);
				}
			}
			if (aggression >= 5) throttle=Math.min(1,throttle * 1.22);
		}
		if (this.reverseSeconds <= 0 && Math.abs(this.car.speed) > speedCap) {
			throttle=Math.abs(this.car.speed) > speedCap + 4 ? -0.4 : Math.min(throttle,0);
		}

		const speedBefore=Math.abs(this.car.speed);
		this.car.drive(dt,throttle,steer,handbrake,colliders);

		const trying=Math.abs(throttle) > 0.3 || handbrake || this.reverseSeconds > 0;
		if (trying && speedBefore < 1.1 && Math.abs(this.car.speed) < 1.1 && dist > 6) {
			this.stuckSeconds += dt;
			if (this.stuckSeconds > 0.85) {
				this.stuckSeconds=0;
				this.stuckCount += 1;
				if (this.stuckCount === 1) {
					this.reverseSeconds=0.7;
				} else if (this.stuckCount === 2) {
					this.reverseSeconds=0.5;
					const snapX=nearestRoadCoordinate(pos.x,roads.x);
					const snapZ=nearestRoadCoordinate(pos.z,roads.z);
					this.route=[{ x: snapX,z: snapZ },{ x: target.x,z: target.z }];
					this.legFrom={ x: pos.x,z: pos.z };
					this.routeDestination={ x: target.x,z: target.z };
				} else {
					this.gaveUp=true;
				}
			}
		} else {
			this.stuckSeconds=0;
		}
		return dist;
	}

	dispose(scene) {
		scene.remove(this.car.mesh);
	}
}

export function spawnPointNear(focus,index) {

	const angles=[0.7,2.2,3.6,5.3];
	const angle=angles[index % angles.length];
	const distance=66 + index * 6;
	let x=focus.x + Math.sin(angle) * distance;
	let z=focus.z + Math.cos(angle) * distance;
	x=Math.max(-215,Math.min(215,x));
	z=Math.max(-215,Math.min(140,z));
	const snappedX=nearestRoadCoordinate(x,ROAD_X);
	const snappedZ=nearestRoadCoordinate(z,ROAD_Z);
	if (Math.abs(snappedX - x) < Math.abs(snappedZ - z)) x=snappedX;
	else z=snappedZ;
	return { x,z,heading: Math.atan2(focus.x - x,focus.z - z) };
}
