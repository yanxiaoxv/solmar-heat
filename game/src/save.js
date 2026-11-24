// save.js — the versioned localStorage save record.
// Save: the one localStorage record, versioned once.

export const SAVE_KEY='solmar-heat-save-v1';

export function loadSave() {
	try {
		const raw=window.localStorage.getItem(SAVE_KEY);
		if (!raw) return null;
		const data=JSON.parse(raw);
		if (typeof data !== 'object' || data === null) return null;
		return data;
	} catch {
		return null;
	}
}

export function writeSave(state) {
	try {
		window.localStorage.setItem(SAVE_KEY,JSON.stringify({
			cash: state.cash,
			reputation: state.reputation,
			missionIndex: state.missionIndex,
			missionStage: state.missionStage,
			rivalsDown: state.rivalsDown,
			carsStolen: state.carsStolen,
			taxiRuns: state.taxiRuns,
			garageOwned: state.garageOwned,
		}));
	} catch {

	}
}

export function applySave(state,save) {
	if (!save) return;

	if (Number.isFinite(save.cash)) state.cash=save.cash;
	if (Number.isFinite(save.reputation)) state.reputation=save.reputation;
	if (Number.isFinite(save.missionIndex)) state.missionIndex=Math.max(0,Math.min(5,Math.floor(save.missionIndex)));
	if (Number.isFinite(save.missionStage)) state.missionStage=Math.max(0,Math.min(2,Math.floor(save.missionStage)));
	if (Number.isFinite(save.rivalsDown)) state.rivalsDown=Math.max(0,Math.min(3,Math.floor(save.rivalsDown)));
	if (Number.isFinite(save.carsStolen)) state.carsStolen=save.carsStolen;
	if (Number.isFinite(save.taxiRuns)) state.taxiRuns=save.taxiRuns;
	if (save.garageOwned === true) state.garageOwned=true;
}
