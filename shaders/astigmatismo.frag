#version 300 es
// astigmatismo.frag — desenfoque anisotrópico (cilindro + eje). Opcionalmente sensible
// a la profundidad vía el mismo mapa de profundidad que la miopía.
precision highp float;
in vec2 vTexCoord;
uniform sampler2D uSource;
uniform sampler2D uDepth;
uniform vec2 uTexelSize;
uniform float uNear;
uniform float uFar;
uniform float uCylinderD; // |cilindro| en dioptrías
uniform float uAxisDeg;   // meridiano de menor nitidez
uniform float uPupilMm;
uniform float uFovy;
uniform vec2 uResolution;
out vec4 outColor;

float linearizeDepth(float depth) {
  float z = depth * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}

void main() {
  vec3 center = texture(uSource, vTexCoord).rgb;
  if (uCylinderD < 0.05) {
    outColor = vec4(center, 1.0);
    return;
  }
  float distM = linearizeDepth(texture(uDepth, vTexCoord).r);
  float depthW = clamp(distM / 30.0, 0.4, 1.5);
  float rStrong = uPupilMm * 0.001 * uCylinderD * 0.18 * depthW * uResolution.y / max(tan(uFovy * 0.5), 1e-4);
  float rWeak = max(0.5, rStrong * 0.15);
  float theta = radians(uAxisDeg);
  vec2 axis = vec2(cos(theta), sin(theta));
  vec2 ortho = vec2(-axis.y, axis.x);
  vec3 acc = center;
  float w = 1.0;
  const int N = 12;
  for (int i = -N; i <= N; i++) {
    if (i == 0) continue;
    float fi = float(i);
    vec2 off = axis * fi * rStrong * uTexelSize + ortho * fi * rWeak * uTexelSize * 0.35;
    vec2 uv = clamp(vTexCoord + off, vec2(0.0), vec2(1.0));
    acc += texture(uSource, uv).rgb;
    w += 1.0;
  }
  outColor = vec4(acc / w, 1.0);
}
