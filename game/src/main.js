// Solmar Heat — boot and main loop. Builds the three.js scene (warm bay
// light, fog, procedural city), wires input, world simulation, follow camera
// and HUD together, and runs the menu / play / pause flow. With ?shot=<name>
// it stages a deterministic scene for screenshots instead of starting play.

import * as THREE from 'three';
import { createGameState, loadSave, applySave, writeSave, showMessage, MODE_MENU, MODE_PAUSED, MODE_FOOT, MODE_DRIVE, MODE_BUSTED, MODE_WASTED } from './state.js';
import { createInput, ACTION_INTERACT, ACTION_PAUSE, ACTION_CONFIRM } from './input.js';
import { createWorld, createSunlight } from './world.js';
import { FollowCamera } from './camera.js';
import { createHud } from './hud.js';
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
// A small handle for automated playtests and curious players in devtools.
window.__solmarHeat = { state, world };
const followCam = new FollowCamera(camera3d);
const hud = createHud();
const input = createInput(canvas);

const menuEl = document.getElementById('menu');
const pauseEl = document.getElementById('pause');
const bustedEl = document.getElementById('busted');
const bustedTitle = document.getElementById('busted-title');
const bustedText = document.getElementById('busted-text');
const startButton = document.getElementById('menu-start');
const resumeButton = document.getElementById('pause-resume');
const respawnButton = document.getElementById('busted-respawn');
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
    pendingFine = 80 + state.wanted * 70;
    bustedTitle.textContent = 'BUSTED';
    bustedText.textContent = `The Solmar Patrol boxed you in. The fine is $${pendingFine}, and your name goes in their little book.`;
    respawnButton.textContent = `Pay $${pendingFine} and walk`;
  } else if (mode === MODE_WASTED) {
    pendingFine = 150;
    bustedTitle.textContent = 'WASTED';
    bustedText.textContent = 'You wake up at the Solmar Clinic with a $150 bill and a spectacular headache.';
    respawnButton.textContent = 'Pay $150 and walk';
  }
  if (mode === MODE_FOOT || mode === MODE_DRIVE) input.requestPointerLock();
  else input.releasePointerLock();
}

respawnButton.addEventListener('click', () => {
  state.cash = Math.max(0, state.cash - pendingFine);
  pendingFine = 0;
  world.respawnPlayer(state);
  writeSave(state);
  uiMode = null;
  setMode(MODE_FOOT);
  followCam.snapBehind(world.player.heading);
});

function startPlay() {
  previousMode = MODE_FOOT;
  setMode(MODE_FOOT);
  followCam.snapBehind(world.player.heading);
  showMessage(state, 'Click the game to look around with the mouse. WASD walks.', 5);
}

startButton.addEventListener('click', startPlay);
resumeButton.addEventListener('click', () => setMode(previousMode));
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
    objective: name === 'chase'
      ? 'Mission 3 — Lose the patrol and reach Rayo Garage'
      : name === 'drive'
        ? 'Mission 1 — Cruise to the Solmar Marina boardwalk'
        : 'Free roam — explore Solmar Bay on foot or borrow a car (E)',
    prompt: name === 'foot' ? 'E — Get in the Rayo Coupe' : '',
    speedKmh: staged.car ? Math.abs(staged.car.speed) * 3.6 : 0,
    missionTarget: { x: 22, z: 148 },
    playerPos: focus,
    playerHeading: staged.car ? staged.car.heading : world.player.heading,
    cars: world.allCars,
    police: world.policeUnits.map((unit) => unit.car),
    pedestrians: world.pedestrians,
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
