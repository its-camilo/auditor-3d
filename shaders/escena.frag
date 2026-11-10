#version 300 es
// escena.frag
// Pasada 1 del Auditor 3D: Blinn-Phong en RGB lineal con dos salidas (MRT).
//   location 0 -> color lineal (FBO RGBA16F, sin clamp ni gamma).
//   location 1 -> ID del objeto en el canal R (FBO RGBA8), para picking y auditoria.
// Modelo (mismo de audit-core.js, blinnPhong):
//   I = kd * Lc * (ka + Ii * max(n.l, 0)) + Lc * Ii * ks * (n.h)^p
// Con luz blanca (Lc = 1) el color es lineal en kd: base de la Proposicion 1.
// Sin ramas: el especular se apaga con step() cuando n.l <= 0.
// Referencias: Blinn 1977; NotebookLM Visual, Local Lighting.
precision highp float;
in vec3 vWorld;
in vec3 vNormal;
uniform vec3 uKd;          // albedo en RGB lineal
uniform float uKs;
uniform float uShininess;
uniform vec3 uLightDir;    // hacia la luz, en mundo
uniform vec3 uLightColor;  // RGB lineal
uniform float uAmbient;
uniform float uIntensity;
uniform vec3 uEye;
uniform float uId;         // 1..255
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outId;
void main() {
  vec3 N = normalize(vNormal);
  vec3 L = normalize(uLightDir);
  vec3 V = normalize(uEye - vWorld);
  vec3 H = normalize(L + V);
  float diff = max(dot(N, L), 0.0);
  float spec = step(1e-4, diff) * pow(max(dot(N, H), 0.0), uShininess);
  float a = uAmbient + uIntensity * diff;
  float s = uIntensity * uKs * spec;
  outColor = vec4(uKd * uLightColor * a + uLightColor * s, 1.0);
  outId = vec4(uId / 255.0, 0.0, 0.0, 1.0);
}
