// Screenshot staging via ?shot= scenes.

import * as THREE from 'three';
import { LANDMARKS } from './city.js';
import { MODE_DRIVE,MODE_FOOT,MODE_MENU } from './state.js';

function landmark(id) {
	return LANDMARKS.find((entry) => entry.id === id);
}

function metres(a,b) {
	return Math.round(Math.hypot(a.x - b.x,a.z - b.z));
}

export function stageShot(name,world,state,camera) {
	const { player }=world;
	if (name === 'drive') {
		state.mode=MODE_DRIVE;
		state.missionIndex=1;
		state.missionStage=1;
		state.cash=470;
		const van=world.parkedCars.find((car) => car.kind === 'van') ?? world.parkedCars[0];

		van.placeAt(154,62,0);
		van.speed=15;
		player.setVisible(false);
		player.mesh.position.copy(van.mesh.position);
		world.missions.refreshBeacon(state);
		const hotel=landmark('hotel');
		camera.pin(
			new THREE.Vector3(148.5,4,46),
			new THREE.Vector3(155.5,1,70),
		);
		return {
			mode: MODE_DRIVE,
			car: van,
			objective: `Job 2 · Portside Rush — Deliver to Hotel Brisa (${metres(van.mesh.position,hotel)} m) · 0:47 left`,
			missionTarget: hotel,
			prompt: '',
		};
	}
	if (name === 'chase') {
		state.mode=MODE_DRIVE;
		state.missionIndex=2;
		state.missionStage=1;
		state.wanted=3;
		state.cash=890;
		const car=world.parkedCars[0];
		car.placeAt(-22,18,Math.PI);
		car.speed=21;
		player.setVisible(false);
		player.mesh.position.copy(car.mesh.position);

		world.stagePolice(3,{ x: car.mesh.position.x,z: car.mesh.position.z,heading: car.heading });

		const extra=world.traffic[0];
		extra.vertical=true;
		extra.sign=-1;
		extra.lane=-22 - 2.9;
		extra.progress=5;
		extra.syncToRoad();
		const walkerA=world.pedestrians[0];
		walkerA.vertical=true;
		walkerA.line=-22 - 8.7;
		walkerA.progress=2;
		walkerA.sign=1;
		walkerA.syncPosition();
		const walkerB=world.pedestrians[1];
		walkerB.vertical=true;
		walkerB.line=-22 + 8.7;
		walkerB.progress=-12;
		walkerB.sign=-1;
		walkerB.syncPosition();
		world.missions.refreshBeacon(state);
		const garage=landmark('garage');

		camera.pin(
			new THREE.Vector3(car.mesh.position.x + 3,8,car.mesh.position.z + 26),
			new THREE.Vector3(car.mesh.position.x - 1,1.2,car.mesh.position.z - 10),
		);
		return {
			mode: MODE_DRIVE,
			car,
			objective: `Job 3 · Heat Run — Reach Rayo Garage (${metres(car.mesh.position,garage)} m) and shake the patrol`,
			missionTarget: garage,
			prompt: '',
		};
	}
	if (name === 'menu') {
		state.mode=MODE_MENU;
		player.placeAt(22,132,Math.PI);
		camera.pin(
			new THREE.Vector3(10,5.5,118),
			new THREE.Vector3(26,1.5,150),
		);
		return { mode: MODE_MENU,car: null,objective: '',missionTarget: null,prompt: '' };
	}

	state.mode=MODE_FOOT;
	state.missionIndex=3;
	state.missionStage=1;
	state.rivalsDown=0;
	state.cash=1310;
	const hotel=landmark('hotel');
	player.placeAt(hotel.x + 1,hotel.z + 13,Math.PI);
	world.missions.stageShowdownAt(state,hotel.x,hotel.z + 4);
	world.missions.refreshBeacon(state);
	camera.pin(
		new THREE.Vector3(hotel.x + 3.5,3.4,hotel.z + 23.5),
		new THREE.Vector3(hotel.x - 2,1.3,hotel.z + 2),
	);
	return {
		mode: MODE_FOOT,
		car: null,
		objective: 'Job 4 · Brisa Showdown — Shove the Brisa crew (0/3)',
		missionTarget: hotel,
		prompt: 'Click — Shove the crew',
	};
}
