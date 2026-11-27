// The aircraft: one clean procedural bush plane built from Three.js primitives — tapered
// fuselage, wings with moving ailerons and flaps, spinning prop, blinking nav lights,
// retractable gear — plus a 3D cockpit dashboard whose six gauges are a live CanvasTexture,
// so the instruments in the cockpit view are lit by the same telemetry as the HUD.
import * as THREE from 'three';

const NAVY = 0x2a4d7a; // lightened steel navy: the v1 fuselage read as a black silhouette
const NAVY_LIGHT = 0x2f5d8f;
const GOLD = 0xe8a33d;

function buildGauges() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 448;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;

  function dial(cx, cy, r, label) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#0d1218';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#c8c8c8';
    ctx.stroke();
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, cy + r + 30);
    ctx.restore();
  }
  function needle(cx, cy, r, angle, colour) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.strokeStyle = colour || '#ffcf4d';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(0, -r + 12);
    ctx.stroke();
    ctx.fillStyle = '#ffcf4d';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  function ticks(cx, cy, r, count, startDeg, endDeg) {
    for (let i = 0; i <= count; i += 1) {
      const a = ((startDeg + ((endDeg - startDeg) * i) / count - 90) * Math.PI) / 180;
      ctx.strokeStyle = '#c8c8c8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r - 10), cy + Math.sin(a) * (r - 10));
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.stroke();
    }
  }

  function drawAttitude(t, cx, cy, r) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate((-t.bankDeg * Math.PI) / 180);
    const pitchPx = Math.max(-r, Math.min(r, t.pitchDeg * 2.2));
    ctx.fillStyle = '#3a7bd5';
    ctx.fillRect(-r, -r + pitchPx, r * 2, r - pitchPx);
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(-r, pitchPx, r * 2, r - pitchPx + r);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-r, pitchPx);
    ctx.lineTo(r, pitchPx);
    ctx.stroke();
    for (const d of [-20, -10, 10, 20]) {
      const y = pitchPx + d * 2.2;
      if (Math.abs(y) > r - 6) continue;
      ctx.beginPath();
      ctx.moveTo(-22, y);
      ctx.lineTo(22, y);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = '#ffcf4d';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-34, 0);
    ctx.lineTo(-12, 0);
    ctx.moveTo(12, 0);
    ctx.lineTo(34, 0);
    ctx.stroke();
    ctx.fillStyle = '#ffcf4d';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Ring and label only: the dial helper would paint over the horizon.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#c8c8c8';
    ctx.stroke();
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ATT', cx, cy + r + 30);
    ctx.restore();
  }
  function drawAirspeed(t, cx, cy, r) {
    dial(cx, cy, r, 'AIRSPEED KT');
    ticks(cx, cy, r, 10, -120, 120);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(((-120 + (Math.min(t.speedKt, 200) / 200) * 240) * Math.PI) / 180);
    ctx.strokeStyle = '#ffcf4d';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(0, -r + 12);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(t.speedKt), cx, cy + 34);
  }
  function drawAltimeter(t, cx, cy, r) {
    dial(cx, cy, r, 'ALT FT');
    ticks(cx, cy, r, 10, -120, 120);
    const a = ((-120 + ((t.altFt % 1000) / 1000) * 240) * Math.PI) / 180;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.strokeStyle = '#ffcf4d';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(0, -r + 12);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(t.altFt), cx, cy + 34);
  }
  function drawCompass(t, cx, cy, r) {
    dial(cx, cy, r, 'HDG');
    const dirs = ['N', 'E', 'S', 'W'];
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((-t.headingDeg * Math.PI) / 180);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < 4; i += 1) {
      const a = (i * Math.PI) / 2;
      ctx.fillText(dirs[i], Math.sin(a) * (r - 22), -Math.cos(a) * (r - 22) + 9);
    }
    ctx.strokeStyle = '#c8c8c8';
    ctx.lineWidth = 3;
    for (let i = 0; i < 12; i += 1) {
      const a = (i * Math.PI) / 6;
      ctx.beginPath();
      ctx.moveTo(Math.sin(a) * (r - 8), -Math.cos(a) * (r - 8));
      ctx.lineTo(Math.sin(a) * r, -Math.cos(a) * r);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#ffcf4d';
    ctx.beginPath();
    ctx.moveTo(cx, cy - r + 2);
    ctx.lineTo(cx - 8, cy - r + 16);
    ctx.lineTo(cx + 8, cy - r + 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 30px monospace';
    ctx.fillText(String(t.headingDeg).padStart(3, '0'), cx, cy + 34);
  }
  function drawVsi(t, cx, cy, r) {
    dial(cx, cy, r, 'VSI FPM');
    ticks(cx, cy, r, 8, -120, 120);
    const v = Math.max(-2000, Math.min(2000, t.vsFpm));
    const a = ((-120 + ((v + 2000) / 4000) * 240) * Math.PI) / 180;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.strokeStyle = '#ffcf4d';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(0, -r + 12);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.fillText((v >= 0 ? '+' : '') + String(v), cx, cy + 34);
  }
  function drawRpm(t, cx, cy, r) {
    dial(cx, cy, r, 'RPM %');
    ticks(cx, cy, r, 10, -120, 120);
    const a = ((-120 + (t.throttlePct / 100) * 240) * Math.PI) / 180;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.strokeStyle = t.fuelEmpty ? '#ff5555' : '#7dff5e';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(0, -r + 12);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(t.throttlePct), cx, cy + 34);
  }

  function draw(t) {
    ctx.fillStyle = '#141a22';
    ctx.fillRect(0, 0, 1024, 448);
    ctx.strokeStyle = '#2c3644';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, 1016, 440);
    // Warning lights.
    const lamps = [
      { label: 'STALL', on: t.stalled, colour: '#ff4444' },
      { label: 'LOW FUEL', on: t.lowFuel, colour: '#ffb02e' },
      { label: 'GEAR', on: t.gear, colour: '#7dff5e' },
      { label: 'FLAPS', on: t.flaps, colour: '#7dc8ff' },
    ];
    lamps.forEach((lamp, i) => {
      const x = 120 + i * 260;
      ctx.fillStyle = lamp.on ? lamp.colour : '#2a323d';
      ctx.beginPath();
      ctx.arc(x, 44, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c8c8c8';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(lamp.label, x + 26, 51);
    });
    ctx.fillStyle = '#e8a33d';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('SKYBOUND', 1000, 52);
    const cy = 250;
    const r = 72;
    drawAttitude(t, 105, cy, r);
    drawAirspeed(t, 275, cy, r);
    drawAltimeter(t, 445, cy, r);
    drawCompass(t, 615, cy, r);
    drawVsi(t, 785, cy, r);
    drawRpm(t, 935, cy, r);
    // Fuel bar along the bottom.
    ctx.fillStyle = '#2a323d';
    ctx.fillRect(60, 400, 904, 18);
    ctx.fillStyle = t.fuelPct < 25 ? '#ffb02e' : '#7dc8ff';
    ctx.fillRect(60, 400, 904 * (t.fuelPct / 100), 18);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('FUEL ' + t.fuelPct + '%', 60, 392);
    texture.needsUpdate = true;
  }
  return { texture, draw };
}

export function buildAircraft(scene) {
  const group = new THREE.Group();
  const navy = new THREE.MeshLambertMaterial({ color: NAVY });
  const navyLight = new THREE.MeshLambertMaterial({ color: NAVY_LIGHT });
  const gold = new THREE.MeshBasicMaterial({ color: GOLD });

  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.95, 4.6, 12), navy);
  fuselage.rotation.x = Math.PI / 2;
  group.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.5, 12), navy);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.05;
  group.add(nose);
  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.3, 12), navy);
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.z = 2.9;
  group.add(tailCone);
  for (const side of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 4.4), gold);
    stripe.position.set(side * 0.93, 0.1, 0);
    group.add(stripe);
  }
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.75, 16, 12),
    // FrontSide only: from the pilot's seat the canopy must be invisible, so its
    // dark arch never covers the instrument panel in cockpit view.
    new THREE.MeshPhongMaterial({ color: 0x9fc8e8, transparent: true, opacity: 0.15, side: THREE.FrontSide, shininess: 140, specular: 0xccddff }),
  );
  canopy.scale.set(0.9, 0.72, 1.7);
  canopy.position.set(0, 0.55, -0.9);
  group.add(canopy);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(11, 0.16, 1.9), navyLight);
  wing.position.set(0, -0.1, -0.4);
  group.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 1.9), gold);
    tip.position.set(side * 5.4, -0.1, -0.4);
    group.add(tip);
  }
  const aileronL = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.7), navy);
  aileronL.position.set(-3.9, -0.1, 0.7);
  group.add(aileronL);
  const aileronR = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.7), navy);
  aileronR.position.set(3.9, -0.1, 0.7);
  group.add(aileronR);
  const flapL = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.8), navy);
  flapL.position.set(-1.7, -0.1, 0.72);
  group.add(flapL);
  const flapR = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.8), navy);
  flapR.position.set(1.7, -0.1, 0.72);
  group.add(flapR);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 1.1), navyLight);
  stab.position.set(0, 0.15, 2.6);
  group.add(stab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.7, 1.5), navy);
  fin.position.set(0, 0.85, 2.7);
  group.add(fin);
  const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.4, 0.7), navyLight);
  rudder.position.set(0, 0.8, 3.5);
  group.add(rudder);

  const prop = new THREE.Group();
  // Translucent disc + soft blades: from the cockpit the prop reads as a blur,
  // not a solid black slab sweeping past the panel.
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.5, 24),
    new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.15, side: THREE.DoubleSide }),
  );
  prop.add(disc);
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.9, 0.08), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.38 }));
    blade.rotation.z = a;
    prop.add(blade);
  }
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 10), gold);
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -0.3;
  prop.add(spinner);
  prop.position.set(0, 0, -3.8);
  group.add(prop);

  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  navL.position.set(-5.5, -0.1, -0.4);
  group.add(navL);
  const navR = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0x22ff66 }));
  navR.position.set(5.5, -0.1, -0.4);
  group.add(navR);
  const tailLight = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  tailLight.position.set(0, 0.2, 3.6);
  group.add(tailLight);

  const gear = new THREE.Group();
  const strutMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [x, z] of [[0, -2.2], [-1.6, 0.6], [1.6, 0.6]]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.9, 8), strutMat);
    strut.position.set(x, -0.85, z);
    gear.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 10), wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, -1.28, z);
    gear.add(wheel);
  }
  group.add(gear);

  // Cockpit dashboard with the live six-pack, facing the pilot.
  const gauges = buildGauges();
  const panelMats = [
    new THREE.MeshLambertMaterial({ color: 0x141a22 }),
    new THREE.MeshLambertMaterial({ color: 0x141a22 }),
    new THREE.MeshLambertMaterial({ color: 0x141a22 }),
    new THREE.MeshLambertMaterial({ color: 0x141a22 }),
    new THREE.MeshBasicMaterial({ map: gauges.texture }),
    new THREE.MeshLambertMaterial({ color: 0x141a22 }),
  ];
  const panel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.85, 0.22), panelMats);
  // Lowered so the next ring clears its top edge from the pilot's seat (eye inside
  // the fuselage at y=0.6): the panel top sits just under the horizon, world above it.
  panel.position.set(0, 0.2, -1.9);
  panel.rotation.x = -0.22;
  group.add(panel);

  scene.add(group);
  let strobeTimer = 0;
  return {
    group,
    update(dt, telemetry, input) {
      prop.rotation.z += dt * (3 + telemetry.speedKt * 0.12);
      aileronL.rotation.x = input.roll * 0.35;
      aileronR.rotation.x = -input.roll * 0.35;
      flapL.rotation.x = telemetry.flaps ? 0.5 : 0;
      flapR.rotation.x = telemetry.flaps ? 0.5 : 0;
      rudder.rotation.y = -input.yaw * 0.4;
      gear.visible = telemetry.gear;
      strobeTimer += dt;
      const strobe = strobeTimer % 1.1 < 0.12;
      tailLight.material.color.set(strobe ? 0xffffff : 0x333333);
      gauges.draw(telemetry);
    },
  };
}
