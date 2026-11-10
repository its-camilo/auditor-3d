#version 300 es
// heatmap.frag
// Pasada 3 del Auditor 3D: mapa de calor por objeto sobre la vista simulada.
// Lee el ID de cada pixel y el estado del objeto (0 bien, 1 WCAG < 3:1,
// 2 no distinguible) desde una textura 256x1 que llena la auditoria.
// No depende solo del color (WCAG 1.4.1): falla = rayas diagonales negras y
// blancas; aviso = puntos. El objeto seleccionado lleva contorno.
precision highp float;
uniform sampler2D uIds;     // RGBA8, R = id / 255
uniform sampler2D uStatus;  // RGBA8 256x1, R = estado / 255
uniform float uSelected;    // id seleccionado, 0 si ninguno
uniform float uShowHeat;    // 1.0 muestra el mapa
out vec4 outColor;
float idAt(ivec2 p) { return floor(texelFetch(uIds, p, 0).r * 255.0 + 0.5); }
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  float id = idAt(p);
  float st = floor(texelFetch(uStatus, ivec2(int(id), 0), 0).r * 255.0 + 0.5);
  float diag = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) / 14.0));
  vec2 cell = fract(gl_FragCoord.xy / 10.0) - 0.5;
  float dotp = 1.0 - step(0.18, length(cell));
  float fail = step(1.5, st) * uShowHeat;
  float warn = step(0.5, st) * (1.0 - step(1.5, st)) * uShowHeat;
  vec4 cFail = vec4(vec3(diag), 0.55);
  vec4 cWarn = vec4(vec3(1.0), 0.7 * dotp);
  // Contorno: algun vecino a 2 px con otro id.
  float edge = 0.0;
  edge = max(edge, step(0.5, abs(idAt(p + ivec2(2, 0)) - id)));
  edge = max(edge, step(0.5, abs(idAt(p - ivec2(2, 0)) - id)));
  edge = max(edge, step(0.5, abs(idAt(p + ivec2(0, 2)) - id)));
  edge = max(edge, step(0.5, abs(idAt(p - ivec2(0, 2)) - id)));
  float sel = step(0.5, uSelected) * (1.0 - step(0.5, abs(id - uSelected))) * edge;
  vec4 c = vec4(0.0);
  c = mix(c, cWarn, warn);
  c = mix(c, cFail, fail);
  c = mix(c, vec4(1.0, 1.0, 0.0, 1.0), sel);
  outColor = c;
}
