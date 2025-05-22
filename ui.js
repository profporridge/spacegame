import { Spacecraft } from './spacecraft.js'; // For temp craft in staging
import { SPACECRAFT_INDICATOR_PPM_THRESHOLD, INSET_VIEW_PPM_THRESHOLD, INSET_VIEW_TARGET_SIZE_PX, ISP_VACUUM_DEFAULT } from './constants.js';

let domElements = {}; // Will be initialized by main.js
let currentShipPartsConfigRef = []; // Reference to currentShipPartsConfig in main.js
let spacecraftDesignsRef = {}; // Reference to spacecraftDesigns in main.js
let initSimulationFuncRef = () => {}; // Reference to initSimulation in main.js

export function initializeUI(domRefs, shipPartsConfigRef, designsRef, initSimFunc) {
    domElements = domRefs;
    currentShipPartsConfigRef = shipPartsConfigRef;
    spacecraftDesignsRef = designsRef;
    initSimulationFuncRef = initSimFunc;

    populateDesignSelector();
    initializeDragAndDrop();
    setupStagingCanvasDrop();
    setupBuilderActionButtons();
}

function populateDesignSelector() { 
    if (!domElements.designSelect) return;
    domElements.designSelect.innerHTML = ''; // Clear existing options
    for (const designName in spacecraftDesignsRef) { 
        const option = document.createElement('option'); 
        option.value = designName; 
        option.textContent = designName.replace(/_/g, ' '); 
        domElements.designSelect.appendChild(option); 
    } 
    if(simulationStateRef) domElements.designSelect.value = simulationStateRef.currentDesignName; 
}

export function updateStatsDisplay(simState, sfc, apo, peri) { 
    if(!sfc || !domElements.time) return; 
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
    if (!sfc || !simState.isLaunched) return;
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

export function drawStagingAreaRocket(stagingCtx, stagingCanvas, partsConfig) { 
    if (!stagingCtx || !stagingCanvas) return;
    stagingCtx.clearRect(0, 0, stagingCanvas.width, stagingCanvas.height); 
    stagingCtx.fillStyle = '#383838'; 
    stagingCtx.fillRect(0,0, stagingCanvas.width, stagingCanvas.height);
    if (partsConfig.length === 0) return; 
    
    // Create a temporary spacecraft instance just for drawing in staging
    // This avoids modifying the main 'spacecraft' object if one is in flight
    const tempCraft = new Spacecraft(partsConfig); 
    
    const rocketHeight_m = tempCraft.logicalStackHeight_m; 
    const rocketWidth_m = tempCraft.maxWidth_m;
    const maxDim_m = Math.max(rocketHeight_m, rocketWidth_m, 1); 
    const stagingPPM = Math.min( (stagingCanvas.height * 0.95) / rocketHeight_m, (stagingCanvas.width * 0.9) / rocketWidth_m );
    const stagingSfcScreenX = stagingCanvas.width / 2;
    const comOffset_m = tempCraft.getCoMOffset_m(); 
    const craftCenterY_px = stagingCanvas.height / 2; 
    const bottomOffsetY_px = (tempCraft.logicalStackHeight_m - comOffset_m) * stagingPPM;
    const stagingSfcScreenY = craftCenterY_px + bottomOffsetY_px - (stagingCanvas.height * 0.05) ; 
    
    const originalAngle = tempCraft.angle_rad; 
    tempCraft.angle_rad = 0; // Draw upright in staging
    tempCraft.draw(stagingCtx, stagingCanvas.width, stagingCanvas.height, stagingSfcScreenX, stagingSfcScreenY, stagingPPM, true); // isInsetView = true for different flame scaling
    tempCraft.angle_rad = originalAngle; 
}

export function updateStagingStats(partsConfig) { 
    if (!domElements.stagingMass) return; // Ensure DOM elements are available
    if (partsConfig.length === 0) { 
        domElements.stagingMass.textContent = "0.00"; 
        domElements.stagingThrust.textContent = "0.00"; 
        domElements.stagingDeltaV.textContent = "0.00"; 
        return; 
    }
    let totalDryMass = 0; let totalFuelMass = 0; 
    let totalThrust = 0; let minISP = Infinity; 
    partsConfig.forEach(partConfig => { 
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

// For Drag and Drop
let draggedPartConfig = null; 
let touchDraggedPartElement = null; 
let touchStartOffset = {x:0, y:0};
let simulationStateRef = null; // Will be set by main.js

export function initializeDragAndDrop(stagingCanvasElement, dragImageElementRef, currentPartsRef, simStateRef) {
    const dragImageElement = dragImageElementRef;
    simulationStateRef = simStateRef; // Store reference for initAudio

    document.querySelectorAll('.part-button').forEach(button => {
        button.addEventListener('dragstart', (event) => {
            const partType = event.target.dataset.partType; 
            const partName = event.target.dataset.partName || partType.charAt(0).toUpperCase() + partType.slice(1);
            let defaultConfig;
            switch(partType) { 
                case 'pod': defaultConfig = { type: 'pod', name: partName, dryMass_kg: 500, width_m: 2, height_m: 1.5, color: 'silver' }; break;
                case 'tank': defaultConfig = { type: 'tank', name: partName, fuelCapacity_kg: 1000, dryMass_kg: 150, width_m: 1.8, height_m: 4, color: 'lightgreen' }; break;
                case 'engine': defaultConfig = { type: 'engine', name: partName, thrust_N: 30000, fuelConsumptionRate_kg_s: 10, dryMass_kg: 200, width_m: 2.2, height_m: 2, color: 'darkgray', isp: ISP_VACUUM_DEFAULT }; break;
                case 'fairing': defaultConfig = { type: 'fairing', name: partName, dryMass_kg: 100, width_m: 2.5, height_m: 3, color: '#f0f0f0' }; break;
                default: console.error("Unknown part type for drag:", partType); return;
            }
            draggedPartConfig = defaultConfig;
            event.dataTransfer.setData('application/json', JSON.stringify(defaultConfig)); 
            event.dataTransfer.effectAllowed = 'copy';
            if (dragImageElement) {
                dragImageElement.textContent = `[ ${partName} ]`;
                dragImageElement.style.display = 'block'; 
                event.dataTransfer.setDragImage(dragImageElement, 10, 10); 
            }
        });
        button.addEventListener('dragend', () => { if(dragImageElement) dragImageElement.style.display = 'none'; });

        button.addEventListener('touchstart', (event) => {
            event.preventDefault(); 
            if(!audio.soundInitialized && simulationStateRef) initAudio(simulationStateRef.soundMuted); // audio not defined error
            const partType = event.target.dataset.partType; const partName = event.target.dataset.partName || partType.charAt(0).toUpperCase() + partType.slice(1);
            let defaultConfig;
             switch(partType) { /* same switch as dragstart */ 
                case 'pod': defaultConfig = { type: 'pod', name: partName, dryMass_kg: 500, width_m: 2, height_m: 1.5, color: 'silver' }; break;
                case 'tank': defaultConfig = { type: 'tank', name: partName, fuelCapacity_kg: 1000, dryMass_kg: 150, width_m: 1.8, height_m: 4, color: 'lightgreen' }; break;
                case 'engine': defaultConfig = { type: 'engine', name: partName, thrust_N: 30000, fuelConsumptionRate_kg_s: 10, dryMass_kg: 200, width_m: 2.2, height_m: 2, color: 'darkgray', isp: ISP_VACUUM_DEFAULT }; break;
                case 'fairing': defaultConfig = { type: 'fairing', name: partName, dryMass_kg: 100, width_m: 2.5, height_m: 3, color: '#f0f0f0' }; break;
                default: return;
             }
            draggedPartConfig = defaultConfig; 
            
            if (dragImageElement) {
                touchDraggedPartElement = dragImageElement.cloneNode(true); 
                touchDraggedPartElement.textContent = `[ ${partName} ]`;
                touchDraggedPartElement.style.position = 'fixed'; 
                touchDraggedPartElement.style.zIndex = '1001';
                touchDraggedPartElement.style.display = 'block';
                document.body.appendChild(touchDraggedPartElement);
                const touch = event.targetTouches[0];
                moveTouchDraggedElement(touch.clientX, touch.clientY);
            }
        }, {passive: false});
    });

    function moveTouchDraggedElement(clientX, clientY) {
        if (touchDraggedPartElement) {
            touchDraggedPartElement.style.left = `${clientX - touchDraggedPartElement.offsetWidth / 2}px`;
            touchDraggedPartElement.style.top = `${clientY - touchDraggedPartElement.offsetHeight / 2}px`;
        }
    }
    
    document.body.addEventListener('touchmove', (event) => {
        if (touchDraggedPartElement) {
            // event.preventDefault(); // This might be too aggressive globally
            const touch = event.targetTouches[0];
            moveTouchDraggedElement(touch.clientX, touch.clientY);
            const stagingRect = stagingCanvasElement.getBoundingClientRect();
            if (touch.clientX >= stagingRect.left && touch.clientX <= stagingRect.right &&
                touch.clientY >= stagingRect.top && touch.clientY <= stagingRect.bottom) {
                stagingCanvasElement.classList.add('drag-over');
            } else {
                stagingCanvasElement.classList.remove('drag-over');
            }
        }
    }, {passive: false});

    document.body.addEventListener('touchend', (event) => {
        if (touchDraggedPartElement) {
            const touch = event.changedTouches[0];
            const stagingRect = stagingCanvasElement.getBoundingClientRect();
            if (touch.clientX >= stagingRect.left && touch.clientX <= stagingRect.right &&
                touch.clientY >= stagingRect.top && touch.clientY <= stagingRect.bottom) {
                if (draggedPartConfig) {
                    currentPartsRef.push(JSON.parse(JSON.stringify(draggedPartConfig)));
                    drawStagingAreaRocket(stagingCtx, stagingCanvasElement, currentPartsRef); // Pass stagingCtx and stagingCanvas
                    updateStagingStats(currentPartsRef);
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
    stagingCanvasElement.addEventListener('drop', (event) => { 
        event.preventDefault(); stagingCanvasElement.classList.remove('drag-over'); 
        let droppedData; 
        try { droppedData = JSON.parse(event.dataTransfer.getData('application/json')); } 
        catch (e) { console.warn("Could not parse dropped JSON data", e); } 
        
        if (draggedPartConfig && draggedPartConfig.type === (droppedData && droppedData.type)) { 
            currentPartsRef.push(JSON.parse(JSON.stringify(draggedPartConfig))); 
        } else if (droppedData && droppedData.type) { 
            currentPartsRef.push(droppedData); 
        } else { return; } 
        
        drawStagingAreaRocket(stagingCtx, stagingCanvasElement, currentPartsRef); 
        updateStagingStats(currentPartsRef); 
        draggedPartConfig = null;  
    });
}