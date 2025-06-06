import { planet } from './constants.js';
import { PIXI } from './main.js';

let X = 0;
let Y = 0;
export function updateMoonPosition(deltaTime_s) {
    // Update moon's orbital angle based on its orbital period
    const angularVelocity = (2 * Math.PI) / planet.moon.orbitalPeriod_s;
    planet.moon.currentAngle_rad += angularVelocity * deltaTime_s;
    
    // Keep angle between 0 and 2π
    planet.moon.currentAngle_rad = planet.moon.currentAngle_rad % (2 * Math.PI);
    return {
        X: planet.moon.orbitRadius_m * Math.sin(planet.moon.currentAngle_rad),
        Y: -planet.moon.orbitRadius_m * Math.cos(planet.moon.currentAngle_rad)
    }
}

export function drawMoon(container, deltaTime_s) {
    // Calculate moon's position

    
    // Create moon graphics
    const {X, Y} = updateMoonPosition(deltaTime_s);

    var moonGraphics = container.getChildByLabel("moon");
    if (!moonGraphics) {
        moonGraphics = new PIXI.Graphics();
        moonGraphics.label = "moon";
      //  moonGraphics.anchor.set(0.5, 0.5);
        
    moonGraphics.circle(X, Y, planet.moon.radius_m)
        .fill(planet.moon.color);
        container.addChild(moonGraphics);
    }

    moonGraphics.position.set(X, Y);

} 