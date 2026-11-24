// missions.js — the story missions: five jobs for Nico Vega, then the endless taxi loop.
// The story: five jobs for Nico Vega, then the endless taxi loop.
// Stages advance on arrival; the showdown job fights with the same
// shove the combat module gives the player.

import * as THREE from 'three';
import { LANDMARKS } from './city.js';
import { MELEE_RANGE } from './combat.js';
import { MODE_DRIVE,setWantedAtLeast,showMessage } from './state.js';
import { createHumanFigure } from './figures.js';
import { createSeededRandom } from './random.js';

const PLACES={};
for (const lm of LANDMARKS) PLACES[lm.id]=lm;

export const MISSIONS=[
	{
		title: 'First Light Cruise',reward: 150,reputation: 1,
		done: 'Mara pays with a grin: "The bay looks good on you, Nico."',
		stages: [
			{ text: 'Reach Solmar Marina',place: 'marina',radius: 9 },
		],
	},
	{
		title: 'Portside Rush',reward: 320,reputation: 1,
		done: 'The concierge signs, tips, and never asks what was in the case.',
		stages: [
			{ text: 'Pick up the case at Portside Depot',place: 'depot',radius: 9 },
			{ text: 'Deliver to Hotel Brisa',place: 'hotel',radius: 10,timed: 100 },
		],
	},
	{
		title: 'Paper Trail',reward: 420,reputation: 2,
		done: 'The garage crew burns the ledger. The Patrol keeps the ashes.',
		stages: [
			{ text: 'Pick up the ledger at Coral Plaza',place: 'plaza',radius: 9,heat: 2 },
			{ text: 'Reach Rayo Garage',place: 'garage',radius: 10 },
		],
	},
	{
		title: "Lucia's Showdown",reward: 500,reputation: 2,
		done: 'Lucia hands over a patrol vest: "You earned the armour, cariño."',
		stages: [
			{ text: 'Meet Lucia at Hotel Brisa',place: 'hotel',radius: 9 },
			{ text: 'Shove down the rivals',place: 'hotel',radius: 9,showdown: true },
		],
	},
	{
		title: 'The Rayo Finale',reward: 1200,reputation: 2,
		done: 'The Rayo Garage is yours — and the gold coupe in bay one.',
		stages: [
			{ text: 'Pick up Mara at Solmar Marina',place: 'marina',radius: 11,heat: 3,needsCar: true },
			{ text: 'Bring Mara to Rayo Garage',place: 'garage',radius: 11 },
		],
	},
];

const FARE_PLACES=['marina','plaza','depot','hotel','heights','oldtown'];
const RIVAL_SHIRTS=[0x8c1d18,0x2b2b66,0x14532d];
const RIVAL_OFFSETS=[[-4,3],[3.5,-3],[0.5,5.5]];

export function createMissions(scene,hooks={}) {
	const rng=createSeededRandom(77003);
	const beacon=new THREE.Mesh(
		new THREE.CylinderGeometry(1.7,1.7,15,12,1,true),
		new THREE.MeshBasicMaterial({ color: 0xffd23f,transparent: true,opacity: 0.13,depthWrite: false,side: THREE.DoubleSide }),
	);
	beacon.visible=false;
	scene.add(beacon);
	const ring=new THREE.Mesh(
		new THREE.RingGeometry(1.9,2.6,24),
		new THREE.MeshBasicMaterial({ color: 0xffd23f,transparent: true,opacity: 0.55,depthWrite: false,side: THREE.DoubleSide }),
	);
	ring.rotation.x=-Math.PI / 2;
	ring.visible=false;
	scene.add(ring);

	const api={
		rivals: [],
		target: null,
		objectiveText: '',
		update,
	};

	let stageKey='';
	let timerLeft=0;
	let clock=0;
	let farePickup=null;
	let fareDropoff=null;
	let fareDistance=0;
	let fareDelivered=false;

	function rollPlace(exceptId) {
		let id=exceptId;
		while (id === exceptId) id=FARE_PLACES[Math.floor(rng() * FARE_PLACES.length)];
		return PLACES[id];
	}
	function rollFare() {
		farePickup=rollPlace(fareDropoff ? fareDropoff.id : '');
		fareDropoff=null;
	}
	rollFare();

	function placeOf(stage) {
		return PLACES[stage.place];
	}
	function distTo(focus,place) {
		return Math.hypot(focus.x - place.x,focus.z - place.z);
	}

	function finishJob(state,job) {
		state.cash += job.reward;
		state.reputation += job.reputation;
		state.missionIndex += 1;
		state.missionStage=0;
		if (state.missionIndex === 4) state.armour=50;
		if (state.missionIndex === 5) state.garageOwned=true;
		showMessage(state,job.done,5);
		hooks.play?.(state.missionIndex === 5 ? 'finale' : 'mission-complete');
	}

	function spawnRivals(state,place) {
		state.rivalsDown=0;
		api.rivals.length=0;
		RIVAL_OFFSETS.forEach(([ox,oz],i) => {
			const mesh=createHumanFigure({
				shirt: RIVAL_SHIRTS[i],
				skin: 0x8d5a3a + i * 0x010203,
				pants: 0x22242c,
				hair: 0x120e0c,
			});
			mesh.position.set(place.x + ox,0,place.z + oz);
			scene.add(mesh);
			api.rivals.push({
				mesh,
				x: place.x + ox,
				z: place.z + oz,
				down: false,
				attackCd: 1 + i * 0.5,
				phase: i * 2.1,
			});
		});
	}

	function enterStage(state,job,stage) {
		if (stage.timed) timerLeft=stage.timed;
		if (stage.showdown) spawnRivals(state,placeOf(stage));
	}

	// Heat lands at the pickup moment itself: the crime is witnessed
	// as the goods change hands, not when the job is offered.
	function applyHeat(state,stage) {
		setWantedAtLeast(state,stage.heat);
		showMessage(state,stage.heat >= 3 ? 'Mara slides in — and every patrol radio wakes up.' : 'The Patrol saw that. Two stars and climbing.',4);
		hooks.play?.('pickup');
	}

	function updateRivals(dt,ctx) {
		const { state,focus }=ctx;
		for (const rival of api.rivals) {
			if (rival.down) continue;
			const dx=focus.x - rival.x;
			const dz=focus.z - rival.z;
			const dist=Math.hypot(dx,dz);
			rival.attackCd -= dt;
			if (ctx.attackPressed) {
				// dx/dz point rival -> player; the shove lands when the
				// rival stands in the arc the player faces, i.e. the
				// player -> rival direction dotted with the forward.
				const facingX=Math.sin(ctx.playerHeading);
				const facingZ=Math.cos(ctx.playerHeading);
				if (dist < MELEE_RANGE && dist > 0.01 && (-dx * facingX - dz * facingZ) / dist > 0.3) {
					rival.down=true;
					state.rivalsDown += 1;
					rival.mesh.rotation.x=-Math.PI / 2;
					rival.mesh.position.y=0.12;
					hooks.play?.('thud');
					continue;
				}
			}
			if (dist > 1.7) {
				const step=Math.min(dist - 1.6,3.1 * dt);
				rival.x += (dx / dist) * step;
				rival.z += (dz / dist) * step;
				rival.phase += dt * 8.5;
				const swing=Math.sin(rival.phase) * 0.6;
				const { armL,armR,legL,legR }=rival.mesh.userData.limbs;
				armL.rotation.x=swing;
				armR.rotation.x=-swing;
				legL.rotation.x=-swing;
				legR.rotation.x=swing;
			} else if (rival.attackCd <= 0) {
				rival.attackCd=1.7;
				state.health=Math.max(0,state.health - 5);
				hooks.play?.('thud');
				showMessage(state,'A rival shoves back!',1.6);
			}
			rival.mesh.position.set(rival.x,0,rival.z);
			rival.mesh.rotation.y=Math.atan2(dx,dz);
		}
		return api.rivals.every((r) => r.down);
	}

	function setBeacon(place) {
		if (!place) {
			beacon.visible=false;
			ring.visible=false;
			api.target=null;
			return;
		}
		beacon.visible=true;
		ring.visible=true;
		beacon.position.set(place.x,7.5,place.z);
		ring.position.set(place.x,0.09 + Math.sin(clock * 2.4) * 0.02,place.z);
		const pulse=1 + Math.sin(clock * 2.4) * 0.08;
		ring.scale.setScalar(pulse);
		api.target={ x: place.x,z: place.z };
	}

	function update(dt,ctx) {
		clock += dt;
		const { state,focus }=ctx;
		if (state.missionIndex >= MISSIONS.length) {
			updateTaxi(dt,ctx);
			return;
		}
		const job=MISSIONS[state.missionIndex];
		const stage=job.stages[state.missionStage];
		const key=`${state.missionIndex}:${state.missionStage}`;
		if (key !== stageKey) {
			stageKey=key;
			enterStage(state,job,stage);
		}
		if (stage.showdown) {
			setBeacon(null);
			const down=state.rivalsDown;
			api.objectiveText=`Job ${state.missionIndex + 1} · ${job.title} — Shove down the rivals (${down}/3)`;
			if (updateRivals(dt,ctx)) finishJob(state,job);
			return;
		}
		const place=placeOf(stage);
		const dist=distTo(focus,place);
		setBeacon(place);
		if (stage.timed) {
			timerLeft -= dt;
			const left=Math.max(0,Math.ceil(timerLeft));
			const timerText=` · ${Math.floor(left / 60)}:${String(left % 60).padStart(2,'0')} left`;
			api.objectiveText=`Job ${state.missionIndex + 1} · ${job.title} — ${stage.text} (${Math.round(dist)} m)${timerText}`;
			if (timerLeft <= 0) {
				state.missionStage=0;
				stageKey='';
				showMessage(state,'Too slow — the case went cold. Pick it up again.',4);
				return;
			}
		} else {
			api.objectiveText=`Job ${state.missionIndex + 1} · ${job.title} — ${stage.text} (${Math.round(dist)} m)`;
		}
		if (dist < stage.radius) {
			if (stage.needsCar && ctx.mode !== MODE_DRIVE) return;
			if (stage.heat) applyHeat(state,stage);
			if (state.missionStage + 1 < job.stages.length) {
				state.missionStage += 1;
			} else {
				finishJob(state,job);
			}
		}
	}

	function updateTaxi(dt,ctx) {
		const { state,focus }=ctx;
		// The fare is paid the moment the cab stops; the stage only
		// resets on the next beat, so a save written on the payment
		// still shows the passenger aboard.
		if (fareDelivered) {
			fareDelivered=false;
			state.missionStage=0;
			rollFare();
		}
		if (state.missionStage === 0) {
			const place=farePickup;
			const dist=distTo(focus,place);
			setBeacon(place);
			api.objectiveText=`Taxi · Pick up a fare at ${place.name} (${Math.round(dist)} m)`;
			if (dist < 10 && ctx.mode === MODE_DRIVE) {
				fareDropoff=rollPlace(place.id);
				fareDistance=distTo(place,fareDropoff);
				state.missionStage=1;
				hooks.play?.('pickup');
				showMessage(state,`Fare aboard — ${fareDropoff.name}, and make it smooth.`,3.5);
			}
			return;
		}
		const place=fareDropoff;
		const dist=distTo(focus,place);
		setBeacon(place);
		api.objectiveText=`Taxi · Drop your fare at ${place.name} (${Math.round(dist)} m)`;
		if (dist < 10 && ctx.mode === MODE_DRIVE) {
			const fare=Math.round(24 + fareDistance * 0.5);
			state.cash += fare;
			state.taxiRuns += 1;
			state.reputation += 1;
			fareDelivered=true;
			hooks.play?.('pickup');
			showMessage(state,`Fare paid: $${fare}. The bay provides.`,3.5);
		}
	}

	return api;
}
