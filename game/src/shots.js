// The four screenshot scenes behind ?shot=chase|cockpit|approach|landing. Each one stages a
// real flight state — position, attitude, speed, rings passed, score — through the same
// physics state, world, aircraft and HUD the player sees, then paints it. No mock scene,
// no borrowed image: the frame is what the game itself renders from that state.
import * as THREE from 'three';

const DEG = Math.PI / 180;

function place(state, opts) {
  state.mode = 'mission';
  state.phase = opts.phase || 'air';
  state.pos.set(opts.x, opts.y, opts.z);
  state.prevPos.copy(state.pos);
  state.quat.setFromEuler(
    new THREE.Euler((opts.pitchDeg || 0) * DEG, -opts.headingDeg * DEG, (opts.bankDeg || 0) * DEG, 'YXZ'),
  );
  state.speed = opts.speed;
  state.throttle = opts.throttle;
  state.gear = opts.gear !== false;
  state.flaps = !!opts.flaps;
  state.ringIndex = opts.ringIndex || 0;
  state.streak = opts.ringIndex || 0;
  state.score = opts.score || 0;
  state.time = opts.time || 0;
  state.fuel = opts.fuel === undefined ? 78 : opts.fuel;
  state.vspeed = opts.vspeed || 0;
  state.stalled = false;
  state.lowFuel = state.fuel < 25;
}

/** Stage the named scene and return the camera mode it wants. */
export function stageShot(name, game) {
  const { state, world } = game;
  if (name === 'cockpit') {
    // Over the harbour, nose on the lighthouse ring, lit panel in frame. The aircraft
    // sits 40 m below the ring so it clears the dashboard in the frame.
    place(state, {
      x: 2200, y: 100, z: 100, headingDeg: 17, speed: 80, throttle: 0.7,
      ringIndex: 2, score: 1620, time: 54, fuel: 86,
    });
    world.resetRings();
    for (let i = 0; i < 2; i += 1) world.setRingPassed(i);
    world.setNextRing(2);
    game.setCameraMode('cockpit');
    return 'cockpit';
  }
  if (name === 'approach') {
    // On final for runway 09: gear and flaps out, descending 350 fpm, PAPI ahead.
    place(state, {
      x: -800, y: 55, z: 2300, headingDeg: 90, pitchDeg: -3, speed: 52, throttle: 0.35,
      gear: true, flaps: true, ringIndex: 8, score: 8200, time: 168, fuel: 41, vspeed: -1.78,
    });
    world.resetRings();
    for (let i = 0; i < 8; i += 1) world.setRingPassed(i);
    world.setNextRing(8);
    game.setCameraMode('chase');
    return 'approach';
  }
  if (name === 'landing') {
    // Rolled out on the runway with the scorecard up: a finished, replayable loop.
    place(state, {
      x: 150, y: 13.6, z: 2300, headingDeg: 90, speed: 0, throttle: 0,
      ringIndex: 8, score: 9240, time: 192, fuel: 100, phase: 'landed',
    });
    state.landingScore = 2860;
    state.timeBonus = 272;
    state.grade = 'S';
    state.landing = { vsFpm: -320, centreOffset: 4, headingErr: 2 };
    world.resetRings();
    for (let i = 0; i < 8; i += 1) world.setRingPassed(i);
    world.setNextRing(8);
    game.setCameraMode('chase');
    game.showResults({
      grade: 'S',
      score: 9240,
      rings: 8,
      ringsTotal: 8,
      timeSec: 192,
      landingScore: 2860,
      timeBonus: 272,
      landing: state.landing,
      crashed: false,
    });
    return 'landing';
  }
  // Default: chase — banked into a turn mid-course, ring 4 ahead, ridge behind.
  place(state, {
    x: 1400, y: 300, z: -1400, headingDeg: 326, bankDeg: 18, speed: 85, throttle: 0.75,
    ringIndex: 3, score: 2450, time: 82, fuel: 72,
  });
  world.resetRings();
  for (let i = 0; i < 3; i += 1) world.setRingPassed(i);
  world.setNextRing(3);
  game.setCameraMode('chase');
  return 'chase';
}
