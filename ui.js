import { Spacecraft } from './spacecraft.js';
import { CommandPod, FuelTank, Engine, Fairing } from './parts.js'; // Ensure these are imported if used for type checking or default configs
import { SPACECRAFT_INDICATOR_PPM_THRESHOLD, INSET_VIEW_PPM_THRESHOLD, INSET_VIEW_TARGET_SIZE_PX, ISP_VACUUM_DEFAULT } from './constants.js';

let domElements = {}; 
let currentShipPartsConfigRef = []; 
let spacecraftDesignsRef = {}; 
let initSimulationFuncRef = () => {}; 
let stagingCtxRef, stagingCanvasRef;
let simulationStateRef; 
let partCatalogRef = {}; // Will hold constructors: { 'pod': CommandPod, ... }
let audioModuleRef = null; // Will hold the imported audio module

export function initializeUI(domRefs, shipPartsConfig, designsRef, initSimFunc, stagingContext, stagingCanvasElement, simState, catalog, audioMod) {
    domElements = domRefs;
    currentShipPartsConfigRef = shipPartsConfig;
    spacecraftDesignsRef = designsRef;
    initSimulationFuncRef = initSimFunc;
    stagingCtxRef = stagingContext;
    stagingCanvasRef = stagingCanvasElement;
    simulationStateRef = simState;
    partCatalogRef = catalog;
    audioModuleRef = audioMod; // Store audio module

    populateDesignSelector();
    populatePartPalette(); 
    setupBuilderActionButtons();
}

function populateDesignSelector() { 
    if (!domElements.designSelect) return;
    domElements.designSelect.innerHTML = ''; 
    for (const designName in spacecraftDesignsRef) { 
        const option = document.createElement('option'); 
        option.value = designName; 
        option.textContent = designName.replace(/_/g, ' '); 
        domElements.designSelect.appendChild(option); 
    } 
    if(simulationStateRef) domElements.designSelect.value = simulationStateRef.currentDesignName; 
}

function populatePartPalette() {
    if (!domElements.partPaletteContainer) { 
        const paletteContainer = document.querySelector('#partPalette .part-category');
        if (!paletteContainer) {
            console.error("Part palette container not found!");
            return;
        }
        domElements.partPaletteContainer = paletteContainer;
    }
    domElements.partPaletteContainer.innerHTML = ''; 

    // Define parts for the palette with their thumbnail image names
    const paletteParts = [
        { type: 'pod', name: 'Std. Pod', thumbnail: 'pod1.png', defaultConfig: { type: 'pod', name:'Std. Pod', dryMass_kg: 500, width_m: 2, height_m: 1.5, color: 'silver' }},
        { type: 'tank', name: 'Med. Tank', thumbnail: 'tank1.png', defaultConfig: { type: 'tank', name:'Med. Tank', fuelCapacity_kg: 10000, dryMass_kg: 1500, width_m: 2.5, height_m: 8, color: '#aabbcc' }},
        { type: 'engine', name: 'Main Engine', thumbnail: 'engine1.png', defaultConfig: { type: 'engine', name:'Main Engine', thrust_N: 250000, fuelConsumptionRate_kg_s: 80, dryMass_kg: 1000, width_m: 2.5, height_m: 2, color: '#505050', isp: 310 }},
        { type: 'fairing', name: 'Payload Fairing', thumbnail: 'fairing1.png', defaultConfig: { type: 'fairing', name:'Payload Fairing', dryMass_kg: 100, width_m: 2.5, height_m: 3, color: '#f0f0f0' }}
    ];

    paletteParts.forEach(partInfo => {
        const button = document.createElement('button');
        button.classList.add('part-button');
        button.draggable = true;
        button.dataset.partType = partInfo.type;
        button.dataset.partName = partInfo.name;
        button.dataset.partConfig = JSON.stringify(partInfo.defaultConfig);

        const img = document.createElement('img');
        img.src = `images/${partInfo.thumbnail}`;
        img.alt = partInfo.name;
        img.style.width = '40px'; // Adjust as needed
        img.style.height = 'auto';
        img.style.marginRight = '10px';
        img.style.verticalAlign = 'middle';
        img.ondragstart = (e) => e.preventDefault(); // Prevent dragging the image itself, allow button drag

        button.appendChild(img);
        button.appendChild(document.createTextNode(partInfo.name));
        domElements.partPaletteContainer.appendChild(button);
    });
    // Re-initialize drag and drop for newly created buttons
    if (stagingCanvasRef && domElements.dragImage && currentShipPartsConfigRef && simulationStateRef && audioModuleRef) {
         initializeDragAndDrop(stagingCanvasRef, domElements.dragImage, currentShipPartsConfigRef, simulationStateRef, audioModuleRef);
    }
}


export function updateStatsDisplay(simState, sfc, apo, peri) { 
    if(!domElements.time || !sfc) return; 
    domElements.time.textContent = simState.timeElapsed.toFixed(1); 
    if(domElements.apoapsis) domElements.apoapsis.textContent = apo >= 1e7 ? (apo/1e3).toFixed(0) + " km" : (apo === Infinity ? "Escape" : apo.toFixed(0) + " m"); 
    if(domElements.periapsis) domElements.periapsis.textContent = peri >= 1e7 ? (peri/1e3).toFixed(0) + " km" : peri.toFixed(0) + " m"; 
    if(domElements.angle) domElements.angle.textContent = ((sfc.angle_rad * 180 / Math.PI)%360).toFixed(2); 
    if(domElements.gimbal) domElements.gimbal.textContent = (sfc.engineGimbalAngle_rad * 180 / Math.PI).toFixed(2); 
    if(domElements.mass) domElements.mass.textContent = sfc.totalMass_kg.toFixed(2); 
    if(domElements.thrust) domElements.thrust.textContent = sfc.currentThrust_N.toFixed(0); 
    if(domElements.zoomLevel) domElements.zoomLevel.textContent = simState.currentPixelsPerMeter.toExponential(1); 
    const fuelPercent = sfc.initialFuel_kg > 0 ? (sfc.currentFuel_kg / sfc.initialFuel_kg) * 100 : 0; 
    if(domElements.fuelGaugeBar) domElements.fuelGaugeBar.style.width = `${fuelPercent}%`; 
    if(domElements.fuelText) domElements.fuelText.textContent = `Fuel: ${fuelPercent.toFixed(0)}%`; 
    if (domElements.fuelGaugeBar) {
        if (fuelPercent < 25) domElements.fuelGaugeBar.style.backgroundColor = 'red'; 
        else if (fuelPercent < 50) domElements.fuelGaugeBar.style.backgroundColor = 'orange'; 
        else domElements.fuelGaugeBar.style.backgroundColor = 'lightgreen';
    }
}

export function drawHUD(mainCtx, sfc, simState) { 
    if (!sfc || !simState.isLaunched || !mainCtx) return; 
    mainCtx.save(); 
    mainCtx.font = "bold 16px Arial"; 
    mainCtx.fillStyle = "rgba(220, 220, 255, 0.9)"; 
    mainCtx.textAlign = "left";
    const altText = `Alt: ${sfc.altitudeAGL_m.toFixed(0)} m`; 
    mainCtx.fillText(altText, 10, mainCtx.canvas.height - 30);
    const speed_ms = Math.sqrt(sfc.velocity_x_ms**2 + sfc.velocity_y_ms**2);
    const speedText = `Spd: ${speed_ms.toFixed(1)} m/s`; 
    mainCtx.fillText(speedText, 10, mainCtx.canvas.height - 10);
    if (speed_ms > 1) { 
        const angleOfVelocity = Math.atan2(sfc.velocity_x_ms, sfc.velocity_y_ms); 
        const hudCenterX = mainCtx.canvas.width / 2; 
        const hudCenterY = mainCtx.canvas.height / 2;
        const progradeRadius = Math.min(mainCtx.canvas.width, mainCtx.canvas.height) * 0.1; 
        mainCtx.strokeStyle = "rgba(100, 255, 100, 0.9)"; 
        mainCtx.lineWidth = 2; 
        mainCtx.beginPath();
        const markerStartX = hudCenterX + Math.sin(angleOfVelocity) * (progradeRadius - 8);
        const markerStartY = hudCenterY - Math.cos(angleOfVelocity) * (progradeRadius - 8);
        const markerEndX = hudCenterX + Math.sin(angleOfVelocity) * (progradeRadius + 8);
        const markerEndY = hudCenterY - Math.cos(angleOfVelocity) * (progradeRadius + 8);
        mainCtx.moveTo(markerStartX, markerStartY); 
        mainCtx.lineTo(markerEndX, markerEndY);
        const arrowSize = 6;
        mainCtx.lineTo(markerEndX - Math.sin(angleOfVelocity + Math.PI/4) * arrowSize, markerEndY + Math.cos(angleOfVelocity + Math.PI/4) * arrowSize);
        mainCtx.moveTo(markerEndX, markerEndY);
        mainCtx.lineTo(markerEndX - Math.sin(angleOfVelocity - Math.PI/4) * arrowSize, markerEndY + Math.cos(angleOfVelocity - Math.PI/4) * arrowSize);
        mainCtx.stroke();
    }
    mainCtx.restore();
}

export function drawStagingAreaRocket() { 
    if (!stagingCtxRef || !stagingCanvasRef) return;
    stagingCtxRef.clearRect(0, 0, stagingCanvasRef.width, stagingCanvasRef.height); 
    stagingCtxRef.fillStyle = '#383838'; 
    stagingCtxRef.fillRect(0,0, stagingCanvasRef.width, stagingCanvasRef.height);
    if (currentShipPartsConfigRef.length === 0) return; 
    
    const tempCraft = new Spacecraft(currentShipPartsConfigRef); 
    
    const rocketHeight_m = tempCraft.logicalStackHeight_m; 
    const rocketWidth_m = tempCraft.maxWidth_m;
    const maxDim_m = Math.max(rocketHeight_m, rocketWidth_m, 1); 

    const stagingPPM = Math.min( (stagingCanvasRef.height * 0.95) / rocketHeight_m, (stagingCanvasRef.width * 0.9) / rocketWidth_m );
    
    const stagingSfcScreenX = stagingCanvasRef.width / 2;
    const comOffset_m = tempCraft.getCoMOffset_m(); 
    const craftCenterY_px = stagingCanvasRef.height / 2; 
    const bottomOffsetY_px = (tempCraft.logicalStackHeight_m - comOffset_m) * stagingPPM;
    const stagingSfcScreenY = craftCenterY_px + bottomOffsetY_px - (stagingCanvasRef.height * 0.05) ; 
    
    const originalAngle = tempCraft.angle_rad; 
    tempCraft.angle_rad = 0; 
    // Pass stagingCtx, canvas dimensions, calculated screen pos, stagingPPM, and true for isInsetView (to use simpler flame, and true for showNodes)
    tempCraft.draw(stagingCtxRef, stagingCanvasRef.width, stagingCanvasRef.height, stagingSfcScreenX, stagingSfcScreenY, stagingPPM, true, true); // showNodes = true for staging
    tempCraft.angle_rad = originalAngle; 
}

export function updateStagingStats() { 
    if (!domElements.stagingMass || !currentShipPartsConfigRef) return; 
    if (currentShipPartsConfigRef.length === 0) { 
        domElements.stagingMass.textContent = "0.00"; 
        domElements.stagingThrust.textContent = "0.00"; 
        domElements.stagingDeltaV.textContent = "0.00"; 
        return; 
    }
    let totalDryMass = 0; let totalFuelMass = 0; 
    let totalThrust = 0; let minISP = Infinity; 
    currentShipPartsConfigRef.forEach(partConfig => { 
        totalDryMass += partConfig.dryMass_kg || 0; 
        if (partConfig.type === 'tank') { totalFuelMass += partConfig.fuelCapacity_kg || 0; } 
        if (partConfig.type === 'engine') { 
            totalThrust += partConfig.thrust_N || 0; 
            minISP = Math.min(minISP, partConfig.isp || ISP_VACUUM_DEFAULT); 
        } 
    });
    const wetMass = totalDryMass + totalFuelMass; 
    domElements.stagingMass.textContent = `${wetMass.toFixed(2)} (Dry: ${totalDryMass.toFixed(2)})`; 
    domElements.stagingThrust.textContent = totalThrust.toFixed(0); 
    const g0 = 9.80665; 
    let deltaV = 0; 
    if (wetMass > totalDryMass && totalDryMass > 0) { 
        deltaV = (minISP === Infinity ? ISP_VACUUM_DEFAULT : minISP) * g0 * Math.log(wetMass / totalDryMass); 
    } 
    domElements.stagingDeltaV.textContent = deltaV.toFixed(0);
}

let draggedPartConfig = null; 
let touchDraggedPartElement = null; 

export function initializeDragAndDrop(stagingCanvasElement, dragImageElementRef, currentPartsRef, simState, audioMod) {
    const dragImageElement = dragImageElementRef;
    simulationStateRef = simState; 
    audioModuleRef = audioMod;

    document.querySelectorAll('.part-button').forEach(button => {
        const imgElement = button.querySelector('img'); // Get the img for drag image

        button.addEventListener('dragstart', (event) => {
            try {
                const partConfigString = event.target.closest('.part-button').dataset.partConfig; // Get from button itself
                if (!partConfigString) { console.error("No part config found on button:", event.target); return; }
                draggedPartConfig = JSON.parse(partConfigString);
                
                event.dataTransfer.setData('application/json', partConfigString); 
                event.dataTransfer.effectAllowed = 'copy';

                if (imgElement) { // Use the part's image from the palette
                    event.dataTransfer.setDragImage(imgElement, imgElement.width / 2, imgElement.height / 2);
                } else if (dragImageElement) { // Fallback to text
                    dragImageElement.textContent = `[ ${draggedPartConfig.name} ]`;
                    dragImageElement.style.display = 'block'; 
                    event.dataTransfer.setDragImage(dragImageElement, 10, 10); 
                }
            } catch (e) { console.error("Error in dragstart:", e); }
        });
        if(dragImageElement) button.addEventListener('dragend', () => { dragImageElement.style.display = 'none'; });

        button.addEventListener('touchstart', (event) => {
            event.preventDefault(); 
            if(!audioModuleRef.soundInitialized && simulationStateRef) audioModuleRef.initAudio(simulationStateRef.soundMuted);
            
            try {
                const partConfigString = event.target.closest('.part-button').dataset.partConfig;
                if (!partConfigString) return;
                draggedPartConfig = JSON.parse(partConfigString);
            } catch (e) { console.error("Error parsing part config on touchstart:", e); return; }
            
            if (dragImageElement) { // For touch, we still use the simple text label for now
                touchDraggedPartElement = dragImageElement.cloneNode(true); 
                touchDraggedPartElement.textContent = `[ ${draggedPartConfig.name} ]`;
                touchDraggedPartElement.style.position = 'fixed'; 
                touchDraggedPartElement.style.zIndex = '1001';
                touchDraggedPartElement.style.display = 'block';
                document.body.appendChild(touchDraggedPartElement);
                const touch = event.targetTouches[0];
                moveTouchDraggedElement(touch.clientX, touch.clientY);
            }
        }, {passive: false});
    });

    function moveTouchDraggedElement(clientX, clientY) { if (touchDraggedPartElement) { touchDraggedPartElement.style.left = `${clientX - touchDraggedPartElement.offsetWidth / 2}px`; touchDraggedPartElement.style.top = `${clientY - touchDraggedPartElement.offsetHeight / 2}px`; } }
    
    document.body.addEventListener('touchmove', (event) => { if (touchDraggedPartElement) { const touch = event.targetTouches[0]; moveTouchDraggedElement(touch.clientX, touch.clientY); const stagingRect = stagingCanvasElement.getBoundingClientRect(); if (touch.clientX >= stagingRect.left && touch.clientX <= stagingRect.right && touch.clientY >= stagingRect.top && touch.clientY <= stagingRect.bottom) { stagingCanvasElement.classList.add('drag-over'); } else { stagingCanvasElement.classList.remove('drag-over'); } } }, {passive: false});

    function handleDropOnStaging(droppedConfig) {
        if (!droppedConfig || !droppedConfig.type) return;
        
        // *** Basic Node Snapping Logic ***
        const newPartInstance = new partCatalogRef[droppedConfig.type](droppedConfig);
        if (!newPartInstance) { console.error("Could not create instance for dropped part", droppedConfig); return; }

        if (currentPartsRef.length === 0) { // First part
            currentPartsRef.push(droppedConfig);
        } else {
            const topPartConfig = currentPartsRef[currentPartsRef.length - 1];
            const topPartInstance = new partCatalogRef[topPartConfig.type](topPartConfig);

            const topNode = topPartInstance.attachmentNodes.find(node => node.type === 'stack_top' || node.type === 'fuel_output'); // Prefer stack_top
            const bottomNodeOfNew = newPartInstance.attachmentNodes.find(node => node.type === 'stack_bottom' || node.type === 'engine_top' || node.type === 'fuel_input');

            if (topNode && bottomNodeOfNew && topNode.acceptedTypes.includes(bottomNodeOfNew.type)) {
                // Simple stack connection:
                console.log(`Connecting ${newPartInstance.name} (node ${bottomNodeOfNew.id}) to ${topPartInstance.name} (node ${topNode.id})`);
                currentPartsRef.push(droppedConfig);
            } else {
                console.warn("No compatible node found for stacking. Part not added.");
                // Future: Try radial attachment or provide feedback
                return; // Don't add if no simple stack connection found
            }
        }
        drawStagingAreaRocket(); 
        updateStagingStats(); 
    }

    stagingCanvasElement.addEventListener('drop', (event) => { 
        event.preventDefault(); stagingCanvasElement.classList.remove('drag-over'); 
        let droppedData; 
        try { droppedData = JSON.parse(event.dataTransfer.getData('application/json')); } 
        catch (e) { console.warn("Could not parse dropped JSON data", e); droppedData = null; } 
        
        const partConfigToDrop = draggedPartConfig || droppedData; 
        if (partConfigToDrop) {
            handleDropOnStaging(partConfigToDrop);
        }
        draggedPartConfig = null;  
    });
     document.body.addEventListener('touchend', (event) => {
        if (touchDraggedPartElement) {
            const touch = event.changedTouches[0];
            const stagingRect = stagingCanvasElement.getBoundingClientRect();
            if (touch.clientX >= stagingRect.left && touch.clientX <= stagingRect.right &&
                touch.clientY >= stagingRect.top && touch.clientY <= stagingRect.bottom) {
                if (draggedPartConfig) {
                    handleDropOnStaging(draggedPartConfig);
                }
            }
            document.body.removeChild(touchDraggedPartElement);
            touchDraggedPartElement = null;
            draggedPartConfig = null;
            stagingCanvasElement.classList.remove('drag-over');
        }
    });
    stagingCanvasElement.addEventListener('dragover', (event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; stagingCanvasElement.classList.add('drag-over'); });
    stagingCanvasElement.addEventListener('dragenter', (event) => { event.preventDefault(); stagingCanvasElement.classList.add('drag-over'); });
    stagingCanvasElement.addEventListener('dragleave', () => { stagingCanvasElement.classList.remove('drag-over'); });
}

function setupBuilderActionButtons() {
    if (domElements.clearStagingButton) { domElements.clearStagingButton.addEventListener('click', () => { currentShipPartsConfigRef.length = 0; drawStagingAreaRocket(); updateStagingStats(); });}
    if (domElements.undoLastPartButton) { domElements.undoLastPartButton.addEventListener('click', () => { if (currentShipPartsConfigRef.length > 0) { currentShipPartsConfigRef.pop(); drawStagingAreaRocket(); updateStagingStats(); }});}
}