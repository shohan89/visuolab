/* ==========================================================================
   Visuolab — hero mesh flow (port of js/mesh.js, shader and constants unchanged)
   A domain-warped gradient field (fbm -> warp -> fbm) on a WebGL quad, so the
   colour regions stretch and fold like a liquid mesh gradient instead of
   drifting as separate blobs. Falls back to the CSS gradient underneath,
   pauses off-screen, renders one static frame under prefers-reduced-motion.
   ========================================================================== */

const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
const FRAG = [
  "precision highp float;",
  "uniform vec2  u_res;",
  "uniform float u_time;",
  "uniform vec2  u_mouse;",
  "float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}",
  "float noise(vec2 p){",
  "  vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);",
  "  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);",
  "}",
  "float fbm(vec2 p){ float v=0.,a=.5; for(int i=0;i<5;i++){v+=a*noise(p); p=p*2.02+vec2(37.,17.); a*=.5;} return v; }",
  "void main(){",
  "  vec2 uv = gl_FragCoord.xy / u_res;",
  "  vec2 p = uv; p.x *= u_res.x/u_res.y; p *= 1.35;",
  "  float t = u_time * 0.045;",
  "  vec2 q = vec2(fbm(p + t*0.6), fbm(p + vec2(5.2,1.3) - t*0.5));",
  "  vec2 r = vec2(fbm(p + 3.0*q + vec2(1.7,9.2) + t*0.8), fbm(p + 3.0*q + vec2(8.3,2.8) - t*0.7));",
  "  float f = fbm(p + 2.6*r + t*0.3);",
  "  vec3 cDeep=vec3(0.055,0.043,0.235), cBrand=vec3(0.220,0.149,0.780);",
  "  vec3 cBlue=vec3(0.180,0.420,1.000), cLight=vec3(0.780,0.900,0.960);",
  "  vec3 col = mix(cDeep, cBrand, smoothstep(0.22,0.80,f));",
  "  col = mix(col, cBlue,  smoothstep(0.42,0.95,length(q)));",
  "  col = mix(col, cLight, smoothstep(0.86,1.34,length(r)+f*0.30));",
  "  col += 0.05*r.x;",
  "  float vign = smoothstep(1.02,0.18,length((uv-vec2(0.5+u_mouse.x*0.03,0.52+u_mouse.y*0.02))*vec2(1.15,1.0)));",
  "  float fade = smoothstep(0.0,0.16,uv.y)*smoothstep(1.0,0.62,uv.y);",
  "  float a = vign*(0.082+0.189*fade);",
  "  gl_FragColor = vec4(col*a, a);",
  "}",
].join("\n");

/**
 * Starts the shader inside `host`. `onGl` reports whether the canvas is live so the
 * host can toggle `.has-gl` (which hides the CSS fallback spans). Returns the cleanup.
 */
export function initMesh(host: HTMLElement, onGl: (on: boolean) => void): () => void {
  const canvas = document.createElement("canvas");
  canvas.className = "mesh-canvas";
  const opts = { alpha: true, antialias: false, premultipliedAlpha: true };
  const gl = (canvas.getContext("webgl", opts) || canvas.getContext("experimental-webgl", { alpha: true })) as WebGLRenderingContext | null;
  if (!gl) return () => {};
  host.appendChild(canvas);
  onGl(true);

  const fail = () => { onGl(false); canvas.remove(); return () => {}; };

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return fail();
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return fail();
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, "u_res");
  const uTime = gl.getUniformLocation(prog, "u_time");
  const uMouse = gl.getUniformLocation(prog, "u_mouse");

  const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  let mx = 0, my = 0, tx = 0, ty = 0;
  const onPointer = (e: PointerEvent) => {
    tx = (e.clientX / innerWidth - 0.5) * 2;
    ty = (e.clientY / innerHeight - 0.5) * 2;
  };
  addEventListener("pointermove", onPointer, { passive: true });

  const size = () => {
    // The field is a soft, slow, low-contrast gradient (no detail finer than a few dozen pixels), so it is computed at half the screen's
    // CSS resolution and stretched by the browser: a quarter of the pixels for the fragment shader to fill (it runs five noise layers
    // three times over for every pixel, every frame), with no visible difference. The canvas keeps its full CSS size.
    const dpr = 0.5;
    const w = Math.round(host.clientWidth * dpr), h = Math.round(host.clientHeight * dpr);
    if (!w || !h || (canvas.width === w && canvas.height === h)) return;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(uRes, w, h);
  };

  let raf = 0, onScreen = true;
  const start = performance.now();
  const frame = (now: number) => {
    raf = 0;
    mx += (tx - mx) * 0.05;
    my += (ty - my) * 0.05;
    gl.uniform1f(uTime, (now - start) / 1000);
    gl.uniform2f(uMouse, mx, my);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (onScreen && !document.hidden && !reduce) raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  const ro = new ResizeObserver(() => { size(); kick(); });
  ro.observe(host);
  const io = new IntersectionObserver((e) => { onScreen = !!e[0]?.isIntersecting; if (onScreen) kick(); });
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
    canvas.remove();
    onGl(false);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  };
}
