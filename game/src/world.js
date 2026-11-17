// World simulation for Solmar Heat: owns the city, the player, every car and
// pedestrian, and steps them together each frame. Mode switching lives here
// too: stepping into a parked or traffic car (which its owner may object to),
// driving it, and climbing back out onto the sidewalk.

import * as THREE from 'three';
import { buildCity, LANDMARKS, ROAD_POSITIONS } from './city.js';
import { Player } from './player.js';
import { createParkedCars, createTraffic, nearestCar } from './vehicles.js';
import { createPedestrians, scareCrowd } from './pedestrians.js';
import { PoliceUnit, spawnPointNear } from './police.js';
import { createCombat } from './combat.js';
import { MODE_DRIVE, MODE_FOOT, MODE_BUSTED, MODE_WASTED, addWanted, showMessage } from './state.js';

export function createWorld(scene, seed = 7) {
  const city = buildCity(scene, seed);
  const player = new Player(scene, -22 + 4, -14);
  const parkedCars = createParkedCars(scene);
  const traffic = createTraffic(scene);
  const pedestrians = createPedestrians(scene, 16);
  const policeUnits = [];
  const combat = createCombat();
  let crimeCooldown = 0;
  let ramCooldown = 0;

  function getAllCars() {
    return [...parkedCars, ...traffic, ...policeUnits.map((unit) => unit.car)];
  }

  let currentCar = null;
  let visitedMarina = false;
  let driveHintShown = false;

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
      const car = nearestCar(getAllCars(), player.mesh.position, 3.4);
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
      if (!driveHintShown) {
        driveHintShown = true;
        showMessage(state, 'WASD drives, Space is the handbrake, E steps out.', 5);
      }
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

  function resolveCarBumps(state) {
    // Circle-versus-circle bumps: the driven car shoves parked and traffic
    // cars and loses speed; traffic gives a walking player a rude push
    // instead of passing through him.
    if (state.mode === MODE_DRIVE && currentCar) {
      for (const other of getAllCars()) {
        if (other === currentCar) continue;
        const dx = currentCar.mesh.position.x - other.mesh.position.x;
        const dz = currentCar.mesh.position.z - other.mesh.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.01 && dist < 3.3) {
          const push = (3.3 - dist) / dist;
          currentCar.mesh.position.x += dx * push * 0.7;
          currentCar.mesh.position.z += dz * push * 0.7;
          if (Math.abs(currentCar.speed) > 8) {
            currentCar.health = Math.max(5, currentCar.health - 4);
            showMessage(state, 'Careful! The car is taking damage.');
          }
          currentCar.speed *= 0.45;
        }
      }
    }
    if (state.mode === MODE_FOOT) {
      for (const car of traffic) {
        const dx = player.mesh.position.x - car.mesh.position.x;
        const dz = player.mesh.position.z - car.mesh.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.01 && dist < 1.9) {
          player.mesh.position.x += (dx / dist) * (1.9 - dist);
          player.mesh.position.z += (dz / dist) * (1.9 - dist);
        }
      }
    }
  }

  function update(dt, state, input, cameraYaw) {
    city.update(dt);
    let prompt = '';
    let speedKmh = 0;
    let danger = null;

    if (state.mode === MODE_FOOT) {
      player.updateOnFoot(dt, input.moveAxis(), cameraYaw, input.running(), city.colliders);
      const car = nearestCar(getAllCars(), player.mesh.position, 3.4);
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
    resolveCarBumps(state);
    for (const person of pedestrians) person.update(dt, danger);
    updateCrimeAndPolice(dt, state, input);

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
      cars: getAllCars(),
      police: policeUnits.map((unit) => unit.car),
      pedestrians,
    };
  }

  function policeDistanceTo(focus) {
    let nearest = Infinity;
    for (const unit of policeUnits) {
      const dist = Math.hypot(unit.position.x - focus.x, unit.position.z - focus.z);
      if (dist < nearest) nearest = dist;
    }
    return nearest;
  }

  function updateCrimeAndPolice(dt, state, input) {
    if (crimeCooldown > 0) crimeCooldown -= dt;
    if (ramCooldown > 0) ramCooldown -= dt;
    combat.update(dt);
    const focus = focusPosition(state);

    // Melee on foot, with the patrol as witness.
    if (state.mode === MODE_FOOT && input.isAttacking()) {
      const hit = combat.tryAttack(player, pedestrians, getAllCars());
      if (hit && hit.kind === 'pedestrian' && policeDistanceTo(focus) < 30 && crimeCooldown <= 0) {
        crimeCooldown = 2.5;
        addWanted(state, 1);
        showMessage(state, 'The patrol saw that shove! Wanted level up.');
      }
    }

    // Driving through a pedestrian is a serious crime, once per incident.
    if (state.mode === MODE_DRIVE && currentCar && Math.abs(currentCar.speed) > 4) {
      for (const person of pedestrians) {
        const dist = Math.hypot(person.mesh.position.x - focus.x, person.mesh.position.z - focus.z);
        if (dist < 1.6 && person.fallTimer <= 0) {
          person.knockDown();
          if (crimeCooldown <= 0) {
            crimeCooldown = 3;
            addWanted(state, 1);
            showMessage(state, 'You hit a pedestrian! The patrol is coming.');
          }
        }
      }
    }

    // The patrol answers the stars: one unit per star, at most four.
    const desired = Math.min(state.wanted, 4);
    while (policeUnits.length < desired) {
      const spot = spawnPointNear(focus, policeUnits.length);
      policeUnits.push(new PoliceUnit(scene, spot.x, spot.z, spot.heading));
      if (policeUnits.length === desired) showMessage(state, 'Sirens — the Solmar Patrol is rolling!');
    }
    while (policeUnits.length > desired) {
      const unit = policeUnits.pop();
      unit.dispose(scene);
    }
    const target = {
      x: focus.x,
      z: focus.z,
      speed: state.mode === MODE_DRIVE && currentCar ? Math.abs(currentCar.speed) : 0,
      heading: focusHeading(state),
    };
    for (const unit of policeUnits) unit.update(dt, target, city.colliders, state.wanted, ROAD_POSITIONS);

    // A patrol car that catches a walking player at speed hurts.
    if (state.mode === MODE_FOOT && ramCooldown <= 0) {
      for (const unit of policeUnits) {
        const dist = Math.hypot(unit.position.x - focus.x, unit.position.z - focus.z);
        if (dist < 2.2 && Math.abs(unit.car.speed) > 6) {
          ramCooldown = 1.4;
          state.health = Math.max(0, state.health - 22);
          player.mesh.position.x += (focus.x - unit.position.x) * 0.9;
          player.mesh.position.z += (focus.z - unit.position.z) * 0.9;
          showMessage(state, 'The patrol clipped you! Keep moving or give up distance.');
          break;
        }
      }
    }

    // Hiding: break line of pursuit for a while and the stars bleed off.
    const nearestPolice = policeDistanceTo(focus);
    if (state.wanted > 0 && nearestPolice > 58) {
      state.hideTimer += dt;
      if (state.hideTimer > 10) {
        state.hideTimer = 0;
        addWanted(state, -1);
        showMessage(state, state.wanted === 0 ? 'You lost them. Wanted level cleared.' : 'You are losing them — stay out of sight.');
      }
    } else {
      state.hideTimer = 0;
    }

    // Busted: cornered on foot, or boxed in while crawling in a car.
    const playerSpeed = state.mode === MODE_DRIVE && currentCar ? Math.abs(currentCar.speed) : 0;
    const cornered = state.wanted > 0 && (
      (state.mode === MODE_FOOT && nearestPolice < 3.6) ||
      (state.mode === MODE_DRIVE && playerSpeed < 3 && nearestPolice < 7)
    );
    if (cornered) {
      state.bustedTimer += dt;
      if (state.bustedTimer > 0.4 && state.bustedTimer < 1.9) {
        showMessage(state, 'The patrol has you cornered — move!', 0.4);
      }
      if (state.bustedTimer >= 1.9) {
        state.bustedTimer = 0;
        state.mode = MODE_BUSTED;
      }
    } else {
      state.bustedTimer = Math.max(0, state.bustedTimer - dt * 2);
    }

    if (state.health <= 0 && state.mode !== MODE_WASTED) {
      state.mode = MODE_WASTED;
    }
  }

  function respawnPlayer(state) {
    if (currentCar) {
      currentCar.occupied = false;
      currentCar = null;
    }
    while (policeUnits.length > 0) policeUnits.pop().dispose(scene);
    state.wanted = 0;
    state.hideTimer = 0;
    state.bustedTimer = 0;
    state.health = 100;
    player.placeAt(-22 + 6, -16, Math.PI);
    player.setVisible(true);
    state.mode = MODE_FOOT;
  }

  function stagePolice(count, behind) {
    // Screenshot staging: raise the patrol and park the nearest unit right
    // behind the given point, light bar flashing.
    const focus = { x: behind.x, z: behind.z };
    while (policeUnits.length < count) {
      const spot = spawnPointNear(focus, policeUnits.length);
      policeUnits.push(new PoliceUnit(scene, spot.x, spot.z, spot.heading));
    }
    if (policeUnits.length > 0) {
      const unit = policeUnits[0];
      const back = 8.5;
      const side = 2.1;
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
    get allCars() { return getAllCars(); },
    handleInteract,
    focusPosition,
    focusHeading,
    update,
    respawnPlayer,
    stagePolice,
    get currentCar() { return currentCar; },
  };
}

export function createSunlight(scene) {
  // Late-afternoon Solmar sun: warm key light, sky-blue fill, soft shadows.
  const sun = new THREE.DirectionalLight(0xffdfb0, 2.6);
  sun.position.set(-70, 95, -45);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
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
