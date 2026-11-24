// city.js — procedural geometry for the Solmar Bay city.
// Procedural Solmar Bay geometry; layout truth is network.js.

import * as THREE from 'three';
import { createSeededRandom,rangeValue } from './random.js';
import { mergeGeometries } from './merge.js';
import {
	ROADS,RIVER_LINE,RIVER_HALF,LAKE,CHANNEL,MALL,POOL,OBELISK,CIRCLES,BRIDGES,CELL_X,CELL_Z,
	boxClear,distToRoads,waterDist,lakeNorm,
} from './network.js';

export const CITY_HALF=220;
export const ROAD_X=[-198,-100,-72,-18,16,58,92,130,156,202];
export const ROAD_Z=[-158,-58,24];

const BUILDING_PALETTE=[0xf2d8a7,0xb3271e,0xd96a4a,0xf5efe0,0xc94f3d,0xe8b45a,0xf7c873,0xd9a441];
const ROOF_PALETTE=[0x8c3b2e,0x3f6b5f,0x2e4a5e,0x99785f];
const SIGN_NAMES=['茶樓','RAYO','HOTEL BRISA','金龍酒家','唐人街','福滿樓','夜市','藥房','金行','燒味','麵館','好運來'];
const SIGN_STYLES=[['#8c1d18','#ffd23f'],['#7a1f2b','#ffe9a8'],['#0f5f56','#ffe9a8'],['#40260a','#ffb35c'],['#5c1210','#ffdf6b'],['#2b0f0f','#ff6a3c']];
const HEIGHTS_PALETTE=[0x9aa3ad,0xb08d6a,0x8b93a5,0xc9a06a];
const OLDTOWN_PALETTE=[0xe08a6a,0xf2d8a7,0xc94f3d,0xe8c39a];

export const LANDMARKS=[
	{ id: 'marina',name: 'Solmar Marina',x: 22,z: 148 },
	{ id: 'plaza',name: 'Coral Plaza',x: -22,z: -22 },
	{ id: 'depot',name: 'Portside Depot',x: 110,z: 66 },
	{ id: 'hotel',name: 'Hotel Brisa',x: -66,z: 22 },
	{ id: 'garage',name: 'Rayo Garage',x: 66,z: -66 },
	{ id: 'heights',name: 'Heights Overlook',x: -44,z: -154 },
	{ id: 'oldtown',name: 'Old Town Plaza',x: 154,z: 44 },
];

export function districtAt(x,z) {
	if (z < -116) return 'Heights';
	if (z > 118) return 'Marina';
	if (x < -122) return 'Westbank';
	if (x > 122) return '唐人街 Old Town';
	if (lakeNorm(x,z) < 1.45) return 'Lake Solmar';
	if (x >= MALL.x0 && x <= MALL.x1 && z >= -36 && z <= -8) return '唐人街 The Mall';
	return '唐人街 Core';
}

export function pickRoadInBand(value,roads,minDist,maxDist) {
	const inBand=roads.filter((road) => {
		const d=Math.abs(road - value);
		return d >= minDist && d <= maxDist;
	});
	if (inBand.length) return inBand[Math.floor(Math.random() * inBand.length)];
	return roads.reduce((best,road) => (Math.abs(road - value) < Math.abs(best - value) ? road : best),roads[0]);
}

const ZONE_BOUNDS={
	core: { minX: -125,maxX: 125,minZ: -125,maxZ: 105 },
	north: { minX: -230,maxX: 230,minZ: -230,maxZ: -115 },
	west: { minX: -230,maxX: -122,minZ: -125,maxZ: 150 },
	east: { minX: 122,maxX: 230,minZ: -125,maxZ: 150 },
	south: { minX: -125,maxX: 125,minZ: 105,maxZ: 230 },
};
function zoneFor(x,z) {
	if (z < -115) return 'north';
	if (x < -122) return 'west';
	if (x > 122) return 'east';
	if (z > 105) return 'south';
	return 'core';
}

function seededRandom(seed) { return createSeededRandom(seed); }
function canvasTexture(width,height,painter,repeat) {
	const canvas=document.createElement('canvas');
	canvas.width=width;
	canvas.height=height;
	painter(canvas.getContext('2d'),width,height);
	const texture=new THREE.CanvasTexture(canvas);
	texture.colorSpace=THREE.SRGBColorSpace;
	texture.wrapS=THREE.RepeatWrapping;
	texture.wrapT=THREE.RepeatWrapping;
	if (repeat) texture.repeat.set(repeat[0],repeat[1]);
	texture.anisotropy=4;
	return texture;
}
function speckle(ctx,w,h,rand,count,size=2) {
	for (let i=0; i < count; i += 1) {
		ctx.fillStyle=rand() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.10)';
		ctx.fillRect(rand() * w,rand() * h,size,size);
	}
}
function groundPlane(w,d,x,y,z) {
	const geometry=new THREE.PlaneGeometry(w,d);
	geometry.rotateX(-Math.PI / 2);
	geometry.translate(x,y,z);
	return geometry;
}

function ribbonGeo(pts,width,y,vScale,loop=false) {
	const pos=[];
	const uv=[];
	const idx=[];
	const n=loop ? pts.length : pts.length - 1;
	let dist=0;
	const cum=[0];
	for (let i=1; i < pts.length; i += 1) { dist += Math.hypot(pts[i][0] - pts[i - 1][0],pts[i][1] - pts[i - 1][1]); cum.push(dist); }
	if (loop) dist += Math.hypot(pts[0][0] - pts[pts.length - 1][0],pts[0][1] - pts[pts.length - 1][1]);
	const rows=loop ? pts.length + 1 : pts.length;
	for (let i=0; i < rows; i += 1) {
		const p=pts[i % pts.length];
		const prev=pts[(i - 1 + pts.length) % pts.length];
		const next=pts[(i + 1) % pts.length];
		let dx=next[0] - prev[0];
		let dz=next[1] - prev[1];
		if (!loop && i === 0) { dx=pts[1][0] - p[0]; dz=pts[1][1] - p[1]; }
		if (!loop && i === pts.length - 1) { dx=p[0] - pts[i - 1][0]; dz=p[1] - pts[i - 1][1]; }
		const len=Math.hypot(dx,dz) || 1;
		const nx=-dz / len;
		const nz=dx / len;
		const v=(loop && i === pts.length ? dist : cum[Math.min(i,pts.length - 1)]) / vScale;
		pos.push(p[0] + nx * width / 2,y,p[1] + nz * width / 2,p[0] - nx * width / 2,y,p[1] - nz * width / 2);
		uv.push(0,v,1,v);
		if (i < rows - 1) {
			const a=i * 2;
			idx.push(a,a + 2,a + 1,a + 1,a + 2,a + 3);
		}
	}
	const geo=new THREE.BufferGeometry();
	geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pos),3));
	geo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(uv),2));
	geo.setIndex(idx);
	geo.computeVertexNormals();
	return geo;
}
function shapeGeo(shape,y) {
	const geo=new THREE.ShapeGeometry(shape,4);
	geo.rotateX(-Math.PI / 2);
	geo.translate(0,y,0);
	return geo;
}
function bankShape(half) {
	
	const left=[];
	const right=[];
	for (let i=0; i < RIVER_LINE.length; i += 1) {
		const p=RIVER_LINE[i];
		const prev=RIVER_LINE[Math.max(0,i - 1)];
		const next=RIVER_LINE[Math.min(RIVER_LINE.length - 1,i + 1)];
		let dx=next[0] - prev[0];
		let dz=next[1] - prev[1];
		const len=Math.hypot(dx,dz) || 1;
		dx/=len; dz/=len;
		left.push([p[0] - dz * half,-(p[1] + dx * half)]);
		right.push([p[0] + dz * half,-(p[1] - dx * half)]);
	}
	const shape=new THREE.Shape();
	shape.moveTo(left[0][0],left[0][1]);
	for (const p of left) shape.lineTo(p[0],p[1]);
	for (let i=right.length - 1; i >= 0; i -= 1) shape.lineTo(right[i][0],right[i][1]);
	shape.closePath();
	return shape;
}

function makeFacadeTexture(baseColor,seed) {
	return canvasTexture(120,512,(ctx,w,h) => {
		const rand=seededRandom(seed);
		const R=(x,y,rw,rh,style) => { ctx.fillStyle=style; ctx.fillRect(x,y,rw,rh); };
		R(0,0,w,h,baseColor);
		R(0,0,w,10,'rgba(255,255,255,0.10)');
		R(0,h - 30,w,30,'rgba(60,30,10,0.14)');
		R(0,0,9,h,'rgba(60,35,15,0.10)');
		R(w - 9,0,9,h,'rgba(60,35,15,0.10)');
		for (let i=0; i < 420; i += 1) R(rand() * w,rand() * h,2,2,`rgba(${rand() > 0.5 ? '255,255,255' : '40,30,20'},${0.03 + rand() * 0.05})`);
		for (let y=18; y < h - 40; y += 20) {
			R(0,y + 15,w,2,'rgba(70,45,25,0.24)');
			for (let x=5; x < w - 12; x += 24) {
				const roll=rand();
				const wx=x + (rand() - 0.5) * 2;
				if (roll < 0.26) {
					const warm=['#ffd98f','#ffc978','#ffe9b8','#ffb066'][Math.floor(rand() * 4)];
					R(wx,y,13,14,warm);
					R(wx + 6.2,y,0.8,14,'rgba(120,60,20,0.22)');
					R(wx,y + 6.7,13,0.8,'rgba(120,60,20,0.22)');
					if (rand() < 0.4) R(wx,y + 9,13,5,'rgba(255,246,220,0.5)');
				} else if (roll < 0.62) {
					R(wx,y,13,14,'#5b84a0');
					R(wx + 2,y,3,14,'rgba(255,255,255,0.30)');
				} else if (roll < 0.78) {
					R(wx,y,13,14,'#46606f');
					for (let s=0; s < 4; s += 1) R(wx,y + 2 + s * 3.4,13,1.6,'rgba(230,238,240,0.75)');
				} else {
					R(wx,y,13,14,'#2b3644');
				}
			}
		}
		R(0,h - 27,w,27,'rgba(96,20,16,0.95)');
		R(0,h - 27,w,2.5,'rgba(255,205,120,0.55)');
		for (let x=5; x < w - 16; x += 24) {
			const pane=ctx.createLinearGradient(0,h - 25,0,h - 3);
			pane.addColorStop(0,'#ffc978');
			pane.addColorStop(0.55,'#7a3a1d');
			pane.addColorStop(1,'#7a4a24');
			R(x,h - 24,17,21,pane);
			R(x,h - 24,17,3,'rgba(255,255,255,0.28)');
		}
	});
}
function makeSignTexture(text,background,foreground) {
	return canvasTexture(256,56,(ctx,w,h) => {
		ctx.fillStyle=background;
		ctx.fillRect(0,0,w,h);
		ctx.strokeStyle=foreground;
		ctx.lineWidth=3;
		ctx.strokeRect(4,4,w - 8,h - 8);
		ctx.fillStyle=foreground;
		ctx.font=`bold ${text.length > 7 ? 23 : 34}px Verdana, sans-serif`;
		ctx.textAlign='center';
		ctx.textBaseline='middle';
		ctx.shadowColor=foreground;
		ctx.shadowBlur=10;
		ctx.fillText(text,w / 2,h / 2 + 1);
	});
}
function makeAwningTexture(colorA,colorB) {
	return canvasTexture(64,32,(ctx,w,h) => {
		for (let x=0; x < w; x += 16) {
			ctx.fillStyle=colorA;
			ctx.fillRect(x,0,8,h);
			ctx.fillStyle=colorB;
			ctx.fillRect(x + 8,0,8,h);
		}
		ctx.fillStyle='rgba(0,0,0,0.13)';
		ctx.fillRect(0,h - 5,w,5);
	});
}

export function buildCity(scene,seed=7) {
	const rand=seededRandom(seed * 7919 + 13);
	const colliders=[];
	const group=new THREE.Group();
	scene.add(group);
	const animated={ boats: [] };
	const decor={ parks: [],lots: [] };

	const grassTexture=canvasTexture(128,128,(ctx,w,h) => {
		ctx.fillStyle='#69a357';
		ctx.fillRect(0,0,w,h);
		const r=seededRandom(41);
		for (let i=0; i < 1500; i += 1) {
			ctx.fillStyle=r() > 0.5 ? 'rgba(46,94,38,0.28)' : 'rgba(146,190,105,0.24)';
			ctx.fillRect(r() * w,r() * h,2.2,2.2);
		}
	},[64,64]);
	const ground=new THREE.Mesh(new THREE.PlaneGeometry(520,520),new THREE.MeshLambertMaterial({ map: grassTexture,color: 0xb9c6a9 }));
	ground.rotation.x=-Math.PI / 2;
	ground.position.y=-0.05;
	ground.receiveShadow=true;
	group.add(ground);

	
	const shoreMaterial=new THREE.MeshLambertMaterial({ color: 0xcbb27f });
	const waterMaterial=new THREE.MeshPhongMaterial({ color: 0x166d8f,specular: 0xffc37a,shininess: 110,transparent: true,opacity: 0.94 });
	const riverShore=new THREE.Mesh(shapeGeo(bankShape(RIVER_HALF + 3.4),0.006),shoreMaterial);
	riverShore.receiveShadow=true;
	group.add(riverShore);
	const riverWater=new THREE.Mesh(shapeGeo(bankShape(RIVER_HALF),0.03),waterMaterial);
	group.add(riverWater);
	function flatEllipse(cx,cz,rx,rz,y,material) {
		const shape=new THREE.Shape();
		shape.absellipse(cx,-cz,rx,rz,0,Math.PI * 2);
		const mesh=new THREE.Mesh(shapeGeo(shape,y),material);
		group.add(mesh);
		return mesh;
	}
	flatEllipse(LAKE.x,LAKE.z,LAKE.rx + 3.6,LAKE.rz + 3.6,0.006,shoreMaterial).receiveShadow=true;
	flatEllipse(LAKE.x,LAKE.z,LAKE.rx,LAKE.rz,0.03,waterMaterial);
	{
		const cw=CHANNEL.x1 - CHANNEL.x0;
		const cd=CHANNEL.z1 - CHANNEL.z0;
		const cx=(CHANNEL.x0 + CHANNEL.x1) / 2;
		const cz=(CHANNEL.z0 + CHANNEL.z1) / 2;
		const wat=new THREE.Mesh(groundPlane(cw,cd,cx,0.03,cz),waterMaterial);
		group.add(wat);
	}

	
	const roadMaterial=new THREE.MeshLambertMaterial({ map: canvasTexture(128,128,(ctx,w,h) => {
		ctx.fillStyle='#3a3f46';
		ctx.fillRect(0,0,w,h);
		const r=seededRandom(53);
		speckle(ctx,w,h,r,1500,1.6);
		ctx.fillStyle='#e9e6da';
		ctx.fillRect(3,0,3,h);
		ctx.fillRect(w - 6,0,3,h);
		ctx.fillStyle='#f5c542';
		ctx.fillRect(w / 2 - 5,0,3.4,h);
		ctx.fillRect(w / 2 + 1.6,0,3.4,h);
		ctx.fillStyle='rgba(233,230,218,0.9)';
		for (let y=4; y < h; y += 32) {
			ctx.fillRect(w * 0.25 - 1.5,y,3,17);
			ctx.fillRect(w * 0.75 - 1.5,y,3,17);
		}
	}) });
	const sidewalkTexture=canvasTexture(64,64,(ctx,w,h) => {
		ctx.fillStyle='#cfc6b2';
		ctx.fillRect(0,0,w,h);
		const sr=seededRandom(11);
		for (const [qx,qy] of [[0,0],[32,0],[0,32],[32,32]]) {
			ctx.fillStyle=`rgba(${sr() > 0.5 ? '255,250,235' : '90,80,60'},${0.05 + sr() * 0.06})`;
			ctx.fillRect(qx,qy,32,32);
		}
		speckle(ctx,w,h,seededRandom(7),520,1.5);
		ctx.fillStyle='rgba(96,88,72,0.7)';
		ctx.fillRect(0,0,w,2);
		ctx.fillRect(0,31,w,1.6);
		ctx.fillRect(0,0,3,h);
		ctx.fillRect(31,0,1.6,h);
		ctx.fillRect(w - 3,0,3,h);
	});
	const walkMaterial=new THREE.MeshLambertMaterial({ map: sidewalkTexture });
	const asphaltGeos=[];
	const walkGeos=[];
	for (const road of ROADS) {
		asphaltGeos.push(ribbonGeo(road.pts,road.w,0.04,13,road.loop));
		walkGeos.push(ribbonGeo(road.pts,road.w + 5,0.026,2.7,road.loop));
	}

	const vxRoads=ROADS.filter((r) => r.id.startsWith('vx'));
	const hzRoads=ROADS.filter((r) => r.id.startsWith('hz'));
	for (const [geos,material] of [[walkGeos,walkMaterial],[asphaltGeos,roadMaterial]]) {
		if (!geos.length) continue;
		const mesh=new THREE.Mesh(mergeGeometries(geos),material);
		mesh.receiveShadow=true;
		group.add(mesh);
	}
	
	const lawnMaterial=new THREE.MeshLambertMaterial({ map: grassTexture,color: 0x9fb894 });
	for (const c of CIRCLES) {
		const island=new THREE.Mesh(new THREE.CircleGeometry(c.r - c.w / 2 - 0.2,24),lawnMaterial);
		island.rotation.x=-Math.PI / 2;
		island.position.set(c.x,0.05,c.z);
		island.receiveShadow=true;
		group.add(island);
	}

	
	const concreteMaterial=new THREE.MeshLambertMaterial({ color: 0xa49a89 });
	const girderMaterial=new THREE.MeshLambertMaterial({ color: 0x5d6a72 });
	{
		const decks=[];
		const rails=[];
		const piers=[];
		for (const b of BRIDGES) {
			const len=b.to - b.from;
			const mid=(b.from + b.to) / 2;
			const horiz=b.axis === 'x';
			const deck=new THREE.BoxGeometry(horiz ? len : 18,0.5,horiz ? 18 : len);
			deck.translate(horiz ? mid : b.at,-0.215,horiz ? b.at : mid);
			decks.push(deck);
			for (const side of [-1,1]) {
				const rail=new THREE.BoxGeometry(horiz ? len : 0.35,0.55,horiz ? 0.35 : len);
				rail.translate(horiz ? mid : b.at + side * 8.2,0.3,horiz ? b.at + side * 8.2 : mid);
				rails.push(rail);
			}
			for (const f of [0.3,0.7]) {
				const pier=new THREE.CylinderGeometry(0.8,0.95,1.6,9);
				pier.translate(horiz ? b.from + len * f : b.at,-0.7,horiz ? b.at : b.from + len * f);
				piers.push(pier);
			}
		}
		for (const [geos,material,shadow] of [[decks,concreteMaterial,true],[rails,girderMaterial,false],[piers,concreteMaterial,false]]) {
			const mesh=new THREE.Mesh(mergeGeometries(geos),material);
			mesh.castShadow=shadow;
			mesh.receiveShadow=true;
			group.add(mesh);
		}
	}

	
	{
		const lawn=new THREE.Mesh(new THREE.PlaneGeometry(MALL.x1 - OBELISK.x + 14,MALL.z1 - MALL.z0),lawnMaterial);
		lawn.rotation.x=-Math.PI / 2;
		lawn.position.set((OBELISK.x - 14 + MALL.x1) / 2,0.032,(MALL.z0 + MALL.z1) / 2);
		lawn.receiveShadow=true;
		group.add(lawn);
		const gravel=new THREE.Mesh(new THREE.PlaneGeometry(MALL.x1 - OBELISK.x + 10,5.4),new THREE.MeshLambertMaterial({ color: 0xd8c49a }));
		gravel.rotation.x=-Math.PI / 2;
		gravel.position.set((OBELISK.x - 10 + MALL.x1) / 2,0.036,-22);
		gravel.receiveShadow=true;
		group.add(gravel);
		const pool=new THREE.Mesh(groundPlane(POOL.x1 - POOL.x0,POOL.z1 - POOL.z0,(POOL.x0 + POOL.x1) / 2,0.042,(POOL.z0 + POOL.z1) / 2),new THREE.MeshPhongMaterial({ color: 0x2e7ea6,specular: 0xffd9a0,shininess: 120 }));
		group.add(pool);
		
		const stone=new THREE.MeshLambertMaterial({ color: 0xe8ddc4 });
		const base=new THREE.Mesh(new THREE.BoxGeometry(3.6,1.1,3.6),stone);
		base.position.set(OBELISK.x,0.55,OBELISK.z);
		base.castShadow=true;
		group.add(base);
		const spire=new THREE.Mesh(new THREE.CylinderGeometry(0.32,1.05,23,4),stone);
		spire.rotation.y=Math.PI / 4;
		spire.position.set(OBELISK.x,12.6,OBELISK.z);
		spire.castShadow=true;
		group.add(spire);
		colliders.push({ minX: OBELISK.x - 1.8,maxX: OBELISK.x + 1.8,minZ: OBELISK.z - 1.8,maxZ: OBELISK.z + 1.8 });
		
		const wall=new THREE.MeshLambertMaterial({ map: makeFacadeTexture('#e9e2d2',777) });
		const tiers=[[36,9,24,0],[28,6.5,18,9],[19,5,12.5,15.5]];
		for (const [tw,th,td,ty] of tiers) {
			const tierMesh=new THREE.Mesh(new THREE.BoxGeometry(tw,th,td),wall);
			tierMesh.position.set(114,ty + th / 2,-22);
			tierMesh.castShadow=true;
			tierMesh.receiveShadow=true;
			group.add(tierMesh);
		}
		const dome=new THREE.Mesh(new THREE.SphereGeometry(6.4,18,10,0,Math.PI * 2,0,Math.PI / 2),new THREE.MeshLambertMaterial({ color: 0x3f7d8c }));
		dome.position.set(114,20.5,-22);
		dome.castShadow=true;
		group.add(dome);
		colliders.push({ minX: 96,maxX: 132,minZ: -34,maxZ: -10 });
		
		const basin=new THREE.Mesh(new THREE.CylinderGeometry(3.4,3.6,0.7,16),concreteMaterial);
		basin.position.set(127,0.35,-116);
		group.add(basin);
		colliders.push({ minX: 123.4,maxX: 130.6,minZ: -119.6,maxZ: -112.4 });
	}

	
	const roofMaterialCache=ROOF_PALETTE.map((color) => new THREE.MeshLambertMaterial({ color }));
	const tankMaterial=new THREE.MeshLambertMaterial({ color: 0xb4b9c0 });
	const acMaterial=new THREE.MeshLambertMaterial({ color: 0x878e99 });
	const tankGeometry=new THREE.CylinderGeometry(0.85,0.85,1.7,10);
	const tankTopGeometry=new THREE.ConeGeometry(0.98,0.55,10);
	const acGeometry=new THREE.BoxGeometry(1.5,0.72,1.1);
	const antennaMaterial=new THREE.MeshLambertMaterial({ color: 0x3c4148 });
	const antennaGeometry=new THREE.CylinderGeometry(0.05,0.07,3.6,5);
	const awningMaterials=[
		new THREE.MeshLambertMaterial({ map: makeAwningTexture('#b3271e','#ffd23f') }),
		new THREE.MeshLambertMaterial({ map: makeAwningTexture('#0f7f8c','#f5efe0') }),
		new THREE.MeshLambertMaterial({ map: makeAwningTexture('#e8a13a','#8c1d18') }),
	];
	const gateRed=new THREE.MeshLambertMaterial({ color: 0xa8231a });
	const gateGold=new THREE.MeshLambertMaterial({ color: 0xe0aa3e });
	const signMaterials=SIGN_NAMES.map((name,i) => {
		const [bg,fg]=SIGN_STYLES[i % SIGN_STYLES.length];
		return new THREE.MeshBasicMaterial({ map: makeSignTexture(name,bg,fg) });
	});
	const sideMaterialCache=new Map();
	function sideMaterialFor(palette,paletteIndex,variant) {
		const key=`${palette[0]}:${paletteIndex}:${variant}`;
		if (!sideMaterialCache.has(key)) {
			const base=`#${palette[paletteIndex].toString(16).padStart(6,'0')}`;
			const seedBase=palette === BUILDING_PALETTE ? 1000 : palette === HEIGHTS_PALETTE ? 3000 : 5000;
			sideMaterialCache.set(key,new THREE.MeshLambertMaterial({ map: makeFacadeTexture(base,seedBase + paletteIndex * 37 + variant * 101) }));
		}
		return sideMaterialCache.get(key);
	}
	const staticBuckets=new Map();
	const zoneMeshes={ core: [],north: [],west: [],east: [],south: [] };
	let currentZone='core';
	function bucketGeo(material,geometry,cast=false,receive=false) {
		const key=`${currentZone}|${material.uuid}|${cast ? 1 : 0}|${receive ? 1 : 0}`;
		if (!staticBuckets.has(key)) staticBuckets.set(key,{ zone: currentZone,material,cast,receive,geos: [] });
		staticBuckets.get(key).geos.push(geometry);
	}
	function bucketBox(material,w,h,d,x,y,z,opts={}) {
		const geo=new THREE.BoxGeometry(w,h,d);
		if (opts.rx) geo.rotateX(opts.rx);
		if (opts.rz) geo.rotateZ(opts.rz);
		if (opts.ry) geo.rotateY(opts.ry);
		geo.translate(x,y,z);
		bucketGeo(material,geo,opts.cast,opts.receive);
	}
	function addTowerShell(w,h,d,cx,baseY,cz,sideMaterial,roofMaterial) {
		const faces=[
			[w,cx,cz + d / 2,0,w],
			[w,cx,cz - d / 2,Math.PI,w],
			[d,cx + w / 2,cz,Math.PI / 2,d],
			[d,cx - w / 2,cz,-Math.PI / 2,d],
		];
		for (const [fw,fx,fz,ry,fwidth] of faces) {
			const face=new THREE.PlaneGeometry(fw,h);
			const uv=face.attributes.uv;
			for (let i=0; i < uv.count; i += 1) uv.setXY(i,uv.getX(i) * (fwidth / 13),uv.getY(i) * (h / 68));
			face.rotateY(ry);
			face.translate(fx,baseY + h / 2,fz);
			bucketGeo(sideMaterial,face,true,true);
		}
		const top=new THREE.PlaneGeometry(w,d);
		top.rotateX(-Math.PI / 2);
		top.translate(cx,baseY + h,cz);
		bucketGeo(roofMaterial,top,true,false);
	}
	function flushBuckets() {
		for (const bucket of staticBuckets.values()) {
			const mesh=new THREE.Mesh(mergeGeometries(bucket.geos),bucket.material);
			mesh.castShadow=bucket.cast;
			mesh.receiveShadow=bucket.receive;
			mesh.userData.zone=bucket.zone;
			mesh.userData.casts=bucket.cast;
			group.add(mesh);
			zoneMeshes[bucket.zone].push(mesh);
		}
		staticBuckets.clear();
	}
	const benchMaterial=new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
	const lotMaterial=new THREE.MeshLambertMaterial({ color: 0x4a4d52 });
	function landmarkClear(minX,maxX,minZ,maxZ) {
		for (const lm of LANDMARKS) {
			const nx=Math.max(minX,Math.min(lm.x,maxX));
			const nz=Math.max(minZ,Math.min(lm.z,maxZ));
			if (Math.hypot(lm.x - nx,lm.z - nz) < 12.5) return false;
		}
		return true;
	}
	function buildTower(sx0,sx1,sz0,sz1,style) {
		const palette=style === 'heights' ? HEIGHTS_PALETTE : style === 'oldtown' ? OLDTOWN_PALETTE : BUILDING_PALETTE;
		const subW=sx1 - sx0;
		const subD=sz1 - sz0;
		const w=Math.min(style === 'oldtown' ? rangeValue(rand,9,14) : rangeValue(rand,11,18),subW - 3);
		const d=Math.min(style === 'oldtown' ? rangeValue(rand,9,14) : rangeValue(rand,11,18),subD - 3);
		if (w < 7 || d < 7) return false;
		const ccx=(sx0 + sx1) / 2;
		const ccz=(sz0 + sz1) / 2;
		const tries=[
			[ccx + (rand() - 0.5) * Math.min(6,subW * 0.24),ccz + (rand() - 0.5) * Math.min(6,subD * 0.24)],
			[ccx,ccz],
			[sx0 + subW * 0.27,sz0 + subD * 0.27],
			[sx0 + subW * 0.73,sz0 + subD * 0.73],
		];
		let tx=0;
		let tz=0;
		let placed=false;
		for (const [candX,candZ] of tries) {
			const px=Math.max(sx0 + w / 2 + 0.7,Math.min(sx1 - w / 2 - 0.7,candX));
			const pz=Math.max(sz0 + d / 2 + 0.7,Math.min(sz1 - d / 2 - 0.7,candZ));
			if (boxClear(px - w / 2,px + w / 2,pz - d / 2,pz + d / 2,2.2) && landmarkClear(px - w / 2,px + w / 2,pz - d / 2,pz + d / 2)) {
				tx=px;
				tz=pz;
				placed=true;
				break;
			}
		}
		if (!placed) return false;
		const heightRoll=rand();
		let h;
		if (style === 'heights') h=30 + rand() * 28;
		else if (style === 'oldtown') h=8 + rand() * 8;
		else h=heightRoll < 0.3 ? 9 + rand() * 7 : heightRoll < 0.8 ? 18 + rand() * 16 : 36 + rand() * 20;
		if (Math.abs(tx) < 30 && Math.abs(tz) < 30) h += 10;
		const minX=tx - w / 2;
		const maxX=tx + w / 2;
		const minZ=tz - d / 2;
		const maxZ=tz + d / 2;
		currentZone=zoneFor(tx,tz);
		const sideMaterial=sideMaterialFor(palette,Math.floor(rand() * palette.length),Math.floor(rand() * 4));
		const roofMaterial=style === 'oldtown' && rand() < 0.6 ? roofMaterialCache[0] : roofMaterialCache[Math.floor(rand() * roofMaterialCache.length)];
		addTowerShell(w,h,d,tx,0,tz,sideMaterial,roofMaterial);
		colliders.push({ minX,maxX,minZ,maxZ });
		bucketBox(concreteMaterial,w + 0.5,1.0,d + 0.5,tx,0.5,tz,{ receive: true });
		bucketBox(roofMaterial,w + 0.35,0.24,d + 0.35,tx,h + 0.12,tz,{ cast: true });
		if (h > 36) {
			const tierH=5 + rand() * 6;
			addTowerShell(w * 0.62,tierH,d * 0.62,tx + (rand() - 0.5) * 2,h,tz + (rand() - 0.5) * 2,sideMaterial,roofMaterial);
		}
		if (rand() < 0.55) {
			const acGeo=acGeometry.clone();
			acGeo.rotateY(rand() * Math.PI);
			acGeo.translate(tx + (rand() - 0.5) * (w - 4),h + 0.6,tz + (rand() - 0.5) * (d - 4));
			bucketGeo(acMaterial,acGeo,true);
		}
		if (rand() < 0.34) {
			const drumGeo=tankGeometry.clone();
			drumGeo.translate(tx + (rand() - 0.5) * (w - 5),h + 1.05,tz + (rand() - 0.5) * (d - 5));
			bucketGeo(tankMaterial,drumGeo,true);
			const capGeo=tankTopGeometry.clone();
			capGeo.translate(tx + (rand() - 0.5) * (w - 5),h + 2.15,tz + (rand() - 0.5) * (d - 5));
			bucketGeo(roofMaterial,capGeo);
		}
		if (h > 30 && rand() < 0.6) {
			const antGeo=antennaGeometry.clone();
			antGeo.translate(tx + (rand() - 0.5) * (w - 3),h + 1.8,tz + (rand() - 0.5) * (d - 3));
			bucketGeo(antennaMaterial,antGeo);
		}
		if (h < 40 && rand() < (style === 'oldtown' ? 0.85 : 0.86)) {
			const signMaterial=signMaterials[Math.floor(rand() * signMaterials.length)];
			const awningMaterial=awningMaterials[Math.floor(rand() * awningMaterials.length)];
			const west=rand() < 0.5;
			const face=west ? w / 2 : d / 2;
			const front=[
				[new THREE.PlaneGeometry(5.6,1.15),signMaterial,0,3.5,face + 0.07],
				[new THREE.BoxGeometry(6.2,0.09,2.3),awningMaterial,0,2.78,face + 1.05],
				[new THREE.BoxGeometry(6.2,0.14,0.14),gateGold,0,2.2,face + 2.12],
			];
			for (const [geo,mat,gx,gy,gz] of front) {
				geo.translate(gx,gy,gz);
				if (west) geo.rotateY(-Math.PI / 2);
				geo.translate(tx,0,tz);
				bucketGeo(mat,geo);
			}
			for (const s of [-2.9,2.9]) {
				const pillarGeo=new THREE.BoxGeometry(0.13,2.78,0.13);
				pillarGeo.translate(s,1.39,face + 2.05);
				if (west) pillarGeo.rotateY(-Math.PI / 2);
				pillarGeo.translate(tx,0,tz);
				bucketGeo(gateRed,pillarGeo,true);
			}
		}
		return true;
	}
	const parkRects=[];
	for (let i=0; i < CELL_X.length - 1; i += 1) {
		for (let j=0; j < CELL_Z.length - 1; j += 1) {
			const x0=CELL_X[i] + 8;
			const x1=CELL_X[i + 1] - 8;
			const z0=CELL_Z[j] + 8;
			const z1=CELL_Z[j + 1] - 8;
			if (x1 - x0 < 9 || z1 - z0 < 9) continue;
			const cx=(x0 + x1) / 2;
			const cz=(z0 + z1) / 2;
			if (cz > 116) continue;
			if (cx > 88 && cx < 140 && cz > -40 && cz < -4) continue;
			const style=cz <= -137 ? 'heights' : (cx > 139 || cx < -149) ? 'oldtown' : 'core';
			const roll=rand();
			currentZone=zoneFor(cx,cz);
			if (roll < 0.12 && x1 - x0 > 20 && z1 - z0 > 18) {
				const lawn=new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0,z1 - z0),lawnMaterial);
				lawn.rotation.x=-Math.PI / 2;
				lawn.position.set(cx,0.04,cz);
				lawn.receiveShadow=true;
				group.add(lawn);
				parkRects.push({ x0,z0,x1,z1 });
				decor.parks.push({ x0,z0,x1,z1 });
				for (const [ox,oz] of [[-7,5],[8,-6],[3,9]]) {
					if (cx + ox > x0 + 2 && cx + ox < x1 - 2 && cz + oz > z0 + 2 && cz + oz < z1 - 2) {
						bucketBox(benchMaterial,2.2,0.12,0.55,cx + ox,0.5,cz + oz);
						bucketBox(benchMaterial,2.2,0.5,0.1,cx + ox,0.85,cz + oz - 0.26);
					}
				}
				continue;
			}
			if (roll < 0.21) {
				const lot=new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0,z1 - z0),lotMaterial);
				lot.rotation.x=-Math.PI / 2;
				lot.position.set(cx,0.035,cz);
				lot.receiveShadow=true;
				group.add(lot);
				decor.lots.push({ x0,z0,x1,z1 });
				continue;
			}
			const cols=x1 - x0 > 46 ? 2 : 1;
			const rows=z1 - z0 > 40 ? 2 : 1;
			for (let a=0; a < cols; a += 1) {
				for (let b=0; b < rows; b += 1) {
					if (rand() < 0.2) continue;
					const sx0=x0 + (x1 - x0) * (a / cols);
					const sx1=x0 + (x1 - x0) * ((a + 1) / cols);
					const sz0=z0 + (z1 - z0) * (b / rows);
					const sz1=z0 + (z1 - z0) * ((b + 1) / rows);
					buildTower(sx0,sx1,sz0,sz1,style);
				}
			}
		}
	}
	currentZone='core';
	{
		const isl=new THREE.CylinderGeometry(5,5.6,0.5,12);
		isl.translate(LAKE.x,0.25,LAKE.z);
		bucketGeo(shoreMaterial,isl,false,true);
		for (const [px,pz] of [[-3,-3],[3,-3],[-3,3],[3,3]]) bucketBox(gateRed,0.28,2.6,0.28,LAKE.x + px,1.8,LAKE.z + pz,{ cast: true });
		bucketBox(gateGold,7.6,0.3,7.6,LAKE.x,3.25,LAKE.z,{ cast: true });
		const proof=new THREE.ConeGeometry(5.6,2.2,4);
		proof.rotateY(Math.PI / 4);
		proof.translate(LAKE.x,4.5,LAKE.z);
		bucketGeo(roofMaterialCache[0],proof,true);
		colliders.push({ minX: LAKE.x - 5,maxX: LAKE.x + 5,minZ: LAKE.z - 5,maxZ: LAKE.z + 5 });
	}
	function addGate(x) {
		for (const s of [-7.2,7.2]) {
			bucketBox(gateRed,0.55,4.6,0.55,x,2.3,-22 + s,{ cast: true });
			bucketBox(gateGold,0.85,0.45,0.85,x,4.8,-22 + s);
			colliders.push({ minX: x - 0.5,maxX: x + 0.5,minZ: -22.5 + s,maxZ: -21.5 + s });
		}
		bucketBox(gateRed,0.7,0.55,16.4,x,4.3,-22,{ cast: true });
		bucketBox(gateGold,1.15,0.38,12.6,x,5.45,-22,{ cast: true });
		bucketBox(roofMaterialCache[1],1.8,0.28,15.2,x,6.05,-22,{ cast: true });
		bucketBox(roofMaterialCache[1],2.3,0.22,17.8,x,6.62,-22,{ cast: true });
	}
	addGate(-86);
	addGate(78);
	for (const gx of [-86,78]) {
		for (const s of [1,-1]) {
			const gp=new THREE.PlaneGeometry(7.5,1.5);
			gp.rotateY(s * Math.PI / 2);
			gp.translate(gx,4.32,-22);
			bucketGeo(signMaterials[4],gp);
		}
	}
	const streetSigns=[['唐人街大道 CHINATOWN AVE',52,-30.5,0],['中央綠軸 MALL WALK',-70,-15.5,0],['斜陽大道 SUNSET DIAG',40,62,-2.03],];
	for (const [text,sx,sz,ry] of streetSigns) {
		const smat=new THREE.MeshBasicMaterial({ map: makeSignTexture(text,'#123a2c','#ffe9a8'),side: THREE.DoubleSide });
		const sp=new THREE.PlaneGeometry(6.4,1.35);
		sp.rotateY(ry);
		sp.translate(sx,4.5,sz);
		bucketGeo(smat,sp);
		bucketBox(antennaMaterial,0.09,4.5,0.09,sx - Math.cos(ry) * 3.2,2.25,sz + Math.sin(ry) * 3.2);
	}
	const lanternPts=[];
	function lanternRow(x0,z0,x1,z1,n,y) {
		for (let i=0; i < n; i += 1) {
			const t=n === 1 ? 0.5 : i / (n - 1);
			lanternPts.push([x0 + (x1 - x0) * t,y - Math.sin(t * Math.PI) * 0.45,z0 + (z1 - z0) * t]);
		}
	}
	for (const r of [[-86,-43,-86,1,15,5.9],[78,-43,78,1,15,5.9],[-18,-196,-18,112,26,6.1],[58,-112,58,60,22,6.1],[-212,24,228,24,30,6.1],[-212,-58,228,-58,30,6.1],[-96,-36,88,-36,16,6.0]]) lanternRow(...r);
	for (let i=0; i < 6; i += 1) {
		const sx=-70 + i * 20;
		bucketBox(benchMaterial,2.6,1.05,1.5,sx,0.53,-29.9,{ cast: true });
		bucketBox(awningMaterials[i % 3],3.1,0.09,2.2,sx,2.5,-29.9,{ cast: true });
		for (const s of [-1.4,1.4]) bucketBox(gateRed,0.11,2.5,0.11,sx + s,1.25,-29.05);
		colliders.push({ minX: sx - 1.3,maxX: sx + 1.3,minZ: -30.7,maxZ: -29.1 });
	}
	const lanterns=new THREE.InstancedMesh(new THREE.SphereGeometry(0.34,9,7),new THREE.MeshBasicMaterial({ color: 0xff5a2e }),lanternPts.length);
	const m4=new THREE.Matrix4();
	lanternPts.forEach((pt,i) => { m4.makeScale(1,0.82,1); m4.setPosition(pt[0],pt[1],pt[2]); lanterns.setMatrixAt(i,m4); });
	group.add(lanterns);
	flushBuckets();

	
	
	const scatterSpots=[];
	function scatterClear(x,z) {
		if (distToRoads(x,z).edge < 1.1) return false;
		if (waterDist(x,z) < 0.8) return false;
		if (x > POOL.x0 - 0.8 && x < POOL.x1 + 0.8 && z > POOL.z0 - 0.8 && z < POOL.z1 + 0.8) return false;
		for (const c of CIRCLES) {
			const d=Math.hypot(x - c.x,z - c.z);
			if (d > c.r - c.w / 2 - 1.1 && d < c.r + c.w / 2 + 1.1) return false;
		}
		for (const box of colliders) {
			if (x > box.minX - 0.7 && x < box.maxX + 0.7 && z > box.minZ - 0.7 && z < box.maxZ + 0.7) return false;
		}
		return true;
	}
	function addScatter(kind,x,z) {
		if (scatterClear(x,z)) scatterSpots.push({ kind,x,z });
	}
	for (const road of ROADS) {
		const pts=road.pts;
		const n=road.loop ? pts.length : pts.length - 1;
		for (let i=0; i < n; i += 1) {
			const a=pts[i];
			const b=pts[(i + 1) % pts.length];
			const len=Math.hypot(b[0] - a[0],b[1] - a[1]);
			const steps=Math.floor(len / 11.5);
			for (let s=1; s < steps; s += 1) {
				if (rand() < 0.25) continue;
				const t=s / steps;
				const x=a[0] + (b[0] - a[0]) * t + (rand() - 0.5) * 3;
				const z=a[1] + (b[1] - a[1]) * t + (rand() - 0.5) * 3;
				const dx=(b[0] - a[0]) / (len || 1);
				const dz=(b[1] - a[1]) / (len || 1);
				const side=rand() < 0.5 ? 1 : -1;
				addScatter('palm',x - dz * side * (road.w / 2 + 3.4),z + dx * side * (road.w / 2 + 3.4));
			}
		}
	}
	for (const park of parkRects) {
		for (let p=0; p < 7; p += 1) {
			addScatter('palm',park.x0 + 3 + rand() * (park.x1 - park.x0 - 6),park.z0 + 3 + rand() * (park.z1 - park.z0 - 6));
		}
	}
	for (let x=-92; x <= 86; x += 11) {
		addScatter('palm',x + (rand() - 0.5) * 2,-28.2);
		addScatter('palm',x + (rand() - 0.5) * 2,-15.8);
	}
	for (let i=0; i < 26; i += 1) {
		const a=(i / 26) * Math.PI * 2 + rand() * 0.14;
		addScatter('palm',LAKE.x + Math.cos(a) * (LAKE.rx + 3.4),LAKE.z + Math.sin(a) * (LAKE.rz + 3.4));
	}
	for (let x=-196; x < 220; x += 9) {
		if (rand() > 0.15) addScatter('palm',x + rand() * 3,147 + rand() * 2.5);
	}
	for (const c of CIRCLES) {
		for (let i=0; i < 5; i += 1) {
			const a=(i / 5) * Math.PI * 2 + 0.5;
			addScatter('palm',c.x + Math.cos(a) * (c.r - c.w / 2 - 2.6),c.z + Math.sin(a) * (c.r - c.w / 2 - 2.6));
		}
	}
	
	for (const v of vxRoads) {
		for (const h of hzRoads) {
			const x=v.pts[0][0];
			const z=h.pts[0][1];
			const inV=z >= Math.min(v.pts[0][1],v.pts[1][1]) && z <= Math.max(v.pts[0][1],v.pts[1][1]);
			const inH=x >= Math.min(h.pts[0][0],h.pts[1][0]) && x <= Math.max(h.pts[0][0],h.pts[1][0]);
			if (!inV || !inH) continue;
			addScatter('lamp',x + v.w / 2 + 1.1,z + h.w / 2 + 1.1);
			addScatter('lamp',x - v.w / 2 - 1.1,z - h.w / 2 - 1.1);
		}
	}
	for (const b of BRIDGES) {
		if (b.axis === 'x') {
			addScatter('lamp',b.from - 4,b.at - 7.6);
			addScatter('lamp',b.to + 4,b.at + 7.6);
		} else {
			addScatter('lamp',b.at - 7.6,b.from - 4);
			addScatter('lamp',b.at + 7.6,b.to + 4);
		}
	}
	const palmSpots=scatterSpots.filter((s) => s.kind === 'palm');
	const lampSpots=scatterSpots.filter((s) => s.kind === 'lamp');
	{
		const trunkGeometry=new THREE.CylinderGeometry(0.15,0.31,5.8,7,6);
		const posAttr=trunkGeometry.attributes.position;
		for (let i=0; i < posAttr.count; i += 1) {
			const y=posAttr.getY(i);
			const t=(y + 2.9) / 5.8;
			posAttr.setX(i,posAttr.getX(i) + t * t * 1.3);
			posAttr.setY(i,y + 2.9);
		}
		trunkGeometry.computeVertexNormals();
		function frondGeometry() {
			const frond=new THREE.PlaneGeometry(0.66,3.0,1,5);
			const attr=frond.attributes.position;
			for (let i=0; i < attr.count; i += 1) {
				const len=attr.getY(i) + 1.5;
				const v=len / 3.0;
				attr.setXYZ(i,attr.getX(i) * (1 - v * 0.72),len * 0.34 - v * v * 1.25,len);
			}
			return frond;
		}
		const crownParts=[];
		for (let k=0; k < 7; k += 1) {
			const frond=frondGeometry();
			frond.rotateY((k / 7) * Math.PI * 2 + k * 0.37);
			crownParts.push(frond);
		}
		const heart=new THREE.SphereGeometry(0.3,8,6);
		heart.scale(1,0.75,1);
		crownParts.push(heart);
		const crownGeometry=mergeGeometries(crownParts);
		crownGeometry.computeVertexNormals();
		const trunks=new THREE.InstancedMesh(trunkGeometry,new THREE.MeshLambertMaterial({ color: 0x77603f }),palmSpots.length);
		const crowns=new THREE.InstancedMesh(crownGeometry,new THREE.MeshLambertMaterial({ color: 0x2e9e5f,side: THREE.DoubleSide }),palmSpots.length);
		const matrix=new THREE.Matrix4();
		const crownMatrix=new THREE.Matrix4();
		const topOffset=new THREE.Matrix4().makeTranslation(1.3,5.72,0);
		const quaternion=new THREE.Quaternion();
		const euler=new THREE.Euler();
		palmSpots.forEach((spot,index) => {
			const tilt=(seededRandom(index * 31 + 7)() - 0.5) * 0.13;
			const spin=seededRandom(index * 57 + 3)() * Math.PI * 2;
			const scale=0.85 + seededRandom(index * 91 + 5)() * 0.5;
			euler.set(0,spin,tilt);
			quaternion.setFromEuler(euler);
			const sc=new THREE.Vector3(scale,scale * (0.92 + (index % 5) * 0.05),scale);
			matrix.compose(new THREE.Vector3(spot.x,0,spot.z),quaternion,sc);
			trunks.setMatrixAt(index,matrix);
			crownMatrix.multiplyMatrices(matrix,topOffset);
			crowns.setMatrixAt(index,crownMatrix);
		});
		trunks.castShadow=true;
		crowns.castShadow=true;
		group.add(trunks);
		group.add(crowns);
	}
	{
		const posts=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07,0.1,5,5),new THREE.MeshLambertMaterial({ color: 0x33383e }),lampSpots.length);
		const heads=new THREE.InstancedMesh(new THREE.SphereGeometry(0.24,8,6),new THREE.MeshBasicMaterial({ color: 0xffe2a8 }),lampSpots.length);
		const matrix=new THREE.Matrix4();
		lampSpots.forEach((spot,index) => {
			matrix.makeTranslation(spot.x,2.5,spot.z);
			posts.setMatrixAt(index,matrix);
			matrix.makeTranslation(spot.x,5.05,spot.z);
			heads.setMatrixAt(index,matrix);
		});
		group.add(posts);
		group.add(heads);
	}

	
	const sand=new THREE.Mesh(new THREE.PlaneGeometry(520,42),new THREE.MeshLambertMaterial({ color: 0xeed9a4 }));
	sand.rotation.x=-Math.PI / 2;
	sand.position.set(0,0.0,156);
	sand.receiveShadow=true;
	group.add(sand);
	const water=new THREE.Mesh(new THREE.PlaneGeometry(520,95),waterMaterial);
	water.rotation.x=-Math.PI / 2;
	water.position.set(0,0.12,220);
	group.add(water);
	const pierSide=new THREE.MeshLambertMaterial({ color: 0x7d6547 });
	const pier=new THREE.Mesh(new THREE.BoxGeometry(4,0.6,34),pierSide);
	pier.position.set(22,0.35,182);
	pier.castShadow=true;
	group.add(pier);
	currentZone='south';
	const hullColors=[0xe84f6a,0xf5f5f5,0x39b5c4,0xf7c873];
	for (let i=0; i < 4; i += 1) {
		const boat=new THREE.Group();
		const hull=new THREE.Mesh(new THREE.BoxGeometry(3,1.1,7),new THREE.MeshLambertMaterial({ color: hullColors[i] }));
		hull.castShadow=true;
		boat.add(hull);
		const cabin=new THREE.Mesh(new THREE.BoxGeometry(1.9,0.85,2.6),new THREE.MeshLambertMaterial({ color: 0xf5f5f5 }));
		cabin.position.set(0,0.95,-0.5);
		cabin.castShadow=true;
		boat.add(cabin);
		boat.position.set(15 + (i % 2) * 13,0.45,172 + i * 8);
		boat.rotation.y=(i % 3 - 1) * 0.22;
		group.add(boat);
		animated.boats.push({ mesh: boat,phase: i * 1.7,baseY: 0.45 });
	}
	const umbrellaColors=[0xe84f6a,0xffb35c,0x39b5c4,0xf7c873,0xef476f,0x06d6a0];
	const poleMaterial=new THREE.MeshLambertMaterial({ color: 0xf0ead8 });
	const canopyMaterials=umbrellaColors.map((c) => new THREE.MeshLambertMaterial({ color: c }));
	for (let i=0; i < 9; i += 1) {
		const ux=-52 + i * 13 + (i % 3) * 2;
		const uz=147 + (i % 4) * 3.4;
		const poleGeo=new THREE.CylinderGeometry(0.05,0.05,2.3,6);
		poleGeo.translate(ux,1.15,uz);
		bucketGeo(poleMaterial,poleGeo);
		const canopyGeo=new THREE.ConeGeometry(1.75,0.55,9);
		canopyGeo.translate(ux,2.35,uz);
		bucketGeo(canopyMaterials[i % umbrellaColors.length],canopyGeo,true);
	}
	flushBuckets();

	let elapsed=0;
	function update(dt) {
		elapsed += dt;
		water.position.y=0.12 + Math.sin(elapsed * 0.8) * 0.045;
		riverWater.position.y=Math.sin(elapsed * 0.8) * 0.02;
		for (const boat of animated.boats) {
			boat.mesh.position.y=boat.baseY + Math.sin(elapsed * 0.9 + boat.phase) * 0.08;
			boat.mesh.rotation.z=Math.sin(elapsed * 0.7 + boat.phase) * 0.03;
			boat.mesh.rotation.x=Math.cos(elapsed * 0.6 + boat.phase) * 0.02;
		}
	}
	const zones=Object.entries(ZONE_BOUNDS).map(([name,bounds]) => ({
		name,
		...bounds,
		meshes: zoneMeshes[name],
		shadowOn: true,
		visible: true,
	}));
	return { group,colliders,update,zones,scatterSpots,decor };
}

export function resolveCollisions(position,radius,colliders) {
	for (const box of colliders) {
		const nearX=Math.max(box.minX,Math.min(position.x,box.maxX));
		const nearZ=Math.max(box.minZ,Math.min(position.z,box.maxZ));
		const dx=position.x - nearX;
		const dz=position.z - nearZ;
		const distSq=dx * dx + dz * dz;
		if (distSq > radius * radius) continue;
		if (distSq > 0.0001) {
			const dist=Math.sqrt(distSq);
			position.x=nearX + (dx / dist) * radius;
			position.z=nearZ + (dz / dist) * radius;
		} else {
			const left=position.x - box.minX;
			const right=box.maxX - position.x;
			const top=position.z - box.minZ;
			const bottom=box.maxZ - position.z;
			const smallest=Math.min(left,right,top,bottom);
			if (smallest === left) position.x=box.minX - radius;
			else if (smallest === right) position.x=box.maxX + radius;
			else if (smallest === top) position.z=box.minZ - radius;
			else position.z=box.maxZ + radius;
		}
	}
	position.x=Math.max(-240,Math.min(240,position.x));
	position.z=Math.max(-240,Math.min(168,position.z));
}
