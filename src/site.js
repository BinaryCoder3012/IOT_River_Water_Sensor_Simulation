// Field installation: river, bridge, staff gauge, node on bracket, LoRa link
// to a gateway on a building, and the ultrasonic beam. Units: metres.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { gsap } from 'gsap';
import { buildNode, buildGateway, GW_ANT_TIP, RAIL_LOCAL, setWiresPlaced } from './node.js';
import { canvasTex, mat } from './parts.js';
import { CONFIG, LEVELS } from './data.js';

const NODE_SCALE = 0.04; // cm -> m with 4x exaggeration so the box is visible
const DECK_TOP = 2.87;
const RAIL_Y = 3.918;
const RAIL_X = 2.95;

function label(html, cls = 'lbl') {
  const d = document.createElement('div');
  d.className = cls;
  d.innerHTML = html;
  return new CSS2DObject(d);
}

function terrainHeight(x, z) {
  const az = Math.abs(z);
  let h;
  if (az < 10.5) h = -0.6 + Math.sin(x * 0.15) * 0.05;
  else if (az < 19) {
    const t = (az - 10.5) / 8.5;
    h = -0.6 + (2.85 + 0.6) * (t * t * (3 - 2 * t));
  } else h = 2.85 + Math.min(1, (az - 19) / 30) * (Math.sin(x * 0.07) * 0.8 + Math.cos(z * 0.11) * 0.6 + 0.6);
  return h;
}

const waterVert = /* glsl */ `
  varying vec2 vUv; varying vec3 vW;
  uniform float uTime;
  void main(){
    vUv = uv;
    vec3 p = position;
    vec4 w = modelMatrix * vec4(p,1.0);
    w.y += sin(w.x*0.9 + uTime*1.6)*0.025 + sin(w.z*1.7 - uTime*1.1)*0.015;
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const waterFrag = /* glsl */ `
  varying vec2 vUv; varying vec3 vW;
  uniform float uTime; uniform float uFlood; uniform vec3 uCam;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
  void main(){
    vec2 q = vW.xz*vec2(0.35,0.9) + vec2(uTime*(0.5+uFlood*1.4), 0.0);
    float n = noise(q*2.0)*0.5 + noise(q*5.0)*0.3 + noise(q*11.0)*0.2;
    vec3 clear = mix(vec3(0.06,0.24,0.33), vec3(0.16,0.42,0.50), n);
    vec3 muddy = mix(vec3(0.33,0.25,0.15), vec3(0.50,0.40,0.26), n);
    vec3 col = mix(clear, muddy, uFlood);
    vec3 V = normalize(uCam - vW);
    float fres = pow(1.0 - max(V.y,0.0), 3.0);
    col = mix(col, vec3(0.70,0.82,0.92), fres*0.55);
    float streak = smoothstep(0.78, 0.95, noise(q*vec2(3.0,14.0)));
    col += streak*0.05;
    float edge = smoothstep(9.0, 11.5, abs(vW.z));
    col = mix(col, vec3(0.85,0.85,0.8), edge*0.25*n);
    gl_FragColor = vec4(col, 0.93);
    #include <colorspace_fragment>
  }`;

export function buildSite() {
  const root = new THREE.Group();
  root.name = 'site';

  // ---------------------------------------------------------------- terrain
  const tg = new THREE.PlaneGeometry(260, 180, 260, 180);
  tg.rotateX(-Math.PI / 2);
  const pos = tg.attributes.position;
  const colors = [];
  const cBed = new THREE.Color(0x6b5a43);
  const cSoil = new THREE.Color(0x8a7556);
  const cGrass = new THREE.Color(0x5f8a43);
  const cGrass2 = new THREE.Color(0x7aa152);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    const az = Math.abs(z);
    let c;
    if (az < 11) c = cBed.clone();
    else if (az < 17) c = cSoil.clone().lerp(cGrass, (az - 11) / 6);
    else c = cGrass.clone().lerp(cGrass2, (Math.sin(x * 0.3) * Math.cos(z * 0.2) + 1) / 2);
    colors.push(c.r, c.g, c.b);
  }
  tg.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  tg.computeVertexNormals();
  const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  terrain.receiveShadow = true;
  root.add(terrain);

  // ---------------------------------------------------------------- water
  const waterMat = new THREE.ShaderMaterial({
    vertexShader: waterVert,
    fragmentShader: waterFrag,
    uniforms: { uTime: { value: 0 }, uFlood: { value: 0 }, uCam: { value: new THREE.Vector3() } },
    transparent: true,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(260, 40, 200, 30), waterMat);
  water.rotation.x = -Math.PI / 2;
  root.add(water);

  // ---------------------------------------------------------------- bridge
  const concrete = mat(0xa3a6a8, { rough: 0.85 });
  const concreteDark = mat(0x8a8d90, { rough: 0.9 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(5.9, 0.5, 52), concrete);
  deck.position.set(0, DECK_TOP - 0.25, 0);
  deck.castShadow = deck.receiveShadow = true;
  root.add(deck);
  const road = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.04, 52), mat(0x3a3d42, { rough: 0.95 }));
  road.position.set(0, DECK_TOP + 0.02, 0);
  root.add(road);
  for (const x of [-2.6, 2.6]) {
    const kerb = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 52), concreteDark);
    kerb.position.set(x, DECK_TOP + 0.1, 0);
    root.add(kerb);
  }
  for (const z of [-6, 6]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.1, 0.9), concreteDark);
    pier.position.set(0, -0.6 + 1.55, z);
    pier.castShadow = pier.receiveShadow = true;
    root.add(pier);
    for (const s of [-1, 1]) {
      const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 3.1, 16, 1, false, 0, Math.PI), concreteDark);
      nose.position.set(s * 1.2, -0.6 + 1.55, z);
      nose.rotation.y = s > 0 ? 0 : Math.PI;
      root.add(nose);
    }
  }
  // railings
  const railMat = mat(0x5d6670, { metal: 0.6, rough: 0.4 });
  for (const x of [-RAIL_X, RAIL_X]) {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 52, 16), railMat);
    top.rotation.x = Math.PI / 2;
    top.position.set(x, RAIL_Y, 0);
    top.castShadow = true;
    root.add(top);
    const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 52, 8), railMat);
    mid.rotation.x = Math.PI / 2;
    mid.position.set(x, RAIL_Y - 0.5, 0);
    root.add(mid);
    for (let z = -25; z <= 25; z += 2.5) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, RAIL_Y - DECK_TOP - 0.1, 0.08), railMat);
      post.position.set(x, (RAIL_Y + DECK_TOP + 0.1) / 2, z);
      post.castShadow = true;
      root.add(post);
    }
  }

  // ---------------------------------------------------------------- staff gauge
  const gaugeTex = canvasTex(160, 1600, (c, w, h) => {
    const pxm = h / 3.1; // pixels per metre, gauge 0..3.1 m
    c.fillStyle = '#f7f5ee';
    c.fillRect(0, 0, w, h);
    for (let cm = 0; cm < 310; cm += 10) {
      const y = h - (cm / 100) * pxm;
      const red = Math.floor(cm / 100) % 2 === 0;
      c.fillStyle = red ? '#c62828' : '#1b1b1b';
      // E pattern
      c.fillRect(40, y - pxm * 0.05, 70, pxm * 0.012);
      if (cm % 10 === 0) c.fillRect(40, y - pxm * 0.1 + 2, 18, pxm * 0.05);
    }
    for (let m = 0; m <= 3; m++) {
      const y = h - m * pxm;
      c.fillStyle = '#1b1b1b';
      c.font = 'bold 44px sans-serif';
      c.fillText(String(m), 112, y - 8);
      c.fillRect(30, y - 3, w - 30, 6);
    }
    const th = [[CONFIG.watch, LEVELS[1].color], [CONFIG.warning, LEVELS[2].color], [CONFIG.danger, LEVELS[3].color]];
    th.forEach(([m, col]) => {
      const y = h - m * pxm;
      c.fillStyle = col;
      c.fillRect(0, y - 8, 30, 16);
      c.fillRect(0, y - 2, w, 4);
    });
  });
  const gauge = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 3.1), mat(0xffffff, { map: gaugeTex, rough: 0.6 }));
  gauge.rotation.y = Math.PI / 2;
  gauge.position.set(1.66, 1.55, -6);
  root.add(gauge);
  const thrLabels = [
    [CONFIG.watch, 'WATCH', LEVELS[1].color],
    [CONFIG.warning, 'WARNING', LEVELS[2].color],
    [CONFIG.danger, 'DANGER', LEVELS[3].color],
  ].map(([m, n, col]) => {
    const l = label(`<span style="color:${col}">▸ ${n} ${m.toFixed(1)} m</span>`, 'lbl lbl-thr');
    l.position.set(1.7, m, -6.45);
    root.add(l);
    return l;
  });
  const gl = label('Staff gauge<br><small>gauge zero = 0.00 m</small>', 'lbl lbl-site');
  gl.position.set(1.7, -0.1, -6);
  root.add(gl);

  // ---------------------------------------------------------------- node on the railing
  const node = buildNode({ edges: false });
  setWiresPlaced(node, true);
  const nodeG = node.root;
  nodeG.scale.setScalar(NODE_SCALE);
  nodeG.rotation.y = Math.PI / 2;
  const railLocal = RAIL_LOCAL.clone().multiplyScalar(NODE_SCALE).applyEuler(new THREE.Euler(0, Math.PI / 2, 0));
  nodeG.position.set(RAIL_X, RAIL_Y, 0).sub(railLocal);
  root.add(nodeG);
  const sensor = nodeG.position.clone(); // bottom face of the box = transducer face
  const H = sensor.y; // = CONFIG.mountHeight
  const antTip = new THREE.Vector3(4.25, 7.0, -0.02).multiplyScalar(NODE_SCALE).applyEuler(new THREE.Euler(0, Math.PI / 2, 0)).add(nodeG.position);
  const nl = label('<b>RiverMon node</b><br><small>IP65 box · shown 4× scale</small>', 'lbl lbl-site');
  nl.position.copy(sensor).add(new THREE.Vector3(0.9, 1.1, 0.6));
  root.add(nl);

  // ---------------------------------------------------------------- ultrasonic cone
  const half = THREE.MathUtils.degToRad(CONFIG.beamAngle / 2);
  const coneGeo = new THREE.ConeGeometry(1, 1, 48, 1, true);
  coneGeo.translate(0, -0.5, 0); // apex at origin, base at y = -1
  const coneMat = new THREE.MeshBasicMaterial({ color: 0x4cc9f0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.copy(sensor);
  root.add(cone);
  const foot = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48), new THREE.MeshBasicMaterial({ color: 0x4cc9f0, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
  foot.rotation.x = -Math.PI / 2;
  root.add(foot);
  const pulses = [];
  const pulseGeo = new THREE.RingGeometry(0.8, 1, 40);
  for (let i = 0; i < 9; i++) {
    const p = new THREE.Mesh(pulseGeo, new THREE.MeshBasicMaterial({ color: 0x9be7ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    p.rotation.x = -Math.PI / 2;
    root.add(p);
    pulses.push(p);
  }

  // ---------------------------------------------------------------- dimension lines H / d / h
  const dimMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false });
  const dimGeo = new THREE.BufferGeometry().setFromPoints(new Array(12).fill(0).map(() => new THREE.Vector3()));
  const dims = new THREE.LineSegments(dimGeo, dimMat);
  dims.renderOrder = 10;
  root.add(dims);
  const lblD = label('', 'lbl lbl-dim');
  const lblH = label('', 'lbl lbl-dim');
  const lblHH = label('', 'lbl lbl-dim lbl-dim-H');
  root.add(lblD, lblH, lblHH);

  // ---------------------------------------------------------------- gateway building
  const bx = -30;
  const bz = -40;
  const by = terrainHeight(bx, bz);
  const winTex = canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#d8d2c4';
    c.fillRect(0, 0, w, h);
    for (let f = 0; f < 4; f++) {
      for (let k = 0; k < 4; k++) {
        c.fillStyle = (f + k) % 3 === 0 ? '#ffe7a3' : '#5b7a99';
        c.fillRect(30 + k * 120, 30 + f * 120, 80, 70);
      }
    }
  });
  const bld = new THREE.Mesh(new THREE.BoxGeometry(12, 12, 9), mat(0xffffff, { map: winTex, rough: 0.8 }));
  bld.position.set(bx, by + 6, bz);
  bld.castShadow = bld.receiveShadow = true;
  root.add(bld);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.4, 9.4), mat(0x9a948a));
  roof.position.set(bx, by + 12.2, bz);
  root.add(roof);
  const GW_SCALE = 0.06;
  const gateway = buildGateway({ edges: false });
  gateway.root.scale.setScalar(GW_SCALE);
  gateway.root.rotation.y = Math.PI / 4;
  gateway.root.position.set(bx + 4, by + 12.4, bz + 2.6);
  root.add(gateway.root);
  gateway.root.updateMatrixWorld(true);
  const gwTip = GW_ANT_TIP.clone().applyMatrix4(gateway.root.matrixWorld);
  const gwRing = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.85, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
  gwRing.rotation.x = -Math.PI / 2;
  gwRing.position.copy(gateway.root.position).add(new THREE.Vector3(-0.25, 0.03, 0.25));
  root.add(gwRing);
  // generous invisible hit volume so the small rooftop model is easy to click
  const gwHit = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 3), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }));
  gwHit.position.copy(gateway.root.position).add(new THREE.Vector3(0, 1.0, 0));
  root.add(gwHit);
  // the label itself is a real button (labels are otherwise click-through)
  const gwl = label('<b>Gateway / receiver</b><span class="gw-cta">Inspect ▸</span><br><small>ESP32 + Ra-02 · Wi-Fi bridge · roof, line of sight</small>', 'lbl lbl-site lbl-gw');
  gwl.element.setAttribute('role', 'button');
  gwl.element.setAttribute('tabindex', '0');
  gwl.element.title = 'Open the gateway / receiver view';
  const openGw = (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('rivermon:inspect-gateway'));
  };
  gwl.element.addEventListener('click', openGw);
  gwl.element.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && openGw(e));
  gwl.element.addEventListener('pointerdown', (e) => e.stopPropagation());
  gwl.position.copy(gwTip).add(new THREE.Vector3(0, 1.2, 0));
  root.add(gwl);
  const cloudPos = gwTip.clone().add(new THREE.Vector3(-4, 9, 0));
  const cl = label('<b>☁ RiverMon backend</b><br><small>FastAPI + SQLite · dashboard · Telegram / e-mail alerts</small>', 'lbl lbl-site lbl-cloud');
  cl.position.copy(cloudPos);
  root.add(cl);

  // LoRa link curve
  const mid = antTip.clone().lerp(gwTip, 0.5).add(new THREE.Vector3(0, 10, 0));
  const link = new THREE.QuadraticBezierCurve3(antTip, mid, gwTip);
  const linkLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(link.getPoints(80)), new THREE.LineDashedMaterial({ color: 0xf72585, dashSize: 0.6, gapSize: 0.4, transparent: true, opacity: 0.7 }));
  linkLine.computeLineDistances();
  root.add(linkLine);
  const ll = label(`LoRa ${CONFIG.freq} · SF${CONFIG.sf} · ${CONFIG.bw} · ${CONFIG.txDbm} dBm<br><small>23-byte AES-128 frame + 4-byte MIC</small>`, 'lbl lbl-link');
  ll.position.copy(link.getPoint(0.5)).add(new THREE.Vector3(0, 1, 0));
  root.add(ll);
  const wifi = new THREE.Line(new THREE.BufferGeometry().setFromPoints([gwTip, cloudPos.clone().add(new THREE.Vector3(0, -0.6, 0))]), new THREE.LineDashedMaterial({ color: 0x4cc9f0, dashSize: 0.4, gapSize: 0.3 }));
  wifi.computeLineDistances();
  root.add(wifi);

  const pkt = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff4fa3, transparent: true, opacity: 0 }));
  root.add(pkt);
  const pktGlow = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff4fa3, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  pkt.add(pktGlow);
  const waves = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0xf72585, transparent: true, opacity: 0, wireframe: true, depthWrite: false }));
    m.position.copy(antTip);
    root.add(m);
    return m;
  });

  // ---------------------------------------------------------------- trees
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.22, 2, 6), mat(0x5a4330), 70);
  const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(1.6, 4.2, 8), mat(0x3f6e3a, { rough: 0.9 }), 70);
  const m4 = new THREE.Matrix4();
  let n = 0;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  while (n < 70) {
    const x = (rnd() - 0.5) * 220;
    const z = (rnd() > 0.5 ? 1 : -1) * (22 + rnd() * 55);
    if (Math.abs(x) < 8 || (Math.abs(x - bx) < 10 && Math.abs(z - bz) < 9)) continue;
    const y = terrainHeight(x, z);
    const s = 0.7 + rnd() * 0.8;
    m4.compose(new THREE.Vector3(x, y + 1 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
    trunk.setMatrixAt(n, m4);
    m4.compose(new THREE.Vector3(x, y + 3.6 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
    crown.setMatrixAt(n, m4);
    n++;
  }
  trunk.castShadow = crown.castShadow = true;
  root.add(trunk, crown);

  // ---------------------------------------------------------------- API
  const state = { stage: 0.9, flood: 0 };
  function setStage(h) {
    state.stage = h;
    water.position.y = h;
    const d = H - h;
    const r = d * Math.tan(half);
    cone.scale.set(r, d, r);
    foot.position.set(sensor.x, h + 0.015, sensor.z);
    foot.scale.setScalar(r);
    waterMat.uniforms.uFlood.value = THREE.MathUtils.clamp((h - 0.8) / 1.4, 0, 1);
    const x = sensor.x + 1.15;
    const z = sensor.z + 0.9;
    const P = [
      [x, 0, z, x, H, z],
      [x - 0.15, 0, z, x + 0.15, 0, z],
      [x - 0.15, h, z, x + 0.15, h, z],
      [x - 0.15, H, z, x + 0.15, H, z],
      [sensor.x, H, sensor.z, x + 0.15, H, z],
      [x - 0.6, h, z, x + 0.15, h, z],
    ].flat();
    dimGeo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    lblD.element.innerHTML = `d = ${d.toFixed(3)} m <small>air gap</small>`;
    lblD.position.set(x + 0.2, h + d / 2, z);
    lblH.element.innerHTML = `h = ${h.toFixed(3)} m <small>stage</small>`;
    lblH.position.set(x + 0.2, h / 2, z);
    lblHH.element.innerHTML = `H = ${H.toFixed(2)} m`;
    lblHH.position.set(x + 0.2, H + 0.25, z);
  }
  setStage(state.stage);

  function ping() {
    const d = H - state.stage;
    const r = d * Math.tan(half);
    const tl = gsap.timeline();
    pulses.forEach((p, i) => {
      const o = { t: 0 };
      tl.to(o, {
        t: 1,
        duration: 0.55,
        ease: 'none',
        onUpdate: () => {
          const y = H - d * o.t;
          p.position.set(sensor.x, y, sensor.z);
          p.scale.setScalar(Math.max(0.02, r * o.t));
          p.material.opacity = 0.9 * (1 - o.t * 0.6);
        },
        onComplete: () => (p.material.opacity = 0),
      }, i * 0.12);
    });
    tl.fromTo(coneMat, { opacity: 0.35 }, { opacity: 0.16, duration: 1.2 }, 0);
    return tl;
  }

  function transmit(color = 0xff4fa3) {
    const tl = gsap.timeline();
    pkt.material.color.set(color);
    pktGlow.material.color.set(color);
    waves.forEach((w, i) => {
      tl.fromTo(w.scale, { x: 0.1, y: 0.1, z: 0.1 }, { x: 4, y: 4, z: 4, duration: 1.1, ease: 'power1.out' }, i * 0.25);
      tl.fromTo(w.material, { opacity: 0.6 }, { opacity: 0, duration: 1.1 }, i * 0.25);
    });
    const o = { t: 0 };
    tl.set([pkt.material, pktGlow.material], { opacity: 1 }, 0.1);
    tl.set(pktGlow.material, { opacity: 0.25 }, 0.1);
    tl.to(o, { t: 1, duration: 1.4, ease: 'power1.inOut', onUpdate: () => pkt.position.copy(link.getPoint(o.t)) }, 0.1);
    // ACK back
    tl.add(() => {
      pkt.material.color.set(0x3ddc97);
      pktGlow.material.color.set(0x3ddc97);
    });
    tl.to(o, { t: 0, duration: 1.0, ease: 'power1.inOut', onUpdate: () => pkt.position.copy(link.getPoint(o.t)) }, '+=0.12');
    tl.set([pkt.material, pktGlow.material], { opacity: 0 });
    return tl;
  }

  function update(t, camera) {
    const k = (t % 1.6) / 1.6;
    gwRing.scale.setScalar(1 + k * 0.6);
    gwRing.material.opacity = 0.7 * (1 - k);
    waterMat.uniforms.uTime.value = t;
    waterMat.uniforms.uCam.value.copy(camera.position);
  }

  const gatewayTargets = [gateway.root, gwHit, bld, roof];
  return { root, node, gateway, gatewayTargets, setStage, ping, transmit, update, sensor, H, state, thrLabels };
}
