uniform float uOutfitPattern;
uniform float uPatternMix;
uniform vec3 uInkTarget;
uniform float uInkAmount;
flat varying float vOutfitCells;
float edgeWeight() { return vOutfitCells < -0.5 ? 0.0 : 1.0; }
varying vec3 vPatternPos;
varying vec3 vPatternNormal;
const float PATTERN_PERIOD = 0.04;
float squareWave( float c, float w ) {
return smoothstep( 0.5 - w, 0.5 + w, abs( fract( c ) - 0.5 ) * 2.0 );
}
vec3 avatarPattern( vec3 base ) {
if ( uOutfitPattern < 0.5 || vOutfitCells < 0.5 ) return base;
float cu = atan( vPatternNormal.x, vPatternNormal.z ) * 0.15915494 * vOutfitCells;
float cv = vPatternPos.y / PATTERN_PERIOD;
float du = min( fwidth( cu ), fwidth( fract( cu + 0.5 ) ) );
float dv = fwidth( cv );
float footprint = max( du, dv );
float amp = 1.0 - smoothstep( 0.35, 0.6, footprint );
if ( amp <= 0.001 ) return base;
float w = clamp( footprint, 0.001, 0.5 );
float ink;
if ( uOutfitPattern < 1.5 ) {
ink = 1.0 - squareWave( cv, w );
} else if ( uOutfitPattern < 2.5 ) {
float a = squareWave( cu * 0.5, w * 0.5 );
float b = squareWave( cv * 0.5, w * 0.5 );
ink = abs( a - b );
} else {
float row = floor( cv );
vec2 g = vec2( fract( cu + 0.5 * mod( row, 2.0 ) ) - 0.5, fract( cv ) - 0.5 );
float dist = length( g );
float r = 0.1875;
ink = 1.0 - smoothstep( r - w, r + w, dist );
}
return mix( base, mix( base, uInkTarget, uInkAmount ), ink * amp * uPatternMix );
}
