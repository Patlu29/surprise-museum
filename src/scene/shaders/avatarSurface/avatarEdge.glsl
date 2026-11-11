uniform vec3 uEdgeContour;
uniform vec3 uEdgeRim;
uniform vec4 uEdgeParams;
vec3 avatarEdge( vec3 colour, vec3 viewNormal, vec3 viewPosition, float edgeOn ) {
float ndv = clamp( dot( normalize( viewNormal ), normalize( viewPosition ) ), 0.0, 1.0 );
float fw = fwidth( ndv );
float d = EDGE_K * ndv / max( fw, 1e-4 );
float w1 = uEdgeParams.x * EDGE_W1;
#ifdef EDGE_COARSE
w1 *= mix( 1.0, EDGE_CW1, smoothstep( EDGE_CLO, EDGE_CHI, fw ) );
#endif
float w2 = uEdgeParams.y * EDGE_W2;
float inner = smoothstep( 0.6 * w1, w1, d );
float rim = ( 1.0 - inner ) * uEdgeParams.z * edgeOn;
float contour = inner * ( 1.0 - smoothstep( 0.7 * w2, w2, d ) ) * uEdgeParams.w * edgeOn;
colour = mix( colour, uEdgeContour, contour );
return mix( colour, uEdgeRim, rim );
}
