import * as C from './constants.js'; // C for Constants
import { Part, CommandPod, FuelTank, Engine, Fairing } from './parts.js';
import { Spacecraft, initializeSpacecraftAndParts } from './spacecraft.js';
import { SmokeParticle, initializeSmoke } from './smoke.js';
import { 
    generateClouds, drawClouds, generateSurfaceFeatures, drawSurfaceFeatures, 
    drawOrbitPath, drawPlanet, drawSkyBackground 
} from './environment.js';
import { 
    audioCtx, engineSoundOsc, engineSoundGain, gimbalSoundOsc, gimbalSoundGain, 
    soundInitialized, initAudio, playEngineSound, playGimbalSound, toggleMuteAudio 
} from './audio.js';
import { 
    initializeUI, updateStatsDisplay, drawHUD, 
    drawStagingAreaRocket as uiDrawStagingRocket, // Alias to avoid conflict
    updateStagingStats as uiUpdateStagingStats,   // Alias
    initializeDragAndDrop
} from './ui.js';


// --- Global State and Variables ---
let spacecraftInstance = null; // Renamed from spacecraft to avoid conflict with class name
let currentShipPartsConfig = []; 
let simulationState = { 
    isLaunched: false, engineActive: false, timeElapsed: 0, lastTimestamp: 0,
    cameraX_m: 0, cameraY_m: 0, currentPixelsPerMeter: 0.05, 
    controlFlags: { rotateLeft: false, rotateRight: false }, landed: true,
    soundMuted: false, currentDesignName: "DefaultOrbiter" 
};
let currentDragForceMagnitude = 0; // Stays in main, passed to spacecraft.updatePhysics
let currentAirDensityValue = C.EARTH_SEA_LEVEL_AIR_DENSITY; // Stays in main
let apoapsisAGL = { value: 0 }; // Use objects to pass by reference
let periapsisAGL = { value: 0 };
let smokeParticles = []; 
let cloudLayers = []; 
let surfaceFeatures = [];

// Canvas Contexts
const canvas = document.getElementById('gameCanvas'); 
const ctx = canvas.getContext('2d');
const insetCanvas = document.getElementById('insetCanvas'); 
const insetCtx = insetCanvas.getContext('2d');
const stagingCanvas = document.getElementById('stagingCanvas'); 
const stagingCtx = stagingCanvas.getContext('2d');
const dragImageElement = document.getElementById('dragImage');

// DOM Elements Cache
const dom = { 
    time: document.getElementById('time'), apoapsis: document.getElementById('apoapsis'), 
    periapsis: document.getElementById('periapsis'), angle: document.getElementById('angle'), 
    gimbal: document.getElementById('gimbal'), mass: document.getElementById('mass'), 
    thrust: document.getElementById('thrust'), zoomLevel: document.getElementById('zoomLevel'),
    resetButton: document.getElementById('resetButton'),
    muteButton: document.getElementById('muteButton'), 
    designSelect: document.getElementById('designSelect'), 
    rotateLeftButton: document.getElementById('rotateLeftButton'), 
    rotateRightButton: document.getElementById('rotateRightButton'),
    zoomInButton: document.getElementById('zoomInButton'), 
    zoomOutButton: document.getElementById('zoomOutButton'),
    fuelGaugeBar: document.getElementById('fuelGaugeBar'), 
    fuelText: document.getElementById('fuelText'),
    statsPanel: document.getElementById('stats'),
    clearStagingButton: document.getElementById('clearStagingButton'), 
    launchCurrentBuildButton: document.getElementById('launchCurrentBuildButton'),
    undoLastPartButton: document.getElementById('undoLastPartButton'), 
    stagingMass: document.getElementById('stagingMass'), 
    stagingThrust: document.getElementById('stagingThrust'), 
    stagingDeltaV: document.getElementById('stagingDeltaV')
};
if (document.getElementById('launchButton')) { // If old launch button still there for templates
    dom.launchButton = document.getElementById('launchButton');
}


// --- Pre-defined Spacecraft Designs --- (Moved to main for now)
const spacecraftDesigns = {
    "DefaultOrbiter": [ { type: 'engine', name:'Main Engine LKO', thrust_N: 250000, fuelConsumptionRate_kg_s: 80, dryMass_kg: 1000, width_m: 2.5, height_m: 2, isp: 310}, { type: 'tank', name:'Medium Tank', fuelCapacity_kg: 10000, dryMass_kg: 1500, width_m: 2.5, height_m: 8 }, { type: 'pod', name:'Orbiter Pod', dryMass_kg: 800, width_m: 2.5, height_m: 2 } ],
    "SmallProbe": [ { type: 'engine', name:'Small Engine', thrust_N: 50000, fuelConsumptionRate_kg_s: 20, dryMass_kg: 200, width_m: 1, height_m: 1, isp: 280}, { type: 'tank', name:'Small Tank', fuelCapacity_kg: 1000, dryMass_kg: 100, width_m: 1, height_m: 2 }, { type: 'fairing', name:'1.2m Fairing', dryMass_kg: 50, width_m: 1.2, height_m: 1.5 }, { type: 'pod', name:'Probe Core', dryMass_kg: 150, width_m: 0.8, height_m: 0.8, color: 'gold' } ],
    "HeavyLifter_Lower": [ { type: 'engine', name:'Heavy Engine', thrust_N: 1000000, fuelConsumptionRate_kg_s: 300, dryMass_kg: 5000, width_m: 4, height_m: 3, isp: 300}, { type: 'tank', name:'Large Tank', fuelCapacity_kg: 50000, dryMass_kg: 5000, width_m: 4, height_m: 15 }, ]
};


// --- Initialization ---
function initSimulation(launchSource = 'template') { 
    const urlParams = new URLSearchParams(window.location.search);
    if (dom.statsPanel) { dom.statsPanel.style.display = (urlParams.get('nostats') === 'true') ? 'none' : 'block';}
    
    let designToLoad;
    if (launchSource === 'staging' && currentShipPartsConfig.length > 0) { 
        designToLoad = currentShipPartsConfig; 
    } else { 
        const selectedDesignName = dom.designSelect.value || simulationState.currentDesignName; 
        simulationState.currentDesignName = selectedDesignName; 
        designToLoad = spacecraftDesigns[selectedDesignName]; 
    }
    if (!designToLoad || designToLoad.length === 0) { 
        if (Object.keys(spacecraftDesigns).length > 0) { 
            designToLoad = spacecraftDesigns[Object.keys(spacecraftDesigns)[0]]; 
        } else { 
            alert("Error: No spacecraft designs available."); return; 
        } 
    }
    spacecraftInstance = new Spacecraft(designToLoad); 
    
    spacecraftInstance.position_x_m = 0; spacecraftInstance.position_y_m = C.planet.radius_m; 
    spacecraftInstance.angle_rad = 0; spacecraftInstance.velocity_x_ms = 0; spacecraftInstance.velocity_y_ms = 0;
    spacecraftInstance.angularVelocity_rad_s = 0; 
    
    simulationState.isLaunched = false; simulationState.engineActive = false;
    simulationState.timeElapsed = 0; simulationState.lastTimestamp = 0;
    const comX = spacecraftInstance.position_x_m + spacecraftInstance.getCoMOffset_m() * Math.sin(spacecraftInstance.angle_rad);
    const comY = spacecraftInstance.position_y_m + spacecraftInstance.getCoMOffset_m() * Math.cos(spacecraftInstance.angle_rad);
    simulationState.cameraX_m = comX; simulationState.cameraY_m = comY; 
    simulationState.controlFlags = { rotateLeft: false, rotateRight: false }; 
    simulationState.landed = true; spacecraftInstance.engineGimbalAngle_rad = 0;
    
    currentDragForceMagnitude = 0; currentAirDensityValue = C.EARTH_SEA_LEVEL_AIR_DENSITY; 
    spacecraftInstance.calculateOrbitalParameters(apoapsisAGL, periapsisAGL); 
    
    smokeParticles.length = 0; // Clear smoke
    if (cloudLayers.length === 0) generateClouds(cloudLayers); 
    if (surfaceFeatures.length === 0) generateSurfaceFeatures(surfaceFeatures); 
    
    if(dom.launchButton) dom.launchButton.disabled = false; 
    
    updateStatsDisplay(simulationState, spacecraftInstance, apoapsisAGL.value, periapsisAGL.value);
    
    if(launchSource === 'template' || currentShipPartsConfig.length === 0) { 
        const templateToLoadCfg = spacecraftDesigns[simulationState.currentDesignName] || spacecraftDesigns[Object.keys(spacecraftDesigns)[0]]; 
        currentShipPartsConfig = JSON.parse(JSON.stringify(templateToLoadCfg)); 
    }
    uiDrawStagingRocket(stagingCtx, stagingCanvas, currentShipPartsConfig); 
    uiUpdateStagingStats(currentShipPartsConfig);
}

function updateCamera() { 
    if(!spacecraftInstance) return; 
    const comOffset_m = spacecraftInstance.getCoMOffset_m(); 
    const comX = spacecraftInstance.position_x_m + comOffset_m * Math.sin(spacecraftInstance.angle_rad); 
    const comY = spacecraftInstance.position_y_m + comOffset_m * Math.cos(spacecraftInstance.angle_rad); 
    const targetCameraX_m = comX; const targetCameraY_m = comY; 
    const lerpFactor = 0.1; 
    simulationState.cameraX_m += (targetCameraX_m - simulationState.cameraX_m) * lerpFactor; 
    simulationState.cameraY_m += (targetCameraY_m - simulationState.cameraY_m) * lerpFactor; 
}

// --- Main Game Loop ---
function gameLoop(timestamp) {  
    if(!spacecraftInstance && currentShipPartsConfig.length === 0 && !simulationState.isLaunched) { 
        requestAnimationFrame(gameLoop); return; 
    } 
    if(!spacecraftInstance && simulationState.isLaunched) { 
        requestAnimationFrame(gameLoop); return; 
    } 
    
    const rawDeltaTime_ms = (timestamp - simulationState.lastTimestamp) || 0; 
    simulationState.lastTimestamp = timestamp; 
    const deltaTime_ms = Math.min(rawDeltaTime_ms, 100); 
    const deltaTime_s = (deltaTime_ms / 1000) * C.TIME_SCALE; 
    
    if (spacecraftInstance && simulationState.isLaunched && !simulationState.landed) { 
        simulationState.timeElapsed += deltaTime_s; 
    } 
    
    if (spacecraftInstance) {
        const physicsResult = spacecraftInstance.updatePhysics(
            deltaTime_s, 
            simulationState.engineActive, 
            simulationState.controlFlags.rotateLeft, 
            simulationState.controlFlags.rotateRight,
            currentAirDensityValue, // Pass current air density
            apoapsisAGL,            // Pass reference object
            periapsisAGL,           // Pass reference object
            smokeParticles,         // Pass smoke array reference
            simulationState         // Pass simulationState for landed/engineActive updates
        );
        currentAirDensityValue = physicsResult.currentAirDensity; // Update global from returned value
        currentDragForceMagnitude = physicsResult.currentDrag;   // Update global from returned value
        // apoapsisAGL.value and periapsisAGL.value are updated by reference
    }
    
    updateCamera(); 
    
    smokeParticles = smokeParticles.filter(p => p.age_s < p.lifetime_s); 
    smokeParticles.forEach(p => p.update(deltaTime_s, currentAirDensityValue)); // Pass air density to smoke particle update
    
    drawSkyBackground(ctx, spacecraftInstance ? spacecraftInstance.altitudeAGL_m : null, canvas.width, canvas.height);
    drawOrbitPath(ctx, simulationState.cameraX_m, simulationState.cameraY_m, simulationState.currentPixelsPerMeter, spacecraftInstance, apoapsisAGL.value, periapsisAGL.value);  
    drawClouds(ctx, simulationState.cameraX_m, simulationState.cameraY_m, simulationState.currentPixelsPerMeter, spacecraftInstance ? spacecraftInstance.altitudeAGL_m : 0, cloudLayers); 
    drawPlanet(ctx, simulationState.cameraX_m, simulationState.cameraY_m, simulationState.currentPixelsPerMeter); 
    drawSurfaceFeatures(ctx, simulationState.cameraX_m, simulationState.cameraY_m, simulationState.currentPixelsPerMeter, surfaceFeatures); 
    smokeParticles.forEach(p => p.draw(ctx, simulationState.cameraX_m, simulationState.cameraY_m, simulationState.currentPixelsPerMeter, canvas.width, canvas.height)); 
    
    if(spacecraftInstance) { 
        const comOffset_m = spacecraftInstance.getCoMOffset_m(); 
        const sfcComX_world = spacecraftInstance.position_x_m + comOffset_m * Math.sin(spacecraftInstance.angle_rad); 
        const sfcComY_world = spacecraftInstance.position_y_m + comOffset_m * Math.cos(spacecraftInstance.angle_rad); 
        const sfcComScreenX_main = canvas.width/2 + (sfcComX_world - simulationState.cameraX_m) * simulationState.currentPixelsPerMeter; 
        const sfcComScreenY_main = canvas.height/2 - (sfcComY_world - simulationState.cameraY_m) * simulationState.currentPixelsPerMeter; 
        
        if (simulationState.currentPixelsPerMeter < C.SPACECRAFT_INDICATOR_PPM_THRESHOLD) { 
            ctx.fillStyle = 'yellow'; ctx.beginPath(); 
            ctx.arc(sfcComScreenX_main, sfcComScreenY_main, 3, 0, 2 * Math.PI); ctx.fill(); 
            ctx.strokeStyle = 'yellow'; ctx.lineWidth = 1.5; ctx.beginPath(); 
            ctx.moveTo(sfcComScreenX_main, sfcComScreenY_main); 
            const speed = Math.sqrt(spacecraftInstance.velocity_x_ms**2 + spacecraftInstance.velocity_y_ms**2); 
            const vectorLength = Math.min(50, speed * 0.1);  
            ctx.lineTo( sfcComScreenX_main + (spacecraftInstance.velocity_x_ms / Math.max(1,speed)) * vectorLength, sfcComScreenY_main - (spacecraftInstance.velocity_y_ms / Math.max(1,speed)) * vectorLength  ); 
            ctx.stroke(); ctx.lineWidth = 1; 
        } else { 
            spacecraftInstance.draw(ctx, canvas.width, canvas.height, sfcComScreenX_main, sfcComScreenY_main, simulationState.currentPixelsPerMeter); 
        } 
        
        if (simulationState.currentPixelsPerMeter < C.INSET_VIEW_PPM_THRESHOLD) { 
            insetCanvas.style.display = 'block'; 
            insetCtx.clearRect(0, 0, insetCanvas.width, insetCanvas.height); 
            const largerCraftDim_m = Math.max(spacecraftInstance.logicalStackHeight_m, spacecraftInstance.maxWidth_m, 1); 
            const insetPPM = C.INSET_VIEW_TARGET_SIZE_PX / largerCraftDim_m; 
            const insetSfcScreenX = insetCanvas.width / 2;  
            const insetSfcScreenY = insetCanvas.height / 2; 
            spacecraftInstance.draw(insetCtx, insetCanvas.width, insetCanvas.height, insetSfcScreenX, insetSfcScreenY, insetPPM, true); 
        } else { 
            insetCanvas.style.display = 'none'; 
        } 
    }
    
    drawHUD(ctx, spacecraftInstance, simulationState); 
    updateStatsDisplay(simulationState, spacecraftInstance, apoapsisAGL.value, periapsisAGL.value); 
    
    if (spacecraftInstance && simulationState.landed && !simulationState.engineActive && simulationState.isLaunched) { 
        // Potentially update a master launch button state here if it were separate
    } 
    requestAnimationFrame(gameLoop); 
}
        
// --- Event Listener Setup ---
function setupEventListeners() {
    if(dom.launchButton) { // If old launch button exists for template launching
        dom.launchButton.addEventListener('click', () => { 
            if(!soundInitialized) initAudio(simulationState.soundMuted); 
            initSimulation('template'); 
            if (spacecraftInstance) { 
                simulationState.isLaunched = true; simulationState.landed = false; 
                simulationState.engineActive = spacecraftInstance.currentFuel_kg > 0; 
                dom.launchButton.textContent = simulationState.engineActive ? "Engine Active (TPL)" : (spacecraftInstance.currentFuel_kg > 0 ? "Engine Off (TPL)" : "Out of Fuel (TPL)"); 
                dom.launchButton.disabled = spacecraftInstance.currentFuel_kg <=0 && !simulationState.engineActive; 
            } 
        });
    }

    dom.launchCurrentBuildButton.addEventListener('click', () => { 
        if(!soundInitialized) initAudio(simulationState.soundMuted); 
        if (currentShipPartsConfig.length === 0) { alert("Staging area is empty!"); return; } 
        initSimulation('staging'); 
        if (spacecraftInstance) { 
            simulationState.isLaunched = true; simulationState.landed = false; 
            simulationState.engineActive = spacecraftInstance.currentFuel_kg > 0; 
            // Consider disabling template launch button or changing its text
            if(dom.launchButton) dom.launchButton.disabled = true; 
        } 
    });
    dom.resetButton.addEventListener('click', () => { if(!soundInitialized) initAudio(simulationState.soundMuted); initSimulation('template'); if(dom.launchButton) dom.launchButton.disabled = false; }); 
    dom.muteButton.addEventListener('click', () => toggleMuteAudio(simulationState.soundMuted, simulationState.engineActive, spacecraftInstance ? spacecraftInstance.currentThrust_N / (spacecraftInstance.maxThrust_N || 1) : 0) ); 
    
    dom.designSelect.addEventListener('change', (event) => { 
        simulationState.currentDesignName = event.target.value; 
        const selectedDesign = spacecraftDesigns[simulationState.currentDesignName]; 
        if (selectedDesign) { currentShipPartsConfig = JSON.parse(JSON.stringify(selectedDesign)); } 
        else { currentShipPartsConfig = []; } 
        uiDrawStagingRocket(stagingCtx, stagingCanvas, currentShipPartsConfig); 
        uiUpdateStagingStats(currentShipPartsConfig); 
        initSimulation('template'); // Reset main sim to reflect selected template
    });
    dom.clearStagingButton.addEventListener('click', () => { currentShipPartsConfig = []; uiDrawStagingRocket(stagingCtx, stagingCanvas, currentShipPartsConfig); uiUpdateStagingStats(currentShipPartsConfig); });
    dom.undoLastPartButton.addEventListener('click', () => { if (currentShipPartsConfig.length > 0) { currentShipPartsConfig.pop(); uiDrawStagingRocket(stagingCtx, stagingCanvas, currentShipPartsConfig); uiUpdateStagingStats(currentShipPartsConfig); }});
    
    document.addEventListener('keydown', (e) => { 
        if(!soundInitialized && (e.key === 'q' || e.key === 'Q' || e.key === 'e' || e.key === 'E' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === ' ')) initAudio(simulationState.soundMuted); 
        if (e.key === 'q' || e.key === 'Q' || e.key === 'ArrowLeft') simulationState.controlFlags.rotateLeft = true; 
        if (e.key === 'e' || e.key === 'E' || e.key === 'ArrowRight') simulationState.controlFlags.rotateRight = true; 
        if (e.key === '+' || e.key === '=') { if(!soundInitialized) initAudio(simulationState.soundMuted); simulationState.currentPixelsPerMeter *= 1.5; if(simulationState.currentPixelsPerMeter > 20) simulationState.currentPixelsPerMeter = 20;}
        if (e.key === '-' || e.key === '_') { if(!soundInitialized) initAudio(simulationState.soundMuted); simulationState.currentPixelsPerMeter /= 1.5; if(simulationState.currentPixelsPerMeter < 1e-7) simulationState.currentPixelsPerMeter = 1e-7; }
        if (e.key === ' ') { e.preventDefault(); if(currentShipPartsConfig.length > 0 && !dom.launchCurrentBuildButton.disabled) dom.launchCurrentBuildButton.click(); else if (dom.launchButton && !dom.launchButton.disabled) dom.launchButton.click(); }  
    });
    document.addEventListener('keyup', (e) => { 
        if (e.key === 'q' || e.key === 'Q' || e.key === 'ArrowLeft') simulationState.controlFlags.rotateLeft = false; 
        if (e.key === 'e' || e.key === 'E' || e.key === 'ArrowRight') simulationState.controlFlags.rotateRight = false; 
    });
    
    const makePressReleaseButton = (buttonElem, flagName) => { 
        const action = () => { if(!soundInitialized) initAudio(simulationState.soundMuted); simulationState.controlFlags[flagName] = true; }; 
        buttonElem.addEventListener('mousedown', action); 
        buttonElem.addEventListener('mouseup', () => simulationState.controlFlags[flagName] = false); 
        buttonElem.addEventListener('mouseleave', () => simulationState.controlFlags[flagName] = false); 
        buttonElem.addEventListener('touchstart', (e) => { e.preventDefault(); action(); }, {passive: false}); 
        buttonElem.addEventListener('touchend', (e) => { e.preventDefault(); simulationState.controlFlags[flagName] = false; }); 
    };
    makePressReleaseButton(dom.rotateLeftButton, 'rotateLeft'); 
    makePressReleaseButton(dom.rotateRightButton, 'rotateRight');
    
    dom.zoomInButton.addEventListener('click', () => { if(!soundInitialized) initAudio(simulationState.soundMuted); simulationState.currentPixelsPerMeter *= 1.5; if(simulationState.currentPixelsPerMeter > 20) simulationState.currentPixelsPerMeter = 20;}); 
    dom.zoomOutButton.addEventListener('click', () => { if(!soundInitialized) initAudio(simulationState.soundMuted); simulationState.currentPixelsPerMeter /= 1.5; if(simulationState.currentPixelsPerMeter < 1e-7) simulationState.currentPixelsPerMeter = 1e-7; });
    canvas.addEventListener('wheel', (e) => { if(!soundInitialized) initAudio(simulationState.soundMuted); e.preventDefault(); if (e.deltaY < 0) {simulationState.currentPixelsPerMeter *= 1.5; if(simulationState.currentPixelsPerMeter > 20) simulationState.currentPixelsPerMeter = 20;} else {simulationState.currentPixelsPerMeter /= 1.5; if(simulationState.currentPixelsPerMeter < 1e-7) simulationState.currentPixelsPerMeter = 1e-7;} });
}

// --- Entry Point ---
document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI module with necessary DOM elements and shared state/functions
    initializeUI(dom, currentShipPartsConfig, spacecraftDesigns, initSimulation);
    initializeDragAndDrop(stagingCanvas, dragImageElement, currentShipPartsConfig, simulationState);
    
    // Initialize spacecraft specific parts (like passing sound functions)
    initializeSpacecraftAndParts(playEngineSound, playGimbalSound, simulationState, smokeParticles, currentAirDensityValue); // Pass the global smokeParticles array
    initializeSmoke(currentAirDensityValue); // Pass reference or direct value for air density if smoke needs it

    // Setup canvas dimensions (can be done once here)
    canvas.width = Math.min(window.innerWidth * 0.70 - 20, 800); 
    canvas.height = Math.min(window.innerHeight * 0.70, 600);
    // insetCanvas dimensions are set in CSS
    // stagingCanvas dimensions are set in CSS
    
    setupEventListeners(); // Setup general event listeners
    initSimulation('template'); // Initial load       
    requestAnimationFrame(gameLoop);
});

