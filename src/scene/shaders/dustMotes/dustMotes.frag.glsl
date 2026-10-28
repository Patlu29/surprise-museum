precision mediump float;

uniform vec3 uColor;
uniform float uOpacity;

varying float vAlpha;

void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = (1.0 - smoothstep(0.0, 0.5, d)) * vAlpha * uOpacity;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}
