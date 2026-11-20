// Vehicles: factory, arcade driving, traffic, parked — 12 on the road, 15 parked.

import * as THREE from 'three';
import { ROAD_X,ROAD_Z,resolveCollisions,pickRoadInBand } from './city.js';
import { RECYCLE_MIN,RECYCLE_MAX } from './config.js';
import { mergeGeometries,paintParts } from './merge.js';

export const CAR_KINDS={
	sedan: { length: 4.4,width: 1.9,height: 0.62,topSpeed: 34,accel: 15,grip: 3.4,label: 'Solmar Sedan' },
	sport: { length: 4.2,width: 1.95,height: 0.5,topSpeed: 46,accel: 22,grip: 3.9,label: 'Rayo Coupe' },
	van: { length: 5.2,width: 2.1,height: 1.05,topSpeed: 27,accel: 11,grip: 2.8,label: 'Portside Van' },
	police: { length: 4.5,width: 1.95,height: 0.6,topSpeed: 42,accel: 20,grip: 3.8,label: 'Solmar Patrol' },
};

const PAINT_COLORS=[0xe84f6a,0x39b5c4,0xf7c873,0xf2f2f2,0xb3271e,0xd9261c,0xff8c42,0xd9a441];

const glassMaterial=new THREE.MeshPhongMaterial({ color: 0x18293e,shininess: 140,specular: 0xaaccee });
const trimMaterial=new THREE.MeshLambertMaterial({ color: 0x1d1f26 });
const chromeMaterial=new THREE.MeshPhongMaterial({ color: 0xd8dde6,shininess: 120 });
const lightMaterial=new THREE.MeshBasicMaterial({ color: 0xfff0b3 });
const goldMaterial=new THREE.MeshPhongMaterial({ color: 0xd9a441,shininess: 90,specular: 0xffe9a8 });
const tailMaterial=new THREE.MeshBasicMaterial({ color: 0xff3b4e });

function makePatrolDecal() {

	const canvas=document.createElement('canvas');
	canvas.width=256;
	canvas.height=128;
	const ctx=canvas.getContext('2d');
	ctx.fillStyle='#f4f6f8';
	ctx.fillRect(0,0,256,128);
	ctx.fillStyle='#0f7f8c';
	ctx.fillRect(0,88,256,40);
	ctx.fillStyle='#123a5c';
	ctx.font='bold 34px Verdana, sans-serif';
	ctx.textAlign='center';
	ctx.fillText('PATROL',128,58);
	const texture=new THREE.CanvasTexture(canvas);
	texture.colorSpace=THREE.SRGBColorSpace;
	return new THREE.MeshBasicMaterial({ map: texture });
}
let patrolDecalMaterial=null;

function xform(geometry,x,y,z,rx=0,ry=0,rz=0) {
	if (rx || ry || rz) geometry.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx,ry,rz)));
	geometry.translate(x,y,z);
	return geometry;
}

function box(w,h,d,material,x,y,z,castShadow=false) {
	const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
	mesh.position.set(x,y,z);
	if (castShadow) mesh.castShadow=true;
	return mesh;
}

const wheelMaterial=new THREE.MeshPhongMaterial({ vertexColors: true,shininess: 55,specular: 0x555555 });
const wheelGeometryCache=new Map();
function makeWheel(radius) {
	if (!wheelGeometryCache.has(radius)) {
		const parts=[];
		const tyre=new THREE.CylinderGeometry(radius,radius,0.27,18);
		tyre.rotateZ(Math.PI / 2);
		parts.push(paintParts(tyre,0x14151a));
		const hub=new THREE.CylinderGeometry(radius * 0.55,radius * 0.55,0.29,12);
		hub.rotateZ(Math.PI / 2);
		parts.push(paintParts(hub,0xc8ccd4));
		for (let i=0; i < 5; i += 1) {
			const angle=(i / 5) * Math.PI * 2;
			const spoke=new THREE.BoxGeometry(0.31,radius * 0.52,radius * 0.13);
			spoke.rotateX(Math.PI / 2 - angle);
			spoke.translate(0,Math.sin(angle) * radius * 0.27,Math.cos(angle) * radius * 0.27);
			parts.push(paintParts(spoke,0x1d1f26));
		}
		wheelGeometryCache.set(radius,mergeGeometries(parts));
	}
	const wheel=new THREE.Mesh(wheelGeometryCache.get(radius),wheelMaterial);
	wheel.castShadow=true;
	return wheel;
}

export function createCarMesh(kind,color) {
	const spec=CAR_KINDS[kind];
	const { width: w,length: l }=spec;
	const group=new THREE.Group();
	const paint=new THREE.MeshPhongMaterial({ color,shininess: 85,specular: 0x999999 });
	const isVan=kind === 'van';
	const bodyBase=isVan ? 0.42 : 0.5;
	const bodyH=isVan ? 1.5 : spec.height;
	const bodyTop=bodyBase + bodyH;

	const buckets=new Map();
	function bucketFor(material,cast) {
		const key=`${material.uuid}|${cast ? 1 : 0}`;
		if (!buckets.has(key)) buckets.set(key,{ material,cast,geos: [] });
		return buckets.get(key).geos;
	}
	function part(material,bw,bh,bd,x,y,z,opts={}) {
		bucketFor(material,Boolean(opts.cast)).push(
			xform(new THREE.BoxGeometry(bw,bh,bd),x,y,z,opts.rx || 0,opts.ry || 0,opts.rz || 0),
		);
	}
	function planePart(material,pw,ph,x,y,z,ry) {
		bucketFor(material,false).push(xform(new THREE.PlaneGeometry(pw,ph),x,y,z,0,ry,0));
	}

	part(paint,w,bodyH,l,0,bodyBase + bodyH / 2,0,{ cast: true });
	part(trimMaterial,w + 0.04,0.16,l * 0.86,0,0.3,0);
	part(trimMaterial,w * 0.96,0.2,0.22,0,0.52,l / 2 + 0.05);
	part(trimMaterial,w * 0.96,0.2,0.22,0,0.52,-l / 2 - 0.05);
	part(chromeMaterial,w * 0.7,0.07,0.05,0,0.86,l / 2 + 0.02);

	if (isVan) {

		part(glassMaterial,w * 0.86,0.62,0.06,0,bodyTop - 0.28,l / 2 - 0.18,{ rx: -0.42 });
		part(new THREE.MeshPhongMaterial({ color: 0xf2f2f2,shininess: 40 }),w * 0.7,0.16,l * 0.4,0,bodyTop + 0.08,-0.2);
		for (const sx of [-1,1]) {
			part(trimMaterial,0.04,0.05,l * 0.52,sx * (w / 2 + 0.01),1.28,-0.3);
			part(trimMaterial,0.04,0.62,0.05,sx * (w / 2 + 0.01),0.95,l * 0.08);
			part(glassMaterial,0.04,0.4,0.7,sx * (w / 2 + 0.01),bodyTop - 0.32,l * 0.32);
		}
		part(glassMaterial,w * 0.68,0.46,0.05,0,bodyTop - 0.34,-l / 2 - 0.01);
		part(trimMaterial,0.05,bodyH * 0.8,0.04,0,bodyBase + bodyH / 2,-l / 2 - 0.01);

		for (const sx of [-1,1]) {
			part(glassMaterial,0.04,0.44,l * 0.52,sx * (w / 2 + 0.01),bodyTop - 0.3,l * 0.08);
			part(trimMaterial,0.04,0.15,l * 0.84,sx * (w / 2 + 0.01),0.92,0);
		}
		part(chromeMaterial,0.52,0.3,0.04,0,0.62,-l / 2 - 0.02);
	} else {

		const hoodY=bodyTop - 0.06;
		part(paint,w * 0.92,0.1,l * 0.3,0,hoodY,l * 0.33,{ cast: true });
		part(paint,w * 0.92,0.09,l * 0.2,0,hoodY - 0.02,-l * 0.38);
		const cabinH=kind === 'sport' ? 0.44 : 0.52;
		const cabinZ=kind === 'sport' ? -l * 0.08 : -l * 0.04;
		part(glassMaterial,w * 0.8,cabinH,l * 0.44,0,bodyTop + cabinH / 2 - 0.04,cabinZ,{ cast: true });
		part(paint,w * 0.72,0.06,l * 0.3,0,bodyTop + cabinH + 0.0,cabinZ);
		part(glassMaterial,w * 0.76,cabinH * 0.92,0.05,0,bodyTop + cabinH / 2 - 0.02,cabinZ + l * 0.235,{ rx: -0.38 });
		part(glassMaterial,w * 0.76,cabinH * 0.85,0.05,0,bodyTop + cabinH / 2 - 0.02,cabinZ - l * 0.235,{ rx: 0.34 });
		for (const sx of [-1,1]) {
			part(paint,0.16,0.09,0.06,sx * (w / 2 + 0.07),bodyTop + 0.28,cabinZ + l * 0.2);
		}
		if (kind === 'sport') {
			for (const sx of [-1,1]) {
				part(trimMaterial,0.2,0.03,l * 0.86,sx * 0.22,bodyTop + 0.05,0);
				part(trimMaterial,0.07,0.22,0.07,sx * w * 0.32,bodyTop + 0.18,-l / 2 + 0.32);
			}
			part(paint,w * 0.92,0.06,0.42,0,bodyTop + 0.3,-l / 2 + 0.32,{ cast: true });
		}
		if (kind === 'police') {
			part(trimMaterial,w * 0.92,0.04,l * 0.3,0,hoodY + 0.06,l * 0.33);
			if (!patrolDecalMaterial) patrolDecalMaterial=makePatrolDecal();
			for (const sx of [-1,1]) {
				planePart(patrolDecalMaterial,1.7,0.85,sx * (w / 2 + 0.012),0.82,0.1,sx > 0 ? Math.PI / 2 : -Math.PI / 2);
			}
			part(trimMaterial,w * 0.8,0.3,0.14,0,0.48,l / 2 + 0.2);
		}
	}

	for (const sx of [-1,1]) {
		part(lightMaterial,0.36,0.13,0.06,sx * w * 0.3,0.74,l / 2 + 0.13);
		if (kind !== 'sport') {

			if (isVan) part(tailMaterial,0.16,0.52,0.06,sx * w * 0.4,0.98,-l / 2 - 0.13);
			else part(tailMaterial,0.36,0.13,0.06,sx * w * 0.3,0.8,-l / 2 - 0.13);
		}
	}
	if (kind === 'sport') part(tailMaterial,w * 0.8,0.11,0.06,0,0.78,-l / 2 - 0.13);
	for (const sx of [-1,1]) part(goldMaterial,0.03,0.09,l * 0.7,sx * (w / 2 + 0.01),0.98,0);
	part(chromeMaterial,0.46,0.12,0.03,0,0.6,-l / 2 - 0.14);

	for (const bucket of buckets.values()) {
		const mesh=new THREE.Mesh(mergeGeometries(bucket.geos),bucket.material);
		if (bucket.cast) mesh.castShadow=true;
		group.add(mesh);
	}

	const wheelRadius=kind === 'sport' ? 0.39 : 0.37;
	const wheels=[];
	for (const sz of [-1,1]) {
		for (const sx of [-1,1]) {
			const wheel=makeWheel(wheelRadius);
			wheel.position.set(sx * (w / 2 - 0.02),wheelRadius,sz * (l / 2 - 0.85));
			group.add(wheel);
			wheels.push(wheel);
		}
	}
	if (kind === 'police') {
		const bar=new THREE.Group();
		bar.add(box(1.15,0.07,0.34,trimMaterial,0,0,0));
		bar.add(box(0.52,0.15,0.3,new THREE.MeshBasicMaterial({ color: 0xff3344 }),-0.29,0.1,0));
		bar.add(box(0.52,0.15,0.3,new THREE.MeshBasicMaterial({ color: 0x3388ff }),0.29,0.1,0));
		bar.position.set(0,bodyTop + 0.62,-l * 0.04);
		group.add(bar);
		group.userData.lightBar=bar;
	}
	group.userData.wheels=wheels;
	return group;
}

export class DriveCar {
	constructor(kind,color,x,z,heading) {
		this.kind=kind;
		this.spec=CAR_KINDS[kind];
		this.mesh=createCarMesh(kind,color);
		this.mesh.position.set(x,0,z);
		this.heading=heading;
		this.speed=0;
		this.steer=0;
		this.health=100;
		this.occupied=false;
		this.mesh.rotation.y=heading;
	}

	get position() {
		return this.mesh.position;
	}

	drive(dt,throttle,steerInput,handbrake,colliders) {
		const spec=this.spec;
		if (throttle > 0) this.speed += spec.accel * throttle * dt;
		else if (throttle < 0) this.speed += (this.speed > 0.5 ? -26 : -spec.accel * 0.55) * dt * -throttle;
		const drag=handbrake ? 3.2 : 0.55;
		this.speed -= this.speed * drag * dt * 0.35;
		if (!throttle) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed),3.5 * dt);
		this.speed=Math.max(-spec.topSpeed * 0.38,Math.min(spec.topSpeed,this.speed));
		this.steer += (steerInput * 0.62 - this.steer) * Math.min(1,dt * 7);
		const speedRatio=Math.min(1,Math.abs(this.speed) / 9);

		this.heading += this.steer * speedRatio * Math.sign(this.speed || 1) * dt * 1.55;
		this.mesh.position.x += Math.sin(this.heading) * this.speed * dt;
		this.mesh.position.z += Math.cos(this.heading) * this.speed * dt;
		const probe={ x: this.mesh.position.x,z: this.mesh.position.z };
		resolveCollisions(probe,1.55,colliders);
		if (Math.abs(probe.x - this.mesh.position.x) > 0.01 || Math.abs(probe.z - this.mesh.position.z) > 0.01) {
			const impact=Math.abs(this.speed);
			if (impact > 9) this.health=Math.max(5,this.health - (impact - 8));
			this.speed *= -0.18;
		}
		this.mesh.position.x=probe.x;
		this.mesh.position.z=probe.z;
		this.mesh.rotation.y=this.heading;
		const wheels=this.mesh.userData.wheels;
		for (let i=0; i < wheels.length; i += 1) {
			wheels[i].rotation.x += (this.speed * dt) / 0.36;
			if (i >= 2) wheels[i].rotation.y=this.steer * 0.5;
		}
		const bar=this.mesh.userData.lightBar;
		if (bar) bar.visible=Math.floor(performance.now() / 280) % 2 === 0;
		return Math.abs(this.speed);
	}

	placeAt(x,z,heading) {
		this.mesh.position.set(x,0,z);
		this.heading=heading;
		this.speed=0;
		this.mesh.rotation.y=heading;
	}
}

export class TrafficCar extends DriveCar {
	constructor(kind,color,roadIndex,direction,offset) {
		super(kind,color,0,0,0);
		this.vertical=direction % 2 === 0;
		const along=(this.vertical ? ROAD_X : ROAD_Z)[roadIndex % (this.vertical ? ROAD_X : ROAD_Z).length];
		this.sign=direction < 2 ? 1 : -1;
		this.lane=(this.vertical ? along : along) + (this.sign > 0 ? 2.9 : -2.9);
		this.progress=-170 + (offset * 52) % 330;
		this.cruiseSpeed=10 + (offset % 3) * 2.5;
		this.syncToRoad();
	}

	syncToRoad() {
		if (this.vertical) {
			this.mesh.position.set(this.lane,0,this.progress);
			this.heading=this.sign > 0 ? 0 : Math.PI;
		} else {
			this.mesh.position.set(this.progress,0,this.lane);
			this.heading=this.sign > 0 ? Math.PI / 2 : -Math.PI / 2;
		}
		this.mesh.rotation.y=this.heading;
	}

	respawnNear(focusX,focusZ) {

		this.vertical=Math.random() < 0.5;
		const crossRoads=this.vertical ? ROAD_X : ROAD_Z;
		const crossFocus=this.vertical ? focusX : focusZ;
		const road=pickRoadInBand(crossFocus,crossRoads,RECYCLE_MIN,RECYCLE_MAX);
		this.sign=Math.random() < 0.5 ? 1 : -1;
		this.lane=road + (this.sign > 0 ? 2.9 : -2.9);
		const alongFocus=this.vertical ? focusZ : focusX;
		const offset=Math.random() * 50;
		this.progress=alongFocus + (Math.random() < 0.5 ? -offset : offset);
		this.progress=Math.max(-240,Math.min(this.vertical ? 142 : 240,this.progress));
		this.speed=this.cruiseSpeed;
		this.syncToRoad();
	}

	updateTraffic(dt,others) {
		let target=this.cruiseSpeed;
		for (const other of others) {
			if (other === this) continue;
			const dx=other.mesh.position.x - this.mesh.position.x;
			const dz=other.mesh.position.z - this.mesh.position.z;
			const ahead=this.vertical ? dz * this.sign : dx * this.sign;
			const side=this.vertical ? Math.abs(dx) : Math.abs(dz);
			if (ahead > 0 && ahead < 9 && side < 2.2) target=Math.min(target,Math.max(0,(ahead - 5) * 1.6));
		}
		this.speed += Math.max(-18 * dt,Math.min(9 * dt,target - this.speed));
		this.progress += this.speed * dt * this.sign;

		const hi=this.vertical ? 142 : 240;
		const lo=240;
		if (this.progress > hi || this.progress < -lo) {
			this.vertical=!this.vertical;
			const crossAxis=this.vertical ? ROAD_X : ROAD_Z;
			const cross=crossAxis[Math.floor(Math.random() * crossAxis.length)];
			this.lane=cross + (this.sign > 0 ? 2.9 : -2.9);
			this.progress=this.sign > 0 ? -240 : (this.vertical ? 142 : 240);
		}
		this.syncToRoad();
	}
}

export function createParkedCars(scene) {
	const cars=[];
	const spots=[
		['sport',0xe84f6a,-15.1,-44,3.14],
		['sedan',0x39b5c4,12.9,30,0],
		['sedan',0xf7c873,70,67.1,-1.57],
		['van',0xf2f2f2,-68.9,-80,0],
		['sport',0x33415c,95.1,-44,0],
		['sedan',0x7bc47f,-21.1,96,3.14],
		['van',0xff8c42,44,112.9,1.57],
		['sedan',0xb388eb,-88,-61.1,1.57],
		['sedan',0x4a6fa5,-194.9,-96,0],
		['sport',0xd1603d,152.9,-120,3.14],
		['van',0x8a93a5,-173.7,64,0],
		['sedan',0x6a994e,152.9,20,3.14],
		['sedan',0xc9a227,-60,-154.9,1.57],
		['sport',0x5b8c5a,84,-161.1,-1.57],
	];
	for (const [kind,color,x,z,heading] of spots) {
		const car=new DriveCar(kind,color,x,z,heading);
		scene.add(car.mesh);
		cars.push(car);
	}
	return cars;
}

export function createTraffic(scene) {
	const cars=[];
	const kinds=['sedan','sedan','sport','van','sedan','sedan','sport','sedan','sedan','van','sedan','sport'];
	for (let i=0; i < kinds.length; i += 1) {
		const car=new TrafficCar(kinds[i],PAINT_COLORS[i % PAINT_COLORS.length],i,i % 4,i * 0.9 + 0.4);
		scene.add(car.mesh);
		cars.push(car);
	}
	return cars;
}

export function nearestCar(cars,position,maxDistance) {
	let best=null;
	let bestDist=maxDistance;
	for (const car of cars) {
		const dx=car.mesh.position.x - position.x;
		const dz=car.mesh.position.z - position.z;
		const dist=Math.hypot(dx,dz);
		if (dist < bestDist) {
			bestDist=dist;
			best=car;
		}
	}
	return best;
}
