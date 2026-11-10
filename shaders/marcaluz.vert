#version 300 es
// marcaluz.vert — disco billboard (siempre de frente a la cámara) para el origen de la luz.
precision highp float;
layout(location = 0) in vec2 aCorner; // -1..1 en el plano del disco
uniform vec3 uCenter;
uniform vec3 uEye;
uniform float uRadius;
uniform mat4 uViewProj;
out vec2 vUv;
void main() {
  vec3 view = normalize(uEye - uCenter);
  vec3 up = abs(view.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 right = normalize(cross(up, view));
  up = cross(view, right);
  vec3 world = uCenter + (right * aCorner.x + up * aCorner.y) * uRadius;
  gl_Position = uViewProj * vec4(world, 1.0);
  vUv = aCorner;
}
