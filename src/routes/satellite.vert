attribute float size;
varying float vSize;

void main(){
    vSize=size;
    
    vec4 mvPosition=modelViewMatrix*vec4(position,1.);
    
    gl_PointSize=size;
    
    gl_Position=projectionMatrix*mvPosition;
}