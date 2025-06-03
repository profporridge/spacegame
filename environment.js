import { 
    planet, MIN_CLOUD_ALTITUDE_M, MAX_CLOUD_ALTITUDE_M, NUM_CLOUD_LAYERS, CLOUDS_PER_LAYER,
    CLOUD_PARALLAX_FACTOR_MIN, CLOUD_PARALLAX_FACTOR_MAX, CLOUD_BASE_SIZE_MIN, CLOUD_BASE_SIZE_MAX,
    NUM_SURFACE_FEATURES, MAX_MOUNTAIN_HEIGHT_M, MAX_TREE_HEIGHT_M, SURFACE_FEATURE_VISIBILITY_PPM,
    ORBIT_PATH_VISIBILITY_ALTITUDE_M, ORBIT_PATH_VISIBILITY_PPM, ORBIT_PATH_SEGMENTS,
    GRAVITATIONAL_CONSTANT_G, SKY_BLUE_COLOR, SPACE_BLACK_COLOR, EARTH_MAX_ATMOSPHERE_ALTITUDE
} from './constants.js';
import {PIXI} from './main.js'; // Import PIXI from main.js, assuming it's globally available


export  function generateClouds(cloudLayersArrayRef) { 
 
  
    cloudLayersArrayRef.length = 0; // Clear existing layers
    for (let layer = 0; layer < NUM_CLOUD_LAYERS; layer++) { 
        const layerClouds = []; 
        const parallax = 0;// CLOUD_PARALLAX_FACTOR_MIN + (CLOUD_PARALLAX_FACTOR_MAX - CLOUD_PARALLAX_FACTOR_MIN) * (layer / (NUM_CLOUD_LAYERS -1 || 1)); 
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
            layerClouds.push({ x_m, y_m, puffs, baseAlpha: 0.2 + Math.random() * 0.3 ,  }); 
        } 
        cloudLayersArrayRef.push({clouds: layerClouds, parallaxFactor: parallax}); 
    } 
}

export function drawClouds(container, camX_m, camY_m, ppm, spacecraftAltitudeAGL, cloudLayersArray,  cloudTextures, screenwidth, screenheight) { 
    const canvasWidth = screenwidth;//container.parent.view.width;
    const canvasHeight = screenheight; // container.parent.view.height;
    const viewCenterX_px = canvasWidth / 2;
    const viewCenterY_px = canvasHeight / 2;

    cloudLayersArray.forEach(layer => { 
        const parallaxOffsetX = 0;
        const parallaxOffsetY = 0;
        layer.clouds.forEach(cloud => { 
            let overallAlpha = cloud.baseAlpha; 
            if (spacecraftAltitudeAGL > MAX_CLOUD_ALTITUDE_M + 10000) { 
                overallAlpha *= Math.max(0, 1 - (spacecraftAltitudeAGL - (MAX_CLOUD_ALTITUDE_M + 10000)) / 50000); 
            } 
            if (overallAlpha <= 0.01) return; 

            const cloudPuffColor = 0xEBEBFA; // rgba(235, 235, 250)

            cloud.puffs.forEach(puff => { 
                const puffWorldX = cloud.x_m + puff.dx_m; 
                const puffWorldY = cloud.y_m + puff.dy_m; 

                const viewX_px = (puffWorldX - (camX_m - parallaxOffsetX)) * ppm; 
                const viewY_px = (puffWorldY - (camY_m - parallaxOffsetY)) * ppm; 
                const radius_px = Math.max(1, puff.r_m * ppm ); 
                
               const screenX_px = viewCenterX_px + viewX_px; 
               const screenY_px = viewCenterY_px - viewY_px; // Correcting for Pixi's Y-down system

               if (screenX_px + radius_px < 0 || screenX_px - radius_px > canvasWidth || 
                   screenY_px + radius_px < 0 || screenY_px - radius_px > canvasHeight) return; 
                
                const puffSprite = new PIXI.Sprite(cloudTextures['cloud_1']);
      
                puffSprite.x = screenX_px;
                puffSprite.y = screenY_px;
                container.addChild(puffSprite);
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

export function drawSurfaceFeatures(container, camX_m, camY_m, ppm, surfaceFeaturesArray, screenwidth, screenheight) {
    if (ppm < SURFACE_FEATURE_VISIBILITY_PPM) return;

    const canvasWidth = screenwidth;
    const canvasHeight = screenheight;
    const viewCenterX_px = canvasWidth / 2;
    const viewCenterY_px = canvasHeight / 2;

    const viewAngleWidth = (canvasWidth / ppm) / planet.radius_m * 1.5;
    const cameraAngle = Math.atan2(camX_m, camY_m);

    surfaceFeaturesArray.forEach(feature => {
        let angleDiff = Math.abs(feature.angle - cameraAngle);
        if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
        if (angleDiff > viewAngleWidth / 2) return;

        const featureBaseX_m = planet.radius_m * Math.sin(feature.angle);
        const featureBaseY_m = planet.radius_m * Math.cos(feature.angle);
        const viewX_px = (featureBaseX_m - camX_m) * ppm;
        const viewY_px = (featureBaseY_m - camY_m) * ppm;
        const screenX_px = viewCenterX_px + viewX_px;
        const screenY_px = viewCenterY_px - viewY_px; // Correct for Y-down

        const height_px = feature.height_m * ppm;
        const base_px = feature.baseWidth_m * ppm;

        if (height_px < 0.5 && base_px < 0.5) return;

        const featureGraphic = new PIXI.Graphics();
        const colorData = parseRgba(feature.color); // Assumes parseRgba handles rgb()
        const hexColor = (colorData.r << 16) + (colorData.g << 8) + colorData.b;
        featureGraphic.beginFill(hexColor, colorData.alpha);

        if (feature.type === 'mountain') {
            if (base_px > 0.5 && height_px > 0.5) {
                // Draw polygon relative to (0,0) before positioning and rotating
                featureGraphic.moveTo(0, 0); // Tip of the mountain at the planet surface point
                featureGraphic.lineTo(-base_px / 2, -height_px); // Bottom-left
                featureGraphic.lineTo(base_px / 2, -height_px);  // Bottom-right
                featureGraphic.closePath();
            }
        } else { // tree
            if (base_px > 0.2 && height_px > 0.5) {
                const trunkHeight_px = height_px * 0.4;
                const foliageRadius_px = height_px * 0.6;
                // Trunk - draw relative to (0,0) which is base of trunk center
                featureGraphic.drawRect(-base_px / 2, -trunkHeight_px, base_px, trunkHeight_px);
                // Foliage - draw relative to (0,0) which is base of trunk center
                featureGraphic.drawCircle(0, -trunkHeight_px - foliageRadius_px * 0.6, foliageRadius_px);
            }
        }
        featureGraphic.endFill();
        
        // Apply transformations
        featureGraphic.x = screenX_px;
        featureGraphic.y = screenY_px;
        featureGraphic.rotation = feature.angle; // Rotate around the planet surface point

        container.addChild(featureGraphic);
    });
}

export function drawOrbitPath(mainCtx, camX_m, camY_m, ppm, spacecraftRef, apoapsisAGL, periapsisAGL) { 
    if (!spacecraftRef || spacecraftRef.altitudeAGL_m < ORBIT_PATH_VISIBILITY_ALTITUDE_M && ppm > ORBIT_PATH_VISIBILITY_PPM) return;  
    if (apoapsisAGL === Infinity || isNaN(apoapsisAGL) || isNaN(periapsisAGL) || spacecraftRef.totalMass_kg <=0) return;
    mainCtx.removeChildren(); // Clear previous orbit paths
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

    const orbitPathGraphic = new PIXI.Graphics();
    const pathColorData = parseRgba('rgba(150, 150, 255, 0.5)');
    const pathHexColor = (pathColorData.r << 16) + (pathColorData.g << 8) + pathColorData.b;
    const lineWidth = Math.max(1, 1 / ppm * 0.00001); // This might become very small for Pixi lineStyle

    orbitPathGraphic.lineStyle(lineWidth, pathHexColor, pathColorData.alpha);

    const canvasWidth = mainCtx.parent.width;
    const canvasHeight = mainCtx.parent.height;
    const viewCenterX_px = canvasWidth / 2;
    const viewCenterY_px = canvasHeight / 2;

    for (let i = 0; i <= ORBIT_PATH_SEGMENTS; i++) {
        const trueAnomaly_rad = (i / ORBIT_PATH_SEGMENTS) * 2 * Math.PI;
        const r_path = semiMajorAxis * (1 - eccentricity**2) / (1 + eccentricity * Math.cos(trueAnomaly_rad));
        const x_perifocal = r_path * Math.cos(trueAnomaly_rad);
        const y_perifocal = r_path * Math.sin(trueAnomaly_rad);
        const x_world = x_perifocal * Math.cos(argOfPeriapsis_rad) - y_perifocal * Math.sin(argOfPeriapsis_rad);
        const y_world = x_perifocal * Math.sin(argOfPeriapsis_rad) + y_perifocal * Math.cos(argOfPeriapsis_rad);
        const viewX_px = (x_world - camX_m) * ppm;
        const viewY_px = (y_world - camY_m) * ppm;
        const screenX_px = viewCenterX_px + viewX_px;
        const screenY_px = viewCenterY_px - viewY_px; // Correct for Y-down

        if (i === 0) orbitPathGraphic.moveTo(screenX_px, screenY_px);
        else orbitPathGraphic.lineTo(screenX_px, screenY_px);
    }
    // No stroke() needed, lineTo builds the path for lineStyle
    mainCtx.addChild(orbitPathGraphic);
}

// Helper function to parse rgba string
function parseRgba(rgbaString) {
    const match = rgbaString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!match) throw new Error('Invalid rgba string: ' + rgbaString); // Added error context
    return {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3]),
        alpha: match[4] !== undefined ? parseFloat(match[4]) : 1
    };
}

export function drawPlanet(container, camX_m, camY_m, ppm, screenwidth, screenheight) { 
    const canvasWidth = screenwidth; // container.parent.view.width; 
    const canvasHeight = screenheight; // container.parent.view.height;
    const viewCenterX_px = canvasWidth / 2; 
    const viewCenterY_px = canvasHeight / 2;
    const planetViewX_px = (0 - camX_m) * ppm;
    const planetViewY_px = (0 - camY_m) * ppm; // PixiJS Y is down, so this might need adjustment if camY_m is Y-up. Assuming camY_m is world Y-up.
    
    // Screen X, Y for the center of the planet
    const planetScreenX_px = viewCenterX_px + planetViewX_px; 
    const planetScreenY_px = viewCenterY_px - planetViewY_px; // Correcting for Pixi's Y-down system.
    
    const planetRadius_px = planet.radius_m * ppm;

    // Draw Atmosphere
    if (planet.maxAtmosphereRadius_m * ppm > 2) { 
        const atmRadius_px = planet.maxAtmosphereRadius_m * ppm;
        const atmColorData = parseRgba(planet.atmosphereColor);
        const atmHexColor = (atmColorData.r << 16) + (atmColorData.g << 8) + atmColorData.b;
        
        const atmosphereGraphic = new PIXI.Graphics();
       // atmosphereGraphic.beginFill(atmHexColor, atmColorData.alpha);
        atmosphereGraphic.circle(0, 0, atmRadius_px); // Draw at origin, then position
        atmosphereGraphic.fill({color:atmHexColor, alpha:atmColorData.alpha});
        atmosphereGraphic.x = planetScreenX_px;
        atmosphereGraphic.y = planetScreenY_px;
        container.addChild(atmosphereGraphic);
    }

    // Draw Planet Body
    if (planetRadius_px > 0.5) { 
        // Assuming planet.color is a hex string like '#RRGGBB'
        const planetHexColor = parseInt(planet.color.substring(1), 16);
        
        const planetGraphic = new PIXI.Graphics();
       // planetGraphic.beginFill(planetHexColor);
        planetGraphic.circle(0, 0, planetRadius_px); // Draw at origin, then position
        planetGraphic.fill(planetHexColor);
        planetGraphic.x = planetScreenX_px;
        planetGraphic.y = planetScreenY_px;
        container.addChild(planetGraphic);
    }
}

export function drawSkyBackground(container, spacecraftAltitudeAGL, canvasWidth, canvasHeight) {
    const atmFactor = spacecraftAltitudeAGL !== null ? Math.max(0, 1 - Math.min(1, spacecraftAltitudeAGL / EARTH_MAX_ATMOSPHERE_ALTITUDE)) : 1;
    const skyR = SPACE_BLACK_COLOR.r + (SKY_BLUE_COLOR.r - SPACE_BLACK_COLOR.r) * atmFactor;
    const skyG = SPACE_BLACK_COLOR.g + (SKY_BLUE_COLOR.g - SPACE_BLACK_COLOR.g) * atmFactor;
    const skyB = SPACE_BLACK_COLOR.b + (SKY_BLUE_COLOR.b - SPACE_BLACK_COLOR.b) * atmFactor;
    
    const skyColor = (Math.round(skyR) << 16) + (Math.round(skyG) << 8) + Math.round(skyB);
    
    const skyRect = new PIXI.Graphics();
    skyRect.beginFill(skyColor);
    skyRect.drawRect(0, 0, canvasWidth, canvasHeight);
    skyRect.endFill();
    container.addChild(skyRect);
}