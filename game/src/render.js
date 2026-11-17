// Renderer and scene setup for Solmar Heat: the WebGL renderer with soft
// shadows and warm filmic tone mapping, plus the scene's sky colour and bay
// haze. Kept apart from the boot code so main.js only orchestrates.

import * as THREE from 'three';
import { SKY_COLOR, HAZE_COLOR, HAZE_NEAR, HAZE_FAR, TONE_EXPOSURE, CAMERA_FOV } from './config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = TONE_EXPOSURE;
  return renderer;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_COLOR);
  scene.fog = new THREE.Fog(HAZE_COLOR, HAZE_NEAR, HAZE_FAR);
  return scene;
}

export function createCamera() {
  return new THREE.PerspectiveCamera(CAMERA_FOV, 16 / 9, 0.1, 600);
}
