export const rainbowVertexShader = `
varying vec3 vN;
void main() {
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const rainbowFragmentShader = `
uniform float uTime;
varying vec3 vN;

vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

void main() {
  float fres = pow(1.0 - abs(vN.z), 2.0);
  float h = fract(uTime * 0.25 + vN.y * 0.35 + vN.x * 0.20);
  gl_FragColor = vec4(hsv2rgb(vec3(h, 0.85, 1.0)) + fres * 0.6, 1.0);
}
`;
