// Keyboard and mouse input for Solmar Heat. Keys are tracked as a held set so
// movement can read them every frame, while one-shot actions (enter a car,
// pause, confirm) are queued as flags the game loop consumes exactly once.
// Pointer lock mouse movement feeds the camera orbit yaw and pitch.

export const ACTION_INTERACT = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CONFIRM = 4;
export const ACTION_ATTACK = 8;

const KEY_ACTIONS = new Map([
  ['KeyE', ACTION_INTERACT],
  ['KeyF', ACTION_INTERACT],
  ['Escape', ACTION_PAUSE],
  ['KeyP', ACTION_PAUSE],
  ['Enter', ACTION_CONFIRM],
]);

export function createInput(canvas) {
  const held = new Set();
  let queuedActions = 0;
  let mouseDX = 0;
  let mouseDY = 0;
  let attacking = false;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    const action = KEY_ACTIONS.get(event.code);
    if (action) queuedActions |= action;
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
    attacking = false;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) attacking = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) attacking = false;
  });
  document.addEventListener('mousemove', (event) => {
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
      let x = 0;
      let z = 0;
      if (held.has('KeyW') || held.has('ArrowUp')) z -= 1;
      if (held.has('KeyS') || held.has('ArrowDown')) z += 1;
      if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1;
      if (held.has('KeyD') || held.has('ArrowRight')) x += 1;
      return { x, z };
    },
    running() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    handbrake() {
      return held.has('Space');
    },
    isAttacking() {
      return attacking;
    },
    takeActions() {
      const actions = queuedActions;
      queuedActions = 0;
      return actions;
    },
    takeMouseDelta() {
      const delta = { x: mouseDX, y: mouseDY };
      mouseDX = 0;
      mouseDY = 0;
      return delta;
    },
    requestPointerLock() {
      if (document.pointerLockElement !== canvas) {
        try {
          // Chrome returns a promise here; a call without a fresh user
          // gesture rejects, and that rejection must never reach the console.
          const attempt = canvas.requestPointerLock?.();
          if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
        } catch {
          // Pointer lock is a nicety, never a blocker for play.
        }
      }
    },
    releasePointerLock() {
      if (document.pointerLockElement === canvas) document.exitPointerLock?.();
    },
  };
}
