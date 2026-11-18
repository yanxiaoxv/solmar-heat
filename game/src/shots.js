// Deterministic screenshot staging for Solmar Heat. A ?shot= scene positions
// the real game actors — player, cars, pedestrians, patrol, mission state —
// exactly as a moment of play would, then pins the camera. The renderer draws
// the live scene twice and flags window.__shotReady so the capture tool can
// fire. Every scene is a genuine story moment from the M3 build: the cover
// is Job 3's heat run with a real patrol unit on the coupe's tail, three
// stars up, the garage objective on the banner and police dots on the
// minimap; the others are the timed delivery, the Brisa showdown and the
// start screen over the bay.

import * as THREE from 'three';
import { LANDMARKS } from './city.js';
import { MODE_DRIVE, MODE_FOOT, MODE_MENU } from './state.js';

function landmark(id) {
  return LANDMARKS.find((entry) => entry.id === id);
}

function metres(a, b) {
  return Math.round(Math.hypot(a.x - b.x, a.z - b.z));
}

export function stageShot(name, world, state, camera) {
  const { player } = world;
  if (name === 'drive') {
    state.mode = MODE_DRIVE;
    state.missionIndex = 1;
    state.missionStage = 1;
    state.cash = 470;
    const van = world.parkedCars.find((car) => car.kind === 'van') ?? world.parkedCars[0];
    // The Portside Van on the coast avenue, rolling south with the ice
    // melting and the Brisa clock running.
    van.placeAt(22, 60, 0);
    van.speed = 15;
    player.setVisible(false);
    player.mesh.position.copy(van.mesh.position);
    world.missions.refreshBeacon(state);
    const hotel = landmark('hotel');
    camera.pin(
      new THREE.Vector3(van.mesh.position.x - 8.5, 3.6, van.mesh.position.z - 11),
      new THREE.Vector3(van.mesh.position.x + 2, 1.2, van.mesh.position.z + 12),
    );
    return {
      mode: MODE_DRIVE,
      car: van,
      objective: `Job 2 · Portside Rush — Deliver to Hotel Brisa (${metres(van.mesh.position, hotel)} m) · 0:47 left`,
      missionTarget: hotel,
      prompt: '',
    };
  }
  if (name === 'chase') {
    state.mode = MODE_DRIVE;
    state.missionIndex = 2;
    state.missionStage = 1;
    state.wanted = 3;
    state.cash = 890;
    const car = world.parkedCars[0];
    car.placeAt(-22, 18, Math.PI);
    car.speed = 21;
    player.setVisible(false);
    player.mesh.position.copy(car.mesh.position);
    // A real patrol unit on the tail, light bar flashing — the cover sells
    // the wanted system only if the police are actually in the frame.
    world.stagePolice(3, { x: car.mesh.position.x, z: car.mesh.position.z, heading: car.heading });
    world.missions.refreshBeacon(state);
    const garage = landmark('garage');
    // Pulled back and up from the M2 framing so BOTH cars fit the frame:
    // the coupe ahead in its lane, the patrol unit whole behind it with
    // the light bar lit — the chase reads at thumbnail size.
    camera.pin(
      new THREE.Vector3(car.mesh.position.x + 8.5, 4.4, car.mesh.position.z + 18.5),
      new THREE.Vector3(car.mesh.position.x + 0.5, 1.0, car.mesh.position.z - 4),
    );
    return {
      mode: MODE_DRIVE,
      car,
      objective: `Job 3 · Heat Run — Reach Rayo Garage (${metres(car.mesh.position, garage)} m) and shake the patrol`,
      missionTarget: garage,
      prompt: '',
    };
  }
  if (name === 'menu') {
    state.mode = MODE_MENU;
    player.placeAt(22, 132, Math.PI);
    camera.pin(
      new THREE.Vector3(10, 5.5, 118),
      new THREE.Vector3(26, 1.5, 150),
    );
    return { mode: MODE_MENU, car: null, objective: '', missionTarget: null, prompt: '' };
  }
  // Default: the Brisa showdown on foot — Nico facing the rival crew on
  // the avenue outside Hotel Brisa. The group stands a few metres south
  // of the beacon so the gold column reads as a backdrop, not a fog: the
  // first framing put the camera inside the column and drowned the shot.
  state.mode = MODE_FOOT;
  state.missionIndex = 3;
  state.missionStage = 1;
  state.rivalsDown = 0;
  state.cash = 1310;
  const hotel = landmark('hotel');
  player.placeAt(hotel.x + 2, hotel.z + 9, Math.PI * 0.9);
  world.missions.stageShowdownAt(state, hotel.x, hotel.z + 12);
  world.missions.refreshBeacon(state);
  camera.pin(
    new THREE.Vector3(player.mesh.position.x + 6, 3.8, player.mesh.position.z + 13),
    new THREE.Vector3(hotel.x + 1, 1.2, hotel.z + 8),
  );
  return {
    mode: MODE_FOOT,
    car: null,
    objective: 'Job 4 · Brisa Showdown — Shove the Brisa crew (0/3)',
    missionTarget: hotel,
    prompt: 'Click — Shove the crew',
  };
}
