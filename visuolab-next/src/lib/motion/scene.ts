/* ==========================================================================
   Visuolab — About hero 3D (port of js/scene.js; geometry, material, lights and motion unchanged)
   A twisted glass band with real refraction + chromatic dispersion. The canvas is transparent: the blue/amber glow
   the glass bends lives on a backdrop that is drawn only into Three's
   transmission buffer, never to the screen — so there is no halo around the
   object, just glass on the page. Reacts to cursor + scroll, pauses off-screen
   / in hidden tabs, renders a single frame under prefers-reduced-motion.
   ========================================================================== */
import * as THREE from "three";
import { ParametricGeometry } from "three/addons/geometries/ParametricGeometry.js";

/** Mounts the scene into `host`. Returns the cleanup. Hides the host if WebGL init fails (as the original did). */
export function initScene(host: HTMLElement): () => void {
  try {
    return init(host);
  } catch (e) {
    console.warn("3D hero disabled:", e);
    host.style.display = "none";
    return () => {};
  }
}

function init(host: HTMLElement): () => void {
  const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  const small = matchMedia("(max-width:900px)").matches;

  /* ---- renderer / scene / camera ---------------------------------------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = studioEnv();
  scene.environment = pmrem.fromEquirectangular(envTex).texture; // soft studio bands → long highlights on the glass
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
  const glow = glowTex();
  const backdropMat = new THREE.MeshBasicMaterial({ map: glow, toneMapped: false });
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(backH, backH), backdropMat);
  backdrop.position.z = backZ;
  backdrop.onBeforeRender = (r) => {
    const off = r.getRenderTarget() !== null;
    backdrop.material.colorWrite = off;
    backdrop.material.depthWrite = off;
  };
  scene.add(backdrop);

  /* ---- lights ------------------------------------------------------------- */
  const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(-3, 4, 5);
  const rim = new THREE.DirectionalLight(0xffb86b, 1.6); rim.position.set(4, 2, -3);
  const p1 = new THREE.PointLight(0x7fb4ff, 30, 0, 2); p1.position.set(-3, -2, 3);
  const p2 = new THREE.PointLight(0xffc48a, 22, 0, 2); p2.position.set(3, 3, 2);
  scene.add(key, rim, p1, p2);

  const group = new THREE.Group();
  scene.add(group);

  /* ---- the band: a flattened ring that twists one and a half times ------- */
  const SL = small ? 200 : 300, ST = small ? 28 : 40;
  const R = 1.22, A = 0.56, B = 0.16; // ring radius, section half-width / half-thickness
  let phase = 0;
  const surf = (u: number, v: number, out: THREE.Vector3) => {
    const th = u * Math.PI * 2, ph = v * Math.PI * 2;
    const psi = th * 1.5 + phase; // twist travels around the ring over time
    const ex = A * Math.cos(ph), ey = B * Math.sin(ph);
    const x = ex * Math.cos(psi) - ey * Math.sin(psi);
    const y = ex * Math.sin(psi) + ey * Math.cos(psi);
    const r = R + x;
    out.set(r * Math.cos(th), y, r * Math.sin(th));
  };
  const geo = new ParametricGeometry(surf, SL, ST);
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.06,
    transmission: 1, thickness: 1.2, ior: 1.5, dispersion: 5, // real refraction with rainbow edges
    attenuationColor: new THREE.Color(0x8fbaff), attenuationDistance: 1.6, // thick parts glow blue
    clearcoat: 1, clearcoatRoughness: 0.05,
    specularIntensity: 1, envMapIntensity: 1.2,
  });
  const band = new THREE.Mesh(geo, glass);
  band.rotation.set(1.42, 0, 0); // almost face-on so the silhouette stays big
  group.add(band);

  /* ---- regenerate the band surface for a new twist phase ------------------
          Same surface as surf() above, but only the twist changes from frame to frame, and the twist enters as cos/sin of (1.5·θ + phase).
          Those split into products of per-ring values (computed once) and cos/sin of the phase (computed once per frame), so a frame
          costs a few multiplications per vertex instead of six trigonometric calls: about 12,000 vertices at 60 frames a second. ---- */
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const out = pos.array as Float32Array;
  const cosTh = new Float64Array(SL + 1), sinTh = new Float64Array(SL + 1), cos15 = new Float64Array(SL + 1), sin15 = new Float64Array(SL + 1);
  for (let l = 0; l <= SL; l++) {
    const th = (l / SL) * Math.PI * 2;
    cosTh[l] = Math.cos(th); sinTh[l] = Math.sin(th); cos15[l] = Math.cos(th * 1.5); sin15[l] = Math.sin(th * 1.5);
  }
  const ex = new Float64Array(ST + 1), ey = new Float64Array(ST + 1);
  for (let t = 0; t <= ST; t++) { const ph = (t / ST) * Math.PI * 2; ex[t] = A * Math.cos(ph); ey[t] = B * Math.sin(ph); }
  function reshape(p: number) {
    phase = p;
    const cp = Math.cos(p), sp = Math.sin(p);
    let i = 0;
    for (let t = 0; t <= ST; t++) {
      const exv = ex[t]!, eyv = ey[t]!;
      for (let l = 0; l <= SL; l++) {
        const cpsi = cos15[l]! * cp - sin15[l]! * sp; // cos(1.5·θ + phase)
        const spsi = sin15[l]! * cp + cos15[l]! * sp; // sin(1.5·θ + phase)
        const r = R + exv * cpsi - eyv * spsi;
        out[i++] = r * cosTh[l]!;
        out[i++] = exv * spsi + eyv * cpsi;
        out[i++] = r * sinTh[l]!;
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }

  /* ---- input -------------------------------------------------------------- */
  const tgt = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  const onPointer = (e: PointerEvent) => {
    tgt.x = (e.clientX / innerWidth - 0.5) * 2;
    tgt.y = (e.clientY / innerHeight - 0.5) * 2;
  };
  addEventListener("pointermove", onPointer, { passive: true });

  /* ---- loop --------------------------------------------------------------- */
  const clock = new THREE.Clock();
  let raf = 0, onScreen = true;
  function frame() {
    raf = 0;
    const t = clock.getElapsedTime();
    cur.x += (tgt.x - cur.x) * 0.05;
    cur.y += (tgt.y - cur.y) * 0.05;

    reshape(t * 0.35);
    group.rotation.z = t * 0.14 + scrollY * 0.0008; // slow roll in the view plane
    group.rotation.y = cur.x * 0.35 + Math.sin(t * 0.4) * 0.18; // gentle wobble + cursor tilt
    group.rotation.x = cur.y * 0.25 + Math.sin(t * 0.31) * 0.14;
    group.position.y = Math.sin(t * 0.8) * 0.05;

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
  const ro = new ResizeObserver(() => { size(); kick(); });
  ro.observe(host);
  const io = new IntersectionObserver(([e]) => { onScreen = !!e?.isIntersecting; if (onScreen) kick(); });
  io.observe(host);
  const onVis = () => { if (!document.hidden) kick(); };
  document.addEventListener("visibilitychange", onVis);

  size();
  kick();

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    document.removeEventListener("visibilitychange", onVis);
    removeEventListener("pointermove", onPointer);
    geo.dispose(); glass.dispose(); backdropMat.dispose(); glow.dispose(); envTex.dispose();
    scene.environment?.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}

/* what the glass refracts: navy with a cool blue field and a warm amber pool (never shown directly) */
function glowTex() {
  const c = document.createElement("canvas"); c.width = c.height = 1024;
  const g = c.getContext("2d")!;
  g.fillStyle = "#08133f"; g.fillRect(0, 0, 1024, 1024);
  const spot = (x: number, y: number, r: number, col: string) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, col); gr.addColorStop(1, "rgba(8,19,63,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 1024, 1024);
  };
  spot(420, 600, 460, "rgba(46,110,235,.95)");
  spot(660, 340, 320, "rgba(255,184,107,.9)");
  spot(520, 500, 170, "rgba(255,255,255,.6)");
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* environment: dark studio with two soft light bands and a warm spill — gives long, clean reflections */
function studioEnv() {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#04081c"; g.fillRect(0, 0, 1024, 512);
  const band = (y: number, h: number, col: string) => {
    const gr = g.createLinearGradient(0, y - h, 0, y + h);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.5, col); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, y - h, 1024, h * 2);
  };
  const spot = (x: number, y: number, r: number, col: string) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  };
  band(96, 44, "rgba(240,246,255,1)"); // key light overhead → long white highlight
  band(250, 40, "rgba(56,112,255,.85)"); // blue horizon band
  band(400, 60, "rgba(14,30,110,.9)"); // deep blue floor
  spot(720, 190, 170, "rgba(255,184,107,.95)"); // amber spill (the hero orb)
  spot(230, 300, 180, "rgba(140,190,255,.6)");
  const soft = (x: number, w: number, col: string) => { g.fillStyle = col; g.fillRect(x, 60, w, 300); };
  soft(120, 34, "rgba(255,255,255,.35)"); // two softboxes → crisp vertical reflections
  soft(560, 26, "rgba(255,255,255,.25)");
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
