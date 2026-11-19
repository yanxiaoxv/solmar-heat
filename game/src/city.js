// Procedural Solmar Bay: 63 blocks, two districts. No external assets.

import * as THREE from 'three';
import { createSeededRandom,rangeValue } from './random.js';
import { mergeGeometries } from './merge.js';

export const CITY_HALF=220;

export const ROAD_X=[-198,-154,-110,-66,-22,22,66,110,154,198];
export const ROAD_Z=[-198,-154,-110,-66,-22,22,66,110];
export const ROAD_WIDTH=13;

const BUILDING_PALETTE=[0xf2d8a7,0xe8b4a0,0xa8d8d8,0xf5efe0,0xd9a7c7,0x9fc6e8,0xf7c873,0xcfe8b0];
const ROOF_PALETTE=[0xb5654a,0x8a7f72,0x6b8e9f,0x99785f];
const SIGN_NAMES=['CAFÉ SOL','RAYO','HOTEL BRISA','MARINA','PALMS','TACOS LUPE','BAHÍA','CORAL','FAROS','DELFÍN','SOLMAR','HELADOS'];
const SIGN_STYLES=[['#123a5c','#ffd23f'],['#7a1f2b','#ffe9a8'],['#0f5f56','#ffffff'],['#40260a','#ffb35c'],['#26355e','#9fd8ff'],['#5c2144','#ffd9ec']];
const PARK_CENTERS=new Set(['-44,44','44,-88','88,88']);
const HEIGHTS_PALETTE=[0x7fa8c9,0x8b93a5,0xa8d8d8,0x9fc6e8];
const OLDTOWN_PALETTE=[0xe8b4a0,0xf2d8a7,0xd9a7c7,0xe8c39a];

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
	if (z < -121) return 'Heights';
	if (z > 130) return 'Marina';
	if (x < -121 || x > 121) return 'Old Town';
	return 'Core';
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
	core: { minX: -125,maxX: 125,minZ: -125,maxZ: 125 },
	north: { minX: -200,maxX: 200,minZ: -200,maxZ: -120 },
	west: { minX: -200,maxX: -120,minZ: -125,maxZ: 125 },
	east: { minX: 120,maxX: 200,minZ: -125,maxZ: 125 },
	south: { minX: -60,maxX: 60,minZ: 130,maxZ: 200 },
};

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
function blotches(ctx,w,h,rand,count) {
	for (let i=0; i < count; i += 1) {
		ctx.fillStyle='rgba(0,0,0,0.10)';
		ctx.beginPath();
		ctx.ellipse(rand() * w,rand() * h,8 + rand() * 18,5 + rand() * 10,rand() * 3,0,Math.PI * 2);
		ctx.fill();
	}
}

function groundPlane(w,d,x,y,z,uvScale) {
	const geometry=new THREE.PlaneGeometry(w,d);
	geometry.rotateX(-Math.PI / 2);
	if (uvScale) {
		const uv=geometry.attributes.uv;
		for (let i=0; i < uv.count; i += 1) uv.setXY(i,uv.getX(i) * uvScale[0],uv.getY(i) * uvScale[1]);
	}
	geometry.translate(x,y,z);
	return geometry;
}

function makeFacadeTexture(baseColor,seed) {
	return canvasTexture(120,512,(ctx,w,h) => {
		const rand=seededRandom(seed);
		const R=(x,y,rw,rh,style) => { ctx.fillStyle=style; ctx.fillRect(x,y,rw,rh); };
		R(0,0,w,h,baseColor);
		R(0,0,w,10,'rgba(255,255,255,0.10)');
		R(0,h - 30,w,30,'rgba(60,30,10,0.14)');
		const pierL=ctx.createLinearGradient(0,0,9,0);
		pierL.addColorStop(0,'rgba(60,35,15,0.20)');
		pierL.addColorStop(1,'rgba(60,35,15,0)');
		R(0,0,9,h,pierL);
		const pierR=ctx.createLinearGradient(w,0,w - 9,0);
		pierR.addColorStop(0,'rgba(60,35,15,0.20)');
		pierR.addColorStop(1,'rgba(60,35,15,0)');
		R(w - 9,0,9,h,pierR);
		for (let i=0; i < 420; i += 1) R(rand() * w,rand() * h,2,2,`rgba(${rand() > 0.5 ? '255,255,255' : '40,30,20'},${0.03 + rand() * 0.05})`);
		for (let y=18; y < h - 40; y += 20) {
			R(0,y + 15,w,2,'rgba(70,45,25,0.24)');
			for (let x=5; x < w - 12; x += 24) {
				const roll=rand();
				const wx=x + (rand() - 0.5) * 2;
				if (roll < 0.26) {
					const warm=['#ffd98f','#ffc978','#ffe9b8','#ffb066'][Math.floor(rand() * 4)];
					const lit=ctx.createLinearGradient(0,y,0,y + 14);
					lit.addColorStop(0,warm);
					lit.addColorStop(1,'#e07f3a');
					R(wx,y,13,14,lit);
					R(wx + 6.2,y,0.8,14,'rgba(120,60,20,0.22)');
					R(wx,y + 6.7,13,0.8,'rgba(120,60,20,0.22)');
					if (rand() < 0.4) R(wx,y + 9,13,5,'rgba(255,246,220,0.5)');
				} else if (roll < 0.62) {
					const glass=ctx.createLinearGradient(0,y,0,y + 14);
					glass.addColorStop(0,'#8fc3dd');
					glass.addColorStop(1,'#33526e');
					R(wx,y,13,14,glass);
					ctx.fillStyle='rgba(255,255,255,0.35)';
					ctx.beginPath();
					ctx.moveTo(wx + 2,y + 14);
					ctx.lineTo(wx + 8,y);
					ctx.lineTo(wx + 11,y);
					ctx.lineTo(wx + 5,y + 14);
					ctx.closePath();
					ctx.fill();
				} else if (roll < 0.78) {
					R(wx,y,13,14,'#46606f');
					for (let s=0; s < 4; s += 1) R(wx,y + 2 + s * 3.4,13,1.6,'rgba(230,238,240,0.75)');
				} else {
					R(wx,y,13,14,'#2b3644');
				}
				if (rand() < 0.2) {
					R(wx - 2,y + 17,17,3,'rgba(60,40,25,0.28)');
					R(wx - 2,y + 14.5,17,2,'#e8e2d4');
					for (let b=0; b < 5; b += 1) R(wx - 1 + b * 4,y + 10.5,1.2,4.5,'rgba(50,50,60,0.8)');
					R(wx - 2,y + 10,17,1.4,'rgba(50,50,60,0.8)');
				}
				if (rand() < 0.13) {
					R(wx + 15,y + 3,6,7,'#c9ccd2');
					for (let gLine=0; gLine < 3; gLine += 1) R(wx + 15.8,y + 4.4 + gLine * 1.9,4.4,0.8,'rgba(70,75,85,0.8)');
				}
			}
		}
		R(0,h - 27,w,27,'rgba(24,30,34,0.95)');
		R(0,h - 27,w,2.5,'rgba(255,205,120,0.55)');
		for (let x=5; x < w - 16; x += 24) {
			const pane=ctx.createLinearGradient(0,h - 25,0,h - 3);
			pane.addColorStop(0,'#7fc4bd');
			pane.addColorStop(0.55,'#2c5f5c');
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
		ctx.font='bold 30px Verdana, sans-serif';
		ctx.textAlign='center';
		ctx.textBaseline='middle';
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

	const grassTexture=canvasTexture(128,128,(ctx,w,h) => {
		ctx.fillStyle='#69a357';
		ctx.fillRect(0,0,w,h);
		const r=seededRandom(41);
		for (let band=0; band < 4; band += 1) {
			if (band % 2 === 0) continue;
			ctx.fillStyle='rgba(38,80,30,0.22)';
			ctx.fillRect(0,band * 32,w,32);
		}
		for (let i=0; i < 1500; i += 1) {
			ctx.fillStyle=r() > 0.5 ? 'rgba(46,94,38,0.28)' : 'rgba(146,190,105,0.24)';
			ctx.fillRect(r() * w,r() * h,2.2,2.2);
		}
		blotches(ctx,w,h,r,9);
	},[44,44]);
	const ground=new THREE.Mesh(new THREE.PlaneGeometry(420,420),new THREE.MeshLambertMaterial({ map: grassTexture,color: 0xb9c6a9 }));
	ground.rotation.x=-Math.PI / 2;
	ground.position.y=-0.05;
	ground.receiveShadow=true;
	group.add(ground);

	function asphaltPainter(withCrossing) {
		return (ctx,w,h) => {
			ctx.fillStyle='#3a3f46';
			ctx.fillRect(0,0,w,h);
			const r=seededRandom(withCrossing ? 97 : 53);
			speckle(ctx,w,h,r,1500,1.6);
			blotches(ctx,w,h,r,5);
			if (withCrossing) {
				ctx.fillStyle='rgba(238,240,242,0.74)';
				for (let s=10; s < w - 12; s += 17) {
					ctx.fillRect(s,6,8,14);
					ctx.fillRect(s,h - 20,8,14);
					ctx.fillRect(6,s,14,8);
					ctx.fillRect(w - 20,s,14,8);
				}
				speckle(ctx,w,h,r,900,1.6);
				return;
			}
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
		};
	}
	function asphaltPainterH(ctx,w,h) {
		ctx.fillStyle='#3a3f46';
		ctx.fillRect(0,0,w,h);
		const r=seededRandom(59);
		speckle(ctx,w,h,r,1500,1.6);
		blotches(ctx,w,h,r,5);
		ctx.fillStyle='#e9e6da';
		ctx.fillRect(0,3,w,3);
		ctx.fillRect(0,h - 6,w,3);
		ctx.fillStyle='#f5c542';
		ctx.fillRect(0,h / 2 - 5,w,3.4);
		ctx.fillRect(0,h / 2 + 1.6,w,3.4);
		ctx.fillStyle='rgba(233,230,218,0.9)';
		for (let x=4; x < w; x += 32) {
			ctx.fillRect(x,h * 0.25 - 1.5,17,3);
			ctx.fillRect(x,h * 0.75 - 1.5,17,3);
		}
	}
	const roadMaterialV=new THREE.MeshLambertMaterial({ map: canvasTexture(128,128,asphaltPainter(false)) });
	const roadMaterialH=new THREE.MeshLambertMaterial({ map: canvasTexture(128,128,asphaltPainterH) });
	const crossingMaterial=new THREE.MeshLambertMaterial({ map: canvasTexture(128,128,asphaltPainter(true)) });
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
	const roadGeosV=[];
	const roadGeosH=[];
	const crossingGeos=[];
	const walkGeos=[];
	for (const pos of ROAD_X) {
		roadGeosV.push(groundPlane(ROAD_WIDTH,396,pos,0.01,-20,[1,30]));
		for (const other of ROAD_Z) crossingGeos.push(groundPlane(ROAD_WIDTH + 0.6,ROAD_WIDTH + 0.6,pos,0.02,other,[1,1]));
		for (const side of [-1,1]) walkGeos.push(groundPlane(2.4,396,pos + side * (ROAD_WIDTH / 2 + 1.2),0.045,-20,[1,145]));
	}
	for (const pos of ROAD_Z) {
		roadGeosH.push(groundPlane(484,ROAD_WIDTH,0,0.012,pos,[37,1]));
		for (const side of [-1,1]) walkGeos.push(groundPlane(484,2.4,0,0.045,pos + side * (ROAD_WIDTH / 2 + 1.2),[178,1]));
	}
	for (const [geos,material] of [[roadGeosV,roadMaterialV],[roadGeosH,roadMaterialH],[crossingGeos,crossingMaterial],[walkGeos,walkMaterial]]) {
		const mesh=new THREE.Mesh(mergeGeometries(geos),material);
		mesh.receiveShadow=true;
		group.add(mesh);
	}
	const promenadeTexture=canvasTexture(64,64,(ctx,w,h) => {
		ctx.fillStyle='#c08552';
		ctx.fillRect(0,0,w,h);
		speckle(ctx,w,h,seededRandom(19),160);
		ctx.fillStyle='rgba(96,54,28,0.7)';
		ctx.fillRect(0,0,w,2);
		ctx.fillRect(0,0,2,h);
	},[90,1]);
	const promenade=new THREE.Mesh(new THREE.PlaneGeometry(420,5.6),new THREE.MeshLambertMaterial({ map: promenadeTexture }));
	promenade.rotation.x=-Math.PI / 2;
	promenade.position.set(0,0.035,139.5);
	promenade.receiveShadow=true;
	group.add(promenade);

	const roofMaterialCache=ROOF_PALETTE.map((color) => new THREE.MeshLambertMaterial({ color }));
	const concreteMaterial=new THREE.MeshLambertMaterial({ color: 0xa49a89 });
	const tankMaterial=new THREE.MeshLambertMaterial({ color: 0xb4b9c0 });
	const acMaterial=new THREE.MeshLambertMaterial({ color: 0x878e99 });
	const tankGeometry=new THREE.CylinderGeometry(0.85,0.85,1.7,10);
	const tankTopGeometry=new THREE.ConeGeometry(0.98,0.55,10);
	const acGeometry=new THREE.BoxGeometry(1.5,0.72,1.1);
	const antennaMaterial=new THREE.MeshLambertMaterial({ color: 0x3c4148 });
	const antennaGeometry=new THREE.CylinderGeometry(0.05,0.07,3.6,5);
	const awningMaterials=[
		new THREE.MeshLambertMaterial({ map: makeAwningTexture('#c2432e','#f5efe0') }),
		new THREE.MeshLambertMaterial({ map: makeAwningTexture('#0f7f8c','#f5efe0') }),
		new THREE.MeshLambertMaterial({ map: makeAwningTexture('#e8a13a','#7a1f2b') }),
	];
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
	const palmSpots=[];
	function addPalm(x,z,scale=0) {
		palmSpots.push({ x,z,tilt: (rand() - 0.5) * 0.13,spin: rand() * Math.PI * 2,scale: scale || 0.85 + rand() * 0.5 });
	}
	const benchMaterial=new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
	const lawnMaterial=new THREE.MeshLambertMaterial({ map: grassTexture,color: 0x9fb894 });

	function buildBlock(cx,cz,style) {

		currentZone=style === 'core' ? 'core' : style === 'heights' ? 'north' : cx < 0 ? 'west' : 'east';
		if (style === 'core' && PARK_CENTERS.has(`${cx},${cz}`)) {

			const lawn=new THREE.Mesh(new THREE.PlaneGeometry(31,31),lawnMaterial);
			lawn.rotation.x=-Math.PI / 2;
			lawn.position.set(cx,0.04,cz);
			lawn.receiveShadow=true;
			group.add(lawn);
			for (let p=0; p < 6; p += 1) addPalm(cx + (rand() - 0.5) * 22,cz + (rand() - 0.5) * 22,0.95 + rand() * 0.4);
			for (const [ox,oz] of [[-7,5],[8,-6],[3,9]]) {
				bucketBox(benchMaterial,2.2,0.12,0.55,cx + ox,0.5,cz + oz);
				bucketBox(benchMaterial,2.2,0.5,0.1,cx + ox,0.85,cz + oz - 0.26);
			}
			return;
		}
		const palette=style === 'heights' ? HEIGHTS_PALETTE : style === 'oldtown' ? OLDTOWN_PALETTE : BUILDING_PALETTE;
		const towers=rand() > (style === 'heights' ? 0.25 : style === 'oldtown' ? 0.2 : 0.4) ? 2 : 1;
		for (let t=0; t < towers; t += 1) {
			const w=style === 'oldtown' ? rangeValue(rand,9,14) : rangeValue(rand,11,18);
			const d=style === 'oldtown' ? rangeValue(rand,9,14) : rangeValue(rand,11,18);

			const heightRoll=rand();
			let h;
			if (style === 'heights') h=30 + rand() * 28;
			else if (style === 'oldtown') h=8 + rand() * 8;
			else h=heightRoll < 0.3 ? 9 + rand() * 7 : heightRoll < 0.8 ? 18 + rand() * 16 : 36 + rand() * 20;
			if (Math.abs(cx) < 30 && Math.abs(cz) < 30) h += 10;
			const ox=towers === 1 ? 0 : (t === 0 ? -8 : 8);
			const oz=towers === 1 ? 0 : (t === 0 ? 6 : -7);
			const tx=cx + ox;
			const tz=cz + oz;
			const sideMaterial=sideMaterialFor(palette,Math.floor(rand() * palette.length),Math.floor(rand() * 4));
			const roofMaterial=style === 'oldtown' && rand() < 0.6 ? roofMaterialCache[0] : roofMaterialCache[Math.floor(rand() * roofMaterialCache.length)];
			addTowerShell(w,h,d,tx,0,tz,sideMaterial,roofMaterial);
			colliders.push({ minX: tx - w / 2,maxX: tx + w / 2,minZ: tz - d / 2,maxZ: tz + d / 2 });
			bucketBox(concreteMaterial,w + 0.5,1.0,d + 0.5,tx,0.5,tz,{ receive: true });
			bucketBox(roofMaterial,w + 0.35,0.24,d + 0.35,tx,h + 0.12,tz,{ cast: true });
			if (h > 36) {
				const tierH=5 + rand() * 6;
				const tierX=tx + (rand() - 0.5) * 2;
				const tierZ=tz + (rand() - 0.5) * 2;
				addTowerShell(w * 0.62,tierH,d * 0.62,tierX,h,tierZ,sideMaterial,roofMaterial);
			}
			if (rand() < 0.55) {
				const acX=tx + (rand() - 0.5) * (w - 4);
				const acZ=tz + (rand() - 0.5) * (d - 4);
				const acGeo=acGeometry.clone();
				acGeo.rotateY(rand() * Math.PI);
				acGeo.translate(acX,h + 0.6,acZ);
				bucketGeo(acMaterial,acGeo,true);
			}
			if (rand() < 0.34) {
				const tankX=tx + (rand() - 0.5) * (w - 5);
				const tankZ=tz + (rand() - 0.5) * (d - 5);
				const drumGeo=tankGeometry.clone();
				drumGeo.translate(tankX,h + 0.2 + 0.85,tankZ);
				bucketGeo(tankMaterial,drumGeo,true);
				const capGeo=tankTopGeometry.clone();
				capGeo.translate(tankX,h + 0.2 + 1.95,tankZ);
				bucketGeo(roofMaterial,capGeo);
			}
			if (h > 30 && rand() < 0.6) {
				const antGeo=antennaGeometry.clone();
				antGeo.translate(tx + (rand() - 0.5) * (w - 3),h + 1.8,tz + (rand() - 0.5) * (d - 3));
				bucketGeo(antennaMaterial,antGeo);
			}

			if (h < 32 && rand() < (style === 'oldtown' ? 0.85 : 0.68)) {
				const signMaterial=signMaterials[Math.floor(rand() * signMaterials.length)];
				const awningMaterial=awningMaterials[Math.floor(rand() * awningMaterials.length)];
				if (rand() < 0.5) {
					const signGeo=new THREE.PlaneGeometry(4.6,1.0);
					signGeo.translate(tx,3.35,tz + d / 2 + 0.07);
					bucketGeo(signMaterial,signGeo);
					bucketBox(awningMaterial,4.9,0.09,1.25,tx,2.62,tz + d / 2 + 0.55,{ rx: 0.38 });
				} else {
					const signGeo=new THREE.PlaneGeometry(4.6,1.0);
					signGeo.rotateY(-Math.PI / 2);
					signGeo.translate(tx - w / 2 - 0.07,3.35,tz);
					bucketGeo(signMaterial,signGeo);
					bucketBox(awningMaterial,1.25,0.09,4.9,tx - w / 2 - 0.55,2.62,tz,{ rz: 0.38 });
				}
			}
		}
	}
	const CORE_CENTERS=[-88,-44,0,44,88];
	for (const cx of CORE_CENTERS) {
		for (const cz of CORE_CENTERS) buildBlock(cx,cz,'core');
	}

	for (const cx of [-176,-132,-88,-44,0,44,88,132,176]) {
		for (const cz of [-176,-132,-88,-44,0,44,88]) {
			if (Math.abs(cx) <= 88 && Math.abs(cz) <= 88) continue;
			buildBlock(cx,cz,cz <= -132 ? 'heights' : 'oldtown');
		}
	}

	for (const pos of ROAD_X) {
		for (let t=-240; t < 142; t += 13) {
			if (rand() > 0.22) addPalm(pos + ROAD_WIDTH / 2 + 3.6,t + rand() * 5);
		}
	}
	for (const pos of ROAD_Z) {
		for (let t=-240; t < 240; t += 13) {
			if (rand() > 0.5) addPalm(t + rand() * 5,pos - ROAD_WIDTH / 2 - 3.6);
		}
	}
	for (let x=-132; x < 142; x += 9) {
		if (rand() > 0.15) addPalm(x + rand() * 3,143.5 + rand() * 2.5);
	}
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
		const nutParts=[];
		for (const [nx,nz] of [[0.24,0.1],[-0.18,0.22],[0.02,-0.26]]) {
			const nut=new THREE.SphereGeometry(0.15,7,6);
			nut.translate(nx,-0.22,nz);
			nutParts.push(nut);
		}
		const trunks=new THREE.InstancedMesh(trunkGeometry,new THREE.MeshLambertMaterial({ color: 0x77603f }),palmSpots.length);
		const crowns=new THREE.InstancedMesh(crownGeometry,new THREE.MeshLambertMaterial({ color: 0x2e9e5f,side: THREE.DoubleSide }),palmSpots.length);
		const nuts=new THREE.InstancedMesh(mergeGeometries(nutParts),new THREE.MeshLambertMaterial({ color: 0x6e4f26 }),palmSpots.length);
		const matrix=new THREE.Matrix4();
		const crownMatrix=new THREE.Matrix4();
		const topOffset=new THREE.Matrix4().makeTranslation(1.3,5.72,0);
		const quaternion=new THREE.Quaternion();
		const euler=new THREE.Euler();
		palmSpots.forEach((spot,index) => {
			euler.set(0,spot.spin,spot.tilt);
			quaternion.setFromEuler(euler);
			const scale=new THREE.Vector3(spot.scale,spot.scale * (0.92 + (index % 5) * 0.05),spot.scale);
			matrix.compose(new THREE.Vector3(spot.x,0,spot.z),quaternion,scale);
			trunks.setMatrixAt(index,matrix);
			crownMatrix.multiplyMatrices(matrix,topOffset);
			crowns.setMatrixAt(index,crownMatrix);
			nuts.setMatrixAt(index,crownMatrix);
		});
		trunks.castShadow=true;
		crowns.castShadow=true;
		group.add(trunks);
		group.add(crowns);
		group.add(nuts);
	}

	const sandTexture=canvasTexture(128,128,(ctx,w,h) => {
		ctx.fillStyle='#eed9a4';
		ctx.fillRect(0,0,w,h);
		const r=seededRandom(23);
		for (let i=0; i < 800; i += 1) {
			ctx.fillStyle=r() > 0.5 ? 'rgba(180,145,85,0.20)' : 'rgba(255,250,230,0.25)';
			ctx.fillRect(r() * w,r() * h,1.8,1.8);
		}
	},[26,3]);
	const sand=new THREE.Mesh(new THREE.PlaneGeometry(420,42),new THREE.MeshLambertMaterial({ map: sandTexture }));
	sand.rotation.x=-Math.PI / 2;
	sand.position.set(0,0.0,156);
	sand.receiveShadow=true;
	group.add(sand);
	const wetSand=new THREE.Mesh(new THREE.PlaneGeometry(420,8),new THREE.MeshPhongMaterial({ color: 0xcfa96e,shininess: 70,specular: 0xffd9a0 }));
	wetSand.rotation.x=-Math.PI / 2;
	wetSand.position.set(0,0.018,174);
	group.add(wetSand);
	const waterBump=canvasTexture(128,128,(ctx,w,h) => {
		ctx.fillStyle='#808080';
		ctx.fillRect(0,0,w,h);
		const r=seededRandom(31);
		for (let i=0; i < 240; i += 1) {
			const g=110 + Math.floor(r() * 90);
			ctx.fillStyle=`rgb(${g},${g},${g})`;
			ctx.beginPath();
			ctx.ellipse(r() * w,r() * h,4 + r() * 10,1.5 + r() * 3,0,0,Math.PI * 2);
			ctx.fill();
		}
	},[30,7]);
	waterBump.colorSpace=THREE.NoColorSpace;
	const waterMaterial=new THREE.MeshPhongMaterial({ color: 0x166d8f,specular: 0xffc37a,shininess: 110,transparent: true,opacity: 0.94,bumpMap: waterBump,bumpScale: 0.9 });
	const water=new THREE.Mesh(new THREE.PlaneGeometry(420,95),waterMaterial);
	water.rotation.x=-Math.PI / 2;
	water.position.set(0,0.12,220);
	group.add(water);
	const foamTexture=canvasTexture(128,32,(ctx,w,h) => {
		ctx.clearRect(0,0,w,h);
		const r=seededRandom(43);
		for (let i=0; i < 130; i += 1) {
			ctx.fillStyle=`rgba(255,252,244,${0.25 + r() * 0.5})`;
			ctx.beginPath();
			ctx.ellipse(r() * w,h * 0.3 + r() * h * 0.5,2 + r() * 6,1 + r() * 2.4,0,0,Math.PI * 2);
			ctx.fill();
		}
	},[22,1]);
	const foam=new THREE.Mesh(new THREE.PlaneGeometry(420,4.6),new THREE.MeshBasicMaterial({ map: foamTexture,transparent: true,opacity: 0.75,depthWrite: false }));
	foam.rotation.x=-Math.PI / 2;
	foam.position.set(0,0.16,176.5);
	group.add(foam);

	const pierTexture=canvasTexture(64,64,(ctx,w,h) => {
		ctx.fillStyle='#9a7d5a';
		ctx.fillRect(0,0,w,h);
		ctx.fillStyle='rgba(70,50,28,0.8)';
		for (let y=0; y < h; y += 9) ctx.fillRect(0,y,w,2);
		speckle(ctx,w,h,seededRandom(3),120,1.4);
	},[1,6]);
	const pierSide=new THREE.MeshLambertMaterial({ color: 0x7d6547 });
	const pier=new THREE.Mesh(new THREE.BoxGeometry(4,0.6,34),[pierSide,pierSide,new THREE.MeshLambertMaterial({ map: pierTexture }),pierSide,pierSide,pierSide]);
	pier.position.set(22,0.35,182);
	pier.castShadow=true;
	group.add(pier);
	currentZone='south';
	const postMaterial=new THREE.MeshLambertMaterial({ color: 0x5f4c33 });
	for (const [px,pz] of [[20.4,168],[23.6,168],[20.4,196],[23.6,196]]) {
		const postGeo=new THREE.CylinderGeometry(0.17,0.17,1.8,7);
		postGeo.translate(px,-0.3,pz);
		bucketGeo(postMaterial,postGeo);
	}
	const hullColors=[0xe84f6a,0xf5f5f5,0x39b5c4,0xf7c873];
	for (let i=0; i < 4; i += 1) {
		const boat=new THREE.Group();
		const hull=new THREE.Mesh(new THREE.BoxGeometry(3,1.1,7),new THREE.MeshLambertMaterial({ color: hullColors[i] }));
		hull.castShadow=true;
		boat.add(hull);
		const bow=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.5,1.1,3,1),hull.material);
		bow.scale.z=1.2;
		bow.position.set(0,0,4.1);
		boat.add(bow);
		if (i % 2 === 0) {
			const mast=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,5.4,6),postMaterial);
			mast.position.set(0,3,0.4);
			boat.add(mast);
			const sailShape=new THREE.Shape();
			sailShape.moveTo(0,0);
			sailShape.lineTo(0,4.6);
			sailShape.lineTo(2.7,0.5);
			sailShape.closePath();
			const sail=new THREE.Mesh(new THREE.ShapeGeometry(sailShape),new THREE.MeshLambertMaterial({ color: 0xfdf6e3,side: THREE.DoubleSide }));
			sail.position.set(0.08,0.7,0.4);
			boat.add(sail);
		} else {
			const cabin=new THREE.Mesh(new THREE.BoxGeometry(1.9,0.85,2.6),new THREE.MeshLambertMaterial({ color: 0xf5f5f5 }));
			cabin.position.set(0,0.95,-0.5);
			cabin.castShadow=true;
			boat.add(cabin);
		}
		boat.position.set(15 + (i % 2) * 13,0.45,172 + i * 8);
		boat.rotation.y=(i % 3 - 1) * 0.22;
		group.add(boat);
		animated.boats.push({ mesh: boat,phase: i * 1.7,baseY: 0.45 });
	}
	const umbrellaColors=[0xe84f6a,0xffb35c,0x39b5c4,0xf7c873,0xef476f,0x06d6a0];
	const poleMaterial=new THREE.MeshLambertMaterial({ color: 0xf0ead8 });
	const canopyTexture=canvasTexture(64,16,(ctx,w,h) => {
		for (let x=0; x < w; x += 16) {
			ctx.fillStyle='#ffffff';
			ctx.fillRect(x,0,8,h);
			ctx.fillStyle='#cfd4d8';
			ctx.fillRect(x + 8,0,8,h);
		}
		ctx.fillStyle='rgba(0,0,0,0.12)';
		ctx.fillRect(0,h - 3,w,3);
	});
	const canopyMaterials=umbrellaColors.map((c) => new THREE.MeshLambertMaterial({ color: c,map: canopyTexture }));
	const towelMaterials=umbrellaColors.map((c) => new THREE.MeshLambertMaterial({ color: c }));
	for (let i=0; i < 9; i += 1) {
		const ux=-52 + i * 13 + (i % 3) * 2;
		const uz=147 + (i % 4) * 3.4;
		const poleGeo=new THREE.CylinderGeometry(0.05,0.05,2.3,6);
		poleGeo.translate(ux,1.15,uz);
		bucketGeo(poleMaterial,poleGeo);
		const canopyGeo=new THREE.ConeGeometry(1.75,0.55,9);
		canopyGeo.translate(ux,2.35,uz);
		bucketGeo(canopyMaterials[i % umbrellaColors.length],canopyGeo,true);
		const towelGeo=new THREE.PlaneGeometry(1.15,2);
		towelGeo.rotateX(-Math.PI / 2);
		towelGeo.rotateY(i * 0.7);
		towelGeo.translate(ux + 1.1,0.03,uz + 0.8);
		bucketGeo(towelMaterials[(i + 2) % umbrellaColors.length],towelGeo,false,true);
	}

	{
		const lampSpots=[];
		for (const x of ROAD_X) {
			for (const z of ROAD_Z) lampSpots.push({ x: x + ROAD_WIDTH / 2 + 1,z: z + ROAD_WIDTH / 2 + 1 });
		}
		const posts=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07,0.1,5,5),new THREE.MeshLambertMaterial({ color: 0x33383e }),lampSpots.length);
		const heads=new THREE.InstancedMesh(new THREE.SphereGeometry(0.24,8,6),new THREE.MeshBasicMaterial({ color: 0xffe2a8 }),lampSpots.length);
		const halos=new THREE.InstancedMesh(new THREE.SphereGeometry(0.48,8,6),new THREE.MeshBasicMaterial({ color: 0xffc978,transparent: true,opacity: 0.1,depthWrite: false }),lampSpots.length);
		const matrix=new THREE.Matrix4();
		lampSpots.forEach((spot,index) => {
			matrix.makeTranslation(spot.x,2.5,spot.z);
			posts.setMatrixAt(index,matrix);
			matrix.makeTranslation(spot.x,5.05,spot.z);
			heads.setMatrixAt(index,matrix);
			halos.setMatrixAt(index,matrix);
		});
		group.add(posts);
		group.add(heads);
		group.add(halos);
	}

	flushBuckets();

	let elapsed=0;
	function update(dt) {
		elapsed += dt;
		water.position.y=0.12 + Math.sin(elapsed * 0.8) * 0.045;
		waterBump.offset.set(elapsed * 0.014,elapsed * 0.006);
		foamTexture.offset.x=elapsed * 0.008;
		foam.material.opacity=0.55 + Math.sin(elapsed * 0.7) * 0.2;
		foam.position.z=176.5 + Math.sin(elapsed * 0.5) * 0.5;
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

	return { group,colliders,update,zones };
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
