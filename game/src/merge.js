// Geometry merging: parts baked into single meshes.

import * as THREE from 'three';

export function mergeGeometries(geometries) {
	const parts=geometries.map((g) => (g.index ? g.toNonIndexed() : g));
	const coloured=parts[0].attributes.color !== undefined;
	let vertexCount=0;
	for (const part of parts) vertexCount += part.attributes.position.count;
	const position=new Float32Array(vertexCount * 3);
	const normal=new Float32Array(vertexCount * 3);
	const uv=new Float32Array(vertexCount * 2);
	const color=coloured ? new Float32Array(vertexCount * 3) : null;
	let offset=0;
	for (const part of parts) {
		position.set(part.attributes.position.array,offset * 3);
		normal.set(part.attributes.normal.array,offset * 3);
		uv.set(part.attributes.uv.array,offset * 2);
		if (coloured) color.set(part.attributes.color.array,offset * 3);
		offset += part.attributes.position.count;
	}
	const merged=new THREE.BufferGeometry();
	merged.setAttribute('position',new THREE.BufferAttribute(position,3));
	merged.setAttribute('normal',new THREE.BufferAttribute(normal,3));
	merged.setAttribute('uv',new THREE.BufferAttribute(uv,2));
	if (coloured) merged.setAttribute('color',new THREE.BufferAttribute(color,3));
	return merged;
}

export function paintParts(geometry,hex) {
	const tint=new THREE.Color(hex);
	const count=geometry.attributes.position.count;
	const array=new Float32Array(count * 3);
	for (let i=0; i < count; i += 1) {
		array[i * 3]=tint.r;
		array[i * 3 + 1]=tint.g;
		array[i * 3 + 2]=tint.b;
	}
	geometry.setAttribute('color',new THREE.BufferAttribute(array,3));
	return geometry;
}
