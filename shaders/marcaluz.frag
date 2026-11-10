#version 300 es
// marcaluz.frag — disco emisivo en la fuente; ocluye contra texDepth de la escena.
precision highp float;
in vec2 vUv;
in vec3 vWorld;
uniform sampler2D uDepth;
uniform mat4 uViewProj;
uniform vec2 uResolution;
out vec4 outColor;

void main() {
  vec4 clip = uViewProj * vec4(vWorld, 1.0);
  if (clip.w <= 0.0) discard;
  vec2 ndc = clip.xy / clip.w;
  vec2 uv = ndc * 0.5 + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
  float sceneD = texture(uDepth, uv).r;
  float fragD = clip.z / clip.w * 0.5 + 0.5;
  if (fragD > sceneD + 0.002) discard;
  float r = length(vUv);
  float disc = smoothstep(1.05, 0.82, r);
  float core = smoothstep(0.35, 0.1, r);
  vec3 col = mix(vec3(1.0, 0.82, 0.05), vec3(1.0, 0.98, 0.65), core);
  outColor = vec4(col, disc * 0.95);
}
