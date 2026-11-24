// main.js — game entry point: boots the world and runs the frame loop.
// Solmar Heat entry point: boot the bay, run the frame, work the
// panels. A ?shot=chase|foot|drive&seed=N URL stages a deterministic
// scene instead of the menu, for the hand-in screenshots.

import * as THREE from 'three';
import { createGameState,showMessage,MODE_MENU,MODE_PAUSED,MODE_FOOT,MODE_DRIVE,MODE_BUSTED,MODE_WASTED } from './state.js';
import { loadSave,applySave,writeSave } from './save.js';
import { createInput,ACTION_INTERACT,ACTION_PAUSE,ACTION_CONFIRM } from './input.js';
import { createWorld,createSunlight,anchorSunlight } from './world.js';
import { FollowCamera } from './camera.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createRenderer,createScene,createCamera } from './render.js';

const params=new URLSearchParams(window.location.search);
const seed=Number.parseInt(params.get('seed') ?? '',10) || 7;
const shotName=params.get('shot');

const canvas=document.getElementById('game');
const renderer=createRenderer(canvas);
const scene=createScene();
const camera=createCamera();
const follow=new FollowCamera(camera);
const audio=createAudio();
const state=createGameState();
applySave(state,loadSave());
const world=createWorld(scene,seed,{ play: (name) => audio.play(name) });
const sun=createSunlight(scene);
const hud=createHud(world.city.decor);
const input=createInput(canvas);
window.__solmarHeat={ state,world,audio };

const menuEl=document.getElementById('menu');
const bustedEl=document.getElementById('busted');
const pauseEl=document.getElementById('pause');
let modeBeforePause=MODE_FOOT;
let panelShownFor='';
let lastView=null;

function resize() {
	renderer.setSize(window.innerWidth,window.innerHeight);
	camera.aspect=window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
}
window.addEventListener('resize',resize);
resize();

function startGame() {
	if (state.mode !== MODE_MENU) return;
	state.mode=MODE_FOOT;
	menuEl.style.display='none';
	hud.setVisible(true);
	audio.unlock();
	input.requestPointerLock();
	follow.snapBehind(world.player.heading);
}
function pauseGame() {
	modeBeforePause=state.mode;
	state.mode=MODE_PAUSED;
	writeSave(state);
	const story=state.missionIndex >= 5 ? 'All five jobs done — the taxi loop is yours.' : `Next up: job ${state.missionIndex + 1} of 5.`;
	document.getElementById('pause-progress').textContent=
		`$${state.cash.toLocaleString('en-US')} in pocket · ${story} ${state.taxiRuns} taxi runs, ${state.carsStolen} cars borrowed.`;
	pauseEl.style.display='flex';
	input.releasePointerLock();
}
function resumeGame() {
	state.mode=modeBeforePause;
	pauseEl.style.display='none';
	input.requestPointerLock();
}
function respawn() {
	world.respawn(state);
	bustedEl.style.display='none';
	panelShownFor='';
	hud.setVisible(true);
	input.requestPointerLock();
	follow.snapBehind(world.player.heading);
}
document.getElementById('menu-start').addEventListener('click',startGame);
document.getElementById('pause-resume').addEventListener('click',resumeGame);
document.getElementById('busted-respawn').addEventListener('click',respawn);
canvas.addEventListener('mousedown',() => {
	audio.unlock();
	if (state.mode === MODE_FOOT || state.mode === MODE_DRIVE) input.requestPointerLock();
});
window.addEventListener('beforeunload',() => writeSave(state));

// Progress worth keeping is saved the moment it lands — a paid fare,
// a finished job — not just when the player pauses.
let savedTuple='';
function saveIfProgressed() {
	const tuple=[state.cash,state.missionIndex,state.taxiRuns,state.garageOwned,state.reputation].join('|');
	if (tuple !== savedTuple) {
		savedTuple=tuple;
		writeSave(state);
	}
}
saveIfProgressed();

function showEndPanel() {
	const info=world.bustInfo;
	if (!info) return;
	document.getElementById('busted-title').textContent=info.title;
	document.getElementById('busted-text').textContent=info.text;
	bustedEl.style.display='flex';
	panelShownFor=state.mode;
	input.releasePointerLock();
}

function coastFactor(pos) {
	const shore=Math.max(0,Math.min(1,(pos.z - 96) / 60));
	const river=Math.max(0,Math.min(1,1 - Math.abs(pos.x + 148) / 90));
	return Math.max(shore,river * 0.7);
}
function nearestPoliceDistance(focus) {
	let best=Infinity;
	for (const unit of world.policeUnits) {
		const d=Math.hypot(unit.car.mesh.position.x - focus.x,unit.car.mesh.position.z - focus.z);
		if (d < best) best=d;
	}
	return best;
}

// --- ?shot= staging ------------------------------------------------------
// Posed with the game's own systems, then stepped a fixed number of
// fixed-length frames: the same seed stages the same scene.
function scriptedInput(drive) {
	return {
		moveAxis: () => ({ x: 0,z: drive ? -1 : 0 }),
		running: () => false,
		handbrake: () => false,
		isAttacking: () => false,
		beginFrame() {},
		takeActions: () => 0,
		takeMouseDelta: () => ({ x: 0,y: 0 }),
	};
}
function stageShot(name) {
	menuEl.style.display='none';
	hud.setVisible(true);
	const coupe=world.parkedCars[0];
	let drive=false;
	if (name === 'foot') {
		state.mode=MODE_FOOT;
		world.player.placeAt(-13.5,-19.5,2.65);
		follow.yaw=0.7;
		follow.pitch=0.3;
	} else {
		world.enterCarNow(coupe,state);
		drive=true;
		if (name === 'chase') {
			coupe.placeAt(24,-58,Math.PI / 2);
			coupe.speed=15;
			state.wanted=3;
			world.spawnPolice(-2,-63,Math.PI / 2);
			world.spawnPolice(6,-52,Math.PI / 2);
		} else {
			coupe.placeAt(-52,24,Math.PI / 2);
			coupe.speed=11;
		}
		follow.snapBehind(coupe.heading);
	}
	const fake=scriptedInput(drive);
	for (let i=0; i < 80; i += 1) {
		lastView=world.update(1 / 30,state,fake,0,follow);
		const focus=lastView ? lastView.playerPos : world.player.mesh.position;
		follow.update(1 / 30,focus,state.mode === MODE_DRIVE,world.city.colliders);
		anchorSunlight(sun,focus);
	}
	if (lastView) hud.update(state,lastView);
	window.__shotReady=true;
}
if (shotName) stageShot(shotName);

// --- The frame ------------------------------------------------------------
let lastNow=performance.now();
function frame() {
	requestAnimationFrame(frame);
	const now=performance.now();
	const dt=Math.min(0.25,(now - lastNow) / 1000);
	lastNow=now;
	input.beginFrame();
	const actions=input.takeActions();
	if (actions & ACTION_PAUSE) {
		if (state.mode === MODE_FOOT || state.mode === MODE_DRIVE) pauseGame();
		else if (state.mode === MODE_PAUSED) resumeGame();
	}
	if ((actions & ACTION_CONFIRM) && state.mode === MODE_MENU) startGame();
	const mouse=input.takeMouseDelta();
	if (state.mode === MODE_FOOT || state.mode === MODE_DRIVE) follow.orbit(mouse.x,mouse.y);
	if (state.mode !== MODE_PAUSED && !shotName) {
		lastView=world.update(dt,state,input,actions,follow);
	}
	if ((state.mode === MODE_BUSTED || state.mode === MODE_WASTED) && panelShownFor !== state.mode) showEndPanel();
	if (state.messageTimer > 0) state.messageTimer -= dt;
	const focus=lastView ? lastView.playerPos : world.player.mesh.position;
	if (state.mode === MODE_DRIVE && world.currentCar) follow.alignBehind(world.currentCar.heading,dt);
	follow.update(dt,focus,state.mode === MODE_DRIVE,world.city.colliders);
	anchorSunlight(sun,focus);
	if (state.mode !== MODE_MENU && lastView) hud.update(state,lastView);
	audio.update(dt,{
		mode: state.mode,
		speedKmh: lastView ? lastView.speedKmh : 0,
		wanted: state.wanted,
		policeDistance: nearestPoliceDistance(focus),
		coast: coastFactor(focus),
	});
	saveIfProgressed();
	renderer.render(scene,camera);
}
requestAnimationFrame(frame);
