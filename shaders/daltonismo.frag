#version 300 es
// daltonismo.frag — etapa de simulación de daltonismo (Proyecto 1).
// Multipass: uOutputLinear = 1 deja RGB lineal simulado para otra etapa;
//            uOutputLinear = 0 entrega sRGB listo para pantalla.
precision highp float;

in vec2 vTexCoord;
uniform sampler2D uTexture;
uniform mat3 uSim;
uniform mat3 uSim2;
uniform vec3 uPlane;
uniform float uInputLinear;
uniform float uOutputLinear;
uniform float uEnabled; // 1 = aplicar matriz; 0 = passthrough
out vec4 outColor;

vec3 srgb2lin(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

vec3 lin2srgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec4 src = texture(uTexture, vTexCoord);
  vec3 lin = mix(srgb2lin(src.rgb), src.rgb, uInputLinear);
  vec3 outLin = lin;
  if (uEnabled > 0.5) {
    float side = step(0.0, dot(lin, uPlane));
    outLin = clamp(mix(uSim2 * lin, uSim * lin, side), 0.0, 1.0);
  }
  vec3 rgb = mix(lin2srgb(outLin), outLin, uOutputLinear);
  outColor = vec4(rgb, 1.0);
}
