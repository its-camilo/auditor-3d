#version 300 es
// marcaluz.frag — círculo amarillo de referencia (UI, no entra en auditoría ni IDs).
// uBehind: anillo punteado si la fuente cae detrás de la camara (luz aun valida en shaders).
precision highp float;
in vec2 vUv;
uniform float uBehind;
out vec4 outColor;
void main() {
  float r = length(vUv);
  float alpha = smoothstep(1.05, 0.85, r);
  float ring = smoothstep(0.92, 0.78, r) * (1.0 - smoothstep(0.78, 0.62, r));
  vec3 col = mix(vec3(1.0, 0.85, 0.1), vec3(1.0, 0.95, 0.45), ring);
  if (uBehind > 0.5) {
    float dash = step(0.55, fract(atan(vUv.y, vUv.x) * 4.0));
    col *= mix(0.35, 1.0, dash);
    alpha *= 0.85;
  }
  outColor = vec4(col, alpha);
}
