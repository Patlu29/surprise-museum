// Mobile-safe: mediump, no loops, no texture reads, a handful of ALU operations.
precision mediump float;

uniform vec3 uColor;
uniform float uOpacity;   // 0..1, the decal's peak alpha
uniform float uPower;     // falloff sharpness; 1 is linear, higher is tighter
uniform float uSquare;    // 0 = ellipse, 1 = rounded rectangle
uniform float uTopBias;   // 0 = even, 1 = brightest at the top edge (picture-light wash)

varying vec2 vUv;
varying float vIntensity;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float dRound = length(p);
  float dBox = max(abs(p.x), abs(p.y));
  float d = mix(dRound, dBox, uSquare);

  float a = 1.0 - smoothstep(0.0, 1.0, d);
  a = pow(a, uPower);
  a *= mix(1.0, smoothstep(-1.0, 1.0, p.y), uTopBias);

  float alpha = a * uOpacity * vIntensity;

  // Interleaved gradient noise: stops 8-bit banding in very soft, low-alpha gradients.
  float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  alpha = max(alpha + (n - 0.5) / 255.0, 0.0);

  gl_FragColor = vec4(uColor, alpha);
  #include <colorspace_fragment>
}
