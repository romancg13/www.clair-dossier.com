import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
} from 'three';
import { PALETTE } from './palette';

/**
 * Feuilles documentaires instanciées (Phase 4b) — la primitive centrale de
 * « LE DOSSIER PREND VIE ».
 *
 * Un seul draw call pour N feuilles. Chaque instance possède une pose de
 * départ et une pose d'arrivée ; l'interpolation (avec retard en cascade,
 * easing expo.out et léger « settle ») se fait DANS le vertex shader à partir
 * d'un unique uniform `uProgress` : zéro travail JavaScript par frame.
 *
 * Rendu procédural : papier crème ou carte marine, coins arrondis (SDF),
 * lignes de texte suggérées, bord subtilement plus sombre, flottement
 * ambiant très faible. Aucune texture.
 */

export type SheetSpec = {
  /** Pose de départ (position + rotation Euler XYZ en radians). */
  from: [number, number, number, number, number, number];
  /** Pose d'arrivée. */
  to: [number, number, number, number, number, number];
  /** Taille (largeur, hauteur) en unités monde. */
  size: [number, number];
  /** Retard de départ dans [0, 0.6] : cascade. */
  delay: number;
  /** 0 = papier crème, 1 = carte marine (interface), 0.5 = mixte. */
  tint: number;
  /** Amplitude de flottement individuelle (0 = immobile). */
  drift: number;
};

const VERT = /* glsl */ `
  attribute vec3 aFromPos;
  attribute vec3 aFromRot;
  attribute vec3 aToPos;
  attribute vec3 aToRot;
  attribute vec2 aSize;
  attribute float aDelay;
  attribute float aTint;
  attribute float aDrift;
  attribute float aSeed;

  uniform float uProgress;
  uniform float uTime;
  uniform float uDrift;
  uniform float uSettle;

  varying vec2 vUv;
  varying float vTint;
  varying float vDepth;
  varying float vSeed;

  mat3 rotXYZ(vec3 r) {
    float cx = cos(r.x), sx = sin(r.x);
    float cy = cos(r.y), sy = sin(r.y);
    float cz = cos(r.z), sz = sin(r.z);
    mat3 mx = mat3(1.0, 0.0, 0.0, 0.0, cx, sx, 0.0, -sx, cx);
    mat3 my = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
    mat3 mz = mat3(cz, sz, 0.0, -sz, cz, 0.0, 0.0, 0.0, 1.0);
    return mz * my * mx;
  }

  float expoOut(float t) { return t >= 1.0 ? 1.0 : 1.0 - pow(2.0, -10.0 * t); }

  // back.out très amorti (≈ 2 % de dépassement pour c1 = 0.35)
  float settle(float t, float c1) {
    float u = t - 1.0;
    return 1.0 + (c1 + 1.0) * u * u * u + c1 * u * u;
  }

  void main() {
    float span = max(0.0001, 1.0 - aDelay);
    float t = clamp((uProgress - aDelay) / span, 0.0, 1.0);
    float e = mix(expoOut(t), settle(t, 0.35), uSettle);

    vec3 pos = mix(aFromPos, aToPos, e);
    vec3 rot = mix(aFromRot, aToRot, e);

    // Flottement ambiant : trois sinus déphasés par graine, amplitude par instance.
    float k = uDrift * aDrift;
    pos.x += sin(uTime * 0.31 + aSeed * 6.2831) * 0.06 * k;
    pos.y += sin(uTime * 0.23 + aSeed * 3.1416) * 0.08 * k;
    rot.z += sin(uTime * 0.19 + aSeed * 2.0) * 0.02 * k;
    rot.x += sin(uTime * 0.27 + aSeed * 4.0) * 0.015 * k;

    vec3 local = vec3(position.xy * aSize, 0.0);
    vec3 world = rotXYZ(rot) * local + pos;

    vUv = uv;
    vTint = aTint;
    vSeed = aSeed;
    vec4 mv = modelViewMatrix * vec4(world, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uPaper;
  uniform vec3 uPaperEdge;
  uniform vec3 uCard;
  uniform vec3 uCardEdge;
  uniform vec3 uLine;
  uniform float uOpacity;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform vec3 uFog;
  uniform float uLines;

  varying vec2 vUv;
  varying float vTint;
  varying float vDepth;
  varying float vSeed;

  // Rectangle arrondi (SDF) dans l'espace UV, rayon r.
  float roundedRect(vec2 uv, float r) {
    vec2 q = abs(uv - 0.5) - (0.5 - r);
    return length(max(q, 0.0)) - r;
  }

  void main() {
    float d = roundedRect(vUv, 0.06);
    float aa = fwidth(d) * 1.2;
    float shape = 1.0 - smoothstep(-aa, aa, d);
    if (shape <= 0.001) discard;

    // Bord : légère baisse de luminosité vers les bords (matière).
    float edge = smoothstep(0.0, 0.18, -d);
    vec3 paper = mix(uPaperEdge, uPaper, edge);
    vec3 card = mix(uCardEdge, uCard, edge);
    vec3 base = mix(paper, card, vTint);

    // Lignes de texte suggérées : bandes horizontales très discrètes.
    float rows = 9.0 + floor(vSeed * 4.0);
    float y = fract(vUv.y * rows);
    float band = smoothstep(0.62, 0.66, y) * (1.0 - smoothstep(0.86, 0.9, y));
    float margin = smoothstep(0.1, 0.14, vUv.x) * (1.0 - smoothstep(0.74 + vSeed * 0.14, 0.8 + vSeed * 0.14, vUv.x));
    float top = smoothstep(0.1, 0.16, vUv.y) * (1.0 - smoothstep(0.82, 0.86, vUv.y));
    float lines = band * margin * top * uLines;
    vec3 lineCol = mix(uLine, vec3(1.0), vTint * 0.85);
    base = mix(base, lineCol, lines * mix(0.16, 0.10, vTint));

    // Brume de profondeur : les feuilles lointaines se fondent dans le fond.
    float fog = smoothstep(uFogNear, uFogFar, vDepth);
    vec3 col = mix(base, uFog, fog);
    float alpha = uOpacity * shape * (1.0 - fog * 0.85);
    gl_FragColor = vec4(col, alpha);
  }
`;

export function SheetField({
  sheets,
  progressRef,
  opacity = 1,
  drift = 1,
  settleAmount = 1,
  linesVisible = 1,
  fog = PALETTE.navy950,
  fogNear = 14,
  fogFar = 34,
  renderOrder = 0,
  cardColor = PALETTE.navy925,
  cardEdge = PALETTE.navy950,
}: {
  sheets: SheetSpec[];
  progressRef: RefObject<number>;
  opacity?: number;
  drift?: number;
  /** 0 = expo.out pur, 1 = léger dépassement puis retour. */
  settleAmount?: number;
  linesVisible?: number;
  fog?: Color;
  fogNear?: number;
  fogFar?: number;
  renderOrder?: number;
  /** Couleur des « cartes interface » (tint = 1) : marine sur fond sombre, verre pâle sur fond clair. */
  cardColor?: Color;
  cardEdge?: Color;
}) {
  const meshRef = useRef<Mesh>(null);

  const geometry = useMemo(() => {
    const n = sheets.length;
    const base = new PlaneGeometry(1, 1, 1, 1);
    const geo = new InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.getAttribute('position'));
    geo.setAttribute('uv', base.getAttribute('uv'));
    geo.instanceCount = n;
    const fromPos = new Float32Array(n * 3);
    const fromRot = new Float32Array(n * 3);
    const toPos = new Float32Array(n * 3);
    const toRot = new Float32Array(n * 3);
    const size = new Float32Array(n * 2);
    const delay = new Float32Array(n);
    const tint = new Float32Array(n);
    const driftA = new Float32Array(n);
    const seed = new Float32Array(n);
    sheets.forEach((s, i) => {
      fromPos.set(s.from.slice(0, 3), i * 3);
      fromRot.set(s.from.slice(3, 6), i * 3);
      toPos.set(s.to.slice(0, 3), i * 3);
      toRot.set(s.to.slice(3, 6), i * 3);
      size.set(s.size, i * 2);
      delay[i] = s.delay;
      tint[i] = s.tint;
      driftA[i] = s.drift;
      // Graine déterministe (aucun Math.random : rendu identique à chaque visite).
      seed[i] = ((i * 7919) % 1000) / 1000;
    });
    geo.setAttribute('aFromPos', new InstancedBufferAttribute(fromPos, 3));
    geo.setAttribute('aFromRot', new InstancedBufferAttribute(fromRot, 3));
    geo.setAttribute('aToPos', new InstancedBufferAttribute(toPos, 3));
    geo.setAttribute('aToRot', new InstancedBufferAttribute(toRot, 3));
    geo.setAttribute('aSize', new InstancedBufferAttribute(size, 2));
    geo.setAttribute('aDelay', new InstancedBufferAttribute(delay, 1));
    geo.setAttribute('aTint', new InstancedBufferAttribute(tint, 1));
    geo.setAttribute('aDrift', new InstancedBufferAttribute(driftA, 1));
    geo.setAttribute('aSeed', new InstancedBufferAttribute(seed, 1));
    // Pas de sphère englobante : le mesh est rendu avec frustumCulled={false}
    // (les poses extrêmes de départ sortent volontairement du champ).
    base.dispose();
    return geo;
  }, [sheets]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        uniforms: {
          uProgress: { value: 0 },
          uTime: { value: 0 },
          uDrift: { value: drift },
          uSettle: { value: settleAmount },
          uOpacity: { value: opacity },
          uLines: { value: linesVisible },
          uPaper: { value: PALETTE.cream },
          uPaperEdge: { value: PALETTE.cream100 },
          uCard: { value: cardColor },
          uCardEdge: { value: cardEdge },
          uLine: { value: PALETTE.navy900 },
          uFog: { value: fog },
          uFogNear: { value: fogNear },
          uFogFar: { value: fogFar },
        },
      }),
    // Les uniforms sont mis à jour en place ci-dessous : le matériau n'est créé qu'une fois.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    material.uniforms.uDrift.value = drift;
    material.uniforms.uSettle.value = settleAmount;
    material.uniforms.uOpacity.value = opacity;
    material.uniforms.uLines.value = linesVisible;
    material.uniforms.uFog.value = fog;
    material.uniforms.uFogNear.value = fogNear;
    material.uniforms.uFogFar.value = fogFar;
    material.uniforms.uCard.value = cardColor;
    material.uniforms.uCardEdge.value = cardEdge;
  }, [material, drift, settleAmount, opacity, linesVisible, fog, fogNear, fogFar, cardColor, cardEdge]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state) => {
    material.uniforms.uProgress.value = progressRef.current;
    material.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return <mesh ref={meshRef} geometry={geometry} material={material} frustumCulled={false} renderOrder={renderOrder} />;
}
