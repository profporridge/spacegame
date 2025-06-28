import * as OriginalConstants from './constants.js'; // Import all for default CurrentConstants and fallbacks

import { SmokeParticle } from './smoke.js';
import { CommandPod, FuelTank, Engine, Fairing } from './parts.js'; // To instantiate parts
import { PIXI } from './main.js';
// Module-level variable to hold the constants object to be used
let CurrentConstants = OriginalConstants;


// These will be set by main.js
let main_playEngineSound = () => { };
let main_playGimbalSound = () => { };
let main_simulationState = {};
let main_smokeParticles = [];
let main_oldSmokeParticles = [];
let main_initSimulation = async () => { };

export function initializeSpacecraftAndParts(playEngineSoundFunc, playGimbalSoundFunc, simState, smokeArray, oldSmokeArray, airDensityVar, constantsToUse, initSimFunc) {
    main_playEngineSound = playEngineSoundFunc;
    main_playGimbalSound = playGimbalSoundFunc;
    main_simulationState = simState;
    main_smokeParticles = smokeArray;
    main_oldSmokeParticles = oldSmokeArray;
    main_initSimulation = initSimFunc;
    if (constantsToUse) {
        CurrentConstants = constantsToUse;
    } else {
        CurrentConstants = OriginalConstants;
    }
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
    // Private fields for core properties
    #_position_x_m = 0;
    #_position_y_m = 0;
    #_velocity_x_ms = 0;
    #_velocity_y_ms = 0;
    #_angle_rad = 0;
    #_angularVelocity_rad_s = 0;
    #_engineGimbalAngle_rad = 0;

    constructor(partsConfigArray) {
        this.dirty = true;
        this.comDirty = true;
        this.partsConfigArray = partsConfigArray;
        this.parts = [];
        this.globalPosition = {x:0, y:0};
        // Initialize protected properties through setters
        this.position_x_m = 0;
        this.position_y_m = 0;
        this.velocity_x_ms = 0;
        this.velocity_y_ms = 0;
        this.angle_rad = 3 * Math.PI/2;
        this.angularVelocity_rad_s = 0;
        this.totalMass_kg = 0;
        this.currentFuel_kg = 0;
        this.currentThrust_N = 0;
        this.maxThrust_N = 0;
        this.logicalStackHeight_m = 0;
        this.maxWidth_m = 0;
        this.momentOfInertia_kg_m2 = 1000;
        this.altitudeAGL_m = 0;
        this.engineGimbalAngle_rad = 0;
        this.maxGimbalAngle_rad = CurrentConstants.MAX_GIMBAL_ANGLE_DEG * Math.PI / 180;
        this.gimbalRate_rad_s = CurrentConstants.GIMBAL_RATE_DEG_S * Math.PI / 180;
        this.initialFuel_kg = 0;
        this.cachedGraphics = null;
        this.specificImpulse_s = 0;
        this.deltaV_ms = 0;
        this.isLanded = false;
        this.hasCrashed = false;
        this.comOffset_m = 0;
        this.mainContainerRef = {};
        this.viewportRef = {};

        if (partsConfigArray && Array.isArray(partsConfigArray)) {
            if (partsConfigArray !== this.partsConfigArray) {
                this.dirty = true;
                this.comDirty = true;
            }
            this.partsConfigArray = partsConfigArray;
            partsConfigArray.forEach(partConfig => {
                let partInstance;
                switch (partConfig.type) {
                    case 'pod': partInstance = new CommandPod(partConfig); break;
                    case 'tank': partInstance = new FuelTank(partConfig); break;
                    case 'engine': partInstance = new Engine(partConfig); break;
                    case 'fairing': partInstance = new Fairing(partConfig); break;
                    default: console.error("Unknown part type in constructor:", partConfig.type); return;
                }
                if (partInstance) this.parts.push(partInstance);
            });
        } else {
            this.partsConfigArray = [];
        }
        this._reassemble();
    }

    // Protected getters and setters for core properties
    get position_x_m() { return this.#_position_x_m; }
    set position_x_m(value) {
        if (isNaN(value)) {
            console.warn("Attempted to set position_x_m to NaN, resetting to 0");
            this.#_position_x_m = 0;
        } else {
            this.#_position_x_m = value;
        }
    }

    get position_y_m() { return this.#_position_y_m; }
    set position_y_m(value) {
        if (isNaN(value)) {
            console.warn("Attempted to set position_y_m to NaN, resetting to 0");
            this.#_position_y_m = 0;
        } else {
            this.#_position_y_m = value;
        }
    }

    get velocity_x_ms() { return this.#_velocity_x_ms; }
    set velocity_x_ms(value) {
        if (isNaN(value)) {
            console.warn("Attempted to set velocity_x_ms to NaN, resetting to 0");
            this.#_velocity_x_ms = 0;
        } else {
            this.#_velocity_x_ms = value;
        }
    }

    get velocity_y_ms() { return this.#_velocity_y_ms; }
    set velocity_y_ms(value) {
        if (isNaN(value)) {
            console.warn("Attempted to set velocity_y_ms to NaN, resetting to 0");
            this.#_velocity_y_ms = 0;
        } else {
            this.#_velocity_y_ms = value;
        }
    }

    get angle_rad() { return this.#_angle_rad; }
    set angle_rad(value) {
        if (isNaN(value)) {
            console.warn("Attempted to set angle_rad to NaN, resetting to 0");
            this.#_angle_rad = 0;
        } else {
            this.#_angle_rad = value;
        }
    }

    get angularVelocity_rad_s() { return this.#_angularVelocity_rad_s; }
    set angularVelocity_rad_s(value) {
        if (isNaN(value)) {
            console.warn("Attempted to set angularVelocity_rad_s to NaN, resetting to 0");
            this.#_angularVelocity_rad_s = 0;
        } else {
            this.#_angularVelocity_rad_s = value;
        }
    }

    get engineGimbalAngle_rad() { return this.#_engineGimbalAngle_rad; }
    set engineGimbalAngle_rad(value) {
        if (isNaN(value)) {
            console.warn("Attempted to set engineGimbalAngle_rad to NaN, resetting to 0");
            this.#_engineGimbalAngle_rad = 0;
        } else {
            this.#_engineGimbalAngle_rad = value;
        }
    }

    // Getter methods based on test expectations
    getTotalMass_kg() {
        // Ensure _reassemble has been called recently if parts or fuel can change outside updatePhysics
        // For now, assumes totalMass_kg is kept up-to-date by constructor and updatePhysics
        return this.totalMass_kg;
    }

    getDryMass_kg() {
        return this.parts.reduce((sum, part) => sum + part.dryMass_kg, 0);
    }

    getActiveEngines() {
        return this.parts.filter(part => part.type === 'engine' && part.isActive);
    }

    getTotalThrust_N() {
        // This should reflect the current thrust being applied, calculated in updatePhysics
        return this.currentThrust_N;
    }

    getTotalFuelConsumptionRate_kg_s() {
        return this.getActiveEngines().reduce((sum, engine) => sum + (engine.fuelConsumptionRate_kg_s * engine.thrustLimiter), 0);
    }

    getMomentOfInertia_kg_m2() {
        return this.momentOfInertia_kg_m2;
    }
    // End of Getter methods

    _reassemble() {
        // This method is called by the constructor and updatePhysics.
        // It might be okay if parts are not fully initialized for non-drawing tests,
        // but we need to ensure this.parts exists.
        this.parts = this.parts || []; // Ensure this.parts is initialized

        this.totalMass_kg = 0; let tempCurrentFuel = 0; this.maxThrust_N = 0;
        this.logicalStackHeight_m = 0; this.maxWidth_m = 0;
        let currentStackOffset_m = 0; this.initialFuel_kg = 0;
        this.specificImpulse_s = 0;
        let totalEngineCount = 0;
        
        this.parts.forEach(p => {
            p.relative_y_m = currentStackOffset_m;
            currentStackOffset_m += p.height_m;
            this.totalMass_kg += p.mass;
            if (p.type === 'tank') {
                tempCurrentFuel += p.currentFuel;
                this.initialFuel_kg += p.fuelCapacity_kg;
            }
            if (p.type === 'engine') {
                this.maxThrust_N += p.effectiveThrust;
                this.specificImpulse_s += p.isp || 0;
                totalEngineCount++;
            }
            if (p.width_m > this.maxWidth_m) this.maxWidth_m = p.width_m;
        });
        
        // Calculate average specific impulse if there are engines
        if (totalEngineCount > 0) {
            this.specificImpulse_s /= totalEngineCount;
        }
        this.currentFuel_kg = tempCurrentFuel;
        // Calculate delta-v using Tsiolkovsky equation
        const dryMass = this.totalMass_kg - this.currentFuel_kg;
        if (dryMass > 0 && this.specificImpulse_s > 0) {
            this.deltaV_ms = this.specificImpulse_s * 9.81 * Math.log(this.totalMass_kg / dryMass);
        } else {
            this.deltaV_ms = 0;
        }
        
        
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
        if (!this.comDirty) return this.comOffset_m;
        let weightedHeightSum = 0;
        this.parts.forEach(p => {
            const partCenterY = p.relative_y_m + p.height_m / 2;
            weightedHeightSum += p.mass * partCenterY;
        });
        this.comOffset_m = weightedHeightSum / this.totalMass_kg;
        this.comDirty = false;
        return this.comOffset_m;
    }
    calculateOrbitalParameters(apoapsisVar, periapsisVar) {
        if (this.totalMass_kg <= 0) {
            apoapsisVar.value = 0;
            periapsisVar.value = 0;
            return;
        }
        const r_vec_x = this.position_x_m; const r_vec_y = this.position_y_m;
        const v_vec_x = this.velocity_x_ms; const v_vec_y = this.velocity_y_ms;
        const r_mag = Math.sqrt(r_vec_x ** 2 + r_vec_y ** 2);
        const v_mag_sq = v_vec_x ** 2 + v_vec_y ** 2;

        const G = CurrentConstants.GRAVITATIONAL_CONSTANT_G;
        const planetMass = CurrentConstants.EARTH_MASS_KG;
        const planetRadius = CurrentConstants.EARTH_RADIUS_M;
        const mu = G * planetMass;

        const specificOrbitalEnergy = v_mag_sq / 2 - mu / r_mag;

        if (specificOrbitalEnergy >= -1e-3) {
            apoapsisVar.value = Infinity;
            const h_vec_z = r_vec_x * v_vec_y - r_vec_y * v_vec_x;
            if (mu > 0 && (1 + 2 * specificOrbitalEnergy * h_vec_z ** 2 / mu ** 2) >= 0) {
                periapsisVar.value = (h_vec_z ** 2 / mu) / (1 + Math.sqrt(1 + 2 * specificOrbitalEnergy * h_vec_z ** 2 / mu ** 2)) - planetRadius;
            } else {
                periapsisVar.value = this.altitudeAGL_m;
            }
        } else {
            const semiMajorAxis_a = -mu / (2 * specificOrbitalEnergy);
            const h_vec_z = r_vec_x * v_vec_y - r_vec_y * v_vec_x;
            const eccentricity_e_sq = 1 + (2 * specificOrbitalEnergy * h_vec_z ** 2) / (mu ** 2);
            const eccentricity_e = Math.sqrt(Math.max(0, eccentricity_e_sq));
            apoapsisVar.value = semiMajorAxis_a * (1 + eccentricity_e) - planetRadius;
            periapsisVar.value = semiMajorAxis_a * (1 - eccentricity_e) - planetRadius;
        }
        if (isNaN(apoapsisVar.value) || (apoapsisVar.value < periapsisVar.value && apoapsisVar.value !== Infinity)) {
            apoapsisVar.value = this.altitudeAGL_m > periapsisVar.value ? this.altitudeAGL_m : periapsisVar.value;
            if (apoapsisVar.value < periapsisVar.value && periapsisVar.value !== Infinity) apoapsisVar.value = periapsisVar.value;
        }
        if (isNaN(periapsisVar.value)) periapsisVar.value = this.altitudeAGL_m;
    }

      resetToPostionOnSurface(angleInRadians, observer = null){
       // this.position_x_m =((this.logicalStackHeight_m / 2 )+ CurrentConstants.EARTH_RADIUS_M ) * Math.sin(angleInRadians);
       // this.position_y_m = ((-this.logicalStackHeight_m / 2) - CurrentConstants.EARTH_RADIUS_M ) * Math.cos(angleInRadians);
        //this.position_y_m = 25 * Math.sin(angleInRadians) + 54 * Math.cos(angleInRadians);
        //this.position_x_m = 54 * Math.sin(angleInRadians) + 25 * Math.cos(angleInRadians);
        
        this.angle_rad = angleInRadians;// + Math.PI; // Align spacecraft with surface
        this.velocity_x_ms = 0; this.velocity_y_ms = 0;
        this.altitudeAGL_m = 50;
        this.isLanded = true;
        this.hasCrashed = false;
        this.currentThrust_N = 0;
        //this.currentFuel_kg = 0;
        this.engineGimbalAngle_rad = 0;
        this.refuel();
        this._reassemble();
        return new PIXI.ObservablePoint(observer, this.position_x_m, this.position_y_m);
    }

    refuel(){
        this.currentFuel_kg = this.initialFuel_kg;
    }

    graphics(){var graphics = [];
        this.parts.forEach(part => {
            const drawWidth_px = part.width_m ;
            const drawHeight_px = part.height_m ;

            // Calculate part's top-left position relative to CoM (origin of shipGraphicsContainer)
            // CoM is (0,0) in shipGraphicsContainer.
            // part.relative_y_m is bottom of part from stack bottom (Y-up model).
            // part_top_from_com_m is part's top edge distance from CoM (Y-up model).
            const part_top_from_com_m = (part.relative_y_m + part.height_m) - this.getCoMOffset_m();

            // Convert to Pixi's coordinate system (Y-down) for local positions within shipGraphicsContainer
            const partTopLeftX_local = -drawWidth_px / 2; // Centered
            const partTopLeftY_local = -part_top_from_com_m ; // Y positive downwards

            graphics.push(part.graphics(1, partTopLeftX_local, partTopLeftY_local, part.width_m , part.height_m )); // Show nodes if not inset}
        });
        return graphics;
    }

    draw(passedSpacecraftContainer, width = null, height = null, screenX = null, screenY = null, currentPPM = 1, viewType = "main") {
        //var currentPPM = 1;

        var spacecraftContainer = passedSpacecraftContainer.getChildByLabel("spacecraftContainer");
        if (!spacecraftContainer) {
            spacecraftContainer = new PIXI.Container();
            spacecraftContainer.label = "spacecraftContainer";
            passedSpacecraftContainer.addChildAt(spacecraftContainer, 0);
        }
    
        var shipGraphicsContainer = passedSpacecraftContainer.getChildByLabel(CurrentConstants.SPACECRAFT_GRAPHICS_CONTAINER);
        if (shipGraphicsContainer && this.dirty) {shipGraphicsContainer.removeChildren();shipGraphicsContainer.destroy(); }
        if (!shipGraphicsContainer || this.dirty) {
            shipGraphicsContainer = new PIXI.Container();
            shipGraphicsContainer.label = CurrentConstants.SPACECRAFT_GRAPHICS_CONTAINER;
            spacecraftContainer.addChildAt(shipGraphicsContainer, 0);
            this.dirty = false;

            

            const comOffset_m = this.getCoMOffset_m(); // Distance from stack bottom to CoM (Y-up)

            this.parts.forEach(part => {
                const drawWidth_px = part.width_m * currentPPM;
                const drawHeight_px = part.height_m * currentPPM;

                // Calculate part's top-left position relative to CoM (origin of shipGraphicsContainer)
                // CoM is (0,0) in shipGraphicsContainer.
                // part.relative_y_m is bottom of part from stack bottom (Y-up model).
                // part_top_from_com_m is part's top edge distance from CoM (Y-up model).
                const part_top_from_com_m = (part.relative_y_m * currentPPM + drawHeight_px) - this.getCoMOffset_m();

                // Convert to Pixi's coordinate system (Y-down) for local positions within shipGraphicsContainer
                const partTopLeftX_local = -drawWidth_px / 2; // Centered
                const partTopLeftY_local = -part_top_from_com_m ; // Y positive downwards

                part.draw(shipGraphicsContainer, partTopLeftX_local, partTopLeftY_local, currentPPM, viewType == "staging"); // Show nodes if not inset
            });
            shipGraphicsContainer.pivot.set(0, (this.logicalStackHeight_m));//- this.getCoMOffset_m())*currentPPM);
        }
        
        shipGraphicsContainer.getChildByLabel('Flame')?.destroy(); // Remove previous flame graphics if any
        if (this.currentThrust_N > 0 && !isStagingView) {
            this.parts.forEach(p => {
                if (p.type === 'engine' && p.isActive) {

                    const flameGraphics = new PIXI.Graphics();

                    // Engine's nozzle (bottom of engine part) position relative to CoM
                    // p.relative_y_m is bottom of engine from stack bottom (Y-up model)
                    const engineNozzle_y_from_com_m = p.relative_y_m - this.getCoMOffset_m;
                    // Convert to Pixi's Y-down, relative to CoM (shipGraphicsContainer origin)
                    const engineNozzle_y_local_px = -engineNozzle_y_from_com_m * currentPPM;

                    const flameHeight_px = (10 + Math.random() * 15 + (this.currentThrust_N / (this.maxThrust_N || 1)) * 20) * Math.max(0.1, currentPPM / 0.2);
                    const flameWidth_px = p.width_m * currentPPM * 0.8;

                    flameGraphics.position.set(0, engineNozzle_y_local_px); // X is centered at CoM's X, Y is nozzle's Y
                    flameGraphics.rotation = this.engineGimbalAngle_rad;

                    const orange = parseRgba(OriginalConstants.COLOR_NAMES['orange']);
                    flameGraphics.beginFill(orange.hex, orange.alpha);
                    flameGraphics.moveTo(-flameWidth_px / 2, 0); // Relative to flameGraphics origin (nozzle center)
                    flameGraphics.lineTo(flameWidth_px / 2, 0);
                    flameGraphics.lineTo(0, flameHeight_px); // Flame points "down" (positive Y in its local rotated frame)
                    flameGraphics.closePath();
                    flameGraphics.endFill();

                    const yellow = parseRgba(OriginalConstants.COLOR_NAMES['yellow']);
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
   
    
       
        if (viewType == "main") 
             {// spacecraftContainer.pivot.set(this.maxWidth_m/2, - this.logicalStackHeight_m);
       spacecraftContainer.position.set(this.position_x_m/2 ,   this.position_y_m);
     //  shipGraphicsContainer.rotation = 180;
            this.mainContainerRef = shipGraphicsContainer;
            shipGraphicsContainer.setSize(width, height);
        }
        if (viewType == "staging") spacecraftContainer.position.set(100,350);

        shipGraphicsContainer.rotation = this.angle_rad;
        //   this.cachedGraphics = shipGraphicsContainer.children;
        // passedSpacecraftContainer.addChild(shipGraphicsContainer);
     
    }

    updatePhysics(deltaTime_s, masterEngineCommandActive, gimbalLeft, gimbalRight, currentAirDensity, apoapsisRef, periapsisRef, smokeParticlesArray, simStateRef, positionRef) {
        // Declare acceleration variables at the top of the function scope
        let accelerationX_ms2 = 0;
        let accelerationY_ms2 = 0;
if (!main_simulationState.isLaunched){return;}
        // Sanity checks for NaN values
        if (isNaN(this.position_x_m) || isNaN(this.position_y_m)) {
            throw new Error("Position became NaN, resetting to origin");

        }
        if (isNaN(this.velocity_x_ms) || isNaN(this.velocity_y_ms)) {
           throw new Error("Velocity became NaN, resetting to zero");

        }
        if (isNaN(this.angle_rad)) {
            console.warn("Angle became NaN, resetting to zero");
            this.angle_rad = 0;
        }
        if (isNaN(this.angularVelocity_rad_s)) {
            console.warn("Angular velocity became NaN, resetting to zero");
            this.angularVelocity_rad_s = 0;
            return 
        }

        // Ensure deltaTime is valid
        if (isNaN(deltaTime_s) || deltaTime_s <= 0) {
            console.warn("Invalid deltaTime, skipping physics update");
            return { currentAirDensity, apoapsis: apoapsisRef.value, periapsis: periapsisRef.value };
        }

        // Ensure parts are initialized for physics calculations, even if drawing is skipped
        if (!this.parts || this.parts.length === 0 && this.partsConfigArray && this.partsConfigArray.length > 0) {
            console.warn("Spacecraft parts not initialized or empty before physics update. Attempting to initialize from partsConfigArray.");
            this.parts = [];
            if (this.partsConfigArray && Array.isArray(this.partsConfigArray)) {
                this.partsConfigArray.forEach(partConfig => {
                    let partInstance;
                    switch (partConfig.type) {
                        case 'pod': partInstance = new CommandPod(partConfig); break;
                        case 'tank': partInstance = new FuelTank(partConfig); break;
                        case 'engine': partInstance = new Engine(partConfig); break;
                        case 'fairing': partInstance = new Fairing(partConfig); break;
                        default: console.error("Unknown part type during physics fallback init:", partConfig.type); return;
                    }
                    if (partInstance) this.parts.push(partInstance);
                });
                this._reassemble();
            } else {
                console.error("partsConfigArray is missing or invalid, cannot initialize parts for physics.");
                return { currentAirDensity, apoapsis: apoapsisRef.value, periapsis: periapsisRef.value };
            }
        }

        if (this.totalMass_kg <= 0 && this.currentFuel_kg <= 0) {
            if (this.parts.reduce((acc, p) => acc + p.mass, 0) === 0 && this.currentFuel_kg === 0) {
                return { currentAirDensity, apoapsis: apoapsisRef.value, periapsis: periapsisRef.value };
            }
        }

        // Calculate forces and update physics
        let currentLocalGravityMagnitude_N = 0;
        let targetGimbalAngle_rad = 0;
        if (gimbalLeft) { targetGimbalAngle_rad = -this.maxGimbalAngle_rad; main_playGimbalSound(); }
        else if (gimbalRight) { targetGimbalAngle_rad = this.maxGimbalAngle_rad; main_playGimbalSound(); }

        // Safeguard gimbal angle
        if (isNaN(this.engineGimbalAngle_rad)) {
            this.engineGimbalAngle_rad = 0;
        }

        if (this.engineGimbalAngle_rad < targetGimbalAngle_rad) { 
            this.engineGimbalAngle_rad = Math.min(targetGimbalAngle_rad, this.engineGimbalAngle_rad + this.gimbalRate_rad_s * deltaTime_s); 
        }
        else if (this.engineGimbalAngle_rad > targetGimbalAngle_rad) { 
            this.engineGimbalAngle_rad = Math.max(targetGimbalAngle_rad, this.engineGimbalAngle_rad - this.gimbalRate_rad_s * deltaTime_s); 
        }

        // Calculate net torque with safeguards
        let netTorque_Nm = 0;
        const baseReactionWheelTorque = CurrentConstants.BASE_REACTION_WHEEL_TORQUE;
        if (gimbalLeft && !masterEngineCommandActive) netTorque_Nm -= baseReactionWheelTorque;
        if (gimbalRight && !masterEngineCommandActive) netTorque_Nm += baseReactionWheelTorque;

        // Calculate thrust and fuel consumption with safeguards
        this.currentThrust_N = 0;
        let totalFuelConsumedThisFrame_kg = 0;
        let activeEnginesThrusting = false;
        this.currentThrust_N = 0; // Reset thrust before recalculating
        this.parts.forEach(p => {
            if (p.type === 'engine') {
                p.isActive = false;
                if (masterEngineCommandActive && p.isEngineActiveByUser && this.currentFuel_kg > 0) {
                    p.isActive = true;
                    const engineActualThrust = p.effectiveThrust;
                    this.currentThrust_N += engineActualThrust;
                    
                    // Calculate fuel consumption based on specific impulse
                    const massFlowRate = engineActualThrust / (p.isp * 9.81); // Use standard gravitational acceleration (9.81 m/s²) instead of G
                    totalFuelConsumedThisFrame_kg += massFlowRate * p.thrustLimiter * deltaTime_s;
                    activeEnginesThrusting = true;
                }
            }
        });

        simStateRef.engineActive = activeEnginesThrusting; // Set based on whether any engine is thrusting

        if (activeEnginesThrusting) {
            if (totalFuelConsumedThisFrame_kg > this.currentFuel_kg) {
                const fuelFraction = this.currentFuel_kg / totalFuelConsumedThisFrame_kg;
                this.currentThrust_N *= fuelFraction;
                totalFuelConsumedThisFrame_kg = this.currentFuel_kg;
                // this.parts.forEach(p => { if (p.type === 'engine' && p.isActive) p.isActive = (Math.random() < fuelFraction); });
            } else {
                let fuelToDeduct = totalFuelConsumedThisFrame_kg;
                for (let i = this.parts.length - 1; i >= 0; i--) {
                    const part = this.parts[i];
                    if (part.type === 'tank' && part.currentFuel > 0) {
                        const take = Math.min(part.currentFuel, fuelToDeduct);
                        part.currentFuel -= take;
                        this.currentFuel_kg -= take;
                        this.totalMass_kg -= take;
                        fuelToDeduct -= take;
                        if (fuelToDeduct <= 0) break;
                    }
                }
            }
            main_playEngineSound(true, this.currentThrust_N / (this.maxThrust_N || 1));
        }
     else {
    main_playEngineSound(false);
    // If no engines are thrusting, ensure simStateRef.engineActive is false, even if it was true before fuel check
    simStateRef.engineActive = false;
}

if (this.currentFuel_kg <= 0) {
    this.currentFuel_kg = 0;
    // simStateRef.engineActive is already false if fuel ran out this frame or was already false.
    // If it became false due to fuel out, ensure all engines are marked inactive.
    if (activeEnginesThrusting) { // Only if engines were trying to be active
        this.parts.forEach(p => { if (p.type === 'engine') p.isActive = false; });
        this.currentThrust_N = 0; // No thrust if no fuel
        simStateRef.engineActive = false; // Explicitly set again
    }
    main_playEngineSound(false);
}

if (this.currentThrust_N > 0 && activeEnginesThrusting) { // This condition is fine
    const leverArm_m = this.getCoMOffset_m();
    const gimbalTorque_Nm = this.currentThrust_N * Math.sin(this.engineGimbalAngle_rad) * leverArm_m;
    netTorque_Nm -= gimbalTorque_Nm;
}
netTorque_Nm -= this.angularVelocity_rad_s * this.momentOfInertia_kg_m2 * 0.8;
const angularAcceleration_rad_s2 = netTorque_Nm / this.momentOfInertia_kg_m2;
this.angularVelocity_rad_s += angularAcceleration_rad_s2 * deltaTime_s;
this.angularVelocity_rad_s = Math.max(-CurrentConstants.MAX_ANGULAR_VELOCITY, Math.min(CurrentConstants.MAX_ANGULAR_VELOCITY, this.angularVelocity_rad_s));
this.angle_rad += this.angularVelocity_rad_s * deltaTime_s;

const effectiveThrustAngle_rad = this.angle_rad + this.engineGimbalAngle_rad;
const thrustForceX_N = this.currentThrust_N * Math.sin(effectiveThrustAngle_rad);
const thrustForceY_N = -1 * this.currentThrust_N * Math.cos(effectiveThrustAngle_rad);

let gp = this.viewportRef.toWorld(this.mainContainerRef.getGlobalPosition());
const distanceToPlanetCenter_m = Math.sqrt(gp.x ** 2 + gp.y ** 2);
this.altitudeAGL_m = distanceToPlanetCenter_m - CurrentConstants.EARTH_RADIUS_M;
let gravityForceX_N = 0, gravityForceY_N = 0;
if (distanceToPlanetCenter_m > 1 && distanceToPlanetCenter_m < 1e12 && CurrentConstants.GRAVITATIONAL_CONSTANT_G > 0) {
    currentLocalGravityMagnitude_N = (CurrentConstants.GRAVITATIONAL_CONSTANT_G * CurrentConstants.planet.mass_kg * this.totalMass_kg) / (distanceToPlanetCenter_m ** 2);
    
    var gravityDirection = Math.atan2(this.position_y_m, this.position_x_m);
    gravityForceX_N = currentLocalGravityMagnitude_N * Math.sin(gravityDirection);
    gravityForceY_N = currentLocalGravityMagnitude_N *Math.cos(gravityDirection);
    console.info(`Local gravity is ${currentLocalGravityMagnitude_N}, (${gravityForceX_N}, ${gravityForceY_N})`);
}

let calculatedAirDensity = 0;
let currentDragForce = 0;
let dragForceX_N = 0, dragForceY_N = 0;
if (this.altitudeAGL_m < CurrentConstants.EARTH_MAX_ATMOSPHERE_ALTITUDE && this.altitudeAGL_m >= 0 && currentAirDensity > 0) {
    calculatedAirDensity = currentAirDensity;
    const speed_ms = Math.sqrt(this.velocity_x_ms ** 2 + this.velocity_y_ms ** 2);
    if (speed_ms > 0.01) {
        const velocityAngleToY_rad = Math.atan2(this.velocity_x_ms, this.velocity_y_ms);
        const crossSectionalArea_m2 = this.getCrossSectionalArea(velocityAngleToY_rad);
        currentDragForce = 0.5 * calculatedAirDensity * speed_ms ** 2 * CurrentConstants.DRAG_COEFFICIENT * crossSectionalArea_m2;
        dragForceX_N = -currentDragForce * (this.velocity_x_ms / speed_ms);
        dragForceY_N = -currentDragForce * (this.velocity_y_ms / speed_ms);
    }
}

let netForceX_N_trans = thrustForceX_N + gravityForceX_N + dragForceX_N;
let netForceY_N_trans = thrustForceY_N + gravityForceY_N + dragForceY_N;

simStateRef.landed = false; // Reset landing state for this frame
// this.hasCrashed is persistent once true, unless explicitly reset by game logic elsewhere
// simStateRef.crashed = this.hasCrashed; // Reflect current crash state if needed by caller immediately

if (distanceToPlanetCenter_m <= CurrentConstants.EARTH_RADIUS_M + 0.2 && !this.hasCrashed) { // Use CurrentConstants
    const normX = gp.x / distanceToPlanetCenter_m;
    const normY = gp.y / distanceToPlanetCenter_m;
    let v_radial = (this.velocity_x_ms * normX) + (this.velocity_y_ms * normY);

    // Crash detection (impact speed too high)
    const maxSafeLandingSpeed = CurrentConstants.LANDING_GEAR_MAX_ABSORPTION_SPEED_M_S || 5.0;
    if (Math.abs(v_radial) > maxSafeLandingSpeed) {
        this.hasCrashed = true;
        simStateRef.crashed = true;
        simStateRef.landed = false; // Not a successful landing
        // Potentially apply damage, stop further physics updates for crashed state, etc.
        // For now, just set flags and stop motion.
        this.velocity_x_ms = 0;
        this.velocity_y_ms = 0;
        this.angularVelocity_rad_s = 0;
    } else {
        // Successful landing or gentle contact
        simStateRef.landed = true;
        const overlap = CurrentConstants.planet.radius_m - distanceToPlanetCenter_m; // Use CurrentConstants
        this.position_x_m += normX * overlap;
        this.position_y_m += normY * overlap;
        this.altitudeAGL_m = 0;

        // Stop radial velocity (impact absorption)
        if (v_radial < 0) { // Moving towards the ground
            this.velocity_x_ms -= v_radial * normX;
            this.velocity_y_ms -= v_radial * normY;
        }
        v_radial = 0; // Now radial velocity is zeroed due to contact

        const normalForceMagnitudeOnGround = Math.abs(currentLocalGravityMagnitude_N);
        const frictionCoefficient = 0.8;
        let frictionMagnitude = frictionCoefficient * normalForceMagnitudeOnGround;
        // Tangential velocity for friction (already relative to ground normal)
        const v_tangent_world_x = this.velocity_x_ms; // Since radial part was removed
        const v_tangent_world_y = this.velocity_y_ms;
        const v_tangent_speed = Math.sqrt(v_tangent_world_x ** 2 + v_tangent_world_y ** 2);

        if (v_tangent_speed > 0.01) {
            const frictionDirX = -v_tangent_world_x / v_tangent_speed;
            const frictionDirY = -v_tangent_world_y / v_tangent_speed;

            // Static friction check: can existing forces overcome static friction?
            // Project translational forces onto tangent plane
            const transForceTangentX = netForceX_N_trans - (netForceX_N_trans * normX) * normX; // Simplified, assumes norm is unit
            const transForceTangentY = netForceY_N_trans - (netForceY_N_trans * normY) * normY;
            const transForceTangentMag = Math.sqrt(transForceTangentX ** 2 + transForceTangentY ** 2);

            if (frictionMagnitude >= transForceTangentMag && v_tangent_speed < 0.5) { // Static friction holds
                this.velocity_x_ms = 0;
                this.velocity_y_ms = 0;
                // Also remove tangential part of netForce so it doesn't accumulate
                netForceX_N_trans = (netForceX_N_trans * normX) * normX; // Keep only normal component
                netForceY_N_trans = (netForceY_N_trans * normY) * normY;
            } else { // Kinetic friction
                netForceX_N_trans += frictionDirX * frictionMagnitude;
                netForceY_N_trans += frictionDirY * frictionMagnitude;
            }
        } else { // Very low tangent speed, full static friction effectively stops tangential motion
            this.velocity_x_ms = 0;
            this.velocity_y_ms = 0;
        }
        // Attenuate angular velocity on stable landing
        const angleSurfaceNormal = Math.atan2(normX, normY);
        const angleDiff = Math.atan2(Math.sin(this.angle_rad - angleSurfaceNormal), Math.cos(this.angle_rad - angleSurfaceNormal));
        if (Math.abs(angleDiff) < Math.PI / 4) { // If relatively aligned with surface normal
            this.angularVelocity_rad_s *= 0.5;
            if (Math.abs(this.angularVelocity_rad_s) < 0.01) this.angularVelocity_rad_s = 0;
        }
    }
} // End of landing/crash block

if (this.hasCrashed) { // If crashed, no further physics updates for motion
    this.velocity_x_ms = 0;
    this.velocity_y_ms = 0;
    this.angularVelocity_rad_s = 0;
    this.currentThrust_N = 0;
    simStateRef.engineActive = false;
    this.parts.forEach(p => { if (p.type === 'engine') p.isActive = false; });
    // Keep position as is, or on surface if it penetrated slightly
    if (distanceToPlanetCenter_m < CurrentConstants.planet.radius_m) { // Use CurrentConstants
        const normX = this.position_x_m / distanceToPlanetCenter_m;
        const normY = this.position_y_m / distanceToPlanetCenter_m;
        this.position_x_m = normX * CurrentConstants.planet.radius_m; // Use CurrentConstants
        this.position_y_m = normY * CurrentConstants.planet.radius_m; // Use CurrentConstants
    }

    // Show crash modal
    const crashModal = document.getElementById('crashModal');
    if (crashModal) {
        crashModal.style.display = 'flex';

        // Add event listeners for modal buttons
        const restartButton = document.getElementById('restartButton');
        const designButton = document.getElementById('designButton');

        if (restartButton) {
            restartButton.onclick = async () => {
                crashModal.style.display = 'none';
                await main_initSimulation('template');
            };
        }

        if (designButton) {
            designButton.onclick = async () => {
                crashModal.style.display = 'none';
                await main_initSimulation('staging');
            };
        }
    }
}

// Ensure acceleration variables are assigned based on whether crashed or not
if (this.hasCrashed) {
    accelerationX_ms2 = 0;
    accelerationY_ms2 = 0;
} else {
    if (this.totalMass_kg > 0) {
        accelerationX_ms2 = netForceX_N_trans / this.totalMass_kg;
        accelerationY_ms2 = netForceY_N_trans / this.totalMass_kg;
    } else { // Avoid division by zero if mass is somehow zero
        accelerationX_ms2 = 0;
        accelerationY_ms2 = 0;
    }
}
this.velocity_x_ms += accelerationX_ms2 * deltaTime_s;
this.velocity_y_ms += accelerationY_ms2 * deltaTime_s;
//this.position_x_m += this.velocity_x_ms * deltaTime_s;
//this.position_y_m += this.velocity_y_ms * deltaTime_s;
this.mainContainerRef._position.x += this.velocity_x_ms * deltaTime_s;
this.mainContainerRef._position.y += this.velocity_y_ms * deltaTime_s;
this.mainContainerRef.rotation = this.angle_rad;
this._reassemble(); // Recalculate mass if fuel changed
this.calculateOrbitalParameters(apoapsisRef, periapsisRef);

// Use CurrentConstants for smoke particle related constants
const smokeParticlesPerSecond = CurrentConstants.SMOKE_PARTICLES_PER_SECOND_BASE;
const maxSmokeParticles = CurrentConstants.MAX_SMOKE_PARTICLES;
const smokeExhaustVelocityFactor = CurrentConstants.SMOKE_EXHAUST_VELOCITY_FACTOR;
const smokePersistChance = CurrentConstants.SMOKE_PERSIST_CHANCE;

if (this.currentThrust_N > 0 && activeEnginesThrusting && smokeParticlesArray.length < maxSmokeParticles) {
    const smokeEmissionRate = smokeParticlesPerSecond * Math.min(1, this.currentThrust_N / (this.maxThrust_N * 0.5 || 1));
    const numParticlesToEmit = Math.max(0, Math.round(smokeEmissionRate * deltaTime_s));
    const baseExhaustVelocity = 20 + Math.random() * 10;
    const spreadAngle = Math.PI / 8;
    for (let i = 0; i < numParticlesToEmit; i++) {
        //if (smokeParticlesArray.length >= MAX_SMOKE_PARTICLES) break;
        const emitX_m = this.position_x_m; const emitY_m = this.position_y_m;
        const smokeBaseAngle_rad = effectiveThrustAngle_rad + Math.PI;
        const randomAngleOffset = (Math.random() - 0.5) * spreadAngle * 2;
        const smokeEmitAngle_rad = smokeBaseAngle_rad + randomAngleOffset;
        const particle_vx_relative = baseExhaustVelocity * Math.sin(smokeEmitAngle_rad) * smokeExhaustVelocityFactor; // Use local const
        const particle_vy_relative = baseExhaustVelocity * Math.cos(smokeEmitAngle_rad) * smokeExhaustVelocityFactor; // Use local const
        const particle_vx_world = this.velocity_x_ms + particle_vx_relative;
        const particle_vy_world = this.velocity_y_ms + particle_vy_relative;
        smokeParticlesArray.push(new SmokeParticle(emitX_m, emitY_m, particle_vx_world, particle_vy_world));
    }
    while (smokeParticlesArray.length > maxSmokeParticles) { // Use local const
        var OldSmokeParticle = smokeParticlesArray.pop();
        if (Math.random() > smokePersistChance) {  // Use local const
            main_oldSmokeParticles.push(OldSmokeParticle);
        }

    }
}
return { currentAirDensity: calculatedAirDensity, currentDrag: currentDragForce, apoapsis: apoapsisRef.value, periapsis: periapsisRef.value };
    }
}