// Shared game state for Solmar Heat: money, wanted level, health, story
// progress and the timers the police and mission systems share. Every other
// module reads and writes through this one object so the HUD, police and
// missions never keep private copies that can drift apart. Persistence
// lives in save.js; this module only owns the live shape.

export const MODE_FOOT = 'foot';
export const MODE_DRIVE = 'drive';
export const MODE_MENU = 'menu';
export const MODE_PAUSED = 'paused';
export const MODE_BUSTED = 'busted';
export const MODE_WASTED = 'wasted';

export function createGameState() {
  return {
    mode: MODE_MENU,
    cash: 250,
    reputation: 0,
    health: 100,
    armour: 0,
    wanted: 0,
    wantedTimer: 0,
    bustedTimer: 0,
    hideTimer: 0,
    // Story progress: missionIndex counts finished jobs (0-5, 5 = the
    // Rayo Garage is Nico's), missionStage is the step inside the current
    // job, rivalsDown tracks the M4 showdown between saves.
    missionIndex: 0,
    missionStage: 0,
    rivalsDown: 0,
    garageOwned: false,
    taxiRuns: 0,
    playSeconds: 0,
    carsStolen: 0,
    topSpeed: 0,
    message: '',
    messageTimer: 0,
  };
}

export function addWanted(state, stars) {
  state.wanted = Math.max(0, Math.min(5, state.wanted + stars));
  state.wantedTimer = 0;
}

export function setWantedAtLeast(state, stars) {
  if (state.wanted < stars) {
    state.wanted = stars;
    state.wantedTimer = 0;
  }
}

export function showMessage(state, text, seconds = 3.5) {
  state.message = text;
  state.messageTimer = seconds;
}
