// audio.js — procedural WebAudio sound synthesis for the game (no audio files).
// Procedural audio: WebAudio synth, no files; M mutes.

export function createAudio() {
	let ctx=null;
	let master=null;
	let engineOsc=null;
	let engineGain=null;
	let engineFilter=null;
	let sirenOsc=null;
	let sirenGain=null;
	let bayGain=null;
	let muted=false;
	let updateClock=0;

	function unlock() {
		if (ctx) {
			if (ctx.state === 'suspended') ctx.resume().catch(() => {});
			return;
		}
		try {
			const AudioCtor=window.AudioContext || window.webkitAudioContext;
			if (!AudioCtor) return;
			ctx=new AudioCtor();
			master=ctx.createGain();
			master.gain.value=muted ? 0 : 0.9;
			master.connect(ctx.destination);

			engineOsc=ctx.createOscillator();
			engineOsc.type='sawtooth';
			engineOsc.frequency.value=55;
			engineFilter=ctx.createBiquadFilter();
			engineFilter.type='lowpass';
			engineFilter.frequency.value=320;
			engineGain=ctx.createGain();
			engineGain.gain.value=0;
			engineOsc.connect(engineFilter);
			engineFilter.connect(engineGain);
			engineGain.connect(master);
			engineOsc.start();

			sirenOsc=ctx.createOscillator();
			sirenOsc.type='square';
			sirenOsc.frequency.value=815;
			const sirenLfo=ctx.createOscillator();
			sirenLfo.type='triangle';
			sirenLfo.frequency.value=0.55;
			const sirenSwing=ctx.createGain();
			sirenSwing.gain.value=135;
			sirenLfo.connect(sirenSwing);
			sirenSwing.connect(sirenOsc.frequency);
			const sirenFilter=ctx.createBiquadFilter();
			sirenFilter.type='bandpass';
			sirenFilter.frequency.value=900;
			sirenFilter.Q.value=2.5;
			sirenGain=ctx.createGain();
			sirenGain.gain.value=0;
			sirenOsc.connect(sirenFilter);
			sirenFilter.connect(sirenGain);
			sirenGain.connect(master);
			sirenOsc.start();
			sirenLfo.start();

			const nb=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);
			const nd=nb.getChannelData(0);
			for (let i=0; i < nd.length; i += 1) nd[i]=Math.random() * 2 - 1;
			const noise=ctx.createBufferSource();
			noise.buffer=nb; noise.loop=true;
			bayGain=ctx.createGain(); bayGain.gain.value=0.014;
			noise.connect(bayGain); bayGain.connect(master); noise.start();
		} catch {
			ctx=null;
		}
	}

	function tone(freq,seconds,{ type='sine',gain=0.12,delay=0,slideTo=null }={}) {
		if (!ctx || !master) return;
		try {
			const start=ctx.currentTime + delay;
			const osc=ctx.createOscillator();
			osc.type=type;
			osc.frequency.setValueAtTime(freq,start);
			if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo,start + seconds);
			const amp=ctx.createGain();
			amp.gain.setValueAtTime(0,start);
			amp.gain.linearRampToValueAtTime(gain,start + 0.012);
			amp.gain.exponentialRampToValueAtTime(0.001,start + seconds);
			osc.connect(amp);
			amp.connect(master);
			osc.start(start);
			osc.stop(start + seconds + 0.05);
		} catch {

		}
	}

	function thud(strength=1) {
		if (!ctx || !master) return;
		try {
			const length=Math.floor(ctx.sampleRate * 0.12);
			const buffer=ctx.createBuffer(1,length,ctx.sampleRate);
			const data=buffer.getChannelData(0);
			for (let i=0; i < length; i += 1) data[i]=(Math.random() * 2 - 1) * (1 - i / length);
			const source=ctx.createBufferSource();
			source.buffer=buffer;
			const filter=ctx.createBiquadFilter();
			filter.type='lowpass';
			filter.frequency.value=300;
			const amp=ctx.createGain();
			amp.gain.value=Math.min(0.5,0.22 * strength);
			source.connect(filter);
			filter.connect(amp);
			amp.connect(master);
			source.start();
		} catch {
		}
	}

	const JINGLES={
		pickup: [[660,0.09,'sine',0.14,0],[880,0.12,'sine',0.14,0.07]],
		'mission-complete': [[523,0.14,'triangle',0.16,0],[659,0.14,'triangle',0.16,0.1],[784,0.22,'triangle',0.16,0.2]],
		finale: [[523,0.16,'triangle',0.17,0],[659,0.16,'triangle',0.17,0.11],[784,0.16,'triangle',0.17,0.22],[1046,0.4,'triangle',0.18,0.33],[1318,0.45,'sine',0.1,0.44]],
		busted: [[392,0.22,'sawtooth',0.1,0,330],[330,0.22,'sawtooth',0.1,0.2,262],[262,0.42,'sawtooth',0.1,0.4,196]],
		click: [[1150,0.05,'square',0.05,0]],
	};
	function play(name) {
		if (!ctx) return;
		if (name === 'thud') thud(1);
		else if (name === 'bump') thud(1.8);
		else for (const [f,s,t,g,d,sl] of JINGLES[name] ?? []) tone(f,s,{ type: t,gain: g,delay: d,slideTo: sl ?? null });
	}

	function update(dt,info) {
		if (!ctx || !engineGain || !sirenGain) return;
		updateClock -= dt;
		if (updateClock > 0) return;
		updateClock=0.08;
		try {
			const now=ctx.currentTime;
			const driving=info.mode === 'drive';
			const speedRatio=Math.min(1,Math.abs(info.speedKmh ?? 0) / 130);
			const engineTarget=driving ? 0.05 + speedRatio * 0.05 : 0;
			engineGain.gain.setTargetAtTime(engineTarget,now,0.09);
			engineOsc.frequency.setTargetAtTime(55 + speedRatio * 165,now,0.09);
			engineFilter.frequency.setTargetAtTime(320 + speedRatio * 900,now,0.09);

			let sirenTarget=0;
			if ((info.wanted ?? 0) > 0 && Number.isFinite(info.policeDistance)) {
				const closeness=Math.max(0,Math.min(1,1 - info.policeDistance / 65));
				sirenTarget=0.012 + closeness * 0.05;
			}
			sirenGain.gain.setTargetAtTime(sirenTarget,now,0.12);

			if (bayGain) {
				const coast=Math.max(0,Math.min(1,info.coast ?? 0));
				bayGain.gain.setTargetAtTime(0.006 + coast * 0.022,now,0.12);
			}
		} catch {

		}
	}

	window.addEventListener('keydown',(event) => {
		if (event.code !== 'KeyM') return;
		muted=!muted;
		if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.9,ctx.currentTime,0.03);
	});

	return {
		unlock,
		play,
		update,
		get contextState() {
			return ctx ? ctx.state : 'none';
		},
	};
}
