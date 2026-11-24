// state.js — shared game state (money, wanted level, health, story progress).
// Shared state: money, wanted, health, story.

export const MODE_FOOT='foot';
export const MODE_DRIVE='drive';
export const MODE_MENU='menu';
export const MODE_PAUSED='paused';
export const MODE_BUSTED='busted';
export const MODE_WASTED='wasted';

export function createGameState() {
	return {
		mode: MODE_MENU,
		cash: 250,
		reputation: 0,
		health: 100,
		armour: 0,
		wanted: 0,
		bustedTimer: 0,
		hideTimer: 0,

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

export function addWanted(state,stars) {
	state.wanted=Math.max(0,Math.min(5,state.wanted + stars));
}

export function setWantedAtLeast(state,stars) {
	if (state.wanted < stars) state.wanted=stars;
}

export function showMessage(state,text,seconds=3.5) {
	state.message=text;
	state.messageTimer=seconds;
}
