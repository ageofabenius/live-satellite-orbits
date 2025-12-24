attribute float size;
varying float vSize;

attribute vec3 color;
varying vec3 vColor;

attribute float transparency;
varying float vTransparency;

void main(){
    vSize=size;
    vColor=color;
    vTransparency=transparency;
    
    vec4 mvPosition=modelViewMatrix*vec4(position,1.);
    
    gl_PointSize=size;
    
    gl_Position=projectionMatrix*mvPosition;
}