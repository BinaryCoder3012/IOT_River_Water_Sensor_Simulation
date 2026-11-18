import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { gsap } from 'gsap';
import { buildNode, buildGateway, setWiresPlaced } from './node.js';
import { buildSite } from './site.js';
import { canvasTex } from './parts.js';
import { BOM, BOM_BY_ID, STEPS, WIRES, WIRE_COLORS, CONFIG, LEVELS, GW_INFO, GW_WIRES } from './data.js';
const INFO = { ...BOM_BY_ID, ...GW_INFO };

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ================================================================ renderer
const vp = $('#viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.localClippingEnabled = true;
vp.appendChild(renderer.domElement);
const css = new CSS2DRenderer();
css.setSize(innerWidth, innerHeight);
Object.assign(css.domElement.style, { position: 'absolute', top: '0', left: '0', pointerEvents: 'none' });
vp.appendChild(css.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const persp = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.05, 2500);
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 4000);
let camera = persp;
const controls = new OrbitControls(persp, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.autoRotateSpeed = 0.8;

// ================================================================ lights
const wsLights = new THREE.Group();
wsLights.add(new THREE.HemisphereLight(0xdfefff, 0x1a2230, 1.1));
const key = new THREE.DirectionalLight(0xffffff, 2.4);
key.position.set(35, 70, 45);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 1, far: 250 });
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.03;
const rim = new THREE.DirectionalLight(0x88bbff, 0.9);
rim.position.set(-40, 25, -35);
wsLights.add(key, rim);
scene.add(wsLights);

const siteLights = new THREE.Group();
siteLights.add(new THREE.HemisphereLight(0xcfe6ff, 0x6b5a3a, 1.0));
const sun = new THREE.DirectionalLight(0xfff1d6, 2.8);
sun.position.set(30, 45, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 200 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.04;
siteLights.add(sun);
scene.add(siteLights);
const siteFog = new THREE.Fog(0xd5e5f2, 70, 230);

// ================================================================ workbench
const ws = new THREE.Group();
scene.add(ws);
const g1 = new THREE.GridHelper(400, 400, 0x1a3350, 0x14283e);
g1.material.transparent = true;
g1.material.opacity = 0.45;
const g2 = new THREE.GridHelper(400, 40, 0x2c5f8c, 0x23496c);
g2.material.transparent = true;
g2.material.opacity = 0.7;
g1.position.y = g2.position.y = -0.02;
ws.add(g1, g2);
const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.35 }));
shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.receiveShadow = true;
ws.add(shadowPlane);

const node = buildNode();
ws.add(node.root);
const P = node.parts;
const gw = buildGateway();
gw.root.visible = false;
ws.add(gw.root);
let gwF = 0;
const partIds = Object.keys(P);
const balloon = Object.fromEntries(BOM.map((b, i) => [b.id, i + 1]));

// part balloons (CSS2D), anchored at the top of each part's local bounding box
const partLabels = {};
for (const id of partIds) {
  const p = P[id];
  const target = id === 'wires' ? p.coil : p.group;
  const sp = target.position.clone();
  const sq = target.quaternion.clone();
  target.position.set(0, 0, 0);
  target.quaternion.identity();
  target.updateMatrixWorld(true);
  const parentInv = target.parent.matrixWorld.clone().invert();
  const bb = new THREE.Box3().setFromObject(target);
  bb.applyMatrix4(parentInv);
  target.position.copy(sp);
  target.quaternion.copy(sq);
  const s = target.scale;
  const anchor = V(((bb.min.x + bb.max.x) / 2) / s.x, bb.max.y / s.y, ((bb.min.z + bb.max.z) / 2) / s.z);
  const el = document.createElement('div');
  el.className = 'lbl lbl-part';
  el.innerHTML = `<b>${balloon[id]}</b><span>${BOM_BY_ID[id].name}</span>`;
  const lbl = new CSS2DObject(el);
  lbl.position.copy(anchor);
  target.add(lbl);
  partLabels[id] = lbl;
}

// dimensions (box frame, cm) + section plane
const dims = new THREE.Group();
ws.add(dims);
const dimMat = new THREE.LineBasicMaterial({ color: 0xffd166 });
function dim(a, b, off, text) {
  const p1 = a.clone().add(off);
  const p2 = b.clone().add(off);
  const ext = off.clone().normalize().multiplyScalar(0.6);
  const g = new THREE.BufferGeometry().setFromPoints([a, p1.clone().add(ext), b, p2.clone().add(ext), p1, p2]);
  dims.add(new THREE.LineSegments(g, dimMat));
  const dir = p2.clone().sub(p1).normalize();
  for (const [p, d] of [[p1, dir.clone().negate()], [p2, dir]]) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 10), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
    c.position.copy(p).addScaledVector(d, -0.35);
    c.quaternion.setFromUnitVectors(V(0, 1, 0), d);
    dims.add(c);
  }
  const l = new CSS2DObject(Object.assign(document.createElement('div'), { className: 'lbl lbl-cad', innerHTML: text }));
  l.position.copy(p1).lerp(p2, 0.5);
  dims.add(l);
}
dim(V(-5, 0, 5), V(5, 0, 5), V(0, 0, 3.5), '100');
dim(V(5, 0, -5), V(5, 0, 5), V(3.5, 0, 0), '100');
dim(V(-5, 0, 5), V(-5, 7, 5), V(-3, 0, 0), '70');
const holeNote = new CSS2DObject(Object.assign(document.createElement('div'), { className: 'lbl lbl-cad', innerHTML: '2× Ø16 · 26 c/c' }));
holeNote.position.set(-7, 0, -2);
dims.add(holeNote);

const section = { on: false, plane: new THREE.Plane(V(-1, 0, 0), 0) };
const hatch = canvasTex(256, 256, (c, w, h) => {
  c.strokeStyle = 'rgba(255,209,102,0.9)';
  c.lineWidth = 2;
  for (let i = -h; i < w; i += 14) {
    c.beginPath();
    c.moveTo(i, h);
    c.lineTo(i + h, 0);
    c.stroke();
  }
});
hatch.wrapS = hatch.wrapT = THREE.RepeatWrapping;
hatch.repeat.set(6, 6);
const secMesh = new THREE.Mesh(new THREE.PlaneGeometry(36, 34), new THREE.MeshBasicMaterial({ map: hatch, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
secMesh.rotation.y = Math.PI / 2;
secMesh.position.set(0, 12, -9);
secMesh.visible = false;
ws.add(secMesh);

// ================================================================ site
const site = buildSite();
scene.add(site.root);

// ================================================================ material helpers
function eachMat(root, fn) {
  root.traverse((o) => {
    if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => fn(m, o));
  });
}
const view = { disp: 'shaded', edges: true, dims: true, mode: 'site', ghostShell: false };

function applyDisplay() {
  [node.root, gw.root].forEach((r) => eachMat(r, (m) => {
    m.wireframe = view.disp === 'wire';
    let op = m.userData.baseOpacity ?? 1;
    if (view.disp === 'xray') op = Math.min(op, 0.28);
    else if (m.userData.shell && view.ghostShell) op = 0.2;
    const tr = op < 1 || m.userData.baseTransparent;
    if (m.transparent !== tr) m.needsUpdate = true;
    m.transparent = tr;
    m.opacity = op;
    m.depthWrite = op >= 1;
    m.clippingPlanes = section.on ? [section.plane] : null;
    m.needsUpdate = true;
  }));
  gw.edgeMat.visible = view.edges && view.disp !== 'wire';
  node.edgeMat.visible = view.edges && view.disp !== 'wire';
  node.edgeMat.clippingPlanes = section.on ? [section.plane] : null;
  node.edgeMat.needsUpdate = true;
  dims.visible = view.dims && ['explode', 'assembly', 'gateway'].includes(view.mode);
  dims.traverse((o) => o.isCSS2DObject && (o.visible = dims.visible));
  secMesh.visible = section.on;
}

let hlIds = new Set();
function setHighlight(ids) {
  hlIds = new Set(ids);
  for (const id of partIds) {
    const on = hlIds.has(id);
    eachMat(P[id].group, (m) => {
      if (!m.emissive) return;
      m.emissive.setHex(on ? 0x1aa7ff : m.userData.baseEmissive);
      m.emissiveIntensity = on ? 0.55 : m.userData.baseEmissiveIntensity;
    });
    partLabels[id].element.classList.toggle('hl', on);
  }
}

// ================================================================ part motion
let motion = gsap.timeline();
const homeOf = (id) => ({ pos: P[id].home.pos, quat: P[id].home.quat });
const trayOf = (id) => ({ pos: P[id].tray.pos, quat: P[id].tray.quat });
const explodeOf = (id, f) => ({ pos: P[id].home.pos.clone().addScaledVector(P[id].explode, f), quat: P[id].home.quat });

function tweenTo(id, tgt, dur = 1, ease = 'power3.inOut') {
  const g = P[id].group;
  const o = { t: 0 };
  let sp, sq;
  return gsap.to(o, {
    t: 1,
    duration: dur,
    ease,
    onStart: () => {
      sp = g.position.clone();
      sq = g.quaternion.clone();
    },
    onUpdate: () => {
      if (!sp) {
        sp = g.position.clone();
        sq = g.quaternion.clone();
      }
      g.position.lerpVectors(sp, tgt.pos, o.t);
      g.quaternion.slerpQuaternions(sq, tgt.quat, o.t);
    },
  });
}
function snapTo(id, tgt) {
  P[id].group.position.copy(tgt.pos);
  P[id].group.quaternion.copy(tgt.quat);
}

function drawLoom(tl, at, dur = 1.6) {
  node.loom.visible = true;
  node.loom.children.forEach((w, i) => {
    const cnt = w.geometry.index.count;
    w.geometry.setDrawRange(0, 0);
    w.children.forEach((c) => (c.visible = false));
    const o = { t: 0 };
    tl.to(o, {
      t: 1,
      duration: dur * 0.5,
      ease: 'power1.inOut',
      onUpdate: () => w.geometry.setDrawRange(0, Math.floor((cnt * o.t) / 3) * 3),
      onComplete: () => w.children.forEach((c) => (c.visible = true)),
    }, at + (i / node.loom.children.length) * dur * 0.6);
  });
}
function loomFull() {
  node.loom.children.forEach((w) => {
    w.geometry.setDrawRange(0, Infinity);
    w.children.forEach((c) => (c.visible = true));
  });
}

// ================================================================ camera
function syncOrtho() {
  const dist = camera.position.distanceTo(controls.target);
  const h = 2 * dist * Math.tan(THREE.MathUtils.degToRad(persp.fov / 2));
  const a = innerWidth / innerHeight;
  ortho.left = (-h * a) / 2;
  ortho.right = (h * a) / 2;
  ortho.top = h / 2;
  ortho.bottom = -h / 2;
  ortho.updateProjectionMatrix();
}
function flyTo(pos, target, dur = 1.6) {
  gsap.to(camera.position, { x: pos.x, y: pos.y, z: pos.z, duration: dur, ease: 'power3.inOut' });
  gsap.to(controls.target, { x: target.x, y: target.y, z: target.z, duration: dur, ease: 'power3.inOut' });
  if (camera === ortho) gsap.to(ortho, { zoom: 1, duration: dur, onUpdate: () => ortho.updateProjectionMatrix() });
}
const CAM = {
  site: [V(17, 7.5, 14), V(3.2, 2.0, 0)],
  bom: [V(-9, 56, 16), V(-9, 0, -42)],
  explode: [V(46, 44, 70), V(-8, 13, -2)],
  assembly: [V(18, 58, 52), V(-8, 4, -22)],
  wiring: [V(-1.5, 18, 6.5), V(-1.5, 3.6, -1.6)],
  gateway: [V(26, 26, 34), V(-7, 4, -1)],
};

// ================================================================ simulation (site)
const sim = { running: true, acc: 0, clock: 6 * 60, level: 0, lastReport: -999, lastH: null, fcnt: 41, batt: 3.94, rssi: -101, snr: 6.2, flood: null };
function classify(h, prev) {
  const raw = (s) => (h >= CONFIG.danger - s ? 3 : h >= CONFIG.warning - s ? 2 : h >= CONFIG.watch - s ? 1 : 0);
  const up = raw(0);
  const down = raw(CONFIG.hysteresis);
  if (up > prev) return up;
  if (down < prev) return down;
  return prev;
}
const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
function log(msg, cls = '') {
  const el = $('#log');
  if (!el) return;
  const d = document.createElement('div');
  d.className = cls;
  d.textContent = `[${hhmm(sim.clock)}] ${msg}`;
  el.prepend(d);
  while (el.children.length > 80) el.lastChild.remove();
}
function sampleTick() {
  sim.clock += 5;
  site.ping();
  const trueD = site.H - site.state.stage;
  const d = trueD + (Math.random() - 0.5) * 0.006;
  const h = site.H - d;
  const mad = (1 + Math.random() * 2.5).toFixed(1);
  const prev = sim.level;
  sim.level = classify(h, prev);
  const L = LEVELS[sim.level];
  const changed = sim.level !== prev;
  const rapid = sim.lastH !== null && Math.abs(h - sim.lastH) >= 0.1;
  const due = sim.clock - sim.lastReport >= L.interval;
  const day = (sim.clock / 60) % 24;
  sim.batt = THREE.MathUtils.clamp(sim.batt + (day > 7 && day < 17 ? 0.003 : -0.0012), 3.6, 4.18);
  if (changed) log(`LEVEL ${LEVELS[prev].name} → ${L.name}`, 'lv');
  if (changed || rapid || due) {
    sim.fcnt++;
    sim.lastReport = sim.clock;
    sim.lastH = h;
    const why = changed ? 'level change' : rapid ? 'rapid change ≥100 mm' : 'interval';
    gsap.delayedCall(1.3, () => {
      log(`TX fcnt=${sim.fcnt} h=${(h * 1000).toFixed(0)} mm ${L.name} (${why})`, 'tx');
      site.transmit();
      gsap.delayedCall(2.6, () => {
        sim.rssi = Math.round(-96 - Math.random() * 10 - (sim.level >= 2 ? 3 : 0));
        sim.snr = +(4 + Math.random() * 5).toFixed(1);
        log(`ACK ← gw  RSSI ${sim.rssi} dBm  SNR ${sim.snr} dB`, 'ack');
        updateHud();
      });
    });
  } else {
    log(`sample n=9 d=${(d * 1000).toFixed(0)} mm MAD ${mad} mm · no report`);
  }
  updateHud(h);
}
function updateHud(hMeas) {
  if (view.mode !== 'site' || !$('#lvl')) return;
  const L = LEVELS[sim.level];
  const lv = $('#lvl');
  lv.style.background = L.color + '26';
  lv.style.border = `1px solid ${L.color}`;
  lv.style.color = L.color;
  lv.innerHTML = `${L.name}<small>report every ${L.interval} min</small>`;
  const next = Math.max(0, sim.lastReport + L.interval - sim.clock);
  $('#sClock').textContent = hhmm(sim.clock);
  $('#sNext').textContent = `${next} min`;
  $('#sBatt').textContent = `${sim.batt.toFixed(2)} V`;
  $('#sRssi').textContent = `${sim.rssi} / ${sim.snr}`;
  $('#sFcnt').textContent = sim.fcnt;
  const day = (sim.clock / 60) % 24;
  $('#sPanel').textContent = day > 7 && day < 17 ? 'charging' : 'idle';
}
function liveStage() {
  if (view.mode !== 'site' || !$('#sH')) return;
  const h = site.state.stage;
  $('#sH').textContent = `${h.toFixed(3)} m`;
  $('#sD').textContent = `${(site.H - h).toFixed(3)} m`;
  $('#mk').style.left = `${(h / 3) * 100}%`;
  const sl = $('#stage');
  if (sl && document.activeElement !== sl) sl.value = h;
}

// ================================================================ UI panels
const panel = $('#panel');
const SHEETS = {
  site: ['SITE & OPERATION', '1:100 (node 4×)', 'm', '1 / 6'],
  bom: ['RAW MATERIALS · BOM', '1:2', 'cm', '2 / 6'],
  explode: ['EXPLODED ASSEMBLY', '1:2', 'mm (dims)', '3 / 6'],
  assembly: ['ASSEMBLY SEQUENCE', '1:2', 'cm', '4 / 6'],
  wiring: ['WIRING · NODE CARRIER', '2:1', 'cm', '5 / 6'],
  gateway: ['GATEWAY · RECEIVER NODE', '1:2', 'cm', '6 / 6'],
};

function bomList() {
  const cats = [...new Set(BOM.map((b) => b.cat))];
  return cats
    .map(
      (c) =>
        `<div class="cat">${c}</div>` +
        BOM.filter((b) => b.cat === c)
          .map((b) => `<div class="item" data-part="${b.id}"><span class="no">${balloon[b.id]}</span><span class="nm">${b.name}<small>${b.spec.split('·')[0]}</small></span><span class="q">×${b.qty.split(' ')[0]}</span></div>`)
          .join('')
    )
    .join('');
}
function bindList(focus) {
  $$('#panel .item').forEach((el) => {
    const id = el.dataset.part;
    el.onmouseenter = () => setHighlight([id]);
    el.onmouseleave = () => setHighlight(selected ? [selected] : []);
    el.onclick = () => {
      select(id);
      if (focus) focus(id);
    };
  });
}

function renderSite() {
  panel.innerHTML = `
    <h2>Bridge-mounted river gauge</h2>
    <p>The node hangs ≥ 1 m out from the deck and looks straight down. The US-100 measures the air gap <b>d</b> with 40 kHz ultrasound; stage is <b>h = H − d</b>, with <b>H = ${CONFIG.mountHeight.toFixed(2)} m</b> set against the staff gauge. Every 5 min it samples (9 pings, median + MAD), then reports over LoRa to the gateway, which forwards over Wi-Fi.</p>
    <div class="level-badge" id="lvl">NORMAL</div>
    <div class="thr-bar"><span class="mk" id="mk"></span></div>
    <div class="thr-scale"><span>0</span><span>1.0 watch</span><span>1.5 warn</span><span>2.0 danger</span><span>3.0 m</span></div>
    <h3>River stage (drag) · m</h3>
    <input id="stage" type="range" min="0.3" max="2.6" step="0.01" value="${site.state.stage}">
    <div class="btns">
      <button class="btn primary" id="flood">▶ Simulate flood event</button>
      <button class="btn" id="pause">Pause sampling</button>
    </div>
    <div class="stat-grid">
      <div class="stat"><i>Stage h (true)</i><b id="sH">–</b></div>
      <div class="stat"><i>Air gap d</i><b id="sD">–</b></div>
      <div class="stat"><i>Node clock</i><b id="sClock">–</b></div>
      <div class="stat"><i>Next report</i><b id="sNext">–</b></div>
      <div class="stat"><i>Battery (18650)</i><b id="sBatt">–</b></div>
      <div class="stat"><i>RSSI / SNR</i><b id="sRssi">–</b></div>
      <div class="stat"><i>Frame counter</i><b id="sFcnt">–</b></div>
      <div class="stat"><i>Solar 6 V 2 W</i><b id="sPanel">–</b></div>
    </div>
    <h3>Node log · 1 sample = 5 min</h3>
    <div class="log" id="log"></div>
    <h3>Camera</h3>
    <div class="btns">
      <button class="btn" data-cam="close">Node close-up</button>
      <button class="btn" data-cam="gauge">Staff gauge</button>
      <button class="btn" data-cam="link">LoRa link</button>
      <button class="btn" data-cam="wide">River overview</button>
    </div>
    <div class="btns"><button class="btn primary" id="toGw">Inspect gateway / receiver ▸</button></div>`;
  $('#stage').oninput = (e) => {
    stopFlood();
    site.setStage(+e.target.value);
  };
  $('#flood').onclick = () => (sim.flood ? stopFlood() : startFlood());
  $('#pause').onclick = (e) => {
    sim.running = !sim.running;
    e.target.textContent = sim.running ? 'Pause sampling' : 'Resume sampling';
  };
  const cams = {
    close: [V(7.4, 3.9, 2.6), V(4.0, 2.6, 0)],
    gauge: [V(7, 2.2, -2.5), V(1.6, 1.4, -6)],
    link: [V(26, 22, 22), V(-12, 6, -18)],
    wide: [V(34, 20, 44), V(-6, 2, -8)],
  };
  $$('[data-cam]').forEach((b) => (b.onclick = () => flyTo(...cams[b.dataset.cam])));
  $('#toGw').onclick = () => setMode('gateway');
  updateHud();
  liveStage();
  log('node boot · RiverMon fw · SF9 434.2 MHz · cfg_ver 3');
}
function startFlood() {
  stopFlood();
  const o = { h: site.state.stage };
  sim.flood = gsap.timeline({ onComplete: stopFlood, onUpdate: () => site.setStage(o.h) });
  sim.flood.to(o, { h: 2.3, duration: 26, ease: 'sine.inOut' }).to(o, { h: 2.3, duration: 4 }).to(o, { h: 0.9, duration: 26, ease: 'sine.inOut' });
  if ($('#flood')) $('#flood').textContent = '■ Stop flood event';
  log('rain upstream · flood wave arriving', 'lv');
}
function stopFlood() {
  if (sim.flood) sim.flood.kill();
  sim.flood = null;
  if ($('#flood')) $('#flood').textContent = '▶ Simulate flood event';
}

function renderBom() {
  panel.innerHTML = `
    <h2>Raw materials</h2>
    <p>Every line of the Group-10 component list, laid out on the bench at true scale (1 grid square = 1 cm). Click a part, in 3D or here, for its role, rating and build notes.</p>
    <div class="list">${bomList()}</div>`;
  bindList((id) => {
    const p = P[id].tray.pos;
    const c = id === 'wires' ? P.wires.coil.position : p;
    flyTo(V(c.x + 6, 26, c.z + 24), V(c.x, 1, c.z), 1.2);
  });
}

let explodeF = 1;
function renderExplode() {
  panel.innerHTML = `
    <h2>Exploded design</h2>
    <p>The node in its 100 × 100 × 70 mm IP65 enclosure: carrier board on brass standoffs, US-100 through the bottom wall, cell on the front wall, Ra-02 + spring antenna at the board edge, and the 6 V panel on the L-bracket above, which also shades the box.</p>
    <h3>Explode distance</h3>
    <input id="ex" type="range" min="0" max="1.5" step="0.01" value="${explodeF}">
    <div class="btns"><button class="btn primary" id="exAnim">▶ Collapse / explode</button><button class="btn" id="secBtn">Toggle section cut</button></div>
    <h3>Parts</h3>
    <div class="list">${bomList()}</div>`;
  $('#ex').oninput = (e) => {
    motion.kill();
    explodeF = +e.target.value;
    partIds.forEach((id) => id !== 'wires' && snapTo(id, explodeOf(id, explodeF)));
  };
  $('#exAnim').onclick = () => {
    motion.kill();
    const to = explodeF > 0.5 ? 0 : 1;
    explodeF = to;
    $('#ex').value = to;
    motion = gsap.timeline();
    partIds.forEach((id, i) => id !== 'wires' && motion.add(tweenTo(id, explodeOf(id, to), 1.3), i * 0.03));
  };
  $('#secBtn').onclick = () => $('#section').click();
  bindList();
}

let step = 0;
let autoPlay = false;
function renderAssembly() {
  const s = STEPS[Math.min(step, STEPS.length - 1)];
  const doneAll = step >= STEPS.length;
  const cur = doneAll ? null : STEPS[step];
  const last = step > 0 ? STEPS[step - 1] : null;
  panel.innerHTML = `
    <h2>Assembly sequence</h2>
    <p>Following the build guide: every stage ends with a check, so a fault shows up while it is still easy to find. Parts fly in from the bench tray.</p>
    <div class="steps-dots">${STEPS.map((_, i) => `<span data-i="${i}" class="${i < step ? 'done' : ''} ${i === step ? 'cur' : ''}"></span>`).join('')}</div>
    ${
      last
        ? `<div class="step-card">
      <div class="k">STEP ${String(step).padStart(2, '0')} / ${STEPS.length} · DONE</div>
      <h4>${last.title}</h4>
      <p>${last.text}</p>
      <div class="chips">${last.parts.map((p) => `<span class="chip">${balloon[p]} · ${BOM_BY_ID[p].name}</span>`).join('')}</div>
      <div class="chk">✓ ${last.check}</div>
    </div>`
        : `<div class="step-card"><div class="k">READY</div><h4>All parts on the bench</h4><p>Press <b>Next step</b> or <b>Play all</b> to build the node.</p></div>`
    }
    <div class="btns">
      <button class="btn ${step === 0 ? 'dis' : ''}" id="prev">◀ Back</button>
      <button class="btn primary ${doneAll ? 'dis' : ''}" id="next">Next: ${cur ? cur.title : 'done'} ▶</button>
    </div>
    <div class="btns">
      <button class="btn" id="play">${autoPlay ? '■ Stop' : '▶▶ Play all'}</button>
      <button class="btn" id="reset">↺ Reset to bench</button>
    </div>
    <h3>Sequence</h3>
    <div class="list">${STEPS.map((st, i) => `<div class="item ${i === step - 1 ? 'on' : ''}" data-step="${i}"><span class="no">${i + 1}</span><span class="nm">${st.title}</span><span class="q">${i < step ? '✓' : ''}</span></div>`).join('')}</div>`;
  $('#next').onclick = () => {
    autoPlay = false;
    nextStep();
  };
  $('#prev').onclick = () => {
    autoPlay = false;
    prevStep();
  };
  $('#play').onclick = () => {
    autoPlay = !autoPlay;
    if (autoPlay) {
      if (step >= STEPS.length) gotoStep(0, false);
      nextStep();
    } else renderAssembly();
  };
  $('#reset').onclick = () => {
    autoPlay = false;
    gotoStep(0, true);
  };
  $$('[data-step]').forEach((el) => (el.onclick = () => ((autoPlay = false), gotoStep(+el.dataset.step + 1, true))));
  $$('.steps-dots span').forEach((el) => (el.onclick = () => ((autoPlay = false), gotoStep(+el.dataset.i + 1, true))));
  $$('[data-step]').forEach((el) => {
    el.onmouseenter = () => setHighlight(STEPS[+el.dataset.step].parts);
    el.onmouseleave = () => setHighlight([]);
  });
}

function placeForStep(n) {
  const placed = new Set(STEPS.slice(0, n).flatMap((s) => s.parts));
  partIds.forEach((id) => id !== 'wires' && snapTo(id, placed.has(id) ? homeOf(id) : trayOf(id)));
  setWiresPlaced(node, placed.has('wires'));
  loomFull();
}
function gotoStep(n, animate) {
  motion.kill();
  const placed = new Set(STEPS.slice(0, n).flatMap((s) => s.parts));
  if (animate) {
    motion = gsap.timeline();
    partIds.forEach((id) => id !== 'wires' && motion.add(tweenTo(id, placed.has(id) ? homeOf(id) : trayOf(id), 0.9), 0));
  } else placeForStep(n);
  setWiresPlaced(node, placed.has('wires'));
  loomFull();
  step = n;
  setHighlight([]);
  renderAssembly();
}
function nextStep() {
  if (step >= STEPS.length) return;
  motion.progress(1);
  const s = STEPS[step];
  motion = gsap.timeline({
    onComplete: () => {
      setHighlight([]);
      if (autoPlay && step < STEPS.length) gsap.delayedCall(0.5, () => autoPlay && nextStep());
      else if (autoPlay) {
        autoPlay = false;
        renderAssembly();
      }
    },
  });
  setHighlight(s.parts);
  s.parts.forEach((id, i) => {
    const at = i * 0.45;
    if (id === 'wires') {
      motion.to(P.wires.coil.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.5, ease: 'back.in(2)' }, at);
      motion.add(() => {
        P.wires.coil.visible = false;
        P.wires.coil.scale.set(1, 1, 1);
      }, at + 0.5);
      drawLoom(motion, at + 0.3, 2.2);
      return;
    }
    const p = P[id];
    const lift = { pos: p.group.position.clone().add(V(0, 9, 0)), quat: p.group.quaternion.clone() };
    const above = { pos: p.home.pos.clone().addScaledVector(p.explode, 0.55).add(V(0, 6, 0)), quat: p.home.quat };
    motion.add(tweenTo(id, lift, 0.45, 'power2.out'), at);
    motion.add(tweenTo(id, above, 0.9, 'power2.inOut'), at + 0.45);
    motion.add(tweenTo(id, homeOf(id), 0.6, 'power2.inOut'), at + 1.35);
  });
  step++;
  renderAssembly();
}
function prevStep() {
  if (step <= 0) return;
  motion.progress(1);
  step--;
  const s = STEPS[step];
  motion = gsap.timeline();
  s.parts.forEach((id, i) => {
    if (id === 'wires') {
      setWiresPlaced(node, false);
      return;
    }
    const p = P[id];
    const above = { pos: p.home.pos.clone().addScaledVector(p.explode, 0.55).add(V(0, 6, 0)), quat: p.home.quat };
    motion.add(tweenTo(id, above, 0.5, 'power2.out'), i * 0.2);
    motion.add(tweenTo(id, trayOf(id), 0.9, 'power2.inOut'), i * 0.2 + 0.5);
  });
  renderAssembly();
}

const pinLbls = [0, 1].map(() => {
  const o = new CSS2DObject(Object.assign(document.createElement('div'), { className: 'lbl lbl-pin' }));
  o.visible = false;
  ws.add(o);
  return o;
});
function renderWiring() {
  const C = { r: '#e63946', k: '#3a3a3f', b: '#2f80ed', y: '#f4c430' };
  panel.innerHTML = `
    <h2>Node wiring</h2>
    <p>Top view of the 7 × 9 cm carrier board. Pins are identical on the gateway, so one layout serves both. Hover a row to trace the wire and its pins.</p>
    <div class="legend"><span><i class="sw" style="background:${C.r};width:10px;height:10px;display:inline-block;border-radius:2px"></i>+ supply</span><span><i style="background:${C.k};width:10px;height:10px;display:inline-block;border-radius:2px;outline:1px solid #666"></i>GND</span><span><i style="background:${C.b};width:10px;height:10px;display:inline-block;border-radius:2px"></i>SPI data</span><span><i style="background:${C.y};width:10px;height:10px;display:inline-block;border-radius:2px"></i>signals</span></div>
    <h3>Wiring table · docs 1.4.1</h3>
    <table class="wtable">${WIRES.map((w, i) => `<tr data-w="${i}"><td><span class="sw" style="background:${C[w.c]}"></span></td><td>${w.from}</td><td class="pin">→ ${w.to}</td></tr>`).join('')}</table>
    <h3>Why these pins</h3>
    <p class="muted">GPIO5/18/19/23 are the native VSPI pins. GPIO25/26 are RTC-capable, so they hold state in deep sleep. GPIO35 is an input-only ADC1 pin that still works with Wi-Fi on. GPIO0/2/12/15 (boot straps) and 6–11 (flash) are avoided.</p>`;
  $$('[data-w]').forEach((tr) => {
    const i = +tr.dataset.w;
    tr.onmouseenter = () => traceWire(i);
    tr.onmouseleave = () => traceWire(-1);
  });
}
function traceWire(i) {
  node.wires.forEach((w, k) => {
    const m = w.mesh.material;
    const on = i < 0 || k === i;
    m.transparent = !on;
    m.opacity = on ? 1 : 0.12;
    m.emissive.setHex(k === i ? 0xffffff : 0x000000);
    m.emissiveIntensity = k === i ? 0.35 : 1;
  });
  pinLbls.forEach((l) => (l.visible = i >= 0));
  if (i >= 0) {
    const w = node.wires[i];
    pinLbls[0].element.textContent = w.def.from;
    pinLbls[1].element.textContent = w.def.to;
    pinLbls[0].position.copy(w.a).add(V(0, 0.5, 0));
    pinLbls[1].position.copy(w.b).add(V(0, 0.5, 0));
  }
}

// ================================================================ mode switching
function renderGateway() {
  const C = { r: '#e63946', k: '#3a3a3f', b: '#2f80ed', y: '#f4c430' };
  panel.innerHTML = `
    <h2>Gateway / receiver node</h2>
    <p>A second ESP32 DevKit + SX1278 Ra-02 on the same carrier layout, with the US-100 and power parts left unpopulated. It runs from a 5 V USB adapter and sits as high as possible with line of sight to the river (top-floor window or roof).</p>
    <div class="stat-grid">
      <div class="stat"><i>Radio</i><b>434.2 MHz</b></div>
      <div class="stat"><i>Mode</i><b>SF9 · RX</b></div>
      <div class="stat"><i>ACK after</i><b>60 ms</b></div>
      <div class="stat"><i>Uplink</i><b>Wi-Fi 2.4G</b></div>
    </div>
    <h3>What it does</h3>
    <p class="muted">Listens continuously on core 0, checks the 4-byte MIC and frame counter, decrypts the AES-128 payload and answers every frame with an ACK carrying any pending config. Core 1 forwards JSON over Wi-Fi/HTTP to the FastAPI backend with an outage queue and NTP time-stamps, so slow Wi-Fi never delays an ACK. Status page: <b>http://rivermon-gw.local/</b></p>
    <h3>Explode</h3>
    <input id="gwEx" type="range" min="0" max="1.3" step="0.01" value="${gwF}">
    <div class="btns"><button class="btn primary" id="gwAnim">▶ Explode / collapse</button><button class="btn" id="gwBack">← Back to site</button></div>
    <h3>Wiring · docs 1.4.2</h3>
    <table class="wtable">${GW_WIRES.map(([a, b, c, n]) => `<tr title="${n}"><td><span class="sw" style="background:${C[c]}"></span></td><td>${a}</td><td class="pin">→ ${b}</td></tr>`).join('')}</table>
    <p class="muted" style="margin-top:8px">Click any part in 3D for details.</p>`;
  const setF = (f) => {
    gwF = f;
    Object.values(gw.parts).forEach((p) => p.group.position.copy(p.home.pos).addScaledVector(p.explode, f));
  };
  $('#gwEx').oninput = (e) => {
    motion.kill();
    setF(+e.target.value);
  };
  $('#gwAnim').onclick = () => {
    motion.kill();
    const o = { f: gwF };
    const to = gwF > 0.5 ? 0 : 1;
    motion = gsap.timeline();
    motion.to(o, {
      f: to,
      duration: 1.3,
      ease: 'power3.inOut',
      onUpdate: () => {
        setF(o.f);
        $('#gwEx').value = o.f;
      },
    });
  };
  $('#gwBack').onclick = () => setMode('site');
}

const RENDER = { site: renderSite, bom: renderBom, explode: renderExplode, assembly: renderAssembly, wiring: renderWiring, gateway: renderGateway };
function setMode(mode) {
  const prevMode = view.mode;
  view.mode = mode;
  document.body.className = `mode-${mode}`;
  $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
  const [t, sc, un, no] = SHEETS[mode];
  $('#tbSheet').textContent = t;
  $('#tbScale').textContent = sc;
  $('#tbUnits').textContent = un;
  $('#tbNo').textContent = no;
  closeCard();
  setHighlight([]);
  traceWire(-1);

  const isSite = mode === 'site';
  ws.visible = !isSite;
  node.root.visible = mode !== 'gateway';
  gw.root.visible = mode === 'gateway';
  wsLights.visible = !isSite;
  site.root.visible = isSite;
  siteLights.visible = isSite;
  scene.fog = isSite ? siteFog : null;
  renderer.toneMappingExposure = isSite ? 1.0 : 1.05;
  scene.environmentIntensity = isSite ? 0.35 : 0.6;
  site.root.traverse((o) => o.isCSS2DObject && (o.visible = isSite));

  // part placement for the mode
  motion.kill();
  motion = gsap.timeline();
  partIds.forEach((id) => (P[id].group.visible = true));
  const showLabels = ['bom', 'explode'].includes(mode);
  partIds.forEach((id) => (partLabels[id].visible = showLabels));
  if (mode === 'bom') {
    setWiresPlaced(node, false);
    partIds.forEach((id, i) => id !== 'wires' && motion.add(tweenTo(id, trayOf(id), 1.2), i * 0.025));
  } else if (mode === 'explode') {
    P.wires.group.visible = false;
    partLabels.wires.visible = false;
    partIds.forEach((id, i) => id !== 'wires' && motion.add(tweenTo(id, explodeOf(id, explodeF), 1.3), i * 0.025));
  } else if (mode === 'assembly') {
    const placed = new Set(STEPS.slice(0, step).flatMap((s) => s.parts));
    setWiresPlaced(node, placed.has('wires'));
    loomFull();
    partIds.forEach((id, i) => id !== 'wires' && motion.add(tweenTo(id, placed.has(id) ? homeOf(id) : trayOf(id), 1.2), i * 0.02));
  } else if (mode === 'gateway') {
    Object.values(gw.parts).forEach((p) => p.group.position.copy(p.home.pos).addScaledVector(p.explode, gwF));
  } else if (mode === 'wiring') {
    setWiresPlaced(node, true);
    loomFull();
    ['lid', 'panel', 'bracket', 'clamp', 'holder', 'cell'].forEach((id) => (P[id].group.visible = false));
    partIds.forEach((id) => id !== 'wires' && motion.add(tweenTo(id, homeOf(id), 1.0), 0));
  }
  view.ghostShell = ['assembly', 'wiring', 'gateway'].includes(mode);
  applyDisplay();

  if (prevMode !== mode || mode === 'site') {
    if ((prevMode === 'site') !== isSite) {
      // jump between worlds of different scale: cut, then ease in
      const [p, t2] = CAM[mode];
      camera.position.copy(p).add(p.clone().sub(t2).multiplyScalar(0.35));
      controls.target.copy(t2);
      flyTo(p, t2, 1.4);
    } else flyTo(...CAM[mode]);
  }
  controls.maxDistance = isSite ? 250 : 400;
  RENDER[mode]();
}
$$('#tabs button').forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));

// sidebar show / hide (button or "[" key), remembered per browser
function toggleSide(force) {
  const hide = force ?? !document.documentElement.classList.contains('side-off');
  document.documentElement.classList.toggle('side-off', hide);
  $('#sideToggle').title = hide ? 'Show sidebar  [' : 'Hide sidebar  [';
  try {
    localStorage.setItem('rm-side-off', hide ? '1' : '0');
  } catch (e) {}
}
$('#sideToggle').onclick = () => toggleSide();
addEventListener('keydown', (e) => {
  if (e.key === '[' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) toggleSide();
});
try {
  if (localStorage.getItem('rm-side-off') === '1') toggleSide(true);
} catch (e) {}

// ================================================================ toolbar
$$('[data-view]').forEach((b) => {
  b.onclick = () => {
    const t = controls.target.clone();
    const dist = camera.position.distanceTo(t);
    const dirs = { iso: V(1, 0.85, 1), front: V(0, 0.02, 1), top: V(0, 1, 0.001), right: V(1, 0.02, 0) };
    flyTo(t.clone().addScaledVector(dirs[b.dataset.view].normalize(), dist), t, 1.0);
  };
});
$('#proj').onclick = (e) => {
  if (camera === persp) {
    ortho.position.copy(persp.position);
    ortho.quaternion.copy(persp.quaternion);
    ortho.zoom = 1;
    camera = ortho;
    syncOrtho();
    e.target.textContent = 'ORTHO';
    e.target.classList.add('on');
  } else {
    persp.position.copy(ortho.position);
    camera = persp;
    e.target.textContent = 'PERSP';
    e.target.classList.remove('on');
  }
  controls.object = camera;
  controls.update();
};
$$('[data-disp]').forEach((b) => {
  b.onclick = () => {
    view.disp = b.dataset.disp;
    $$('[data-disp]').forEach((x) => x.classList.toggle('on', x === b));
    applyDisplay();
  };
});
$('#edges').onclick = (e) => {
  view.edges = !view.edges;
  e.target.classList.toggle('on', view.edges);
  applyDisplay();
};
$('#dims').onclick = (e) => {
  view.dims = !view.dims;
  e.target.classList.toggle('on', view.dims);
  applyDisplay();
};
$('#section').onclick = (e) => {
  section.on = !section.on;
  e.target.classList.toggle('on', section.on);
  applyDisplay();
};
$('#sectionPos').oninput = (e) => {
  section.plane.constant = +e.target.value;
  secMesh.position.x = +e.target.value;
  if (!section.on) $('#section').click();
};
$('#spin').onclick = (e) => {
  controls.autoRotate = !controls.autoRotate;
  e.target.classList.toggle('on', controls.autoRotate);
};

// ================================================================ picking + card
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let selected = null;
let hoverDirty = false;
let hovered = null;
function pickPart(ev) {
  ndc.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (view.mode === 'site' && ray.intersectObject(site.gateway.root, true).length) return '__gateway';
  const root = view.mode === 'site' ? site.node.root : view.mode === 'gateway' ? gw.root : node.root;
  const hits = ray.intersectObject(root, true);
  for (const h of hits) {
    if (!h.object.visible || h.object.isLineSegments) continue;
    if (section.on && view.mode !== 'site' && h.point.x > section.plane.constant) continue;
    let o = h.object;
    let vis = true;
    while (o && !o.userData.partId) o = o.parent;
    for (let q = h.object; q; q = q.parent) if (!q.visible) vis = false;
    if (o && vis) return o.userData.partId;
  }
  return null;
}
function select(id) {
  selected = id;
  setHighlight(id ? [id] : []);
  if (!id) return closeCard();
  const b = INFO[id];
  if (!b) return closeCard();
  const card = $('#card');
  card.innerHTML = `<span class="x">×</span><div class="cat">${b.cat}${balloon[id] ? ` · item ${balloon[id]}` : ' · gateway'}</div><h3>${b.name}</h3>
    <dl><dt>Qty</dt><dd>${b.qty}</dd><dt>Role</dt><dd>${b.use}</dd><dt>Spec</dt><dd>${b.spec}</dd></dl>
    ${b.note ? `<div class="note">${b.note}</div>` : ''}`;
  card.classList.remove('hidden');
  card.querySelector('.x').onclick = () => select(null);
  $$('#panel .item').forEach((el) => el.classList.toggle('on', el.dataset.part === id));
}
function closeCard() {
  $('#card').classList.add('hidden');
  selected = null;
}
let down = null;
renderer.domElement.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
  const id = pickPart(e);
  if (id === '__gateway') return setMode('gateway');
  select(id);
});
let lastMove = null;
renderer.domElement.addEventListener('pointermove', (e) => {
  lastMove = e;
  hoverDirty = true;
});

// ================================================================ resize + loop
addEventListener('resize', () => {
  persp.aspect = innerWidth / innerHeight;
  persp.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  css.setSize(innerWidth, innerHeight);
  if (camera === ortho) syncOrtho();
});

const clock = new THREE.Clock();
let first = true;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;
  controls.update();
  if (camera === ortho) syncOrtho();
  if (view.mode === 'site') {
    site.update(t, camera);
    liveStage();
    if (sim.running) {
      sim.acc += dt;
      if (sim.acc > 3.4) {
        sim.acc = 0;
        sampleTick();
      }
    }
  }
  if (hoverDirty && lastMove && !down?.drag) {
    hoverDirty = false;
    const id = pickPart(lastMove);
    if (id !== hovered) {
      hovered = id;
      renderer.domElement.style.cursor = id ? 'pointer' : '';
      if (!['assembly', 'gateway'].includes(view.mode) && id !== '__gateway') setHighlight([selected, hovered].filter(Boolean));
    }
  }
  renderer.render(scene, camera);
  css.render(scene, camera);
  if (first) {
    first = false;
    $('#loader').style.opacity = 0;
    setTimeout(() => $('#loader').remove(), 700);
  }
});

setMode('site');
