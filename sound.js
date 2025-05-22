// Global audio context and nodes, to be initialized
export let audioCtx;
export let engineSoundOsc, engineSoundGain;
export let gimbalSoundOsc, gimbalSoundGain;
export let soundInitialized = false;
let lastGimbalInputTime = 0;

export function initAudio(isMuted) { 
    if (soundInitialized || !window.AudioContext || isMuted) return false; 
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        engineSoundOsc = audioCtx.createOscillator(); 
        engineSoundGain = audioCtx.createGain();
        engineSoundOsc.type = 'sawtooth'; 
        engineSoundOsc.frequency.setValueAtTime(50, audioCtx.currentTime); 
        engineSoundGain.gain.setValueAtTime(0, audioCtx.currentTime); 
        engineSoundOsc.connect(engineSoundGain).connect(audioCtx.destination); 
        engineSoundOsc.start();

        gimbalSoundOsc = audioCtx.createOscillator(); 
        gimbalSoundGain = audioCtx.createGain();
        gimbalSoundOsc.type = 'square'; 
        gimbalSoundOsc.frequency.setValueAtTime(300, audioCtx.currentTime);
        gimbalSoundGain.gain.setValueAtTime(0, audioCtx.currentTime);
        gimbalSoundOsc.connect(gimbalSoundGain).connect(audioCtx.destination); 
        gimbalSoundOsc.start();
        
        soundInitialized = true; 
        console.log("Audio Initialized");
        return true;
    } catch (e) { 
        console.error("Web Audio API error.", e); 
        return false;
    }
}

export function playEngineSound(active, thrustRatio = 1, isMuted) { 
    if (!soundInitialized || !engineSoundGain || isMuted) { 
        if(engineSoundGain) engineSoundGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.01); 
        return; 
    }
    if (active) { 
        engineSoundGain.gain.setTargetAtTime(0.1 * thrustRatio, audioCtx.currentTime, 0.01); 
        engineSoundOsc.frequency.setTargetAtTime(40 + 60 * thrustRatio, audioCtx.currentTime, 0.1); 
    } else { 
        engineSoundGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1); 
    }
}

export function playGimbalSound(isMuted) { 
    if (!soundInitialized || !gimbalSoundGain || isMuted) return; 
    const now = audioCtx.currentTime;
    if (now - lastGimbalInputTime < 0.2) return; 
    lastGimbalInputTime = now;
    gimbalSoundGain.gain.setValueAtTime(0.05, now); 
    gimbalSoundGain.gain.setTargetAtTime(0, now + 0.05, 0.02); 
    gimbalSoundOsc.frequency.setValueAtTime(200 + Math.random() * 200, now); 
}

export function toggleMuteAudio(isMuted, currentEngineActive, currentThrustRatio) {
    if (isMuted) { 
        if (soundInitialized && engineSoundGain) engineSoundGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.01); 
    } else { 
        if (!soundInitialized) initAudio(isMuted); 
        playEngineSound(currentEngineActive, currentThrustRatio, isMuted);
    }
}