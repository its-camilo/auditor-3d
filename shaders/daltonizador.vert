#version 300 es
// daltonizador.vert
// Vertex passthrough en NDC. Regimen M = V = P = I.
// Referencia: NotebookLM Visual - Archetypes texture mapping,
// quad 2x2 en NDC, sin matrices de vista ni proyeccion.
layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec2 aTexCoord;
out vec2 vTexCoord;
void main() {
  vTexCoord = aTexCoord;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
