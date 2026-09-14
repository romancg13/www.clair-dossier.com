import { useEffect, useMemo, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  NormalBlending,
  PlaneGeometry,
  Points,
  ShaderMaterial,
} from 'three';
import { PALETTE } from './palette';

/**
 * Atmosphère (Phase 4b) : halo diffus et poussière lente.
 * Deux draw calls au total, additifs, très faibles : la profondeur vient de
 * la composition et de la brume, pas d'un empilement d'effets.
 */

const HALO_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const HALO_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uSoft;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = pow(max(0.0, 1.0 - d), uSoft);
    gl_FragColor = vec4(uColor, a * uOpacity);
  }
`;

export function Halo({
  position = [0, 0, -6],
  size = 18,
  color = PALETTE.sky,
  opacity = 0.09,
  soft = 2.2,
}: {
  position?: [number, number, number];
  size?: number;
  color?: Color;
  opacity?: number;
  soft?: number;
}) {
  const geometry = useMemo(() => new PlaneGeometry(1, 1), []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: HALO_VERT,
        fragmentShader: HALO_FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: AdditiveBlending,
        uniforms: {
          uColor: { value: color },
          uOpacity: { value: opacity },
          uSoft: { value: soft },
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(() => {
    material.uniforms.uColor.value = color;
    material.uniforms.uOpacity.value = opacity;
    material.uniforms.uSoft.value = soft;
  }, [material, color, opacity, soft]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  return <mesh geometry={geometry} material={material} position={position} scale={[size, size, 1]} renderOrder={-10} frustumCulled={false} />;
}

const DUST_VERT = /* glsl */ `
  attribute float aSeed;
  attribute float aSize;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uScale;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.05 + aSeed * 6.2831) * 0.6;
    p.y += sin(uTime * 0.04 + aSeed * 3.1416) * 0.5 + fract(uTime * 0.008 + aSeed) * 0.0;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float depth = -mv.z;
    gl_PointSize = aSize * uPixelRatio * uScale * (12.0 / max(1.0, depth));
    vAlpha = smoothstep(40.0, 8.0, depth) * (0.4 + 0.6 * fract(aSeed * 7.0));
    gl_Position = projectionMatrix * mv;
  }
`;
const DUST_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = (1.0 - smoothstep(0.4, 1.0, d)) * vAlpha * uOpacity;
    gl_FragColor = vec4(uColor, a);
  }
`;

/**
 * Poussière : peu de points, dérive très lente, additif faible.
 * `count` est déjà réduit par le tier (voir budgetFor().points).
 */
export function Dust({
  count = 90,
  spread = [22, 12, 16],
  center = [0, 0, -4],
  color = PALETTE.silver,
  opacity = 0.22,
  scale = 1,
  pixelRatioRef,
}: {
  count?: number;
  spread?: [number, number, number];
  center?: [number, number, number];
  color?: Color;
  opacity?: number;
  scale?: number;
  pixelRatioRef?: RefObject<number>;
}) {
  const geometry = useMemo(() => {
    const n = Math.max(0, Math.floor(count));
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    const size = new Float32Array(n);
    // Suite déterministe (Halton-like) : même nuage à chaque visite.
    for (let i = 0; i < n; i++) {
      const h1 = halton(i + 1, 2);
      const h2 = halton(i + 1, 3);
      const h3 = halton(i + 1, 5);
      pos[i * 3] = center[0] + (h1 - 0.5) * spread[0];
      pos[i * 3 + 1] = center[1] + (h2 - 0.5) * spread[1];
      pos[i * 3 + 2] = center[2] + (h3 - 0.5) * spread[2];
      seed[i] = halton(i + 1, 7);
      size[i] = 1.2 + halton(i + 1, 11) * 2.2;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new BufferAttribute(seed, 1));
    geo.setAttribute('aSize', new BufferAttribute(size, 1));
    return geo;
  }, [count, spread, center]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: DUST_VERT,
        fragmentShader: DUST_FRAG,
        transparent: true,
        depthWrite: false,
        blending: count > 0 ? AdditiveBlending : NormalBlending,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
          uScale: { value: scale },
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
    material.uniforms.uScale.value = scale;
  }, [material, color, opacity, scale]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uPixelRatio.value = pixelRatioRef?.current ?? state.gl.getPixelRatio();
  });
  const points = useMemo(() => new Points(geometry, material), [geometry, material]);
  return <primitive object={points} frustumCulled={false} />;
}

function halton(index: number, base: number): number {
  let result = 0;
  let f = 1 / base;
  let i = index;
  while (i > 0) {
    result += f * (i % base);
    i = Math.floor(i / base);
    f /= base;
  }
  return result;
}
