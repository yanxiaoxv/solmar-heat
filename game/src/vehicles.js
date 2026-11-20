// Vehicles: one mesh builder, an arcade driving model, the parked
// set the city wakes up with, and traffic that works the grid.

import * as THREE from 'three';
import { ROAD_X,ROAD_Z,resolveCollisions,pickRoadInBand } from './city.js';
import { RECYCLE_MIN,RECYCLE_MAX } from './config.js';
import { mergeGeometries,paintParts } from './merge.js';
import { createSeededRandom } from './random.js';

export const CAR_KINDS={
	coupe: { name: 'Rayo Coupe',top: 33,accel: 10.5,len: 4.1,shape: 'car' },
	sport: { name: 'Vuelo GT',top: 41,accel: 13.5,len: 4.3,shape: 'car' },
	sedan: { name: 'Brisa Sedan',top: 27,accel: 8.2,len: 4.5,shape: 'car' },
	hatch: { name: 'Pico Hatch',top: 24,accel: 7.6,len: 3.7,shape: 'car' },
	van: { name: 'Marina Van',top: 23,accel: 6.2,len: 4.6,shape: 'van' },
	truck: { name: 'Hauler Truck',top: 22,accel: 5.4,len: 6.4,shape: 'truck' },
	police: { name: 'Patrol Interceptor',top: 37,accel: 11.8,len: 4.6,shape: 'car' },
};

const GLASS=0x18242f;
const TRIM=0x23252b;
const bodyMaterial=new THREE.MeshLambertMaterial({ vertexColors: true });
const glassMaterial=new THREE.MeshLambertMaterial({ color: GLASS });
const trimMaterial=new THREE.MeshLambertMaterial({ color: TRIM });
const tyreMaterial=new THREE.MeshLambertMaterial({ color: 0x14161a });
const headlampMaterial=new THREE.MeshBasicMaterial({ color: 0xffe9b0 });
const tailMaterial=new THREE.MeshBasicMaterial({ color: 0xff3b30 });

function box(w,h,d,x,y,z,hex) {
	const geo=new THREE.BoxGeometry(w,h,d);
	geo.translate(x,y,z);
	return paintParts(geo,hex);
}

export function createCarMesh(kind,color) {
	const spec=CAR_KINDS[kind];
	const group=new THREE.Group();
	const parts=[];
	const len=spec.len;
	if (spec.shape === 'truck') {
		parts.push(box(2.0,1.5,1.9,0,1.15,-len / 2 + 1.05,color));
		parts.push(box(2.14,2.3,3.9,0,1.55,-len / 2 + 4.15,0xe8e2d2));
		parts.push(box(2.02,0.5,0.3,0,0.45,-len / 2 + 0.05,TRIM));
	} else if (spec.shape === 'van') {
		parts.push(box(1.94,1.55,len * 0.94,0,1.12,-0.1,color));
		parts.push(box(1.96,0.42,0.5,0,0.5,len / 2 - 0.2,TRIM));
	} else {
		parts.push(box(1.8,0.55,len,0,0.55,0,color));
		parts.push(box(1.86,0.3,0.7,0,0.42,len / 2 - 0.3,TRIM));
		parts.push(box(1.86,0.3,0.7,0,0.42,-len / 2 + 0.3,TRIM));
		const cabin=new THREE.Mesh(new THREE.BoxGeometry(1.62,0.52,len * 0.46),glassMaterial);
		cabin.position.set(0,1.06,-len * 0.05);
		cabin.castShadow=true;
		group.add(cabin);
		const roof=new THREE.Mesh(new THREE.BoxGeometry(1.5,0.07,len * 0.4),new THREE.MeshLambertMaterial({ color }));
		roof.position.set(0,1.35,-len * 0.05);
		group.add(roof);
	}
	const body=new THREE.Mesh(mergeGeometries(parts),bodyMaterial);
	body.castShadow=true;
	group.add(body);
	if (kind === 'police') {
		const bar=new THREE.Mesh(new THREE.BoxGeometry(1.15,0.13,0.52),trimMaterial);
		bar.position.set(0,1.48,-len * 0.05);
		group.add(bar);
		const beaconL=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.15,0.4),new THREE.MeshBasicMaterial({ color: 0xff2d55 }));
		beaconL.position.set(-0.3,1.6,-len * 0.05);
		group.add(beaconL);
		const beaconR=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.15,0.4),new THREE.MeshBasicMaterial({ color: 0x2d7dff }));
		beaconR.position.set(0.3,1.6,-len * 0.05);
		group.add(beaconR);
	}
	for (const side of [-1,1]) {
		const head=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.14,0.06),headlampMaterial);
		head.position.set(side * 0.58,0.62,len / 2 + 0.01);
		group.add(head);
		const tail=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.12,0.06),tailMaterial);
		tail.position.set(side * 0.58,0.66,-len / 2 - 0.01);
		group.add(tail);
	}
	const wheelGeo=new THREE.CylinderGeometry(0.35,0.35,0.26,11);
	wheelGeo.rotateZ(Math.PI / 2);
	const wheels=[];
	const frontZ=len / 2 - 0.85;
	const rearZ=-len / 2 + (spec.shape === 'truck' ? 1.5 : 0.85);
	for (const [wx,wz] of [[-0.85,frontZ],[0.85,frontZ],[-0.85,rearZ],[0.85,rearZ]]) {
		const wheel=new THREE.Mesh(wheelGeo,tyreMaterial);
		wheel.position.set(wx,0.35,wz);
		group.add(wheel);
		wheels.push(wheel);
	}
	group.userData.wheels=wheels;
	group.userData.frontWheels=[wheels[0],wheels[1]];
	return group;
}

function wrapAngle(angle) {
	let wrapped=angle;
	while (wrapped > Math.PI) wrapped -= Math.PI * 2;
	while (wrapped < -Math.PI) wrapped += Math.PI * 2;
	return wrapped;
}
function clamp(value,low,high) {
	return Math.max(low,Math.min(high,value));
}

export class DriveCar {
	constructor(kind,color,x,z,heading) {
		this.kind=kind;
		this.spec=CAR_KINDS[kind];
		this.name=this.spec.name;
		this.mesh=createCarMesh(kind,color);
		this.mesh.position.set(x,0,z);
		this.heading=heading;
		this.mesh.rotation.y=heading;
		this.speed=0;
		this.health=100;
		this.wheelSpin=0;
		this.steerShown=0;
	}

	placeAt(x,z,heading) {
		this.mesh.position.set(x,0,z);
		this.heading=heading;
		this.mesh.rotation.y=heading;
		this.speed=0;
	}

	// throttle -1..1 (negative brakes, then reverses), steer -1..1.
	drive(dt,throttle,steer,handbrake,colliders) {
		const spec=this.spec;
		if (throttle > 0) {
			if (this.speed < spec.top) this.speed += spec.accel * throttle * dt * (1 - Math.max(0,this.speed) / spec.top * 0.45);
		} else if (throttle < 0) {
			if (this.speed > 0.6) this.speed -= 17 * dt;
			else if (this.speed > -8.5) this.speed += spec.accel * 0.7 * throttle * dt;
		} else if (this.speed > 0) {
			this.speed=Math.max(0,this.speed - 2.6 * dt);
		} else if (this.speed < 0) {
			this.speed=Math.min(0,this.speed + 2.6 * dt);
		}
		this.speed -= this.speed * 0.1 * dt;
		if (handbrake) {
			const decel=13 * dt;
			this.speed=Math.abs(this.speed) <= decel ? 0 : this.speed - Math.sign(this.speed) * decel;
		}
		this.speed=clamp(this.speed,-8.5,spec.top);
		if (this.speed !== 0) {
			const pace=Math.abs(this.speed);
			const turn=steer * (pace * 0.17) / (1 + pace * 0.1) * (handbrake ? 1.45 : 1);
			this.heading += turn * dt * Math.sign(this.speed);
		}
		const pos=this.mesh.position;
		const nx=pos.x + Math.sin(this.heading) * this.speed * dt;
		const nz=pos.z + Math.cos(this.heading) * this.speed * dt;
		if (colliders) {
			const probe={ x: nx,z: nz };
			resolveCollisions(probe,1.12,colliders);
			const blocked=Math.hypot(probe.x - nx,probe.z - nz);
			if (blocked > 0.05) {
				if (Math.abs(this.speed) > 6.5) this.health=Math.max(5,this.health - (Math.abs(this.speed) - 6) * 1.1);
				this.speed *= blocked > 0.45 ? 0.1 : 0.45;
			}
			pos.x=probe.x;
			pos.z=probe.z;
		} else {
			pos.x=nx;
			pos.z=nz;
		}
		pos.x=clamp(pos.x,-244,244);
		pos.z=clamp(pos.z,-244,168);
		this.mesh.rotation.y=this.heading;
		this.wheelSpin += this.speed * dt / 0.35;
		this.steerShown += (steer * 0.42 - this.steerShown) * Math.min(1,dt * 9);
		const { wheels,frontWheels }=this.mesh.userData;
		for (const wheel of wheels) wheel.rotation.x=this.wheelSpin;
		for (const wheel of frontWheels) wheel.rotation.y=this.steerShown;
	}
}

// Traffic: grid-following drivers. They run avenues end to end,
// turn at crossings when the mood takes them, and recycle to a
// fresh street when the player leaves them far behind.
export class TrafficCar extends DriveCar {
	constructor(kind,color,x,z,heading,rng) {
		super(kind,color,x,z,heading);
		this.rng=rng;
		this.cruise=8.5 + rng() * 4.5;
		this.dirX=Math.round(Math.sin(heading));
		this.dirZ=Math.round(Math.cos(heading));
		this.turnCooldown=2;
	}

	snapHeading() {
		return Math.atan2(this.dirX,this.dirZ);
	}

	respawnNear(focus) {
		const rng=this.rng;
		if (rng() < 0.55) {
			const x=pickRoadInBand(focus.x,ROAD_X,RECYCLE_MIN * 0.4,RECYCLE_MAX);
			const z=clamp(focus.z + (rng() < 0.5 ? -1 : 1) * (70 + rng() * 110),-224,132);
			this.dirX=0;
			this.dirZ=rng() < 0.5 ? 1 : -1;
			this.placeAt(x + (this.dirZ > 0 ? 3 : -3),z,this.snapHeading());
		} else {
			const z=pickRoadInBand(focus.z,ROAD_Z,RECYCLE_MIN * 0.4,RECYCLE_MAX);
			const x=clamp(focus.x + (rng() < 0.5 ? -1 : 1) * (70 + rng() * 110),-224,224);
			this.dirZ=0;
			this.dirX=rng() < 0.5 ? 1 : -1;
			this.placeAt(x,z + (this.dirX > 0 ? -3 : 3),this.snapHeading());
		}
		this.speed=this.cruise * 0.6;
	}

	update(dt,focus,colliders,others) {
		const pos=this.mesh.position;
		const distFocus=Math.hypot(pos.x - focus.x,pos.z - focus.z);
		if (distFocus > RECYCLE_MAX) {
			this.respawnNear(focus);
			return;
		}
		this.turnCooldown -= dt;
		// Near a crossing street? Roll for a turn onto it.
		if (this.turnCooldown <= 0) {
			if (this.dirZ !== 0) {
				const cross=pickRoadInBand(pos.z,ROAD_Z,0,4.5);
				if (Math.abs(cross - pos.z) < 4.5 && this.rng() < 0.4) {
					this.dirX=this.rng() < 0.5 ? 1 : -1;
					this.dirZ=0;
					this.turnCooldown=3;
				}
			} else {
				const cross=pickRoadInBand(pos.x,ROAD_X,0,4.5);
				if (Math.abs(cross - pos.x) < 4.5 && this.rng() < 0.4) {
					this.dirZ=this.rng() < 0.5 ? 1 : -1;
					this.dirX=0;
					this.turnCooldown=3;
				}
			}
			// Keep inside the bay: turn back at the rim avenues.
			if (pos.x < -206 || pos.x > 210 || pos.z < -224 || pos.z > 132) {
				this.dirX=-this.dirX;
				this.dirZ=-this.dirZ;
				this.turnCooldown=3;
			}
		}
		// Lane discipline: hold the right side of the street.
		const laneX=this.dirZ !== 0 ? Math.round(pos.x) : 0;
		const desired=Math.atan2(this.dirX,this.dirZ);
		const diff=wrapAngle(desired - this.heading);
		let steer=clamp(diff * 2.4,-1,1);
		if (this.dirZ !== 0) steer += clamp((laneSnap(pos.x,this.dirZ) - pos.x) * 0.04,-0.3,0.3);
		let throttle=this.speed < this.cruise ? 0.75 : 0;
		for (const other of others) {
			if (other === this) continue;
			const op=other.mesh.position;
			const ahead=(op.x - pos.x) * this.dirX + (op.z - pos.z) * this.dirZ;
			const side=Math.abs((op.x - pos.x) * this.dirZ - (op.z - pos.z) * this.dirX);
			if (ahead > 0 && ahead < 8 && side < 2.4) {
				throttle=ahead < 4.5 ? -0.5 : 0;
				break;
			}
		}
		this.drive(dt,throttle,steer,false,colliders);
	}
}

function laneSnap(value,dirZ) {
	let best=value;
	let bestDist=Infinity;
	for (const x of ROAD_X) {
		const lane=x + (dirZ > 0 ? 3 : -3);
		const d=Math.abs(lane - value);
		if (d < bestDist) {
			bestDist=d;
			best=lane;
		}
	}
	return best;
}

const PARKED_SPOTS=[
	['coupe',0x0f7f8c,-18.9,-44,Math.PI],
	['sedan',0xf5efe0,24,133.5,Math.PI / 2],
	['hatch',0xffd166,108,57.5,0],
	['sedan',0xa8dadc,-64,17.5,Math.PI / 2],
	['truck',0x8c9a5b,118,72,Math.PI],
	['sport',0xef476f,60,-70.5,Math.PI / 2],
	['coupe',0x06d6a0,152.5,30,0],
	['sedan',0xc0c6ce,-44,-151.5,Math.PI / 2],
	['hatch',0xff8c42,-106.5,-50,0],
	['van',0xf7c873,30,146.5,-Math.PI / 2],
	['sedan',0x7d8f57,98.5,-52,Math.PI],
	['coupe',0xb3271e,-205,-51.5,Math.PI / 2],
	['sport',0x39b5c4,208.5,20,Math.PI],
	['hatch',0xe8b45a,14,58,-Math.PI / 2],
];

export function createParkedCars(scene) {
	const cars=[];
	for (const [kind,color,x,z,heading] of PARKED_SPOTS) {
		const car=new DriveCar(kind,color,x,z,heading);
		scene.add(car.mesh);
		cars.push(car);
	}
	return cars;
}

const TRAFFIC_KINDS=['sedan','hatch','coupe','sedan','van','sedan','hatch','truck','coupe','sedan','hatch'];
const TRAFFIC_COLORS=[0xd9261c,0xffd166,0x06d6a0,0xef476f,0xff8c42,0xa8dadc,0xc94f3d,0xf5efe0,0x39b5c4,0x8c9a5b,0xe8b45a];

export function createTraffic(scene) {
	const rng=createSeededRandom(20240);
	const cars=[];
	for (let i=0; i < TRAFFIC_KINDS.length; i += 1) {
		let car;
		if (i % 2 === 0) {
			const x=ROAD_X[(i * 3 + 1) % ROAD_X.length];
			const z=-210 + (i * 67) % 330;
			const dir=i % 4 === 0 ? 1 : -1;
			car=new TrafficCar(TRAFFIC_KINDS[i],TRAFFIC_COLORS[i],x + (dir > 0 ? 3 : -3),z,dir > 0 ? 0 : Math.PI,rng);
		} else {
			const z=ROAD_Z[i % ROAD_Z.length];
			const x=-190 + (i * 83) % 380;
			const dir=i % 3 === 0 ? -1 : 1;
			car=new TrafficCar(TRAFFIC_KINDS[i],TRAFFIC_COLORS[i],x,z + (dir > 0 ? -3 : 3),dir > 0 ? Math.PI / 2 : -Math.PI / 2,rng);
		}
		car.speed=car.cruise * 0.7;
		scene.add(car.mesh);
		cars.push(car);
	}
	return cars;
}

export function nearestCar(cars,position,maxDistance) {
	let best=null;
	let bestDist=maxDistance;
	for (const car of cars) {
		const d=Math.hypot(car.mesh.position.x - position.x,car.mesh.position.z - position.z);
		if (d < bestDist) {
			bestDist=d;
			best=car;
		}
	}
	return best;
}
