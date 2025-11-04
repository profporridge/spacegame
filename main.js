// React imports
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';

// External library imports
import { Viewport } from 'pixi-viewport';
import * as PIXI from 'pixi.js';

// Internal module imports - constants and core classes
import * as C from './constants.js';
import { CommandPod, FuelTank, Engine, Fairing } from './parts.js';
import { Spacecraft, initializeSpacecraftAndParts } from './spacecraft.js';

// Internal module imports - feature modules
import * as ENV from './environment.js';
import * as AUDIO from './audio.js';
import * as UI from './ui.js';
import { drawMoon } from './moon.js';
import { updateLighting } from './lighting.js';
import { createFlameParticleSystem, createSmokeParticleSystem } from './particles.js';

export { PIXI, parts };

// ============================================================================
// Application State - PIXI app instances and containers
// ============================================================================
let pixiApp = null;
let viewport = null;
let parts = null;
let allTextures = null;
let environmentContainer = null;
let orbitContainer = null;
let smokeLayerContainer = null;
let spacecraftLayerContainer = null;
let insetApp = null;
let insetSpacecraftContainer = null;
let emitter = {};

// ============================================================================
// Simulation Data - spacecraft, physics, and environmental state
// ============================================================================
let spacecraftInstance = null;
let currentShipPartsConfig = [];
let simulationState = {
    isLaunched: false,
    engineActive: false,
    timeElapsed: 0,
    lastTimestamp: 0,
    cameraX_m: 0,
    cameraY_m: 0,
    currentPixelsPerMeter: 0.05,
    controlFlags: { rotateLeft: false, rotateRight: false },
    landed: true,
    soundMuted: false,
    currentDesignName: "DefaultOrbiter"
};
let currentDragForceMagnitude = 0;
let currentAirDensityValue = C.EARTH_SEA_LEVEL_AIR_DENSITY;
let apoapsisAGL = { value: 0 };
let periapsisAGL = { value: 0 };
let smokeParticles = [];
let oldSmokeParticles = [];
let cloudLayers = [];
let surfaceFeatures = [];
let flameParticleSystem = null;
let smokeParticleSystem = null;

// ============================================================================
// UI State - DOM elements and design templates
// ============================================================================
const dom = {};
const partCatalog = {
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
    "SmallProbe": [
        { type: 'engine', name: 'Small Engine', thrust_N: 50000, fuelConsumptionRate_kg_s: 20, dryMass_kg: 200, width_m: 1, height_m: 1, isp: 280 },
        { type: 'tank', name: 'Small Tank', fuelCapacity_kg: 1000, dryMass_kg: 100, width_m: 1, height_m: 2 },
        { type: 'fairing', name: '1.2m Fairing', dryMass_kg: 50, width_m: 1.2, height_m: 1.5 },
        { type: 'pod', name: 'Probe Core', dryMass_kg: 150, width_m: 0.8, height_m: 0.8, color: 'gold' }
    ],
    "HeavyLifter_Lower": [
        { type: 'engine', name: 'Heavy Engine', thrust_N: 1000000, fuelConsumptionRate_kg_s: 300, dryMass_kg: 5000, width_m: 4, height_m: 3, isp: 300 },
        { type: 'tank', name: 'Large Tank', fuelCapacity_kg: 50000, dryMass_kg: 5000, width_m: 4, height_m: 15 }
    ]
};

const PLANET_CONTAINER = "planetContainer";

async function initSimulation(launchSource = 'template') {
    const urlParams = new URLSearchParams(window.location.search);
    if (dom.statsPanel) { dom.statsPanel.style.display = (urlParams.get('stats') === 'true') ? 'block' : 'none'; }

    spacecraftInstance.resetToPostionOnSurface(0);
    viewport.fitHeight(C.EARTH_RADIUS_M, true);
    simulationState.isLaunched = false;
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

        let platformContainer = new PIXI.Container();
        platformContainer.width = 50;
        platformContainer.height = 50;
        platformContainer.pivot.set(25, 50);
        platformContainer.label = C.PLATFORM_CONTAINER;
        let platform = new PIXI.Graphics();
        platform.setStrokeStyle({ width: 4, color: 'white' })
        platform.poly([-10, 0, -25, 50, 25, 50, 10, 0])
            .fill("rgba(120,120,120,1)");

        platform.stroke();
        platformContainer.addChild(platform);
        //platformContainer.angle = 180; //(Math.PI/2);

        environmentContainer.getChildByLabel(C.PLANET_CONTAINER, true).addChild(platformContainer);
        platformContainer.position.set(0, -1.0 * C.EARTH_RADIUS_M);
        spacecraftInstance.viewportRef = viewport;
        spacecraftInstance.draw(
            //environmentContainer.getChildByLabel(C.PLANET_CONTAINER, true),
            platformContainer,
            25, 50, null, null,
            5,//simulationState.currentPixelsPerMeter,
            "main"
        );
        console.log("SPACECRAFT_GRAPHICS_CONTAINER", environmentContainer.getChildByLabel(C.SPACECRAFT_GRAPHICS_CONTAINER, true));

        let spacecraftContainer = environmentContainer.getChildByLabel(C.SPACECRAFT_GRAPHICS_CONTAINER, true);
        //let engine1 = await PIXI.Assets.load('engines-01.png');
        spacecraftContainer.addChild(new PIXI.Sprite({
            texture: PIXI.Texture.from('engines-01.png'),
            label: "shipSprite",
            anchor: 0.5,
            //angle:180,
            width: 20,
            height: 20//spacecraftInstance.logicalStackHeight_m,

        }));
        spacecraftInstance.position = spacecraftContainer?.getGlobalPosition();
        //viewport.moveCenter(spacecraftInstance.position.x, spacecraftInstance.position.y);
        //initParticles();

    }

    let spacecraftContainer = environmentContainer.getChildByLabel(C.SPACECRAFT_GRAPHICS_CONTAINER, true);
    //viewport.fit(); //viewport.follow(spacecraftContainer, {speed:0, acceleration:null, radius:null});

    if (insetApp && spacecraftInstance && simulationState.currentPixelsPerMeter < C.INSET_VIEW_PPM_THRESHOLD) {
        if (dom.insetCanvas) dom.insetCanvas.style.display = 'block'; // Check if dom.insetCanvas exists
        insetSpacecraftContainer.removeChildren();
        // environmentContainer.getChildByLabel(C.SPACECRAFT_GRAPHICS_CONTAINER, true)?.scale.set(1000);
        const largerCraftDim_m = Math.max(spacecraftInstance.logicalStackHeight_m, spacecraftInstance.maxWidth_m, 1);
        const insetPPM = C.INSET_VIEW_TARGET_SIZE_PX / largerCraftDim_m;
        const insetSfcScreenX = insetApp.stage.width / 2;
        const insetSfcScreenY = insetApp.stage.height / 2;

        spacecraftInstance.draw(
            insetSpacecraftContainer,
            insetApp.screen.width,
            insetApp.screen.height,
            insetSfcScreenX,
            insetSfcScreenY,
            insetPPM,
            "inset" // isInsetView = true
        );
    } else {
        if (dom.insetCanvas) dom.insetCanvas.style.display = 'none'; // Check if dom.insetCanvas exists
    }
    if (dom.hudCanvas) {
        const hudCtx = dom.hudCanvas.getContext('2d');
        pixiApp.ticker.add(() => {
            pixiApp.renderer.render(pixiApp.stage);


            // Draw HUD on the overlay canvas

            if (hudCtx) {
                hudCtx.clearRect(0, 0, dom.hudCanvas.width, dom.hudCanvas.height);
                UI.drawHUD(hudCtx, spacecraftInstance, simulationState);
            }
        }
        )
    }

    // Setup particle systems after containers are ready
    const flameTexture = PIXI.Texture.from('parts/flame1.png');
    const smokeTexture = PIXI.Texture.from('parts/smoke.png');
    if (flameParticleSystem) flameParticleSystem.destroy();
    if (smokeParticleSystem) smokeParticleSystem.destroy();
    flameParticleSystem = createFlameParticleSystem(spacecraftContainer, flameTexture);
    smokeParticleSystem = createSmokeParticleSystem(spacecraftContainer, smokeTexture);
}

function initParticles() {
    var emitter = new PIXI.ParticleContainer();
    emitter.x = 0;
    emitter.y = -10;
    emitter.maxSize = 1;
    emitter.scale = 0.025;
    emitter.scaleRange = 0.86;
    emitter.minSize = 0.025;
    emitter.maxSpeed = -270;
    emitter.minSpeed = 0;
    emitter.alpha = 1;
    emitter.alphaRange = 0;
    emitter.color = 0xff0000;
    emitter.colorRange = 0xffffff;
    emitter.rotation = 0;
    emitter.rotationRange = 0;
    emitter.lifetime = 1200;
    emitter.lifetimeRange = 13000;
   // emitter.blendMode = PIXI.BLEND_MODES.NORMAL;
    emitter.frequency = 0.5;
    emitter.emitterLifetime = -1;
    emitter.autoUpdate = true;
   emitter.emit = true;

}
var follow = !1;
function updateCamera() {
    if (!spacecraftInstance) return;

    let spacecraftContainer = environmentContainer.getChildByLabel(C.SPACECRAFT_GRAPHICS_CONTAINER, true);
    let planetContainer = environmentContainer.getChildByLabel(C.PLANET_CONTAINER, true);
    let pos = viewport.toWorld(spacecraftContainer?.getGlobalPosition({ skipUpdate: true }));

    const comX = C.EARTH_RADIUS_M * Math.sin(planetContainer._rotation);
    const comY = -1 * C.EARTH_RADIUS_M * Math.cos(planetContainer._rotation);
    spacecraftInstance.localPosition = viewport.toScreen(comX, comY);
}

function resetViewport() {
    let spacecraftContainer = environmentContainer.getChildByLabel(C.PLATFORM_CONTAINER, true);
    let pos =
        viewport.toWorld(
            spacecraftContainer.getGlobalPosition({})
        )
        ;
    console.info(`moving viewport to ${pos.x}, ${pos.y}`);
    viewport.animate({
        position: pos,

        duration: 1500,
        width: 1500
    });
}
async function gameLoop(ticker) {
    var deltaTime_s = ticker.elapsedMS / 1000.0;
    simulationState.timeElapsed = ticker.elapsedMS
    simulationState.lastTimestamp = ticker.lastTime;
    let spacecraftContainer = environmentContainer.getChildByLabel(C.SPACECRAFT_GRAPHICS_CONTAINER, true);

    drawMoon(environmentContainer, deltaTime_s);
    updateLighting(deltaTime_s);

    if (spacecraftInstance && simulationState.isLaunched) {
        const physicsResult = spacecraftInstance.updatePhysics(
            deltaTime_s,
            simulationState.engineActive,
            simulationState.controlFlags.rotateLeft,
            simulationState.controlFlags.rotateRight,
            currentAirDensityValue, // Passed but now calculated internally based on altitude
            apoapsisAGL, periapsisAGL,
            smokeParticles, simulationState
        );
        // Update air density from physics result (now calculated based on altitude)
        if (physicsResult && physicsResult.currentAirDensity !== undefined) {
            currentAirDensityValue = physicsResult.currentAirDensity;
        }
    }
    updateCamera();

    while (oldSmokeParticles.length > C.MAX_OLD_SMOKE_PARTICLES) {
        const removedParticle = oldSmokeParticles.shift();
    }

    await ENV.drawPlanet(environmentContainer, deltaTime_s);
    UI.updateStatsDisplay(simulationState, spacecraftInstance, apoapsisAGL.value, periapsisAGL.value);

    // Inset view drawing - show when spacecraft is too small to see in main view
    if (insetApp && spacecraftInstance) {
        // Check if viewport scale is low enough that spacecraft would be too small to see
        // Use viewport scale directly for more accurate check
        const viewportScale = viewport.scale.x;
        const shouldShowInset = viewportScale < C.INSET_VIEW_PPM_THRESHOLD;
        
        if (shouldShowInset) {
            if (dom.insetCanvas) dom.insetCanvas.style.display = 'block';
            
            // Clear previous frame
            insetSpacecraftContainer.removeChildren();
            
            // Calculate appropriate scale for inset view
            const largerCraftDim_m = Math.max(spacecraftInstance.logicalStackHeight_m, spacecraftInstance.maxWidth_m, 1);
            const insetPPM = C.INSET_VIEW_TARGET_SIZE_PX / largerCraftDim_m;
            const insetSfcScreenX = insetApp.screen.width / 2;
            const insetSfcScreenY = insetApp.screen.height / 2;
            
            // Draw spacecraft in inset view with current orientation and state
            spacecraftInstance.draw(
                insetSpacecraftContainer,
                insetApp.screen.width,
                insetApp.screen.height,
                insetSfcScreenX,
                insetSfcScreenY,
                insetPPM,
                "inset"
            );
            
            // Update inset view graphics (flames, etc.) if engine is active
            const insetShipContainer = insetSpacecraftContainer.getChildByLabel(C.SPACECRAFT_GRAPHICS_CONTAINER, true);
            if (insetShipContainer) {
                let flameGraphic = insetShipContainer.getChildByLabel('InsetFlameG');
                
                if (simulationState.engineActive && spacecraftInstance.currentThrust_N > 0) {
                    // Create or update flame graphics for inset view
                    if (!flameGraphic) {
                        flameGraphic = new PIXI.Graphics({label: "InsetFlameG"});
                        insetShipContainer.addChild(flameGraphic);
                        
                        // Position flame at engine nozzle (bottom of spacecraft)
                        const enginePart = spacecraftInstance.parts.find(p => p.type === 'engine');
                        if (enginePart) {
                            const engineNozzle_y_from_com_m = enginePart.relative_y_m - spacecraftInstance.getCoMOffset_m();
                            const engineNozzle_y_local_px = -engineNozzle_y_from_com_m * insetPPM;
                            flameGraphic.position.set(0, engineNozzle_y_local_px);
                        }
                    }
                    
                    // Draw flame
                    const flameHeight_px = 15 * insetPPM;
                    const flameWidth_px = 2 * insetPPM;
                    
                    flameGraphic.clear();
                    flameGraphic.rotation = spacecraftInstance.engineGimbalAngle_rad;
                    
                    // Orange outer flame
                    flameGraphic.moveTo(-flameWidth_px / 2, 0);
                    flameGraphic.lineTo(flameWidth_px / 2, 0);
                    flameGraphic.lineTo(0, flameHeight_px);
                    flameGraphic.closePath();
                    flameGraphic.fill({color: 0xff6600, alpha: 0.9});
                    
                    // Yellow inner flame
                    const iFW = flameWidth_px * 0.5;
                    const iFH = flameHeight_px * 0.6;
                    flameGraphic.moveTo(-iFW / 2, 0);
                    flameGraphic.lineTo(iFW / 2, 0);
                    flameGraphic.lineTo(0, iFH);
                    flameGraphic.closePath();
                    flameGraphic.fill({color: 0xffff00, alpha: 0.9});
                } else if (flameGraphic) {
                    // Remove flame when engine is off
                    flameGraphic.destroy();
                }
            }
            
            // Render the inset view
            insetApp.renderer.render(insetApp.stage);
        } else {
            if (dom.insetCanvas) dom.insetCanvas.style.display = 'none';
        }
    }

    //UI.drawHUD(gameCanvas, spacecraftInstance, simulationState);
   
    // --- Particle Effects ---
    if (spacecraftInstance && simulationState.engineActive) {
        spacecraftInstance.updateGraphics(spacecraftContainer, Math.floor(ticker.lastTime % 3));
        // Emit flame and smoke at the engine nozzle position
        // For now, emit at (0,0) in the spacecraftContainer (adjust as needed)
        //flameParticleSystem.start();
        smokeParticleSystem.start();
       // flameParticleSystem.emit(0, 0, spacecraftInstance.angle_rad + spacecraftInstance.engineGimbalAngle_rad);
        //smokeParticleSystem.emit(0, 10, spacecraftInstance.angle_rad + spacecraftInstance.engineGimbalAngle_rad + Math.PI); // Offset for smoke
    } else {
        //if (flameParticleSystem) flameParticleSystem.stop();
        if (smokeParticleSystem) smokeParticleSystem.stop();
    }
   // if (flameParticleSystem) flameParticleSystem.update(deltaTime_s);
    if (smokeParticleSystem) smokeParticleSystem.update(deltaTime_s);
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
                emitter.emit = true;
                dom.launchButton.textContent = simulationState.engineActive ? "Engine Active (TPL)" : (spacecraftInstance.currentFuel_kg > 0 ? "Engine Off (TPL)" : "Out of Fuel (TPL)");
                dom.launchButton.disabled = spacecraftInstance.currentFuel_kg <= 0 && !simulationState.engineActive;
                pixiApp.ticker.start();
            }
        });
    }

    if (dom.launchCurrentBuildButton) {
        dom.launchCurrentBuildButton.addEventListener('click', async () => {
            if (currentShipPartsConfig.length === 0) { alert("Staging area is empty!"); return; }
            if (spacecraftInstance) {
                var planetContainer = environmentContainer?.getChildByLabel(C.PLANET_CONTAINER);

                if (!follow) {
                    let platformContainer = environmentContainer.getChildByLabel(C.SPACECRAFT_GRAPHICS_CONTAINER, true);
                    follow = viewport.follow(platformContainer, { speed: 0, acceleration: null, radius: null });
                }
                if (planetContainer && planetContainer?.getChildByLabel(C.SPACECRAFT_GRAPHICS_CONTAINER, true))
                    environmentContainer.reparentChild(planetContainer?.getChildByLabel(C.SPACECRAFT_GRAPHICS_CONTAINER, true));
                resetViewport();
                simulationState.isLaunched = true; simulationState.landed = false;
                simulationState.engineActive = true;
                spacecraftInstance.refuel();
                if (dom.launchButton) dom.launchButton.disabled = true;
                pixiApp.ticker.start(); // Start the PIXI ticker if not already runningapp
            }
        });
    }
    let recenterButton = document.getElementById("recenter");
    if (recenterButton)
        recenterButton.addEventListener('click', async () => {
            if (!follow) {
                let platformContainer = viewport.getChildByLabel(C.SPACECRAFT_GRAPHICS_CONTAINER, true);
                follow = viewport.follow(platformContainer, { speed: 0, acceleration: null, radius: null });
            }
            else {
                viewport.plugins.remove('follow');
                follow = null;
            }
        });
    if (dom.resetButton) {
        dom.resetButton.addEventListener('click', async () => {
            resetViewport();
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
            simulationState.currentPixelsPerMeter = 1e-7;
    });

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
 
    // Check if essential canvas elements exist
    if (!dom.gameCanvas || !dom.stagingCanvas) {
     //   console.error("Essential canvas elements (gameCanvas or stagingCanvas) not found in the DOM after React render. Game cannot initialize.");
        setTimeout(completeInitialization, 1);
        return;
    }

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
    dom.spacecraftPosition_x_local = document.getElementById('spacecraftPosition_x_local');
    dom.spacecraftPosition_y_local = document.getElementById('spacecraftPosition_y_local');
    dom.viewportPosition_x = document.getElementById('viewportPosition_x');
    dom.viewportPosition_y = document.getElementById('viewportPosition_y');
    // dom.launchButton = document.getElementById('launchButton'); // Example if it was kept

  
    // allTextures = await PIXI.Assets.load(['clouds-0.json', 'clouds-0.png']); // Already loaded globally if needed or move here.

    pixiApp = new PIXI.Application();
    await pixiApp.init({
        backgroundColor: 0x000000,
        resolution: window.devicePixelRatio || 1,
        resizeTo: document.getElementById('mainContainer'),
        canvas: dom.gameCanvas, // Use the canvas from the React-rendered DOM
        autoStart: false
    });
    pixiApp.ticker.stop(); // Stop the ticker until we explicitly start it in gameLoop

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
    } else {
        console.warn("Inset canvas not found for Pixi initialization. Inset view will be disabled.");
    }
    viewport = new Viewport({
        passiveWheel: false,
        events: pixiApp.renderer.events,
        screenWidth: gameCanvas.width,
        screenHeight: gameCanvas.height,
        center: new PIXI.Point(0, 0),
        zoom: 1,
        minZoom: 0.1,
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
    await PIXI.Assets.init({ manifest: "manifest.json", basePath: 'assets/' });
    parts = await PIXI.Assets.loadBundle(['parts']);
    //pixiApp.renderer.view.style.width = window.innerWidth + "px";
    // pixiApp.renderer.view.style.height = window.innerHeight + "px";
    // pixiApp.renderer.view.style.left = "0px";
    // pixiApp.renderer.view.style.top = "0px";
    environmentContainer = new PIXI.Container();
    environmentContainer.label = "environmentContainer";
    orbitContainer = new PIXI.Container();
    smokeLayerContainer = new PIXI.Container();
    spacecraftLayerContainer = new PIXI.Container();
    spacecraftLayerContainer.label = "spacecraftLayerContainer";
    //  const planetRadius_px = planet.radius_m;

    var planetContainer = new PIXI.Container();
    planetContainer.label = "planetContainer";
    //viewport.addChild(planetContainer);
   environmentContainer.addChild(planetContainer);
   // planetContainer.addChild(viewport);
    // Add containers to viewport
    // viewport.addChild(environmentContainer);
    // viewport.addChild(orbitContainer);
    //  viewport.addChild(smokeLayerContainer);

  //  viewport.addChild(environmentContainer);
    // Create a text object
    const text = new PIXI.Text({
        text: 'Hello, PixiJS!',
        fontFamily: 'Arial', // Font family
        fontSize: 36, // Font size
        fill: 0xffffff, // Text color
        align: 'center', // Text alignment
        color: 'white'
    });
    // Create HUD canvas overlay
    if (!dom.hudCanvas) {
        dom.hudCanvas = document.createElement('canvas');
        dom.hudCanvas.id = 'hudCanvas';
        dom.hudCanvas.style.position = 'absolute';
        dom.hudCanvas.style.top = '0';
        dom.hudCanvas.style.left = '0';
        dom.hudCanvas.style.pointerEvents = 'none';
        dom.hudCanvas.style.zIndex = '10';

        // Set canvas size to match game canvas
        if (dom.gameCanvas) {
            dom.hudCanvas.width = dom.gameCanvas.width;
            dom.hudCanvas.height = dom.gameCanvas.height;
        }

        // Insert HUD canvas after game canvas
        if (dom.gameCanvas && dom.gameCanvas.parentNode) {
            dom.gameCanvas.parentNode.insertBefore(dom.hudCanvas, dom.gameCanvas.nextSibling);
        }
    }

    // Update HUD canvas size if game canvas size changed
    if (dom.hudCanvas && dom.gameCanvas) {
        if (dom.hudCanvas.width !== dom.gameCanvas.width || dom.hudCanvas.height !== dom.gameCanvas.height) {
            dom.hudCanvas.width = dom.gameCanvas.width;
            dom.hudCanvas.height = dom.gameCanvas.height;
        }
    }
    // Set the position of the text
    text.x = pixiApp.screen.width / 2 - text.width / 2; // Center horizontally
    text.y = pixiApp.screen.height / 2 - text.height / 2; // Center vertically

    // Add the text to the stage
    //pixiApp.stage.addChild(text);
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

   viewport.addChild(environmentContainer);
   pixiApp.stage.addChild(viewport);
    setupEventListeners();

    pixiApp.ticker.add(gameLoop); // Start the game loop
    // Add a PIXI ticker listener for smoke trail drawing
    // Initialize Inset View Pixi Application


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

    document.addEventListener('DOMContentLoaded', completeInitialization);
} else {
    console.error("Failed to find the root element for React. App cannot start.");
}
