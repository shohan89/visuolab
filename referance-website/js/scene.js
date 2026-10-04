/* ==========================================================================
   Visuolab — About hero 3D
   A twisted glass band with real refraction + chromatic dispersion. The canvas is transparent: the blue/amber glow
   the glass bends lives on a backdrop that is drawn only into Three's
   transmission buffer, never to the screen — so there is no halo around the
   object, just glass on the page. Reacts to cursor + scroll, pauses off-screen
   / in hidden tabs, renders a single frame under prefers-reduced-motion.
   ========================================================================== */
import * as THREE from 'three';
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';

const host = document.querySelector('.about-3d');
if (host) { try { init(host); } catch (e) { console.warn('3D hero disabled:', e); host.style.display = 'none'; } }

function init(host) {
  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const small  = matchMedia('(max-width:900px)').matches;

  /* ---- renderer / scene / camera ---------------------------------------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  host.appendChild(renderer.domElement);

  const scene  = new THREE.Scene();
  const pmrem  = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(studioEnv()).texture;   // soft studio bands → long highlights on the glass
  pmrem.dispose();

    const camZ = 7.0;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  camera.position.set(0, 0, camZ);

  /* ---- backdrop for the refraction only.
          Three renders opaque objects into an offscreen buffer that transmissive
          materials sample; this plane covers that buffer with a navy field and
          two pools of light, then switches its colour writes off for the real
          pass so it never appears on screen. ------------------------------- */
  const backZ = -7;
  const backH = 2 * Math.tan(THREE.MathUtils.degToRad(15)) * (camZ - backZ) * 1.05;
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(backH, backH), new THREE.MeshBasicMaterial({ map: glowTex(), toneMapped: false }));
  backdrop.position.z = backZ;
  backdrop.onBeforeRender = r => { const off = r.getRenderTarget() !== null; backdrop.material.colorWrite = off; backdrop.material.depthWrite = off; };
  scene.add(backdrop);

  /* ---- lights ------------------------------------------------------------- */
  const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(-3, 4, 5);
  const rim = new THREE.DirectionalLight(0xffb86b, 1.6); rim.position.set(4, 2, -3);
  const p1  = new THREE.PointLight(0x7fb4ff, 30, 0, 2); p1.position.set(-3, -2, 3);
  const p2  = new THREE.PointLight(0xffc48a, 22, 0, 2); p2.position.set(3, 3, 2);
  scene.add(key, rim, p1, p2);

  const group = new THREE.Group();
  scene.add(group);

  /* ---- the band: a flattened ring that twists one and a half times ------- */
  const SL = small ? 200 : 300, ST = small ? 28 : 40;
  const R = 1.22, A = .56, B = .16;                          // ring radius, section half-width / half-thickness
  let phase = 0;
  const surf = (u, v, out) => {
    const th = u * Math.PI * 2, ph = v * Math.PI * 2;
    const psi = th * 1.5 + phase;                            // twist travels around the ring over time
    const ex = A * Math.cos(ph), ey = B * Math.sin(ph);
    const x = ex * Math.cos(psi) - ey * Math.sin(psi);
    const y = ex * Math.sin(psi) + ey * Math.cos(psi);
    const r = R + x;
    out.set(r * Math.cos(th), y, r * Math.sin(th));
  };
  const geo = new ParametricGeometry(surf, SL, ST);
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: .06,
    transmission: 1, thickness: 1.2, ior: 1.5, dispersion: 5,          // real refraction with rainbow edges
    attenuationColor: new THREE.Color(0x8fbaff), attenuationDistance: 1.6,   // thick parts glow blue
    clearcoat: 1, clearcoatRoughness: .05,
    specularIntensity: 1, envMapIntensity: 1.2
  });
  const band = new THREE.Mesh(geo, glass);
  band.rotation.set(1.42, 0, 0);                            // almost face-on so the silhouette stays big
  group.add(band);

  /* ---- regenerate the band surface for a new twist phase ------------------ */
  const pos = geo.attributes.position, tmp = new THREE.Vector3();
  function reshape(p) {
    phase = p;
    let i = 0;
    for (let s = 0; s <= ST; s++) {
      const v = s / ST;
      for (let l = 0; l <= SL; l++) {
        surf(l / SL, v, tmp);
        pos.setXYZ(i++, tmp.x, tmp.y, tmp.z);
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }

  /* ---- input -------------------------------------------------------------- */
  const tgt = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  addEventListener('pointermove', e => {
    tgt.x = (e.clientX / innerWidth  - .5) * 2;
    tgt.y = (e.clientY / innerHeight - .5) * 2;
  }, { passive: true });

  /* ---- loop --------------------------------------------------------------- */
  const clock = new THREE.Clock();
  let raf = 0, onScreen = true;
  function frame() {
    raf = 0;
    const t = clock.getElapsedTime();
    cur.x += (tgt.x - cur.x) * .05;
    cur.y += (tgt.y - cur.y) * .05;

    reshape(t * .35);
    group.rotation.z = t * .14 + scrollY * .0008;             // slow roll in the view plane
    group.rotation.y = cur.x * .35 + Math.sin(t * .4) * .18;  // gentle wobble + cursor tilt
    group.rotation.x = cur.y * .25 + Math.sin(t * .31) * .14;
    group.position.y = Math.sin(t * .8) * .05;

    renderer.render(scene, camera);
    if (onScreen && !document.hidden && !reduce) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  function size() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(() => { size(); kick(); }).observe(host);
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) kick(); }).observe(host);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

  size();
  kick();
}

/* what the glass refracts: navy with a cool blue field and a warm amber pool (never shown directly) */
function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#08133f'; g.fillRect(0, 0, 1024, 1024);
  const spot = (x, y, r, col) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(8,19,63,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 1024, 1024);
  };
  spot(420, 600, 460, 'rgba(46,110,235,.95)');
  spot(660, 340, 320, 'rgba(255,184,107,.9)');
  spot(520, 500, 170, 'rgba(255,255,255,.6)');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* environment: dark studio with two soft light bands and a warm spill — gives long, clean reflections */
function studioEnv() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#04081c'; g.fillRect(0, 0, 1024, 512);
  const band = (y, h, col) => {
    const gr = g.createLinearGradient(0, y - h, 0, y + h);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.5, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, y - h, 1024, h * 2);
  };
  const spot = (x, y, r, col) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  };
  band(96, 44, 'rgba(240,246,255,1)');        // key light overhead → long white highlight
  band(250, 40, 'rgba(56,112,255,.85)');      // blue horizon band
  band(400, 60, 'rgba(14,30,110,.9)');        // deep blue floor
  spot(720, 190, 170, 'rgba(255,184,107,.95)');   // amber spill (the hero orb)
  spot(230, 300, 180, 'rgba(140,190,255,.6)');
  const soft = (x, w, col) => { g.fillStyle = col; g.fillRect(x, 60, w, 300); };
  soft(120, 34, 'rgba(255,255,255,.35)');     // two softboxes → crisp vertical reflections
  soft(560, 26, 'rgba(255,255,255,.25)');
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
