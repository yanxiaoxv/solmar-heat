// HUD: stars, cash, bars, objective, minimap.

import { ROAD_X,ROAD_Z,CITY_HALF,districtAt } from './city.js';

const MAP_RANGE=CITY_HALF + 26;

export function createHud() {
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

	function worldToMap(x,z) {
		const scale=mapSize / (MAP_RANGE * 2);
		return {
			x: (x + MAP_RANGE) * scale,
			y: (z + MAP_RANGE) * scale,
		};
	}

	const staticMap=document.createElement('canvas');
	staticMap.width=mapSize;
	staticMap.height=mapSize;
	{
		const ctx=staticMap.getContext('2d');
		ctx.fillStyle='#33582f';
		ctx.fillRect(0,0,mapSize,mapSize);
		const parkBlocks=new Set(['3,5','5,2','6,6']);
		for (let i=0; i < ROAD_X.length - 1; i += 1) {
			for (let j=0; j < ROAD_Z.length - 1; j += 1) {
				const a=worldToMap(ROAD_X[i] + 8,ROAD_Z[j] + 8);
				const b=worldToMap(ROAD_X[i + 1] - 8,ROAD_Z[j + 1] - 8);
				ctx.fillStyle=parkBlocks.has(`${i},${j}`)
					? '#57a047'
					: ((i + j) % 2 === 0 ? '#57743f' : '#4c6c3a');
				ctx.fillRect(a.x,a.y,b.x - a.x,b.y - a.y);
				if (!parkBlocks.has(`${i},${j}`)) {
					ctx.fillStyle='rgba(238,220,180,0.20)';
					const bw=(b.x - a.x) * 0.55;
					const bh=(b.y - a.y) * 0.55;
					ctx.fillRect(a.x + (b.x - a.x - bw) / 2,a.y + (b.y - a.y - bh) / 2,bw,bh);
				}
			}
		}

		{
			const heightsTop=worldToMap(-MAP_RANGE,-MAP_RANGE);
			const heightsBottom=worldToMap(MAP_RANGE,-121);
			ctx.fillStyle='rgba(127,168,201,0.30)';
			ctx.fillRect(heightsTop.x,heightsTop.y,heightsBottom.x - heightsTop.x,heightsBottom.y - heightsTop.y);
			const westLeft=worldToMap(-MAP_RANGE,-121);
			const westRight=worldToMap(-121,138);
			ctx.fillStyle='rgba(232,180,160,0.30)';
			ctx.fillRect(westLeft.x,westLeft.y,westRight.x - westLeft.x,westRight.y - westLeft.y);
			const eastLeft=worldToMap(121,-121);
			const eastRight=worldToMap(MAP_RANGE,138);
			ctx.fillRect(eastLeft.x,eastLeft.y,eastRight.x - eastLeft.x,eastRight.y - eastLeft.y);
		}

		const shore=worldToMap(0,150);
		const waterGradient=ctx.createLinearGradient(0,shore.y,0,mapSize);
		waterGradient.addColorStop(0,'#2b93b8');
		waterGradient.addColorStop(1,'#14586f');
		ctx.fillStyle=waterGradient;
		ctx.fillRect(0,shore.y,mapSize,mapSize - shore.y);
		ctx.fillStyle='#eed9a4';
		ctx.fillRect(0,worldToMap(0,138).y,mapSize,shore.y - worldToMap(0,138).y);

		for (const [style,width] of [['#24282e',Math.max(3,mapSize * 0.026)],['#4d545e',Math.max(2,mapSize * 0.018)]]) {
			ctx.strokeStyle=style;
			ctx.lineWidth=width;
			for (const pos of ROAD_X) {
				const a=worldToMap(pos,-MAP_RANGE);
				const b=worldToMap(pos,MAP_RANGE);
				ctx.beginPath();
				ctx.moveTo(a.x,a.y);
				ctx.lineTo(b.x,b.y);
				ctx.stroke();
			}
			for (const pos of ROAD_Z) {
				const c=worldToMap(-MAP_RANGE,pos);
				const d=worldToMap(MAP_RANGE,pos);
				ctx.beginPath();
				ctx.moveTo(c.x,c.y);
				ctx.lineTo(d.x,d.y);
				ctx.stroke();
			}
		}
	}

	function drawMinimap(view) {
		const ctx=mapCtx;
		ctx.drawImage(staticMap,0,0);
		if (view.missionTarget) {
			const p=worldToMap(view.missionTarget.x,view.missionTarget.z);
			const r=5 + Math.sin(performance.now() / 240) * 1.4;
			ctx.fillStyle='#ffd23f';
			ctx.beginPath();
			ctx.moveTo(p.x,p.y - r);
			ctx.lineTo(p.x + r,p.y);
			ctx.lineTo(p.x,p.y + r);
			ctx.lineTo(p.x - r,p.y);
			ctx.closePath();
			ctx.fill();
		}

		ctx.fillStyle='#e8e8e8';
		for (const car of view.cars) {
			const p=worldToMap(car.mesh.position.x,car.mesh.position.z);
			ctx.fillRect(p.x - 1.6,p.y - 1.6,3.2,3.2);
		}
		for (const cop of view.police) {
			const p=worldToMap(cop.mesh.position.x,cop.mesh.position.z);
			ctx.fillStyle='#ffffff';
			ctx.beginPath();
			ctx.arc(p.x,p.y,3.4,0,Math.PI * 2);
			ctx.fill();
			ctx.fillStyle='#3d8bff';
			ctx.beginPath();
			ctx.arc(p.x,p.y,2.5,0,Math.PI * 2);
			ctx.fill();
		}
		ctx.fillStyle='#ffd9a0';
		for (const person of view.pedestrians) {
			const p=worldToMap(person.mesh.position.x,person.mesh.position.z);
			ctx.fillRect(p.x - 1,p.y - 1,2,2);
		}

		if (view.rivals) {
			for (const rival of view.rivals) {
				const p=worldToMap(rival.x,rival.z);
				ctx.fillStyle=rival.down ? '#7a7a7a' : '#ff4455';
				ctx.beginPath();
				ctx.arc(p.x,p.y,2.6,0,Math.PI * 2);
				ctx.fill();
			}
		}
		const player=worldToMap(view.playerPos.x,view.playerPos.z);
		ctx.save();
		ctx.translate(player.x,player.y);
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
		const district=districtAt(view.playerPos.x,view.playerPos.z);
		ctx.font='bold 11px Verdana, sans-serif';
		ctx.textAlign='left';
		ctx.textBaseline='bottom';
		ctx.fillStyle='rgba(0,0,0,0.55)';
		ctx.fillText(district.toUpperCase(),7,mapSize - 5);
		ctx.fillStyle='#ffffff';
		ctx.fillText(district.toUpperCase(),6,mapSize - 6);
	}

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
			drawMinimap(view);
		},
		setVisible(visible) {
			document.getElementById('hud').style.display=visible ? 'block' : 'none';
		},
	};
}
