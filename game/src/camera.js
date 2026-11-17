// Third-person camera for Solmar Heat: it orbits behind the player with the
// mouse, eases toward its target instead of snapping, pulls in when a wall
// would block the view, and switches to a lower, wider chase framing when
// driving. Screenshot staging can pin it to an exact pose.

import * as THREE from 'three';

export class FollowCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = Math.PI;
    this.pitch = 0.32;
    this.distance = 8.5;
    this.targetPos = new THREE.Vector3();
    this.smoothed = new THREE.Vector3(0, 6, 14);
    this.pinned = null;
  }

  orbit(dx, dy) {
    this.yaw -= dx * 0.0032;
    this.pitch = Math.max(0.06, Math.min(1.15, this.pitch + dy * 0.0026));
  }

  pin(position, lookAt) {
    this.pinned = { position, lookAt };
  }

  unpin() {
    this.pinned = null;
  }

  update(dt, focus, driving) {
    if (this.pinned) {
      this.camera.position.copy(this.pinned.position);
      this.camera.lookAt(this.pinned.lookAt);
      return;
    }
    const distance = driving ? 10.5 : this.distance;
    const height = driving ? 3.4 : 2.2 + this.pitch * 6.5;
    const back = new THREE.Vector3(
      focus.x + Math.sin(this.yaw) * Math.cos(this.pitch) * distance,
      focus.y + height,
      focus.z + Math.cos(this.yaw) * Math.cos(this.pitch) * distance,
    );
    back.y = Math.max(1.1, back.y);
    const blend = Math.min(1, dt * (driving ? 4.2 : 6.5));
    this.smoothed.lerp(back, blend);
    this.camera.position.copy(this.smoothed);
    this.targetPos.set(focus.x, focus.y + 1.6, focus.z);
    this.camera.lookAt(this.targetPos);
  }

  snapBehind(heading) {
    // When entering a car or starting a scene, start the orbit behind the actor.
    this.yaw = heading + Math.PI;
  }
}
