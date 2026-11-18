// Assembles the RiverMon sensor node from the part library.
// Frame: centimetres, origin = centre of the enclosure's bottom outer face,
// +y up (lid), -z = back wall (bracket side), +z = south (panel faces it).
import * as THREE from 'three';
import * as P from './parts.js';
import { WIRES, WIRE_COLORS } from './data.js';

const BY = 3.08; // top surface of the perfboard
const BZ = -1.1; // perfboard centre z
const v = (x, y, z) => new THREE.Vector3(x, y, z);
const deg = THREE.MathUtils.degToRad;

const LAYOUT = {
  box: { make: P.enclosure, pos: v(0, 0, 0), ex: v(0, 0, 0), tray: [-36, -24] },
  us100: { make: P.us100, pos: v(0, 0, 0), ex: v(0, -11, 0), tray: [27, -24] },
  perf: { make: P.perfboard, pos: v(0, 3.0, BZ), ex: v(0, 5, 0), tray: [-8, -24] },
  terminal: { make: P.terminals, pos: v(-3.9, BY, -4.0), ex: v(-8, 8, -5), tray: [0, -38] },
  tp4056: { make: P.tp4056, pos: v(-1.95, BY + 0.62, -3.4), ex: v(-4, 10, -8), tray: [37, -24] },
  ldo: { make: P.ldo, pos: v(-0.35, BY, -3.6), ex: v(0, 9, -9), tray: [28, -38] },
  caps: { make: P.caps, pos: v(0.8, BY, -3.6), ex: v(3, 10, -9), tray: [35, -38] },
  divider: { make: P.resistorPair, pos: v(3.9, BY, -3.4), ex: v(7, 9, -8), tray: [7, -38] },
  spdt: { make: P.spdt, pos: v(4.15, 5.3, -3.4), ex: v(14, 2, -2), tray: [-8, -38] },
  holder: { make: P.holder18650, pos: v(0, 5.3, 3.65), rot: [-Math.PI / 2, 0, 0], ex: v(0, 4, 13), tray: [-19, -42], trayRot: [0, 0, 0] },
  cell: { make: P.cell18650, pos: v(0, 5.3, 3.65), ex: v(0, 9, 19), tray: [-19, -35] },
  esp32: { make: P.esp32, pos: v(-0.6, 4.05, -0.7), ex: v(-1, 13, 0), tray: [4, -24] },
  ra02: { make: P.ra02, pos: v(3.55, 3.83, -0.7), ex: v(7, 12, 1), tray: [13, -24] },
  antenna: { make: P.springAntenna, pos: v(4.25, 3.95, -0.02), scale: v(1, 0.93, 1), ex: v(9, 16, 1), tray: [19, -24] },
  wires: { make: P.wireCoil, pos: v(0, 0, 0), ex: v(0, 0, 0), tray: [-14, -55] },
  gland: { make: P.gland, pos: v(-5.3, 5.2, -0.8), ex: v(-12, 0, 0), tray: [14, -38] },
  silica: { make: P.silica, pos: v(2.8, 0.45, 3.0), ex: v(6, -4, 9), tray: [21, -38] },
  lid: { make: P.lid, pos: v(0, 7.0, 0), ex: v(0, 21, 0), tray: [-22, -24] },
  bracket: { make: P.bracket, pos: v(0, 0, -5.3), ex: v(0, 0, -16), tray: [10, -60], trayRot: [0, 0, Math.PI / 2] },
  clamp: { make: P.clamp, pos: v(0, 22.95, -27.5), ex: v(0, 8, -22), tray: [30, -55] },
  panel: { make: P.solarPanel, pos: v(0, 15.2, 0.6), rot: [deg(17), 0, 0], ex: v(0, 14, 24), tray: [-36, -40] },
};

export const RAIL_LOCAL = v(0, 22.95, -27.5); // centre of the railing's top rail

const edgeMat = new THREE.LineBasicMaterial({ color: 0x0a1018, transparent: true, opacity: 0.5 });

function addEdges(group) {
  group.traverse((o) => {
    if (!o.isMesh || o.userData.noEdges) return;
    const g = o.geometry;
    if (g.type === 'TubeGeometry' || g.type === 'TorusGeometry' || g.attributes.position.count > 2500) return;
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(g, 28), edgeMat);
    e.userData.isEdge = true;
    e.raycast = () => {};
    o.add(e);
  });
}


function finalize(root, parts, edges) {
  if (edges) Object.values(parts).forEach((p) => addEdges(p.group));

  // give every mesh its own material instance so highlight / x-ray stay per part
  root.traverse((o) => {
    if (o.isMesh) {
      o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => {
        m.userData.baseOpacity = m.opacity;
        m.userData.baseTransparent = m.transparent;
        m.userData.baseEmissive = m.emissive ? m.emissive.getHex() : 0;
        m.userData.baseEmissiveIntensity = m.emissiveIntensity;
      });
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

}

export function buildNode({ edges = true } = {}) {
  const root = new THREE.Group();
  root.name = 'node';
  const parts = {};

  for (const [id, L] of Object.entries(LAYOUT)) {
    const g = L.make();
    g.name = id;
    g.userData.partId = id;
    const homeQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(L.rot || [0, 0, 0])));
    const trayQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(L.trayRot || L.rot || [0, 0, 0])));
    if (L.scale) g.scale.copy(L.scale);
    // tray position: bounding box centred on the slot, resting on the mat
    g.quaternion.copy(trayQ);
    g.position.set(0, 0, 0);
    g.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(g);
    const c = bb.getCenter(new THREE.Vector3());
    const trayPos = v(L.tray[0] - c.x, -bb.min.y + 0.02, L.tray[1] - c.z);
    parts[id] = {
      id,
      group: g,
      home: { pos: L.pos.clone(), quat: homeQ },
      tray: { pos: trayPos, quat: trayQ },
      explode: L.ex.clone(),
      size: bb.getSize(new THREE.Vector3()),
    };
    g.position.copy(L.pos);
    g.quaternion.copy(homeQ);
    root.add(g);
  }

  // ------------------------------------------------ panel cable with drip loop
  const panel = parts.panel;
  const pm = new THREE.Matrix4().compose(panel.home.pos, panel.home.quat, v(1, 1, 1));
  const jb = v(0, -0.75, -2.5).applyMatrix4(pm);
  const cablePts = [jb, v(-1.5, jb.y - 2, jb.z - 1), v(-4, 10, -3), v(-7.2, 7, -1.5), v(-7.6, 3.6, -1.0), v(-6.9, 3.4, -0.8), v(-6.5, 4.6, -0.8), v(-5.9, 5.2, -0.8)];
  const inv = pm.clone().invert();
  const localPts = cablePts.map((p) => p.clone().applyMatrix4(inv));
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(localPts), 80, 0.22, 8), P.mat(0x1a1b1f, { rough: 0.7 }));
  panel.group.add(cable);

  // ------------------------------------------------ wiring loom (box frame)
  const loom = new THREE.Group();
  loom.name = 'loom';
  const H = parts;
  const rot = (id, local) => local.clone().applyQuaternion(H[id].home.quat).add(H[id].home.pos);
  const resolve = (ref) => {
    const [dev, pin] = ref.split(':');
    switch (dev) {
      case 'esp': {
        const p = P.espPinLocal(pin);
        const out = p.z < 0 ? -0.38 : 0.38;
        return v(H.esp32.home.pos.x + p.x, BY + 0.03, H.esp32.home.pos.z + p.z + out);
      }
      case 'ra02': {
        const p = P.raPadLocal(pin);
        return v(H.ra02.home.pos.x + p.x - 0.3, BY + 0.03, H.ra02.home.pos.z + p.z);
      }
      case 'ldo':
        return v(H.ldo.home.pos.x + P.LDO_PINS[pin], BY + 0.03, H.ldo.home.pos.z + 0.3);
      case 'tp': {
        const [x, z] = P.TP_PADS[pin];
        return v(H.tp4056.home.pos.x + x, H.tp4056.home.pos.y + 0.1, H.tp4056.home.pos.z + z);
      }
      case 'hdr': {
        const i = ['VCC', 'TX', 'RX', 'GND'].indexOf(pin);
        return v(-3.98 + i * 0.254, BY + 0.03, BZ + 2.9 - 0.3);
      }
      case 'div':
        return v(H.divider.home.pos.x, BY + 0.03, H.divider.home.pos.z + 0.55);
      case 'spdt':
        return v(3.3, 5.3, -3.4 + (pin === 'A' ? -0.25 : 0.25));
      case 'term1':
      case 'term2': {
        const z = dev === 'term1' ? -4.0 : -2.85;
        return v(-3.9 + (pin === '1' ? -0.25 : 0.25), BY + 0.86, z);
      }
    }
    return v();
  };
  const espRect = { x0: -3.2, x1: 2.0, z0: -2.1, z1: 0.7 };
  const crossesEsp = (a, b) => {
    for (let t = 0.1; t < 0.95; t += 0.1) {
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      if (x > espRect.x0 && x < espRect.x1 && z > espRect.z0 && z < espRect.z1) return true;
    }
    return false;
  };
  const wires = [];
  WIRES.forEach((w, i) => {
    const a = resolve(w.a);
    const b = resolve(w.b);
    const d = a.distanceTo(b);
    let lift = 0.25 + d * 0.12 + (i % 4) * 0.06;
    let midY = Math.max(a.y, b.y) + lift;
    if (crossesEsp(a, b)) midY = Math.max(midY, 4.75 + (i % 5) * 0.12);
    const m1 = a.clone().lerp(b, 0.25);
    const m2 = a.clone().lerp(b, 0.75);
    m1.y = midY;
    m2.y = midY;
    const pts = [a, a.clone().add(v(0, 0.2, 0)), m1, m2, b.clone().add(v(0, 0.2, 0)), b];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const m = P.mat(WIRE_COLORS[w.c], { rough: 0.45, emissive: 0x000000 });
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.05, 6), m);
    mesh.userData.wire = i;
    loom.add(mesh);
    // solder joints
    for (const p of [a, b]) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), P.mat(0xc9ccd1, { metal: 0.9, rough: 0.3 }));
      s.position.copy(p);
      mesh.add(s);
      s.position.sub(v(0, 0, 0));
    }
    wires.push({ def: w, mesh, a, b, curve });
  });
  // US-100 cable from the sensor pins up to the board header
  ['r', 'y', 'y', 'k'].forEach((c, i) => {
    const a = v(-0.5 + i * 0.254, 1.9, -0.85);
    const b = v(-3.98 + i * 0.254, BY - 0.1, BZ + 2.9);
    const curve = new THREE.CatmullRomCurve3([a, v(a.x - 1, 2.3, 0.4), v(b.x + 0.3, 2.5, b.z - 0.3), b]);
    loom.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.045, 6), P.mat(WIRE_COLORS[c], { rough: 0.45 })));
  });
  // the loom belongs to the "wires" part when assembled; the coil is its tray look
  const coil = parts.wires.group;
  const wiresPart = new THREE.Group();
  wiresPart.name = 'wires';
  wiresPart.userData.partId = 'wires';
  root.remove(coil);
  wiresPart.add(coil);
  wiresPart.add(loom);
  root.add(wiresPart);
  parts.wires.group = wiresPart;
  parts.wires.coil = coil;
  parts.wires.loom = loom;
  coil.position.copy(parts.wires.tray.pos);
  parts.wires.home.pos.set(0, 0, 0);
  parts.wires.tray.pos.set(0, 0, 0);

  finalize(root, parts, edges);

  return { root, parts, wires, loom, edgeMat };
}

// wiresPart shows the coil in the tray and the loom when placed
export function setWiresPlaced(node, placed) {
  node.parts.wires.coil.visible = !placed;
  node.parts.wires.loom.visible = placed;
}

// ------------------------------------------------------------------ gateway
// Second ESP32 + Ra-02 on the same carrier layout (power parts unpopulated),
// USB-powered from a 5 V adapter, in the same IP65 box. Guide section 1.4.2 / 1.10.
function usbAdapter() {
  const g = new THREE.Group();
  const white = P.mat(0xf2f2f0, { rough: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.0, 3.2), white);
  body.position.y = 1.5;
  g.add(body);
  const port = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 1.3), P.mat(0x222222));
  port.position.set(2.15, 1.6, 0);
  g.add(port);
  for (const z of [-0.6, 0.6]) {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.8, 12), P.mat(0xc9ccd1, { metal: 0.9, rough: 0.3 }));
    pin.rotation.z = Math.PI / 2;
    pin.position.set(-3.0, 1.5, z);
    g.add(pin);
  }
  const lbl = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.2), P.mat(0xffffff, { map: P.canvasTex(256, 120, (c, w, h) => {
    c.fillStyle = '#f2f2f0'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#333'; c.font = 'bold 34px sans-serif'; c.fillText('5V ⎓ 2A', 50, 55);
    c.font = '22px sans-serif'; c.fillText('USB POWER', 62, 95);
  }) }));
  lbl.rotation.x = -Math.PI / 2;
  lbl.position.set(0, 3.01, 0);
  g.add(lbl);
  return g;
}

const GW_LAYOUT = {
  box: { make: P.enclosure, pos: v(0, 0, 0), ex: v(0, 0, 0) },
  perf: { make: P.perfboard, pos: v(0, 3.0, BZ), ex: v(0, 5, 0) },
  esp32: { make: P.esp32, pos: v(-0.6, 4.05, -0.7), ex: v(-1, 12, 0) },
  ra02: { make: P.ra02, pos: v(3.55, 3.83, -0.7), ex: v(7, 11, 1) },
  antenna: { make: P.springAntenna, pos: v(4.25, 3.95, -0.02), scale: v(1, 0.93, 1), ex: v(9, 16, 1) },
  caps: { make: P.caps, pos: v(1.2, BY, -3.6), ex: v(3, 9, -8) },
  gland: { make: P.gland, pos: v(-5.3, 5.2, -0.8), ex: v(-10, 0, 0) },
  silica: { make: P.silica, pos: v(2.8, 0.45, 3.0), ex: v(6, -4, 9) },
  lid: { make: P.lid, pos: v(0, 7.0, 0), ex: v(0, 17, 0) },
  adapter: { make: usbAdapter, pos: v(-17, 0, -0.8), ex: v(-6, 0, 0) },
};
export const GW_ANT_TIP = v(4.25, 3.95 + 3.1 * 0.93, -0.02);

export function buildGateway({ edges = true } = {}) {
  const root = new THREE.Group();
  root.name = 'gateway';
  const parts = {};
  for (const [id, L] of Object.entries(GW_LAYOUT)) {
    const g = L.make();
    g.name = id;
    g.userData.partId = id;
    if (L.scale) g.scale.copy(L.scale);
    g.position.copy(L.pos);
    root.add(g);
    parts[id] = { id, group: g, home: { pos: L.pos.clone(), quat: new THREE.Quaternion() }, explode: L.ex.clone() };
  }
  // SPI + power loom Ra-02 <-> ESP32 (same pins as the node)
  const esp = parts.esp32.home.pos;
  const ra = parts.ra02.home.pos;
  const espEnd = (pin) => {
    const p = P.espPinLocal(pin);
    return v(esp.x + p.x, BY + 0.03, esp.z + p.z + (p.z < 0 ? -0.38 : 0.38));
  };
  const raEnd = (pin) => {
    const p = P.raPadLocal(pin);
    return v(ra.x + p.x - 0.3, BY + 0.03, ra.z + p.z);
  };
  const defs = [['SCK', 'D18', 'b'], ['MISO', 'D19', 'b'], ['MOSI', 'D23', 'b'], ['NSS', 'D5', 'y'], ['RST', 'D14', 'y'], ['DIO0', 'D26', 'y'], ['3V3', '3V3', 'r'], ['GND', 'GND2', 'k']];
  const loom = new THREE.Group();
  loom.userData.partId = 'wires';
  defs.forEach(([a, b, c], i) => {
    const A = raEnd(a);
    const B = espEnd(b);
    const m1 = A.clone().lerp(B, 0.25);
    const m2 = A.clone().lerp(B, 0.75);
    m1.y = m2.y = Math.max(A.y, B.y) + 0.35 + A.distanceTo(B) * 0.12 + (i % 4) * 0.06;
    const curve = new THREE.CatmullRomCurve3([A, A.clone().add(v(0, 0.2, 0)), m1, m2, B.clone().add(v(0, 0.2, 0)), B], false, 'centripetal');
    loom.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.05, 6), P.mat(WIRE_COLORS[c], { rough: 0.45 })));
  });
  root.add(loom);
  // USB cable: ESP32 micro-USB -> gland -> adapter (part of the adapter group)
  const usbPort = v(esp.x - 2.85, esp.y + 0.23, esp.z);
  const adP = parts.adapter.home.pos;
  const pts = [usbPort, v(-4.2, 4.6, -0.75), v(-5.9, 5.2, -0.8), v(-8, 4.6, -1), v(-10, 1.0, 1.5), v(-12.5, 0.3, 1.8), v(adP.x + 2.6, 1.6, adP.z)];
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => p.clone().sub(adP))), 80, 0.18, 8), P.mat(0x1a1b1f, { rough: 0.7 }));
  parts.adapter.group.add(cable);
  finalize(root, parts, edges);
  return { root, parts, edgeMat };
}
