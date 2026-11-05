// The machine's stage: a pale studio with a soft floor, a block of skin cut open on the needle's plane, soft shadows
// and GTAO. frame(state, cam) poses the machine and draws one frame.
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {M} from './kin.js';
import {buildMachine, FLOOR_Y, LIFT, NEEDLE_Z, SCALE, SKIN_Y} from './machine.js';

const V3 = THREE.Vector3;
export const COL = {bg: '#ece8e2', ground: '#e6e1d9', grid: '#d8d1c5', shadow: '#5b4a3a'};

const GROUND_VERT = /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const GROUND_FRAG = /* glsl */ `uniform vec3 uG; uniform vec3 uM; uniform vec3 uBg; uniform vec3 uC; varying vec3 vW;
  void main(){
    vec2 p = vW.xz * 10.0;
    vec2 g = abs(fract(p) - 0.5);
    float line = 1.0 - smoothstep(0.0, 0.035, min(g.x, g.y));
    vec2 g5 = abs(fract(p / 5.0) - 0.5);
    line = max(line * 0.45, 1.0 - smoothstep(0.0, 0.012, min(g5.x, g5.y)));
    float n = fract(sin(dot(floor(vW.xz * 300.0), vec2(12.9898, 78.233))) * 43758.5453);
    vec3 col = mix(uG, uM, line * 0.8) * (0.99 + 0.02 * n);
    float d = length(vW.xz - uC.xz);
    gl_FragColor = vec4(mix(col, uBg, smoothstep(1.2, 5.5, d)), 1.0);
  }`;
// the cut face of the skin: epidermis, dermis, fat, the ink the needle has left, in millimetres below the surface
const SKIN_VERT = /* glsl */ `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKIN_FRAG = /* glsl */ `uniform float uSurf; uniform float uInk; uniform float uX; uniform float uDepth; uniform float uHole; varying vec2 vP;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n2(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
  void main(){
    float d = uSurf - vP.y;
    float w = n2(vec2(vP.x * 1.3, 0.0)) * 0.08;
    vec3 epi = vec3(0.86, 0.63, 0.5);
    vec3 der = vec3(0.89, 0.55, 0.53);
    vec3 fat = vec3(0.96, 0.84, 0.55);
    vec3 col = d < 0.12 + w * 0.3 ? epi : (d < 2.3 + w * 4.0 ? der : fat);
    // collagen grain in the dermis, lobules in the fat
    float grain = n2(vP * vec2(2.5, 9.0));
    col *= d < 2.3 ? 0.94 + 0.08 * grain : 0.9 + 0.12 * smoothstep(0.35, 0.6, n2(vP * 1.6));
    col = mix(col, vec3(0.62, 0.36, 0.3), (1.0 - smoothstep(0.0, 0.07, abs(d - 0.12 - w * 0.3))) * 0.6);
    // the ink: a cloud the needle leaves in the upper dermis, it grows with every strike
    vec2 q = vec2((vP.x - uX) / (0.35 + 0.9 * uInk), (d - 0.95) / (0.28 + 0.4 * uInk));
    float ink = smoothstep(1.0, 0.35, length(q) + 0.35 * (n2(vP * 7.0) - 0.5)) * min(1.0, uInk * 3.0);
    col = mix(col, vec3(0.07, 0.08, 0.13), ink * 0.92);
    // the channel the needle opens
    float hole = (1.0 - smoothstep(0.08, 0.2, abs(vP.x - uX + 0.12))) * step(d, uDepth) * step(0.0, d);
    col = mix(col, vec3(0.5, 0.17, 0.17), hole * uHole * 0.75);
    gl_FragColor = vec4(col * 0.97, 1.0);
  }`;

export function createStage({canvas}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.bg);
  const camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.01, 60);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 8}));
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.75;
  gtao.updateGtaoMaterial({radius: 0.03, distanceExponent: 1.4, thickness: 0.4, scale: 1.0, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false});
  gtao.updatePdMaterial({lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16});
  class Toggle extends Pass {
    constructor(fn) {
      super();
      this.needsSwap = false;
      this.fn = fn;
    }
    render() {
      this.fn();
    }
  }
  // the floor and the see-through bits stay out of the AO pass
  const aoHidden = [];
  const vis = (v) => () => {
    for (const o of aoHidden) o.visible = v && o.userData.on !== false;
  };
  composer.addPass(new Toggle(vis(false)));
  composer.addPass(gtao);
  composer.addPass(new Toggle(vis(true)));
  composer.addPass(new OutputPass());

  {
    const env = new THREE.Scene();
    env.background = new THREE.Color('#e4dfd7');
    const panel = (w, h, pos, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(1, 0.985, 0.96).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    panel(10, 10, new V3(-2, 12, 4), 2.6);
    panel(3, 12, new V3(-11, 3, 7), 3.2);
    panel(2.5, 12, new V3(11, 4, -5), 2.0);
    panel(16, 2.5, new V3(0, 1.5, 12), 1.4);
    panel(2, 8, new V3(6, 3, 10), 2.4);
    const g = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({color: '#cbbfae', side: THREE.DoubleSide}));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -2;
    env.add(g);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.02).texture;
    scene.environmentIntensity = 1.0;
    pm.dispose();
  }
  const SUN_DIR = new V3(-0.42, 0.8, 0.43).normalize();
  const sun = new THREE.DirectionalLight('#fff7ec', 2.2);
  sun.castShadow = true;
  const EXT = 1.25;
  Object.assign(sun.shadow.camera, {left: -EXT, right: EXT, top: EXT, bottom: -EXT, near: 0.5, far: 20});
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.radius = 8;
  sun.shadow.blurSamples = 16;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.0015;
  sun.position.copy(SUN_DIR).multiplyScalar(8).add(new V3(0, 0.9, 0));
  sun.target.position.set(0, 0.9, 0);
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight('#dfe8ff', 0.7);
  rim.position.set(3, 2, -4);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight('#fffaf3', '#d6cab8', 0.6));

  const groundMat = new THREE.ShaderMaterial({
    vertexShader: GROUND_VERT,
    fragmentShader: GROUND_FRAG,
    uniforms: {uG: {value: new THREE.Color(COL.ground)}, uM: {value: new THREE.Color(COL.grid)}, uBg: {value: new THREE.Color(COL.bg)}, uC: {value: new V3()}},
    toneMapped: false,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const shade = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.ShadowMaterial({color: COL.shadow, opacity: 0.28, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8}),
  );
  shade.rotation.x = -Math.PI / 2;
  shade.receiveShadow = true;
  scene.add(shade);
  aoHidden.push(ground, shade);

  const mc = buildMachine();
  scene.add(mc.root);

  // ---------------------------------------------------------- the skin: a block cut open on the needle's plane
  const skin = new THREE.Group();
  skin.scale.setScalar(SCALE);
  skin.position.y = LIFT;
  scene.add(skin);
  const SK = {x0: -22, x1: 78, z0: -46, z1: NEEDLE_Z};
  const skinMat = new THREE.MeshStandardMaterial({color: '#e8c3ad', roughness: 0.62, metalness: 0, envMapIntensity: 0.5});
  {
    const w = SK.x1 - SK.x0;
    const h = SKIN_Y - FLOOR_Y;
    const d = SK.z1 - SK.z0;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), skinMat);
    b.position.set((SK.x0 + SK.x1) / 2, (SKIN_Y + FLOOR_Y) / 2, (SK.z0 + SK.z1) / 2 - 0.02);
    b.castShadow = true;
    b.receiveShadow = true;
    skin.add(b);
  }
  const faceMat = new THREE.ShaderMaterial({
    vertexShader: SKIN_VERT,
    fragmentShader: SKIN_FRAG,
    uniforms: {uSurf: {value: SKIN_Y}, uInk: {value: 0}, uX: {value: M.nipple}, uDepth: {value: 0}, uHole: {value: 0}},
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(SK.x1 - SK.x0, SKIN_Y - FLOOR_Y, 1, 1), faceMat);
  face.position.set((SK.x0 + SK.x1) / 2, (SKIN_Y + FLOOR_Y) / 2, SK.z1 + 0.01);
  // plane geometry is centred: shift its vertices so the shader reads machine millimetres
  face.geometry.translate((SK.x0 + SK.x1) / 2, (SKIN_Y + FLOOR_Y) / 2, 0);
  face.position.set(0, 0, SK.z1 + 0.01);
  skin.add(face);
  skin.visible = false;

  const size = {w: 1600, h: 900};
  const resize = (w, h, pr) => {
    size.w = w;
    size.h = h;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  // st: machine state (y, i, vc, iPeak, field, xray, explode, flow) + skin 0..1, ink 0..1, depth mm
  // cam: {tx, ty, tz, az, el, d (radians, world units), sx, sy}
  const frame = (st, cam) => {
    mc.update(st);
    const sk = st.skin ?? 0;
    skin.visible = sk > 0.002;
    skin.position.y = LIFT - (1 - sk) * 13.5 * SCALE;
    faceMat.uniforms.uInk.value = st.ink ?? 0;
    faceMat.uniforms.uDepth.value = st.depth ?? 0;
    faceMat.uniforms.uHole.value = (st.depth ?? 0) > 0.01 ? 1 : 0;
    camera.position.set(cam.tx + cam.d * Math.cos(cam.el) * Math.sin(cam.az), cam.ty + cam.d * Math.sin(cam.el), cam.tz + cam.d * Math.cos(cam.el) * Math.cos(cam.az));
    camera.lookAt(cam.tx, cam.ty, cam.tz);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    groundMat.uniforms.uC.value.set(cam.tx, 0, cam.tz);
    composer.render();
  };
  const pv = new V3();
  /** screen position (console px) of a point in machine millimetres */
  const project = (x, y, z, onArm = false) => {
    pv.copy(mc.world(x, y, z, onArm)).project(camera);
    if (pv.z > 1) return null;
    return [(pv.x * 0.5 + 0.5) * size.w, (-pv.y * 0.5 + 0.5) * size.h];
  };
  const setQuality = ({samples, ao, shadow, aoSamples}) => {
    if (aoSamples !== undefined) {
      gtao.updateGtaoMaterial({samples: aoSamples});
      gtao.updatePdMaterial({samples: aoSamples, rings: 2});
    }
    if (samples !== undefined)
      for (const t of [composer.renderTarget1, composer.renderTarget2]) {
        t.samples = samples;
        t.dispose();
      }
    if (ao !== undefined) gtao.enabled = ao;
    if (shadow !== undefined) {
      sun.shadow.mapSize.set(shadow, shadow);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
  };
  return {renderer, scene, camera, composer, gtao, mc, resize, frame, project, size, setQuality};
}
