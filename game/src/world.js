// World simulation for Solmar Heat: owns the city, the player, every car and
// pedestrian, and steps them together each frame. Mode switching lives here
// too: stepping into a parked or traffic car (which its owner may object to),
// driving it, and climbing back out onto the sidewalk.

import * as THREE from 'three';
import { buildCity, LANDMARKS } from './city.js';
import { Player } from './player.js';
import { createParkedCars, createTraffic, nearestCar } from './vehicles.js';
import { createPedestrians, scareCrowd } from './pedestrians.js';
import { MODE_DRIVE, MODE_FOOT, addWanted, showMessage } from './state.js';

export function createWorld(scene, seed = 7) {
  const city = buildCity(scene, seed);
  const player = new Player(scene, -22 + 4, -14);
  const parkedCars = createParkedCars(scene);
  const traffic = createTraffic(scene);
  const pedestrians = createPedestrians(scene, 16);
  const allCars = [...parkedCars, ...traffic];

  let currentCar = null;
  let visitedMarina = false;

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
      const car = nearestCar(allCars, player.mesh.position, 3.4);
      if (!car) return false;
      currentCar = car;
      car.occupied = true;
      if (traffic.includes(car)) {
        // Dragging a driver out in broad daylight is noticed.
        addWanted(state, 1);
        state.carsStolen += 1;
        showMessage(state, 'Vehicle taken! The owner called it in.');
        scareCrowd(pedestrians, car.mesh.position.x, car.mesh.position.z, 12);
        const index = traffic.indexOf(car);
        traffic.splice(index, 1);
      } else if (!car.everDriven) {
        state.carsStolen += 1;
        showMessage(state, `${car.spec.label} borrowed. Try not to scratch it.`);
      }
      car.everDriven = true;
      player.setVisible(false);
      state.mode = MODE_DRIVE;
      return true;
    }
    if (state.mode === MODE_DRIVE && currentCar) {
      const car = currentCar;
      car.occupied = false;
      const sideX = Math.cos(car.heading) * -1.8;
      const sideZ = Math.sin(car.heading) * 1.8;
      player.placeAt(car.mesh.position.x + sideX, car.mesh.position.z + sideZ, car.heading);
      player.setVisible(true);
      currentCar = null;
      state.mode = MODE_FOOT;
      return true;
    }
    return false;
  }

  function update(dt, state, input, cameraYaw) {
    city.update(dt);
    let prompt = '';
    let speedKmh = 0;
    let danger = null;

    if (state.mode === MODE_FOOT) {
      player.updateOnFoot(dt, input.moveAxis(), cameraYaw, input.running(), city.colliders);
      const car = nearestCar(allCars, player.mesh.position, 3.4);
      if (car) prompt = `E — Get in the ${car.spec.label}`;
    } else if (state.mode === MODE_DRIVE && currentCar) {
      const axis = input.moveAxis();
      const speed = currentCar.drive(dt, -axis.z, axis.x, input.handbrake(), city.colliders);
      speedKmh = speed * 3.6;
      state.topSpeed = Math.max(state.topSpeed, speedKmh);
      prompt = 'E — Step out';
      if (speed > 7) danger = { x: currentCar.mesh.position.x, z: currentCar.mesh.position.z, radius: 8 };
      // Running a red... well, running into things is what draws attention in M2.
      player.mesh.position.copy(currentCar.mesh.position);
    }

    for (const car of traffic) car.updateTraffic(dt, traffic);
    for (const person of pedestrians) person.update(dt, danger);

    // Free-roam objective for the skeleton build: reach the marina boardwalk.
    let objective = 'Free roam — reach the Solmar Marina boardwalk';
    let missionTarget = LANDMARKS[0];
    const focus = focusPosition(state);
    if (!visitedMarina) {
      const dist = Math.hypot(focus.x - missionTarget.x, focus.z - missionTarget.z);
      if (dist < 7) {
        visitedMarina = true;
        state.cash += 100;
        state.reputation += 1;
        showMessage(state, 'Marina reached! +$100 — the city is yours to explore.');
      } else {
        objective = `Free roam — reach the Solmar Marina (${Math.round(dist)} m)`;
      }
    } else {
      objective = 'Free roam — steal a ride, outrun your curiosity, enjoy Solmar Bay';
      missionTarget = null;
    }

    return {
      objective,
      prompt,
      speedKmh,
      missionTarget,
      playerPos: focus,
      playerHeading: focusHeading(state),
      cars: allCars,
      police: [],
      pedestrians,
    };
  }

  return {
    city,
    player,
    parkedCars,
    traffic,
    pedestrians,
    allCars,
    handleInteract,
    focusPosition,
    focusHeading,
    update,
    get currentCar() { return currentCar; },
  };
}

export function createSunlight(scene) {
  // Late-afternoon Solmar sun: warm key light, sky-blue fill, soft shadows.
  const sun = new THREE.DirectionalLight(0xffdfb0, 2.6);
  sun.position.set(-70, 95, -45);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -160;
  sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160;
  sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 320;
  scene.add(sun);
  const sky = new THREE.HemisphereLight(0xbfe3ff, 0x8a7a56, 0.95);
  scene.add(sky);
  const ambient = new THREE.AmbientLight(0xffe8c8, 0.35);
  scene.add(ambient);
  return sun;
}
