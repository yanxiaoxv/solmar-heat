// figures.js — shared builder for jointed human character figures.
// Human figures: one shared builder (merged core, jointed limbs).

import * as THREE from 'three';
import { mergeGeometries,paintParts } from './merge.js';

const SKIN_TONES=[0xc98a5e,0x8d5a3a,0xe8b48c,0x6e4226,0xa06a42];
const HAIR_COLORS=[0x241a12,0x3a2415,0x120e0c,0x5a4020,0x2e2e33];

export function skinTone(index) {
	return SKIN_TONES[index % SKIN_TONES.length];
}

export function hairColor(index) {
	return HAIR_COLORS[index % HAIR_COLORS.length];
}

const figureMaterial=new THREE.MeshLambertMaterial({ vertexColors: true });

export function createHumanFigure({ shirt,skin,pants,hair,dress=false }) {
	const group=new THREE.Group();

	const core=[];
	const torso=new THREE.CylinderGeometry(0.205,0.155,0.62,10);
	torso.scale(1,1,0.68);
	torso.translate(0,1.1,0);
	core.push(paintParts(torso,shirt));
	const shoulders=new THREE.CapsuleGeometry(0.115,0.3,3,8);
	shoulders.scale(1,1,0.72);
	shoulders.rotateZ(Math.PI / 2);
	shoulders.translate(0,1.38,0);
	core.push(paintParts(shoulders,shirt));
	if (dress) {
		const skirt=new THREE.CylinderGeometry(0.17,0.3,0.5,10,1,true);
		skirt.translate(0,0.72,0);
		core.push(paintParts(skirt,shirt));
	}
	const neck=new THREE.CylinderGeometry(0.06,0.07,0.12,8);
	neck.translate(0,1.47,0);
	core.push(paintParts(neck,skin));
	const head=new THREE.SphereGeometry(0.2,14,11);
	head.scale(1,1.12,1);
	head.translate(0,1.7,0);
	core.push(paintParts(head,skin));
	const hairCap=new THREE.SphereGeometry(0.212,14,9,0,Math.PI * 2,0,Math.PI * 0.58);
	hairCap.scale(1,1.1,1);
	hairCap.translate(0,1.715,-0.018);
	core.push(paintParts(hairCap,hair));
	const coreMesh=new THREE.Mesh(mergeGeometries(core),figureMaterial);
	coreMesh.castShadow=true;
	group.add(coreMesh);

	function makeArm(side) {
		const sleeve=new THREE.CylinderGeometry(0.062,0.058,0.24,8);
		sleeve.translate(0,-0.12,0);
		const forearm=new THREE.CylinderGeometry(0.048,0.042,0.34,8);
		forearm.translate(0,-0.4,0);
		const hand=new THREE.SphereGeometry(0.055,8,6);
		hand.translate(0,-0.6,0);
		const mesh=new THREE.Mesh(mergeGeometries([
			paintParts(sleeve,shirt),paintParts(forearm,skin),paintParts(hand,skin),
		]),figureMaterial);
		mesh.position.set(side * 0.31,1.37,0);
		mesh.castShadow=true;
		group.add(mesh);
		return mesh;
	}

	function makeLeg(side) {
		const thigh=new THREE.CylinderGeometry(0.076,0.06,0.4,8);
		thigh.translate(0,-0.2,0);
		const hip=new THREE.Mesh(paintParts(thigh,dress ? skin : pants),figureMaterial);
		hip.position.set(side * 0.11,0.82,0);
		hip.castShadow=true;
		const shin=new THREE.CylinderGeometry(0.054,0.044,0.38,8);
		shin.translate(0,-0.19,0);
		const shoe=new THREE.BoxGeometry(0.13,0.08,0.27);
		shoe.translate(0,-0.4,0.045);
		const knee=new THREE.Mesh(mergeGeometries([
			paintParts(shin,dress ? skin : pants),paintParts(shoe,0x22242c),
		]),figureMaterial);
		knee.position.set(0,-0.4,0);
		hip.add(knee);
		group.add(hip);
		return { hip,knee };
	}

	const armL=makeArm(-1);
	const armR=makeArm(1);
	const left=makeLeg(-1);
	const right=makeLeg(1);
	group.userData.limbs={ armL,armR,legL: left.hip,legR: right.hip,shinL: left.knee,shinR: right.knee };
	return group;
}
