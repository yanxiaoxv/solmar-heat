// world.js — the world simulation step advancing every actor together.
// The world step: city, Nico, traffic, pedestrians, the Patrol and
// the story, advanced together. main.js owns the frame; this module
// owns everything inside it.

import * as THREE from 'three';
import { buildCity } from './city.js';
import { Player } from './player.js';
import { DriveCar,createParkedCars,createTraffic,nearestCar } from './vehicles.js';
import { createPedestrians,scareCrowd } from './pedestrians.js';
import { PoliceUnit,spawnPointNear } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { MODE_DRIVE,MODE_FOOT,MODE_BUSTED,MODE_WASTED,addWanted,showMessage } from './state.js';
import { SUN_COLOR,SUN_DIRECTION,SUN_INTENSITY,SHADOW_HALF,RING_MID,RING_FAR,RING_MID_STEP,RECYCLE_SECONDS } from './config.js';

const SPAWN_X=-18;
const SPAWN_Z=-14;
const GOLD_COLOR=0xd8a928;
const INTERACT_RANGE=3.8;

export function createWorld(scene,seed=7,hooks={}) {
	const city=buildCity(scene,seed);
	const player=new Player(scene,SPAWN_X,SPAWN_Z);
	const parkedCars=createParkedCars(scene);
	const trafficCars=createTraffic(scene);
	const pedestrians=createPedestrians(scene);
	const combat=createCombat();
	const missions=createMissions(scene,hooks);
	const policeUnits=[];

	let currentCar=null;
	let allCarsCache=null;
	let spawnTimer=2.2;
	let ringTimer=0;
	let recycleTimer=0;
	let goldSpawned=false;
	let lastFootSpeed=0;
	let prevAttack=false;
	let bustInfo=null;

	function allCars() {
		if (!allCarsCache || allCarsCache.length !== parkedCars.length + trafficCars.length) {
			allCarsCache=parkedCars.concat(trafficCars);
		}
		return allCarsCache;
	}
	function focus() {
		return currentCar ? currentCar.mesh.position : player.mesh.position;
	}
	function focusHeading() {
		return currentCar ? currentCar.heading : player.heading;
	}
	function focusSpeed() {
		return currentCar ? currentCar.speed : lastFootSpeed;
	}

	function enterCar(car,state,camera) {
		currentCar=car;
		state.mode=MODE_DRIVE;
		player.setVisible(false);
		player.mesh.position.copy(car.mesh.position);
		if (!car.owned) state.carsStolen += 1;
		showMessage(state,'WASD drives, Space is the handbrake, E steps out.');
		hooks.play?.('click');
		if (camera) camera.snapBehind(car.heading);
	}
	function exitCar(state,camera) {
		const car=currentCar;
		const sideX=Math.cos(car.heading);
		const sideZ=-Math.sin(car.heading);
		player.placeAt(car.mesh.position.x + sideX * 1.7,car.mesh.position.z + sideZ * 1.7,car.heading);
		player.setVisible(true);
		currentCar=null;
		state.mode=MODE_FOOT;
		if (camera) camera.snapBehind(player.heading);
	}
	// Shot staging and tests enter without the fanfare.
	function enterCarNow(car,state) {
		currentCar=car;
		state.mode=MODE_DRIVE;
		player.setVisible(false);
		player.mesh.position.copy(car.mesh.position);
	}

	function clearPolice() {
		for (const unit of policeUnits) unit.dispose(scene);
		policeUnits.length=0;
	}
	function spawnPolice(x,z,heading) {
		const unit=new PoliceUnit(scene,x,z,heading);
		policeUnits.push(unit);
		return unit;
	}

	function updatePolice(dt,state) {
		const f=focus();
		if (state.wanted <= 0) {
			if (policeUnits.length) clearPolice();
			return;
		}
		spawnTimer -= dt;
		const desired=Math.min(state.wanted,5);
		if (policeUnits.length < desired && spawnTimer <= 0) {
			spawnTimer=3.2;
			const sp=spawnPointNear(f,policeUnits.length);
			spawnPolice(sp.x,sp.z,sp.heading);
		}
		const target={ x: f.x,z: f.z,heading: focusHeading(),speed: focusSpeed() };
		for (let i=policeUnits.length - 1; i >= 0; i -= 1) {
			const unit=policeUnits[i];
			unit.update(dt,target,city.colliders,state.wanted);
			if (unit.gaveUp) {
				unit.dispose(scene);
				policeUnits.splice(i,1);
			}
		}
		// Out of sight, out of mind: the heat cools when no patrol
		// car is anywhere near.
		let nearest=Infinity;
		for (const unit of policeUnits) {
			const d=Math.hypot(unit.car.mesh.position.x - f.x,unit.car.mesh.position.z - f.z);
			if (d < nearest) nearest=d;
		}
		if (nearest > 42) {
			state.hideTimer += dt;
			if (state.hideTimer >= 14 && state.wanted > 0) {
				addWanted(state,-1);
				state.hideTimer=4;
				if (state.wanted === 0) showMessage(state,'You lost them. The bay forgets, for now.',3.5);
			}
		} else {
			state.hideTimer=0;
		}
	}

	function checkBusted(dt,state) {
		const f=focus();
		let boxed=false;
		let closeCount=0;
		for (const unit of policeUnits) {
			const d=Math.hypot(unit.car.mesh.position.x - f.x,unit.car.mesh.position.z - f.z);
			if (d < 9.5) {
				closeCount += 1;
				if (Math.abs(unit.car.speed) < 2.5) boxed=true;
			}
		}
		const trapped=state.mode === MODE_FOOT ? boxed : (Math.abs(focusSpeed()) < 1 && closeCount >= 2);
		if (trapped) state.bustedTimer += dt * 0.55;
		else state.bustedTimer=Math.max(0,state.bustedTimer - dt * 0.7);
		if (state.bustedTimer >= 2) {
			const stars=state.wanted;
			const fine=80 + stars * 70;
			state.cash=Math.max(0,state.cash - fine);
			bustInfo={
				title: 'BUSTED',
				text: `The Solmar Patrol boxed you in at ${stars} stars. Fine: $80 + ${stars} × $70 = $${fine}, and your name goes in their little book.`,
			};
			endRun(state,MODE_BUSTED);
			hooks.play?.('busted');
		}
	}

	function endRun(state,mode) {
		if (currentCar) {
			player.mesh.position.copy(currentCar.mesh.position);
			player.setVisible(true);
			currentCar=null;
		}
		state.mode=mode;
		state.wanted=0;
		state.bustedTimer=0;
		clearPolice();
	}

	function checkWasted(state) {
		if (state.health > 0) return;
		bustInfo={
			title: 'WASTED',
			text: 'The bay got the better of you this time. Walk it off, Nico.',
		};
		endRun(state,MODE_WASTED);
		hooks.play?.('busted');
	}

	function respawn(state) {
		state.health=100;
		state.armour=0;
		state.mode=MODE_FOOT;
		state.wanted=0;
		state.bustedTimer=0;
		clearPolice();
		player.placeAt(SPAWN_X,SPAWN_Z,Math.PI);
		player.setVisible(true);
		currentCar=null;
	}

	function updateZones(f) {
		for (const zone of city.zones) {
			const dx=Math.max(zone.minX - f.x,0,f.x - zone.maxX);
			const dz=Math.max(zone.minZ - f.z,0,f.z - zone.maxZ);
			const dist=Math.hypot(dx,dz);
			const visible=dist < RING_FAR;
			const casts=dist < RING_MID;
			zone.visible=visible;
			zone.shadowOn=casts;
			for (const mesh of zone.meshes) {
				mesh.visible=visible;
				if (mesh.userData.casts) mesh.castShadow=casts;
			}
		}
	}

	function update(dt,state,input,actions,camera) {
		city.update(dt);
		const f=focus();
		ringTimer -= dt;
		if (ringTimer <= 0) {
			ringTimer=RING_MID_STEP;
			updateZones(f);
		}
		// The gold coupe is part of the saved world, not of a play
		// session: it must exist from the first menu frame after a
		// reload, before anyone presses Start.
		if (state.garageOwned && !goldSpawned) {
			goldSpawned=true;
			const gold=new DriveCar('coupe',GOLD_COLOR,59.5,-66,Math.PI / 2);
			gold.owned=true;
			scene.add(gold.mesh);
			parkedCars.push(gold);
		}
		const playing=state.mode === MODE_FOOT || state.mode === MODE_DRIVE;
		if (!playing) return buildView(state,null);
		state.playSeconds += dt;

		const attackNow=input.isAttacking();
		const attackPressed=attackNow && !prevAttack;
		prevAttack=attackNow;

		if (state.mode === MODE_FOOT) {
			lastFootSpeed=player.updateOnFoot(dt,input.moveAxis(),camera.yaw,input.running(),city.colliders);
			combat.update(dt);
		} else {
			const axis=input.moveAxis();
			currentCar.drive(dt,-axis.z,axis.x,input.handbrake(),city.colliders);
			player.mesh.position.copy(currentCar.mesh.position);
			player.heading=currentCar.heading;
			const pace=Math.abs(currentCar.speed);
			if (pace > state.topSpeed) state.topSpeed=pace;
		}

		if (actions & 1) {
			if (state.mode === MODE_FOOT) {
				const car=nearestCar(allCars(),player.mesh.position,INTERACT_RANGE);
				if (car) enterCar(car,state,camera);
			} else {
				exitCar(state,camera);
			}
		}

		for (const car of trafficCars) car.update(dt,f,city.colliders,allCars());

		let danger=null;
		if (currentCar && Math.abs(currentCar.speed) > 8) {
			danger={ x: f.x,z: f.z,radius: 10 };
		}
		for (const person of pedestrians) person.update(dt,danger);
		recycleTimer += dt;
		if (recycleTimer >= RECYCLE_SECONDS) {
			recycleTimer=0;
			for (const person of pedestrians) {
				if (Math.hypot(person.mesh.position.x - f.x,person.mesh.position.z - f.z) > 185) {
					person.respawnNear(f.x,f.z);
				}
			}
		}

		const rivalsBefore=state.rivalsDown;
		missions.update(dt,{
			state,
			focus: { x: f.x,z: f.z },
			mode: state.mode,
			attackPressed,
			playerHeading: player.heading,
		});
		if (attackPressed && state.mode === MODE_FOOT && state.rivalsDown === rivalsBefore) {
			const hit=combat.tryAttack(player,pedestrians,allCars());
			if (hit) {
				hooks.play?.(hit.kind === 'car' ? 'bump' : 'thud');
				if (hit.kind === 'pedestrian') {
					scareCrowd(pedestrians,f.x,f.z,9);
					addWanted(state,1);
					showMessage(state,'Shoving strangers is still a crime here.',2.6);
				}
			}
		}

		updatePolice(dt,state);
		checkBusted(dt,state);
		checkWasted(state);

		let prompt='';
		if (state.mode === MODE_FOOT) {
			const car=nearestCar(allCars(),player.mesh.position,INTERACT_RANGE);
			if (car) prompt=`E — Get in the ${car.name}`;
		}
		return buildView(state,prompt);
	}

	function buildView(state,prompt) {
		const f=focus();
		return {
			playerPos: f,
			playerHeading: focusHeading(),
			cars: allCars(),
			police: policeUnits.map((unit) => unit.car),
			pedestrians,
			rivals: missions.rivals,
			missionTarget: missions.target,
			objective: missions.objectiveText,
			prompt: prompt ?? '',
			speedKmh: currentCar ? Math.abs(currentCar.speed) * 1.8 : 0,
		};
	}

	return {
		city,
		player,
		parkedCars,
		trafficCars,
		pedestrians,
		policeUnits,
		missions,
		combat,
		get currentCar() { return currentCar; },
		get bustInfo() { return bustInfo; },
		update,
		respawn,
		enterCarNow,
		spawnPolice,
		clearPolice,
	};
}

// Dusk light that travels with the player: a warm low sun whose
// shadow frustum stays centred on the action.
const SUN_VEC=new THREE.Vector3(...SUN_DIRECTION).normalize();

export function createSunlight(scene) {
	const sun=new THREE.DirectionalLight(SUN_COLOR,SUN_INTENSITY);
	sun.castShadow=true;
	sun.shadow.mapSize.set(2048,2048);
	sun.shadow.camera.left=-SHADOW_HALF;
	sun.shadow.camera.right=SHADOW_HALF;
	sun.shadow.camera.top=SHADOW_HALF;
	sun.shadow.camera.bottom=-SHADOW_HALF;
	sun.shadow.camera.near=10;
	sun.shadow.camera.far=460;
	sun.shadow.bias=-0.0006;
	scene.add(sun);
	scene.add(sun.target);
	const fill=new THREE.HemisphereLight(0xffd9b0,0x39586a,0.5);
	scene.add(fill);
	return sun;
}

export function anchorSunlight(sun,focus) {
	sun.position.set(focus.x + SUN_VEC.x * 200,SUN_VEC.y * 200,focus.z + SUN_VEC.z * 200);
	sun.target.position.set(focus.x,0,focus.z);
	sun.target.updateMatrixWorld();
}
