#version 300 es
// miopia.frag — desenfoque por profundidad (miopía): gather espiral estilo DOF del notebook.
// Escala: 1 unidad de mundo ≈ 1 m. Punto lejano a |D| dioptrías: f_far = 1/|D| m.
// defocus(d) = max(0, |D| - 1/d). Radio en px ∝ pupila × defocus y FOV vertical.
// Prueba de admisión: muestras más lejanas o con CoC ≥ distancia en la espiral.
precision highp float;
in vec2 vTexCoord;
uniform sampler2D uSource;
uniform sampler2D uDepth;
uniform vec2 uTexelSize;
uniform float uNear;
uniform float uFar;
uniform float uMyopiaD;  // magnitud |D|, 0 desactivado
uniform float uPupilMm;
uniform float uFovy;
uniform vec2 uResolution;
out vec4 outColor;

float linearizeDepth(float depth) {
  float z = depth * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}

float defocusDiopters(float distM) {
  if (uMyopiaD < 0.01) return 0.0;
  float farPt = 1.0 / uMyopiaD;
  if (distM <= farPt) return 0.0;
  return max(0.0, uMyopiaD - 1.0 / max(distM, 0.05));
}

float cocPixels(float defocus) {
  float blurAngle = uPupilMm * 1.0e-3 * defocus * 0.65;
  return blurAngle * uResolution.y / max(tan(uFovy * 0.5), 1e-4);
}

void main() {
  vec3 centerCol = texture(uSource, vTexCoord).rgb;
  float centerDepth = texture(uDepth, vTexCoord).r;
  float centerDist = linearizeDepth(centerDepth);
  float centerDef = defocusDiopters(centerDist);
  float maxR = cocPixels(centerDef);
  if (maxR < 0.15) {
    outColor = vec4(centerCol, 1.0);
    return;
  }
  vec3 acc = centerCol;
  float w = 1.0;
  const int SAMPLES = 32;
  for (int i = 0; i < SAMPLES; i++) {
    float fi = float(i);
    float ang = fi * 2.39996323;
    float rad = maxR * sqrt((fi + 1.0) / float(SAMPLES));
    vec2 off = vec2(cos(ang), sin(ang)) * rad * uTexelSize;
    vec2 uv = clamp(vTexCoord + off, vec2(0.0), vec2(1.0));
    float sd = texture(uDepth, uv).r;
    float distPx = rad;
    float cocS = cocPixels(defocusDiopters(linearizeDepth(sd)));
    float admit = max(step(centerDepth - 1e-4, sd), step(distPx - 0.25, cocS));
    admit = max(admit, 0.35);
    acc += texture(uSource, uv).rgb * admit;
    w += admit;
  }
  outColor = vec4(acc / w, 1.0);
}
