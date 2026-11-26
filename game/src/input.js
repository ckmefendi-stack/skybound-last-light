// Keyboard and mouse input. Keyboard alone must fly the whole game; the mouse is an
// optional stick (click the canvas to capture it). Edge-triggered actions are consumed
// once by the main loop through takeActions().
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CAMERA = 4;
export const ACTION_RESTART = 8;
export const ACTION_FLAPS = 16;
export const ACTION_GEAR = 32;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mousePitch = 0;
  let mouseRoll = 0;
  let pointerLocked = false;

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') {
      actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyC') {
      actions |= ACTION_CAMERA;
    } else if (event.code === 'KeyR') {
      actions |= ACTION_RESTART;
    } else if (event.code === 'KeyF') {
      actions |= ACTION_FLAPS;
    } else if (event.code === 'KeyG') {
      actions |= ACTION_GEAR;
    }
    if (event.code === 'ArrowUp' || event.code === 'ArrowDown' || event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
      event.preventDefault();
    }
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onMouseMove(event) {
    if (!pointerLocked) return;
    mousePitch += -event.movementY * 0.0035;
    mouseRoll += -event.movementX * 0.0035;
  }
  function onClick() {
    if (!pointerLocked && canvas.requestPointerLock) canvas.requestPointerLock();
  }
  function onLockChange() {
    pointerLocked = document.pointerLockElement === canvas;
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('pointerlockchange', onLockChange);
  canvas.addEventListener('click', onClick);

  /** Continuous -1..1 stick deflections from keys and (captured) mouse. */
  function read() {
    let pitch = 0;
    let roll = 0;
    let yaw = 0;
    if (keys.has('KeyS') || keys.has('ArrowDown')) pitch += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) pitch -= 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) roll += 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) roll -= 1;
    if (keys.has('KeyQ')) yaw += 1;
    if (keys.has('KeyE')) yaw -= 1;
    pitch += mousePitch;
    roll += mouseRoll;
    mousePitch *= 0.86;
    mouseRoll *= 0.86;
    return {
      pitch: Math.max(-1, Math.min(1, pitch)),
      roll: Math.max(-1, Math.min(1, roll)),
      yaw: Math.max(-1, Math.min(1, yaw)),
      throttleUp: keys.has('ShiftLeft') || keys.has('ShiftRight'),
      throttleDown: keys.has('ControlLeft') || keys.has('ControlRight'),
      airbrake: keys.has('Space'),
      brake: keys.has('KeyB'),
    };
  }

  function takeActions() {
    const taken = actions;
    actions = 0;
    return taken;
  }

  return { read, takeActions };
}
