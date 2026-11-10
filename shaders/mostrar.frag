#version 300 es
// mostrar.frag — convierte RGB lineal del último buffer del pipe a sRGB en pantalla.
precision highp float;
in vec2 vTexCoord;
uniform sampler2D uTexture;
out vec4 outColor;

vec3 lin2srgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec3 lin = texture(uTexture, vTexCoord).rgb;
  outColor = vec4(lin2srgb(lin), 1.0);
}
