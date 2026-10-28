// Dust motes drifting in the finale cone. Everything is computed here from a per-point seed, so
// the CPU never touches the geometry after creation.
attribute vec4 aSeed; // x angle, y height phase, z radius fraction, w speed/size variation

uniform float uTime;        // seconds
uniform float uMotion;      // 1 = drifting, 0 = still (reduced motion hides the motes entirely)
uniform float uHeight;      // cone height, metres
uniform float uRadiusTop;
uniform float uRadiusBottom;
uniform float uSize;        // metres
uniform float uViewportHeight;

varying float vAlpha;

void main() {
  float t = uTime * uMotion;
  // Slow rise; wraps at the top and fades in and out so nothing pops.
  float yN = fract(aSeed.y + t * (0.012 + 0.012 * aSeed.w));
  float radius = mix(uRadiusBottom, uRadiusTop, yN) * sqrt(aSeed.z) * 0.9;
  float angle = aSeed.x * 6.2831853 + t * 0.05 * (aSeed.w - 0.5);

  vec3 p = vec3(cos(angle) * radius, yN * uHeight, sin(angle) * radius);
  // Gentle sway so the path is never a straight line.
  p.x += sin(t * 0.35 + aSeed.x * 40.0) * 0.06;
  p.z += cos(t * 0.31 + aSeed.y * 40.0) * 0.06;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.5, uSize * (0.7 + 0.6 * aSeed.w) * projectionMatrix[1][1] * uViewportHeight * 0.5 / -mv.z);
  vAlpha = sin(yN * 3.14159265);
}
