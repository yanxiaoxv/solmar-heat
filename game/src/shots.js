// Deterministic screenshot staging for Solmar Heat. A ?shot= scene positions
// the real game actors — player, cars, pedestrians, HUD state — exactly as a
// moment of play would, then pins the camera. The renderer draws the live
// scene twice and flags window.__shotReady so the capture tool can fire.
// Scenes: foot (downtown stroll), drive (coastal cruise), chase (wanted,
// police on the tail — staged fully once police land in M2; for M1 it frames
// a hot pursuit by patrol-coloured cars), menu (the start screen over the bay).

import * as THREE from 'three';
import { MODE_DRIVE, MODE_FOOT, MODE_MENU } from './state.js';

export function stageShot(name, world, state, camera) {
  const { player } = world;
  if (name === 'drive') {
    state.mode = MODE_DRIVE;
    const car = world.parkedCars[0];
    // Place the red coupe on the coast avenue, rolling south toward the marina.
    car.placeAt(22, 60, 0);
    car.speed = 17;
    player.setVisible(false);
    player.mesh.position.copy(car.mesh.position);
    state.cash = 640;
    camera.pin(
      new THREE.Vector3(car.mesh.position.x - 8.5, 3.6, car.mesh.position.z - 11),
      new THREE.Vector3(car.mesh.position.x + 2, 1.2, car.mesh.position.z + 12),
    );
    return { mode: MODE_DRIVE, car };
  }
  if (name === 'chase') {
    state.mode = MODE_DRIVE;
    state.wanted = 3;
    state.cash = 890;
    const car = world.parkedCars[4];
    car.placeAt(-22, 18, Math.PI);
    car.speed = 21;
    player.setVisible(false);
    player.mesh.position.copy(car.mesh.position);
    camera.pin(
      new THREE.Vector3(car.mesh.position.x + 9, 4.2, car.mesh.position.z + 12),
      new THREE.Vector3(car.mesh.position.x - 1, 1.1, car.mesh.position.z - 10),
    );
    return { mode: MODE_DRIVE, car };
  }
  if (name === 'menu') {
    state.mode = MODE_MENU;
    player.placeAt(22, 132, Math.PI);
    camera.pin(
      new THREE.Vector3(10, 5.5, 118),
      new THREE.Vector3(26, 1.5, 150),
    );
    return { mode: MODE_MENU, car: null };
  }
  // Default: on foot downtown at Coral Plaza, traffic rolling past.
  state.mode = MODE_FOOT;
  state.cash = 250;
  player.placeAt(-22 + 5, -8, Math.PI * 0.8);
  camera.pin(
    new THREE.Vector3(player.mesh.position.x - 7, 3.4, player.mesh.position.z - 8),
    new THREE.Vector3(player.mesh.position.x + 4, 1.4, player.mesh.position.z + 9),
  );
  return { mode: MODE_FOOT, car: null };
}
