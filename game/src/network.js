// network.js — city layout data (river, lake, streets, bridges) and the routing graph.
// Layout truth: river, lake, streets, bridges, routing graph.
// Pure geometry, no imports.

export const RIVER_PTS=[
	[-130,-236],[-144,-180],[-158,-125],[-166,-70],[-164,-15],[-152,40],
	[-138,95],[-130,150],[-128,190],
];
export const RIVER_HALF=18;
export const LAKE={ x: -56,z: 90,rx: 30,rz: 16 };
export const CHANNEL={ x0: -126,x1: -84,z0: 85,z1: 95 };
export const MALL={ x0: -100,x1: 92,z0: -30.5,z1: -13.5 };
export const POOL={ x0: -64,x1: -24,z0: -23.5,z1: -20.5 };
export const OBELISK={ x: -100,z: -22 };

// Roundabouts; their ring streets are ROADS loop entries.
export const CIRCLES=[
	{ x: 58,z: -58,r: 13,w: 9 },
	{ x: 156,z: 24,r: 12,w: 9 },
	{ x: -18,z: -158,r: 12,w: 9 },
];

// The street plan: a grid plus the riverbend avenue, a lake loop,
// the sunset diagonal and three ring streets.
const GRID_X=[-198,-100,-72,-18,16,58,92,130,156,202];
const GRID_Z=[-158,-58,24];
const AVENUE_X=new Set([-18,58,156]);

function ellipsePoints(cx,cz,rx,rz,count) {
	const pts=[];
	for (let i=0; i < count; i += 1) {
		const a=(i / count) * Math.PI * 2;
		pts.push([cx + Math.sin(a) * rx,cz + Math.cos(a) * rz]);
	}
	return pts;
}

export const ROADS=[
	...GRID_X.map((x) => ({ id: `vx${x}`,w: AVENUE_X.has(x) ? 13 : 11,pts: [[x,-232],[x,140]] })),
	...GRID_Z.map((z) => ({ id: `hz${z}`,w: 13,pts: [[-232,z],[232,z]] })),
	{ id: 'hz64',w: 11,pts: [[-116,64],[232,64]] },
	{ id: 'hz140',w: 12,pts: [[-116,140],[232,140]] },
	{ id: 'rv1',w: 10,pts: [
		[-101,-232],[-115,-180],[-129,-125],[-137,-70],[-135,-15],
		[-123,40],[-109,95],[-101,150],[-99,196],
	] },
	{ id: 'dg1',w: 11,pts: [[13,148],[52,-14],[94,-176]] },
	{ id: 'lk1',w: 9,loop: true,pts: ellipsePoints(LAKE.x,LAKE.z,LAKE.rx + 11,LAKE.rz + 11,26) },
	...CIRCLES.map((c,i) => ({ id: `cr${i + 1}`,w: c.w,loop: true,pts: ellipsePoints(c.x,c.z,c.r,c.r,18) })),
];

export const CELL_X=[-232,-198,-100,-72,-18,16,58,92,130,156,202,232];
export const CELL_Z=[-232,-200,-158,-116,-84,-58,-36,-8,24,64,116,140];

// Five crossings; from/to span the water each deck carries.
export const BRIDGES=[
	{ id: 'heights-bridge',axis: 'x',at: -158,from: -178,to: -122 },
	{ id: 'midtown-bridge',axis: 'x',at: -58,from: -194,to: -138 },
	{ id: 'hotel-bridge',axis: 'x',at: 24,from: -184,to: -128 },
	{ id: 'channel-bridge',axis: 'z',at: -100,from: 76,to: 104 },
	{ id: 'lake-bridge',axis: 'z',at: -72,from: 68,to: 112 },
];

// Catmull-Rom smoothing: survey points in, flowing line out,
// `per` samples per span, endpoints held.
export function catmullSample(pts,per=8) {
	const out=[];
	const at=(i) => pts[Math.max(0,Math.min(pts.length - 1,i))];
	for (let i=0; i < pts.length - 1; i += 1) {
		const p=[at(i - 1),at(i),at(i + 1),at(i + 2)];
		for (let s=0; s < per; s += 1) {
			const t=s / per;
			const t2=t * t;
			const t3=t2 * t;
			const pt=[];
			for (let c=0; c < 2; c += 1) {
				pt.push(0.5 * (2 * p[1][c] + (p[2][c] - p[0][c]) * t + (2 * p[0][c] - 5 * p[1][c] + 4 * p[2][c] - p[3][c]) * t2 + (3 * p[1][c] - p[0][c] - 3 * p[2][c] + p[3][c]) * t3));
			}
			out.push(pt);
		}
	}
	out.push([...pts[pts.length - 1]]);
	return out;
}

export const RIVER_LINE=catmullSample(RIVER_PTS,10);

export function distPointSeg(px,pz,ax,az,bx,bz) {
	const abx=bx - ax;
	const abz=bz - az;
	const lenSq=abx * abx + abz * abz;
	let t=lenSq === 0 ? 0 : ((px - ax) * abx + (pz - az) * abz) / lenSq;
	t=Math.max(0,Math.min(1,t));
	return Math.hypot(px - (ax + abx * t),pz - (az + abz * t));
}

export function distToPolyline(px,pz,pts,loop=false) {
	let best=Infinity;
	const n=loop ? pts.length : pts.length - 1;
	for (let i=0; i < n; i += 1) {
		const a=pts[i];
		const b=pts[(i + 1) % pts.length];
		const d=distPointSeg(px,pz,a[0],a[1],b[0],b[1]);
		if (d < best) best=d;
	}
	return best;
}

// Street distance: `dist` to a centreline, `edge` to the asphalt.
export function distToRoads(px,pz) {
	let dist=Infinity;
	let road=null;
	for (const r of ROADS) {
		const d=distToPolyline(px,pz,r.pts,r.loop);
		if (d < dist) {
			dist=d;
			road=r;
		}
	}
	return { dist,edge: dist - (road ? road.w / 2 : 0),road };
}

// Elliptical lake measure: 1 on the shoreline, less inside.
export function lakeNorm(x,z) {
	const dx=(x - LAKE.x) / LAKE.rx;
	const dz=(z - LAKE.z) / LAKE.rz;
	return dx * dx + dz * dz;
}

export function inChannel(x,z,pad=0) {
	return x >= CHANNEL.x0 - pad && x <= CHANNEL.x1 + pad && z >= CHANNEL.z0 - pad && z <= CHANNEL.z1 + pad;
}

export function inMall(x,z,pad=0) {
	return x >= MALL.x0 - pad && x <= MALL.x1 + pad && z >= MALL.z0 - pad && z <= MALL.z1 + pad;
}

function boxDist(x,z,rect) {
	const dx=Math.max(rect.x0 - x,0,x - rect.x1);
	const dz=Math.max(rect.z0 - z,0,z - rect.z1);
	if (dx === 0 && dz === 0) {
		return -Math.min(x - rect.x0,rect.x1 - x,z - rect.z0,rect.z1 - z);
	}
	return Math.hypot(dx,dz);
}

// Signed distance to open water (negative = in it); sea from z=170.
export function waterDist(x,z) {
	let d=distToPolyline(x,z,RIVER_LINE) - RIVER_HALF;
	d=Math.min(d,(Math.sqrt(lakeNorm(x,z)) - 1) * LAKE.rz);
	d=Math.min(d,boxDist(x,z,CHANNEL));
	d=Math.min(d,170 - z);
	return d;
}

// Buildable when clear of asphalt, water and the Mall.
export function groundClear(x,z,margin) {
	return distToRoads(x,z).edge > margin && waterDist(x,z) > margin && !inMall(x,z,margin);
}

// Segment crossing, endpoints included: { t, u, x, z } or null.
export function segCross(a,b,c,d) {
	const d1x=b[0] - a[0];
	const d1z=b[1] - a[1];
	const d2x=d[0] - c[0];
	const d2z=d[1] - c[1];
	const denom=d1x * d2z - d1z * d2x;
	if (Math.abs(denom) < 1e-9) return null;
	const t=((c[0] - a[0]) * d2z - (c[1] - a[1]) * d2x) / denom;
	const u=((c[0] - a[0]) * d1z - (c[1] - a[1]) * d1x) / denom;
	if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
	const tc=Math.max(0,Math.min(1,t));
	return { t: tc,u: Math.max(0,Math.min(1,u)),x: a[0] + d1x * tc,z: a[1] + d1z * tc };
}

export function segSegHit(a,b,c,d) {
	return segCross(a,b,c,d) !== null;
}

function segSegDist(a,b,c,d) {
	if (segSegHit(a,b,c,d)) return 0;
	return Math.min(
		distPointSeg(a[0],a[1],c[0],c[1],d[0],d[1]),distPointSeg(b[0],b[1],c[0],c[1],d[0],d[1]),
		distPointSeg(c[0],c[1],a[0],a[1],b[0],b[1]),distPointSeg(d[0],d[1],a[0],a[1],b[0],b[1]),
	);
}

// Segment-to-box distance (0 when touching).
export function segBoxDist(a,b,minX,maxX,minZ,maxZ) {
	const corners=[[minX,minZ],[maxX,minZ],[maxX,maxZ],[minX,maxZ]];
	const inside=(p) => p[0] >= minX && p[0] <= maxX && p[1] >= minZ && p[1] <= maxZ;
	if (inside(a) || inside(b)) return 0;
	let best=Infinity;
	for (let i=0; i < 4; i += 1) best=Math.min(best,segSegDist(a,b,corners[i],corners[(i + 1) % 4]));
	return best;
}

// A plot is clear when no street, water or Mall green comes
// within `margin` of the box.
export function boxClear(minX,maxX,minZ,maxZ,margin) {
	for (const r of ROADS) {
		const n=r.loop ? r.pts.length : r.pts.length - 1;
		for (let i=0; i < n; i += 1) {
			if (segBoxDist(r.pts[i],r.pts[(i + 1) % r.pts.length],minX,maxX,minZ,maxZ) < r.w / 2 + margin) return false;
		}
	}
	for (let i=0; i < RIVER_LINE.length - 1; i += 1) {
		if (segBoxDist(RIVER_LINE[i],RIVER_LINE[i + 1],minX,maxX,minZ,maxZ) < RIVER_HALF + margin) return false;
	}
	const cx=(minX + maxX) / 2;
	const cz=(minZ + maxZ) / 2;
	const probes=[
		[minX,minZ],[maxX,minZ],[minX,maxZ],[maxX,maxZ],[cx,cz],
		[cx,minZ],[cx,maxZ],[minX,cz],[maxX,cz],
	];
	for (const [px,pz] of probes) {
		if (waterDist(px,pz) < margin) return false;
		if (inMall(px,pz,margin)) return false;
		if (inChannel(px,pz,margin)) return false;
	}
	return true;
}

// --- Routing graph: chains resampled to CHAIN_STEP, crossings
// spliced in exactly, near points merged into junctions.
const CHAIN_STEP=30;
const MERGE_DIST=3;

function chainPoints(road,crossings) {
	const pts=road.pts;
	const chain=[];
	const segCount=road.loop ? pts.length : pts.length - 1;
	for (let i=0; i < segCount; i += 1) {
		const a=pts[i];
		const b=pts[(i + 1) % pts.length];
		const marks=[{ t: 0,x: a[0],z: a[1] }];
		for (const hit of crossings) {
			if (hit.road === road && hit.seg === i) marks.push(hit);
		}
		const segLen=Math.hypot(b[0] - a[0],b[1] - a[1]);
		const steps=Math.max(1,Math.ceil(segLen / CHAIN_STEP));
		for (let s=1; s < steps; s += 1) marks.push({ t: s / steps,x: a[0] + (b[0] - a[0]) * (s / steps),z: a[1] + (b[1] - a[1]) * (s / steps) });
		marks.sort((m,n) => m.t - n.t);
		for (const m of marks) chain.push([m.x,m.z]);
	}
	if (!road.loop) chain.push([...pts[pts.length - 1]]);
	return chain;
}

function findCrossings() {
	const hits=[];
	const segs=[];
	for (const road of ROADS) {
		const n=road.loop ? road.pts.length : road.pts.length - 1;
		for (let i=0; i < n; i += 1) {
			segs.push({ road,seg: i,a: road.pts[i],b: road.pts[(i + 1) % road.pts.length] });
		}
	}
	for (let i=0; i < segs.length; i += 1) {
		for (let j=i + 1; j < segs.length; j += 1) {
			const s=segs[i];
			const t=segs[j];
			if (s.road === t.road) continue;
			const hit=segCross(s.a,s.b,t.a,t.b);
			if (!hit) continue;
			hits.push({ road: s.road,seg: s.seg,t: hit.t,x: hit.x,z: hit.z });
			hits.push({ road: t.road,seg: t.seg,t: hit.u,x: hit.x,z: hit.z });
		}
	}
	return hits;
}

export function buildGraph() {
	const crossings=findCrossings();
	const nodes=new Map();
	const nodeList=[];
	function nodeAt(x,z) {
		let found=null;
		let foundDist=MERGE_DIST;
		for (const nd of nodeList) {
			const d=Math.hypot(nd.x - x,nd.z - z);
			if (d < foundDist) {
				foundDist=d;
				found=nd;
			}
		}
		if (found) return found;
		const nd={ key: `${Math.round(x)},${Math.round(z)}`,x,z,edges: [] };
		nodeList.push(nd);
		nodes.set(nd.key,nd);
		return nd;
	}
	const edgeKeys=new Set();
	const edges=[];
	function link(a,b) {
		if (a === b) return;
		const key=a.key < b.key ? `${a.key}|${b.key}` : `${b.key}|${a.key}`;
		if (edgeKeys.has(key)) return;
		edgeKeys.add(key);
		const edge={ a,b,len: Math.hypot(b.x - a.x,b.z - a.z) };
		edges.push(edge);
		a.edges.push(edge);
		b.edges.push(edge);
	}
	for (const road of ROADS) {
		const chain=chainPoints(road,crossings).map(([x,z]) => nodeAt(x,z));
		const n=road.loop ? chain.length : chain.length - 1;
		for (let i=0; i < n; i += 1) link(chain[i],chain[(i + 1) % chain.length]);
	}
	return { nodes,edges };
}

// Closest graph point to (x,z), with the edge's near/far nodes.
export function nearestOnGraph(graph,x,z) {
	let best=null;
	for (const edge of graph.edges) {
		const { a,b }=edge;
		const abx=b.x - a.x;
		const abz=b.z - a.z;
		const lenSq=abx * abx + abz * abz;
		let t=lenSq === 0 ? 0 : ((x - a.x) * abx + (z - a.z) * abz) / lenSq;
		t=Math.max(0,Math.min(1,t));
		const px=a.x + abx * t;
		const pz=a.z + abz * t;
		const d=Math.hypot(x - px,z - pz);
		if (!best || d < best.d) {
			const da=Math.hypot(x - a.x,z - a.z);
			const db=Math.hypot(x - b.x,z - b.z);
			best={ edge,t,x: px,z: pz,d,near: da <= db ? a : b,far: da <= db ? b : a };
		}
	}
	return best;
}

// Dijkstra over junctions: node list start->goal, or null.
export function shortestPath(graph,start,goal) {
	if (start === goal) return [start];
	const dist=new Map([[start,0]]);
	const prev=new Map();
	const settled=new Set();
	for (;;) {
		let current=null;
		let bestDist=Infinity;
		for (const [nd,d] of dist) {
			if (!settled.has(nd) && d < bestDist) {
				bestDist=d;
				current=nd;
			}
		}
		if (current === null) return null;
		if (current === goal) break;
		settled.add(current);
		for (const edge of current.edges) {
			const other=edge.a === current ? edge.b : edge.a;
			const next=bestDist + edge.len;
			if (next < (dist.get(other) ?? Infinity)) {
				dist.set(other,next);
				prev.set(other,current);
			}
		}
	}
	const path=[goal];
	let cursor=goal;
	while (cursor !== start) {
		cursor=prev.get(cursor);
		if (cursor === undefined) return null;
		path.unshift(cursor);
	}
	return path;
}
