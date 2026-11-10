#version 300 es
// escena.frag — Blinn-Phong con luz puntual en uLightPos (mismo modelo que audit-core.js).
precision highp float;
in vec3 vWorld;
in vec3 vNormal;
uniform vec3 uKd;
uniform float uKs;
uniform float uShininess;
uniform vec3 uLightPos;
uniform vec3 uLightColor;
uniform float uAmbient;
uniform float uIntensity;
uniform float uAttenK;
uniform vec3 uEye;
uniform float uId;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outId;
void main() {
  vec3 N = normalize(vNormal);
  vec3 toL = uLightPos - vWorld;
  float dist2 = dot(toL, toL);
  vec3 L = toL * inversesqrt(dist2);
  vec3 V = normalize(uEye - vWorld);
  vec3 H = normalize(L + V);
  float diff = max(dot(N, L), 0.0);
  float spec = step(1e-4, diff) * pow(max(dot(N, H), 0.0), uShininess);
  float atten = 1.0 / (1.0 + uAttenK * dist2);
  float a = (uAmbient + uIntensity * diff) * atten;
  float s = uIntensity * uKs * spec * atten;
  outColor = vec4(uKd * uLightColor * a + uLightColor * s, 1.0);
  outId = vec4(uId / 255.0, 0.0, 0.0, 1.0);
}
