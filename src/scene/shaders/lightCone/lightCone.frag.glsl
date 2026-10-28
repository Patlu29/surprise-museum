// Finale light cone. Additive, double-sided, faded at both ends and at grazing angles so it
// never shows a hard edge. Mobile-safe: mediump, no loops, no texture reads.
precision mediump float;

uniform vec3 uColor;
uniform float uOpacity;   // peak alpha; the design spec asks for 0.08 to 0.10
uniform float uGlow;      // 1 normally; raised for the "all viewed" highlight

varying vec2 vUv;
varying vec3 vNormalV;
varying vec3 vViewPos;

void main() {
  // CylinderGeometry: v = 1 at the top (oculus), 0 at the bottom (floor).
  float h = vUv.y;
  float along = smoothstep(0.0, 0.55, h) * (1.0 - smoothstep(0.92, 1.0, h));

  float facing = abs(dot(normalize(vNormalV), normalize(-vViewPos)));
  float edge = pow(facing, 1.4);

  float alpha = along * edge * uOpacity * uGlow;

  float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  alpha = max(alpha + (n - 0.5) / 255.0, 0.0);

  gl_FragColor = vec4(uColor, alpha);
  #include <colorspace_fragment>
}
