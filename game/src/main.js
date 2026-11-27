// Boot and the one loop for SKYBOUND: LAST LIGHT. Input is read every frame, the flight
// advances in fixed 1/60 s steps, and the renderer paints what is there. Screens: title,
// play, paused, results. ?shot=chase|cockpit|approach|landing stages that scene instead
// of running the loop, paints it three times and sets window.__shotReady for a screenshot.
import * as THREE from 'three';
import { createFlightState, resetFlight, stepFlight, computeTelemetry, STEP } from './physics.js';
import { buildWorld } from './world.js';
import { buildAircraft } from './aircraft.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import {
  createInput,
  ACTION_CONFIRM,
  ACTION_PAUSE,
  ACTION_CAMERA,
  ACTION_RESTART,
  ACTION_FLAPS,
  ACTION_GEAR,
} from './input.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const sceneCanvas = document.getElementById('scene');
const hudCanvas = document.getElementById('hud');
const titleEl = document.getElementById('title');
const resultsEl = document.getElementById('results');
const pausedEl = document.getElementById('paused');
const statusEl = document.getElementById('status');

const renderer = new THREE.WebGLRenderer({ canvas: sceneCanvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 20000);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const world = buildWorld(scene);
const aircraft = buildAircraft(scene);
const hud = createHud(hudCanvas);
const audio = createAudio();
const inputCtl = createInput(sceneCanvas);
const state = createFlightState('mission');

let screen = 'title';
let cameraMode = 'chase';
const chasePos = new THREE.Vector3();
const chaseLook = new THREE.Vector3();
let titleAngle = 0;

function announce(message) {
  statusEl.textContent = message;
}

function syncAircraft() {
  aircraft.group.position.copy(state.pos);
  aircraft.group.quaternion.copy(state.quat);
}

function updateCamera(dt, snap) {
  if (screen === 'title') {
    titleAngle += dt * 0.08;
    camera.position.set(
      state.pos.x + Math.cos(titleAngle) * 26,
      state.pos.y + 8,
      state.pos.z + Math.sin(titleAngle) * 26,
    );
    camera.lookAt(state.pos.x, state.pos.y + 1, state.pos.z);
    return;
  }
  if (cameraMode === 'cockpit') {
    // Pilot's eye, inside the fuselage: the hull is front-sided, so it is invisible
    // from in here and the panel, the wings and the world ahead read cleanly.
    // y=0.6 puts the eye below the fuselage crown (y≈0.76 here): any higher and the
    // cowling's shoulders draw a dark Λ over the panel. The lowered panel (y=0.2)
    // keeps the next ring visible above its top edge.
    const eye = new THREE.Vector3(0, 0.6, -0.1).applyQuaternion(state.quat).add(state.pos);
    const look = new THREE.Vector3(0, 0.5, -40).applyQuaternion(state.quat).add(state.pos);
    camera.position.copy(eye);
    camera.lookAt(look);
    return;
  }
  const desired = new THREE.Vector3(0, 4.2, 16).applyQuaternion(state.quat).add(state.pos);
  const look = new THREE.Vector3(0, 0.6, -32).applyQuaternion(state.quat).add(state.pos);
  if (snap) {
    chasePos.copy(desired);
    chaseLook.copy(look);
  }
  const k = 1 - Math.exp(-dt * 9); // tight follow: the camera never fights the pilot
  chasePos.lerp(desired, k);
  chaseLook.lerp(look, k);
  camera.position.copy(chasePos);
  camera.lookAt(chaseLook);
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function showResults(data) {
  document.getElementById('result-grade').textContent = data.crashed ? 'CRASHED' : data.grade;
  document.getElementById('result-grade').className = 'grade ' + (data.crashed ? 'grade-crash' : 'grade-' + data.grade);
  document.getElementById('result-score').textContent = data.score.toLocaleString('en-US');
  document.getElementById('result-rings').textContent = data.rings + '/' + data.ringsTotal;
  document.getElementById('result-time').textContent = fmtTime(data.timeSec);
  const detail = document.getElementById('result-detail');
  if (data.crashed) {
    detail.textContent = data.crashReason + ' — ring points kept, no landing bonus.';
  } else {
    detail.textContent =
      'Landing ' +
      data.landingScore.toLocaleString('en-US') +
      ' pts  ·  sink ' +
      data.landing.vsFpm +
      ' fpm  ·  centreline ' +
      data.landing.centreOffset +
      ' m off  ·  heading ' +
      data.landing.headingErr +
      '° off  ·  time bonus ' +
      data.timeBonus.toLocaleString('en-US') +
      ' pts';
  }
  document.getElementById('result-mode').textContent = data.mode === 'free' ? 'FREE FLIGHT' : 'MISSION — LAST LIGHT';
  resultsEl.classList.remove('hidden');
  announce(data.crashed ? 'Crashed. ' + data.crashReason : 'Landed. Grade ' + data.grade + '. Score ' + data.score + '.');
}

function hideOverlays() {
  titleEl.classList.add('hidden');
  resultsEl.classList.add('hidden');
  pausedEl.classList.add('hidden');
}

function startGame(mode) {
  resetFlight(state, mode);
  world.resetRings();
  if (mode === 'free') {
    for (const ring of world.rings) ring.group.visible = false;
    world.setNextRing(99);
  } else {
    for (const ring of world.rings) ring.group.visible = true;
    world.setNextRing(0);
  }
  hideOverlays();
  screen = 'play';
  cameraMode = 'chase';
  syncAircraft();
  updateCamera(1, true);
  audio.start();
  announce(mode === 'free' ? 'Free flight. Throttle up with Shift, pull up with S.' : 'Mission. Take off, fly the 8 rings, land on runway 09.');
}

function handleActions() {
  const actions = inputCtl.takeActions();
  if (actions & ACTION_CONFIRM) {
    if (screen === 'title' || screen === 'results') startGame('mission');
  }
  if (actions & ACTION_PAUSE) {
    if (screen === 'play') {
      screen = 'paused';
      pausedEl.classList.remove('hidden');
    } else if (screen === 'paused') {
      screen = 'play';
      pausedEl.classList.add('hidden');
    }
  }
  if (actions & ACTION_CAMERA && screen === 'play') {
    cameraMode = cameraMode === 'chase' ? 'cockpit' : 'chase';
    updateCamera(1, true);
  }
  if (actions & ACTION_RESTART && screen !== 'title') startGame(state.mode);
  if (actions & ACTION_FLAPS && screen === 'play') state.flaps = !state.flaps;
  if (actions & ACTION_GEAR && screen === 'play') state.gear = !state.gear;
}

function stepOnce(input) {
  const prevRing = state.ringIndex;
  const prevPhase = state.phase;
  stepFlight(state, input, STEP);
  if (state.ringIndex > prevRing) {
    audio.ring();
    world.setRingPassed(prevRing);
    world.setNextRing(state.ringIndex);
  }
  if (state.phase === 'landed' && prevPhase === 'air') {
    audio.touchdown();
    screen = 'results';
    showResults({
      grade: state.grade,
      score: state.score,
      rings: state.ringIndex,
      ringsTotal: 8,
      timeSec: Math.round(state.time),
      landingScore: state.landingScore,
      timeBonus: state.timeBonus,
      landing: state.landing,
      crashed: false,
      mode: state.mode,
    });
  }
  if (state.phase === 'crashed' && prevPhase !== 'crashed') {
    audio.crash();
    screen = 'results';
    showResults({
      grade: 'CRASHED',
      score: state.score,
      rings: state.ringIndex,
      ringsTotal: 8,
      timeSec: Math.round(state.time),
      landingScore: 0,
      timeBonus: 0,
      landing: null,
      crashed: true,
      crashReason: state.crashReason,
      mode: state.mode,
    });
  }
  if (state.stalled) audio.stall();
}

function runGame() {
  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    handleActions();
    const input = inputCtl.read();
    if (screen === 'play' || (screen === 'results' && state.phase === 'landed')) {
      accumulator += dt;
      let guard = 0;
      while (accumulator >= STEP && guard < 8) {
        stepOnce(input);
        accumulator -= STEP;
        guard += 1;
        if (screen !== 'play' && state.phase !== 'landed') break;
      }
      if (guard >= 8) accumulator = 0;
    }
    const telemetry = computeTelemetry(state);
    aircraft.update(dt, telemetry, input);
    world.update(dt, state.pos);
    audio.update(telemetry);
    syncAircraft();
    updateCamera(dt, false);
    renderer.render(scene, camera);
    if (screen !== 'title') hud.draw(telemetry, { cockpit: cameraMode === 'cockpit' });
  }
  announce('Skybound Last Light. Press Space or click Start Mission to fly.');
  requestAnimationFrame(frame);
}

const gameApi = {
  state,
  world,
  setCameraMode(mode) {
    cameraMode = mode;
  },
  showResults,
};

// A small handle for play-testing and for the screenshot tooling: the flight state,
// the world and the camera. It changes nothing about the game itself.
window.__skybound = { state, world, camera, startGame, version: 'skybound-last-light/1' };

if (shot) {
  screen = 'play'; // the shot stages a flight, not the title orbit camera
  hideOverlays();
  stageShot(shot, gameApi);
  // The landing scorecard slides left so the parked aircraft shows beside it
  // instead of hiding directly behind the card.
  if (shot === 'landing') resultsEl.classList.add('side');
  syncAircraft();
  updateCamera(1, true);
  const telemetry = computeTelemetry(state);
  aircraft.update(0.016, telemetry, { pitch: 0, roll: 0, yaw: 0 });
  world.update(0.016, state.pos);
  let painted = 0;
  function paint() {
    renderer.render(scene, camera);
    hud.draw(computeTelemetry(state), { cockpit: cameraMode === 'cockpit' });
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
} else {
  document.getElementById('start-btn').addEventListener('click', () => startGame('mission'));
  document.getElementById('free-btn').addEventListener('click', () => startGame('free'));
  document.getElementById('again-btn').addEventListener('click', () => startGame('mission'));
  document.getElementById('free2-btn').addEventListener('click', () => startGame('free'));
  runGame();
}
