uniform vec3 uEdgeContour;
uniform vec3 uEdgeRim;
uniform vec4 uEdgeParams;
vec3 avatarEdge( vec3 colour, vec3 viewNormal, vec3 viewPosition, float edgeOn ) {
float ndv = clamp( dot( normalize( viewNormal ), normalize( viewPosition ) ), 0.0, 1.0 );
float d = 0.7 * ndv / max( fwidth( ndv ), 1e-4 );
float w1 = uEdgeParams.x;
float w2 = uEdgeParams.y;
float inner = smoothstep( 0.6 * w1, w1, d );
float rim = ( 1.0 - inner ) * uEdgeParams.z * edgeOn;
float contour = inner * ( 1.0 - smoothstep( 0.7 * w2, w2, d ) ) * uEdgeParams.w * edgeOn;
colour = mix( colour, uEdgeContour, contour );
return mix( colour, uEdgeRim, rim );
}
