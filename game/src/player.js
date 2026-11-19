// The player, Nico Vega: teal shirt and white cap — the only
// teal in the city, so he reads against the Brisa crew's red.
// Walks, runs, shoves; in a car the DriveCar takes over.

import * as THREE from 'three';
import { resolveCollisions } from './city.js';
import { WALK_SPEED,RUN_SPEED,PLAYER_RADIUS } from './config.js';
import { createHumanFigure } from './figures.js';

export function createPlayerAvatar() {
	const group=createHumanFigure({
		shirt: 0x12a5b4,
		skin: 0xc98a5e,
		pants: 0x2b3a55,
		hair: 0x241a12,
	});

	const capMat=new THREE.MeshLambertMaterial({ color: 0xf2f0e6 });
	const dome=new THREE.Mesh(
		new THREE.SphereGeometry(0.215,14,8,0,Math.PI * 2,0,Math.PI * 0.5),
		capMat,
	);
	dome.scale.y=0.72;
	dome.position.y=1.76;
	group.add(dome);
	const brim=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.23,0.035,12,1,false,-0.9,1.8),capMat);
	brim.position.set(0,1.755,0.1);
	group.add(brim);
	return group;
}

export class Player {
	constructor(scene,x,z) {
		this.mesh=createPlayerAvatar();
		this.mesh.position.set(x,0,z);
		scene.add(this.mesh);
		this.heading=Math.PI;
		this.walkPhase=0;
		this.moving=false;
	}

	get position() {
		return this.mesh.position;
	}

	updateOnFoot(dt,axis,cameraYaw,running,colliders) {
		const speed=running ? RUN_SPEED : WALK_SPEED;
		let mx=0;
		let mz=0;
		if (axis.x !== 0 || axis.z !== 0) {
			const sin=Math.sin(cameraYaw);
			const cos=Math.cos(cameraYaw);

			const forwardX=-sin;
			const forwardZ=-cos;
			const rightX=cos;
			const rightZ=-sin;
			mx=forwardX * -axis.z + rightX * axis.x;
			mz=forwardZ * -axis.z + rightZ * axis.x;
			const len=Math.hypot(mx,mz) || 1;
			mx /= len;
			mz /= len;
			this.heading=Math.atan2(mx,mz);
			this.moving=true;
		} else {
			this.moving=false;
		}
		this.mesh.position.x += mx * speed * dt;
		this.mesh.position.z += mz * speed * dt;
		const probe={ x: this.mesh.position.x,z: this.mesh.position.z };
		resolveCollisions(probe,PLAYER_RADIUS,colliders);
		this.mesh.position.x=probe.x;
		this.mesh.position.z=probe.z;
		this.mesh.rotation.y=this.heading;

		if (this.moving) this.walkPhase += dt * (running ? 11 : 8);
		const swing=this.moving ? Math.sin(this.walkPhase) * 0.6 : 0;
		const { armL,armR,legL,legR }=this.mesh.userData.limbs;
		armL.rotation.x=swing;
		armR.rotation.x=-swing;
		legL.rotation.x=-swing;
		legR.rotation.x=swing;
		if (!this.moving) {
			armL.rotation.x *= 0.8;
			armR.rotation.x *= 0.8;
			legL.rotation.x *= 0.8;
			legR.rotation.x *= 0.8;
		}
		return this.moving ? speed : 0;
	}

	setVisible(visible) {
		this.mesh.visible=visible;
	}

	placeAt(x,z,heading) {
		this.mesh.position.set(x,0,z);
		this.heading=heading;
		this.mesh.rotation.y=heading;
	}
}
