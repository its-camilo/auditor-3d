#version 300 es
// escena.vert
// Pasada 1 del Auditor 3D. Transforma cada caja de la escena.
// Las cajas solo tienen escala y traslacion por eje, asi que mat3(uModel)
// conserva la direccion de las normales de cara (se normaliza en el .frag).
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
uniform mat4 uModel;
uniform mat4 uViewProj;
out vec3 vWorld;
out vec3 vNormal;
void main() {
  vec4 w = uModel * vec4(aPosition, 1.0);
  vWorld = w.xyz;
  vNormal = mat3(uModel) * aNormal;
  gl_Position = uViewProj * w;
}
