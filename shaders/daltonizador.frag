#version 300 es
// daltonizador.frag
// Simulacion de daltonismo en tiempo real. WebGL2 + GLSL ES 3.00.
// Modelos: protan y deutan con Machado, Oliveira, Fernandes 2009 (mismo que
// Chrome DevTools); tritan con Brettel, Vienot, Mollon 1997 (dos semiplanos).
// Las matrices (tipo + severidad) se calculan en JS (machado.js). Para Machado
// uSim = uSim2, asi el plano no cambia nada. Sin ramas: el semiplano se elige
// con step() y mix().
// Pipeline: sRGB -> lineal (exacta) -> matriz -> clamp -> sRGB (exacta).
// Referencias:
// - NotebookLM Visual: Shading color ops, srgb2lin exacto.
// - Machado, Oliveira, Fernandes 2009, IEEE TVCG 15(6).
// - Brettel, Vienot, Mollon 1997, JOSA A 14(10). Matrices de libDaltonLens (dominio publico).
// - IEC 61966-2-1 (sRGB).
// Proyecto 2 (Auditor 3D): unico cambio, el uniform uInputLinear. Con 0.0 se
// comporta igual que en el Proyecto 1.
precision highp float;

in vec2 vTexCoord;
uniform sampler2D uTexture;
uniform mat3 uSim;      // RGB lineal -> simulado. Semiplano dot(rgb, uPlane) >= 0.
uniform mat3 uSim2;     // Semiplano dot(rgb, uPlane) < 0 (solo distinto en Brettel).
uniform vec3 uPlane;    // Normal del plano de separacion de Brettel en RGB lineal.
uniform float uInputLinear; // Proyecto 2: 1.0 si la textura ya es RGB lineal (FBO RGBA16F), 0.0 si es sRGB.
out vec4 outColor;

// sRGB a lineal. Funcion piecewise exacta. No usa gamma 2.2.
vec3 srgb2lin(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

// Lineal a sRGB. Funcion piecewise exacta.
vec3 lin2srgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec4 src = texture(uTexture, vTexCoord);
  // Proyecto 2: el FBO de la escena guarda RGB lineal; no se decodifica dos veces.
  vec3 lin = mix(srgb2lin(src.rgb), src.rgb, uInputLinear);
  float side = step(0.0, dot(lin, uPlane));
  vec3 sim = clamp(mix(uSim2 * lin, uSim * lin, side), 0.0, 1.0);
  outColor = vec4(lin2srgb(sim), 1.0);
}
