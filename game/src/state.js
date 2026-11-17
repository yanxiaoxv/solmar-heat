// Shared game state for Solmar Heat: money, wanted level, health, story progress
// and the localStorage save that survives a reload. Every other module reads
// and writes through this one object so the HUD, police and missions never
// keep private copies that can drift apart.

export const SAVE_KEY = 'solmar-heat-save-v1';

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
    missionIndex: 0,
    missionStage: 'idle',
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

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.cash,
      reputation: state.reputation,
      missionIndex: state.missionIndex,
      carsStolen: state.carsStolen,
    }));
  } catch {
    // Private windows can refuse storage; the run simply is not saved.
  }
}

export function applySave(state, save) {
  if (!save) return;
  if (Number.isFinite(save.cash)) state.cash = save.cash;
  if (Number.isFinite(save.reputation)) state.reputation = save.reputation;
  if (Number.isFinite(save.missionIndex)) state.missionIndex = save.missionIndex;
  if (Number.isFinite(save.carsStolen)) state.carsStolen = save.carsStolen;
}

export function showMessage(state, text, seconds = 3.5) {
  state.message = text;
  state.messageTimer = seconds;
}
