// Glow decal: soft pools of light (additive) and blob shadows (normal blend).
//
// Intensity can come from three places, all multiplied together:
//   uOpacity (fragment uniform), aIntensity (per vertex, when USE_VERTEX_INTENSITY is defined,
//   which lets one merged mesh carry many decals that fade independently), and the instance
//   colour's red channel (when drawn as an InstancedMesh with instanceColor, scaled by
//   uInstanceGain). three.js defines USE_INSTANCING and USE_INSTANCING_COLOR for us.
#ifdef USE_VERTEX_INTENSITY
attribute float aIntensity;
#endif
uniform float uInstanceGain;
varying vec2 vUv;
varying float vIntensity;

void main() {
  vUv = uv;
  float intensity = 1.0;
  #ifdef USE_VERTEX_INTENSITY
  intensity *= aIntensity;
  #endif
  #ifdef USE_INSTANCING_COLOR
  intensity *= instanceColor.r * uInstanceGain;
  #endif
  vIntensity = intensity;

  vec4 pos = vec4(position, 1.0);
  #ifdef USE_INSTANCING
  pos = instanceMatrix * pos;
  #endif
  gl_Position = projectionMatrix * modelViewMatrix * pos;
}
