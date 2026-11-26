// Arcade flight model for SKYBOUND: LAST LIGHT. No aerodynamics simulation: a rate-based
// model with bank-to-turn coupling, a stall that drops the nose, and a forgiving touchdown.
// Orientation is a quaternion throughout, so the camera can never gimbal-lock.
import * as THREE from 'three';
import { terrainHeight, RUNWAY, RING_COURSE, RING_RADIUS, START } from './world.js';

export const STEP = 1 / 60;
export const STALL_SPEED = 30; // m/s; below this the wing stops flying
const FORWARD = new THREE.Vector3(0, 0, -1);
const RIGHT = new THREE.Vector3(1, 0, 0);
const tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const tmpQuat = new THREE.Quaternion();
const tmpVec = new THREE.Vector3();

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/** Heading in degrees (0 = north, 90 = east) from a quaternion. */
export function headingFromQuat(quat) {
  tmpVec.copy(FORWARD).applyQuaternion(quat);
  const h = (Math.atan2(tmpVec.x, -tmpVec.z) * 180) / Math.PI;
  return (h + 360) % 360;
}

/** Bank angle in degrees, positive when the right wing is up (banked left). */
export function bankFromQuat(quat) {
  tmpVec.copy(RIGHT).applyQuaternion(quat);
  return (Math.asin(clamp(tmpVec.y, -1, 1)) * 180) / Math.PI;
}

function gradeFor(score) {
  if (score >= 9000) return 'S';
  if (score >= 8000) return 'A';
  if (score >= 6500) return 'B';
  if (score >= 5000) return 'C';
  return 'D';
}

export function createFlightState(mode) {
  return {
    mode, // 'mission' | 'free'
    phase: 'ground', // ground | air | landed | crashed
    pos: new THREE.Vector3(START.x, START.y, START.z),
    prevPos: new THREE.Vector3(START.x, START.y, START.z),
    quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -((START.headingDeg * Math.PI) / 180), 0, 'YXZ')),
    speed: 0,
    throttle: 0,
    gear: true,
    flaps: false,
    fuel: 100,
    time: 0,
    score: 0,
    streak: 0,
    ringIndex: 0,
    lastRingGain: 0,
    lastRingAt: -99,
    vspeed: 0,
    stalled: false,
    lowFuel: false,
    landingScore: 0,
    timeBonus: 0,
    grade: 'D',
    crashReason: '',
    landedOnRunway: false,
    landing: null,
  };
}

export function resetFlight(state, mode) {
  const fresh = createFlightState(mode);
  Object.assign(state, fresh);
}

function crash(state, reason) {
  state.phase = 'crashed';
  state.crashReason = reason;
  state.grade = 'CRASHED';
  state.speed = 0;
}

function touchdown(state, groundH, velY) {
  const onRunway =
    Math.abs(state.pos.x) < RUNWAY.length / 2 && Math.abs(state.pos.z - RUNWAY.z) < RUNWAY.width / 2 + 4;
  const bankDeg = Math.abs(bankFromQuat(state.quat));
  const vs = velY;
  state.pos.y = groundH + 1.6;
  if (vs < -12 || bankDeg > 35) {
    crash(state, vs < -12 ? 'Hard impact — sank too fast' : 'Wingtip strike — landed banked');
    return;
  }
  if (!onRunway && vs < -6) {
    crash(state, 'Rough-field impact — missed the runway');
    return;
  }
  state.phase = 'landed';
  const centreOffset = onRunway ? Math.abs(state.pos.z - RUNWAY.z) : 40;
  const heading = headingFromQuat(state.quat);
  let headingErr = Math.abs(heading - RUNWAY.headingDeg);
  if (headingErr > 180) headingErr = 360 - headingErr;
  const landingScore = Math.max(
    400,
    Math.round(3000 - Math.abs(vs) * 55 - centreOffset * 6 - headingErr * 4 - bankDeg * 3),
  );
  const timeBonus = state.mode === 'mission' ? Math.max(0, Math.round((260 - state.time) * 4)) : 0;
  state.landingScore = landingScore;
  state.timeBonus = timeBonus;
  state.score = Math.min(10000, state.score + landingScore + timeBonus);
  state.landedOnRunway = onRunway;
  state.landing = {
    vsFpm: Math.round(vs * 196.85),
    centreOffset: Math.round(centreOffset),
    headingErr: Math.round(headingErr),
  };
  state.grade = gradeFor(state.score);
  state.fuel = 100; // the crew refuels on the apron
}

/**
 * Advance the flight by dt seconds. input: { pitch, roll, yaw } each in [-1, 1],
 * plus throttleUp, throttleDown, airbrake, brake booleans. Returns nothing; the state
 * carries everything the renderer, HUD and gauges read.
 */
export function stepFlight(state, input, dt) {
  if (state.phase === 'crashed') return;
  state.time += dt;

  if (state.fuel > 0) {
    if (input.throttleUp) state.throttle = Math.min(1, state.throttle + 0.55 * dt);
    if (input.throttleDown) state.throttle = Math.max(0, state.throttle - 0.7 * dt);
  } else {
    state.throttle = 0;
  }
  if (state.phase === 'air' && state.throttle > 0.05) {
    state.fuel = Math.max(0, state.fuel - state.throttle * 0.3 * dt);
  }

  let target = 28 + state.throttle * 95;
  if (state.flaps) target -= 12;
  if (input.airbrake) target -= 32;
  if (state.phase === 'ground') target = state.throttle * 55;
  if (state.phase === 'landed') target = 0; // roll-out: the landing is over, just slow down
  const rate = state.phase === 'ground' || state.phase === 'landed' ? 1.1 : 0.55;
  state.speed += (target - state.speed) * Math.min(1, rate * dt);
  if (state.speed < 0) state.speed = 0;

  const bankDeg = bankFromQuat(state.quat);
  const bank = (bankDeg * Math.PI) / 180;
  const authority = state.phase === 'air' ? clamp((state.speed - 16) / 42, 0.12, 1) : 0;
  const stalled = state.phase === 'air' && state.speed < STALL_SPEED;

  if (state.phase === 'air') {
    let pitchRate = input.pitch * 0.55 * authority;
    let rollRate = input.roll * 0.95 * authority;
    let yawRate = input.yaw * 0.35 * authority;
    yawRate += -bank * 0.22 * authority; // bank-to-turn coupling
    if (Math.abs(input.roll) < 0.05) rollRate += -bank * 0.45 * authority; // gentle auto-level
    if (stalled) pitchRate -= 0.28 * (1 - state.speed / STALL_SPEED); // stall drops the nose
    tmpEuler.set(pitchRate * dt, yawRate * dt, rollRate * dt);
    tmpQuat.setFromEuler(tmpEuler);
    state.quat.multiply(tmpQuat);
    state.quat.normalize();
  } else {
    // Rolling: steer with the rudder, proportional to speed.
    const steer = input.yaw * 0.5 * clamp(state.speed / 18, 0, 1);
    tmpEuler.set(0, steer * dt, 0);
    tmpQuat.setFromEuler(tmpEuler);
    state.quat.multiply(tmpQuat);
    state.quat.normalize();
    if (state.phase === 'ground' && state.speed > 36 && input.pitch > 0.3) {
      state.phase = 'air';
      tmpEuler.set(0.12, 0, 0);
      tmpQuat.setFromEuler(tmpEuler);
      state.quat.multiply(tmpQuat);
    }
  }

  tmpVec.copy(FORWARD).applyQuaternion(state.quat);
  const velX = tmpVec.x * state.speed;
  let velY = tmpVec.y * state.speed;
  const velZ = tmpVec.z * state.speed;
  if (stalled) velY -= (STALL_SPEED - state.speed) * 0.5;
  if (state.phase === 'ground' || state.phase === 'landed') velY = 0;
  state.prevPos.copy(state.pos);
  state.pos.x += velX * dt;
  state.pos.y += velY * dt;
  state.pos.z += velZ * dt;
  state.vspeed = velY;

  const groundH = terrainHeight(state.pos.x, state.pos.z);
  if (state.phase === 'air') {
    if (groundH < 0 && state.pos.y < 1.2) {
      crash(state, 'Ditched in the sea');
    } else if (state.pos.y <= groundH + 1.6 && velY < -0.5) {
      touchdown(state, groundH, velY);
    } else if (state.pos.y < groundH + 1.6) {
      state.pos.y = groundH + 1.6; // skim the ground, do not sink through it
    }
  } else {
    state.pos.y = groundH + 1.6;
    const drag = input.brake || state.phase === 'landed' ? 9 : 1.2;
    state.speed = Math.max(0, state.speed - drag * dt);
  }

  // Rings: flying within 26 m of a ring centre counts as passing it (the ring itself is 20 m).
  if (state.mode === 'mission' && state.phase === 'air' && state.ringIndex < RING_COURSE.length) {
    const ring = RING_COURSE[state.ringIndex];
    const d = Math.hypot(state.pos.x - ring.x, state.pos.y - ring.y, state.pos.z - ring.z);
    if (d < RING_RADIUS + 6) {
      const centreBonus = Math.max(0, (RING_RADIUS - d) / RING_RADIUS) * 200;
      const gained = Math.round((500 + centreBonus) * (1 + 0.05 * state.streak));
      state.score += gained;
      state.streak += 1;
      state.ringIndex += 1;
      state.lastRingGain = gained;
      state.lastRingAt = state.time;
    }
  }

  state.stalled = stalled;
  state.lowFuel = state.fuel < 25;
}

/** Plain numbers the HUD and the cockpit gauges both read, so they can never disagree. */
export function computeTelemetry(state) {
  const groundH = terrainHeight(state.pos.x, state.pos.z);
  const heading = headingFromQuat(state.quat);
  let nextDist = 0;
  let nextBearing = 0;
  if (state.mode === 'mission' && state.ringIndex < RING_COURSE.length) {
    const ring = RING_COURSE[state.ringIndex];
    const dx = ring.x - state.pos.x;
    const dz = ring.z - state.pos.z;
    nextDist = Math.hypot(dx, state.pos.y - ring.y, dz);
    const bearingTo = (Math.atan2(dx, -dz) * 180) / Math.PI;
    let rel = bearingTo - heading;
    while (rel > 180) rel -= 360;
    while (rel < -180) rel += 360;
    nextBearing = rel;
  }
  return {
    altFt: Math.round(state.pos.y * 3.28084),
    altAglFt: Math.round(Math.max(0, state.pos.y - Math.max(groundH, 0)) * 3.28084),
    speedKt: Math.round(state.speed * 1.94384),
    headingDeg: Math.round(heading),
    vsFpm: Math.round(state.vspeed * 196.85),
    pitchDeg: Math.round((Math.asin(clamp(tmpVec.copy(FORWARD).applyQuaternion(state.quat).y, -1, 1)) * 180) / Math.PI),
    bankDeg: Math.round(bankFromQuat(state.quat)),
    throttlePct: Math.round(state.throttle * 100),
    fuelPct: Math.round(state.fuel),
    gear: state.gear,
    flaps: state.flaps,
    ring: state.ringIndex,
    ringsTotal: RING_COURSE.length,
    nextDistM: Math.round(nextDist),
    nextBearingDeg: Math.round(nextBearing),
    score: state.score,
    timeSec: Math.round(state.time),
    stalled: state.stalled,
    lowFuel: state.lowFuel,
    fuelEmpty: state.fuel <= 0,
    phase: state.phase,
    mode: state.mode,
    streak: state.streak,
    lastRingGain: state.lastRingGain,
    lastRingAt: state.lastRingAt,
  };
}
