// Solmar Heat — boot and main loop. Builds the three.js scene (warm bay
// light, fog, procedural city), wires input, world simulation, follow camera
// and HUD together, and runs the menu / play / pause flow. With ?shot=<name>
// it stages a deterministic scene for screenshots instead of starting play.

import * as THREE from 'three';
import { createGameState, showMessage, MODE_MENU, MODE_PAUSED, MODE_FOOT, MODE_DRIVE, MODE_BUSTED, MODE_WASTED } from './state.js';
import { loadSave, applySave, writeSave } from './save.js';
import { createInput, ACTION_INTERACT, ACTION_PAUSE, ACTION_CONFIRM } from './input.js';
import { createWorld, createSunlight } from './world.js';
import { FollowCamera } from './camera.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { createRenderer, createScene, createCamera } from './render.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const scene = createScene();
const camera3d = createCamera();
createSunlight(scene);

const state = createGameState();
applySave(state, loadSave());
const world = createWorld(scene, seed);
if (state.garageOwned) world.unlockGarageCar();
const followCam = new FollowCamera(camera3d);
const hud = createHud();
const input = createInput(canvas);
const audio = createAudio();
// A small handle for automated playtests and curious players in devtools.
window.__solmarHeat = { state, world, audio };

const menuEl = document.getElementById('menu');
const pauseEl = document.getElementById('pause');
const bustedEl = document.getElementById('busted');
const bustedTitle = document.getElementById('busted-title');
const bustedText = document.getElementById('busted-text');
const startButton = document.getElementById('menu-start');
const resumeButton = document.getElementById('pause-resume');
const respawnButton = document.getElementById('busted-respawn');
const pauseProgress = document.getElementById('pause-progress');
let pendingFine = 0;
let uiMode = null;

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera3d.aspect = w / h;
  camera3d.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

let previousMode = MODE_FOOT;

function setMode(mode) {
  state.mode = mode;
  syncModeUi();
}

function syncModeUi() {
  // Panels follow the state wherever the change came from — a button, the
  // pause key, or the patrol ending a chase in the world simulation.
  const mode = state.mode;
  if (mode === uiMode) return;
  uiMode = mode;
  menuEl.style.display = mode === MODE_MENU ? 'flex' : 'none';
  pauseEl.style.display = mode === MODE_PAUSED ? 'flex' : 'none';
  bustedEl.style.display = mode === MODE_BUSTED || mode === MODE_WASTED ? 'flex' : 'none';
  hud.setVisible(mode === MODE_FOOT || mode === MODE_DRIVE);
  if (mode === MODE_BUSTED) {
    // The fine is itemised on the panel — $80 for the stop itself plus
    // $70 per star on the board when they closed in — so the player can
    // see exactly what the chase cost and what one more star would have
    // added. What cash cannot cover is settled in reputation instead
    // (see the respawn handler), never as a dead end.
    pendingFine = 80 + state.wanted * 70;
    bustedTitle.textContent = 'BUSTED';
    bustedText.textContent = state.wanted > 0
      ? `The Solmar Patrol boxed you in at ${state.wanted} star${state.wanted === 1 ? '' : 's'}. Fine: $80 + ${state.wanted} × $70 = $${pendingFine}, and your name goes in their little book.`
      : `The Solmar Patrol boxed you in. Fine: $${pendingFine}, and your name goes in their little book.`;
    respawnButton.textContent = `Settle $${pendingFine} and walk`;
    audio.play('busted');
  } else if (mode === MODE_WASTED) {
    pendingFine = 150;
    bustedTitle.textContent = 'WASTED';
    bustedText.textContent = 'You wake up at the Solmar Clinic: $150 for the bed, the stitches and the spectacular headache.';
    respawnButton.textContent = 'Settle $150 and walk';
    audio.play('busted');
  }
  if (mode === MODE_PAUSED && pauseProgress) {
    pauseProgress.textContent = `Story: ${Math.min(state.missionIndex, 5)} of 5 jobs done · Cash $${state.cash.toLocaleString('en-US')} · Reputation ${state.reputation} · Cars borrowed ${state.carsStolen} · Taxi runs ${state.taxiRuns}`;
  }
  if (mode === MODE_FOOT || mode === MODE_DRIVE) input.requestPointerLock();
  else input.releasePointerLock();
}

respawnButton.addEventListener('click', () => {
  audio.unlock();
  audio.play('click');
  // Settle up: cash pays what it can, and any shortfall comes out of
  // reputation at a dollar-to-a-point-per-hundred — a broke Nico walks
  // out owing the street instead of owing a game-over screen.
  const cashPaid = Math.min(state.cash, pendingFine);
  const shortfall = pendingFine - cashPaid;
  state.cash -= cashPaid;
  if (shortfall > 0) {
    state.reputation = Math.max(0, state.reputation - Math.ceil(shortfall / 100));
  }
  pendingFine = 0;
  world.respawnPlayer(state);
  writeSave(state);
  uiMode = null;
  setMode(MODE_FOOT);
  followCam.snapBehind(world.player.heading);
});

function startPlay() {
  audio.unlock();
  audio.play('click');
  previousMode = MODE_FOOT;
  setMode(MODE_FOOT);
  followCam.snapBehind(world.player.heading);
  showMessage(state, 'Click the game to look around with the mouse. WASD walks.', 5);
}

startButton.addEventListener('click', startPlay);
resumeButton.addEventListener('click', () => {
  audio.unlock();
  audio.play('click');
  setMode(previousMode);
});
canvas.addEventListener('click', () => {
  if (state.mode === MODE_FOOT || state.mode === MODE_DRIVE) input.requestPointerLock();
});

function handleActions() {
  const actions = input.takeActions();
  if (actions & ACTION_CONFIRM && state.mode === MODE_MENU) startPlay();
  if (actions & ACTION_PAUSE) {
    if (state.mode === MODE_FOOT || state.mode === MODE_DRIVE) {
      previousMode = state.mode;
      setMode(MODE_PAUSED);
      writeSave(state);
    } else if (state.mode === MODE_PAUSED) {
      setMode(previousMode);
    }
  }
  if (actions & ACTION_INTERACT && (state.mode === MODE_FOOT || state.mode === MODE_DRIVE)) {
    const before = state.mode;
    if (world.handleInteract(state)) {
      setMode(state.mode);
      if (state.mode === MODE_DRIVE && world.currentCar) followCam.snapBehind(world.currentCar.heading);
      void before;
    }
  }
}

function frame(now, last, view) {
  const dt = Math.min((now - last) / 1000, 0.25);
  input.beginFrame();
  syncModeUi();
  handleActions();
  if (state.mode === MODE_FOOT || state.mode === MODE_DRIVE) {
    state.playSeconds += dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    const mouse = input.takeMouseDelta();
    followCam.orbit(mouse.x, mouse.y);
    if (state.mode === MODE_DRIVE && world.currentCar && Math.abs(world.currentCar.speed) > 3) {
      followCam.alignBehind(world.currentCar.heading, dt);
    }
    // Simulate in fixed substeps of at most 1/30 s: on a slow machine the
    // world still advances in real time instead of slipping into slow
    // motion, and the arcade physics stays stable at any frame rate.
    let nextView = view;
    let remaining = dt;
    while (remaining > 0 && (state.mode === MODE_FOOT || state.mode === MODE_DRIVE)) {
      const step = Math.min(remaining, 1 / 30);
      nextView = world.update(step, state, input, followCam.yaw);
      remaining -= step;
    }
    // Sound follows the simulation: one-shots the world queued this frame
    // (pickups, job fanfares, thuds), then the continuous engine and siren.
    for (const eventName of world.drainEvents()) {
      audio.play(eventName);
      if (eventName === 'mission-complete' || eventName === 'finale' || eventName === 'pickup') writeSave(state);
    }
    let policeDistance = Infinity;
    if (nextView) {
      for (const unit of world.policeUnits) {
        const dist = Math.hypot(unit.car.mesh.position.x - nextView.playerPos.x, unit.car.mesh.position.z - nextView.playerPos.z);
        if (dist < policeDistance) policeDistance = dist;
      }
    }
    audio.update(dt, {
      mode: state.mode,
      speedKmh: nextView ? nextView.speedKmh : 0,
      wanted: state.wanted,
      policeDistance,
    });
    followCam.update(dt, world.focusPosition(state), state.mode === MODE_DRIVE);
    hud.update(state, nextView);
    renderer.render(scene, camera3d);
    requestAnimationFrame((t) => frame(t, now, nextView));
  } else {
    // Menu and pause keep the world breathing gently behind the panels.
    world.city.update(dt);
    for (const person of world.pedestrians) person.update(dt * 0.4, null);
    followCam.update(dt, world.focusPosition(state), false);
    renderer.render(scene, camera3d);
    requestAnimationFrame((t) => frame(t, now, view));
  }
}

function runShot(name) {
  hud.setVisible(name !== 'menu');
  menuEl.style.display = name === 'menu' ? 'flex' : 'none';
  pauseEl.style.display = 'none';
  const staged = stageShot(name, world, state, followCam);
  const focus = staged.car ? staged.car.mesh.position : world.player.mesh.position;
  const view = {
    objective: staged.objective ?? '',
    prompt: staged.prompt ?? '',
    speedKmh: staged.car ? Math.abs(staged.car.speed) * 3.6 : 0,
    missionTarget: staged.missionTarget,
    playerPos: focus,
    playerHeading: staged.car ? staged.car.heading : world.player.heading,
    cars: world.allCars,
    police: world.policeUnits.map((unit) => unit.car),
    pedestrians: world.pedestrians,
    rivals: world.missions.rivals.map((rival) => ({
      x: rival.mesh.position.x,
      z: rival.mesh.position.z,
      down: rival.down,
    })),
  };
  // Let traffic and pedestrians settle into natural poses before the capture.
  for (let i = 0; i < 90; i += 1) {
    for (const car of world.traffic) car.updateTraffic(1 / 30, world.traffic);
    for (const person of world.pedestrians) person.update(1 / 30, null);
  }
  if (staged.car) staged.car.drive(0.016, 0.4, 0, false, world.city.colliders);
  followCam.update(0.016, focus, Boolean(staged.car));
  hud.update(state, view);
  renderer.render(scene, camera3d);
  requestAnimationFrame(() => {
    hud.update(state, view);
    renderer.render(scene, camera3d);
    window.__shotReady = true;
  });
}

if (shotName) {
  runShot(shotName);
} else {
  setMode(MODE_MENU);
  requestAnimationFrame((t) => frame(t, t, null));
}
