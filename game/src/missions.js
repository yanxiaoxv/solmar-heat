// Story: five jobs to the Rayo Garage, then a taxi loop.

import * as THREE from 'three';
import { LANDMARKS } from './city.js';
import { MELEE_RANGE } from './combat.js';
import { MODE_DRIVE,setWantedAtLeast,showMessage } from './state.js';
import { createHumanFigure } from './figures.js';

export const MISSIONS=[
	{
		id: 'first-light',
		title: 'First Light Cruise',
		intro: 'Mara needs eyes on the marina before the regatta crowd lands.',
		reward: 150,
		reputation: 1,
		completeText: 'Mara waves you off the boardwalk.',
	},
	{
		id: 'portside-rush',
		title: 'Portside Rush',
		intro: 'Crates of iced shellfish, one impatient hotel kitchen.',
		reward: 320,
		reputation: 1,
		completeText: 'The Brisa kitchen pays in full and tips in shellfish.',
	},
	{
		id: 'heat-run',
		title: 'Heat Run',
		intro: 'A package at Coral Plaza that the patrol would love to meet.',
		reward: 420,
		reputation: 2,
		completeText: 'The package disappears into the Rayo Garage safe.',
	},
	{
		id: 'brisa-showdown',
		title: 'Brisa Showdown',
		intro: 'A rival crew is scaring guests off the Hotel Brisa forecourt.',
		reward: 500,
		reputation: 2,
		completeText: "Lucia slips you a padded vest (+50 armour) with the cash.",
	},
	{
		id: 'own-the-rayo',
		title: 'Own the Rayo',
		intro: 'Drive Mara to sign the Rayo papers — the patrol wants a word first.',
		reward: 1200,
		reputation: 3,
		completeText: 'The Rayo Garage is yours. The gold coupe out front is too.',
	},
];

function landmark(id) {
	return LANDMARKS.find((entry) => entry.id === id);
}

function formatClock(seconds) {

	const total=Math.max(0,Math.ceil(seconds));
	const minutes=Math.floor(total / 60);
	const rest=String(total - minutes * 60).padStart(2,'0');
	return `${minutes}:${rest}`;
}

function createRivalFigure() {

	return createHumanFigure({
		shirt: 0x8c2f39,
		skin: 0xa06a42,
		pants: 0x1d1d24,
		hair: 0x18100b,
	});
}

class Rival {
	constructor(scene,x,z,startsDown) {
		this.mesh=createRivalFigure();
		this.mesh.position.set(x,0,z);
		scene.add(this.mesh);
		this.down=false;
		this.attackCooldown=1 + Math.random();
		this.bobPhase=Math.random() * 6;
		if (startsDown) this.knockDown();
	}

	knockDown() {
		this.down=true;
		this.mesh.rotation.x=-Math.PI / 2;
		this.mesh.position.y=0.12;
	}

	dispose(scene) {
		scene.remove(this.mesh);
	}
}

export function createMissions(scene,hooks={}) {

	const beacon=new THREE.Group();
	const column=new THREE.Mesh(
		new THREE.CylinderGeometry(1.5,1.5,30,12,1,true),
		new THREE.MeshBasicMaterial({ color: 0xffd23f,transparent: true,opacity: 0.16,side: THREE.DoubleSide,depthWrite: false }),
	);
	column.position.y=15;
	beacon.add(column);
	const diamond=new THREE.Mesh(
		new THREE.OctahedronGeometry(0.9),
		new THREE.MeshBasicMaterial({ color: 0xffd23f }),
	);
	diamond.position.y=4.2;
	beacon.add(diamond);
	beacon.visible=false;
	scene.add(beacon);

	let rivals=[];
	let elapsed=0;
	let stageKey='';
	let stageTimer=null;
	let announcedMission=-1;
	let swingCooldown=0;
	let queuedSwing=false;
	let hurtMessageCooldown=0;
	let taxi=null;

	function currentTarget(state) {
		const index=state.missionIndex;
		const stage=state.missionStage;
		if (index === 0) return landmark('marina');
		if (index === 1) return stage === 0 ? landmark('depot') : landmark('hotel');
		if (index === 2) return stage === 0 ? landmark('plaza') : landmark('garage');
		if (index === 3) return landmark('hotel');
		if (index === 4) return stage === 0 ? landmark('marina') : landmark('garage');
		if (taxi) return stage === 0 ? taxi.pickup : taxi.dropoff;
		return null;
	}

	function timerAllowance(state) {

		if (state.missionIndex === 1 && state.missionStage === 1) return 100;
		if (state.missionIndex === 4 && state.missionStage === 1) return 130;
		if (state.missionIndex >= 5 && state.missionStage === 1 && taxi) {
			const run=Math.hypot(taxi.pickup.x - taxi.dropoff.x,taxi.pickup.z - taxi.dropoff.z);
			return 45 + run / 12;
		}
		return null;
	}

	function syncStage(state) {

		const key=`${state.missionIndex}:${state.missionStage}:${taxi ? taxi.pickup.id : ''}`;
		if (key !== stageKey) {
			stageKey=key;
			stageTimer=timerAllowance(state);
		}
		if (state.missionIndex < MISSIONS.length && announcedMission !== state.missionIndex && state.messageTimer <= 0) {
			announcedMission=state.missionIndex;
			const mission=MISSIONS[state.missionIndex];
			showMessage(state,`Job ${state.missionIndex + 1} · ${mission.title} — ${mission.intro}`,5.5);
		}
	}

	function completeMission(state,events) {
		const mission=MISSIONS[state.missionIndex];
		state.cash += mission.reward;
		state.reputation += mission.reputation;
		if (state.missionIndex === 3) state.armour=Math.max(state.armour,50);
		if (state.missionIndex === 4) {
			state.garageOwned=true;
			if (hooks.onGarageOwned) hooks.onGarageOwned();
		}
		showMessage(state,`Job done · ${mission.title}: +$${mission.reward}. ${mission.completeText}`,5.5);
		events.push(state.missionIndex === 4 ? 'finale' : 'mission-complete');
		state.missionIndex += 1;
		state.missionStage=0;
		if (rivals.length > 0) {
			for (const rival of rivals) rival.dispose(scene);
			rivals=[];
		}
	}

	function activateRivals(anchorX,anchorZ,state) {
		if (rivals.length > 0) return;
		const offsets=[[5,4],[-4,6],[1,-6]];
		offsets.forEach(([ox,oz],i) => {
			rivals.push(new Rival(scene,anchorX + ox,anchorZ + oz,i < state.rivalsDown));
		});
	}

	function ensureTaxi(state) {

		if (taxi || state.missionIndex < MISSIONS.length) return;
		const pool=LANDMARKS.filter((entry) => entry.id !== 'garage');
		const pickup=pool[Math.floor(Math.random() * pool.length)];
		let dropoff=pool[Math.floor(Math.random() * pool.length)];
		if (dropoff === pickup) dropoff=pool[(pool.indexOf(pickup) + 2) % pool.length];
		taxi={ pickup,dropoff };
	}

	function updateShowdown(dt,state,ctx,events) {
		const hotel=landmark('hotel');
		if (state.missionStage === 0) return null;
		activateRivals(hotel.x,hotel.z,state);
		if (swingCooldown > 0) swingCooldown -= dt;
		if (hurtMessageCooldown > 0) hurtMessageCooldown -= dt;
		let prompt='';
		const playerPos=ctx.player.mesh.position;

		function swingAtCrew() {
			swingCooldown=0.45;
			const facingX=Math.sin(ctx.player.heading);
			const facingZ=Math.cos(ctx.player.heading);
			for (const rival of rivals) {
				if (rival.down) continue;
				const dx=rival.mesh.position.x - playerPos.x;
				const dz=rival.mesh.position.z - playerPos.z;
				const dist=Math.hypot(dx,dz);
				if (dist < MELEE_RANGE + 0.2 && dist > 0.01 && (dx * facingX + dz * facingZ) / dist > 0.3) {
					rival.knockDown();
					state.rivalsDown += 1;
					events.push('thud');
					showMessage(state,`One down — ${state.rivalsDown} of 3 Brisa crew on the pavement.`);
				}
			}
		}
		if (state.mode !== MODE_DRIVE) {
			if (ctx.attacking && swingCooldown <= 0) {
				queuedSwing=false;
				swingAtCrew();
			} else if (ctx.attacking) {
				queuedSwing=true;
			} else if (queuedSwing && swingCooldown <= 0) {
				queuedSwing=false;
				swingAtCrew();
			}
		}
		for (const rival of rivals) {
			if (rival.down) continue;
			const dx=playerPos.x - rival.mesh.position.x;
			const dz=playerPos.z - rival.mesh.position.z;
			const dist=Math.hypot(dx,dz);
			if (dist < 2.6 && state.mode !== MODE_DRIVE) prompt='Click — Shove the crew';
			if (state.mode === MODE_DRIVE) continue;
			if (dist > 1.5 && dist < 24) {
				rival.mesh.position.x += (dx / dist) * 2.4 * dt;
				rival.mesh.position.z += (dz / dist) * 2.4 * dt;
				rival.mesh.rotation.y=Math.atan2(dx,dz);
				rival.bobPhase += dt * 8;
				rival.mesh.position.y=Math.abs(Math.sin(rival.bobPhase)) * 0.05;
			}
			if (rival.attackCooldown > 0) rival.attackCooldown -= dt;
			if (dist <= 1.6 && rival.attackCooldown <= 0) {
				rival.attackCooldown=1.4;
				let damage=5;
				if (state.armour > 0) {
					const absorbed=Math.min(state.armour,damage);
					state.armour -= absorbed;
					damage -= absorbed;
				}
				state.health=Math.max(0,state.health - damage);
				events.push('thud');
				if (hurtMessageCooldown <= 0) {
					hurtMessageCooldown=4;
					showMessage(state,'The Brisa crew is roughing you up — shove back!');
				}
			}
		}
		if (state.rivalsDown >= 3) completeMission(state,events);
		return prompt;
	}

	function update(dt,state,ctx) {
		elapsed += dt;
		ensureTaxi(state);
		syncStage(state);
		const events=[];
		const focus=ctx.focus;
		const target=currentTarget(state);
		let objective='';
		let prompt='';

		if (stageTimer !== null) {
			stageTimer -= dt;
			if (stageTimer <= 0) {
				stageTimer=timerAllowance(state) ?? 60;
				showMessage(state,state.missionIndex >= 5
					? 'The fare got out and walked. New clock, same dropoff — go!'
					: 'Out of time! The stage resets — no fine, just embarrassment.',4.5);
			}
		}

		const index=state.missionIndex;
		const stage=state.missionStage;
		const dist=target ? Math.hypot(focus.x - target.x,focus.z - target.z) : 0;
		const clock=stageTimer !== null ? ` · ${formatClock(stageTimer)} left` : '';

		if (index === 0) {
			objective=`Job 1 · First Light Cruise — Reach Solmar Marina (${Math.round(dist)} m)`;
			if (dist < 9) completeMission(state,events);
		} else if (index === 1 && stage === 0) {
			objective=`Job 2 · Portside Rush — Pick up the crates at Portside Depot (${Math.round(dist)} m)`;
			if (dist < 8) {
				state.missionStage=1;
				stageKey='';
				events.push('pickup');
				showMessage(state,'Crates loaded! Hotel Brisa kitchen, before the ice melts — the clock is running.',4.5);
			}
		} else if (index === 1) {
			objective=`Job 2 · Portside Rush — Deliver to Hotel Brisa (${Math.round(dist)} m)${clock}`;
			if (dist < 9) completeMission(state,events);
		} else if (index === 2 && stage === 0) {
			objective=`Job 3 · Heat Run — Collect the package at Coral Plaza (${Math.round(dist)} m)`;
			if (dist < 8) {
				state.missionStage=1;
				stageKey='';
				setWantedAtLeast(state,2);
				events.push('pickup');
				showMessage(state,'Package in hand — and the patrol noticed. Rayo Garage, and shake them on the way!',5);
			}
		} else if (index === 2) {
			objective=`Job 3 · Heat Run — Reach Rayo Garage (${Math.round(dist)} m) and shake the patrol`;
			if (dist < 9) completeMission(state,events);
		} else if (index === 3 && stage === 0) {
			objective=`Job 4 · Brisa Showdown — Meet Lucia at Hotel Brisa (${Math.round(dist)} m)`;
			if (dist < 11) {
				state.missionStage=1;
				stageKey='';
				events.push('pickup');
				showMessage(state,'The Brisa crew, in the flesh. Shove all three down — click to swing.',5);
			}
		} else if (index === 3) {
			objective=`Job 4 · Brisa Showdown — Shove the Brisa crew (${state.rivalsDown}/3)`;
			prompt=updateShowdown(dt,state,ctx,events) ?? '';
			if (state.mode === MODE_DRIVE) prompt='On foot — step out and shove the crew (click)';
		} else if (index === 4 && stage === 0) {
			objective=`Job 5 · Own the Rayo — Pick up Mara at Solmar Marina (${Math.round(dist)} m)${state.mode === MODE_DRIVE ? '' : ' — bring a car'}`;
			if (dist < 9 && state.mode === MODE_DRIVE) {
				state.missionStage=1;
				stageKey='';
				setWantedAtLeast(state,3);
				events.push('pickup');
				showMessage(state,"Mara's in! Every patrol car in Solmar just woke up — Rayo Garage, now!",5);
			} else if (dist < 9) {
				prompt='Mara needs a car — borrow one and roll up to the beacon';
			}
		} else if (index === 4) {
			objective=`Job 5 · Own the Rayo — Drive Mara to Rayo Garage (${Math.round(dist)} m)${clock}`;
			if (dist < 10 && state.mode === MODE_DRIVE) completeMission(state,events);
			else if (dist < 10) prompt='Get back in the car with Mara';
		} else if (index >= 5 && taxi && stage === 0) {
			objective=`Taxi — Pick up a fare at ${taxi.pickup.name} (${Math.round(dist)} m)`;
			if (dist < 9) {
				state.missionStage=1;
				stageKey='';
				events.push('pickup');
				showMessage(state,`Fare's in — ${taxi.dropoff.name}, and the clock is running.`,4);
			}
		} else if (index >= 5 && taxi) {
			objective=`Taxi — Drop off at ${taxi.dropoff.name} (${Math.round(dist)} m)${clock}`;
			if (dist < 9) {
				const run=Math.hypot(taxi.pickup.x - taxi.dropoff.x,taxi.pickup.z - taxi.dropoff.z);
				const reward=90 + Math.round(run / 5);
				state.cash += reward;
				state.taxiRuns += 1;
				events.push('mission-complete');
				showMessage(state,`Fare paid +$${reward} — taxi run ${state.taxiRuns} done. Another fare is waiting.`,4.5);
				taxi=null;
				state.missionStage=0;
				stageKey='';
			}
		}

		const liveTarget=currentTarget(state);
		if (liveTarget) {
			beacon.visible=true;
			beacon.position.set(liveTarget.x,0,liveTarget.z);
			diamond.position.y=4.2 + Math.sin(elapsed * 2.2) * 0.5;
			diamond.rotation.y=elapsed * 1.4;
		} else {
			beacon.visible=false;
		}

		return {
			objective,
			missionTarget: liveTarget ? { x: liveTarget.x,z: liveTarget.z } : null,
			prompt,
			events,
			rivals: rivals.map((rival) => ({ x: rival.mesh.position.x,z: rival.mesh.position.z,down: rival.down })),
		};
	}

	return {
		update,
		onRespawn() {

			stageKey='';
			queuedSwing=false;
		},
		refreshBeacon(state) {
			ensureTaxi(state);
			const target=currentTarget(state);
			if (target) {
				beacon.visible=true;
				beacon.position.set(target.x,0,target.z);
			} else {
				beacon.visible=false;
			}
		},
		stageShowdownAt(state,x,z) {
			activateRivals(x,z,state);
		},
		get rivals() {
			return rivals;
		},
	};
}
