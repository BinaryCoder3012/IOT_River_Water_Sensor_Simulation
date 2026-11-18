// Parametric part library. Units: centimetres. Each builder returns a Group
// centred on its own origin; node.js places them in the enclosure frame.
import * as THREE from 'three';

export function mat(color, o = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: o.metal ?? 0.05,
    roughness: o.rough ?? 0.55,
    map: o.map ?? null,
    transparent: o.opacity !== undefined,
    opacity: o.opacity ?? 1,
    side: o.side ?? THREE.FrontSide,
    emissive: o.emissive ?? 0x000000,
    emissiveIntensity: o.emissiveIntensity ?? 1,
  });
}

export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function box(w, h, d, m, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  return mesh;
}
function cyl(rt, rb, h, m, seg = 24) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
}

const M = () => ({
  pcbBlack: mat(0x18191c, { rough: 0.6 }),
  pcbBlue: mat(0x1d4e9e, { rough: 0.5 }),
  pcbGreen: mat(0x1f6b3a, { rough: 0.5 }),
  shield: mat(0xc9ccd1, { metal: 0.9, rough: 0.28 }),
  silver: mat(0xb8bcc2, { metal: 0.85, rough: 0.3 }),
  gold: mat(0xd4a72c, { metal: 0.9, rough: 0.3 }),
  plasticBlack: mat(0x1b1c20, { rough: 0.7 }),
  brass: mat(0xb08d3a, { metal: 0.8, rough: 0.35 }),
  steel: mat(0x7b8088, { metal: 0.75, rough: 0.4 }),
  chip: mat(0x111214, { rough: 0.45 }),
});

// ---------------------------------------------------------------- ESP32 DevKit
export const ESP_LEFT = ['EN', 'VP', 'VN', 'D34', 'D35', 'D32', 'D33', 'D25', 'D26', 'D27', 'D14', 'D12', 'D13', 'GND1', 'VIN'];
export const ESP_RIGHT = ['D23', 'D22', 'TX0', 'RX0', 'D21', 'D19', 'D18', 'D5', 'TX2', 'RX2', 'D4', 'D2', 'D15', 'GND2', '3V3'];
// pin offset (in board-local xz), antenna end towards +x
export function espPinLocal(name) {
  let i = ESP_LEFT.indexOf(name);
  let z = -1.27;
  if (i < 0) {
    i = ESP_RIGHT.indexOf(name);
    z = 1.27;
  }
  return new THREE.Vector3(1.78 - i * 0.254, 0, z);
}

export function esp32() {
  const m = M();
  const g = new THREE.Group();
  const label = canvasTex(512, 280, (c, w, h) => {
    c.fillStyle = '#18191c';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#e8e8e8';
    c.font = 'bold 34px monospace';
    c.fillText('ESP32 DEVKIT V1', 40, 150);
    c.font = '22px monospace';
    c.fillText('DOIT', 40, 190);
    c.strokeStyle = '#bbb';
    c.lineWidth = 3;
    c.strokeRect(6, 6, w - 12, h - 12);
  });
  const top = mat(0xffffff, { map: label, rough: 0.6 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.16, 2.8), [m.pcbBlack, m.pcbBlack, top, m.pcbBlack, m.pcbBlack, m.pcbBlack]);
  g.add(board);
  // WROOM module (shield + antenna area)
  g.add(box(1.8, 0.32, 1.6, m.shield, 1.15, 0.24, 0));
  g.add(box(0.6, 0.1, 1.6, mat(0x222a22), 2.35, 0.13, 0));
  // USB, regulator, buttons, LEDs
  g.add(box(0.75, 0.3, 0.8, m.silver, -2.45, 0.23, 0));
  g.add(box(0.65, 0.18, 0.35, m.chip, -1.4, 0.17, 0.6));
  g.add(box(0.45, 0.2, 0.35, m.chip, -0.4, 0.18, -0.55));
  for (const z of [-0.8, 0.8]) {
    g.add(box(0.5, 0.22, 0.35, m.silver, -1.9, 0.19, z));
    const b = cyl(0.09, 0.09, 0.12, m.plasticBlack, 12);
    b.position.set(-1.9, 0.33, z);
    g.add(b);
  }
  g.add(box(0.12, 0.08, 0.08, mat(0xff2b2b, { emissive: 0xff2b2b, emissiveIntensity: 0.6 }), -0.9, 0.12, -0.9));
  // headers + pins (male pins down)
  for (const z of [-1.27, 1.27]) {
    g.add(box(3.8, 0.25, 0.25, m.plasticBlack, 0, -0.2, z));
    for (let i = 0; i < 15; i++) {
      const p = box(0.06, 0.6, 0.06, m.gold, 1.78 - i * 0.254, -0.5, z);
      g.add(p);
    }
  }
  return g;
}

// ---------------------------------------------------------------- Ra-02
export const RA_PADS = ['3V3', 'GND', 'DIO0', 'RST', 'NSS', 'SCK', 'MOSI', 'MISO'];
export function raPadLocal(name) {
  const i = RA_PADS.indexOf(name);
  return new THREE.Vector3(-0.95, 0, -0.7 + i * 0.2);
}
export function ra02() {
  const m = M();
  const g = new THREE.Group();
  g.add(box(2.1, 0.16, 2.0, m.pcbGreen, 0, -0.45, 0)); // adapter board
  for (let i = 0; i < 8; i++) g.add(box(0.06, 0.5, 0.06, m.gold, -0.95, -0.7, -0.7 + i * 0.2));
  g.add(box(1.7, 0.1, 1.6, m.pcbBlue, 0, 0, 0));
  const lbl = canvasTex(256, 240, (c, w, h) => {
    c.fillStyle = '#cfd3d8';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#333';
    c.font = 'bold 40px monospace';
    c.fillText('Ra-02', 60, 100);
    c.font = '22px monospace';
    c.fillText('SX1278', 70, 140);
    c.fillText('433MHz', 70, 175);
  });
  const sh = mat(0xffffff, { map: lbl, metal: 0.8, rough: 0.3 });
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.22, 1.35), [m.shield, m.shield, sh, m.shield, m.shield, m.shield]).translateY(0.16));
  // castellated pads
  for (let i = 0; i < 8; i++) {
    g.add(box(0.08, 0.11, 0.1, m.gold, -0.86, 0, -0.7 + i * 0.2));
    g.add(box(0.08, 0.11, 0.1, m.gold, 0.86, 0, -0.7 + i * 0.2));
  }
  g.add(box(0.25, 0.15, 0.25, m.gold, 0.7, 0.07, 0.68)); // ANT pad
  return g;
}

export function springAntenna() {
  const g = new THREE.Group();
  const pts = [];
  const turns = 22;
  const hgt = 3.1;
  for (let i = 0; i <= turns * 24; i++) {
    const t = i / (turns * 24);
    const a = t * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * 0.24, t * hgt, Math.sin(a) * 0.24));
  }
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 900, 0.035, 6), mat(0xd9b45a, { metal: 0.9, rough: 0.25 }));
  g.add(tube);
  const lead = box(0.06, 0.3, 0.06, mat(0xd9b45a, { metal: 0.9, rough: 0.25 }), 0.24, -0.15, 0);
  g.add(lead);
  return g;
}

// ---------------------------------------------------------------- US-100
export function us100() {
  const m = M();
  const g = new THREE.Group();
  g.add(box(4.5, 0.16, 2.0, m.pcbBlue, 0, 1.28, 0));
  const can = mat(0xc0c4ca, { metal: 0.85, rough: 0.35 });
  const mesh = mat(0x2a2c30, { rough: 0.9 });
  for (const x of [-1.3, 1.3]) {
    const c = cyl(0.8, 0.8, 1.2, can, 32);
    c.position.set(x, 0.6, 0);
    g.add(c);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.66, 32), mesh);
    face.rotation.x = Math.PI / 2;
    face.position.set(x, -0.005, 0);
    g.add(face);
  }
  g.add(box(0.7, 0.15, 0.7, m.chip, 0, 1.43, 0.25));
  g.add(box(0.5, 0.2, 0.3, m.silver, 0, 1.46, -0.5)); // crystal
  g.add(box(0.5, 0.25, 0.25, m.plasticBlack, -0.1, 1.48, 0.75)); // jumper
  g.add(box(0.2, 0.18, 0.16, mat(0xd8d8d8), -0.1, 1.62, 0.75));
  for (let i = 0; i < 5; i++) g.add(box(0.06, 0.55, 0.06, m.gold, -0.5 + i * 0.254, 1.6, -0.85));
  return g;
}

// ---------------------------------------------------------------- Power parts
export function cell18650() {
  const g = new THREE.Group();
  const wrap = canvasTex(512, 256, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#3b2a9c');
    gr.addColorStop(0.5, '#6a4fe0');
    gr.addColorStop(1, '#3b2a9c');
    c.fillStyle = gr;
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff';
    c.font = 'bold 44px sans-serif';
    c.fillText('18650  3.7V  3000mAh', 30, 140);
  });
  const body = cyl(0.9, 0.9, 6.3, mat(0xffffff, { map: wrap, rough: 0.35 }), 40);
  body.rotation.z = Math.PI / 2;
  g.add(body);
  const capP = cyl(0.4, 0.45, 0.15, mat(0xc9ccd1, { metal: 0.9, rough: 0.25 }));
  capP.rotation.z = -Math.PI / 2;
  capP.position.x = 3.22;
  g.add(capP);
  const capN = cyl(0.85, 0.85, 0.06, mat(0xc9ccd1, { metal: 0.9, rough: 0.25 }));
  capN.rotation.z = Math.PI / 2;
  capN.position.x = -3.17;
  g.add(capN);
  return g;
}

export function holder18650() {
  const m = M();
  const g = new THREE.Group();
  const p = m.plasticBlack;
  g.add(box(7.7, 0.15, 2.1, p, 0, -1.0, 0)); // base (against the wall)
  g.add(box(7.7, 1.2, 0.15, p, 0, -0.45, 1.0));
  g.add(box(7.7, 1.2, 0.15, p, 0, -0.45, -1.0));
  g.add(box(0.2, 2.0, 2.1, p, 3.75, 0, 0));
  g.add(box(0.2, 2.0, 2.1, p, -3.75, 0, 0));
  // spring + contact
  const sp = [];
  for (let i = 0; i <= 160; i++) {
    const t = i / 160;
    const a = t * 6 * Math.PI * 2;
    sp.push(new THREE.Vector3(-3.6 + t * 0.4, Math.cos(a) * 0.35, Math.sin(a) * 0.35));
  }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sp), 200, 0.03, 5), m.silver));
  g.add(box(0.05, 0.8, 0.8, m.silver, 3.6, 0, 0));
  // leads
  g.add(box(0.8, 0.06, 0.06, mat(0xe63946), 4.2, -0.8, 0.3));
  g.add(box(0.8, 0.06, 0.06, mat(0x222222), -4.2, -0.8, 0.3));
  return g;
}

export function tp4056() {
  const m = M();
  const g = new THREE.Group();
  g.add(box(2.6, 0.12, 1.7, m.pcbBlue, 0, 0, 0));
  g.add(box(0.75, 0.28, 0.8, m.silver, -1.05, 0.2, 0)); // micro USB
  g.add(box(0.5, 0.14, 0.4, m.chip, 0.0, 0.13, 0.3)); // TP4056
  g.add(box(0.3, 0.1, 0.3, m.chip, 0.55, 0.11, -0.4)); // DW01
  g.add(box(0.3, 0.1, 0.25, m.chip, 0.9, 0.11, -0.4)); // 8205A
  g.add(box(0.12, 0.08, 0.08, mat(0xff3030, { emissive: 0xff2020, emissiveIntensity: 0.8 }), -0.2, 0.1, -0.55));
  g.add(box(0.12, 0.08, 0.08, mat(0x30a0ff, { emissive: 0x2080ff, emissiveIntensity: 0.4 }), 0.05, 0.1, -0.55));
  for (const [x, z] of [[-1.15, 0.65], [-1.15, -0.65], [1.15, 0.65], [1.15, -0.65], [1.15, 0.25], [1.15, -0.25]]) {
    g.add(box(0.22, 0.04, 0.22, m.gold, x, 0.07, z));
  }
  for (const [x, z] of [[-1.15, 0.65], [-1.15, -0.65], [1.15, 0.65], [1.15, -0.65], [1.15, 0.25], [1.15, -0.25]]) {
    g.add(box(0.05, 0.6, 0.05, m.gold, x, -0.3, z));
  }
  return g;
}
export const TP_PADS = { 'IN+': [-1.15, -0.65], 'IN-': [-1.15, 0.65], 'B+': [1.15, -0.65], 'B-': [1.15, -0.25], 'OUT+': [1.15, 0.25], 'OUT-': [1.15, 0.65] };

export function ldo() {
  const m = M();
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.5, 24, 1, false, 0, Math.PI), m.chip);
  body.position.y = 0.55;
  g.add(body);
  g.add(box(0.5, 0.5, 0.01, m.chip, 0, 0.55, 0));
  for (const x of [-0.13, 0, 0.13]) g.add(box(0.04, 0.4, 0.04, m.silver, x, 0.12, 0));
  return g;
}
export const LDO_PINS = { GND: -0.13, IN: 0, OUT: 0.13 };

export function caps() {
  const g = new THREE.Group();
  const elec = canvasTex(256, 128, (c, w, h) => {
    c.fillStyle = '#20307a';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#c8cbe0';
    c.fillRect(0, 0, 40, h);
    c.fillStyle = '#fff';
    c.font = 'bold 26px sans-serif';
    c.fillText('470µF 16V', 70, 72);
  });
  const big = cyl(0.5, 0.5, 1.3, mat(0xffffff, { map: elec, rough: 0.4 }), 32);
  big.position.set(0, 0.65, 0);
  g.add(big);
  const topc = new THREE.Mesh(new THREE.CircleGeometry(0.48, 32), mat(0xb8bcc2, { metal: 0.8, rough: 0.3 }));
  topc.rotation.x = -Math.PI / 2;
  topc.position.set(0, 1.31, 0);
  g.add(topc);
  for (const [x, z] of [[0.95, 0.1], [1.55, 0.1]]) {
    const s = cyl(0.25, 0.25, 0.6, mat(0x1d1d24, { rough: 0.4 }), 24);
    s.position.set(x, 0.3, z);
    g.add(s);
  }
  const disc = cyl(0.22, 0.22, 0.08, mat(0xe0a83b), 24);
  disc.rotation.x = Math.PI / 2;
  disc.position.set(2.1, 0.35, 0.1);
  g.add(disc);
  return g;
}

export function resistorPair() {
  const g = new THREE.Group();
  const bands = canvasTex(256, 64, (c, w, h) => {
    c.fillStyle = '#7fa7c9';
    c.fillRect(0, 0, w, h);
    for (const [x, col] of [[50, '#8b4513'], [85, '#000'], [120, '#ffd200'], [200, '#8b4513']]) {
      c.fillStyle = col;
      c.fillRect(x, 0, 16, h);
    }
  });
  for (const z of [-0.25, 0.25]) {
    const r = cyl(0.12, 0.12, 0.65, mat(0xffffff, { map: bands }), 16);
    r.rotation.z = Math.PI / 2;
    r.position.set(0, 0.15, z);
    g.add(r);
    const lead = cyl(0.02, 0.02, 1.3, mat(0xb8bcc2, { metal: 0.8 }), 6);
    lead.rotation.z = Math.PI / 2;
    lead.position.set(0, 0.15, z);
    g.add(lead);
  }
  return g;
}

export function spdt() {
  const m = M();
  const g = new THREE.Group();
  g.add(box(1.1, 1.2, 0.8, mat(0x2a2d33), 0, 0, 0));
  for (const z of [-0.25, 0, 0.25]) g.add(box(0.3, 0.06, 0.12, m.silver, -0.7, 0, z));
  const bush = cyl(0.3, 0.3, 0.9, m.silver, 6);
  bush.rotation.z = Math.PI / 2;
  bush.position.x = 1.0;
  g.add(bush);
  const boot = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.0, 20), mat(0x111111, { rough: 0.9 }));
  boot.rotation.z = -Math.PI / 2 - 0.35;
  boot.position.set(1.85, 0.15, 0);
  g.add(boot);
  return g;
}

export function terminals() {
  const g = new THREE.Group();
  const blue = mat(0x2b74c9, { rough: 0.5 });
  for (const z of [0, 1.15]) {
    g.add(box(1.0, 0.8, 1.0, blue, 0, 0.4, z));
    for (const x of [-0.25, 0.25]) {
      const s = cyl(0.14, 0.14, 0.05, mat(0xc9ccd1, { metal: 0.9, rough: 0.3 }), 16);
      s.position.set(x, 0.82, z);
      g.add(s);
    }
  }
  return g;
}

export function perfboard() {
  const m = M();
  const g = new THREE.Group();
  const tex = canvasTex(900, 700, (c, w, h) => {
    c.fillStyle = '#c99a5b';
    c.fillRect(0, 0, w, h);
    for (let x = 12; x < w; x += 25.4) {
      for (let y = 12; y < h; y += 25.4) {
        c.fillStyle = '#b07a2c';
        c.beginPath();
        c.arc(x, y, 8, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#3a2a14';
        c.beginPath();
        c.arc(x, y, 3.5, 0, Math.PI * 2);
        c.fill();
      }
    }
  });
  const top = mat(0xffffff, { map: tex, rough: 0.7 });
  const edge = mat(0xb88a4c, { rough: 0.8 });
  g.add(new THREE.Mesh(new THREE.BoxGeometry(9, 0.16, 7), [edge, edge, top, edge, edge, edge]));
  // standoffs
  for (const [x, z] of [[-4.1, -3.1], [4.1, -3.1], [-4.1, 3.1], [4.1, 3.1]]) {
    const s = cyl(0.22, 0.22, 2.7, m.brass, 6);
    s.position.set(x, -1.43, z);
    g.add(s);
  }
  // female headers for ESP32 (centre -0.6, 0.4 on board)
  for (const z of [-0.87, 1.67]) g.add(box(3.9, 0.85, 0.26, m.plasticBlack, -0.6, 0.5, z));
  // 4-pin US-100 header
  g.add(box(1.05, 0.25, 0.26, m.plasticBlack, -3.6, 0.2, 2.9));
  for (let i = 0; i < 4; i++) g.add(box(0.06, 0.6, 0.06, m.gold, -3.98 + i * 0.254, 0.4, 2.9));
  return g;
}

// ---------------------------------------------------------------- Enclosure
export function enclosure() {
  const g = new THREE.Group();
  const abs = mat(0xdfe3e8, { rough: 0.45, side: THREE.DoubleSide });
  abs.userData.shell = true;
  const T = 0.3;
  // bottom with two 16 mm holes
  const s = new THREE.Shape();
  s.moveTo(-5, -5);
  s.lineTo(5, -5);
  s.lineTo(5, 5);
  s.lineTo(-5, 5);
  s.lineTo(-5, -5);
  for (const x of [-1.3, 1.3]) {
    const h = new THREE.Path();
    h.absarc(x, 0, 0.8, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  const bottom = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false, curveSegments: 32 }), abs);
  bottom.rotation.x = Math.PI / 2;
  bottom.position.y = T;
  g.add(bottom);
  g.add(box(10, 7 - T, T, abs, 0, (7 + T) / 2, 5 - T / 2));
  g.add(box(10, 7 - T, T, abs, 0, (7 + T) / 2, -5 + T / 2));
  g.add(box(T, 7 - T, 10 - 2 * T, abs, 5 - T / 2, (7 + T) / 2, 0));
  g.add(box(T, 7 - T, 10 - 2 * T, abs, -5 + T / 2, (7 + T) / 2, 0));
  // corner screw bosses
  for (const [x, z] of [[-4.3, -4.3], [4.3, -4.3], [-4.3, 4.3], [4.3, 4.3]]) {
    const b = cyl(0.45, 0.45, 6.6, abs, 16);
    b.position.set(x, 3.6, z);
    g.add(b);
  }
  // mounting ears on the back
  for (const y of [1.2, 5.8]) g.add(box(12, 0.9, T, abs, 0, y, -5 - T / 2));
  return g;
}

export function lid() {
  const g = new THREE.Group();
  const abs = mat(0xe9ecf0, { rough: 0.4, side: THREE.DoubleSide });
  abs.userData.shell = true;
  g.add(box(10.4, 0.45, 10.4, abs, 0, 0.225, 0));
  g.add(box(8.6, 0.15, 8.6, abs, 0, 0.52, 0));
  g.add(box(9.6, 0.12, 9.6, mat(0xff7b29, { rough: 0.8 }), 0, -0.06, 0)); // gasket
  for (const [x, z] of [[-4.3, -4.3], [4.3, -4.3], [-4.3, 4.3], [4.3, 4.3]]) {
    const sc = cyl(0.32, 0.32, 0.15, mat(0x9aa0a8, { metal: 0.9, rough: 0.3 }), 20);
    sc.position.set(x, 0.5, z);
    g.add(sc);
    g.add(box(0.4, 0.04, 0.07, mat(0x333333), x, 0.58, z));
  }
  return g;
}

export function gland() {
  const g = new THREE.Group();
  const nylon = mat(0x2a2c31, { rough: 0.7 });
  const nut = cyl(0.75, 0.75, 0.5, nylon, 6);
  nut.rotation.z = Math.PI / 2;
  g.add(nut);
  const dome = cyl(0.45, 0.65, 0.7, nylon, 6);
  dome.rotation.z = Math.PI / 2;
  dome.position.x = -0.6;
  g.add(dome);
  const thread = cyl(0.55, 0.55, 0.6, nylon, 20);
  thread.rotation.z = Math.PI / 2;
  thread.position.x = 0.5;
  g.add(thread);
  return g;
}

export function silica() {
  const g = new THREE.Group();
  const tex = canvasTex(256, 200, (c, w, h) => {
    c.fillStyle = '#f4f4f0';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#2b6cb0';
    c.font = 'bold 30px sans-serif';
    c.fillText('SILICA GEL', 30, 90);
    c.font = '20px sans-serif';
    c.fillText('DO NOT EAT', 60, 130);
  });
  const p = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.3, 2.0), mat(0xffffff, { map: tex, rough: 0.9 }));
  g.add(p);
  return g;
}

export function solarPanel() {
  const g = new THREE.Group();
  const cells = canvasTex(1024, 820, (c, w, h) => {
    c.fillStyle = '#0d1a3a';
    c.fillRect(0, 0, w, h);
    const cols = 6;
    const rows = 5;
    const cw = (w - 40) / cols;
    const ch = (h - 40) / rows;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = 20 + i * cw;
        const y = 20 + j * ch;
        const gr = c.createLinearGradient(x, y, x + cw, y + ch);
        gr.addColorStop(0, '#1d3b8a');
        gr.addColorStop(1, '#122a66');
        c.fillStyle = gr;
        c.fillRect(x + 3, y + 3, cw - 6, ch - 6);
        c.strokeStyle = 'rgba(200,210,230,0.45)';
        c.lineWidth = 1.5;
        for (let k = 1; k < 4; k++) {
          c.beginPath();
          c.moveTo(x + 3, y + (k * ch) / 4);
          c.lineTo(x + cw - 3, y + (k * ch) / 4);
          c.stroke();
        }
        c.strokeStyle = 'rgba(220,225,235,0.8)';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(x + cw / 2, y + 3);
        c.lineTo(x + cw / 2, y + ch - 3);
        c.stroke();
      }
    }
  });
  const glass = new THREE.MeshPhysicalMaterial({ map: cells, roughness: 0.15, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 });
  const alu = mat(0xc4c8ce, { metal: 0.9, rough: 0.3 });
  g.add(new THREE.Mesh(new THREE.BoxGeometry(13.6, 0.25, 11), [alu, alu, glass, mat(0xeeeeee), alu, alu]));
  g.add(box(13.8, 0.4, 0.2, alu, 0, 0.05, 5.6));
  g.add(box(13.8, 0.4, 0.2, alu, 0, 0.05, -5.6));
  g.add(box(0.2, 0.4, 11.2, alu, 6.9, 0.05, 0));
  g.add(box(0.2, 0.4, 11.2, alu, -6.9, 0.05, 0));
  g.add(box(2.2, 0.6, 1.6, mat(0x1b1c20), 0, -0.45, -2.5)); // junction box
  return g;
}

export function bracket() {
  const g = new THREE.Group();
  const steel = mat(0x56606b, { metal: 0.6, rough: 0.45 }); // painted MS
  // vertical bar against the back of the box (local origin = box bottom, back face)
  g.add(box(2.5, 26, 0.5, steel, 0, 13, -0.25));
  // L-bend horizontal arm towards the railing
  g.add(box(2.5, 0.5, 24, steel, 0, 25.75, -12.25));
  // panel arm and tilt plate
  g.add(box(1.6, 0.4, 7.5, steel, 0, 13.5, 3.5));
  const brace = box(1.2, 0.4, 7.0, steel, 0, 10.8, 2.5);
  brace.rotation.x = 0.75;
  g.add(brace);
  // M4 screws into the box ears
  for (const y of [1.2, 5.8]) {
    for (const x of [-5.4, 5.4]) {
      const s = cyl(0.35, 0.35, 0.25, mat(0xaab0b8, { metal: 0.9, rough: 0.3 }), 16);
      s.rotation.x = Math.PI / 2;
      s.position.set(x, y, -0.55);
      g.add(s);
    }
  }
  return g;
}

export function clamp() {
  const g = new THREE.Group();
  const steel = mat(0x56606b, { metal: 0.6, rough: 0.45 });
  const zinc = mat(0xb7bcc3, { metal: 0.9, rough: 0.25 });
  // U-clamp around a 4.8 cm rail
  const u = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.3, 10, 32, Math.PI), steel);
  u.rotation.z = Math.PI;
  u.rotation.y = Math.PI / 2;
  g.add(u);
  g.add(box(0.6, 2.2, 0.6, steel, 0, 1.0, 2.7));
  g.add(box(0.6, 2.2, 0.6, steel, 0, 1.0, -2.7));
  g.add(box(3.0, 0.5, 7.0, steel, 0, 2.3, 0));
  // M8 bolt + washer + nut
  const bolt = cyl(0.4, 0.4, 4.2, zinc, 16);
  bolt.position.set(0, 2.6, 0);
  g.add(bolt);
  const head = cyl(0.75, 0.75, 0.55, zinc, 6);
  head.position.set(0, 4.7, 0);
  g.add(head);
  const washer = cyl(0.9, 0.9, 0.12, zinc, 24);
  washer.position.set(0, 4.35, 0);
  g.add(washer);
  const nut = cyl(0.75, 0.75, 0.6, zinc, 6);
  nut.position.set(0, 0.6, 0);
  g.add(nut);
  return g;
}

export function wireCoil() {
  const g = new THREE.Group();
  const cols = [0xe63946, 0x1d1d1f, 0x2f80ed, 0xf4c430];
  cols.forEach((c, i) => {
    const t = new THREE.Mesh(new THREE.TorusGeometry(2.4 - i * 0.12, 0.1, 8, 48), mat(c, { rough: 0.5 }));
    t.rotation.x = Math.PI / 2;
    t.position.y = 0.1 + i * 0.2;
    g.add(t);
  });
  return g;
}
