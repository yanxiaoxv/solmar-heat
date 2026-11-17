// Heads-up display for Solmar Heat: wanted stars, cash, health bar, mission
// objective banner, centre message, speed readout, interaction prompt and
// the live minimap. The minimap is a small canvas redrawn each frame from
// the same world data the 3D scene uses, so it can never disagree with it.

import { ROAD_POSITIONS, CITY_HALF } from './city.js';

const MAP_RANGE = CITY_HALF + 26;

export function createHud() {
  const elements = {
    stars: document.getElementById('hud-stars'),
    cash: document.getElementById('hud-cash'),
    healthFill: document.getElementById('hud-health-fill'),
    armourFill: document.getElementById('hud-armour-fill'),
    objective: document.getElementById('hud-objective'),
    message: document.getElementById('hud-message'),
    speed: document.getElementById('hud-speed'),
    prompt: document.getElementById('hud-prompt'),
    clock: document.getElementById('hud-clock'),
    minimap: document.getElementById('minimap'),
  };
  const mapCtx = elements.minimap.getContext('2d');
  const mapSize = elements.minimap.width;

  function worldToMap(x, z) {
    const scale = mapSize / (MAP_RANGE * 2);
    return {
      x: (x + MAP_RANGE) * scale,
      y: (z + MAP_RANGE) * scale,
    };
  }

  function drawMinimap(view) {
    const ctx = mapCtx;
    ctx.fillStyle = '#274d2e';
    ctx.fillRect(0, 0, mapSize, mapSize);
    // Water along the south edge.
    const shore = worldToMap(0, 150);
    ctx.fillStyle = '#1d7fa8';
    ctx.fillRect(0, shore.y, mapSize, mapSize - shore.y);
    ctx.fillStyle = '#f0d9a0';
    ctx.fillRect(0, worldToMap(0, 138).y, mapSize, shore.y - worldToMap(0, 138).y);
    // Roads.
    ctx.strokeStyle = '#565d66';
    ctx.lineWidth = Math.max(2, mapSize * 0.018);
    for (const pos of ROAD_POSITIONS) {
      const a = worldToMap(pos, -MAP_RANGE);
      const b = worldToMap(pos, MAP_RANGE);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      const c = worldToMap(-MAP_RANGE, pos);
      const d = worldToMap(MAP_RANGE, pos);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.stroke();
    }
    // Mission marker: a gold diamond that pulses.
    if (view.missionTarget) {
      const p = worldToMap(view.missionTarget.x, view.missionTarget.z);
      const r = 5 + Math.sin(performance.now() / 240) * 1.4;
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - r);
      ctx.lineTo(p.x + r, p.y);
      ctx.lineTo(p.x, p.y + r);
      ctx.lineTo(p.x - r, p.y);
      ctx.closePath();
      ctx.fill();
    }
    // Traffic and parked cars as pale dots, police as blue, pedestrians as dots.
    ctx.fillStyle = '#e8e8e8';
    for (const car of view.cars) {
      const p = worldToMap(car.mesh.position.x, car.mesh.position.z);
      ctx.fillRect(p.x - 1.6, p.y - 1.6, 3.2, 3.2);
    }
    ctx.fillStyle = '#6ec3ff';
    for (const cop of view.police) {
      const p = worldToMap(cop.mesh.position.x, cop.mesh.position.z);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffd9a0';
    for (const person of view.pedestrians) {
      const p = worldToMap(person.mesh.position.x, person.mesh.position.z);
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }
    // Player arrow, rotated to the current heading.
    const player = worldToMap(view.playerPos.x, view.playerPos.z);
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(-view.playerHeading + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111111';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.2, 5);
    ctx.lineTo(0, 2.6);
    ctx.lineTo(-4.2, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  return {
    update(state, view) {
      elements.stars.textContent = state.wanted > 0 ? '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted) : '';
      elements.stars.style.color = Math.floor(performance.now() / 400) % 2 === 0 || state.wanted < 3 ? '#ffd23f' : '#ff5566';
      elements.cash.textContent = `$${state.cash.toLocaleString('en-US')}`;
      elements.healthFill.style.width = `${Math.max(0, Math.min(100, state.health))}%`;
      elements.armourFill.style.width = `${Math.max(0, Math.min(100, state.armour))}%`;
      elements.objective.textContent = view.objective || '';
      elements.message.textContent = state.messageTimer > 0 ? state.message : '';
      elements.speed.textContent = view.speedKmh > 1 ? `${Math.round(view.speedKmh)} km/h` : '';
      elements.prompt.textContent = view.prompt || '';
      const minutes = Math.floor((state.playSeconds / 60) % 24 * 60 + 8 * 60) % (24 * 60);
      const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
      const mm = String(minutes % 60).padStart(2, '0');
      elements.clock.textContent = `${hh}:${mm}`;
      drawMinimap(view);
    },
    setVisible(visible) {
      document.getElementById('hud').style.display = visible ? 'block' : 'none';
    },
  };
}
