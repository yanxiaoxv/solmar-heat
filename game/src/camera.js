// Third-person camera: mouse orbit, eased.
// pin it to an exact pose.

import * as THREE from 'three';

export class FollowCamera {
	constructor(camera) {
		this.camera=camera;
		this.yaw=Math.PI;
		this.pitch=0.32;
		this.distance=8.5;
		this.targetPos=new THREE.Vector3();
		this.smoothed=new THREE.Vector3(0,6,14);
		this.pinned=null;
	}

	orbit(dx,dy) {
		this.yaw -= dx * 0.0032;
		this.pitch=Math.max(0.06,Math.min(1.15,this.pitch + dy * 0.0026));
	}

	pin(position,lookAt) {
		this.pinned={ position,lookAt };
	}

	update(dt,focus,driving,colliders=null) {
		if (this.pinned) {
			this.camera.position.copy(this.pinned.position);
			this.camera.lookAt(this.pinned.lookAt);
			return;
		}
		const distance=driving ? 10.5 : this.distance;
		const height=driving ? 3.4 : 2.2 + this.pitch * 6.5;
		const back=new THREE.Vector3(
			focus.x + Math.sin(this.yaw) * Math.cos(this.pitch) * distance,
			focus.y + height,
			focus.z + Math.cos(this.yaw) * Math.cos(this.pitch) * distance,
		);
		back.y=Math.max(1.1,back.y);
		if (colliders) {

			const dx=back.x - focus.x;
			const dz=back.z - focus.z;
			const total=Math.hypot(dx,dz);
			const steps=Math.max(1,Math.ceil(total / 0.6));
			for (let i=0; i <= steps; i += 1) {
				const t=1 - i / steps;
				const tx=focus.x + dx * t;
				const tz=focus.z + dz * t;
				let inside=false;
				if (total * t > 2) {
					for (const box of colliders) {
						if (tx > box.minX - 0.6 && tx < box.maxX + 0.6 && tz > box.minZ - 0.6 && tz < box.maxZ + 0.6) {
							inside=true;
							break;
						}
					}
				}
				if (!inside) {
					back.x=tx;
					back.z=tz;
					break;
				}
			}
		}
		const blend=Math.min(1,dt * (driving ? 4.2 : 6.5));
		this.smoothed.lerp(back,blend);
		this.camera.position.copy(this.smoothed);
		this.targetPos.set(focus.x,focus.y + 1.6,focus.z);
		this.camera.lookAt(this.targetPos);
	}

	snapBehind(heading) {

		this.yaw=heading + Math.PI;
	}

	alignBehind(heading,dt,strength=1.6) {

		const target=heading + Math.PI;
		let diff=target - this.yaw;
		while (diff > Math.PI) diff -= Math.PI * 2;
		while (diff < -Math.PI) diff += Math.PI * 2;
		this.yaw += diff * Math.min(1,dt * strength);
	}
}
