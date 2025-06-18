import React from 'react';
import ReactDOM from 'react-dom/client'; // For React 18+
import App from './App.js'; // Assuming App.js is in the same directory

import * as C from './constants.js';
import { Part, CommandPod, FuelTank, Engine, Fairing } from './parts.js';
import { Spacecraft, initializeSpacecraftAndParts } from './spacecraft.js';
import { SmokeParticle } from './smoke.js';
import * as ENV from './environment.js';
import * as AUDIO from './audio.js';
import * as UI from './ui.js';
import * as PIXI from 'pixi.js';
//PIXI.extensions.remove("batcher");
import { Viewport } from 'pixi-viewport';
import { updateMoonPosition, drawMoon } from './moon.js';
import { calculateLighting, updateLighting } from './lighting.js';
import { updatePlanetRotation } from './environment.js';

//import * as PIXI from "https://esm.sh/pixi.js@8.9.2";


export { PIXI };

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

// Canvas and DOM elements will be accessed after React renders them.
// Global PIXI app instances
let pixiApp = null;
let viewport = null;
let environmentContainer = null;
let orbitContainer = null;
let smokeLayerContainer = null;
let spacecraftLayerContainer = null;
let insetApp = null;
let insetSpacecraftContainer = null;

// This object will be populated AFTER React renders and completeInitialization is called
const dom = {};

const partCatalog = { // For ui.js to know how to instantiate parts for thumbnails/drag data
    'pod': CommandPod,
    'tank': FuelTank,
    'engine': Engine,
    'fairing': Fairing
};

const spacecraftDesigns = {
    "DefaultOrbiter": [
        { type: 'engine', name: 'Main Engine LKO', thrust_N: 250000, fuelConsumptionRate_kg_s: 80, dryMass_kg: 1000, width_m: 2.5, height_m: 2, isp: 310 },
        { type: 'tank', name: 'Medium Tank', fuelCapacity_kg: 10000, dryMass_kg: 1500, width_m: 2.5, height_m: 8 },
        { type: 'pod', name: 'Orbiter Pod', dryMass_kg: 800, width_m: 2.5, height_m: 2 }
    ],
    "SmallProbe": [{ type: 'engine', name: 'Small Engine', thrust_N: 50000, fuelConsumptionRate_kg_s: 20, dryMass_kg: 200, width_m: 1, height_m: 1, isp: 280 }, { type: 'tank', name: 'Small Tank', fuelCapacity_kg: 1000, dryMass_kg: 100, width_m: 1, height_m: 2 }, { type: 'fairing', name: '1.2m Fairing', dryMass_kg: 50, width_m: 1.2, height_m: 1.5 }, { type: 'pod', name: 'Probe Core', dryMass_kg: 150, width_m: 0.8, height_m: 0.8, color: 'gold' }],
    "HeavyLifter_Lower": [{ type: 'engine', name: 'Heavy Engine', thrust_N: 1000000, fuelConsumptionRate_kg_s: 300, dryMass_kg: 5000, width_m: 4, height_m: 3, isp: 300 }, { type: 'tank', name: 'Large Tank', fuelCapacity_kg: 50000, dryMass_kg: 5000, width_m: 4, height_m: 15 },]
};
const PLANET_CONTAINER = "planetContainer";
// Object.keys(spacecraftDesigns).forEach(key => spacecraftDesigns[key].reverse());


async function initSimulation(launchSource = 'template') {
    const urlParams = new URLSearchParams(window.location.search);
    if (dom.statsPanel) { dom.statsPanel.style.display = (urlParams.get('stats') === 'true') ? 'block' : 'none'; }

    // let designToLoad;
    // if (launchSource === 'staging' && currentShipPartsConfig.length > 0) {
    //     designToLoad = currentShipPartsConfig;
    // } else {
    //     const selectedDesignName = dom.designSelect.value || simulationState.currentDesignName;
    //     simulationState.currentDesignName = selectedDesignName;
    //     designToLoad = spacecraftDesigns[selectedDesignName];
    // }
    // if (!designToLoad || designToLoad.length === 0) {
    //     if (Object.keys(spacecraftDesigns).length > 0) {
    //         designToLoad = spacecraftDesigns[Object.keys(spacecraftDesigns)[0]];
    //     } else {
    //         alert("Error: No spacecraft designs available."); return;
    //     }
    // }
    // spacecraftInstance = new Spacecraft(designToLoad);

    // Generate random angle for position on Earth's perimeter
    const randomAngle = Math.random() * 2 * Math.PI;
    // 
    spacecraftInstance.resetToPostionOnSurface(randomAngle);
    resetViewport();
    viewport.fitHeight(4*C.EARTH_RADIUS_M, true);
    //spacecraftInstance.angularVelocity_rad_s = 0;
   // viewport.follow(spacecraftLayerContainer);
//   viewport.onDragStart = () => {viewport.stopFollow();}
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

    if (dom.launchButton) dom.launchButton.disabled = false;

    UI.updateStatsDisplay(simulationState, spacecraftInstance, apoapsisAGL.value, periapsisAGL.value);

    if (launchSource === 'template' || currentShipPartsConfig.length === 0) {
        const templateToLoadCfg = spacecraftDesigns[simulationState.currentDesignName] || spacecraftDesigns[Object.keys(spacecraftDesigns)[0]];
        currentShipPartsConfig = JSON.parse(JSON.stringify(templateToLoadCfg));
    }

    await ENV.drawPlanet(environmentContainer, 0);
    viewport.fitWidth(4 * C.EARTH_RADIUS_M, true);

    UI.drawStagingAreaRocket(currentShipPartsConfig);
       // --- Spacecraft Drawing ---
       if (spacecraftInstance) {

         spacecraftInstance.draw(
            environmentContainer.getChildByLabel(C.PLANET_CONTAINER,true),
            false
         );
         console.log("SPACECRAFT_GRAPHICS_CONTAINER", environmentContainer.getChildByLabel(C.SPACECRAFT_GRAPHICS_CONTAINER, true));

        let spacecraftContainer =   viewport.getChildByLabel(C.SPACECRAFT_GRAPHICS_CONTAINER, true);
        spacecraftInstance.position = spacecraftContainer?.getGlobalPosition();
    viewport.moveCenter( spacecraftInstance.position.x, spacecraftInstance.position.y); 
    initParticles();

    }

}

function initParticles(){

}

function updateCamera() {
    if (!spacecraftInstance) return;
let spacecraftContainer =   viewport.getChildByLabel(C.SPACECRAFT_GRAPHICS_CONTAINER, true);
let newPos = new PIXI.Point(spacecraftContainer._position.x, spacecraftContainer._position.y);
spacecraftInstance.position = spacecraftContainer?.getGlobalPosition();
   viewport.moveCenter(spacecraftInstance.position.x, spacecraftInstance.position.y); 
    //console.log("spacecraftInstance.position", spacecraftInstance.position);
    //const comOffset_m = spacecraftInstance.getCoMOffset_m();
    //const comX = spacecraftInstance.position_x_m + comOffset_m * Math.sin(spacecraftInstance.angle_rad);
    //const comY = spacecraftInstance.position_y_m - comOffset_m * Math.cos(spacecraftInstance.angle_rad);
   // viewport.ensureVisible(spacecraftInstance.position.x, spacecraftInstance.position.y, 1, 1, true);

    // const targetCameraX_m = comX; const targetCameraY_m = comY; 
    // const lerpFactor = 0.1; 
    // simulationState.cameraX_m += (targetCameraX_m - simulationState.cameraX_m) * lerpFactor; 
    // simulationState.cameraY_m += (targetCameraY_m - simulationState.cameraY_m) * lerpFactor; 
}

function resetViewport(){
    if(spacecraftInstance.position)
    viewport.animate({
        x: spacecraftInstance.position?.x,
        y: spacecraftInstance.position?.y,
        duration: 5000,
        //ease: 'power2.inOut',
        width: 250
    });
}
let smokeTrailDeltaTime_s = 0; // For smoke trail timing
let smokeTrailPoints = []; // For smoke trail points
function gameLoop(ticker) {
    var deltaTime_s = ticker.deltaTime
    //if (!simulationState.lastTimestamp) simulationState.lastTimestamp = ticker.last;
    simulationState.timeElapsed =  ticker.elapsedMS
    
    simulationState.lastTimestamp = ticker.lastTime;

    // Update graphics
    //updateGraphics(deltaTime_s);

    // Update planet rotation
    //updatePlanetRotation(deltaTime_s);

    // Update moon position
    drawMoon(environmentContainer, deltaTime_s);

    // Update lighting
    updateLighting(deltaTime_s);


  //  const scaledDeltaTime_s = (deltaTime_ms / 1000) * C.TIME_SCALE;

    // if (spacecraftInstance && simulationState.isLaunched && !simulationState.landed) {
    //     simulationState.timeElapsed += deltaTime_s; // Update time elapsed in seconds
    // }

    if (spacecraftInstance && simulationState.isLaunched) {
        const physicsResult = spacecraftInstance.updatePhysics(
            deltaTime_s,
            simulationState.engineActive,
            simulationState.controlFlags.rotateLeft,
            simulationState.controlFlags.rotateRight,
            currentAirDensityValue,
            apoapsisAGL, periapsisAGL,
            smokeParticles, simulationState
        );
      //  currentAirDensityValue = physicsResult.currentAirDensity;
       // currentDragForceMagnitude = physicsResult.currentDrag;
           // --- Spacecraft Drawing ---
  
    }

    updateCamera();

    // --- Smoke Particle Update, Draw, and Management ---
    const currentActiveSmoke = [];
    const newlyRetiredToOld = []; // Particles that just expired from the main 'smokeParticles'

    // Process active 'smokeParticles'
    // for (const particle of smokeParticles) {
    //     particle.update(deltaTime_s, currentAirDensityValue);
    //     if (particle.age_s < particle.lifetime_s) {
    //         particle.draw(smokeLayerContainer, simulationState.cameraX_m, simulationState.cameraY_m, simulationState.currentPixelsPerMeter, pixiApp.screen.width, pixiApp.screen.height);
    //         if (particle.graphics.visible) {
    //             smokeLayerContainer.addChild(particle.graphics);
    //         }
    //         currentActiveSmoke.push(particle);
    //     } else {
    //         particle.graphics.visible = false;
    //         if (Math.random() > C.SMOKE_PERSIST_CHANCE) {
    //             newlyRetiredToOld.push(particle);
    //         }
    //     }
    // }
    smokeParticles = currentActiveSmoke;

    const stillOldAndVisible = [];
    // for (const particle of oldSmokeParticles) {
    //     particle.update(deltaTime_s, currentAirDensityValue);
    //     if (particle.age_s < particle.lifetime_s) {
    //         particle.draw(smokeLayerContainer, simulationState.cameraX_m, simulationState.cameraY_m, simulationState.currentPixelsPerMeter, pixiApp.screen.width, pixiApp.screen.height);
    //         if (particle.graphics.visible) {
    //             smokeLayerContainer.addChild(particle.graphics);
    //         }
    //         stillOldAndVisible.push(particle);
    //     } else {
    //         particle.graphics.visible = false;
    //     }
    // }
    oldSmokeParticles = stillOldAndVisible.concat(newlyRetiredToOld);

    // Optional: Limit the number of oldSmokeParticles (as was in Spacecraft.updatePhysics)
    while (oldSmokeParticles.length > C.MAX_OLD_SMOKE_PARTICLES) {
        const removedParticle = oldSmokeParticles.shift(); // Remove the oldest from the array
        // Its graphics are already removed from container due to removeChildren() or will be next frame.
    }
   // smokeTrailDeltaTime_s += deltaTime_ms;
    // if (smokeTrailDeltaTime_s >= 1000.0 / C.SMOKE_PARTICLES_PER_SECOND_BASE) {
    //     smokeTrailDeltaTime_s = 0; // Reset the delta time for smoke trail
    //     var smokeTrail = smokeLayerContainer.getChildByName('smokeTrail');
    //     if (!smokeTrail) {
    //         smokeTrail = new PIXI.Graphics();
    //         smokeTrail.label = 'smokeTrail';
    //         smokeLayerContainer.addChild(smokeTrail);
    //     }
    //     smokeTrail.clear();
    //     smokeTrail.lineStyle(2, 0x808080, 0.5); // Gray color with some transparency
    //     smokeTrail.moveTo(spacecraftInstance.position_x_m, spacecraftInstance.position_y_m);
    //     smokeTrailPoints.push({
    //         x: spacecraftInstance.position_x_m,
    //         y: spacecraftInstance.position_y_m,
    //         age_s: 0
    //     });
    //     for (let i = smokeTrailPoints.length - 1; i >= 0; i--) {
    //         const point = smokeTrailPoints[i];
    //         point.age_s += 1.0 / C.SMOKE_PARTICLES_PER_SECOND_BASE; // Increment age by 1 second per frame
    //         if (point.age_s > C.SMOKE_LIFETIME_S_MAX) {
    //             smokeTrailPoints.splice(i, 1); // Remove old points
    //         } else {
    //             smokeTrail.lineTo(point.x, point.y);
    //         }
    //     }
    // }// Adjusted for base rate
    // --- Environment Drawing ---
    //pixiApp.stage.removeChildren();

    // Draw environment (Earth, atmosphere, etc.)
    

    // Draw moon


    // Apply lighting effects
    // calculateLighting(environmentContainer, simulationState.cameraX_m, simulationState.cameraY_m,
    //     simulationState.currentPixelsPerMeter, pixiApp.screen.width, pixiApp.screen.height);

 
    ENV.drawPlanet(environmentContainer, deltaTime_s);
    UI.updateStatsDisplay(simulationState, spacecraftInstance, apoapsisAGL.value, periapsisAGL.value);

    // Inset view drawing
    if (insetApp && spacecraftInstance && simulationState.currentPixelsPerMeter < C.INSET_VIEW_PPM_THRESHOLD) {
        if (dom.insetCanvas) dom.insetCanvas.style.display = 'block'; // Check if dom.insetCanvas exists
        insetSpacecraftContainer.removeChildren();
        environmentContainer.getChildByLabel(C.SPACECRAFT_GRAPHICS_CONTAINER,true).scale.set(1000);
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
        if (dom.insetCanvas) dom.insetCanvas.style.display = 'none'; // Check if dom.insetCanvas exists
    }
}



function setupEventListeners() {
    // Note: 'dom.launchButton' might not exist if it was removed from the JSX.
    // The event listeners will only be attached if the elements are found by their ID in the React-rendered DOM.

    if (dom.launchButton) { // This specific button might be removed in JSX
        dom.launchButton.addEventListener('click', async () => {
            if (!AUDIO.soundInitialized) AUDIO.initAudio(simulationState.soundMuted);
           // await initSimulation('template');
            if (spacecraftInstance) {
                simulationState.isLaunched = true; simulationState.landed = false;
                simulationState.engineActive = spacecraftInstance.currentFuel_kg > 0;
                dom.launchButton.textContent = simulationState.engineActive ? "Engine Active (TPL)" : (spacecraftInstance.currentFuel_kg > 0 ? "Engine Off (TPL)" : "Out of Fuel (TPL)");
                dom.launchButton.disabled = spacecraftInstance.currentFuel_kg <= 0 && !simulationState.engineActive;
                pixiApp.ticker.start(); 
            }
        });
    }

    if (dom.launchCurrentBuildButton) {
        dom.launchCurrentBuildButton.addEventListener('click', async () => {
            if (!AUDIO.soundInitialized) AUDIO.initAudio(simulationState.soundMuted);
          //  stopSimulation();
            viewport.fitWidth(4 * C.EARTH_RADIUS_M, true);
            if (currentShipPartsConfig.length === 0) { alert("Staging area is empty!"); return; }
           // await initSimulation('staging');
            if (spacecraftInstance) {
                var planetContainer = environmentContainer?.getChildByLabel(C.PLANET_CONTAINER);
                // on Launch we reparent the spacecraft into the parent of the planet container so that it no longer rotates with the planet
                if( planetContainer)
                environmentContainer?.reparentChildAt(planetContainer?.getChildByLabel(C.SPACECRAFT_GRAPHICS_CONTAINER,true), 0);
                //environmentContainer.getChildByLabel(SPACECRAFT_GRAPHICS_CONTAINER,true).reparentAt( environmentContainer.getChildByLabel("planetContainer",true), 0);
                resetViewport();
                simulationState.isLaunched = true; simulationState.landed = false;
                simulationState.engineActive = spacecraftInstance.currentFuel_kg > 0;
                if (dom.launchButton) dom.launchButton.disabled = true;
                  pixiApp.ticker.start(); // Start the PIXI ticker if not already runningapp
            }
        });
    }
    if (dom.resetButton) {
        dom.resetButton.addEventListener('click', async () => {
            stopSimulation();
            viewport.fit(true);
            if (!AUDIO.soundInitialized) AUDIO.initAudio(simulationState.soundMuted);
            await initSimulation('template');
            if (dom.launchButton) dom.launchButton.disabled = false;
        });
    }
    if (dom.muteButton) {
        dom.muteButton.addEventListener('click', () => AUDIO.toggleMuteAudio(simulationState.soundMuted, simulationState.engineActive, spacecraftInstance ? spacecraftInstance.currentThrust_N / (spacecraftInstance.maxThrust_N || 1) : 0, simulationState));
    }
    if (dom.designSelect) {
        dom.designSelect.addEventListener('change', async (event) => {
            stopSimulation();
            simulationState.currentDesignName = event.target.value;
            const selectedDesign = spacecraftDesigns[simulationState.currentDesignName];
            if (selectedDesign) { 
                currentShipPartsConfig = JSON.parse(JSON.stringify(selectedDesign)); 
                spacecraftInstance = new Spacecraft(currentShipPartsConfig, simulationState, C, initSimulation);
                UI.drawStagingAreaRocket(currentShipPartsConfig);
                UI.updateStagingStats();
                await initSimulation('template');
            }
            else { currentShipPartsConfig = []; }
           
        });
        dom.designSelect.selectedIndex = 0;
        const event = new Event('change');
        dom.designSelect.dispatchEvent(event);
    }

    document.addEventListener('keydown', (e) => {
        if (!AUDIO.soundInitialized && (e.key === 'q' || e.key === 'Q' || e.key === 'e' || e.key === 'E' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === ' ')) AUDIO.initAudio(simulationState.soundMuted);
        if (e.key === 'q' || e.key === 'Q' || e.key === 'ArrowLeft') simulationState.controlFlags.rotateLeft = true;
        if (e.key === 'e' || e.key === 'E' || e.key === 'ArrowRight') simulationState.controlFlags.rotateRight = true;
        if (e.key === '+' || e.key === '=') { if (!AUDIO.soundInitialized) AUDIO.initAudio(simulationState.soundMuted); simulationState.currentPixelsPerMeter *= 1.5; if (simulationState.currentPixelsPerMeter > 20) simulationState.currentPixelsPerMeter = 20; }
        if (e.key === '-' || e.key === '_') { if (!AUDIO.soundInitialized) AUDIO.initAudio(simulationState.soundMuted); simulationState.currentPixelsPerMeter /= 1.5; if (simulationState.currentPixelsPerMeter < 1e-7) simulationState.currentPixelsPerMeter = 1e-7; }
        if (e.key === ' ') { e.preventDefault(); if (dom.launchCurrentBuildButton && currentShipPartsConfig.length > 0 && !dom.launchCurrentBuildButton.disabled) dom.launchCurrentBuildButton.click(); else if (dom.launchButton && !dom.launchButton.disabled) dom.launchButton.click(); }
    });
    document.addEventListener('keyup', (e) => {
        if (e.key === 'q' || e.key === 'Q' || e.key === 'ArrowLeft') simulationState.controlFlags.rotateLeft = false;
        if (e.key === 'e' || e.key === 'E' || e.key === 'ArrowRight') simulationState.controlFlags.rotateRight = false;
    });

    const makePressReleaseButton = (buttonElem, flagName) => {
        if (!buttonElem) return; // Guard against null button
        const action = () => { if (!AUDIO.soundInitialized) AUDIO.initAudio(simulationState.soundMuted); simulationState.controlFlags[flagName] = true; };
        buttonElem.addEventListener('mousedown', action);
        buttonElem.addEventListener('mouseup', () => simulationState.controlFlags[flagName] = false);
        buttonElem.addEventListener('mouseleave', () => simulationState.controlFlags[flagName] = false);
        buttonElem.addEventListener('touchstart', (e) => { e.preventDefault(); action(); }, { passive: false });
        buttonElem.addEventListener('touchend', (e) => { e.preventDefault(); simulationState.controlFlags[flagName] = false; });
    };
    makePressReleaseButton(dom.rotateLeftButton, 'rotateLeft');
    makePressReleaseButton(dom.rotateRightButton, 'rotateRight');

    if (dom.zoomInButton) dom.zoomInButton.addEventListener('click', () => { 
        if (!AUDIO.soundInitialized) 
            AUDIO.initAudio(simulationState.soundMuted); 
        //viewport.
        simulationState.currentPixelsPerMeter *= 1.5;
         if (simulationState.currentPixelsPerMeter > 20)
            simulationState.currentPixelsPerMeter = 20; 
        });
    if (dom.zoomOutButton) dom.zoomOutButton.addEventListener('click', () => {
         if (!AUDIO.soundInitialized) 
            AUDIO.initAudio(simulationState.soundMuted); 
        simulationState.currentPixelsPerMeter /= 1.5; 
        if (simulationState.currentPixelsPerMeter < 1e-7) 
            simulationState.currentPixelsPerMeter = 1e-7; });

    // Attach wheel event to gameCanvas if it exists
    if (dom.gameCanvas) {
        // dom.gameCanvas.addEventListener('wheel', (e) => {
        //     if(!AUDIO.soundInitialized) AUDIO.initAudio(simulationState.soundMuted);
        //     e.preventDefault();
        //     if (e.deltaY < 0) {simulationState.currentPixelsPerMeter *= 1.5; if(simulationState.currentPixelsPerMeter > 20) simulationState.currentPixelsPerMeter = 20;}
        //     else {simulationState.currentPixelsPerMeter /= 1.5; if(simulationState.currentPixelsPerMeter < 1e-7) simulationState.currentPixelsPerMeter = 1e-7;}
        // });
    }
}

function stopSimulation() {
    pixiApp.ticker.stop();
}

async function completeInitialization() {
    // Populate the dom object now that React has rendered the HTML structure
    dom.gameCanvas = document.getElementById('gameCanvas');
    dom.insetCanvas = document.getElementById('insetCanvas');
    dom.stagingCanvas = document.getElementById('stagingCanvas');
    dom.dragImage = document.getElementById('dragImage');

    dom.time = document.getElementById('time');
    dom.apoapsis = document.getElementById('apoapsis');
    dom.periapsis = document.getElementById('periapsis');
    dom.angle = document.getElementById('angle');
    dom.gimbal = document.getElementById('gimbal');
    dom.mass = document.getElementById('mass');
    dom.thrust = document.getElementById('thrust');
    dom.zoomLevel = document.getElementById('zoomLevel');
    dom.resetButton = document.getElementById('resetButton');
    dom.muteButton = document.getElementById('muteButton');
    dom.designSelect = document.getElementById('designSelect');
    dom.rotateLeftButton = document.getElementById('rotateLeftButton');
    dom.rotateRightButton = document.getElementById('rotateRightButton');
    dom.zoomInButton = document.getElementById('zoomInButton');
    dom.zoomOutButton = document.getElementById('zoomOutButton');
    dom.fuelGaugeBar = document.getElementById('fuelGaugeBar');
    dom.fuelText = document.getElementById('fuelText');
    dom.statsPanel = document.getElementById('stats');
    dom.clearStagingButton = document.getElementById('clearStagingButton');
    dom.launchCurrentBuildButton = document.getElementById('launchCurrentBuildButton');
    dom.undoLastPartButton = document.getElementById('undoLastPartButton');
    dom.stagingMass = document.getElementById('stagingMass');
    dom.stagingThrust = document.getElementById('stagingThrust');
    dom.stagingDeltaV = document.getElementById('stagingDeltaV');
    dom.spacecraftPosition_x = document.getElementById('spacecraftPosition_x');
    dom.spacecraftPosition_y = document.getElementById('spacecraftPosition_y');
    dom.viewportPosition_x = document.getElementById('viewportPosition_x');
    dom.viewportPosition_y = document.getElementById('viewportPosition_y');
    // dom.launchButton = document.getElementById('launchButton'); // Example if it was kept

    // Check if essential canvas elements exist
    if (!dom.gameCanvas || !dom.stagingCanvas) {
        console.error("Essential canvas elements (gameCanvas or stagingCanvas) not found in the DOM after React render. Game cannot initialize.");
        return;
    }

    // const allTextures = await PIXI.Assets.load(['images/clouds-0.json', 'images/clouds-0.png']); // Already loaded globally if needed or move here.

    pixiApp = new PIXI.Application();
    await pixiApp.init({
        backgroundColor: 0x000000,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        canvas: dom.gameCanvas, // Use the canvas from the React-rendered DOM
    });
    pixiApp.ticker.stop(); // Stop the ticker until we explicitly start it in gameLoop
    viewport = new Viewport({
        passiveWheel: false,
        events: pixiApp.renderer.events
    });
    viewport.drag().pinch().wheel().decelerate();
    viewport.addEventListener('zoomed', (event) => {
        simulationState.currentPixelsPerMeter = event.viewport.scale.x;
        if (dom.zoomLevel) dom.zoomLevel.textContent = `Zoom: ${simulationState.currentPixelsPerMeter.toFixed(6)} px/m`;
    });
    viewport.addEventListener('moved', (event) => {
        simulationState.viewportPosition_x = event.viewport.center.x;
        simulationState.viewportPosition_y = event.viewport.center.y;
    });
// Initialize the asset system
await PIXI.Assets.init({
    basePath: 'images/',
});
    environmentContainer = new PIXI.Container();
    environmentContainer.label = "environmentContainer";
    orbitContainer = new PIXI.Container();
    smokeLayerContainer = new PIXI.Container();
    spacecraftLayerContainer = new PIXI.Container();
    spacecraftLayerContainer.label = "spacecraftLayerContainer";

    // Add containers to viewport
    viewport.addChild(environmentContainer);
    viewport.addChild(orbitContainer);
    viewport.addChild(smokeLayerContainer);
    viewport.addChild(spacecraftLayerContainer);

    // Create graphics objects once


    // // Create continent containers
    // C.CONTINENTS.forEach(continent => {
    //     const continentContainer = new PIXI.Container();
    //     continentContainer.label = `continent_${continent.label}`;

    //     const continentGraphics = new PIXI.Graphics();
    //     continentGraphics.moveTo(continent.points[0].x * C.planet.radius_m, continent.points[0].y * C.planet.radius_m);
    //     for (let i = 1; i < continent.points.length; i++) {
    //         continentGraphics.lineTo(continent.points[i].x * C.planet.radius_m, continent.points[i].y * C.planet.radius_m);
    //     }
    //     continentGraphics.closePath()
    //         .fill(continent.color);

    //     continentContainer.addChild(continentGraphics);
    //     environmentContainer.addChild(continentContainer);
    // });

    // Create moon and its shadow


    // const moonShadowGraphics = new PIXI.Graphics();
    // moonShadowGraphics.label = 'moonShadow';
    // moonShadowGraphics.circle(0, 0, C.planet.moon.radius_m * 1.2)
    //     .fill({ color: 0x000000, alpha: 0.3 });
    // environmentContainer.addChild(moonShadowGraphics);

    // // Create smoke particles container
    // const smokeParticles = new PIXI.Container();
    // smokeParticles.label = 'smokeParticles';
    // smokeLayerContainer.addChild(smokeParticles);

    // // Create orbit graphics
    // const orbitGraphics = new PIXI.Graphics();
    // orbitGraphics.label = 'orbit';

    // orbitContainer.addChild(orbitGraphics);

    globalThis.__PIXI_APP__ = pixiApp; // For PIXI dev tools

    initializeSpacecraftAndParts(
        (active, ratio) => AUDIO.playEngineSound(active, ratio, simulationState.soundMuted),
        () => AUDIO.playGimbalSound(simulationState.soundMuted),
        simulationState, smokeParticles, oldSmokeParticles, currentAirDensityValue,
        C,
        initSimulation  // Pass the initSimulation function
    );

    await UI.initializeUI(
        dom, currentShipPartsConfig, spacecraftDesigns, initSimulation,
        dom.stagingCanvas, simulationState, partCatalog, AUDIO
    );
    pixiApp.stage.addChild(viewport);
    setupEventListeners();
    
    pixiApp.ticker.add(gameLoop); // Start the game loop
    // Add a PIXI ticker listener for smoke trail drawing
    // Initialize Inset View Pixi Application
    if (dom.insetCanvas) {
        insetApp = new PIXI.Application();
        await insetApp.init({
            canvas: dom.insetCanvas,
            width: dom.insetCanvas.width,
            height: dom.insetCanvas.height,
            backgroundColor: 0x222222,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
        });
        insetSpacecraftContainer = new PIXI.Container();
        insetApp.stage.addChild(insetSpacecraftContainer);
        // The gameLoop itself will handle insetApp.ticker logic for drawing.
        // No need to add gameLoop to insetApp.ticker, it's driven by the main ticker.
    } else {
        console.warn("Inset canvas not found for Pixi initialization. Inset view will be disabled.");
    }

    pixiApp.ticker.start();
}

// --- React Application Setup ---
const rootElement = document.getElementById('root');
if (rootElement) {
    const reactRoot = ReactDOM.createRoot(rootElement);
    reactRoot.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );

    // Ensure the game logic initializes after React has rendered the DOM structure
    // For simple cases, a timeout of 0 can work to push execution to after the current render cycle.
    // A more robust solution might involve a callback from App.js after its first render (e.g., via useEffect).
    if (document.readyState !== 'loading') { completeInitialization(); }
    else {
        // If DOM is not ready, wait for it to load
        document.addEventListener('DOMContentLoaded', completeInitialization);
    }
    // setTimeout(completeInitialization, 0);

} else {
    console.error("Failed to find the root element for React. App cannot start.");
}
let moonContainer = null;
// function initializeGraphics() {
//     // Create viewport
//     viewport = new Viewport({
//         passiveWheel: false,
//         events: pixiApp.renderer.events
//     });

//     // Add viewport to stage
//     pixiApp.stage.addChild(viewport);

//     // Enable viewport features
//     viewport
//         .drag()
//         .pinch()
//         .wheel()
//         .decelerate();

//     // Create layer containers
//     environmentContainer = new PIXI.Container();
//     orbitContainer = new PIXI.Container();
//     smokeLayerContainer = new PIXI.Container();
//     spacecraftLayerContainer = new PIXI.Container();

//     // Add containers to viewport
//     viewport.addChild(environmentContainer);
//     viewport.addChild(orbitContainer);
//     viewport.addChild(smokeLayerContainer);
//     viewport.addChild(spacecraftLayerContainer);

//     // Create graphics objects once
//     const planetGraphics = new PIXI.Graphics();
//     planetGraphics.label = 'planet';
//     planetGraphics.circle(0, 0, C.planet.radius_m)
//         .fill(C.planet.color);
//     environmentContainer.addChild(planetGraphics);



//     // Create continent containers
//     C.CONTINENTS.forEach(continent => {
//         const continentContainer = new PIXI.Container();
//         continentContainer.label = `continent_${continent.label}`;

//         const continentGraphics = new PIXI.Graphics();
//         continentGraphics.moveTo(continent.points[0].x * C.planet.radius_m, continent.points[0].y * C.planet.radius_m);
//         for (let i = 1; i < continent.points.length; i++) {
//             continentGraphics.lineTo(continent.points[i].x * C.planet.radius_m, continent.points[i].y * C.planet.radius_m);
//         }
//         continentGraphics.closePath()
//             .fill(continent.color);

//         continentContainer.addChild(continentGraphics);
//         environmentContainer.addChild(continentContainer);
//     });

//     // Create moon and its shadow
//     moonContainer = new PIXI.Container();
//     moonContainer.label = 'moonContainer';
//     environmentContainer.addChild(moonContainer);


//     // Create smoke particles container
//     const smokeParticles = new PIXI.Container();
//     smokeParticles.label = 'smokeParticles';
//     smokeLayerContainer.addChild(smokeParticles);

//     // Create orbit graphics

//     ENV.drawOrbitPath(orbitContainer, simulationState.cameraX_m, simulationState.cameraY_m, simulationState.currentPixelsPerMeter, spacecraftInstance, apoapsisAGL.value, periapsisAGL.value);

// }
