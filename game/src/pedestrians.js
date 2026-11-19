// Pedestrians: 22 sidewalk strollers, scatter at trouble.

import { ROAD_X,ROAD_Z,ROAD_WIDTH,pickRoadInBand } from './city.js';
import { RECYCLE_MIN,RECYCLE_MAX } from './config.js';
import { createHumanFigure,skinTone,hairColor } from './figures.js';

const SHIRTS=[0xffd166,0x06d6a0,0xef476f,0x118ab2,0xf78c6b,0xa8dadc,0xe0aaff,0x90be6d];
const PANTS=[0x3a4356,0x74563a,0xe8e2d2,0x2e4a62,0x54383e,0x41604a];

export class Pedestrian {
	constructor(scene,index) {
		this.mesh=createHumanFigure({
			shirt: SHIRTS[index % SHIRTS.length],
			skin: skinTone(index),
			pants: PANTS[index % PANTS.length],
			hair: hairColor(index + 2),
			dress: index % 4 === 3,
		});
		scene.add(this.mesh);

		this.vertical=index % 2 === 0;
		const axisRoads=this.vertical ? ROAD_X : ROAD_Z;
		const road=axisRoads[index % axisRoads.length];
		this.line=road + (index % 3 === 0 ? -(ROAD_WIDTH / 2 + 2.2) : ROAD_WIDTH / 2 + 2.2);
		this.progress=-125 + ((index * 37) % 240);

		this.minP=-240;
		this.maxP=this.vertical ? 142 : 240;
		this.sign=index % 4 < 2 ? 1 : -1;
		this.speed=1.6 + (index % 5) * 0.22;
		this.fleeTimer=0;
		this.fleeX=0;
		this.fleeZ=0;
		this.fallTimer=0;
		this.bobPhase=index * 1.7;
		this.syncPosition();
	}

	syncPosition() {
		if (this.vertical) this.mesh.position.set(this.line,0,this.progress);
		else this.mesh.position.set(this.progress,0,this.line);
		this.mesh.rotation.y=this.vertical
			? (this.sign > 0 ? 0 : Math.PI)
			: (this.sign > 0 ? Math.PI / 2 : -Math.PI / 2);
	}

	respawnNear(focusX,focusZ) {

		this.vertical=Math.random() < 0.5;
		const axisRoads=this.vertical ? ROAD_X : ROAD_Z;
		const crossFocus=this.vertical ? focusX : focusZ;
		const road=pickRoadInBand(crossFocus,axisRoads,RECYCLE_MIN,RECYCLE_MAX);
		const side=Math.random() < 0.5 ? -(ROAD_WIDTH / 2 + 2.2) : ROAD_WIDTH / 2 + 2.2;
		this.line=road + side;
		const alongFocus=this.vertical ? focusZ : focusX;
		const offset=Math.random() * 50;
		this.progress=alongFocus + (Math.random() < 0.5 ? -offset : offset);
		this.maxP=this.vertical ? 142 : 240;
		this.progress=Math.max(-240,Math.min(this.maxP,this.progress));
		this.sign=Math.random() < 0.5 ? 1 : -1;
		this.fleeTimer=0;
		this.fallTimer=0;
		this.mesh.rotation.x=0;
		this.mesh.position.y=0;
		this.syncPosition();
	}

	scare(fromX,fromZ,radius=9) {
		const dx=this.mesh.position.x - fromX;
		const dz=this.mesh.position.z - fromZ;
		const dist=Math.hypot(dx,dz);
		if (dist < radius && dist > 0.01) {
			this.fleeTimer=1.6;
			this.fleeX=dx / dist;
			this.fleeZ=dz / dist;
		}
	}

	knockDown() {

		this.fallTimer=1.5;
		this.fleeTimer=2.2;
		const angle=Math.random() * Math.PI * 2;
		this.fleeX=Math.sin(angle);
		this.fleeZ=Math.cos(angle);
	}

	update(dt,danger) {
		if (this.fallTimer > 0) {
			this.fallTimer -= dt;
			this.mesh.rotation.x=-Math.PI / 2 * Math.min(1,(1.5 - this.fallTimer) * 5);
			this.mesh.position.y=0.12;
			if (this.fallTimer <= 0) {
				this.mesh.rotation.x=0;
				this.mesh.position.y=0;
			}
			return;
		}
		const running=this.fleeTimer > 0;
		if (danger) this.scare(danger.x,danger.z,danger.radius ?? 9);
		if (this.fleeTimer > 0) {
			this.fleeTimer -= dt;
			this.mesh.position.x += this.fleeX * 6.4 * dt;
			this.mesh.position.z += this.fleeZ * 6.4 * dt;
			this.mesh.rotation.y=Math.atan2(this.fleeX,this.fleeZ);
		} else {
			this.progress += this.sign * this.speed * dt;
			if (this.progress > this.maxP) this.sign=-1;
			if (this.progress < this.minP) this.sign=1;
			this.syncPosition();
		}

		this.bobPhase += dt * (running ? 13 : 7.5);
		const swing=Math.sin(this.bobPhase) * (running ? 0.75 : 0.45);
		const { armL,armR,legL,legR }=this.mesh.userData.limbs;
		armL.rotation.x=swing;
		armR.rotation.x=-swing;
		legL.rotation.x=-swing;
		legR.rotation.x=swing;
		this.mesh.position.y=Math.abs(Math.sin(this.bobPhase)) * 0.05;

		this.mesh.position.x=Math.max(-242,Math.min(242,this.mesh.position.x));
		this.mesh.position.z=Math.max(-242,Math.min(160,this.mesh.position.z));
	}
}

export function createPedestrians(scene,count=22) {
	const people=[];
	for (let i=0; i < count; i += 1) people.push(new Pedestrian(scene,i));
	return people;
}

export function scareCrowd(people,x,z,radius=11) {
	for (const person of people) person.scare(x,z,radius);
}
