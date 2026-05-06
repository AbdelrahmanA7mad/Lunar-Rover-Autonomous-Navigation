// ══════════════════════════════════════════════════════
//  Lunar Rover — 3D Visualizer
// ══════════════════════════════════════════════════════

const GRID  = 15;
const CELL  = 2.4;
const HALF  = (GRID * CELL) / 2;

// ── Renderer ─────────────────────────────────────────
const vp = document.getElementById('vp');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.setSize(vp.clientWidth, vp.clientHeight);
vp.appendChild(renderer.domElement);

// ── Scene ────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060a10);
scene.fog = new THREE.FogExp2(0x060a10, 0.007);

// ── Camera ───────────────────────────────────────────
const cam = new THREE.PerspectiveCamera(52, vp.clientWidth / vp.clientHeight, 0.1, 800);
cam.position.set(HALF, 30, HALF + 24);

// ── Controls ─────────────────────────────────────────
const ctrl = new THREE.OrbitControls(cam, renderer.domElement);
ctrl.target.set(HALF, 0, HALF);
ctrl.enableDamping = true;
ctrl.dampingFactor = 0.07;
ctrl.maxPolarAngle = Math.PI / 2.05;
ctrl.minDistance = 6;
ctrl.maxDistance = 90;
ctrl.update();

// ── Lights ───────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x0a1828, 1.2));

const sun = new THREE.DirectionalLight(0xffe8cc, 1.8);
sun.position.set(-35, 55, 15);
sun.castShadow = true;
Object.assign(sun.shadow.mapSize, { width: 2048, height: 2048 });
Object.assign(sun.shadow.camera, { left: -HALF - 6, right: HALF + 6, top: HALF + 6, bottom: -HALF - 6 });
sun.shadow.bias = -0.001;
scene.add(sun);

const dl = new THREE.DirectionalLight(0x2244aa, 0.5);
dl.position.set(30, 20, -20);
scene.add(dl);

// Stars
;(function () {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(4000 * 3);
    for (let i = 0; i < p.length; i++) p[i] = (Math.random() - 0.5) * 700;
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.25 })));
})();

// ── Ground ───────────────────────────────────────────
;(function () {
    const g = new THREE.PlaneGeometry(GRID * CELL + 24, GRID * CELL + 24, 60, 60);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, (Math.random() - 0.5) * 0.1);
    g.computeVertexNormals();
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x191928, roughness: 0.95 }));
    m.position.set(HALF, -0.05, HALF);
    m.receiveShadow = true;
    scene.add(m);
    // Grid lines
    const gh = new THREE.GridHelper(GRID * CELL, GRID, 0x1e2e42, 0x101820);
    gh.position.set(HALF, 0.01, HALF);
    scene.add(gh);
})();

// ── Terrain pool ─────────────────────────────────────
const terrGrp = new THREE.Group();
scene.add(terrGrp);
let terrCraters = [], terrRocks = [];

const craterRimMat = new THREE.MeshStandardMaterial({ color: 0x28283c, roughness: 1 });
const craterDkMat  = new THREE.MeshStandardMaterial({ color: 0x08080f, roughness: 1 });
const rockMat      = new THREE.MeshStandardMaterial({ color: 0x505060, roughness: 0.85, metalness: 0.05 });

function gw(r, c) { return { x: c * CELL, z: r * CELL }; }

function buildTerrain(craters, rocks) {
    terrCraters.forEach(o => terrGrp.remove(o));
    terrRocks.forEach(o => terrGrp.remove(o));
    terrCraters = []; terrRocks = [];

    craters.forEach(([r, c]) => {
        const { x, z } = gw(r, c);
        const disc = new THREE.Mesh(
            new THREE.CircleGeometry(CELL * 0.44, 24).rotateX(-Math.PI / 2),
            craterDkMat
        );
        disc.position.set(x, 0.01, z);
        terrGrp.add(disc); terrCraters.push(disc);

        const rim = new THREE.Mesh(
            new THREE.TorusGeometry(CELL * 0.44, CELL * 0.065, 8, 28),
            craterRimMat
        );
        rim.rotation.x = -Math.PI / 2;
        rim.position.set(x, 0.07, z);
        rim.castShadow = true;
        terrGrp.add(rim); terrCraters.push(rim);
    });

    rocks.forEach(([r, c]) => {
        const { x, z } = gw(r, c);
        const n = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < n; i++) {
            const mesh = new THREE.Mesh(
                new THREE.DodecahedronGeometry(CELL * (0.15 + Math.random() * 0.14), 0),
                rockMat
            );
            mesh.position.set(
                x + (Math.random() - 0.5) * CELL * 0.5,
                CELL * 0.1,
                z + (Math.random() - 0.5) * CELL * 0.5
            );
            mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
            mesh.castShadow = true;
            terrGrp.add(mesh); terrRocks.push(mesh);
        }
    });
}

// ── Rover ────────────────────────────────────────────
const roverGrp = new THREE.Group();
let roverWheels = [], roverLight, roverGlow;

;(function () {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xaa8833, metalness: 0.85, roughness: 0.2 });
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x003488, metalness: 0.9, roughness: 0.1 });
    const trimMat  = new THREE.MeshStandardMaterial({ color: 0x00ccff, emissive: 0x00ccff, emissiveIntensity: 0.5 });

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.52, CELL * 0.25, CELL * 0.60), bodyMat);
    body.position.y = CELL * 0.38; body.castShadow = true;
    roverGrp.add(body);

    // Solar panel
    const panel = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.85, CELL * 0.03, CELL * 0.32), panelMat);
    panel.position.y = CELL * 0.54; panel.castShadow = true;
    roverGrp.add(panel);

    // Antenna
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, CELL * 0.4, 6), trimMat);
    ant.position.set(0, CELL * 0.72, -CELL * 0.14);
    roverGrp.add(ant);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), trimMat);
    ball.position.set(0, CELL * 0.94, -CELL * 0.14);
    roverGrp.add(ball);

    // Wheels
    const wGeo = new THREE.CylinderGeometry(CELL * 0.175, CELL * 0.175, CELL * 0.11, 16);
    wGeo.rotateZ(Math.PI / 2);
    const wMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    [[-0.37, 0.175, -0.21], [0.37, 0.175, -0.21],
     [-0.37, 0.175,  0.21], [0.37, 0.175,  0.21]].forEach(([wx, wy, wz]) => {
        const w = new THREE.Mesh(wGeo, wMat);
        w.position.set(wx * CELL, wy * CELL, wz * CELL);
        w.castShadow = true;
        roverGrp.add(w); roverWheels.push(w);
    });

    // Under-glow
    roverLight = new THREE.PointLight(0x00ccff, 2, 4);
    roverLight.position.y = 0.15;
    roverGrp.add(roverLight);

    scene.add(roverGrp);
    roverGrp.visible = false;
})();

// ── Target beacon ────────────────────────────────────
const targetGrp = new THREE.Group();
let tgtLight;

;(function () {
    const mat = new THREE.MeshStandardMaterial({
        color: 0x00e87a, emissive: 0x00e87a, emissiveIntensity: 0.55,
        transparent: true, opacity: 0.85
    });
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(CELL * 0.42, CELL * 0.42, 0.06, 32), mat);
    targetGrp.add(pad);
    const pill = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, CELL * 0.7, 8), mat);
    pill.position.y = CELL * 0.38;
    targetGrp.add(pill);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), mat);
    top.position.y = CELL * 0.75;
    targetGrp.add(top);
    tgtLight = new THREE.PointLight(0x00e87a, 3, 8);
    tgtLight.position.y = 0.5;
    targetGrp.add(tgtLight);
    scene.add(targetGrp);
    targetGrp.visible = false;
})();

// ── Path trail ───────────────────────────────────────
let showTrail = true;
const trailPoints = [];
const MAX_TRAIL = 80;
let trailLine;

function trailColor(mode) {
    return mode === 'training' ? new THREE.Color(0xffcc00) : new THREE.Color(0x00e87a);
}

function updateTrail(x, z, mode) {
    trailPoints.push(new THREE.Vector3(x, 0.18, z));
    if (trailPoints.length > MAX_TRAIL) trailPoints.shift();

    if (trailLine) scene.remove(trailLine);
    if (!showTrail || trailPoints.length < 2) return;

    const geo = new THREE.BufferGeometry().setFromPoints(trailPoints);
    trailLine = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({ color: trailColor(mode), opacity: 0.6, transparent: true })
    );
    scene.add(trailLine);
}

function clearTrail() {
    trailPoints.length = 0;
    if (trailLine) { scene.remove(trailLine); trailLine = null; }
}

// Trail toggle button
document.getElementById('trail-toggle').addEventListener('click', function () {
    showTrail = !showTrail;
    this.textContent = 'PATH: ' + (showTrail ? 'ON' : 'OFF');
    if (!showTrail && trailLine) { scene.remove(trailLine); trailLine = null; }
});

// ── Chart ────────────────────────────────────────────
const chart = new Chart(document.getElementById('rwChart').getContext('2d'), {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            data: [],
            borderColor: '#00c8ff',
            backgroundColor: 'rgba(0,200,255,0.07)',
            borderWidth: 1.5,
            pointRadius: 0,
            fill: true,
            tension: 0.3,
        }]
    },
    options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        scales: {
            x: { display: true, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#4a5568', font: { size: 8 }, maxTicksLimit: 5 } },
            y: { display: true, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#4a5568', font: { size: 8 }, maxTicksLimit: 5 } }
        },
        plugins: { legend: { display: false } }
    }
});

// ── Outcome flash ────────────────────────────────────
function flashOutcome(type) {
    const el = document.getElementById('outcome-flash');
    el.className = type;
    el.style.opacity = '1';
    setTimeout(() => el.style.opacity = '0', 600);
}

// ── State vars ───────────────────────────────────────
let prevRover = null;
let currentMode = 'idle';
let successes = 0, totalEps = 0;
let lastEpisode = -1;

// ── Apply state from server ───────────────────────────
function applyState(s) {
    // ── Handle events ──
    if (s.__event === 'saved') {
        document.getElementById('ti-mode').style.color = 'var(--cyan)';
        setTimeout(() => updateModeUI(currentMode), 1200);
        if (s.models) updateModels(s.models, s.model_name);
        return;
    }
    if (s.__event === 'stopped') {
        currentMode = 'idle';
        updateModeUI('idle');
        return;
    }

    if (s.mode) {
        currentMode = s.mode;
        updateModeUI(s.mode);
    }
    
    if (s.models) {
        updateModels(s.models, s.model_name);
    }
    if (s.model_name) {
        document.getElementById('model-name-input').value = s.model_name;
    }

    // ── Top bar ──
    if (s.episode !== undefined) document.getElementById('top-ep').textContent = s.episode;
    if (s.trained_eps !== undefined) document.getElementById('top-trained').textContent = s.trained_eps;
    if (s.total_reward !== undefined) document.getElementById('top-reward').textContent = s.total_reward.toFixed(0);
    if (s.step !== undefined) document.getElementById('ti-step').textContent = s.step;

    // ── ε ──
    if (s.epsilon !== undefined) {
        document.getElementById('ti-eps').textContent = s.epsilon.toFixed(3);
        document.getElementById('eps-fill').style.width = (s.epsilon * 100) + '%';
    }

    // ── Outcome ──
    if (s.last_outcome) {
        const map = { success: '✓ SUCCESS', crater: '✕ CRATER', timeout: '⏱ TIMEOUT' };
        const col = { success: 'var(--green)', crater: 'var(--red)', timeout: 'var(--yellow)' };
        const el = document.getElementById('ti-outcome');
        el.textContent = map[s.last_outcome] || '—';
        el.style.color = col[s.last_outcome] || '#fff';
    }

    // ── Terrain (only on new episode) ──
    if (s.episode !== lastEpisode || (s.episode === 0 && lastEpisode !== 0)) {
        if (s.craters && s.rocks) buildTerrain(s.craters, s.rocks);
        clearTrail();

        // Chart
        if (lastEpisode >= 0 && s.total_reward !== undefined && s.episode > 0) {
            chart.data.labels.push(lastEpisode);
            chart.data.datasets[0].data.push(s.total_reward);
            if (chart.data.labels.length > 100) {
                chart.data.labels.shift();
                chart.data.datasets[0].data.shift();
            }
            chart.update('none');
        } else if (s.episode === 0) {
            // Reset chart on new map/model
            chart.data.labels = [];
            chart.data.datasets[0].data = [];
            chart.update('none');
            totalEps = 0;
            successes = 0;
            document.getElementById('top-success').textContent = '—';
        }

        // Success rate
        if (lastEpisode >= 0 && s.episode > 0) {
            totalEps++;
            if (s.last_outcome === 'success') successes++;
            const rate = totalEps ? Math.round(successes / totalEps * 100) : 0;
            document.getElementById('top-success').textContent = rate + '%';
        }

        // Outcome flash
        if (s.last_outcome === 'success') flashOutcome('success');
        else if (s.last_outcome === 'crater') flashOutcome('crater');

        lastEpisode = s.episode;
    }

    // ── 3D: Target ──
    if (s.target_pos) {
        const { x, z } = gw(s.target_pos[0], s.target_pos[1]);
        targetGrp.position.set(x, 0, z);
        targetGrp.visible = true;
        document.getElementById('hud-target').textContent = `(${s.target_pos[1]}, ${s.target_pos[0]})`;
    }

    // ── 3D: Rover ──
    if (s.rover_pos) {
        const { x, z } = gw(s.rover_pos[0], s.rover_pos[1]);
        roverGrp.visible = true;

        // Trail
        updateTrail(x, z, currentMode);

        // Lerp towards target
        roverGrp.position.x += (x - roverGrp.position.x) * 0.4;
        roverGrp.position.z += (z - roverGrp.position.z) * 0.4;

        // Face direction of travel
        if (prevRover) {
            const dx = x - prevRover.x, dz = z - prevRover.z;
            if (Math.abs(dx) + Math.abs(dz) > 0.01) {
                roverGrp.rotation.y = Math.atan2(dx, dz);
            }
        }
        prevRover = { x, z };

        // HUD
        document.getElementById('hud-rover').textContent = `(${s.rover_pos[1]}, ${s.rover_pos[0]})`;
        if (s.target_pos) {
            const d = Math.abs(s.rover_pos[0] - s.target_pos[0]) + Math.abs(s.rover_pos[1] - s.target_pos[1]);
            document.getElementById('hud-dist').textContent = d;
        }
    }
}

function updateModels(models, current) {
    const sel = document.getElementById('model-select');
    sel.innerHTML = '<option value="">-- Select Model --</option>';
    models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        if (m === current) opt.selected = true;
        sel.appendChild(opt);
    });
}

// ── Mode UI ──────────────────────────────────────────
function updateModeUI(mode) {
    const pill = document.getElementById('mode-pill');
    const modeLabel = document.getElementById('ti-mode');
    const labels = { idle: 'IDLE', training: 'TRAINING', running: 'RUNNING' };
    pill.className = mode === 'idle' ? '' : mode;
    pill.textContent = labels[mode] || mode.toUpperCase();
    modeLabel.textContent = labels[mode] || mode.toUpperCase();
    modeLabel.style.color = mode === 'training' ? 'var(--yellow)' : mode === 'running' ? 'var(--green)' : '#fff';

    // Update chart color per mode
    chart.data.datasets[0].borderColor = mode === 'training' ? '#ffcc00' : '#00e87a';
    chart.data.datasets[0].backgroundColor = mode === 'training'
        ? 'rgba(255,204,0,0.06)' : 'rgba(0,232,122,0.06)';
    chart.update('none');
}

// ── WebSocket ────────────────────────────────────────
let ws;
const overlay = document.getElementById('overlay');

function connect() {
    const wsUrl = `ws://${window.location.host}/ws`;
    document.querySelector('.ov-sub').textContent = 'Connecting to ' + wsUrl + '...';
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => overlay.classList.add('gone');
    
    ws.onmessage = e => applyState(JSON.parse(e.data));
    
    ws.onerror = (e) => {
        document.querySelector('.ov-sub').textContent = 'Connection Error. Retrying...';
        console.error('WebSocket Error', e);
    };
    
    ws.onclose = () => { 
        overlay.classList.remove('gone'); 
        document.querySelector('.ov-sub').textContent = 'Disconnected. Retrying in 2s...';
        setTimeout(connect, 2000); 
    };
}
connect();

function send(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

// ── Buttons ──────────────────────────────────────────
document.getElementById('btn-train').addEventListener('click', () => send({ action: 'train' }));
document.getElementById('btn-run').addEventListener('click',   () => send({ action: 'run' }));
document.getElementById('btn-stop').addEventListener('click',  () => send({ action: 'stop' }));
document.getElementById('btn-new-map').addEventListener('click', () => send({ action: 'new_map' }));

document.getElementById('btn-save').addEventListener('click', () => {
    const name = document.getElementById('model-name-input').value.trim();
    if (name) send({ action: 'save', name: name });
});

document.getElementById('model-select').addEventListener('change', (e) => {
    const name = e.target.value;
    if (name) send({ action: 'load_model', name: name });
});

document.getElementById('speed-sl').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    const lbl = v < 0.04 ? 'Turbo' : v < 0.15 ? 'Fast' : v < 0.4 ? 'Normal' : 'Slow';
    document.getElementById('speed-lbl').textContent = lbl;
    send({ action: 'set_speed', value: v });
});

// ── Resize ───────────────────────────────────────────
window.addEventListener('resize', () => {
    cam.aspect = vp.clientWidth / vp.clientHeight;
    cam.updateProjectionMatrix();
    renderer.setSize(vp.clientWidth, vp.clientHeight);
});

// ── Render loop ──────────────────────────────────────
const clk = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const t = clk.getElapsedTime();

    // Rover: wheel spin + light flicker
    if (roverGrp.visible) {
        roverWheels.forEach(w => w.rotation.x += 0.06);
        roverLight.intensity = 1.5 + Math.sin(t * 9) * 0.4;
    }

    // Target: float + pulse
    if (targetGrp.visible) {
        targetGrp.position.y = Math.sin(t * 1.8) * 0.08;
        tgtLight.intensity = 2.5 + Math.sin(t * 3) * 1.2;
    }

    ctrl.update();
    renderer.render(scene, cam);
}
animate();
