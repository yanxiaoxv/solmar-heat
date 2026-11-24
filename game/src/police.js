// police.js — the Solmar Patrol: police drivers routed on the street graph.
// The Solmar Patrol: graph-routed drivers, no teleports.

import { DriveCar } from './vehicles.js';
import { buildGraph,nearestOnGraph,shortestPath } from './network.js';

const PATROL_COLOR=0xf4f6f8;
const graph=buildGraph();

function wrapAngle(angle) {
	let wrapped=angle;
	while (wrapped > Math.PI) wrapped -= Math.PI * 2;
	while (wrapped < -Math.PI) wrapped += Math.PI * 2;
	return wrapped;
}
function clamp(value,low,high) {
	return Math.max(low,Math.min(high,value));
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
		this.endTimer=0;
		this.stageFlip=false;
		this.gaveUp=false;
	}

	get position() {
		return this.car.mesh.position;
	}

	planRoute(target) {
		const pos=this.car.mesh.position;
		const from=nearestOnGraph(graph,pos.x,pos.z);
		const to=nearestOnGraph(graph,target.x,target.z);
		const nodes=shortestPath(graph,from.near,to.near);
		const pts=[{ x: from.x,z: from.z }];
		if (nodes) for (const nd of nodes) pts.push({ x: nd.x,z: nd.z });
		if ((target.speed ?? 0) < 2) {
			const anchor=this.stageFlip ? to.far : to.near;
			let dirX=anchor.x - to.x;
			let dirZ=anchor.z - to.z;
			const dirLen=Math.hypot(dirX,dirZ);
			if (dirLen > 0.5) {
				dirX /= dirLen;
				dirZ /= dirLen;
				pts.push({ x: to.x + dirX * 13,z: to.z + dirZ * 13 });
			} else pts.push({ x: to.x,z: to.z });
		} else pts.push({ x: to.x,z: to.z });
		pts.push({ x: target.x,z: target.z });
		this.route=pts.filter((point,index,all) => (
			index === 0 || Math.hypot(point.x - all[index - 1].x,point.z - all[index - 1].z) > 3
		));
		this.routeDestination={ x: target.x,z: target.z };
		this.legFrom={ x: pos.x,z: pos.z };
	}

	update(dt,target,colliders,aggression) {
		if (this.gaveUp) return 0;
		const pos=this.car.mesh.position;
		const dx=target.x - pos.x;
		const dz=target.z - pos.z;
		const dist=Math.hypot(dx,dz);
		const destinationMoved=!this.routeDestination
			|| Math.hypot(target.x - this.routeDestination.x,target.z - this.routeDestination.z) > 18;
		if (destinationMoved || this.route.length === 0) this.planRoute(target);
		while (this.route.length > 1 && Math.hypot(this.route[0].x - pos.x,this.route[0].z - pos.z) < (this.route.length === 2 ? 8 : 3.5)) {
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
			if (targetSpeed < 2 && dist > 4.2 && dist < 14) {
				aimX += (dx / dist) * 6;
				aimZ += (dz / dist) * 6;
			}
		}
		const desired=Math.atan2(aimX - pos.x,aimZ - pos.z);
		const diff=wrapAngle(desired - this.car.heading);
		const endStill=onFinalLeg && dist < 12 && (target.speed ?? 0) < 2;
		if (endStill && dist > 4.2) {
			this.endTimer += dt;
			if (this.endTimer > 1.5) {
				this.endTimer=0;
				this.stageFlip=!this.stageFlip;
				this.planRoute(target);
			}
		} else this.endTimer=0;
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
			if (endStill) throttle=-0.55;
			else {
				throttle=0.12;
				handbrake=true;
			}
		} else {
			throttle=1 - Math.min(0.55,Math.abs(diff) * 0.38);
			if ((target.speed ?? 0) < 2) {
				if (onFinalLeg && dist < 4.2) {
					if (dist > 3.2) throttle=Math.abs(this.car.speed) > 1.2 ? 0 : 0.25;
					else throttle=Math.abs(this.car.speed) > 0.8 ? -0.5 : 0;
				} else if ((onFinalLeg && dist < 11) || (this.route.length === 2 && dist < 16)) {
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
		const driveSteer=endStill && (this.reverseSeconds > 0 || (throttle < 0 && this.car.speed <= 0.5)) ? -steer : steer;
		this.car.drive(dt,throttle,driveSteer,handbrake,colliders);
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
					this.planRoute(target);
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
	const candidates=[];
	for (const nd of graph.nodes.values()) {
		const d=Math.hypot(nd.x - focus.x,nd.z - focus.z);
		if (d > 52 && d < 88) candidates.push(nd);
	}
	if (candidates.length) {
		const goal=nearestOnGraph(graph,focus.x,focus.z).near;
		for (const nd of candidates) {
			const path=shortestPath(graph,nd,goal);
			nd.spawnLen=path ? path.reduce((sum,p,i) => i ? sum + Math.hypot(p.x - path[i - 1].x,p.z - path[i - 1].z) : 0,0) : Infinity;
		}
		candidates.sort((a,b) => (a.spawnLen - b.spawnLen) || (Math.atan2(a.x - focus.x,a.z - focus.z) - Math.atan2(b.x - focus.x,b.z - focus.z)));
		let nd=candidates[(index * 7) % candidates.length];
		if (index > 0) {
			const first=candidates[0];
			const baseAngle=Math.atan2(first.x - focus.x,first.z - focus.z);
			const opposite=candidates.find((cand) => Math.abs(wrapAngle(Math.atan2(cand.x - focus.x,cand.z - focus.z) - baseAngle)) > 1.4);
			if (opposite) nd=opposite;
		}
		return { x: nd.x,z: nd.z,heading: Math.atan2(focus.x - nd.x,focus.z - nd.z) };
	}
	let best=null;
	let bd=Infinity;
	for (const nd of graph.nodes.values()) {
		const d=Math.abs(Math.hypot(nd.x - focus.x,nd.z - focus.z) - 66);
		if (d < bd) { bd=d; best=nd; }
	}
	return { x: best.x,z: best.z,heading: Math.atan2(focus.x - best.x,focus.z - best.z) };
}
