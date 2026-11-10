#version 300 es
// luzhud.frag — indicador 2D del origen de la luz (siempre visible en pantalla).
// uSunNdc en [-1,1]; uEdge = 1 si se recorto al borde del viewport.
precision highp float;
in vec2 vTexCoord;
uniform vec2 uResolution;
uniform vec2 uSunNdc;
uniform float uRadiusNdc;
uniform float uEdge;
uniform float uArrowRad;
out vec4 outColor;

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = vTexCoord * 2.0 - 1.0;
  vec2 pA = vec2(p.x * aspect, p.y);
  vec2 sunA = vec2(uSunNdc.x * aspect, uSunNdc.y);
  float d = length(pA - sunA);
  float disc = smoothstep(uRadiusNdc + 0.018, uRadiusNdc - 0.006, d);
  float ring = smoothstep(uRadiusNdc * 0.62, uRadiusNdc * 0.54, d)
           * (1.0 - smoothstep(uRadiusNdc * 0.48, uRadiusNdc * 0.40, d));
  float halo = smoothstep(uRadiusNdc + 0.08, uRadiusNdc + 0.02, d) * 0.35;
  vec3 col = mix(vec3(1.0, 0.82, 0.08), vec3(1.0, 0.96, 0.45), ring);
  col = mix(col, vec3(1.0), halo);
  float alpha = disc * 0.92;
  if (uEdge > 0.5) {
    vec2 dir = sunA / max(length(sunA), 1e-3);
    vec2 tip = dir * (max(aspect, 1.0) * 0.94);
    vec2 rel = pA - tip;
    float along = dot(rel, -dir);
    float across = abs(dot(rel, vec2(-dir.y, dir.x)));
    float tri = step(0.0, along) * step(along, 0.12) * step(across, 0.04 + along * 0.35);
    col = mix(col, vec3(1.0, 0.75, 0.05), tri);
    alpha = max(alpha, tri * 0.9);
    disc = max(disc, tri * 0.5);
  }
  if (disc + ring * 0.2 < 0.02) discard;
  outColor = vec4(col, alpha);
}
