import { EARTH_MAX_ATMOSPHERE_ALTITUDE, EARTH_SEA_LEVEL_AIR_DENSITY, planet,
         SMOKE_LIFETIME_S_MIN, SMOKE_LIFETIME_S_MAX,
         SMOKE_INITIAL_SIZE_M_MIN, SMOKE_INITIAL_SIZE_M_MAX
       } from './constants.js';
// currentAirDensityValue will be passed from main.js or a global state
let main_currentAirDensityValue = EARTH_SEA_LEVEL_AIR_DENSITY;

export function initializeSmoke(airDensityRef) {
    // This is a bit clunky, ideally smoke particles would get this from the environment module
    // or it's passed to their update method. For now, they'll use a module-scoped var.
    // Or better, pass it to the update method of the particle. Let's do that.
}


export class SmokeParticle {
    constructor(x_m, y_m, vx_ms, vy_ms) { 
        this.x_m = x_m; this.y_m = y_m; 
        this.vx_ms = vx_ms; this.vy_ms = vy_ms;
        this.lifetime_s = SMOKE_LIFETIME_S_MIN + Math.random() * (SMOKE_LIFETIME_S_MAX - SMOKE_LIFETIME_S_MIN); 
        this.age_s = 0; 
        this.size_m = SMOKE_INITIAL_SIZE_M_MIN + Math.random() * (SMOKE_INITIAL_SIZE_M_MAX - SMOKE_INITIAL_SIZE_M_MIN); 
        const grayScale = 160 + Math.random() * 60; 
        this.initialOpacity = 0.35 + Math.random() * 0.35; 
        // this.color = `rgba(${grayScale},${grayScale},${grayScale},${this.initialOpacity.toFixed(2)})`; // No longer needed for graphics color
        this.growthFactor = 2.0 + Math.random() * 3.0;

        // Initialize PIXI.Graphics object
        this.graphics = new PIXI.Graphics();
        this.graphics.beginFill(0x808080, 1); // Base color gray, alpha 1. Actual alpha set in draw().
        this.graphics.drawCircle(0, 0, 1);    // Unit circle (radius 1), scaled in draw().
        this.graphics.endFill();
        this.graphics.visible = false; // Initially not visible, made visible in draw() if active.
    }
    update(deltaTime_s, currentGlobalAirDensity) { // Pass current air density
        this.x_m += this.vx_ms * deltaTime_s; 
        this.y_m += this.vy_ms * deltaTime_s; 
        this.age_s += deltaTime_s; 
        const altitude = Math.sqrt(this.x_m**2 + this.y_m**2) - planet.radius_m; 
        if (altitude < EARTH_MAX_ATMOSPHERE_ALTITUDE && altitude > 0) { 
            const particleDragFactor = 0.1 + Math.random() * 0.2; 
            this.vx_ms *= (1 - particleDragFactor * deltaTime_s * (currentGlobalAirDensity / EARTH_SEA_LEVEL_AIR_DENSITY)); 
            this.vy_ms *= (1 - particleDragFactor * deltaTime_s * (currentGlobalAirDensity / EARTH_SEA_LEVEL_AIR_DENSITY)); 
        } 
    }
    
    draw(smokeContainer, camX_m, camY_m, ppm, canvasWidth, canvasHeight) { // Pass canvas dimensions for culling
        if (this.age_s >= this.lifetime_s) return; 
        const viewX_px = (this.x_m - camX_m) * ppm; 
        const viewY_px = (this.y_m - camY_m) * ppm; 
        const currentSize_m = this.size_m * (1 + (this.age_s / this.lifetime_s) * this.growthFactor); 
        const radius_px = Math.max(0.5, (currentSize_m / 2) * ppm); 
        const screenX_px = canvasWidth / 2 + viewX_px; 
        const screenY_px = canvasHeight / 2 - viewY_px; 
        if (screenX_px + radius_px < -canvasWidth || screenX_px - radius_px > canvasWidth*2 || 
            screenY_px + radius_px < -canvasHeight || screenY_px - radius_px > canvasHeight*2) return; 
        
        let opacityFactor = 0; 
        const fadeInDuration = this.lifetime_s * 0.05; 
        const fadeOutStart = this.lifetime_s * 0.3; 
        if (this.age_s < fadeInDuration) { opacityFactor = this.age_s / fadeInDuration; } 
        else if (this.age_s > fadeOutStart) { opacityFactor = 1 - (this.age_s - fadeOutStart) / (this.lifetime_s - fadeOutStart); } 
        else { opacityFactor = 1; } 
        opacityFactor = Math.max(0, opacityFactor); 
        const opacity = this.initialOpacity * opacityFactor; 
        if (opacity < 0.005) {
            this.graphics.visible = false; 
            return; // Particle is too transparent or expired, ensure it's not drawn
        }
        
        // Update the existing graphics object's properties
        this.graphics.position.set(screenX_px, screenY_px);
        this.graphics.scale.set(radius_px, radius_px); // Scale the unit circle drawn in constructor
        this.graphics.alpha = opacity;                 // Set the current alpha
        this.graphics.visible = true;                  // Make it visible for this frame
        
        // Note: Adding this.graphics to smokeContainer is now handled in main.js gameLoop
    }
}