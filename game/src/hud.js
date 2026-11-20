// HUD + maps: minimap and full city map share one 1:1 painted base.

import { CITY_HALF,districtAt,LANDMARKS } from './city.js';
import { ROADS,RIVER_LINE,RIVER_HALF,LAKE,CHANNEL,MALL,CELL_X,CELL_Z,BRIDGES,buildGraph,nearestOnGraph,shortestPath } from './network.js';

const MAP_RANGE=CITY_HALF + 26;
const STREETS=[
	['唐人街大道 CHINATOWN AVE',58,-70,Math.PI / 2],['中央綠軸大道 MALL AVE',0,-36,0],
	['濱海大道 SEASIDE AVE',40,140,0],
	['老城大道 OLD TOWN AVE',156,-40,Math.PI / 2],['湖濱環路 LAKE LOOP',-56,60,0],
	['河濱大道 RIVERBEND AVE',-120,-84,1.2],['斜陽大道 SUNSET DIAG',38,46,0.47],
	['索爾瑪大道 SOLMAR AVE',-18,66,Math.PI / 2],
];
const MARKS=[
	...LANDMARKS.map((lm) => [lm.name,lm.x,lm.z,0,'街區地標。']),
	['日晷尖塔 SUNDIAL SPIRE',-100,-22,1,'綠軸西端尖塔。'],
	['大會堂 THE ASSEMBLY',114,-22,2,'綠軸東端大會堂。'],
	['牌樓 PAIFANG GATE',78,-22,3,'唐人街東牌樓。'],
	['牌樓 PAIFANG GATE',-86,-22,3,'唐人街西牌樓。'],
	['夜市 NIGHT MARKET',-40,-30,3,'綠軸南側夜市攤位。'],
	['湖心亭 LAKE PAVILION',-56,90,3,'湖心中式涼亭。'],
];
const TINTS={ Heights: '#66707c',Marina: '#7d8f57',Westbank: '#4e7a3e','Lake Solmar': '#4e7a3e','唐人街 Old Town': '#8a5a34','唐人街 The Mall': '#57a047','唐人街 Core': '#86543c' };
const graph=buildGraph();
let routeCache={ key: '',pts: null,len: 0 };
function routeTo(fx,fz,tx,tz) {
	const key=`${Math.round(fx / 14)},${Math.round(fz / 14)},${tx},${tz}`;
	if (routeCache.key === key) return routeCache;
	const a=nearestOnGraph(graph,fx,fz);
	const b=nearestOnGraph(graph,tx,tz);
	const path=shortestPath(graph,a.near,b.near) ?? shortestPath(graph,a.far,b.far);
	const pts=[[fx,fz]];
	if (path) {
		pts.push([a.x,a.z]);
		for (const n of path) pts.push([n.x,n.z]);
		pts.push([b.x,b.z]);
	}
	pts.push([tx,tz]);
	let len=0;
	for (let i=1; i < pts.length; i += 1) len += Math.hypot(pts[i][0] - pts[i - 1][0],pts[i][1] - pts[i - 1][1]);
	routeCache={ key,pts,len: Math.round(len) };
	return routeCache;
}

export function createHud(decor={ parks: [],lots: [] }) {
	const elements={
		stars: document.getElementById('hud-stars'),
		cash: document.getElementById('hud-cash'),
		healthFill: document.getElementById('hud-health-fill'),
		armourFill: document.getElementById('hud-armour-fill'),
		objective: document.getElementById('hud-objective'),
		message: document.getElementById('hud-message'),
		speed: document.getElementById('hud-speed'),
		prompt: document.getElementById('hud-prompt'),
		clock: document.getElementById('hud-clock'),
		minimap: document.getElementById('minimap'),
	};
	const mapCtx=elements.minimap.getContext('2d');
	const mapSize=elements.minimap.width;

	function paintBase(size) {
		const cv=document.createElement('canvas');
		cv.width=size;
		cv.height=size;
		const ctx=cv.getContext('2d');
		const sc=size / (MAP_RANGE * 2);
		const W=(x,z) => [(x + MAP_RANGE) * sc,(z + MAP_RANGE) * sc];
		const trace=(pts,loop=false) => {
			ctx.beginPath();
			pts.forEach(([x,z],i) => { const p=W(x,z); if (i === 0) ctx.moveTo(p[0],p[1]); else ctx.lineTo(p[0],p[1]); });
			if (loop) ctx.closePath();
		};
		ctx.fillStyle='#446636';
		ctx.fillRect(0,0,size,size);
		for (let i=0; i < CELL_X.length - 1; i += 1) {
			for (let j=0; j < CELL_Z.length - 1; j += 1) {
				const a=W(CELL_X[i] + 7,CELL_Z[j] + 7);
				const b=W(CELL_X[i + 1] - 7,CELL_Z[j + 1] - 7);
				if (b[0] - a[0] < 2 || b[1] - a[1] < 2) continue;
				ctx.fillStyle=TINTS[districtAt((CELL_X[i] + CELL_X[i + 1]) / 2,(CELL_Z[j] + CELL_Z[j + 1]) / 2)] ?? '#57743f';
				ctx.fillRect(a[0],a[1],b[0] - a[0],b[1] - a[1]);
			}
		}
		for (const [rects,style] of [[decor.parks,'#57a047'],[decor.lots,'rgba(70,66,60,0.55)']]) {
			ctx.fillStyle=style;
			for (const r of rects) {
				const a=W(r.x0,r.z0); const b=W(r.x1,r.z1);
				ctx.fillRect(a[0],a[1],b[0] - a[0],b[1] - a[1]);
			}
		}
		{
			const a=W(MALL.x0,MALL.z0); const b=W(MALL.x1,MALL.z1);
			ctx.fillStyle='#63b04e';
			ctx.fillRect(a[0],a[1],b[0] - a[0],b[1] - a[1]);
		}
		const shore=W(0,150);
		ctx.fillStyle='#227fa5';
		ctx.fillRect(0,shore[1],size,size - shore[1]);
		ctx.fillStyle='#eed9a4';
		ctx.fillRect(0,W(0,138)[1],size,shore[1] - W(0,138)[1]);
		ctx.strokeStyle='#2b93b8';
		ctx.lineCap='round';
		ctx.lineJoin='round';
		ctx.lineWidth=RIVER_HALF * 2 * sc;
		trace(RIVER_LINE);
		ctx.stroke();
		ctx.fillStyle='#2b93b8';
		ctx.beginPath();
		const lakeC=W(LAKE.x,LAKE.z);
		ctx.ellipse(lakeC[0],lakeC[1],LAKE.rx * sc,LAKE.rz * sc,0,0,Math.PI * 2);
		ctx.fill();
		const chA=W(CHANNEL.x0,CHANNEL.z0);
		const chB=W(CHANNEL.x1,CHANNEL.z1);
		ctx.fillRect(chA[0],chA[1],chB[0] - chA[0],chB[1] - chA[1]);
		ctx.fillStyle='#c9a227';
		for (const br of BRIDGES) {
			const a=br.axis === 'x' ? W(br.from,br.at - 3) : W(br.at - 3,br.from);
			const b=br.axis === 'x' ? W(br.to,br.at + 3) : W(br.at + 3,br.to);
			ctx.fillRect(a[0],a[1],b[0] - a[0],b[1] - a[1]);
		}
		for (const [style,extra] of [['#24282e',2.2],['#4d545e',0]]) {
			ctx.strokeStyle=style;
			for (const road of ROADS) {
				ctx.lineWidth=Math.max(1.6,road.w * sc + extra);
				trace(road.pts,road.loop);
				ctx.stroke();
			}
		}
		if (size > 400) {
			ctx.textAlign='center';
			ctx.fillStyle='rgba(255,255,255,0.95)';
			ctx.font='bold 21px Verdana, sans-serif';
			for (const [text,x,z] of [['高地 HEIGHTS',-30,-204],['老城 OLD TOWN',178,-66],['唐人街 CHINATOWN',58,-118],['西岸 WESTBANK',-196,96],['索爾瑪湖 LAKE SOLMAR',-56,128],['碼頭 MARINA',80,132],['中央綠軸 THE MALL',4,-24]]) {
				const p=W(x,z);
				ctx.fillText(text,p[0],p[1]);
			}
			ctx.font='bold 15px Verdana, sans-serif';
			ctx.fillStyle='rgba(255,233,168,0.92)';
			for (const [text,x,z,ang] of STREETS) {
				const p=W(x,z);
				ctx.save();
				ctx.translate(p[0],p[1]);
				ctx.rotate(ang);
				ctx.fillText(text,0,0);
				ctx.restore();
			}
		}
		return cv;
	}
	const miniBase=paintBase(mapSize);
	const bigBase=paintBase(940);
	const bigScale=940 / (MAP_RANGE * 2);
	let customTarget=null;
	let lastView=null;

	function mark(ctx,kind,x,y,k=7) {
		ctx.beginPath();
		if (kind === 1) { ctx.moveTo(x,y - k); ctx.lineTo(x + k,y + k); ctx.lineTo(x - k,y + k); }
		else if (kind === 2) ctx.rect(x - k * 0.8,y - k * 0.8,k * 1.6,k * 1.6);
		else if (kind === 3) { ctx.moveTo(x,y - k); ctx.lineTo(x + k,y); ctx.lineTo(x,y + k); ctx.lineTo(x - k,y); }
		else ctx.arc(x,y,k * 0.74,0,Math.PI * 2);
		ctx.closePath();
		ctx.fill();
	}
	function drawMarkers(ctx,W2,view,dense) {
		const target=customTarget ?? view.missionTarget;
		if (target) {
			const route=routeTo(view.playerPos.x,view.playerPos.z,target.x,target.z);
			ctx.strokeStyle='#ffd23f';
			ctx.lineWidth=2.4;
			ctx.beginPath();
			route.pts.forEach(([x,z],i) => { const p=W2(x,z); if (i === 0) ctx.moveTo(p[0],p[1]); else ctx.lineTo(p[0],p[1]); });
			ctx.stroke();
			const p=W2(target.x,target.z);
			const r=5 + Math.sin(performance.now() / 240) * 1.4;
			ctx.fillStyle='#ffd23f';
			mark(ctx,3,p[0],p[1],r);
			ctx.fillStyle='#fff2b0';
			ctx.font='bold 10px Verdana, sans-serif';
			ctx.textAlign='center';
			ctx.fillText(`${route.len} m`,p[0],p[1] - r - 3);
		}
		ctx.fillStyle='#e8e8e8';
		for (const car of view.cars) {
			const p=W2(car.mesh.position.x,car.mesh.position.z);
			ctx.fillRect(p[0] - 1.6,p[1] - 1.6,3.2,3.2);
		}
		for (const cop of view.police) {
			const p=W2(cop.mesh.position.x,cop.mesh.position.z);
			ctx.fillStyle='#ffffff';
			ctx.beginPath(); ctx.arc(p[0],p[1],3.4,0,Math.PI * 2); ctx.fill();
			ctx.fillStyle='#3d8bff';
			ctx.beginPath(); ctx.arc(p[0],p[1],2.5,0,Math.PI * 2); ctx.fill();
		}
		if (dense) {
			ctx.fillStyle='#ffd9a0';
			for (const person of view.pedestrians) {
				const p=W2(person.mesh.position.x,person.mesh.position.z);
				ctx.fillRect(p[0] - 1,p[1] - 1,2,2);
			}
		}
		if (view.rivals) {
			for (const rival of view.rivals) {
				const p=W2(rival.x,rival.z);
				ctx.fillStyle=rival.down ? '#7a7a7a' : '#ff4455';
				ctx.beginPath(); ctx.arc(p[0],p[1],2.6,0,Math.PI * 2); ctx.fill();
			}
		}
		const player=W2(view.playerPos.x,view.playerPos.z);
		ctx.save();
		ctx.translate(player[0],player[1]);
		ctx.rotate(-view.playerHeading + Math.PI);
		ctx.fillStyle='#ffffff';
		ctx.strokeStyle='#111111';
		ctx.beginPath();
		ctx.moveTo(0,-6);
		ctx.lineTo(4.2,5);
		ctx.lineTo(0,2.6);
		ctx.lineTo(-4.2,5);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
		ctx.restore();
	}
	function drawMinimap(view) {
		const ctx=mapCtx;
		ctx.drawImage(miniBase,0,0);
		const sc=mapSize / (MAP_RANGE * 2);
		drawMarkers(ctx,(x,z) => [(x + MAP_RANGE) * sc,(z + MAP_RANGE) * sc],view,false);
		const district=districtAt(view.playerPos.x,view.playerPos.z);
		ctx.font='bold 11px Verdana, sans-serif';
		ctx.textAlign='center';
		ctx.textBaseline='bottom';
		ctx.fillStyle='rgba(0,0,0,0.55)';
		ctx.fillText(district.toUpperCase(),mapSize / 2 + 1,mapSize - 4);
		ctx.fillStyle='#ffffff';
		ctx.fillText(district.toUpperCase(),mapSize / 2,mapSize - 5);
	}

	const big=document.createElement('canvas');
	big.width=900;
	big.height=900;
	big.style.cssText='position:fixed;inset:0;margin:auto;z-index:6;display:none;width:min(94vh,96vw);border:2px solid #ffd23f;border-radius:12px;background:#446636';
	document.body.appendChild(big);
	const bigCtx=big.getContext('2d');
	const bv={ cx: 0,cz: 0,z: 1,open: false,sel: null };
	const bigW=(x,z) => {
		const sc=900 / (MAP_RANGE * 2) * bv.z;
		return [450 + (x - bv.cx) * sc,450 + (z - bv.cz) * sc];
	};
	function drawBig(view) {
		const ctx=bigCtx;
		const sc=900 / (MAP_RANGE * 2) * bv.z;
		const half=450 / sc;
		ctx.fillStyle='#22331f';
		ctx.fillRect(0,0,900,900);
		ctx.drawImage(bigBase,(bv.cx - half + MAP_RANGE) * bigScale,(bv.cz - half + MAP_RANGE) * bigScale,half * 2 * bigScale,half * 2 * bigScale,0,0,900,900);
		ctx.font='bold 13px Verdana, sans-serif';
		ctx.textAlign='center';
		for (const m of MARKS) {
			const p=bigW(m[1],m[2]);
			if (p[0] < -20 || p[0] > 920 || p[1] < -20 || p[1] > 920) continue;
			ctx.fillStyle='#ffd23f';
			mark(ctx,m[3],p[0],p[1]);
			ctx.fillStyle='rgba(0,0,0,0.55)';
			ctx.fillText(m[0],p[0] + 1,p[1] - 10);
			ctx.fillStyle='#ffffff';
			ctx.fillText(m[0],p[0],p[1] - 11);
		}
		drawMarkers(ctx,bigW,view,true);
		ctx.fillStyle='#ffffff';
		ctx.font='bold 15px Verdana, sans-serif';
		ctx.textAlign='left';
		ctx.fillRect(24,866,50 * sc,5);
		ctx.fillText('50 m',24,854);
		ctx.fillText('金線=導航 · 藍點=警察 · 點地標設目標 · Tab 關閉',150,884);
		ctx.textAlign='right';
		ctx.fillText('北 N ↑',876,32);
		const target=customTarget ?? view.missionTarget;
		if (target) {
			const route=routeTo(view.playerPos.x,view.playerPos.z,target.x,target.z);
			const straight=Math.round(Math.hypot(target.x - view.playerPos.x,target.z - view.playerPos.z));
			ctx.textAlign='left';
			ctx.fillText(`導航 ${route.len} m · 直線 ${straight} m`,24,32);
		}
		if (bv.sel) {
			const cap=`目標 TARGET · ${bv.sel[0]} — ${bv.sel[4]}（再點一次清除）`;
			ctx.font='bold 16px Verdana, sans-serif';
			ctx.textAlign='center';
			ctx.fillStyle='rgba(0,0,0,0.55)';
			ctx.fillText(cap,451,845);
			ctx.fillStyle='#ffe9a8';
			ctx.fillText(cap,450,844);
		}
	}
	big.addEventListener('click',(e) => {
		const rect=big.getBoundingClientRect();
		const px=(e.clientX - rect.left) / rect.width * 900;
		const py=(e.clientY - rect.top) / rect.height * 900;
		bv.sel=null;
		for (const m of MARKS) {
			const p=bigW(m[1],m[2]);
			if (Math.hypot(p[0] - px,p[1] - py) < 16) {
				if (customTarget && customTarget.x === m[1] && customTarget.z === m[2]) customTarget=null;
				else { customTarget={ x: m[1],z: m[2] }; bv.sel=m; }
				break;
			}
		}
		if (lastView) drawBig(lastView);
	});
	function setBig(open) {
		bv.open=open;
		big.style.display=open ? 'block' : 'none';
		if (open && lastView) drawBig(lastView);
	}
	window.addEventListener('keydown',(e) => {
		if (e.code === 'Tab') { e.preventDefault(); setBig(!bv.open); }
		else if (e.code === 'Escape' && bv.open) setBig(false);
	});

	const last={};
	function setText(key,element,value) {
		if (last[key] !== value) {
			last[key]=value;
			element.textContent=value;
		}
	}
	function setWidth(key,element,value) {
		if (last[key] !== value) {
			last[key]=value;
			element.style.width=value;
		}
	}
	return {
		update(state,view) {
			lastView=view;
			setText('stars',elements.stars,state.wanted > 0 ? '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted) : '');
			const starColor=Math.floor(performance.now() / 400) % 2 === 0 || state.wanted < 3 ? '#ffd23f' : '#ff5566';
			if (last.starColor !== starColor) {
				last.starColor=starColor;
				elements.stars.style.color=starColor;
			}
			setText('cash',elements.cash,`$${state.cash.toLocaleString('en-US')}`);
			setWidth('health',elements.healthFill,`${Math.max(0,Math.min(100,state.health))}%`);
			setWidth('armour',elements.armourFill,`${Math.max(0,Math.min(100,state.armour))}%`);
			setText('objective',elements.objective,view.objective || '');
			setText('message',elements.message,state.messageTimer > 0 ? state.message : '');
			setText('speed',elements.speed,view.speedKmh > 1 ? `${Math.round(view.speedKmh)} km/h` : '');
			setText('prompt',elements.prompt,view.prompt || '');
			const minutes=Math.floor((state.playSeconds / 60) % 24 * 60 + 8 * 60) % (24 * 60);
			const hh=String(Math.floor(minutes / 60)).padStart(2,'0');
			const mm=String(minutes % 60).padStart(2,'0');
			setText('clock',elements.clock,`${hh}:${mm}`);
			if (bv.open) drawBig(view);
			else drawMinimap(view);
		},
		setVisible(visible) {
			document.getElementById('hud').style.display=visible ? 'block' : 'none';
		},
		openMap() { setBig(true); },
		get mapOpen() { return bv.open; },
	};
}
