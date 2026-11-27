// The island of SKYBOUND: LAST LIGHT — one deterministic golden-hour island with a coastal
// airfield, a harbour, a lighthouse headland, a canyon bridge and a north ridge, plus the eight
// glowing rings of the mission course. terrainHeight is the single source of truth for ground
// height: the mesh, the physics and the landing check all read the same function.
import * as THREE from 'three';
import { createNoise, createRandom } from './random.js';

const noise = createNoise(1337);
const rand = createRandom(42);

export const RUNWAY = { x: 0, z: 2300, y: 12, length: 900, width: 40, headingDeg: 90 };
export const START = { x: -350, y: 13.6, z: 2300, headingDeg: 90 };

// Mission course: takeoff east, harbour, lighthouse, north ridge, bridge canyon, valley,
// then downwind and a final gate on the runway centreline for an east landing on 09.
export const RING_COURSE = [
  { x: 900, y: 70, z: 2300 },
  { x: 2000, y: 100, z: 1300 },
  { x: 2350, y: 140, z: -400 },
  { x: 1200, y: 320, z: -1700 },
  { x: -800, y: 300, z: -1900 },
  { x: -1700, y: 45, z: 150 },
  { x: -1600, y: 150, z: 1200 },
  { x: -1400, y: 80, z: 2300 },
];
export const RING_RADIUS = 20;

function smoothstep(a, b, t) {
  const u = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

/** Ground height in metres at (x, z). Sea floor is -25, the ocean plane sits at y = 0. */
export function terrainHeight(x, z) {
  const d = Math.hypot(x, z);
  const island = 1 - smoothstep(2400, 2950, d);
  if (island <= 0.02) return -25;
  let h = 16;
  h += 55 * noise.fbm(x * 0.00045, z * 0.00045, 3);
  h += 22 * noise.fbm(x * 0.0016 + 7, z * 0.0016 - 3, 2);
  // North mountain ridge.
  h += 330 * Math.exp(-Math.pow((z + 1750) / 650, 2)) * Math.exp(-Math.pow(x / 1900, 2));
  // East headland bump under the lighthouse.
  h += 55 * Math.exp(-(Math.pow((x - 2450) / 420, 2) + Math.pow((z + 250) / 420, 2)));
  // Canyon carve: a dry valley floor near 20 m along x = -1700.
  const canyon = Math.exp(-Math.pow((x + 1700) / 320, 2)) * (1 - smoothstep(900, 1100, Math.abs(z - 150)));
  h = h * (1 - 0.85 * canyon) + 20 * 0.85 * canyon;
  // Flat shelf for the runway.
  const rw = smoothstep(650, 350, Math.abs(x)) * smoothstep(260, 120, Math.abs(z - 2300));
  h = h * (1 - rw) + 12 * rw;
  // Flat shelf for the harbour.
  const hb = Math.exp(-(Math.pow((x - 1950) / 520, 2) + Math.pow((z - 950) / 520, 2)));
  h = h * (1 - hb) + 9 * hb;
  h *= island;
  return Math.max(h, -25);
}

function colourForHeight(h, slope, tint, forest) {
  const sand = new THREE.Color(0xd9b380);
  const grass = new THREE.Color(0x5a8f3c);
  const grassDry = new THREE.Color(0x8aa04a);
  const forestGreen = new THREE.Color(0x3a6b2e);
  const rock = new THREE.Color(0x8a7a6a);
  const snow = new THREE.Color(0xe9e9e9);
  const c = new THREE.Color();
  if (h < 4) c.copy(sand);
  else if (h < 130) {
    c.copy(grass).lerp(grassDry, Math.min(1, Math.max(0, tint)));
    // Dark forest patches break the smooth lawn into readable woodland.
    c.lerp(forestGreen, smoothstep(0.58, 0.78, forest) * 0.75);
  } else if (h < 300) c.copy(grass).lerp(rock, smoothstep(130, 300, h));
  else c.copy(rock).lerp(snow, smoothstep(300, 380, h));
  if (slope > 0.55) c.lerp(rock, Math.min(1, (slope - 0.55) * 2));
  return c;
}

function buildTerrain(scene) {
  const size = 6200;
  const seg = 130;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    const hx = terrainHeight(x + 8, z) - terrainHeight(x - 8, z);
    const hz = terrainHeight(x, z + 8) - terrainHeight(x, z - 8);
    const slope = Math.hypot(hx, hz) / 16;
    const tint = noise.fbm(x * 0.004 + 11, z * 0.004 - 5, 2) * 0.5 + 0.5;
    const forest = noise.fbm(x * 0.0013 + 31, z * 0.0013 + 17, 2) * 0.5 + 0.5;
    c.copy(colourForHeight(h, slope, tint, forest));
    const shade = 0.88 + 0.12 * noise.noise2(x * 0.02, z * 0.02);
    colours[i * 3] = c.r * shade;
    colours[i * 3 + 1] = c.g * shade;
    colours[i * 3 + 2] = c.b * shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  scene.add(mesh);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(14000, 14000),
    new THREE.MeshPhongMaterial({ color: 0x1f8a8a, transparent: true, opacity: 0.94, shininess: 140, specular: 0x99ccff }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = 0;
  scene.add(ocean);
}

function buildSky(scene) {
  const skyGeo = new THREE.SphereGeometry(9000, 24, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColour: { value: new THREE.Color(0x3a5a8a) },
      horizonColour: { value: new THREE.Color(0xffb36b) },
      sunDirection: { value: new THREE.Vector3(-0.72, 0.22, 0.45).normalize() },
      sunColour: { value: new THREE.Color(0xffd9a0) },
    },
    vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'varying vec3 vDir;',
      'uniform vec3 topColour; uniform vec3 horizonColour; uniform vec3 sunDirection; uniform vec3 sunColour;',
      'void main() {',
      '  float h = clamp(vDir.y, -0.08, 1.0);',
      '  vec3 col = mix(horizonColour, topColour, pow(max(h, 0.0), 0.55));',
      '  float d = max(dot(normalize(vDir), normalize(sunDirection)), 0.0);',
      '  float sun = pow(d, 220.0);',
      '  float glow = pow(d, 6.0);',
      '  float disc = smoothstep(0.9992, 0.9996, d);',
      '  col += sunColour * (sun * 0.9 + glow * 0.22 + disc * 1.8);',
      '  gl_FragColor = vec4(col, 1.0);',
      '}',
    ].join('\n'),
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  const sun = new THREE.DirectionalLight(0xffc07a, 3.0);
  sun.position.set(-4200, 1100, 2600);
  scene.add(sun);
  // Cool fill from the east so the aircraft is never a black silhouette.
  const fill = new THREE.DirectionalLight(0xbfd4ff, 0.85);
  fill.position.set(4000, 2000, -1000);
  scene.add(fill);
  scene.add(new THREE.HemisphereLight(0xffd9a0, 0x2c3e50, 1.15));
  scene.fog = new THREE.FogExp2(0xe8a06a, 0.00009);
}

function canvasNumberTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#f5f5f5';
  ctx.font = 'bold 84px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 70);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

function buildRunway(scene) {
  const group = new THREE.Group();
  const asphalt = new THREE.Mesh(
    new THREE.BoxGeometry(RUNWAY.length, 0.3, RUNWAY.width),
    new THREE.MeshLambertMaterial({ color: 0x3d3d3d }),
  );
  asphalt.position.set(RUNWAY.x, RUNWAY.y + 0.15, RUNWAY.z);
  group.add(asphalt);
  const white = new THREE.MeshBasicMaterial({ color: 0xf5f5f5 });
  for (let x = -400; x <= 400; x += 50) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(24, 0.06, 2), white);
    dash.position.set(x, RUNWAY.y + 0.34, RUNWAY.z);
    group.add(dash);
  }
  for (const end of [-1, 1]) {
    for (let i = -3; i <= 3; i += 1) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(18, 0.06, 3), white);
      bar.position.set(end * 420, RUNWAY.y + 0.34, RUNWAY.z + i * 5);
      group.add(bar);
    }
  }
  const num09 = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 36),
    new THREE.MeshBasicMaterial({ map: canvasNumberTexture('09'), transparent: true }),
  );
  num09.rotation.x = -Math.PI / 2;
  num09.rotation.z = Math.PI / 2;
  num09.position.set(-370, RUNWAY.y + 0.34, RUNWAY.z);
  group.add(num09);
  const num27 = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 36),
    new THREE.MeshBasicMaterial({ map: canvasNumberTexture('27'), transparent: true }),
  );
  num27.rotation.x = -Math.PI / 2;
  num27.rotation.z = -Math.PI / 2;
  num27.position.set(370, RUNWAY.y + 0.34, RUNWAY.z);
  group.add(num27);
  // Edge lights.
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xbfe3ff });
  for (let x = -440; x <= 440; x += 80) {
    for (const dz of [-21, 21]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), edgeMat);
      lamp.position.set(x, RUNWAY.y + 0.8, RUNWAY.z + dz);
      group.add(lamp);
    }
  }
  // Control tower and hangars beside the runway.
  const towerMat = new THREE.MeshLambertMaterial({ color: 0xd8d3c8 });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 30, 10), towerMat);
  tower.position.set(520, RUNWAY.y + 15, 2460);
  group.add(tower);
  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(12, 5, 12),
    new THREE.MeshPhongMaterial({ color: 0x223344, shininess: 120, specular: 0x99ccff }),
  );
  cab.position.set(520, RUNWAY.y + 32, 2460);
  group.add(cab);
  const hangarMat = new THREE.MeshLambertMaterial({ color: 0x9a8f7a });
  for (const hx of [-560, -620]) {
    const hangar = new THREE.Mesh(new THREE.BoxGeometry(46, 13, 34), hangarMat);
    hangar.position.set(hx, RUNWAY.y + 6.5, hx === -560 ? 2420 : 2180);
    group.add(hangar);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(48, 2, 36), new THREE.MeshLambertMaterial({ color: 0x6e6252 }));
    roof.position.set(hx, RUNWAY.y + 13.5, hx === -560 ? 2420 : 2180);
    group.add(roof);
  }
  scene.add(group);
  return group;
}

function buildPapi(scene) {
  // Four light units beside the runway near the touchdown zone; their red/white mix
  // follows the aircraft's height against a 3-degree glidepath.
  const group = new THREE.Group();
  const lenses = [];
  for (let i = 0; i < 4; i += 1) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 1.4), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    box.position.set(-300 + i * 12, RUNWAY.y + 1.2, RUNWAY.z + 34);
    const lens = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.9, 0.9),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    lens.position.set(-1.2, 0, 0);
    box.add(lens);
    lenses.push(lens);
    group.add(box);
  }
  scene.add(group);
  return {
    /** nWhite: how many of the four lenses show white (0..4). */
    setWhite(nWhite) {
      lenses.forEach((lens, i) => {
        lens.material.color.set(i < nWhite ? 0xffffff : 0xff2222);
      });
    },
  };
}

function buildLighthouse(scene) {
  const group = new THREE.Group();
  const gy = terrainHeight(2450, -250);
  const white = new THREE.MeshLambertMaterial({ color: 0xf5f0e6 });
  const red = new THREE.MeshLambertMaterial({ color: 0xc23b2e });
  let y = gy;
  for (let i = 0; i < 3; i += 1) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(5 - i * 0.6, 5.6 - i * 0.6, 10, 12), i % 2 === 0 ? white : red);
    band.position.set(2450, y + 5, -250);
    group.add(band);
    y += 10;
  }
  const lampRoom = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 3.4, 4, 10),
    new THREE.MeshPhongMaterial({ color: 0x222222, shininess: 100 }),
  );
  lampRoom.position.set(2450, y + 2, -250);
  group.add(lampRoom);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.8, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  lamp.position.set(2450, y + 2, -250);
  group.add(lamp);
  const beamGeo = new THREE.ConeGeometry(9, 320, 12, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false });
  const beamPivot = new THREE.Group();
  beamPivot.position.set(2450, y + 2, -250);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.rotation.z = Math.PI / 2;
  beam.position.set(160, 0, 0);
  beamPivot.add(beam);
  group.add(beamPivot);
  scene.add(group);
  return { beamPivot, lampY: y + 2 };
}

function buildBridge(scene) {
  const group = new THREE.Group();
  const deckMat = new THREE.MeshLambertMaterial({ color: 0x8a7f72 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(760, 3, 12), deckMat);
  deck.position.set(-1700, 75, 150);
  group.add(deck);
  const railMat = new THREE.MeshBasicMaterial({ color: 0xd96a2b });
  for (const dz of [-6, 6]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(760, 1.2, 0.6), railMat);
    rail.position.set(-1700, 77.2, 150 + dz);
    group.add(rail);
  }
  const towerMat = new THREE.MeshLambertMaterial({ color: 0x6e6252 });
  for (const tx of [-1950, -1450]) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(8, 92, 10), towerMat);
    tower.position.set(tx, 20 + 46, 150);
    group.add(tower);
    for (const side of [-1, 1]) {
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 210, 6), new THREE.MeshBasicMaterial({ color: 0x444444 }));
      cable.position.set(tx + side * 130, 62, 150);
      cable.rotation.z = side * 0.62;
      group.add(cable);
    }
  }
  scene.add(group);
  return group;
}

function buildHarbour(scene) {
  const group = new THREE.Group();
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x7a6a58 });
  for (const pz of [820, 1080]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(150, 2, 9), pierMat);
    pier.position.set(2130, 1.5, pz);
    group.add(pier);
  }
  const boats = [];
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xdde8f0 });
  const cabinMat = new THREE.MeshLambertMaterial({ color: 0x2b5d8a });
  for (let i = 0; i < 3; i += 1) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(13, 2.6, 4.4), hullMat);
    hull.position.y = 0.8;
    boat.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(5, 2.4, 3.4), cabinMat);
    cabin.position.set(-1, 3, 0);
    boat.add(cabin);
    boat.position.set(2140 + i * 30, 0, 880 + i * 55);
    boat.rotation.y = (rand() - 0.5) * 0.6;
    group.add(boat);
    boats.push(boat);
  }
  scene.add(group);
  return boats;
}

function buildClouds(scene) {
  const clouds = [];
  const mat = new THREE.MeshBasicMaterial({ color: 0xffe8cc, transparent: true, opacity: 0.85 });
  const geo = new THREE.SphereGeometry(1, 10, 8);
  for (let i = 0; i < 14; i += 1) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rand() * 3);
    for (let j = 0; j < puffs; j += 1) {
      const puff = new THREE.Mesh(geo, mat);
      const s = 34 + rand() * 60;
      puff.scale.set(s, s * 0.42, s * 0.8);
      puff.position.set((rand() - 0.5) * 130, (rand() - 0.5) * 12, (rand() - 0.5) * 60);
      cloud.add(puff);
    }
    cloud.position.set((rand() - 0.5) * 5600, 480 + rand() * 300, (rand() - 0.5) * 5600);
    scene.add(cloud);
    clouds.push(cloud);
  }
  return clouds;
}

function buildRings(scene) {
  const rings = [];
  for (let i = 0; i < RING_COURSE.length; i += 1) {
    const p = RING_COURSE[i];
    const group = new THREE.Group();
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(RING_RADIUS, 1.3, 12, 42),
      new THREE.MeshBasicMaterial({ color: 0x22e6ff }),
    );
    group.add(torus);
    const glow = new THREE.Mesh(
      new THREE.TorusGeometry(RING_RADIUS + 2.5, 0.55, 8, 42),
      new THREE.MeshBasicMaterial({ color: 0x22e6ff, transparent: true, opacity: 0.5 }),
    );
    group.add(glow);
    group.position.set(p.x, p.y, p.z);
    // Face the ring toward the previous course point so the pilot flies through its face.
    const prev = i === 0 ? { x: START.x, y: START.y + 20, z: START.z } : RING_COURSE[i - 1];
    group.lookAt(prev.x, prev.y, prev.z);
    scene.add(group);
    rings.push({ group, torus, glow, center: new THREE.Vector3(p.x, p.y, p.z), passed: false });
  }
  // A soft vertical beam marks the next ring so the pilot can always find it.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(2, 2, 320, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x22e6ff, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }),
  );
  scene.add(beacon);
  return { rings, beacon };
}

/** Low-poly woodland: two instanced meshes (trunks + canopies) so the island reads
 *  as terrain with texture from the air instead of a smooth lawn. Deterministic. */
function buildTrees(scene) {
  const spots = [];
  let guard = 0;
  while (spots.length < 650 && guard < 20000) {
    guard += 1;
    const x = (rand() - 0.5) * 5600;
    const z = (rand() - 0.5) * 5600;
    const h = terrainHeight(x, z);
    if (h < 10 || h > 130) continue;
    if (Math.abs(x) < 750 && Math.abs(z - 2300) < 320) continue; // runway shelf
    if (Math.hypot(x - 1950, z - 950) < 620) continue; // harbour flats
    if (Math.abs(x + 1700) < 380 && Math.abs(z - 150) < 1100) continue; // bridge canyon
    let nearRing = false;
    for (const r of RING_COURSE) {
      if (Math.hypot(x - r.x, z - r.z) < 130) { nearRing = true; break; }
    }
    if (nearRing) continue;
    const hx = terrainHeight(x + 8, z) - terrainHeight(x - 8, z);
    const hz = terrainHeight(x, z + 8) - terrainHeight(x, z - 8);
    if (Math.hypot(hx, hz) / 16 > 0.35) continue;
    spots.push({ x, z, h, s: 0.8 + rand() * 0.7 });
  }
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.25, 0.4, 1.6, 6),
    new THREE.MeshLambertMaterial({ color: 0x5a4632 }),
    spots.length,
  );
  const cones = new THREE.InstancedMesh(
    new THREE.ConeGeometry(2.6, 9, 8),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
    spots.length,
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const p = new THREE.Vector3();
  const col = new THREE.Color();
  spots.forEach((s, i) => {
    m.compose(p.set(s.x, s.h + 0.8 * s.s, s.z), q, sc.set(s.s, s.s, s.s));
    trunks.setMatrixAt(i, m);
    m.compose(p.set(s.x, s.h + 6.1 * s.s, s.z), q, sc.set(s.s, s.s, s.s));
    cones.setMatrixAt(i, m);
    col.setHSL(0.29 + rand() * 0.04, 0.45, 0.22 + rand() * 0.08);
    cones.setColorAt(i, col);
  });
  trunks.instanceMatrix.needsUpdate = true;
  cones.instanceMatrix.needsUpdate = true;
  if (cones.instanceColor) cones.instanceColor.needsUpdate = true;
  scene.add(trunks);
  scene.add(cones);
}

/** Build the whole island into the scene; returns the live handles the game updates. */
export function buildWorld(scene) {
  buildTerrain(scene);
  buildTrees(scene);
  buildSky(scene);
  buildRunway(scene);
  const papi = buildPapi(scene);
  const lighthouse = buildLighthouse(scene);
  buildBridge(scene);
  const boats = buildHarbour(scene);
  const clouds = buildClouds(scene);
  const { rings, beacon } = buildRings(scene);

  let time = 0;
  return {
    rings,
    beacon,
    setNextRing(index) {
      const ring = rings[index];
      if (ring) {
        beacon.visible = true;
        beacon.position.set(ring.center.x, ring.center.y + 140, ring.center.z);
      } else {
        beacon.visible = false;
      }
    },
    setRingPassed(index) {
      const ring = rings[index];
      if (!ring) return;
      ring.passed = true;
      ring.torus.material.color.set(0x7dff5e);
      ring.glow.material.color.set(0x7dff5e);
    },
    resetRings() {
      for (const ring of rings) {
        ring.passed = false;
        ring.torus.material.color.set(0x22e6ff);
        ring.glow.material.color.set(0x22e6ff);
      }
    },
    update(dt, aircraftPos) {
      time += dt;
      lighthouse.beamPivot.rotation.y = time * 0.35;
      for (const boat of boats) {
        boat.position.y = Math.sin(time * 0.7 + boat.position.x) * 0.35;
        boat.rotation.z = Math.sin(time * 0.5 + boat.position.z) * 0.02;
      }
      for (const cloud of clouds) {
        cloud.position.x += dt * 2.2;
        if (cloud.position.x > 3000) cloud.position.x = -3000;
      }
      for (let i = 0; i < rings.length; i += 1) {
        const s = 1 + 0.045 * Math.sin(time * 3 + i);
        rings[i].group.scale.set(s, s, s);
      }
      // PAPI: 3-degree glidepath to the touchdown point (0, 12, 2300).
      if (aircraftPos) {
        const dx = aircraftPos.x - 0;
        const dz = aircraftPos.z - RUNWAY.z;
        const dist = Math.hypot(dx, dz);
        const hAbove = aircraftPos.y - RUNWAY.y;
        const angle = Math.atan2(hAbove, Math.max(dist, 1)) * 180 / Math.PI;
        const err = angle - 3;
        const nWhite = err > 1.2 ? 4 : err > 0.4 ? 3 : err > -0.4 ? 2 : err > -1.2 ? 1 : 0;
        papi.setWhite(nWhite);
      }
    },
  };
}
