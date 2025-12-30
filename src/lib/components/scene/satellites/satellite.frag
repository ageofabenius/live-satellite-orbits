varying vec3 vColor;
varying float vTransparency;

precision mediump float;
precision mediump int;

void main(){
    // Transform from [0 - 1] to [-1 to 1]
    vec2 c=gl_PointCoord*2.-1.;
    float r=length(c);
    
    float solid_radius=.25;
    float glow_radius=1.;
    
    if(r<=solid_radius){
        gl_FragColor=vec4(vColor,vTransparency);
        return;
    }
    
    float glow=smoothstep(glow_radius,0.,r);
    
    if(r>1.)discard;
    
    gl_FragColor=vec4(vColor*glow,glow*vTransparency);
    
}