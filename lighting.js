import { planet } from './constants.js';
import { PIXI } from './main.js';
// Sun position is fixed at a large distance
const SUN_DISTANCE_M = 1.496e11; // 1 AU
const SUN_ANGLE_RAD = Math.PI / 4; // 45 degrees from horizontal

export function calculateLighting(container, cameraX_m, cameraY_m, pixelsPerMeter, screenWidth, screenHeight) {
    // Calculate sun's position in world coordinates
    const sunX_m = SUN_DISTANCE_M * Math.cos(SUN_ANGLE_RAD);
    const sunY_m = -SUN_DISTANCE_M * Math.sin(SUN_ANGLE_RAD);
    
    // Convert to screen coordinates
    const sunScreenX = screenWidth/2 + (sunX_m - cameraX_m) * pixelsPerMeter;
    const sunScreenY = screenHeight/2 + (sunY_m - cameraY_m) * pixelsPerMeter;
    
    // Create lighting overlay
    const lightingGraphics = new PIXI.Graphics();
    
    // Create gradient for lighting
    const gradient = new PIXI.Graphics();
    gradient.beginFill(0xFFFFFF, 0.1);
    gradient.drawRect(0, 0, screenWidth, screenHeight);
    gradient.endFill();
    
    // Add lighting effects to all objects in the container
    container.children.forEach(child => {
        if (child instanceof PIXI.Graphics) {
            // Calculate distance and angle to sun
            const dx = child.position.x - sunScreenX;
            const dy = child.position.y - sunScreenY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
            
            // Apply lighting based on angle and distance
            const lightingIntensity = Math.max(0.3, Math.min(1, 1 - (distance / (screenWidth * 2))));
            child.tint = 0xFFFFFF;
            child.alpha = lightingIntensity;
        }
    });
    
    // Add ambient light
    const ambientLight = new PIXI.Graphics();
    ambientLight.beginFill(0xFFFFFF, 0.2);
    ambientLight.drawRect(0, 0, screenWidth, screenHeight);
    ambientLight.endFill();
    
    container.addChild(ambientLight);
}

export function updateLighting(deltaTime_s) {
    // Could add day/night cycle here if desired
    // For now, sun position is fixed
} 