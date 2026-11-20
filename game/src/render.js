// Renderer/scene setup.

import * as THREE from 'three';
import {
	SKY_COLOR,SKY_ZENITH,SKY_HORIZON,SKY_BELOW,SUN_DIRECTION,SUN_COLOR,
	HAZE_COLOR,HAZE_NEAR,HAZE_FAR,TONE_EXPOSURE,CAMERA_FOV,
} from './config.js';

export function createRenderer(canvas) {
	const renderer=new THREE.WebGLRenderer({ canvas,antialias: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,1.5));
	renderer.shadowMap.enabled=true;
	renderer.shadowMap.type=THREE.PCFSoftShadowMap;

	renderer.outputColorSpace=THREE.SRGBColorSpace;
	renderer.toneMapping=THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure=TONE_EXPOSURE;
	return renderer;
}

const SKY_VERTEX=`
varying vec3 vDirection;
void main() {
vDirection = normalize(position);
vec4 mv = modelViewMatrix * vec4(position, 1.0);
gl_Position = projectionMatrix * mv;
}
`;

const SKY_FRAGMENT=`
varying vec3 vDirection;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uBelow;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
void main() {
vec3 dir = normalize(vDirection);
float h = clamp(dir.y, -1.0, 1.0);
vec3 sky = h >= 0.0
? mix(uHorizon, uZenith, pow(h, 0.52))
: mix(uHorizon, uBelow, pow(-h, 0.65));
float sunAmount = max(dot(dir, normalize(uSunDirection)), 0.0);
sky += uSunColor * pow(sunAmount, 220.0) * 1.35;
sky += uSunColor * pow(sunAmount, 10.0) * 0.34;
sky += uSunColor * pow(sunAmount, 2.6) * 0.13;
if (h > 0.02) {
vec2 sp = dir.xz / (dir.y + 0.18);
float bands = sin(sp.y * 3.1 + sin(sp.x * 1.7) * 0.9) * 0.62
+ sin(sp.y * 7.3 - sp.x * 2.3) * 0.38;
float cloud = smoothstep(0.36, 0.92, bands) * smoothstep(0.85, 0.28, h) * step(0.02, h);
vec3 cloudColor = mix(vec3(0.62, 0.42, 0.44), vec3(1.05, 0.72, 0.5), pow(sunAmount, 2.0));
sky = mix(sky, cloudColor, cloud * 0.48);
}
gl_FragColor = vec4(sky, 1.0);
}
`;

export function createSkyDome() {
	const material=new THREE.ShaderMaterial({
		vertexShader: SKY_VERTEX,
		fragmentShader: SKY_FRAGMENT,
		uniforms: {
			uZenith: { value: new THREE.Color(SKY_ZENITH) },
			uHorizon: { value: new THREE.Color(SKY_HORIZON) },
			uBelow: { value: new THREE.Color(SKY_BELOW) },
			uSunDirection: { value: new THREE.Vector3(...SUN_DIRECTION).normalize() },
			uSunColor: { value: new THREE.Color(SUN_COLOR) },
		},
		side: THREE.BackSide,
		depthWrite: false,
		fog: false,
	});
	const dome=new THREE.Mesh(new THREE.SphereGeometry(300,28,16),material);
	dome.renderOrder=-10;
	dome.frustumCulled=false;
	return dome;
}

export function createScene() {
	const scene=new THREE.Scene();
	scene.background=new THREE.Color(SKY_COLOR);
	scene.add(createSkyDome());
	scene.fog=new THREE.Fog(HAZE_COLOR,HAZE_NEAR,HAZE_FAR);
	return scene;
}

export function createCamera() {

	return new THREE.PerspectiveCamera(CAMERA_FOV,16 / 9,0.1,340);
}
