// Input: held key set; one-shots queued as flags.

export const ACTION_INTERACT=1;
export const ACTION_PAUSE=2;
export const ACTION_CONFIRM=4;
export const ACTION_ATTACK=8;

const KEY_ACTIONS=new Map([
	['KeyE',ACTION_INTERACT],
	['KeyF',ACTION_INTERACT],
	['Escape',ACTION_PAUSE],
	['KeyP',ACTION_PAUSE],
	['Enter',ACTION_CONFIRM],
]);

export function createInput(canvas) {
	const held=new Set();
	let queuedActions=0;
	let mouseDX=0;
	let mouseDY=0;
	let attacking=false;
	let lastAttackAt=-Infinity;
	let pressPending=false;
	let pressFrames=0;
	let attackFrameFlag=false;

	window.addEventListener('keydown',(event) => {
		if (event.repeat) return;
		held.add(event.code);
		const action=KEY_ACTIONS.get(event.code);
		if (action) queuedActions |= action;
	});
	window.addEventListener('keyup',(event) => {
		held.delete(event.code);
	});
	window.addEventListener('blur',() => {
		held.clear();
		attacking=false;
		pressPending=false;
	});

	document.addEventListener('visibilitychange',() => {
		if (document.hidden) {
			held.clear();
			attacking=false;
			pressPending=false;
		}
	});
	canvas.addEventListener('mousedown',(event) => {
		if (event.button === 0) {
			attacking=true;
			lastAttackAt=performance.now();
			pressPending=true;
			pressFrames=0;
		}
	});
	window.addEventListener('mouseup',(event) => {
		if (event.button === 0) attacking=false;
	});
	document.addEventListener('mousemove',(event) => {
		if (document.pointerLockElement === canvas) {
			mouseDX += event.movementX || 0;
			mouseDY += event.movementY || 0;
		}
	});

	return {
		isDown(code) {
			return held.has(code);
		},
		moveAxis() {
			let x=0;
			let z=0;
			if (held.has('KeyW') || held.has('ArrowUp')) z -= 1;
			if (held.has('KeyS') || held.has('ArrowDown')) z += 1;
			if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1;
			if (held.has('KeyD') || held.has('ArrowRight')) x += 1;
			return { x,z };
		},
		running() {
			return held.has('ShiftLeft') || held.has('ShiftRight');
		},
		handbrake() {
			return held.has('Space');
		},
		beginFrame() {

			if (pressPending && performance.now() - lastAttackAt > 3000) pressPending=false;
			attackFrameFlag=attacking || pressPending;
			if (pressPending && !attacking) {
				pressFrames += 1;
				if (pressFrames >= 2) pressPending=false;
			}
		},
		isAttacking() {
			return attackFrameFlag;
		},
		takeActions() {
			const actions=queuedActions;
			queuedActions=0;
			return actions;
		},
		takeMouseDelta() {
			const delta={ x: mouseDX,y: mouseDY };
			mouseDX=0;
			mouseDY=0;
			return delta;
		},
		requestPointerLock() {
			if (document.pointerLockElement !== canvas) {
				try {

					const attempt=canvas.requestPointerLock?.();
					if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
				} catch {

				}
			}
		},
		releasePointerLock() {
			if (document.pointerLockElement === canvas) document.exitPointerLock?.();
		},
	};
}
