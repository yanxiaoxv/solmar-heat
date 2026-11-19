// World sim: city, player, cars, peds, stepped per frame.

import * as THREE from 'three';
import { buildCity,ROAD_X,ROAD_Z } from './city.js';
import { Player } from './player.js';
import { DriveCar,createParkedCars,createTraffic,nearestCar } from './vehicles.js';
import { createPedestrians,scareCrowd } from './pedestrians.js';
import { PoliceUnit,spawnPointNear } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { MODE_DRIVE,MODE_FOOT,MODE_BUSTED,MODE_WASTED,addWanted,showMessage } from './state.js';
import { SUN_COLOR,SUN_DIRECTION,SUN_INTENSITY,SHADOW_HALF,RING_NEAR,RING_MID,RING_FAR,RING_MID_STEP,RECYCLE_SECONDS } from './config.js';

export function createWorld(scene,seed=7) {
	const city=buildCity(scene,seed);
	const player=new Player(scene,-22 + 4,-14);
	const parkedCars=createParkedCars(scene);
	const traffic=createTraffic(scene);
	const pedestrians=createPedestrians(scene,22);
	const policeUnits=[];
	const combat=createCombat();
	const pendingEvents=[];
	let crimeCooldown=0;
	let runoverCooldown=0;
	let ramCooldown=0;
	let spawnClock=0;
	let hideNoticeShown=false;
	let calmSeconds=0;
	let lastHealth=100;
	let crimePrompt='';
	let goldCarSpawned=false;

	function spawnGoldCar() {
		if (goldCarSpawned) return;
		goldCarSpawned=true;
		const gold=new DriveCar('sport',0xf7c873,66 + 3.1,-52,0);
		scene.add(gold.mesh);
		parkedCars.push(gold);
		carsChanged();
	}

	const missions=createMissions(scene,{ onGarageOwned: spawnGoldCar });

	let allCarsCache=null;
	function getAllCars() {
		if (!allCarsCache) {
			allCarsCache=[...parkedCars,...traffic,...policeUnits.map((unit) => unit.car)];
		}
		return allCarsCache;
	}
	function carsChanged() {
		allCarsCache=null;
	}

	let currentCar=null;
	let driveHintShown=false;

	function ringStep(actor,dt,focus,step) {
		const dx=actor.mesh.position.x - focus.x;
		const dz=actor.mesh.position.z - focus.z;
		const d2=dx * dx + dz * dz;
		if (d2 > RING_MID * RING_MID) {
			actor.mesh.visible=false;
			return;
		}
		actor.mesh.visible=true;
		if (d2 <= RING_NEAR * RING_NEAR) {
			actor._lodAcc=0;
			step(dt);
			return;
		}
		actor._lodAcc=(actor._lodAcc || 0) + dt;
		if (actor._lodAcc >= RING_MID_STEP) {
			step(actor._lodAcc);
			actor._lodAcc=0;
		}
	}

	function applyZoneRings(focus) {
		for (const zone of city.zones) {
			const dx=Math.max(zone.minX - focus.x,0,focus.x - zone.maxX);
			const dz=Math.max(zone.minZ - focus.z,0,focus.z - zone.maxZ);
			const dist=Math.hypot(dx,dz);
			const shouldShow=dist <= RING_FAR;
			if (zone.visible !== shouldShow) {
				zone.visible=shouldShow;
				for (const mesh of zone.meshes) mesh.visible=shouldShow;
			}
			const shadows=dist <= RING_MID;
			if (zone.shadowOn !== shadows) {
				zone.shadowOn=shadows;
				for (const mesh of zone.meshes) if (mesh.userData.casts) mesh.castShadow=shadows;
			}
		}
	}

	let recycleClock=0;
	function recycleFarActors(dt,focus) {
		recycleClock += dt;
		if (recycleClock < RECYCLE_SECONDS) return;
		recycleClock=0;
		for (const car of traffic) {
			const dx=car.mesh.position.x - focus.x;
			const dz=car.mesh.position.z - focus.z;
			if (dx * dx + dz * dz > RING_MID * RING_MID) car.respawnNear(focus.x,focus.z);
		}
		for (const person of pedestrians) {
			const dx=person.mesh.position.x - focus.x;
			const dz=person.mesh.position.z - focus.z;
			if (dx * dx + dz * dz > RING_MID * RING_MID) person.respawnNear(focus.x,focus.z);
		}
	}

	function focusPosition(state) {
		if (state.mode === MODE_DRIVE && currentCar) return currentCar.mesh.position;
		return player.mesh.position;
	}

	function focusHeading(state) {
		if (state.mode === MODE_DRIVE && currentCar) return currentCar.heading;
		return player.heading;
	}

	function handleInteract(state) {
		if (state.mode === MODE_FOOT) {
			const car=nearestCar(getAllCars(),player.mesh.position,3.4);
			if (!car) return false;
			currentCar=car;
			car.occupied=true;
			if (traffic.includes(car)) {
				addWanted(state,1);
				state.carsStolen += 1;
				showMessage(state,'Vehicle taken! The owner called it in.');
				scareCrowd(pedestrians,car.mesh.position.x,car.mesh.position.z,12);
				const index=traffic.indexOf(car);
				traffic.splice(index,1);
				carsChanged();
			} else if (!car.everDriven) {
				state.carsStolen += 1;
				showMessage(state,`${car.spec.label} borrowed. Try not to scratch it.`);
			}
			car.everDriven=true;
			player.setVisible(false);
			state.mode=MODE_DRIVE;
			if (!driveHintShown) {
				driveHintShown=true;
				showMessage(state,'WASD drives, Space is the handbrake, E steps out.',5);
			}
			return true;
		}
		if (state.mode === MODE_DRIVE && currentCar) {
			const car=currentCar;
			car.occupied=false;
			const sideX=Math.cos(car.heading) * -1.8;
			const sideZ=Math.sin(car.heading) * 1.8;
			player.placeAt(car.mesh.position.x + sideX,car.mesh.position.z + sideZ,car.heading);
			player.setVisible(true);
			currentCar=null;
			state.mode=MODE_FOOT;
			return true;
		}
		return false;
	}

	function resolveCarBumps(state) {

		if (state.mode === MODE_DRIVE && currentCar) {
			for (const other of getAllCars()) {
				if (other === currentCar) continue;
				const dx=currentCar.mesh.position.x - other.mesh.position.x;
				const dz=currentCar.mesh.position.z - other.mesh.position.z;
				const dist=Math.hypot(dx,dz);
				if (dist > 0.01 && dist < 3.3) {
					const push=(3.3 - dist) / dist;
					currentCar.mesh.position.x += dx * push * 0.7;
					currentCar.mesh.position.z += dz * push * 0.7;
					if (Math.abs(currentCar.speed) > 8) {
						currentCar.health=Math.max(5,currentCar.health - 4);
						pendingEvents.push('bump');
						showMessage(state,'Careful! The car is taking damage.');
					}
					currentCar.speed *= 0.45;
				}
			}
		}
		if (state.mode === MODE_FOOT) {
			for (const car of traffic) {
				const dx=player.mesh.position.x - car.mesh.position.x;
				const dz=player.mesh.position.z - car.mesh.position.z;
				const dist=Math.hypot(dx,dz);
				if (dist > 0.01 && dist < 1.9) {
					player.mesh.position.x += (dx / dist) * (1.9 - dist);
					player.mesh.position.z += (dz / dist) * (1.9 - dist);
				}
			}
		}
	}

	function update(dt,state,input,cameraYaw) {
		city.update(dt);
		let prompt='';
		let speedKmh=0;
		let danger=null;

		if (state.mode === MODE_FOOT) {
			player.updateOnFoot(dt,input.moveAxis(),cameraYaw,input.running(),city.colliders);
			const car=nearestCar(getAllCars(),player.mesh.position,3.4);
			if (car) prompt=`E — Get in the ${car.spec.label}`;
		} else if (state.mode === MODE_DRIVE && currentCar) {
			const axis=input.moveAxis();
			const speed=currentCar.drive(dt,-axis.z,axis.x,input.handbrake(),city.colliders);
			speedKmh=speed * 3.6;
			state.topSpeed=Math.max(state.topSpeed,speedKmh);
			prompt='E — Step out';
			if (speed > 7) danger={ x: currentCar.mesh.position.x,z: currentCar.mesh.position.z,radius: 8 };
			player.mesh.position.copy(currentCar.mesh.position);
		}

		const focus=focusPosition(state);
		applyZoneRings(focus);
		for (const car of traffic) ringStep(car,dt,focus,(stepDt) => car.updateTraffic(stepDt,traffic));
		resolveCarBumps(state);
		for (const person of pedestrians) ringStep(person,dt,focus,(stepDt) => person.update(stepDt,danger));
		recycleFarActors(dt,focus);
		for (const car of parkedCars) {
			if (car === currentCar) {
				car.mesh.visible=true;
				continue;
			}
			const dx=car.mesh.position.x - focus.x;
			const dz=car.mesh.position.z - focus.z;
			car.mesh.visible=dx * dx + dz * dz <= RING_MID * RING_MID;
		}

		const missionView=missions.update(dt,state,{
			focus,
			player,
			attacking: input.isAttacking(),
		});
		for (const eventName of missionView.events) pendingEvents.push(eventName);
		updateCrimeAndPolice(dt,state,input);

		return {
			objective: missionView.objective,
			prompt: crimePrompt || prompt || missionView.prompt,
			speedKmh,
			missionTarget: missionView.missionTarget,
			playerPos: focus,
			playerHeading: focusHeading(state),
			cars: getAllCars(),
			police: policeUnits.map((unit) => unit.car),
			pedestrians,
			rivals: missionView.rivals,
		};
	}

	function policeDistanceTo(focus) {
		let nearest=Infinity;
		for (const unit of policeUnits) {
			const dist=Math.hypot(unit.position.x - focus.x,unit.position.z - focus.z);
			if (dist < nearest) nearest=dist;
		}
		return nearest;
	}

	function patrolCanSee(focus) {

		for (const unit of policeUnits) {
			const dx=focus.x - unit.position.x;
			const dz=focus.z - unit.position.z;
			const dist=Math.hypot(dx,dz);
			if (dist > 46) continue;
			let blocked=false;
			for (let step=1; step <= 5 && !blocked; step += 1) {
				const px=unit.position.x + (dx * step) / 6;
				const pz=unit.position.z + (dz * step) / 6;
				for (const box of city.colliders) {
					if (px > box.minX - 0.4 && px < box.maxX + 0.4 && pz > box.minZ - 0.4 && pz < box.maxZ + 0.4) {
						blocked=true;
						break;
					}
				}
			}
			if (!blocked) return true;
		}
		return false;
	}

	function updateCrimeAndPolice(dt,state,input) {

		if (crimeCooldown > 0) crimeCooldown -= dt;
		if (runoverCooldown > 0) runoverCooldown -= dt;
		if (ramCooldown > 0) ramCooldown -= dt;
		if (spawnClock > 0) spawnClock -= dt;
		combat.update(dt);
		const focus=focusPosition(state);
		crimePrompt='';

		if (state.mode === MODE_FOOT && input.isAttacking()) {
			const hit=combat.tryAttack(player,pedestrians,getAllCars());
			if (hit) {
				pendingEvents.push(hit.kind === 'car' ? 'bump' : 'thud');
				if (hit.kind === 'pedestrian') {
					hit.target.mesh.position.x += hit.dirX * 0.7 * hit.power;
					hit.target.mesh.position.z += hit.dirZ * 0.7 * hit.power;
					if (crimeCooldown <= 0 && patrolCanSee(focus)) {
						crimeCooldown=2.5;
						addWanted(state,1);
						showMessage(state,'The patrol saw that shove! Wanted level up.');
					}
				}
			}
		}

		if (state.mode === MODE_DRIVE && currentCar && Math.abs(currentCar.speed) > 4) {
			for (const person of pedestrians) {
				const dist=Math.hypot(person.mesh.position.x - focus.x,person.mesh.position.z - focus.z);
				if (dist < 1.6 && person.fallTimer <= 0) {
					person.knockDown();
					if (runoverCooldown <= 0) {
						runoverCooldown=3;
						addWanted(state,1);
						showMessage(state,'You hit a pedestrian! The patrol is coming.');
					}
				}
			}
		}

		const desired=Math.min(state.wanted,4);
		if (policeUnits.length < desired && spawnClock <= 0) {
			const spot=spawnPointNear(focus,policeUnits.length);
			policeUnits.push(new PoliceUnit(scene,spot.x,spot.z,spot.heading));
			carsChanged();
			spawnClock=0.9;
			if (policeUnits.length === 1) showMessage(state,'Sirens — the Solmar Patrol is rolling!');
		}
		while (policeUnits.length > desired) {
			const unit=policeUnits.pop();
			unit.dispose(scene);
			carsChanged();
		}
		const target={
			x: focus.x,
			z: focus.z,
			speed: state.mode === MODE_DRIVE && currentCar ? Math.abs(currentCar.speed) : 0,
			heading: focusHeading(state),
		};
		for (let i=policeUnits.length - 1; i >= 0; i -= 1) {
			const unit=policeUnits[i];
			unit.update(dt,target,city.colliders,state.wanted,{ x: ROAD_X,z: ROAD_Z });
			if (unit.gaveUp) {
				unit.dispose(scene);
				policeUnits.splice(i,1);
				carsChanged();
			}
		}

		if (state.mode === MODE_FOOT && ramCooldown <= 0) {
			for (const unit of policeUnits) {
				const dist=Math.hypot(unit.position.x - focus.x,unit.position.z - focus.z);
				if (dist < 2.2 && Math.abs(unit.car.speed) > 6) {
					ramCooldown=1.4;
					state.health=Math.max(0,state.health - 20);
					player.mesh.position.x += (focus.x - unit.position.x) * 0.9;
					player.mesh.position.z += (focus.z - unit.position.z) * 0.9;
					showMessage(state,'The patrol clipped you! Keep moving or give up distance.');
					break;
				}
			}
		}

		const seen=state.wanted > 0 && patrolCanSee(focus);
		if (state.wanted > 0 && !seen) {
			state.hideTimer += dt;
			if (state.hideTimer > 3 && !hideNoticeShown) {
				hideNoticeShown=true;
				showMessage(state,"They've lost sight of you — stay hidden and the heat fades.");
			}
			if (state.hideTimer > 8) {
				state.hideTimer=0;
				hideNoticeShown=false;
				addWanted(state,-1);
				showMessage(state,state.wanted === 0 ? 'You lost them. Wanted level cleared.' : 'One star gone — keep out of sight.');
			}
		} else {
			state.hideTimer=0;
			hideNoticeShown=false;
		}

		const nearestPolice=policeDistanceTo(focus);
		const playerSpeed=state.mode === MODE_DRIVE && currentCar ? Math.abs(currentCar.speed) : 0;
		const cornered=state.wanted > 0 && (
			(state.mode === MODE_FOOT && nearestPolice < 3.6) ||
			(state.mode === MODE_DRIVE && playerSpeed < 3 && nearestPolice < 7)
		);
		if (cornered) {
			state.bustedTimer += dt;
			if (state.bustedTimer > 0.5) crimePrompt='The patrol has you cornered — MOVE!';
			if (state.bustedTimer >= 1.9) {
				state.bustedTimer=0;
				state.mode=MODE_BUSTED;
			}
		} else {
			state.bustedTimer=Math.max(0,state.bustedTimer - dt * 2);
		}

		if (state.health < lastHealth) calmSeconds=0;
		else calmSeconds += dt;
		lastHealth=state.health;
		if (calmSeconds > 5 && state.health > 0 && state.health < 100) {
			state.health=Math.min(100,state.health + 1.6 * dt);
			lastHealth=state.health;
		}

		if (state.health <= 0 && state.mode !== MODE_WASTED) {
			state.mode=MODE_WASTED;
		}
	}

	function respawnPlayer(state) {
		if (currentCar) {
			currentCar.occupied=false;
			currentCar=null;
		}
		while (policeUnits.length > 0) policeUnits.pop().dispose(scene);
		carsChanged();
		state.wanted=0;
		state.hideTimer=0;
		state.bustedTimer=0;
		state.health=100;
		spawnClock=0;
		calmSeconds=0;
		lastHealth=100;
		crimePrompt='';
		missions.onRespawn();
		player.placeAt(-22 + 6,-16,Math.PI);
		player.setVisible(true);
		state.mode=MODE_FOOT;
	}

	function stagePolice(count,behind) {
		const focus={ x: behind.x,z: behind.z };
		while (policeUnits.length < count) {
			const spot=spawnPointNear(focus,policeUnits.length);
			policeUnits.push(new PoliceUnit(scene,spot.x,spot.z,spot.heading));
			carsChanged();
		}
		if (policeUnits.length > 0) {
			const unit=policeUnits[0];
			const back=8.5;
			const side=2.1;
			unit.car.placeAt(
				behind.x - Math.sin(behind.heading) * back - Math.cos(behind.heading) * side,
				behind.z - Math.cos(behind.heading) * back + Math.sin(behind.heading) * side,
				behind.heading,
			);
		}
	}

	return {
		city,
		player,
		parkedCars,
		traffic,
		pedestrians,
		policeUnits,
		combat,
		missions,
		get allCars() { return getAllCars(); },
		handleInteract,
		focusPosition,
		focusHeading,
		update,
		respawnPlayer,
		stagePolice,
		unlockGarageCar: spawnGoldCar,
		drainEvents() {
			const drained=pendingEvents.slice();
			pendingEvents.length=0;
			return drained;
		},
		get currentCar() { return currentCar; },
	};
}

export function createSunlight(scene) {

	const sun=new THREE.DirectionalLight(SUN_COLOR,SUN_INTENSITY);
	const dir=new THREE.Vector3(...SUN_DIRECTION).normalize();
	sun.position.copy(dir).multiplyScalar(210);
	sun.castShadow=true;
	sun.shadow.mapSize.set(2048,2048);
	Object.assign(sun.shadow.camera,{ left: -SHADOW_HALF,right: SHADOW_HALF,top: SHADOW_HALF,bottom: -SHADOW_HALF,near: 20,far: 520 });
	sun.shadow.camera.updateProjectionMatrix();
	sun.shadow.bias=-0.0006;
	sun.shadow.normalBias=0.6;
	scene.add(sun);
	scene.add(sun.target);
	const sky=new THREE.HemisphereLight(0xffd9a6,0x63506b,0.72);
	scene.add(sky);
	const ambient=new THREE.AmbientLight(0xffc9a0,0.26);
	scene.add(ambient);
	return sun;
}

export function anchorSunlight(sun,focus) {
	const gx=Math.round(focus.x / 4) * 4;
	const gz=Math.round(focus.z / 4) * 4;
	const dir=new THREE.Vector3(...SUN_DIRECTION).normalize();
	sun.target.position.set(gx,0,gz);
	sun.position.set(gx + dir.x * 210,dir.y * 210,gz + dir.z * 210);
	sun.target.updateMatrixWorld();
}
