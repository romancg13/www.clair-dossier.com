import { useEffect, useMemo, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, LineSegments, ShaderMaterial } from 'three';
import { PALETTE } from './palette';

/**
 * Lignes fines qui se tracent avec la progression (Phase 4b).
 *
 * Un seul LineSegments ; chaque segment a un retard propre ; le tracé se fait
 * dans le fragment shader (position le long du segment vs progression) :
 * aucun élément DOM, aucune mise à jour de géométrie par frame.
 * Rendu additif très discret : « relations » abstraites, jamais un graphe vendu
 * comme fonctionnalité.
 */

export type LineSpec = {
  a: [number, number, number];
  b: [number, number, number];
  /** Retard de tracé dans [0, 0.8]. */
  delay: number;
  /** Intensité relative [0, 1]. */
  weight?: number;
};

const VERT = /* glsl */ `
  attribute float aT;
  attribute float aDelay;
  attribute float aWeight;
  varying float vT;
  varying float vDelay;
  varying float vWeight;
  void main() {
    vT = aT;
    vDelay = aDelay;
    vWeight = aWeight;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform float uProgress;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vT;
  varying float vDelay;
  varying float vWeight;
  void main() {
    float span = max(0.0001, 1.0 - vDelay);
    float local = clamp((uProgress - vDelay) / span, 0.0, 1.0);
    // expo.out sur le tracé
    float e = local >= 1.0 ? 1.0 : 1.0 - pow(2.0, -10.0 * local);
    if (vT > e) discard;
    // Tête de tracé légèrement plus lumineuse, queue plus douce.
    float head = 1.0 - smoothstep(0.0, 0.12, e - vT);
    float fade = smoothstep(0.0, 0.08, vT) * (1.0 - smoothstep(0.92, 1.0, vT));
    float a = uOpacity * vWeight * (0.55 + 0.45 * head) * (0.6 + 0.4 * fade);
    gl_FragColor = vec4(uColor, a);
  }
`;

export function LineField({
  lines,
  progressRef,
  color = PALETTE.sky,
  opacity = 0.35,
  renderOrder = 1,
}: {
  lines: LineSpec[];
  progressRef: RefObject<number>;
  color?: Color;
  opacity?: number;
  renderOrder?: number;
}) {
  const geometry = useMemo(() => {
    // Chaque ligne est subdivisée pour que le tracé (aT) soit lisse.
    const SUB = 12;
    const n = lines.length * SUB;
    const pos = new Float32Array(n * 2 * 3);
    const t = new Float32Array(n * 2);
    const delay = new Float32Array(n * 2);
    const weight = new Float32Array(n * 2);
    let k = 0;
    lines.forEach((l) => {
      const w = l.weight ?? 1;
      for (let s = 0; s < SUB; s++) {
        const t0 = s / SUB;
        const t1 = (s + 1) / SUB;
        for (const [tt, idx] of [
          [t0, 0],
          [t1, 1],
        ] as const) {
          const i = (k * 2 + idx) * 3;
          pos[i] = l.a[0] + (l.b[0] - l.a[0]) * tt;
          pos[i + 1] = l.a[1] + (l.b[1] - l.a[1]) * tt;
          pos[i + 2] = l.a[2] + (l.b[2] - l.a[2]) * tt;
          t[k * 2 + idx] = tt;
          delay[k * 2 + idx] = l.delay;
          weight[k * 2 + idx] = w;
        }
        k++;
      }
    });
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('aT', new BufferAttribute(t, 1));
    geo.setAttribute('aDelay', new BufferAttribute(delay, 1));
    geo.setAttribute('aWeight', new BufferAttribute(weight, 1));
    return geo;
  }, [lines]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uProgress: { value: 0 },
          uColor: { value: color },
          uOpacity: { value: opacity },
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    material.uniforms.uColor.value = color;
    material.uniforms.uOpacity.value = opacity;
  }, [material, color, opacity]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(() => {
    material.uniforms.uProgress.value = progressRef.current;
  });

  const object = useMemo(() => new LineSegments(geometry, material), [geometry, material]);
  return <primitive object={object} renderOrder={renderOrder} frustumCulled={false} />;
}
