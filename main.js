import * as C from './constants.js';
import { Part, CommandPod, FuelTank, Engine, Fairing } from './parts.js';
import { Spacecraft, initializeSpacecraftAndParts } from './spacecraft.js';
import { SmokeParticle } from './smoke.js';
import * as ENV from './environment.js';
import * as AUDIO from './audio.js'; 
import * as UI from './ui.js';
import * as PIXI from 'https://esm.sh/pixi.js@>=8?target=es2022';
//PIXI.extensions.remove("batcher");
import {Viewport} from 'https://esm.sh/pixi-viewport@6.0.3';

//import * as PIXI from "https://esm.sh/pixi.js@8.9.2";


export {PIXI};

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
let smokeParticles = []; let oldSmokeParticles = []; // For smoke persistenceq
let cloudLayers = []; 
let surfaceFeatures = [];

const canvas = document.getElementById('gameCanvas'); 
// const ctx = canvas.getContext('2d'); // No longer primary context
const insetCanvas = document.getElementById('insetCanvas'); 
//const insetCtx = insetCanvas.getContext('2d'); // Keep for inset, or refactor later
const stagingCanvas = document.getElementById('stagingCanvas'); 
//const stagingCtx = stagingCanvas.getContext('2d'); // Keep for staging, or refactor later
const dragImageElement = document.getElementById('dragImage');
// Create a new renderer
//const sharedRenderer = await autoDetectRenderer();
const allTextures = await PIXI.Assets.load(['images/clouds-0.json', 'images/clouds-0.png']);
// Initialize PixiJS Application
const app = new PIXI.Application();

    await app.init({

    
 //   renderer:sharedRenderer,
    backgroundColor: 0x000000, 
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    canvas: gameCanvas,
   //resizeTo: window, // Automatically resize to window size
   // width: gameCanvas.width, // Set initial width
   // height: gameCanvas.height, // Set initial height
});
  const viewport = new Viewport({
    passiveWheel: false,
    events: app.renderer.events
  })
  // activate plugins
  viewport
    .drag()
    .pinch()
    .wheel()
    .decelerate()

  // add the viewport to the stage
  app.stage.addChild(viewport);
//gameCanvas.appendChild(app.view); // Append PixiJS canvas to the DOM


//app.stage.eventMode = 'static';
// let frame = new PIXI.Graphics();
// frame.beginFill(0x666666);
// frame.lineStyle({ color: 0xffffff, width: 4, alignment: 0 });
// frame.drawRect(0, 0, 1000, 1000);
// frame.position.set(320, 180);
// app.stage.addChild(frame);
// // Create a graphics object to define our mask
// let mask = new PIXI.Graphics();
// // Add the rectangular area to show
// mask.beginFill(0xffffff);
// mask.drawRect(0,0,200,200);
// mask.endFill();


let environmentContainer = new PIXI.Container();
let orbitContainer = new PIXI.Container(); // For orbit path rendering
environmentContainer.addChild(orbitContainer); // Add orbit container to environment
app.stage.addChild(environmentContainer);

let smokeLayerContainer = new PIXI.Container(); // For smoke particles - Add before spacecraft
app.stage.addChild(smokeLayerContainer);

let spacecraftLayerContainer = new PIXI.Container(); // For spacecraft rendering - Add after smoke
// let insetLayerContainer = new PIXI.Container(); // For inset view rendering
// insetLayerContainer.x = 10;
// insetLayerContainer.y = 10;
// insetLayerContainer.width = 200; // Set width for inset view
// insetLayerContainer.height = 200; // Set height for inset view
app.stage.addChild(spacecraftLayerContainer);

// For Inset View

let insetApp = null;
let insetSpacecraftContainer = null;
app.ticker.add(gameLoop);
// No longer need ctx directly for PixiJS rendering for main canvas
// const ctx = canvas.getContext('2d');


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
    stagingCanvas: document.getElementById('stagingCanvas'),
    stagingMass: document.getElementById('stagingMass'), 
    stagingThrust: document.getElementById('stagingThrust'), 
    stagingDeltaV: document.getElementById('stagingDeltaV'),
    dragImage: dragImageElement // Add dragImage to dom for ui.js
};
if (document.getElementById('launchButton')) { // Keep this if launchButton exists in HTML
     dom.launchButton = document.getElementById('launchButton');
}


const partCatalog = { // For ui.js to know how to instantiate parts for thumbnails/drag data
    'pod': CommandPod,
    'tank': FuelTank,
    'engine': Engine,
    'fairing': Fairing
};

const spacecraftDesigns = { 
    "DefaultOrbiter": [ 
        { type: 'engine', name:'Main Engine LKO', thrust_N: 250000, fuelConsumptionRate_kg_s: 80, dryMass_kg: 1000, width_m: 2.5, height_m: 2, isp: 310}, 
        { type: 'tank', name:'Medium Tank', fuelCapacity_kg: 10000, dryMass_kg: 1500, width_m: 2.5, height_m: 8 }, 
        { type: 'pod', name:'Orbiter Pod', dryMass_kg: 800, width_m: 2.5, height_m: 2 } 
    ],
    "SmallProbe": [ { type: 'engine', name:'Small Engine', thrust_N: 50000, fuelConsumptionRate_kg_s: 20, dryMass_kg: 200, width_m: 1, height_m: 1, isp: 280}, { type: 'tank', name:'Small Tank', fuelCapacity_kg: 1000, dryMass_kg: 100, width_m: 1, height_m: 2 }, { type: 'fairing', name:'1.2m Fairing', dryMass_kg: 50, width_m: 1.2, height_m: 1.5 }, { type: 'pod', name:'Probe Core', dryMass_kg: 150, width_m: 0.8, height_m: 0.8, color: 'gold' } ],
    "HeavyLifter_Lower": [ { type: 'engine', name:'Heavy Engine', thrust_N: 1000000, fuelConsumptionRate_kg_s: 300, dryMass_kg: 5000, width_m: 4, height_m: 3, isp: 300}, { type: 'tank', name:'Large Tank', fuelCapacity_kg: 50000, dryMass_kg: 5000, width_m: 4, height_m: 15 }, ]
}; 
// Object.keys(spacecraftDesigns).forEach(key => spacecraftDesigns[key].reverse());


function initSimulation(launchSource = 'template') { 
    const urlParams = new URLSearchParams(window.location.search);
    if (dom.statsPanel) { dom.statsPanel.style.display = (urlParams.get('stats') === 'true') ?  'block':'none';}
    
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
    ENV.drawPlanet(environmentContainer, simulationState.cameraX_m, simulationState.cameraY_m, simulationState.currentPixelsPerMeter,  app.screen.width, app.screen.height); 
    //UI.drawWorld(ctx, canvas.width, canvas.height, simulationState.cameraX_m, simulationState.cameraY_m, simulationState.currentPixelsPerMeter);
    UI.drawStagingAreaRocket(currentShipPartsConfig); // UI module will use its stored refs for stagingCtx, etc.
   // UI.updateStagingStats();   // UI module will use its stored ref for currentShipPartsConfig

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

function gameLoop(ticker) {  
   // if(!spacecraftInstance && currentShipPartsConfig.length === 0 && !simulationState.isLaunched) { requestAnimationFrame(gameLoop); return; } 
    //if(!spacecraftInstance && simulationState.isLaunched) { requestAnimationFrame(gameLoop); return; } 
    
    const rawDeltaTime_ms = ticker.deltaMS; // (timestamp - simulationState.lastTimestamp) || 0; 
   // simulationState.lastTimestamp = timestamp; 
    const deltaTime_ms = ticker.deltaMS;//Math.min(rawDeltaTime_ms, 100); 
    const deltaTime_s = (deltaTime_ms / 1000) * C.TIME_SCALE; 
    
    if (spacecraftInstance && simulationState.isLaunched && !simulationState.landed) { 
        simulationState.timeElapsed += ticker.elapsedMS / 1000; // Update time elapsed in seconds
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
    
 //   updateCamera(); 
    
  //  updateCamera(); 
    
    updateCamera(); 
    
    // --- Smoke Particle Update, Draw, and Management ---
    smokeLayerContainer.removeChildren(); // Clear container at the start of smoke processing

    const currentActiveSmoke = [];
    const newlyRetiredToOld = []; // Particles that just expired from the main 'smokeParticles'

    // Process active 'smokeParticles'
    for (const particle of smokeParticles) {
        particle.update(deltaTime_s, currentAirDensityValue);
        if (particle.age_s < particle.lifetime_s) {
            particle.draw(smokeLayerContainer, simulationState.cameraX_m, simulationState.cameraY_m, simulationState.currentPixelsPerMeter, app.screen.width, app.screen.height);
            if (particle.graphics.visible) {
                smokeLayerContainer.addChild(particle.graphics);
            }
            currentActiveSmoke.push(particle);
        } else {
            // Particle has expired
            particle.graphics.visible = false; // Ensure its graphics are not accidentally rendered
            // Logic for moving to oldSmokeParticles:
            // This logic was previously in Spacecraft.updatePhysics. It should be consolidated.
            // For now, let's replicate the SMOKE_PERSIST_CHANCE logic here.
            // Note: Spacecraft.updatePhysics also has a MAX_OLD_SMOKE_PARTICLES check when *adding* new particles.
            if (Math.random() > C.SMOKE_PERSIST_CHANCE) { // From constants.js via C
                 // This particle might become an "old" particle.
                 // It needs to be added to oldSmokeParticles array, but not drawn this frame as "active".
                 newlyRetiredToOld.push(particle);
            }
        }
    }
    smokeParticles = currentActiveSmoke;

    // Process 'oldSmokeParticles'
    const stillOldAndVisible = [];
    for (const particle of oldSmokeParticles) {
        particle.update(deltaTime_s, currentAirDensityValue); // They continue to age and fade
        if (particle.age_s < particle.lifetime_s) {
            particle.draw(smokeLayerContainer, simulationState.cameraX_m, simulationState.cameraY_m, simulationState.currentPixelsPerMeter, app.screen.width, app.screen.height);
            if (particle.graphics.visible) {
                smokeLayerContainer.addChild(particle.graphics);
            }
            stillOldAndVisible.push(particle);
        } else {
            particle.graphics.visible = false;
        }
    }
    // Combine still-living old particles with newly retired active particles
    oldSmokeParticles = stillOldAndVisible.concat(newlyRetiredToOld);
    
    // Optional: Limit the number of oldSmokeParticles (as was in Spacecraft.updatePhysics)
    while (oldSmokeParticles.length > C.MAX_OLD_SMOKE_PARTICLES) {
        const removedParticle = oldSmokeParticles.shift(); // Remove the oldest from the array
        // Its graphics are already removed from container due to removeChildren() or will be next frame.
    }
    
    // --- Environment Drawing ---
   // environmentContainer.removeChildren();
  //  ENV.drawSkyBackground(environmentContainer, spacecraftInstance ? spacecraftInstance.altitudeAGL_m : null, app.screen.width, app.screen.height);
    ENV.drawOrbitPath(orbitContainer, simulationState.cameraX_m, simulationState.cameraY_m, simulationState.currentPixelsPerMeter, spacecraftInstance, apoapsisAGL.value, periapsisAGL.value);  
   // ENV.drawClouds(environmentContainer, simulationState.cameraX_m, simulationState.cameraY_m, simulationState.currentPixelsPerMeter, spacecraftInstance ? spacecraftInstance.altitudeAGL_m : 0, cloudLayers, cloudTextures, app.screen.width, app.screen.height); 
   // ENV.drawPlanet(environmentContainer, simulationState.cameraX_m, simulationState.cameraY_m, simulationState.currentPixelsPerMeter,  app.screen.width, app.screen.height); 
  //  ENV.drawSurfaceFeatures(environmentContainer, simulationState.cameraX_m, simulationState.cameraY_m, simulationState.currentPixelsPerMeter, surfaceFeatures,  app.screen.width, app.screen.height);
    
    // --- Spacecraft Drawing ---
    spacecraftLayerContainer.removeChildren();

    if(spacecraftInstance) { 
        const comOffset_m = spacecraftInstance.getCoMOffset_m(); 
        const sfcComX_world = spacecraftInstance.position_x_m + comOffset_m * Math.sin(spacecraftInstance.angle_rad); 
        const sfcComY_world = spacecraftInstance.position_y_m + comOffset_m * Math.cos(spacecraftInstance.angle_rad); 
        const sfcComScreenX_main = app.screen.width/2 + (sfcComX_world - simulationState.cameraX_m) * simulationState.currentPixelsPerMeter; 
        const sfcComScreenY_main = app.screen.height/2 - (sfcComY_world - simulationState.cameraY_m) * simulationState.currentPixelsPerMeter; 
        
        if (simulationState.currentPixelsPerMeter >= C.SPACECRAFT_INDICATOR_PPM_THRESHOLD) {
             spacecraftInstance.draw(
                spacecraftLayerContainer, 
                app.screen.width, 
                app.screen.height, 
                sfcComScreenX_main, 
                sfcComScreenY_main, 
                simulationState.currentPixelsPerMeter
            );
        } else {
            // Spacecraft indicator drawing - needs to be converted to PIXI.Graphics
            // For now, this means small spacecraft won't be visible.
            // Example for later:
            // const indicator = new PIXI.Graphics();
            // indicator.beginFill(0xFFFF00); // Yellow
            // indicator.drawCircle(sfcComScreenX_main, sfcComScreenY_main, 3);
            // indicator.endFill();
            // spacecraftLayerContainer.addChild(indicator); 
            // // Similar for the velocity vector line
        }
        
        
    }
    
    // UI.drawHUD(ctx, spacecraftInstance, simulationState); // Commented out, uses ctx
    UI.updateStatsDisplay(simulationState, spacecraftInstance, apoapsisAGL.value, periapsisAGL.value);
    
    if (spacecraftInstance && simulationState.landed && !simulationState.engineActive && simulationState.isLaunched) {
        // dom.launchButton might be null if removed, handle this
        // if(dom.launchButton) dom.launchButton.textContent = "Landed"; 
    } 
  //  requestAnimationFrame(gameLoop); 
   
}
        
function setupEventListeners() {
    if(dom.launchButton) { 
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
            if(dom.launchButton) dom.launchButton.disabled = true; 
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
        UI.drawStagingAreaRocket(currentShipPartsConfig); // UI will use its internal refs
        UI.updateStagingStats();   // UI will use its internal refs
        initSimulation('template'); 
    });
    // Event listeners for builder actions are now in ui.js setupBuilderActionButtons
    
    document.addEventListener('keydown', (e) => { 
        if(!AUDIO.soundInitialized && (e.key === 'q' || e.key === 'Q' || e.key === 'e' || e.key === 'E' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === ' ')) AUDIO.initAudio(simulationState.soundMuted); 
        if (e.key === 'q' || e.key === 'Q' || e.key === 'ArrowLeft') simulationState.controlFlags.rotateLeft = true; 
        if (e.key === 'e' || e.key === 'E' || e.key === 'ArrowRight') simulationState.controlFlags.rotateRight = true; 
        if (e.key === '+' || e.key === '=') { if(!AUDIO.soundInitialized) AUDIO.initAudio(simulationState.soundMuted); simulationState.currentPixelsPerMeter *= 1.5; if(simulationState.currentPixelsPerMeter > 20) simulationState.currentPixelsPerMeter = 20;} 
        if (e.key === '-' || e.key === '_') { if(!AUDIO.soundInitialized) AUDIO.initAudio(simulationState.soundMuted); simulationState.currentPixelsPerMeter /= 1.5; if(simulationState.currentPixelsPerMeter < 1e-7) simulationState.currentPixelsPerMeter = 1e-7; } 
        if (e.key === ' ') { e.preventDefault(); if(currentShipPartsConfig.length > 0 && !dom.launchCurrentBuildButton.disabled) dom.launchCurrentBuildButton.click(); else if (dom.launchButton && !dom.launchButton.disabled) dom.launchButton.click(); }  
    });
    document.addEventListener('keyup', (e) => { 
        if (e.key === 'q' || e.key === 'Q' || e.key === 'ArrowLeft') simulationState.controlFlags.rotateLeft = false; 
        if (e.key === 'e' || e.key === 'E' || e.key === 'ArrowRight') simulationState.controlFlags.rotateRight = false; 
    });
    
    const makePressReleaseButton = (buttonElem, flagName) => { 
        if (!buttonElem) return; // Guard against null button
        const action = () => { if(!AUDIO.soundInitialized) AUDIO.initAudio(simulationState.soundMuted); simulationState.controlFlags[flagName] = true; }; 
        buttonElem.addEventListener('mousedown', action); 
        buttonElem.addEventListener('mouseup', () => simulationState.controlFlags[flagName] = false); 
        buttonElem.addEventListener('mouseleave', () => simulationState.controlFlags[flagName] = false); 
        buttonElem.addEventListener('touchstart', (e) => { e.preventDefault(); action(); }, {passive: false}); 
        buttonElem.addEventListener('touchend', (e) => { e.preventDefault(); simulationState.controlFlags[flagName] = false; }); 
    };
    makePressReleaseButton(dom.rotateLeftButton, 'rotateLeft'); 
    makePressReleaseButton(dom.rotateRightButton, 'rotateRight');
    
    if(dom.zoomInButton) dom.zoomInButton.addEventListener('click', () => { if(!AUDIO.soundInitialized) AUDIO.initAudio(simulationState.soundMuted); simulationState.currentPixelsPerMeter *= 1.5; if(simulationState.currentPixelsPerMeter > 20) simulationState.currentPixelsPerMeter = 20;}); 
    if(dom.zoomOutButton) dom.zoomOutButton.addEventListener('click', () => { if(!AUDIO.soundInitialized) AUDIO.initAudio(simulationState.soundMuted); simulationState.currentPixelsPerMeter /= 1.5; if(simulationState.currentPixelsPerMeter < 1e-7) simulationState.currentPixelsPerMeter = 1e-7; });
    canvas.addEventListener('wheel', (e) => { if(!AUDIO.soundInitialized) AUDIO.initAudio(simulationState.soundMuted); e.preventDefault(); if (e.deltaY < 0) {simulationState.currentPixelsPerMeter *= 1.5; if(simulationState.currentPixelsPerMeter > 20) simulationState.currentPixelsPerMeter = 20;} else {simulationState.currentPixelsPerMeter /= 1.5; if(simulationState.currentPixelsPerMeter < 1e-7) simulationState.currentPixelsPerMeter = 1e-7;} });
}

async function completeInitialization() {



    // Initialize spacecraft module with dependencies it needs to call back
    initializeSpacecraftAndParts(
        (active, ratio) => AUDIO.playEngineSound(active, ratio, simulationState.soundMuted), 
        () => AUDIO.playGimbalSound(simulationState.soundMuted), 
        simulationState, // Pass the main simulationState object
        smokeParticles,  // Pass the main smokeParticles array
        oldSmokeParticles, // Pass the main oldSmokeParticles array
        currentAirDensityValue // Pass the main air density value (primitive, so it's a copy)
                               // Spacecraft.updatePhysics will return new airDensity
    );
    
    await UI.initializeUI(
        dom, 
        currentShipPartsConfig, 
        spacecraftDesigns, 
        initSimulation, 
       // sharedRenderer,            
        stagingCanvas,         
        simulationState,
        partCatalog,
        AUDIO // Pass the AUDIO module to ui.js for touch event audio init
    );
     globalThis.__PIXI_APP__ =  app;
    // Drag and Drop listeners are now set up inside initializeUI using initializeDragAndDropInternal
    
    // Update PixiJS app dimensions if canvas size changed by logic elsewhere (though it's set once now)
    // app.renderer.resize(canvas.width, canvas.height);
    
    setupEventListeners(); 
    initSimulation('template');
    // requestAnimationFrame(gameLoop); // PIXI.Application uses its own ticker by default
   // app.ticker.add(gameLoop); // Add gameLoop to PixiJS ticker

    // Initialize Inset View Pixi Application
    if (insetCanvas) {
        insetApp = new PIXI.Application();
        await insetApp.init({
            canvas: insetCanvas,
            // resizeTo: insetCanvas, // Optional, if you want it to resize with the canvas
            // sharedRenderer: sharedRenderer, // If you want to share the renderer{
         //   renderer: sharedRenderer,
            width: insetCanvas.width,
            height: insetCanvas.height,
            backgroundColor: 0x222222, // Darker background
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
        });
        insetSpacecraftContainer = new PIXI.Container();
        insetApp.stage.addChild(insetSpacecraftContainer);
    } else {
        console.error("Inset canvas not found for Pixi initialization.");
    }

    insetApp.ticker.add(() => {
        // Inset view drawing
        if (insetApp && spacecraftInstance && simulationState.currentPixelsPerMeter < C.INSET_VIEW_PPM_THRESHOLD) {
            insetCanvas.style.display = 'block';
            insetSpacecraftContainer.removeChildren();
            
            const largerCraftDim_m = Math.max(spacecraftInstance.logicalStackHeight_m, spacecraftInstance.maxWidth_m, 1);
            const insetPPM = C.INSET_VIEW_TARGET_SIZE_PX / largerCraftDim_m;
            const insetSfcScreenX = insetApp.screen.width / 2;
            const insetSfcScreenY = insetApp.screen.height / 2;

            spacecraftInstance.draw(
                insetSpacecraftContainer,
                insetApp.screen.width,
                insetApp.screen.height,
                insetSfcScreenX,
                insetSfcScreenY,
                insetPPM,
                true // isInsetView = true
            );
        } else {
            insetCanvas.style.display = 'none';
        }
});}
if (document.readyState !== 'loading') {completeInitialization(); }
else { 
    // If DOM is not ready, wait for it to load
    document.addEventListener('DOMContentLoaded', completeInitialization); 
}