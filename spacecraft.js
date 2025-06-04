import {
    GRAVITATIONAL_CONSTANT_G, planet, EARTH_MAX_ATMOSPHERE_ALTITUDE, EARTH_SEA_LEVEL_AIR_DENSITY,
    EARTH_ATMOSPHERE_SCALE_HEIGHT, DRAG_COEFFICIENT, MAX_GIMBAL_ANGLE_DEG, GIMBAL_RATE_DEG_S,
    BASE_REACTION_WHEEL_TORQUE, MAX_ANGULAR_VELOCITY, SMOKE_PARTICLES_PER_SECOND_BASE,
    MAX_SMOKE_PARTICLES, SMOKE_EXHAUST_VELOCITY_FACTOR, SMOKE_PERSIST_CHANCE, COLOR_NAMES
} from './constants.js';
import { SmokeParticle } from './smoke.js';
import { CommandPod, FuelTank, Engine, Fairing } from './parts.js'; // To instantiate parts
import { PIXI } from './main.js'; // Import PIXI from main.js, assuming it's globally available
//import * as PIXI from 'https://cdn.jsdelivr.net/npm/pixi.js@8.9.2/dist/pixi.mjs';
// Note: playEngineSound, playGimbalSound will be imported in main.js and passed or called globally

// These will be set by main.js
let main_playEngineSound = () => { };
let main_playGimbalSound = () => { };
let main_simulationState = {}; // To access simulationState.engineActive
let main_smokeParticles = []; // To push new smoke particles
let main_currentAirDensityValue = EARTH_SEA_LEVEL_AIR_DENSITY; // For smoke drag
let main_oldSmokeParticles = []; // For old smoke particles, these will no longer be updated

export function initializeSpacecraftAndParts(playEngineSoundFunc, playGimbalSoundFunc, simState, smokeArray, oldSmokeArray, airDensityVar) {
    main_playEngineSound = playEngineSoundFunc;
    main_playGimbalSound = playGimbalSoundFunc;
    main_simulationState = simState;
    main_smokeParticles = smokeArray; // Reference to the global smoke particles array
    main_oldSmokeParticles = oldSmokeArray; // Reference to the global old smoke particles array
    main_currentAirDensityValue = airDensityVar; // This will be updated in main.js
}

// Helper function to parse rgba string (copied from environment.js / parts.js)
function parseRgba(rgbaString) {
    if (typeof rgbaString === 'number') return { hex: rgbaString, alpha: 1 }; // Already a hex
    if (rgbaString.startsWith('#')) {
        return { hex: parseInt(rgbaString.substring(1), 16), alpha: 1 };
    }
    const match = rgbaString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!match) {
        console.warn('Invalid color string, defaulting to gray:', rgbaString);
        return { hex: 0x808080, alpha: 1 }; // Default to gray if parsing fails
    }
    return {
        hex: (parseInt(match[1]) << 16) + (parseInt(match[2]) << 8) + parseInt(match[3]),
        alpha: match[4] !== undefined ? parseFloat(match[4]) : 1
    };
}


export class Spacecraft {
    constructor(partsConfigArray) {
        this.partsConfigArray = partsConfigArray;
        this.parts = [];
        this.position_x_m = 0; this.position_y_m = planet.radius_m;
        this.velocity_x_ms = 0; this.velocity_y_ms = 0;
        this.angle_rad = Math.PI; this.angularVelocity_rad_s = 0;
        this.totalMass_kg = 0; this.currentFuel_kg = 0;
        this.currentThrust_N = 0; this.maxThrust_N = 0;
        this.logicalStackHeight_m = 0; this.maxWidth_m = 0;
        this.momentOfInertia_kg_m2 = 1000;
        this.altitudeAGL_m = 0;
        this.engineGimbalAngle_rad = 0;
        this.maxGimbalAngle_rad = MAX_GIMBAL_ANGLE_DEG * Math.PI / 180;
        this.gimbalRate_rad_s = GIMBAL_RATE_DEG_S * Math.PI / 180;
        this.initialFuel_kg = 0;
        this.cachedGraphics = null;

        partsConfigArray.forEach(partConfig => {
            let partInstance;
            switch (partConfig.type) {
                case 'pod': partInstance = new CommandPod(partConfig); break;
                case 'tank': partInstance = new FuelTank(partConfig); break;
                case 'engine': partInstance = new Engine(partConfig); break;
                case 'fairing': partInstance = new Fairing(partConfig); break;
                default: console.error("Unknown part type:", partConfig.type); return;
            }
            if (partInstance) this.parts.push(partInstance);
        });
        this._reassemble();
    }
    _reassemble() {
        this.totalMass_kg = 0; let tempCurrentFuel = 0; this.maxThrust_N = 0;
        this.logicalStackHeight_m = 0; this.maxWidth_m = 0;
        let currentStackOffset_m = 0; this.initialFuel_kg = 0;
        this.parts.forEach(p => {
            p.relative_y_m = currentStackOffset_m;
            currentStackOffset_m += p.height_m;
            this.totalMass_kg += p.mass;
            if (p.type === 'tank') {
                tempCurrentFuel += p.currentFuel;
                this.initialFuel_kg += p.fuelCapacity_kg;
            }
            if (p.type === 'engine') this.maxThrust_N += p.effectiveThrust;
            if (p.width_m > this.maxWidth_m) this.maxWidth_m = p.width_m;
        });
        this.currentFuel_kg = tempCurrentFuel;
        if (this.initialFuel_kg === 0) this.initialFuel_kg = 1;
        this.logicalStackHeight_m = currentStackOffset_m;
        this.momentOfInertia_kg_m2 = (this.totalMass_kg * (this.logicalStackHeight_m ** 2 + this.maxWidth_m ** 2)) / 12;
        if (this.momentOfInertia_kg_m2 < 100) this.momentOfInertia_kg_m2 = 100;
    }
    getCrossSectionalArea(velocityAngle_rad) {
        const spacecraftWorldAngle_rad = this.angle_rad;
        const aoa_rad = Math.atan2(Math.sin(spacecraftWorldAngle_rad - velocityAngle_rad), Math.cos(spacecraftWorldAngle_rad - velocityAngle_rad));
        const frontalArea = Math.PI * (this.maxWidth_m / 2) ** 2;
        const profileArea = this.maxWidth_m * this.logicalStackHeight_m;
        return frontalArea * Math.abs(Math.cos(aoa_rad)) + profileArea * Math.abs(Math.sin(aoa_rad));
    }
    getCoMOffset_m() {
        if (this.totalMass_kg === 0) return this.logicalStackHeight_m / 2;
        let weightedHeightSum = 0;
        this.parts.forEach(p => {
            const partCenterY = p.relative_y_m + p.height_m / 2;
            weightedHeightSum += p.mass * partCenterY;
        });
        return weightedHeightSum / this.totalMass_kg;
    }
    calculateOrbitalParameters(apoapsisVar, periapsisVar) { // Pass references to update
        if (this.totalMass_kg <= 0) {
            apoapsisVar.value = 0; // Using an object to pass by reference
            periapsisVar.value = 0;
            return;
        }
        const r_vec_x = this.position_x_m; const r_vec_y = this.position_y_m;
        const v_vec_x = this.velocity_x_ms; const v_vec_y = this.velocity_y_ms;
        const r_mag = Math.sqrt(r_vec_x ** 2 + r_vec_y ** 2);
        const v_mag_sq = v_vec_x ** 2 + v_vec_y ** 2;
        const mu = GRAVITATIONAL_CONSTANT_G * planet.mass_kg;
        const specificOrbitalEnergy = v_mag_sq / 2 - mu / r_mag;

        if (specificOrbitalEnergy >= -1e-3) {
            apoapsisVar.value = Infinity;
            const h_vec_z = r_vec_x * v_vec_y - r_vec_y * v_vec_x;
            if (mu > 0 && (1 + 2 * specificOrbitalEnergy * h_vec_z ** 2 / mu ** 2) >= 0) {
                periapsisVar.value = (h_vec_z ** 2 / mu) / (1 + Math.sqrt(1 + 2 * specificOrbitalEnergy * h_vec_z ** 2 / mu ** 2)) - planet.radius_m;
            } else {
                periapsisVar.value = this.altitudeAGL_m;
            }
        } else {
            const semiMajorAxis_a = -mu / (2 * specificOrbitalEnergy);
            const h_vec_z = r_vec_x * v_vec_y - r_vec_y * v_vec_x;
            const eccentricity_e_sq = 1 + (2 * specificOrbitalEnergy * h_vec_z ** 2) / (mu ** 2);
            const eccentricity_e = Math.sqrt(Math.max(0, eccentricity_e_sq));
            apoapsisVar.value = semiMajorAxis_a * (1 + eccentricity_e) - planet.radius_m;
            periapsisVar.value = semiMajorAxis_a * (1 - eccentricity_e) - planet.radius_m;
        }
        if (isNaN(apoapsisVar.value) || apoapsisVar.value < periapsisVar.value && apoapsisVar.value !== Infinity) {
            apoapsisVar.value = this.altitudeAGL_m > periapsisVar.value ? this.altitudeAGL_m : periapsisVar.value;
        }
        if (isNaN(periapsisVar.value)) periapsisVar.value = this.altitudeAGL_m;
    }

    draw(passedSpacecraftContainer, targetCanvasWidth, targetCanvasHeight, sfcScreenX_px, sfcScreenY_px, currentPPM, isStagingView = false) {
        // if (this.cachedGraphics && passedSpacecraftContainer)
        // {
        //     if (!passedSpacecraftContainer.children.includes(this.cachedGraphics)) {   
        //     passedSpacecraftContainer.addChild(this.cachedGraphics);
        //         return;
        //     }
        //const shipGraphicsContainer = new PIXI.Container();
      const comOffset_m = this.getCoMOffset_m(); // Distance from stack bottom to CoM (Y-up)
        const shipGraphicsContainer = passedSpacecraftContainer;
        if (shipGraphicsContainer.children.length > 0 ){        shipGraphicsContainer.position.set(sfcScreenX_px, sfcScreenY_px);
        shipGraphicsContainer.rotation = this.angle_rad;}
        else {
        shipGraphicsContainer.removeChildren(); // Clear previous graphics  
        shipGraphicsContainer.label = 'Spacecraft'; // Label for debugging
        shipGraphicsContainer.position.set(sfcScreenX_px, sfcScreenY_px);
        shipGraphicsContainer.rotation = this.angle_rad;

  

        this.parts.forEach(part => {
            const drawWidth_px = part.width_m * currentPPM;
            const drawHeight_px = part.height_m * currentPPM;

            // Calculate part's top-left position relative to CoM (origin of shipGraphicsContainer)
            // CoM is (0,0) in shipGraphicsContainer.
            // part.relative_y_m is bottom of part from stack bottom (Y-up model).
            // part_top_from_com_m is part's top edge distance from CoM (Y-up model).
            const part_top_from_com_m = (part.relative_y_m + part.height_m) - comOffset_m;

            // Convert to Pixi's coordinate system (Y-down) for local positions within shipGraphicsContainer
            const partTopLeftX_local = -drawWidth_px / 2; // Centered
            const partTopLeftY_local = -part_top_from_com_m * currentPPM; // Y positive downwards

            part.draw(shipGraphicsContainer, partTopLeftX_local, partTopLeftY_local, currentPPM, isStagingView); // Show nodes if not inset
        });
    }
     shipGraphicsContainer.getChildByLabel('Flame')?.destroy(); // Remove previous flame graphics if any
        if (this.currentThrust_N > 0) {
            this.parts.forEach(p => {
                if (p.type === 'engine' && p.isActive) {
                   
                    const flameGraphics = new PIXI.Graphics();

                    // Engine's nozzle (bottom of engine part) position relative to CoM
                    // p.relative_y_m is bottom of engine from stack bottom (Y-up model)
                    const engineNozzle_y_from_com_m = p.relative_y_m - comOffset_m;
                    // Convert to Pixi's Y-down, relative to CoM (shipGraphicsContainer origin)
                    const engineNozzle_y_local_px = -engineNozzle_y_from_com_m * currentPPM;

                    const flameHeight_px = (10 + Math.random() * 15 + (this.currentThrust_N / (this.maxThrust_N || 1)) * 20) * Math.max(0.1, currentPPM / 0.2);
                    const flameWidth_px = p.width_m * currentPPM * 0.8;

                    flameGraphics.position.set(0, engineNozzle_y_local_px); // X is centered at CoM's X, Y is nozzle's Y
                    flameGraphics.rotation = this.engineGimbalAngle_rad;

                    const orange = parseRgba(COLOR_NAMES['orange']);
                    flameGraphics.beginFill(orange.hex, orange.alpha);
                    flameGraphics.moveTo(-flameWidth_px / 2, 0); // Relative to flameGraphics origin (nozzle center)
                    flameGraphics.lineTo(flameWidth_px / 2, 0);
                    flameGraphics.lineTo(0, flameHeight_px); // Flame points "down" (positive Y in its local rotated frame)
                    flameGraphics.closePath();
                    flameGraphics.endFill();

                    const yellow = parseRgba(COLOR_NAMES['yellow']);
                    const iFW = flameWidth_px * 0.5, iFH = flameHeight_px * 0.6;
                    flameGraphics.beginFill(yellow.hex, yellow.alpha);
                    flameGraphics.moveTo(-iFW / 2, 0);
                    flameGraphics.lineTo(iFW / 2, 0);
                    flameGraphics.lineTo(0, iFH);
                    flameGraphics.closePath();
                    flameGraphics.endFill();
                    flameGraphics.label = `Flame`; // Label for debugging
                    shipGraphicsContainer.addChild(flameGraphics);
                }
            });
        }
        this.cachedGraphics = shipGraphicsContainer.children;
        // passedSpacecraftContainer.addChild(shipGraphicsContainer);
    }

    updatePhysics(deltaTime_s, masterEngineCommandActive, gimbalLeft, gimbalRight, currentAirDensity, apoapsisRef, periapsisRef, smokeParticlesArray, simStateRef) {
        if (deltaTime_s <= 0 || this.totalMass_kg <= 0) return { currentAirDensity, apoapsis: apoapsisRef.value, periapsis: periapsisRef.value };

        let currentLocalGravityMagnitude_N = 0;
        let targetGimbalAngle_rad = 0;
        if (gimbalLeft) { targetGimbalAngle_rad = -this.maxGimbalAngle_rad; main_playGimbalSound(); }
        else if (gimbalRight) { targetGimbalAngle_rad = this.maxGimbalAngle_rad; main_playGimbalSound(); }

        if (this.engineGimbalAngle_rad < targetGimbalAngle_rad) { this.engineGimbalAngle_rad = Math.min(targetGimbalAngle_rad, this.engineGimbalAngle_rad + this.gimbalRate_rad_s * deltaTime_s); }
        else if (this.engineGimbalAngle_rad > targetGimbalAngle_rad) { this.engineGimbalAngle_rad = Math.max(targetGimbalAngle_rad, this.engineGimbalAngle_rad - this.gimbalRate_rad_s * deltaTime_s); }

        let netTorque_Nm = 0;
        if (gimbalLeft && !masterEngineCommandActive) netTorque_Nm -= BASE_REACTION_WHEEL_TORQUE;
        if (gimbalRight && !masterEngineCommandActive) netTorque_Nm += BASE_REACTION_WHEEL_TORQUE;

        this.currentThrust_N = 0;
        let totalFuelConsumedThisFrame_kg = 0;
        let activeEnginesThrusting = false;
        this.parts.forEach(p => { if (p.type === 'engine') { if (masterEngineCommandActive && p.isEngineActiveByUser && this.currentFuel_kg > 0) { p.isActive = true; const engineActualThrust = p.effectiveThrust; this.currentThrust_N += engineActualThrust; totalFuelConsumedThisFrame_kg += p.fuelConsumptionRate_kg_s * p.thrustLimiter * deltaTime_s; activeEnginesThrusting = true; } else { p.isActive = false; } } });

        if (activeEnginesThrusting) {
            if (totalFuelConsumedThisFrame_kg > this.currentFuel_kg) {
                const fuelFraction = this.currentFuel_kg / totalFuelConsumedThisFrame_kg;
                this.currentThrust_N *= fuelFraction;
                totalFuelConsumedThisFrame_kg = this.currentFuel_kg;
                this.parts.forEach(p => { if (p.type === 'engine' && p.isActive) p.isActive = (Math.random() < fuelFraction); });
            }
            let fuelToDeduct = totalFuelConsumedThisFrame_kg;
            for (let i = this.parts.length - 1; i >= 0; i--) { const part = this.parts[i]; if (part.type === 'tank' && part.currentFuel > 0) { const take = Math.min(part.currentFuel, fuelToDeduct); part.currentFuel -= take; this.currentFuel_kg -= take; this.totalMass_kg -= take; fuelToDeduct -= take; if (fuelToDeduct <= 0) break; } }
            main_playEngineSound(true, this.currentThrust_N / (this.maxThrust_N || 1));
        } else {
            main_playEngineSound(false);
        }

        if (this.currentFuel_kg <= 0) {
            this.currentFuel_kg = 0;
            simStateRef.engineActive = false; // Use passed simStateRef
            this.parts.forEach(p => { if (p.type === 'engine') p.isActive = false; });
            this.currentThrust_N = 0;
            main_playEngineSound(false);
        }

        if (this.currentThrust_N > 0 && activeEnginesThrusting) {
            const leverArm_m = this.getCoMOffset_m();
            const gimbalTorque_Nm = this.currentThrust_N * Math.sin(this.engineGimbalAngle_rad) * leverArm_m;
            netTorque_Nm -= gimbalTorque_Nm;
        }
        netTorque_Nm -= this.angularVelocity_rad_s * this.momentOfInertia_kg_m2 * 0.8;
        const angularAcceleration_rad_s2 = netTorque_Nm / this.momentOfInertia_kg_m2;
        this.angularVelocity_rad_s += angularAcceleration_rad_s2 * deltaTime_s;
        this.angularVelocity_rad_s = Math.max(-MAX_ANGULAR_VELOCITY, Math.min(MAX_ANGULAR_VELOCITY, this.angularVelocity_rad_s));
        this.angle_rad += this.angularVelocity_rad_s * deltaTime_s;

        const effectiveThrustAngle_rad = this.angle_rad + this.engineGimbalAngle_rad;
        const thrustForceX_N = this.currentThrust_N * Math.sin(effectiveThrustAngle_rad);
        const thrustForceY_N = this.currentThrust_N * Math.cos(effectiveThrustAngle_rad);

        const distanceToPlanetCenter_m = Math.sqrt(this.position_x_m ** 2 + this.position_y_m ** 2);
        this.altitudeAGL_m = distanceToPlanetCenter_m - planet.radius_m;
        let gravityForceX_N = 0, gravityForceY_N = 0;
        if (distanceToPlanetCenter_m > 1) {
            currentLocalGravityMagnitude_N = (GRAVITATIONAL_CONSTANT_G * planet.mass_kg * this.totalMass_kg) / (distanceToPlanetCenter_m ** 2);
            gravityForceX_N = -currentLocalGravityMagnitude_N * (this.position_x_m / distanceToPlanetCenter_m);
            gravityForceY_N = -currentLocalGravityMagnitude_N * (this.position_y_m / distanceToPlanetCenter_m);
        }

        let calculatedAirDensity = 0;
        let currentDragForce = 0;
        let dragForceX_N = 0, dragForceY_N = 0;
        if (this.altitudeAGL_m < EARTH_MAX_ATMOSPHERE_ALTITUDE && this.altitudeAGL_m >= 0) {
            calculatedAirDensity = EARTH_SEA_LEVEL_AIR_DENSITY * Math.exp(-this.altitudeAGL_m / EARTH_ATMOSPHERE_SCALE_HEIGHT);
            const speed_ms = Math.sqrt(this.velocity_x_ms ** 2 + this.velocity_y_ms ** 2);
            if (speed_ms > 0.01) {
                const velocityAngleToY_rad = Math.atan2(this.velocity_x_ms, this.velocity_y_ms);
                const crossSectionalArea_m2 = this.getCrossSectionalArea(velocityAngleToY_rad);
                currentDragForce = 0.5 * calculatedAirDensity * speed_ms ** 2 * DRAG_COEFFICIENT * crossSectionalArea_m2;
                dragForceX_N = -currentDragForce * (this.velocity_x_ms / speed_ms);
                dragForceY_N = -currentDragForce * (this.velocity_y_ms / speed_ms);
            }
        }

        let netForceX_N_trans = thrustForceX_N + gravityForceX_N + dragForceX_N;
        let netForceY_N_trans = thrustForceY_N + gravityForceY_N + dragForceY_N;
        simStateRef.landed = false;
        if (distanceToPlanetCenter_m <= planet.radius_m + 0.1) {
            simStateRef.landed = true;
            const overlap = planet.radius_m - distanceToPlanetCenter_m;
            const normX = this.position_x_m / distanceToPlanetCenter_m;
            const normY = this.position_y_m / distanceToPlanetCenter_m;
            this.position_x_m += normX * overlap; this.position_y_m += normY * overlap;
            this.altitudeAGL_m = 0;
            let v_radial = (this.velocity_x_ms * normX) + (this.velocity_y_ms * normY);
            if (v_radial < 0) { this.velocity_x_ms -= v_radial * normX; this.velocity_y_ms -= v_radial * normY; }
            const normalForceMagnitudeOnGround = Math.abs(currentLocalGravityMagnitude_N);
            const frictionCoefficient = 0.8; let frictionMagnitude = frictionCoefficient * normalForceMagnitudeOnGround;
            const v_tangent_world_x = this.velocity_x_ms - v_radial * normX;
            const v_tangent_world_y = this.velocity_y_ms - v_radial * normY;
            const v_tangent_speed = Math.sqrt(v_tangent_world_x ** 2 + v_tangent_world_y ** 2);
            if (v_tangent_speed > 0.01) {
                const frictionForceApplied_x = -frictionMagnitude * (v_tangent_world_x / v_tangent_speed);
                const frictionForceApplied_y = -frictionMagnitude * (v_tangent_world_y / v_tangent_speed);
                const tangental_accel_x = (thrustForceX_N + dragForceX_N) / this.totalMass_kg;
                const tangental_accel_y = (thrustForceY_N + dragForceY_N) / this.totalMass_kg;
                const tangental_force_mag = Math.sqrt(tangental_accel_x ** 2 + tangental_accel_y ** 2) * this.totalMass_kg;
                if (frictionMagnitude > tangental_force_mag && v_tangent_speed < 0.5) {
                    this.velocity_x_ms = v_radial * normX; this.velocity_y_ms = v_radial * normY;
                } else {
                    netForceX_N_trans += frictionForceApplied_x; netForceY_N_trans += frictionForceApplied_y;
                }
            }
            const angleSurfaceNormal = Math.atan2(normX, normY);
            const angleDiff = Math.atan2(Math.sin(this.angle_rad - angleSurfaceNormal), Math.cos(this.angle_rad - angleSurfaceNormal));
            if (Math.abs(angleDiff) < Math.PI / 4) { this.angularVelocity_rad_s *= 0.5; }
        }
        const accelerationX_ms2 = netForceX_N_trans / this.totalMass_kg;
        const accelerationY_ms2 = netForceY_N_trans / this.totalMass_kg;
        this.velocity_x_ms += accelerationX_ms2 * deltaTime_s;
        this.velocity_y_ms += accelerationY_ms2 * deltaTime_s;
        this.position_x_m += this.velocity_x_ms * deltaTime_s;
        this.position_y_m += this.velocity_y_ms * deltaTime_s;

        this._reassemble(); // Recalculate mass if fuel changed
        this.calculateOrbitalParameters(apoapsisRef, periapsisRef);

        if (this.currentThrust_N > 0 && activeEnginesThrusting && smokeParticlesArray.length < MAX_SMOKE_PARTICLES) {
            const smokeEmissionRate = SMOKE_PARTICLES_PER_SECOND_BASE * Math.min(1, this.currentThrust_N / (this.maxThrust_N * 0.5 || 1));
            const numParticlesToEmit = Math.max(0, Math.round(smokeEmissionRate * deltaTime_s));
            const baseExhaustVelocity = 20 + Math.random() * 10;
            const spreadAngle = Math.PI / 8;
            for (let i = 0; i < numParticlesToEmit; i++) {
                //if (smokeParticlesArray.length >= MAX_SMOKE_PARTICLES) break;
                const emitX_m = this.position_x_m; const emitY_m = this.position_y_m;
                const smokeBaseAngle_rad = effectiveThrustAngle_rad + Math.PI;
                const randomAngleOffset = (Math.random() - 0.5) * spreadAngle * 2;
                const smokeEmitAngle_rad = smokeBaseAngle_rad + randomAngleOffset;
                const particle_vx_relative = baseExhaustVelocity * Math.sin(smokeEmitAngle_rad) * SMOKE_EXHAUST_VELOCITY_FACTOR;
                const particle_vy_relative = baseExhaustVelocity * Math.cos(smokeEmitAngle_rad) * SMOKE_EXHAUST_VELOCITY_FACTOR;
                const particle_vx_world = this.velocity_x_ms + particle_vx_relative;
                const particle_vy_world = this.velocity_y_ms + particle_vy_relative;
                smokeParticlesArray.push(new SmokeParticle(emitX_m, emitY_m, particle_vx_world, particle_vy_world));
            }
            while (smokeParticlesArray.length > MAX_SMOKE_PARTICLES) {
                var OldSmokeParticle = smokeParticlesArray.pop();
                if (Math.random() > SMOKE_PERSIST_CHANCE) {
                    main_oldSmokeParticles.push(OldSmokeParticle);
                }

            }
        }
        return { currentAirDensity: calculatedAirDensity, currentDrag: currentDragForce, apoapsis: apoapsisRef.value, periapsis: periapsisRef.value };
    }
}