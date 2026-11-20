// Road network: the one layout source. Pure data + geometry.

export const RIVER_PTS=[[-130,-236],[-144,-180],[-158,-125],[-166,-70],[-164,-15],[-152,40],[-138,95],[-130,150],[-128,190]];
export const RIVER_HALF=18;
export const LAKE={ x: -56,z: 90,rx: 30,rz: 16 };
export const CHANNEL={ x0: -126,x1: -84,z0: 85,z1: 95 };
export const MALL={ x0: -100,x1: 92,z0: -30.5,z1: -13.5 };
export const POOL={ x0: -64,x1: -24,z0: -23.5,z1: -20.5 };
export const OBELISK={ x: -100,z: -22 };
export const CIRCLES=[
	{ x: -100,z: -22,r: 15,w: 13 },
	{ x: 127,z: -116,r: 12,w: 12 },
];

export const ROADS=[
	{ id: 'vx-198',w: 11,pts: [[-198,-232],[-198,140]] },
	{ id: 'vx-100',w: 13,pts: [[-100,-232],[-100,140]] },
	{ id: 'vx-72',w: 13,pts: [[-72,-232],[-72,140]] },
	{ id: 'vx-18',w: 13,pts: [[-18,-232],[-18,140]] },
	{ id: 'vx16',w: 13,pts: [[16,-232],[16,140]] },
	{ id: 'vx58',w: 13,pts: [[58,-232],[58,140]] },
	{ id: 'vx92',w: 13,pts: [[92,-232],[92,140]] },
	{ id: 'vx130',w: 12,pts: [[130,-232],[130,140]] },
	{ id: 'vx156',w: 12,pts: [[156,-232],[156,140]] },
	{ id: 'vx202',w: 12,pts: [[202,-232],[202,140]] },
	{ id: 'hz-200w',w: 11,pts: [[-216,-200],[-162,-200]] },
	{ id: 'hz-200e',w: 11,pts: [[-140,-200],[232,-200]] },
	{ id: 'hz-158',w: 13,pts: [[-216,-158],[232,-158]] },
	{ id: 'hz-116w',w: 12,pts: [[-216,-116],[-182,-116]] },
	{ id: 'hz-116e',w: 12,pts: [[-132,-116],[232,-116]] },
	{ id: 'hz-84w',w: 12,pts: [[-216,-84],[-188,-84]] },
	{ id: 'hz-84e',w: 12,pts: [[-124,-84],[232,-84]] },
	{ id: 'hz-58',w: 13,pts: [[-216,-58],[232,-58]] },
	{ id: 'hz-36w',w: 11,pts: [[-216,-36],[-188,-36]] },
	{ id: 'hz-36e',w: 11,pts: [[-108,-36],[232,-36]] },
	{ id: 'hz-8w',w: 11,pts: [[-216,-8],[-190,-8]] },
	{ id: 'hz-8e',w: 11,pts: [[-108,-8],[232,-8]] },
	{ id: 'hz24',w: 13,pts: [[-216,24],[232,24]] },
	{ id: 'hz64w',w: 12,pts: [[-216,64],[-170,64]] },
	{ id: 'hz64e',w: 12,pts: [[-124,64],[232,64]] },
	{ id: 'hz116e',w: 12,pts: [[-108,116],[232,116]] },
	{ id: 'hz116w',w: 12,pts: [[-216,116],[-162,116]] },
	{ id: 'prom',w: 9,pts: [[-216,140],[-158,140]] },
	{ id: 'prom-e',w: 9,pts: [[-104,140],[232,140]] },
	{ id: 'diag1',w: 12,pts: [[-100,-22],[176,118]] },
	{ id: 'diag2',w: 12,pts: [[24,-36],[186,-162]] },
	{ id: 'riverbend-n',w: 11,pts: [[-100,-22],[-110,-62],[-124,-108],[-128,-140],[-128,-158]] },
	{ id: 'riverbend-s',w: 11,pts: [[-100,-22],[-112,26],[-118,72],[-108,116],[-104,140]] },
	{ id: 'westbank',w: 11,pts: [[-184,-158],[-188,-125],[-196,-70],[-194,-15],[-182,40],[-168,95],[-160,140]] },
	{ id: 'heights-curve',w: 12,pts: [[-210,-196],[-150,-206],[-80,-200],[-10,-194],[60,-188],[130,-178],[186,-162],[216,-152]] },
	{ id: 'lake-loop',w: 11,loop: true,pts: [] },
];
{
	
	const pts=[];
	for (let i=0; i < 24; i += 1) {
		const a=(i / 24) * Math.PI * 2;
		pts.push([LAKE.x + Math.cos(a) * (LAKE.rx + 11),LAKE.z + Math.sin(a) * (LAKE.rz + 11)]);
	}
	ROADS[ROADS.length - 1].pts=pts;
	for (const c of CIRCLES) {
		const ring=[];
		for (let i=0; i < 20; i += 1) {
			const a=(i / 20) * Math.PI * 2;
			ring.push([c.x + Math.cos(a) * c.r,c.z + Math.sin(a) * c.r]);
		}
		ROADS.push({ id: `circle-${c.x}`,w: c.w,loop: true,pts: ring });
	}
}

export const CELL_X=[-232,-198,-100,-72,-18,16,58,92,130,156,202,232];
export const CELL_Z=[-232,-200,-158,-116,-84,-58,-36,-8,24,64,116,140];

export const BRIDGES=[
	{ id: 'heights-bridge',axis: 'x',at: -158,from: -186,to: -130 },
	{ id: 'midtown-bridge',axis: 'x',at: -58,from: -192,to: -139 },
	{ id: 'hotel-bridge',axis: 'x',at: 24,from: -181,to: -128 },
	{ id: 'channel-bridge',axis: 'z',at: -100,from: 79,to: 101 },
	{ id: 'lake-bridge',axis: 'z',at: -72,from: 68,to: 112 },
];

export function catmullSample(pts,per=8) {
	const out=[];
	const P=(i) => pts[Math.max(0,Math.min(pts.length - 1,i))];
	for (let s=0; s < pts.length - 1; s += 1) {
		for (let i=0; i < per; i += 1) {
			const t=i / per;
			const [p0,p1,p2,p3]=[P(s - 1),P(s),P(s + 1),P(s + 2)];
			const xy=[0,1].map((k) => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t));
			out.push(xy);
		}
	}
	out.push([...pts[pts.length - 1]]);
	return out;
}
export const RIVER_LINE=catmullSample(RIVER_PTS,10);

export function distPointSeg(px,pz,ax,az,bx,bz) {
	const dx=bx - ax;
	const dz=bz - az;
	const len2=dx * dx + dz * dz || 1;
	let t=((px - ax) * dx + (pz - az) * dz) / len2;
	t=Math.max(0,Math.min(1,t));
	const x=ax + dx * t;
	const z=az + dz * t;
	return { d: Math.hypot(px - x,pz - z),t,x,z };
}
export function distToPolyline(px,pz,pts,loop=false) {
	let best={ d: Infinity,t: 0,x: px,z: pz,seg: 0 };
	const n=loop ? pts.length : pts.length - 1;
	for (let i=0; i < n; i += 1) {
		const a=pts[i];
		const b=pts[(i + 1) % pts.length];
		const r=distPointSeg(px,pz,a[0],a[1],b[0],b[1]);
		if (r.d < best.d) best={ ...r,seg: i };
	}
	return best;
}
export function distToRoads(px,pz) {
	let best=Infinity;
	let half=0;
	for (const road of ROADS) {
		const r=distToPolyline(px,pz,road.pts,road.loop);
		if (r.d - road.w / 2 < best) { best=r.d - road.w / 2; half=road.w / 2; }
	}
	return { edge: best,half };
}
export function lakeNorm(x,z) {
	const dx=(x - LAKE.x) / LAKE.rx;
	const dz=(z - LAKE.z) / LAKE.rz;
	return Math.hypot(dx,dz);
}
export function inChannel(x,z,pad=0) {
	return x > CHANNEL.x0 - pad && x < CHANNEL.x1 + pad && z > CHANNEL.z0 - pad && z < CHANNEL.z1 + pad;
}
export function inMall(x,z,pad=0) {
	return x > MALL.x0 - pad && x < MALL.x1 + pad && z > MALL.z0 - pad && z < MALL.z1 + pad;
}
export function waterDist(x,z) {
	
	let d=distToPolyline(x,z,RIVER_LINE).d - RIVER_HALF;
	const ln=lakeNorm(x,z);
	d=Math.min(d,(ln - 1) * Math.min(LAKE.rx,LAKE.rz));
	if (inChannel(x,z)) d=Math.min(d,-1);
	else {
		const cx=Math.max(CHANNEL.x0,Math.min(x,CHANNEL.x1));
		const cz=Math.max(CHANNEL.z0,Math.min(z,CHANNEL.z1));
		d=Math.min(d,Math.hypot(x - cx,z - cz));
	}
	if (z > 172) d=Math.min(d,172 - z);
	return d;
}

export function groundClear(x,z,margin) {
	if (distToRoads(x,z).edge < margin) return false;
	if (waterDist(x,z) < margin * 0.6) return false;
	if (inMall(x,z,margin * 0.5) && !inChannel(x,z)) return false;
	for (const c of CIRCLES) if (Math.hypot(x - c.x,z - c.z) < c.r + c.w / 2 + margin) return false;
	return true;
}

export function boxClear(minX,maxX,minZ,maxZ,margin) {
	const pts=[[minX,minZ],[maxX,minZ],[minX,maxZ],[maxX,maxZ],[(minX + maxX) / 2,(minZ + maxZ) / 2],[minX,(minZ + maxZ) / 2],[maxX,(minZ + maxZ) / 2],[(minX + maxX) / 2,minZ],[(minX + maxX) / 2,maxZ]];
	for (const [x,z] of pts) if (!groundClear(x,z,margin)) return false;
	
	
	for (const road of ROADS) {
		const n=road.loop ? road.pts.length : road.pts.length - 1;
		for (let i=0; i < n; i += 1) {
			const a=road.pts[i];
			const b=road.pts[(i + 1) % road.pts.length];
			if (segBoxDist(a,b,minX,maxX,minZ,maxZ) < road.w / 2 + margin) return false;
		}
	}
	const n=RIVER_LINE.length - 1;
	for (let i=0; i < n; i += 1) {
		if (segBoxDist(RIVER_LINE[i],RIVER_LINE[i + 1],minX,maxX,minZ,maxZ) < RIVER_HALF + margin) return false;
	}
	return true;
}
export function segBoxDist(a,b,minX,maxX,minZ,maxZ) {
	
	const inside=(x,z) => x >= minX && x <= maxX && z >= minZ && z <= maxZ;
	if (inside(a[0],a[1]) || inside(b[0],b[1])) return 0;
	let d=Math.min(distPointSeg(a[0],a[1],minX,minZ,maxX,minZ).d,distPointSeg(a[0],a[1],minX,maxZ,maxX,maxZ).d,distPointSeg(a[0],a[1],minX,minZ,minX,maxZ).d,distPointSeg(a[0],a[1],maxX,minZ,maxX,maxZ).d);
	d=Math.min(d,distPointSeg(b[0],b[1],minX,minZ,maxX,minZ).d,distPointSeg(b[0],b[1],minX,maxZ,maxX,maxZ).d,distPointSeg(b[0],b[1],minX,minZ,minX,maxZ).d,distPointSeg(b[0],b[1],maxX,minZ,maxX,maxZ).d);
	for (const [cx,cz] of [[minX,minZ],[maxX,minZ],[minX,maxZ],[maxX,maxZ]]) {
		d=Math.min(d,distPointSeg(cx,cz,a[0],a[1],b[0],b[1]).d);
	}
	
	if (segSegHit(a,b,[minX,minZ],[maxX,minZ]) || segSegHit(a,b,[minX,maxZ],[maxX,maxZ]) || segSegHit(a,b,[minX,minZ],[minX,maxZ]) || segSegHit(a,b,[maxX,minZ],[maxX,maxZ])) return 0;
	return d;
}
export function segSegHit(a,b,c,d) {
	const r=[b[0] - a[0],b[1] - a[1]];
	const s=[d[0] - c[0],d[1] - c[1]];
	const den=r[0] * s[1] - r[1] * s[0];
	if (Math.abs(den) < 1e-9) return null;
	const t=((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
	const u=((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
	if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return [a[0] + r[0] * t,a[1] + r[1] * t];
	return null;
}

let graphCache=null;
export function buildGraph() {
	if (graphCache) return graphCache;
	const nodes=new Map();
	const keyOf=(x,z) => `${Math.round(x * 2) / 2},${Math.round(z * 2) / 2}`;
	function nodeAt(x,z) {
		const k=keyOf(x,z);
		if (!nodes.has(k)) nodes.set(k,{ key: k,x: Math.round(x * 2) / 2,z: Math.round(z * 2) / 2,edges: [] });
		return nodes.get(k);
	}
	
	const splits=ROADS.map((road) => road.pts.map(() => [0,1]));
	function addSplit(ri,si,t) {
		if (t > 0.001 && t < 0.999) splits[ri][si].push(t);
	}
	const segs=[];
	ROADS.forEach((road,ri) => {
		const n=road.loop ? road.pts.length : road.pts.length - 1;
		for (let i=0; i < n; i += 1) segs.push({ ri,si: i,a: road.pts[i],b: road.pts[(i + 1) % road.pts.length] });
	});
	for (let i=0; i < segs.length; i += 1) {
		for (let j=i + 1; j < segs.length; j += 1) {
			const s=segs[i];
			const t2=segs[j];
			if (s.ri === t2.ri) continue;
			const hit=segSegHit(s.a,s.b,t2.a,t2.b);
			if (hit) {
				const ts=distPointSeg(hit[0],hit[1],s.a[0],s.a[1],s.b[0],s.b[1]).t;
				const tt=distPointSeg(hit[0],hit[1],t2.a[0],t2.a[1],t2.b[0],t2.b[1]).t;
				addSplit(s.ri,s.si,ts);
				addSplit(t2.ri,t2.si,tt);
			}
		}
	}
	
	for (const c of CIRCLES) nodeAt(c.x,c.z);
	const edgeSet=new Set();
	const edges=[];
	function addEdge(p,q) {
		const a=nodeAt(p[0],p[1]);
		const b=nodeAt(q[0],q[1]);
		if (a === b) return;
		const k=a.key < b.key ? `${a.key}|${b.key}` : `${b.key}|${a.key}`;
		if (edgeSet.has(k)) return;
		edgeSet.add(k);
		const e={ a,b,len: Math.hypot(b.x - a.x,b.z - a.z) };
		a.edges.push(e);
		b.edges.push(e);
		edges.push(e);
	}
	ROADS.forEach((road,ri) => {
		const n=road.loop ? road.pts.length : road.pts.length - 1;
		for (let i=0; i < n; i += 1) {
			const a=road.pts[i];
			const b=road.pts[(i + 1) % road.pts.length];
			const ts=[...new Set(splits[ri][i])].sort((x,y) => x - y);
			let prev=a;
			for (const t of ts) {
				const p=[a[0] + (b[0] - a[0]) * t,a[1] + (b[1] - a[1]) * t];
				addEdge(prev,p);
				prev=p;
			}
			addEdge(prev,b);
		}
	});
	
	for (const c of CIRCLES) {
		const centre=nodeAt(c.x,c.z);
		const near=[...nodes.values()].filter((nd) => nd !== centre && Math.abs(Math.hypot(nd.x - c.x,nd.z - c.z) - c.r) < 2.5);
		for (const nd of near.slice(0,8)) addEdge([c.x,c.z],[nd.x,nd.z]);
	}
	graphCache={ nodes,edges,keyOf };
	return graphCache;
}
export function nearestOnGraph(graph,x,z) {
	
	let best=null;
	for (const e of graph.edges) {
		const r=distPointSeg(x,z,e.a.x,e.a.z,e.b.x,e.b.z);
		if (!best || r.d < best.d) best={ ...r,edge: e,near: r.t < 0.5 ? e.a : e.b,far: r.t < 0.5 ? e.b : e.a };
	}
	return best;
}
export function shortestPath(graph,start,goal) {
	const dist=new Map([[start.key,0]]);
	const prev=new Map();
	const open=new Set([start]);
	while (open.size) {
		let cur=null;
		let cd=Infinity;
		for (const nd of open) if (dist.get(nd.key) < cd) { cd=dist.get(nd.key); cur=nd; }
		open.delete(cur);
		if (cur === goal) break;
		for (const e of cur.edges) {
			const other=e.a === cur ? e.b : e.a;
			const nd2=cd + e.len;
			if (nd2 < (dist.get(other.key) ?? Infinity)) {
				dist.set(other.key,nd2);
				prev.set(other.key,{ node: cur,edge: e });
				open.add(other);
			}
		}
	}
	if (!prev.has(goal.key) && goal !== start) return null;
	const path=[goal];
	let cur=goal;
	while (cur !== start) {
		cur=prev.get(cur.key).node;
		path.unshift(cur);
	}
	return path;
}
