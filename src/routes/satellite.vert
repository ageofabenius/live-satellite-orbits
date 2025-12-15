attribute float size;
varying float vSize;

attribute vec3 color;
varying vec3 vColor;

void main(){
    vSize=size;
    vColor=color;
    
    vec4 mvPosition=modelViewMatrix*vec4(position,1.);
    
    gl_PointSize=size;
    
    gl_Position=projectionMatrix*mvPosition;
}