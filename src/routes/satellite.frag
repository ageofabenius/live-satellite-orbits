precision mediump float;
precision mediump int;

void main(){
    // Transform from [0 - 1] to [-1 to 1]
    vec2 c=gl_PointCoord*2.-1.;
    float r=length(c);
    
    float solid_radius=.25;
    float glow_radius=1.;
    
    vec3 solid_color=vec3(1.,1.,1.);// white
    vec3 glow_color=vec3(1.,1.,1.);// white glow
    
    if(r<=solid_radius){
        gl_FragColor=vec4(solid_color,1.);
        return;
    }
    
    float glow=smoothstep(glow_radius,0.,r);
    
    if(r>1.)discard;
    
    gl_FragColor=vec4(glow_color*glow,glow);
    
}