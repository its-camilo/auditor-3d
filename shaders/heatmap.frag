#version 300 es
// heatmap.frag
// Pasada 3 del Auditor 3D: marca cada figura según su estado, sobre la vista simulada.
// Estados (textura 256x1 que llena la auditoría, solo figuras):
//   0 bien · 1 aviso (WCAG < 3:1) · 2 falla (no se distingue del fondo)
//   3 se confunde con otro objeto (p. ej. dos rutas del mapa)
// Modos (uMode): 0 apagado · 1 contorno (por defecto) · 2 patrón de relleno.
// Ningún estado depende solo del color (WCAG 1.4.1): cada uno tiene su trazo.
//   contorno: falla = trazo grueso a rayas negro/blanco; confusión = trazo
//   blanco doble; aviso = trazo punteado. Seleccionado = amarillo con borde negro.
//   patrón:   falla = rayas diagonales; confusión = cuadrícula; aviso = puntos.
precision highp float;
uniform sampler2D uIds;     // RGBA8, R = id / 255
uniform sampler2D uStatus;  // RGBA8 256x1, R = estado / 255
uniform float uSelected;    // id seleccionado, 0 si ninguno
uniform float uMode;
out vec4 outColor;

float idAt(ivec2 p) { return floor(texelFetch(uIds, p, 0).r * 255.0 + 0.5); }

// Distancia (en px, 1..4) al borde del objeto por dentro; 9 si no hay borde cerca.
float edgeDist(ivec2 p, float id) {
  float d = 9.0;
  for (int k = 1; k <= 4; k++) {
    float fk = float(k);
    float diff = 0.0;
    diff = max(diff, step(0.5, abs(idAt(p + ivec2(k, 0)) - id)));
    diff = max(diff, step(0.5, abs(idAt(p - ivec2(k, 0)) - id)));
    diff = max(diff, step(0.5, abs(idAt(p + ivec2(0, k)) - id)));
    diff = max(diff, step(0.5, abs(idAt(p - ivec2(0, k)) - id)));
    d = min(d, mix(9.0, fk, diff));
  }
  return d;
}

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  float id = idAt(p);
  float st = floor(texelFetch(uStatus, ivec2(int(id), 0), 0).r * 255.0 + 0.5);
  float isFail = 1.0 - step(0.5, abs(st - 2.0));
  float isConf = 1.0 - step(0.5, abs(st - 3.0));
  float isWarn = 1.0 - step(0.5, abs(st - 1.0));
  float d = edgeDist(p, id);
  float along = gl_FragCoord.x + gl_FragCoord.y;

  // --- modo contorno ---
  float ring4 = 1.0 - step(4.5, d);                  // 4 px hacia dentro
  float dash = step(0.5, fract(along / 16.0));        // rayas de 8 px
  float dotted = step(0.5, fract(along / 6.0));
  float dbl = (1.0 - step(1.5, d)) + (1.0 - step(3.5, d)) * step(2.5, d); // líneas en 1 y 3 px
  vec4 cFailE = vec4(vec3(dash), 0.95 * ring4);
  vec4 cConfE = vec4(vec3(1.0), 0.95 * min(dbl, 1.0));
  vec4 cWarnE = vec4(vec3(1.0), 0.85 * (1.0 - step(2.5, d)) * dotted);
  vec4 edgeC = vec4(0.0);
  edgeC = mix(edgeC, cWarnE, isWarn);
  edgeC = mix(edgeC, cConfE, isConf);
  edgeC = mix(edgeC, cFailE, isFail);

  // --- modo patrón (más suave que v0: alfa 0.35, solo figuras) ---
  float diag = step(0.5, fract(along / 14.0));
  vec2 cell = fract(gl_FragCoord.xy / 12.0);
  float grid = max(1.0 - step(0.15, cell.x), 1.0 - step(0.15, cell.y));
  float dotp = 1.0 - step(0.16, length(fract(gl_FragCoord.xy / 10.0) - 0.5));
  vec4 fillC = vec4(0.0);
  fillC = mix(fillC, vec4(vec3(1.0), 0.6 * dotp), isWarn);
  fillC = mix(fillC, vec4(vec3(1.0), 0.45 * grid), isConf);
  fillC = mix(fillC, vec4(vec3(diag), 0.35), isFail);

  float modeEdge = 1.0 - step(0.5, abs(uMode - 1.0));
  float modeFill = 1.0 - step(0.5, abs(uMode - 2.0));
  vec4 c = edgeC * modeEdge + fillC * modeFill;

  // Seleccionado: contorno amarillo (2 px) con borde negro (1 px), en todos los modos.
  float sel = step(0.5, uSelected) * (1.0 - step(0.5, abs(id - uSelected)));
  vec4 selC = mix(vec4(0.0, 0.0, 0.0, 1.0), vec4(1.0, 0.92, 0.0, 1.0), step(1.5, d));
  c = mix(c, selC, sel * (1.0 - step(3.5, d)));
  outColor = c;
}
