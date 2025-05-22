// In main.js
import * as C from './constants.js';
import { Part, CommandPod, FuelTank, Engine, Fairing } from './parts.js'; // Part classes
import { Spacecraft, initializeSpacecraftAndParts } from './spacecraft.js';
import { SmokeParticle } from './smoke.js'; // SmokeParticle class
import * as ENV from './environment.js'; // Environment module
import * as AUDIO from './audio.js';   // Audio module
import * as UI from './ui.js';       // UI module

// ... (Global state variables same as before) ...
let spacecraftInstance = null; 
let currentShipPartsConfig = []; 
let simulationState = { 
    isLaunched: false, engineActive: false, timeElapsed: 0, lastTimestamp: 0,
    cameraX_m: 0, cameraY_m: 0, currentPixelsPerMeter: 0.05, 
    controlFlags: { rotateLeft: false, rotateRight: false }, landed: true,
    soundMuted: false, currentDesignName: "DefaultOrbiter" 
};
let currentDragForceMagnitude = 0; 
let currentAirDensityValue = C.EARTH_SEA_LEVEL_AIR_DENSITY; 
let apoapsisAGL = { value: 0 }; 
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
const dom = { /* ... same as V8.5, ensure all IDs match HTML ... */ 
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
if (document.getElementById('launchButton')) {
     dom.launchButton = document.getElementById('launchButton');
}

// Part Catalog for dynamic drawing/instantiation
const partCatalog = {
    'pod': CommandPod,
    'tank': FuelTank,
    'engine': Engine,
    'fairing': Fairing
};

const spacecraftDesigns = { /* same as V8.5 */
    "DefaultOrbiter": [ { type: 'pod', name:'Orbiter Pod', dryMass_kg: 800, width_m: 2.5, height_m: 2 }, { type: 'tank', name:'Medium Tank', fuelCapacity_kg: 10000, dryMass_kg: 1500, width_m: 2.5, height_m: 8 }, { type: 'engine', name:'Main Engine LKO', thrust_N: 250000, fuelConsumptionRate_kg_s: 80, dryMass_kg: 1000, width_m: 2.5, height_m: 2, isp: 310} ],
    "SmallProbe": [ { type: 'pod', name:'Probe Core', dryMass_kg: 150, width_m: 0.8, height_m: 0.8, color: 'gold' }, { type: 'fairing', name:'1.2m Fairing', dryMass_kg: 50, width_m: 1.2, height_m: 1.5 }, { type: 'tank', name:'Small Tank', fuelCapacity_kg: 1000, dryMass_kg: 100, width_m: 1, height_m: 2 }, { type: 'engine', name:'Small Engine', thrust_N: 50000, fuelConsumptionRate_kg_s: 20, dryMass_kg: 200, width_m: 1, height_m: 1, isp: 280}],
    "HeavyLifter_Lower": [ { type: 'tank', name:'Large Tank', fuelCapacity_kg: 50000, dryMass_kg: 5000, width_m: 4, height_m: 15 }, { type: 'engine', name:'Heavy Engine', thrust_N: 1000000, fuelConsumptionRate_kg_s: 300, dryMass_kg: 5000, width_m: 4, height_m: 3, isp: 300}]
}; // Parts are typically listed top-to-bottom for config, but builder will stack bottom-up.
   // For consistency, let's list design templates bottom-to-top (engine first)
Object.keys(spacecraftDesigns).forEach(key => spacecraftDesigns[key].reverse());


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
    
    smokeParticles.length = 0; 
    if (cloudLayers.length === 0) ENV.generateClouds(cloudLayers); 
    if (surfaceFeatures.length === 0) ENV.generateSurfaceFeatures(surfaceFeatures); 
    
    if(dom.launchButton) dom.launchButton.disabled = false; 
    
    UI.updateStatsDisplay(simulationState, spacecraftInstance, apoapsisAGL.value, periapsisAGL.value);
    
    if(launchSource === 'template' || currentShipPartsConfig.length === 0) { 
        const templateToLoadCfg = spacecraftDesigns[simulationState.currentDesignName] || spacecraftDesigns[Object.keys(spacecraftDesigns)[0]]; 
        currentShipPartsConfig = JSON.parse(JSON.stringify(templateToLoadCfg)); 
    }
    UI.drawStagingAreaRocket(stagingCtx, stagingCanvas, currentShipPartsConfig); 
    UI.updateStagingStats(currentShipPartsConfig);
}

function updateCamera() { /* same as before */ }

// --- Main Game Loop ---
function gameLoop(timestamp) {  
    if(!spacecraftInstance && currentShipPartsConfig.length === 0 && !simulationState.isLaunched) { requestAnimationFrame(gameLoop); return; } 
    if(!spacecraftInstance && simulationState.isLaunched) { requestAnimationFrame(gameLoop); return; } 
    
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
            currentAirDensityValue, 
            apoapsisAGL, periapsisAGL,
            smokeParticles, simulationState 
        );
        currentAirDensityValue = physicsResult.currentAirDensity; 
        currentDragForceMagnitude = physicsResult.currentDrag;   
    }
    
    updateCamera(); 
    
    smokeParticles = smokeParticles.filter(p => p.age_s < p.lifetime_s); 
    smokeParticles.forEach(p => p.update(deltaTime_s, currentAirDensityValue)); 
    
    ENV.drawSkyBackground(ctx, spacecraftInstance ? spacecraftInstance.altitudeAGL_m : null, canvas.width, canvas.height);
    ENV.drawOrbitPath(ctx, simulationState.cameraX_m, simulationState.cameraY_m, simulationState.currentPixelsPerMeter, spacecraftInstance, apoapsisAGL.value, periapsisAGL.value);  
    ENV.drawClouds(ctx, simulationState.cameraX_m, simulationState.cameraY_m, simulationState.currentPixelsPerMeter, spacecraftInstance ? spacecraftInstance.altitudeAGL_m : 0, cloudLayers); 
    ENV.drawPlanet(ctx, simulationState.cameraX_m, simulationState.cameraY_m, simulationState.currentPixelsPerMeter); 
    ENV.drawSurfaceFeatures(ctx, simulationState.cameraX_m, simulationState.cameraY_m, simulationState.currentPixelsPerMeter, surfaceFeatures); 
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
    
    UI.drawHUD(ctx, spacecraftInstance, simulationState); 
    UI.updateStatsDisplay(simulationState, spacecraftInstance, apoapsisAGL.value, periapsisAGL.value); 
    
    if (spacecraftInstance && simulationState.landed && !simulationState.engineActive && simulationState.isLaunched) { 
        // Future: Update launch button text if it's the primary one
    } 
    requestAnimationFrame(gameLoop); 
}
        
function setupEventListeners() {
    if(dom.launchButton) { // Check if the old launch button still exists
        dom.launchButton.addEventListener('click', () => { 
            if(!AUDIO.soundInitialized) AUDIO.initAudio(simulationState.soundMuted); 
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
        if(!AUDIO.soundInitialized) AUDIO.initAudio(simulationState.soundMuted); 
        if (currentShipPartsConfig.length === 0) { alert("Staging area is empty!"); return; } 
        initSimulation('staging'); 
        if (spacecraftInstance) { 
            simulationState.isLaunched = true; simulationState.landed = false; 
            simulationState.engineActive = spacecraftInstance.currentFuel_kg > 0; 
            if(dom.launchButton) dom.launchButton.disabled = true; // Disable template launch if custom is launched
        } 
    });
    dom.resetButton.addEventListener('click', () => { 
        if(!AUDIO.soundInitialized) AUDIO.initAudio(simulationState.soundMuted); 
        initSimulation('template'); 
        if(dom.launchButton) dom.launchButton.disabled = false; 
    }); 
    dom.muteButton.addEventListener('click', () => AUDIO.toggleMuteAudio(simulationState.soundMuted, simulationState.engineActive, spacecraftInstance ? spacecraftInstance.currentThrust_N / (spacecraftInstance.maxThrust_N || 1) : 0, simulationState) ); 
    
    dom.designSelect.addEventListener('change', (event) => { 
        simulationState.currentDesignName = event.target.value; 
        const selectedDesign = spacecraftDesigns[simulationState.currentDesignName]; 
        if (selectedDesign) { currentShipPartsConfig = JSON.parse(JSON.stringify(selectedDesign)); } 
        else { currentShipPartsConfig = []; } 
        UI.drawStagingAreaRocket(stagingCtx, stagingCanvas, currentShipPartsConfig); 
        UI.updateStagingStats(currentShipPartsConfig); 
        initSimulation('template'); 
    });
    dom.clearStagingButton.addEventListener('click', () => { currentShipPartsConfig = []; UI.drawStagingAreaRocket(stagingCtx, stagingCanvas, currentShipPartsConfig); UI.updateStagingStats(currentShipPartsConfig); });
    dom.undoLastPartButton.addEventListener('click', () => { if (currentShipPartsConfig.length > 0) { currentShipPartsConfig.pop(); UI.drawStagingAreaRocket(stagingCtx, stagingCanvas, currentShipPartsConfig); UI.updateStagingStats(currentShipPartsConfig); }});
    
    // ... (key listeners, makePressReleaseButton, zoom handlers - same as V8.4, ensure AUDIO.initAudio calls)
    document.addEventListener('keydown', (e) => { if(!AUDIO.soundInitialized && (e.key === 'q' || e.key === 'Q' || e.key === 'e' || e.key === 'E' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === ' ')) AUDIO.initAudio(simulationState.soundMuted); if (e.key === 'q' || e.key === 'Q' || e.key === 'ArrowLeft') simulationState.controlFlags.rotateLeft = true; if (e.key === 'e' || e.key === 'E' || e.key === 'ArrowRight') simulationState.controlFlags.rotateRight = true; if (e.key === '+' || e.key === '=') { if(!AUDIO.soundInitialized) AUDIO.initAudio(simulationState.soundMuted); simulationState.currentPixelsPerMeter *= 1.5; if(simulationState.currentPixelsPerMeter > 20) simulationState.currentPixelsPerMeter = 20;} if (e.key === '-' || e.key === '_') { if(!AUDIO.soundInitialized) AUDIO.initAudio(simulationState.soundMuted); simulationState.currentPixelsPerMeter /= 1.5; if(simulationState.currentPixelsPerMeter < 1e-7) simulationState.currentPixelsPerMeter = 1e-7; } if (e.key === ' ') { e.preventDefault(); if(currentShipPartsConfig.length > 0 && !dom.launchCurrentBuildButton.disabled) dom.launchCurrentBuildButton.click(); else if (dom.launchButton && !dom.launchButton.disabled) dom.launchButton.click(); }  });
    document.addEventListener('keyup', (e) => { if (e.key === 'q' || e.key === 'Q' || e.key === 'ArrowLeft') simulationState.controlFlags.rotateLeft = false; if (e.key === 'e' || e.key === 'E' || e.key === 'ArrowRight') simulationState.controlFlags.rotateRight = false; });
    const makePressReleaseButton = (buttonElem, flagName) => { const action = () => { if(!AUDIO.soundInitialized) AUDIO.initAudio(simulationState.soundMuted); simulationState.controlFlags[flagName] = true; }; buttonElem.addEventListener('mousedown', action); buttonElem.addEventListener('mouseup', () => simulationState.controlFlags[flagName] = false); buttonElem.addEventListener('mouseleave', () => simulationState.controlFlags[flagName] = false); buttonElem.addEventListener('touchstart', (e) => { e.preventDefault(); action(); }, {passive: false}); buttonElem.addEventListener('touchend', (e) => { e.preventDefault(); simulationState.controlFlags[flagName] = false; }); };
    makePressReleaseButton(dom.rotateLeftButton, 'rotateLeft'); makePressReleaseButton(dom.rotateRightButton, 'rotateRight');
    dom.zoomInButton.addEventListener('click', () => { if(!AUDIO.soundInitialized) AUDIO.initAudio(simulationState.soundMuted); simulationState.currentPixelsPerMeter *= 1.5; if(simulationState.currentPixelsPerMeter > 20) simulationState.currentPixelsPerMeter = 20;}); 
    dom.zoomOutButton.addEventListener('click', () => { if(!AUDIO.soundInitialized) AUDIO.initAudio(simulationState.soundMuted); simulationState.currentPixelsPerMeter /= 1.5; if(simulationState.currentPixelsPerMeter < 1e-7) simulationState.currentPixelsPerMeter = 1e-7; });
    canvas.addEventListener('wheel', (e) => { if(!AUDIO.soundInitialized) AUDIO.initAudio(simulationState.soundMuted); e.preventDefault(); if (e.deltaY < 0) {simulationState.currentPixelsPerMeter *= 1.5; if(simulationState.currentPixelsPerMeter > 20) simulationState.currentPixelsPerMeter = 20;} else {simulationState.currentPixelsPerMeter /= 1.5; if(simulationState.currentPixelsPerMeter < 1e-7) simulationState.currentPixelsPerMeter = 1e-7;} });

}

// --- Entry Point ---
document.addEventListener('DOMContentLoaded', () => {
    initializeSpacecraftAndParts( (a,b) => AUDIO.playEngineSound(a,b,simulationState.soundMuted), () => AUDIO.playGimbalSound(simulationState.soundMuted), simulationState, smokeParticles, currentAirDensityValue);
    
    UI.initializeUI(dom, currentShipPartsConfig, spacecraftDesigns, initSimulation, stagingCtx, stagingCanvas, simulationState, partCatalog, AUDIO);
  //  UI.initializeDragAndDrop(stagingCanvas, dragImageElement, currentShipPartsConfig, simulationState, AUDIO); // Pass AUDIO module
    
    canvas.width = Math.min(window.innerWidth * 0.70 - 20, 800); 
    canvas.height = Math.min(window.innerHeight * 0.70, 600);
    
    setupEventListeners(); 
    initSimulation('template');       
    requestAnimationFrame(gameLoop);
});