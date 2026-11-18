// Content taken from the Group-10 mid-semester report and the RiverMon repo
// (docs/01_hardware_build_guide.md, docs/00_design_notes.md, node_config.h).

export const CONFIG = {
  mountHeight: 3.0, // H, metres above gauge zero (DEF_MOUNT_HEIGHT_MM 3000)
  watch: 1.0, // DEF_WATCH_MM 1000
  warning: 1.5, // DEF_WARNING_MM 1500
  danger: 2.0, // DEF_DANGER_MM 2000
  hysteresis: 0.05,
  beamAngle: 15, // degrees, full cone (report: 15-30 deg)
  freq: '434.2 MHz',
  sf: 9,
  bw: '125 kHz',
  txDbm: 10,
};

export const LEVELS = [
  { name: 'NORMAL', color: '#3ddc97', interval: 60 },
  { name: 'WATCH', color: '#ffd166', interval: 15 },
  { name: 'WARNING', color: '#ff9f43', interval: 5 },
  { name: 'DANGER', color: '#ff4d6d', interval: 5 },
];

// Bill of materials. `parts` lists the 3D part ids that belong to the line.
export const BOM = [
  { id: 'esp32', no: 1, name: 'ESP32 DevKit V1', qty: '1 (+1 gateway)', cat: 'Compute', use: 'Node MCU: wakes every 5 min, measures, decides whether to report, deep-sleeps.', spec: '30-pin DOIT board · ESP32-WROOM-32 · 240 MHz dual core · ~10 µA deep sleep (bare chip)', note: 'Remove the red power LED before deployment (1–3 mA saving). Feed 3V3 directly, never VIN.' },
  { id: 'ra02', no: 3, name: 'SX1278 Ra-02 LoRa', qty: '1 (+1 gateway)', cat: 'Radio', use: 'Sends one 23-byte AES-128 encrypted frame per report, then listens 1.5 s for the ACK.', spec: '433 MHz · SF9 / BW 125 kHz · 10 dBm (10 mW, Indian delicensed band) · SPI', note: '3.3 V only. Never transmit without an antenna attached.' },
  { id: 'antenna', no: 4, name: '433 MHz spring antenna', qty: '1 (+1)', cat: 'Radio', use: 'Radiates the LoRa signal. Mounted vertically near the top of the plastic box.', spec: 'Helical spring, soldered to the ANT pad (or IPEX pigtail)', note: 'Keep ≥ 3 cm from the battery and any metal.' },
  { id: 'us100', no: 5, name: 'US-100 ultrasonic sensor', qty: '1', cat: 'Sensing', use: 'Measures air gap d to the water surface. Stage h = H − d.', spec: '40 kHz · 2 cm – 4.5 m · UART mode (jumper fitted) with internal temperature compensation', note: 'Transducers look out through two 16 mm holes in the bottom wall, ~26 mm apart.' },
  { id: 'cell', no: 6, name: '18650 Li-ion cell', qty: '1', cat: 'Power', use: 'Energy store, ≈ 10 Wh.', spec: '3.7 V nominal · 2500–3000 mAh · 3.0–4.2 V', note: 'Buy a branded cell. Never solder directly on a cell.' },
  { id: 'holder', no: 6, name: '18650 cell holder', qty: '1', cat: 'Power', use: 'Holds the cell, mounted on the box wall.', spec: 'Single-cell, wire leads to TP4056 B+ / B−', note: 'Check polarity twice before inserting the cell.' },
  { id: 'tp4056', no: 7, name: 'TP4056 charger + DW01 protection', qty: '1', cat: 'Power', use: 'Solar charging of the cell and over-discharge cut-off.', spec: '6 pads: IN± · B± · OUT± · 1 A (R_PROG 1.2 kΩ) · abs. max 8 V input', note: 'Always take the load from OUT±, never from B±.' },
  { id: 'panel', no: 8, name: 'Solar panel 6 V 2 W', qty: '1', cat: 'Power', use: 'Energy harvest; far above the node\'s daily need.', spec: 'Voc ≈ 7 V · ~0.35 A max', note: 'Facing south, ~17° tilt (latitude of Hyderabad). No shadow 9:00–16:00.' },
  { id: 'ldo', no: 9, name: 'HT7333 LDO regulator', qty: '1', cat: 'Power', use: 'Clean 3.3 V rail with only ~4 µA quiescent current.', spec: 'TO-92 · 250 mA max · pin-out GND–VIN–VOUT (check datasheet)', note: 'Replaces the LM2596 (5 mA quiescent) from the mid-sem design: gap G1 solved by part choice.' },
  { id: 'caps', no: 11, name: 'Capacitors 470 µF / 10 µF / 0.1 µF', qty: 'set', cat: 'Passives', use: 'Rail decoupling and buffer for the radio TX burst (50–100 mA).', spec: '470 µF ≥ 10 V electrolytic on 3.3 V rail', note: '0.1 µF + 10 µF right at the Ra-02 power pins.' },
  { id: 'divider', no: 10, name: '100 kΩ / 100 kΩ divider', qty: '2', cat: 'Passives', use: 'Battery voltage sense on GPIO35 (input-only ADC1).', spec: '1 % metal film · ≈ 21 µA at 4.2 V', note: 'GPIO35 reads about 1.85 V for a 3.7 V cell.' },
  { id: 'spdt', no: 12, name: 'SPDT toggle switch', qty: '1', cat: 'Power', use: 'Main power switch between TP4056 OUT+ and the LDO.', spec: 'Panel-mount with rubber boot', note: 'Switch the battery OFF while USB is connected.' },
  { id: 'box', no: 13, name: 'IP65 junction box', qty: '1', cat: 'Enclosure', use: 'Weather-proof enclosure. Plastic is radio-transparent.', spec: '100 × 100 × 70 mm · ABS / polycarbonate · not metal', note: 'Paint white or add a sunshade: inside can reach 60 °C.' },
  { id: 'lid', no: 13, name: 'Enclosure lid + gasket', qty: '1', cat: 'Enclosure', use: 'Sealed lid, screwed down after final checks.', spec: '4 × M4 captive screws · EPDM gasket', note: 'Close only after the site checklist is complete.' },
  { id: 'gland', no: 'x', name: 'PG7 cable gland', qty: '2', cat: 'Enclosure', use: 'Panel cable entry, sealed. Better than a silicone-filled hole.', spec: 'PG7 · 3–6.5 mm cable', note: 'Add a downward drip loop outside the gland.' },
  { id: 'perf', no: 15, name: 'Perfboard carrier 7 × 9 cm', qty: '1', cat: 'Assembly', use: 'Carrier board with female headers so modules unplug.', spec: '2.54 mm grid · 2 × 15 female headers 25.4 mm apart', note: 'Lay the GND bus first, then 3.3 V, then signals.' },
  { id: 'terminal', no: 15, name: '2-pin screw terminals', qty: '2', cat: 'Assembly', use: 'SOLAR and BATT connections to the carrier board.', spec: '5.08 mm pitch', note: '' },
  { id: 'silica', no: 'x', name: 'Silica-gel sachet', qty: '1', cat: 'Enclosure', use: 'Absorbs condensation inside the sealed box.', spec: '5–10 g', note: 'Optional 2 mm drain hole at the lowest corner.' },
  { id: 'bracket', no: 17, name: 'MS flat-bar L-bracket', qty: '1 set', cat: 'Mounting', use: 'Holds the box ≥ 0.5–1 m out from the bridge deck edge.', spec: '25 × 5 mm mild steel, L-bent, painted', note: 'Box must look straight down within ±2°.' },
  { id: 'clamp', no: 17, name: 'L-clamp + M8 bolt, nut, washers', qty: '1 set', cat: 'Mounting', use: 'Clamps the bracket to the bridge railing.', spec: 'M8 · flat + spring washer · thread-locker', note: 'Check the bracket after the first storm.' },
  { id: 'wires', no: 16, name: '24 AWG hook-up wire', qty: 'set', cat: 'Assembly', use: 'Red = +, black = GND, blue = SPI data, yellow = signals.', spec: '24 AWG stranded', note: 'Keep SPI wires < 10 cm.' },
];

export const BOM_BY_ID = Object.fromEntries(BOM.map((b) => [b.id, b]));

// Assembly sequence, following section 1.5 / 1.6 / 1.8 / 1.9 of the build guide.
export const STEPS = [
  { title: 'Prepare the enclosure', parts: ['box'], text: 'Drill two 16 mm holes in the bottom wall at the US-100 transducer spacing (~26 mm c/c), a PG7 gland hole for the panel cable and a hole for the SPDT switch.', check: 'Holes deburred, no cracks in the ABS.' },
  { title: 'Fit the US-100 in the bottom wall', parts: ['us100'], text: 'Push the transducers through the holes so they sit flush with the outside. Seal around the PCB edge with RTV from the inside; keep silicone off the transducer faces.', check: 'Jumper fitted on the back = UART mode.' },
  { title: 'Carrier board on standoffs', parts: ['perf', 'terminal'], text: 'Perfboard with female headers (2 × 15, 25.4 mm apart) and the SOLAR / BATT screw terminals. Lay the GND bus first, then the 3.3 V bus.', check: 'Continuity: no short 3.3 V ↔ GND.' },
  { title: 'Power path: TP4056 → SPDT → LDO', parts: ['tp4056', 'ldo', 'caps', 'divider', 'spdt'], text: 'TP4056 OUT+ → SPDT → HT7333 VIN. 10 µF at VIN; 470 µF + 10 µF + 0.1 µF at VOUT. 100k/100k divider to GPIO35.', check: 'Switch on with nothing plugged in: VOUT = 3.25–3.35 V; GPIO35 ≈ ½ Vbat.' },
  { title: 'Battery holder on the box wall', parts: ['holder', 'cell'], text: 'Mount the 18650 holder on the wall, leads to B+ / B−. Insert the cell only after the power path checks pass.', check: 'OUT+ to OUT− reads 3.0–4.2 V.' },
  { title: 'Plug in the ESP32 DevKit', parts: ['esp32'], text: 'Plug the ESP32 into its headers. Its 3V3 pin goes to LDO VOUT; nothing goes to VIN. Flash the node firmware over USB with the battery switched OFF.', check: 'Serial log: "[radio] SX1278 not found" (expected).' },
  { title: 'Ra-02 radio + antenna', parts: ['ra02', 'antenna'], text: 'Ra-02 at the board edge, away from ESP32 and battery. SPI on GPIO 18/19/23, NSS 5, RESET 14, DIO0 26. Spring antenna vertical near the top.', check: 'Never transmit without the antenna attached.' },
  { title: 'Wiring loom', parts: ['wires'], text: 'Connect the US-100 via a 4-pin header (VCC ← GPIO25, TX → GPIO16, RX ← GPIO17, GND). Red = +, black = GND, blue = SPI, yellow = signals.', check: 'Serial log shows measurements, n = 9, MAD a few mm.' },
  { title: 'Seal: gland, silica gel, lid', parts: ['gland', 'silica', 'lid'], text: 'Panel cable through the PG7 gland, silica-gel sachet inside, lid closed and screwed down. RTV needs 24 h to cure.', check: 'Glands tight, gasket seated.' },
  { title: 'Bracket, clamp and solar panel', parts: ['bracket', 'clamp', 'panel'], text: 'Bolt the box to the 25 × 5 mm MS L-bracket and fit the 6 V 2 W panel facing south at ~17° with a drip loop on its cable. Clamp to the railing with the M8 bolt.', check: 'Box vertical ±2°, cone clear of piers and plants.' },
];

// Wiring table (sensor node), docs 1.4.1. color: r=red(+), k=black(GND), b=blue(SPI), y=yellow(signal)
export const WIRES = [
  { from: 'Ra-02 SCK', to: 'GPIO18', a: 'ra02:SCK', b: 'esp:D18', c: 'b', note: 'VSPI SCK' },
  { from: 'Ra-02 MISO', to: 'GPIO19', a: 'ra02:MISO', b: 'esp:D19', c: 'b', note: 'VSPI MISO' },
  { from: 'Ra-02 MOSI', to: 'GPIO23', a: 'ra02:MOSI', b: 'esp:D23', c: 'b', note: 'VSPI MOSI' },
  { from: 'Ra-02 NSS', to: 'GPIO5', a: 'ra02:NSS', b: 'esp:D5', c: 'y', note: 'chip select' },
  { from: 'Ra-02 RESET', to: 'GPIO14', a: 'ra02:RST', b: 'esp:D14', c: 'y', note: 'reset' },
  { from: 'Ra-02 DIO0', to: 'GPIO26', a: 'ra02:DIO0', b: 'esp:D26', c: 'y', note: 'TxDone / RxDone IRQ' },
  { from: 'Ra-02 3.3V', to: '3.3 V rail', a: 'ra02:3V3', b: 'ldo:OUT', c: 'r', note: '0.1 µF + 10 µF at the pins' },
  { from: 'Ra-02 GND', to: 'GND', a: 'ra02:GND', b: 'esp:GND2', c: 'k', note: '' },
  { from: 'US-100 VCC', to: 'GPIO25', a: 'hdr:VCC', b: 'esp:D25', c: 'r', note: 'switched sensor power (option A)' },
  { from: 'US-100 TX', to: 'GPIO16 (RX2)', a: 'hdr:TX', b: 'esp:RX2', c: 'y', note: 'module → ESP32' },
  { from: 'US-100 RX', to: 'GPIO17 (TX2)', a: 'hdr:RX', b: 'esp:TX2', c: 'y', note: 'ESP32 → module' },
  { from: 'US-100 GND', to: 'GND', a: 'hdr:GND', b: 'esp:GND1', c: 'k', note: '' },
  { from: 'Divider mid', to: 'GPIO35', a: 'div:MID', b: 'esp:D35', c: 'y', note: '0.1 µF to GND, input-only ADC1' },
  { from: 'HT7333 VOUT', to: 'ESP32 3V3', a: 'ldo:OUT', b: 'esp:3V3', c: 'r', note: 'NOT the VIN / 5V pin' },
  { from: 'TP4056 OUT+', to: 'SPDT', a: 'tp:OUT+', b: 'spdt:A', c: 'r', note: 'load behind protection FETs' },
  { from: 'SPDT', to: 'HT7333 VIN', a: 'spdt:B', b: 'ldo:IN', c: 'r', note: '10 µF at VIN' },
  { from: 'TP4056 OUT−', to: 'GND', a: 'tp:OUT-', b: 'ldo:GND', c: 'k', note: '' },
  { from: 'SOLAR +', to: 'TP4056 IN+', a: 'term1:1', b: 'tp:IN+', c: 'r', note: 'via 1N5819 Schottky' },
  { from: 'SOLAR −', to: 'TP4056 IN−', a: 'term1:2', b: 'tp:IN-', c: 'k', note: '' },
  { from: 'BATT +', to: 'TP4056 B+', a: 'term2:1', b: 'tp:B+', c: 'r', note: '18650 holder lead' },
  { from: 'BATT −', to: 'TP4056 B−', a: 'term2:2', b: 'tp:B-', c: 'k', note: '' },
];

export const WIRE_COLORS = { r: 0xe63946, k: 0x1d1d1f, b: 0x2f80ed, y: 0xf4c430 };
