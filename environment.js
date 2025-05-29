import { 
    planet, MIN_CLOUD_ALTITUDE_M, MAX_CLOUD_ALTITUDE_M, NUM_CLOUD_LAYERS, CLOUDS_PER_LAYER,
    CLOUD_PARALLAX_FACTOR_MIN, CLOUD_PARALLAX_FACTOR_MAX, CLOUD_BASE_SIZE_MIN, CLOUD_BASE_SIZE_MAX,
    NUM_SURFACE_FEATURES, MAX_MOUNTAIN_HEIGHT_M, MAX_TREE_HEIGHT_M, SURFACE_FEATURE_VISIBILITY_PPM,
    ORBIT_PATH_VISIBILITY_ALTITUDE_M, ORBIT_PATH_VISIBILITY_PPM, ORBIT_PATH_SEGMENTS,
    GRAVITATIONAL_CONSTANT_G, SKY_BLUE_COLOR, SPACE_BLACK_COLOR, EARTH_MAX_ATMOSPHERE_ALTITUDE
} from './constants.js';


export function generateClouds(cloudLayersArrayRef) { // Modifies the passed array
    cloudLayersArrayRef.length = 0; // Clear existing layers
    for (let layer = 0; layer < NUM_CLOUD_LAYERS; layer++) { 
        const layerClouds = []; 
        const parallax = CLOUD_PARALLAX_FACTOR_MIN + (CLOUD_PARALLAX_FACTOR_MAX - CLOUD_PARALLAX_FACTOR_MIN) * (layer / (NUM_CLOUD_LAYERS -1 || 1)); 
        const layerAltitudeMin = MIN_CLOUD_ALTITUDE_M + (MAX_CLOUD_ALTITUDE_M - MIN_CLOUD_ALTITUDE_M) * (layer / NUM_CLOUD_LAYERS); 
        const layerAltitudeMax = MIN_CLOUD_ALTITUDE_M + (MAX_CLOUD_ALTITUDE_M - MIN_CLOUD_ALTITUDE_M) * ((layer + 1) / NUM_CLOUD_LAYERS); 
        for (let i = 0; i < CLOUDS_PER_LAYER; i++) { 
            const angle = Math.random() * 2 * Math.PI; 
            const alt_m = layerAltitudeMin + Math.random() * (layerAltitudeMax - layerAltitudeMin); 
            const distFromCenter_m = planet.radius_m + alt_m; 
            const x_m = distFromCenter_m * Math.sin(angle); 
            const y_m = distFromCenter_m * Math.cos(angle); 
            const baseSize = CLOUD_BASE_SIZE_MIN + Math.random() * (CLOUD_BASE_SIZE_MAX - CLOUD_BASE_SIZE_MIN); 
            const numPuffs = 4 + Math.floor(Math.random() * 6); 
            const puffs = []; 
            for(let j=0; j<numPuffs; j++) { puffs.push({ dx_m: (Math.random() - 0.5) * baseSize * 0.6, dy_m: (Math.random() - 0.5) * baseSize * 0.3, r_m: baseSize * (0.2 + Math.random() * 0.3) }); } 
            layerClouds.push({ x_m, y_m, puffs, baseAlpha: 0.2 + Math.random() * 0.3 }); 
        } 
        cloudLayersArrayRef.push({clouds: layerClouds, parallaxFactor: parallax}); 
    } 
}

export function drawClouds(mainCtx, camX_m, camY_m, ppm, spacecraftAltitudeAGL, cloudLayersArray) { 
    cloudLayersArray.forEach(layer => { 
        const parallaxOffsetX = camX_m * (1 - layer.parallaxFactor); 
        const parallaxOffsetY = camY_m * (1 - layer.parallaxFactor); 
        layer.clouds.forEach(cloud => { 
            let overallAlpha = cloud.baseAlpha; 
            if (spacecraftAltitudeAGL > MAX_CLOUD_ALTITUDE_M + 10000) { 
                overallAlpha *= Math.max(0, 1 - (spacecraftAltitudeAGL - (MAX_CLOUD_ALTITUDE_M + 10000)) / 50000); 
            } 
            if (overallAlpha <= 0.01) return; 
            cloud.puffs.forEach(puff => { 
                const puffWorldX = cloud.x_m + puff.dx_m; 
                const puffWorldY = cloud.y_m + puff.dy_m; 
                const viewX_px = (puffWorldX - (camX_m - parallaxOffsetX)) * ppm; 
                const viewY_px = (puffWorldY - (camY_m - parallaxOffsetY)) * ppm; 
                const radius_px = Math.max(1, puff.r_m * ppm ); 
                const screenX_px = mainCtx.canvas.width / 2 + viewX_px; 
                const screenY_px = mainCtx.canvas.height / 2 - viewY_px; 
                if (screenX_px + radius_px < 0 || screenX_px - radius_px > mainCtx.canvas.width || 
                    screenY_px + radius_px < 0 || screenY_px - radius_px > mainCtx.canvas.height) return; 
                mainCtx.fillStyle = `rgba(235, 235, 250, ${overallAlpha.toFixed(2)})`; 
                mainCtx.beginPath(); mainCtx.arc(screenX_px, screenY_px, radius_px, 0, 2 * Math.PI); mainCtx.fill(); 
            }); 
        }); 
    }); 
}

export function generateSurfaceFeatures(surfaceFeaturesArrayRef) { 
    surfaceFeaturesArrayRef.length = 0;
    for (let i = 0; i < NUM_SURFACE_FEATURES; i++) { 
        const angle = Math.random() * 2 * Math.PI; 
        const type = Math.random() < 0.3 ? 'mountain' : 'tree';  
        let featureHeight_m, baseWidth_m; let color; 
        if (type === 'mountain') { 
            featureHeight_m = 100 + Math.random() * MAX_MOUNTAIN_HEIGHT_M; 
            baseWidth_m = featureHeight_m * (1.5 + Math.random()); 
            const gray = 80 + Math.random() * 40; 
            color = `rgb(${gray},${gray},${gray})`; 
        } else { 
            featureHeight_m = 5 + Math.random() * MAX_TREE_HEIGHT_M; 
            baseWidth_m = featureHeight_m * 0.2 + Math.random() * (featureHeight_m * 0.1); 
            const green = 30 + Math.random() * 50; 
            color = `rgb(0, ${green}, 0)`; 
        } 
        surfaceFeaturesArrayRef.push({ angle, type, height_m: featureHeight_m, baseWidth_m, color }); 
    } 
    surfaceFeaturesArrayRef.sort((a, b) => a.angle - b.angle); 
}

export function drawSurfaceFeatures(mainCtx, camX_m, camY_m, ppm, surfaceFeaturesArray) { 
    if (ppm < SURFACE_FEATURE_VISIBILITY_PPM) return;  
    const viewAngleWidth = (mainCtx.canvas.width / ppm) / planet.radius_m * 1.5; 
    const cameraAngle = Math.atan2(camX_m, camY_m); 
    surfaceFeaturesArray.forEach(feature => { 
        let angleDiff = Math.abs(feature.angle - cameraAngle); 
        if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;  
        if (angleDiff > viewAngleWidth / 2) return; 
        const featureBaseX_m = planet.radius_m * Math.sin(feature.angle); 
        const featureBaseY_m = planet.radius_m * Math.cos(feature.angle); 
        const viewX_px = (featureBaseX_m - camX_m) * ppm; 
        const viewY_px = (featureBaseY_m - camY_m) * ppm; 
        const screenX_px = mainCtx.canvas.width / 2 + viewX_px; 
        const screenY_px = mainCtx.canvas.height / 2 - viewY_px;  
        const height_px = feature.height_m * ppm; 
        const base_px = feature.baseWidth_m * ppm; 
        if (height_px < 0.5 && base_px < 0.5) return;  
        mainCtx.save(); 
        mainCtx.translate(screenX_px, screenY_px); 
        mainCtx.rotate(feature.angle); 
        mainCtx.fillStyle = feature.color; 
        if (feature.type === 'mountain') { 
            if (base_px > 0.5 && height_px > 0.5) { 
                mainCtx.beginPath(); mainCtx.moveTo(0, 0); 
                mainCtx.lineTo(-base_px / 2, -height_px); 
                mainCtx.lineTo(base_px / 2, -height_px); 
                mainCtx.closePath(); mainCtx.fill(); 
            } 
        } else { 
            if (base_px > 0.2 && height_px > 0.5) { 
                const trunkHeight_px = height_px * 0.4; 
                const foliageRadius_px = height_px * 0.6; 
                mainCtx.fillRect(-base_px / 2, -trunkHeight_px, base_px, trunkHeight_px); 
                mainCtx.beginPath(); 
                mainCtx.arc(0, -trunkHeight_px - foliageRadius_px * 0.6, foliageRadius_px, 0, 2 * Math.PI); 
                mainCtx.fill(); 
            } 
        } 
        mainCtx.restore(); 
    }); 
}

export function drawOrbitPath(mainCtx, camX_m, camY_m, ppm, spacecraftRef, apoapsisAGL, periapsisAGL) { 
    if (!spacecraftRef || spacecraftRef.altitudeAGL_m < ORBIT_PATH_VISIBILITY_ALTITUDE_M && ppm > ORBIT_PATH_VISIBILITY_PPM) return;  
    if (apoapsisAGL === Infinity || isNaN(apoapsisAGL) || isNaN(periapsisAGL) || spacecraftRef.totalMass_kg <=0) return;  
    const mu = GRAVITATIONAL_CONSTANT_G * planet.mass_kg; 
    const r_vec_x = spacecraftRef.position_x_m; const r_vec_y = spacecraftRef.position_y_m; 
    const v_vec_x = spacecraftRef.velocity_x_ms; const v_vec_y = spacecraftRef.velocity_y_ms; 
    const r_mag = Math.sqrt(r_vec_x**2 + r_vec_y**2); 
    const v_mag_sq = v_vec_x**2 + v_vec_y**2; 
    const specificOrbitalEnergy = v_mag_sq / 2 - mu / r_mag; 
    if (specificOrbitalEnergy >= 0) return;  
    const h_vec_z = r_vec_x * v_vec_y - r_vec_y * v_vec_x;  
    const eccentricity_vec_x = (v_mag_sq - mu / r_mag) * r_vec_x / mu - (r_vec_x * v_vec_x + r_vec_y * v_vec_y) * v_vec_x / mu; 
    const eccentricity_vec_y = (v_mag_sq - mu / r_mag) * r_vec_y / mu - (r_vec_x * v_vec_x + r_vec_y * v_vec_y) * v_vec_y / mu; 
    const eccentricity = Math.sqrt(eccentricity_vec_x**2 + eccentricity_vec_y**2); 
    if (eccentricity >= 1) return;  
    const semiMajorAxis = -mu / (2 * specificOrbitalEnergy); 
    const argOfPeriapsis_rad = Math.atan2(eccentricity_vec_y, eccentricity_vec_x); 
    mainCtx.strokeStyle = 'rgba(150, 150, 255, 0.5)'; 
    mainCtx.lineWidth = Math.max(1, 1 / ppm * 0.00001); 
    mainCtx.beginPath(); 
    for (let i = 0; i <= ORBIT_PATH_SEGMENTS; i++) { 
        const trueAnomaly_rad = (i / ORBIT_PATH_SEGMENTS) * 2 * Math.PI; 
        const r_path = semiMajorAxis * (1 - eccentricity**2) / (1 + eccentricity * Math.cos(trueAnomaly_rad)); 
        const x_perifocal = r_path * Math.cos(trueAnomaly_rad); 
        const y_perifocal = r_path * Math.sin(trueAnomaly_rad); 
        const x_world = x_perifocal * Math.cos(argOfPeriapsis_rad) - y_perifocal * Math.sin(argOfPeriapsis_rad); 
        const y_world = x_perifocal * Math.sin(argOfPeriapsis_rad) + y_perifocal * Math.cos(argOfPeriapsis_rad); 
        const viewX_px = (x_world - camX_m) * ppm; 
        const viewY_px = (y_world - camY_m) * ppm; 
        const screenX_px = mainCtx.canvas.width / 2 + viewX_px; 
        const screenY_px = mainCtx.canvas.height / 2 - viewY_px; 
        if (i === 0) mainCtx.moveTo(screenX_px, screenY_px); 
        else mainCtx.lineTo(screenX_px, screenY_px); 
    } 
    mainCtx.stroke(); 
    mainCtx.lineWidth = 1;  
}


export function drawPlanet(mainCtx, camX_m, camY_m, ppm) { 
    const viewCenterX_px = mainCtx.canvas.width / 2; 
    const viewCenterY_px = mainCtx.canvas.height / 2;
    const planetViewX_px = (0 - camX_m) * ppm;
    const planetViewY_px = (0 - camY_m) * ppm;
    const planetScreenX_px = viewCenterX_px + planetViewX_px; 
    const planetScreenY_px = viewCenterY_px - planetViewY_px; 
    const planetRadius_px = planet.radius_m * ppm;
    //document.getElementById('gameCanvas');
    let planetSVG = SVG('#planetEarthSVG');

   // SVG.on(document, 'DOMContentLoaded', function() {
    // if (!planetSVG) {
    //     planetSVG = SVG().addTo('#gameCanvas').size('100%', '100%'); // Create a new SVG element if it doesn't exist
    //     planetSVG.id = 'planetEarthSVG'; // Ensure the SVG has an ID for future reference
    //     gameCanvasSVG.add(planetSVG);
    // }
    planetSVG.clear(); // Clear previous drawings
    planetSVG.size(mainCtx.canvas.width, mainCtx.canvas.height); // Ensure SVG scales to canvas size
    //planetSVG.scale(1 / ppm); // Scale the SVG to match the canvas PPM
    planetSVG.circle(planetRadius_px*2)
               // .move(planetScreenX_px, planetScreenY_px)
                .fill('#f06');
   // planetSVG.find(".continent").each({y=> y.scale(planetRadius_px*2/100.0).move(planetScreenX_px, planetScreenY_px).fill("#2ecc71");
    if (planet.maxAtmosphereRadius_m * ppm > 2) { 
         const atmRadius_px = planet.maxAtmosphereRadius_m * ppm;
         mainCtx.fillStyle = planet.atmosphereColor; 
         mainCtx.beginPath();
         mainCtx.arc(planetScreenX_px, planetScreenY_px, atmRadius_px, 0, 2 * Math.PI); 
         mainCtx.fill();
    }
    if (planetRadius_px > 0.5) { 
        var planet = planetSVG.circle(planetRadius_px, x= viewCenterX_px, y = viewCenterY_px).fill(planet.color);
      // planet.fillStyle = planet.color; 
        //mainCtx.beginPath();
        //mainCtx.arc(planetScreenX_px, planetScreenY_px, planetRadius_px, 0, 2 * Math.PI); 
        //mainCtx.fill();
        
    }
}

export function drawSkyBackground(mainCtx, spacecraftAltitudeAGL, canvasWidth, canvasHeight) {
    const atmFactor = spacecraftAltitudeAGL !== null ? Math.max(0, 1 - Math.min(1, spacecraftAltitudeAGL / EARTH_MAX_ATMOSPHERE_ALTITUDE)) : 1;
    const skyR = SPACE_BLACK_COLOR.r + (SKY_BLUE_COLOR.r - SPACE_BLACK_COLOR.r) * atmFactor;
    const skyG = SPACE_BLACK_COLOR.g + (SKY_BLUE_COLOR.g - SPACE_BLACK_COLOR.g) * atmFactor;
    const skyB = SPACE_BLACK_COLOR.b + (SKY_BLUE_COLOR.b - SPACE_BLACK_COLOR.b) * atmFactor;
    mainCtx.fillStyle = `rgb(${Math.round(skyR)},${Math.round(skyG)},${Math.round(skyB)})`; 
    mainCtx.fillRect(0, 0, canvasWidth, canvasHeight); 
}