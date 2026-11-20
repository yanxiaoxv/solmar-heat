// Pedestrians: 22 strollers on the network's sidewalks.

import { buildGraph,nearestOnGraph } from './network.js';
import { RECYCLE_MIN,RECYCLE_MAX } from './config.js';
import { createHumanFigure,skinTone,hairColor } from './figures.js';

const SHIRTS=[0xd9261c,0xffd166,0x06d6a0,0xef476f,0xff8c42,0xa8dadc,0xc94f3d,0xf5efe0];
const PANTS=[0x3a4356,0x74563a,0xe8e2d2,0x2e4a62,0x54383e,0x41604a];
const WALK_OFFSET=8.2;

const graph=buildGraph();
const walkEdges=graph.edges.filter((e) => e.len > 6);

export class Pedestrian {
	constructor(scene,index) {
		this.mesh=createHumanFigure({
			shirt: SHIRTS[index % SHIRTS.length],
			skin: skinTone(index),
			pants: PANTS[index % PANTS.length],
			hair: hairColor(index + 2),
			dress: index % 4 === 3,
		});
		scene.add(this.mesh);
		this.mesh.scale.setScalar(0.93 + (index % 4) * 0.05);
		this.speed=1.6 + (index % 5) * 0.22;
		this.fleeTimer=0;
		this.fleeX=0;
		this.fleeZ=0;
		this.fallTimer=0;
		this.bobPhase=index * 1.7;
		this.x=0;
		this.z=0;
		const edge=walkEdges[(index * 37) % walkEdges.length];
		this.attach(edge,((index * 53) % 90) / 100,true);
	}

	attach(edge,frac,randomSide=false) {
		this.edge=edge;
		this.from=edge.a;
		this.to=edge.b;
		if (Math.random() < 0.5 && randomSide) { this.from=edge.b; this.to=edge.a; }
		this.s=frac * edge.len;
		this.side=Math.random() < 0.5 ? 1 : -1;
		this.syncPosition();
	}

	syncPosition() {
		const dx=this.to.x - this.from.x;
		const dz=this.to.z - this.from.z;
		const len=Math.hypot(dx,dz) || 1;
		const ux=dx / len;
		const uz=dz / len;
		this.x=this.from.x + ux * this.s - uz * this.side * WALK_OFFSET;
		this.z=this.from.z + uz * this.s + ux * this.side * WALK_OFFSET;
		this.mesh.position.set(this.x,0,this.z);
		this.mesh.rotation.y=Math.atan2(ux,uz);
	}

	placeAt(x,z) {
		const proj=nearestOnGraph(graph,x,z);
		this.edge=proj.edge;
		this.from=proj.edge.a;
		this.to=proj.edge.b;
		this.s=proj.t * proj.edge.len;
		this.side=1;
		this.x=x;
		this.z=z;
		this.mesh.position.set(x,0,z);
	}

	respawnNear(focusX,focusZ) {
		let best=null;
		let bestScore=Infinity;
		for (let i=0; i < 28; i += 1) {
			const edge=walkEdges[Math.floor(Math.random() * walkEdges.length)];
			const mx=(edge.a.x + edge.b.x) / 2;
			const mz=(edge.a.z + edge.b.z) / 2;
			const d=Math.hypot(mx - focusX,mz - focusZ);
			const score=d >= RECYCLE_MIN && d <= RECYCLE_MAX ? Math.random() : 1000 + Math.abs(d - (RECYCLE_MIN + RECYCLE_MAX) / 2);
			if (score < bestScore) { bestScore=score; best=edge; }
			if (score < 1) break;
		}
		this.fleeTimer=0;
		this.fallTimer=0;
		this.mesh.rotation.x=0;
		this.mesh.position.y=0;
		this.attach(best,Math.random(),true);
	}

	scare(fromX,fromZ,radius=9) {
		const dx=this.mesh.position.x - fromX;
		const dz=this.mesh.position.z - fromZ;
		const dist=Math.hypot(dx,dz);
		if (dist < radius && dist > 0.01) {
			this.fleeTimer=1.6;
			this.fleeX=dx / dist;
			this.fleeZ=dz / dist;
		}
	}

	knockDown() {
		this.fallTimer=1.5;
		this.fleeTimer=2.2;
		const angle=Math.random() * Math.PI * 2;
		this.fleeX=Math.sin(angle);
		this.fleeZ=Math.cos(angle);
	}

	pickNextEdge() {
		const node=this.to;
		const options=node.edges.filter((e) => e.len > 6);
		if (!options.length) return;
		let next=options[Math.floor(Math.random() * options.length)];
		if (next === this.edge && options.length > 1) {
			next=options[(options.indexOf(next) + 1) % options.length];
		}
		this.edge=next;
		this.from=node;
		this.to=next.a === node ? next.b : next.a;
		this.s=0;
		if (Math.random() < 0.3) this.side=-this.side;
	}

	update(dt,danger) {
		if (this.fallTimer > 0) {
			this.fallTimer -= dt;
			this.mesh.rotation.x=-Math.PI / 2 * Math.min(1,(1.5 - this.fallTimer) * 5);
			this.mesh.position.y=0.12;
			if (this.fallTimer <= 0) {
				this.mesh.rotation.x=0;
				this.mesh.position.y=0;
			}
			return;
		}
		const running=this.fleeTimer > 0;
		if (danger) this.scare(danger.x,danger.z,danger.radius ?? 9);
		if (this.fleeTimer > 0) {
			this.fleeTimer -= dt;
			this.x += this.fleeX * 6.4 * dt;
			this.z += this.fleeZ * 6.4 * dt;
			this.mesh.position.set(this.x,0,this.z);
			this.mesh.rotation.y=Math.atan2(this.fleeX,this.fleeZ);
			if (this.fleeTimer <= 0) {
				const proj=nearestOnGraph(graph,this.x,this.z);
				this.edge=proj.edge;
				this.from=proj.edge.a;
				this.to=proj.edge.b;
				this.s=proj.t * proj.edge.len;
			}
		} else {
			this.s += this.speed * dt;
			if (this.s >= this.edge.len) this.pickNextEdge();
			this.syncPosition();
		}
		this.bobPhase += dt * (running ? 13 : 7.5);
		const swing=Math.sin(this.bobPhase) * (running ? 0.92 : 0.62);
		const { armL,armR,legL,legR,shinL,shinR }=this.mesh.userData.limbs;
		armL.rotation.x=swing;
		armR.rotation.x=-swing;
		legL.rotation.x=-swing;
		legR.rotation.x=swing;
		shinL.rotation.x=Math.max(0,Math.sin(this.bobPhase)) * (running ? 1.1 : 0.85);
		shinR.rotation.x=Math.max(0,-Math.sin(this.bobPhase)) * (running ? 1.1 : 0.85);
		this.mesh.position.y=Math.abs(Math.sin(this.bobPhase)) * 0.055;
		this.mesh.position.x=Math.max(-242,Math.min(242,this.mesh.position.x));
		this.mesh.position.z=Math.max(-242,Math.min(160,this.mesh.position.z));
		this.x=this.mesh.position.x;
		this.z=this.mesh.position.z;
	}
}

export function createPedestrians(scene,count=22) {
	const people=[];
	for (let i=0; i < count; i += 1) people.push(new Pedestrian(scene,i));
	return people;
}

export function scareCrowd(people,x,z,radius=11) {
	for (const person of people) person.scare(x,z,radius);
}
