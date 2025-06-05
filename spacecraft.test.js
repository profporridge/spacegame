// spacecraft.test.js
import assert from 'assert';
import { Spacecraft, initializeSpacecraftAndParts } from './spacecraft.js';
import * as C_original from './constants.js'; // Use ES6 import for named exports

// Create a mutable copy of constants for tests to modify
// C_original is already imported as an object holding all named exports.
let C = JSON.parse(JSON.stringify(C_original));

let testsRun = 0;
let testsPassed = 0;
let allTestsPassed = true;

// Mock dependencies for initializeSpacecraftAndParts & Spacecraft constructor
const mockPlayEngineSound = () => {};
const mockPlayGimbalSound = () => {};

// Helper to create a test spacecraft instance
function createTestSpacecraft(partsConfig) {
    const sc = new Spacecraft(partsConfig);
    // Initialize with mocks. These would normally be set up in main.js
    // Pass a simplified mock simulationState, smokeParticles array etc.
    // The air density variable is passed as a direct value, not an object.
    initializeSpacecraftAndParts(
        mockPlayEngineSound,
        mockPlayGimbalSound,
        { engineActive: false, landed: true }, // mock simState
        [], // mock smokeParticles
        [], // mock oldSmokeParticles
        C.EARTH_SEA_LEVEL_AIR_DENSITY, // mock currentAirDensityValue
        C // Pass the mutable constants object
    );
    return sc;
}

const defaultPartsConfig = [
    { type: 'pod', name:'Test Pod', dryMass_kg: 800, width_m: 2.5, height_m: 2, color: 'blue' },
    { type: 'tank', name:'Test Tank', fuelCapacity_kg: 1000, dryMass_kg: 100, width_m: 1, height_m: 2, currentFuel: 1000, color: 'red' },
    // Ensure engine has positive thrust and is active for testing thrust calculations
    { type: 'engine', name:'Test Engine', thrust_N: 1000, effectiveThrust: 1000, fuelConsumptionRate_kg_s: 1, dryMass_kg: 200, width_m: 1, height_m: 1, isp: 300, thrustLimiter: 1, isEngineActiveByUser: true, isActive: true, color: 'green'}
];

function runTest(testName, testFunction) {
    testsRun++;
    try {
        // Reset mutable constants before each test
        C = JSON.parse(JSON.stringify(C_original));
        testFunction();
        testsPassed++;
        console.log(`[PASS] ${testName}`);
    } catch (error) {
        console.error(`[FAIL] ${testName}`);
        console.error(error);
        allTestsPassed = false;
    }
}

console.log("Running Spacecraft Tests...");

runTest("Thrust Vector Calculation Test", () => {
    const R = C.EARTH_RADIUS_M;
    const testPositions = [
        { x: 0, y: R, name: "Top" },
        { x: 0, y: -R, name: "Bottom" },
        { x: R, y: 0, name: "Right" },
        { x: -R, y: 0, name: "Left" },
        { x: R / Math.sqrt(2), y: R / Math.sqrt(2), name: "Top-Right Diagonal" },
        { x: R / Math.sqrt(2), y: -R / Math.sqrt(2), name: "Bottom-Right Diagonal" },
    ];

    // Store original gravity to restore it later
    const originalGravity = C.GRAVITATIONAL_CONSTANT_G;
    C.GRAVITATIONAL_CONSTANT_G = 0; // Disable gravity for this test to isolate thrust

    testPositions.forEach(pos => {
        const spacecraft = createTestSpacecraft(JSON.parse(JSON.stringify(defaultPartsConfig))); // Use deep copy of parts

        spacecraft.position_x_m = pos.x;
        spacecraft.position_y_m = pos.y;
        spacecraft.velocity_x_ms = 0;
        spacecraft.velocity_y_ms = 0;

        // Orient spacecraft to point radially outward ("up" from planet center)
        // The angle_rad in spacecraft.js is CCW from +Y axis.
        // atan2(x,y) gives angle CCW from +X axis if y is first arg, or from +Y if x is first arg.
        // Standard atan2(y,x) -> angle from +X. We need angle from +Y.
        // If (px, py) is position, vector is (px, py). Angle from +Y is atan2(px, py).
        spacecraft.angle_rad = Math.atan2(pos.x, pos.y);
        spacecraft.engineGimbalAngle_rad = 0;

        // Ensure fuel and mass are positive, find the engine to get its thrust
        let configuredThrust = 0;
        spacecraft.parts.forEach(p => {
            if (p.type === 'engine') configuredThrust = p.effectiveThrust;
            if (p.type === 'tank') p.currentFuel = p.fuelCapacity_kg; // Ensure full tank
        });
        spacecraft._reassemble(); // Recalculate mass, etc.

        assert(configuredThrust > 0, `Engine thrust should be positive for ${pos.name}`);
        assert(spacecraft.currentFuel_kg > 0, `Fuel should be positive for ${pos.name}`);
        assert(spacecraft.totalMass_kg > 0, `Mass should be positive for ${pos.name}`);

        const deltaTime_s = 0.016;
        const mockApoapsisRef = { value: 0 };
        const mockPeriapsisRef = { value: 0 };
        const mockSmokeArray = [];
        // Mock simState passed to updatePhysics
        const mockSimStateRef = { landed: false, engineActive: true, soundMuted: true, timeElapsed: 0, lastTimestamp:0, cameraX_m:0, cameraY_m:0, currentPixelsPerMeter:0.05, controlFlags: {rotateLeft: false, rotateRight: false} };


        // Call updatePhysics: (deltaTime_s, masterEngineCommandActive, gimbalLeft, gimbalRight, currentAirDensity, apoapsisRef, periapsisRef, smokeParticlesArray, simStateRef)
        // masterEngineCommandActive = true, no gimbal, zero air density
        spacecraft.updatePhysics(deltaTime_s, true, false, false, 0, mockApoapsisRef, mockPeriapsisRef, mockSmokeArray, mockSimStateRef);

        // After updatePhysics, spacecraft.currentThrust_N should be set based on active engines
        const actualThrustMagnitude = spacecraft.currentThrust_N;
        assert.strictEqual(actualThrustMagnitude, configuredThrust, `Actual thrust magnitude mismatch for ${pos.name}. Expected ${configuredThrust}, got ${actualThrustMagnitude}`);

        // Calculate actual thrust components from change in velocity
        // accel = delta_v / delta_t. force = mass * accel.
        const derivedThrustX = (spacecraft.velocity_x_ms / deltaTime_s) * spacecraft.totalMass_kg;
        const derivedThrustY = (spacecraft.velocity_y_ms / deltaTime_s) * spacecraft.totalMass_kg;

        // Expected thrust components based on orientation and magnitude
        // Thrust angle is spacecraft.angle_rad (since gimbal is 0)
        // Thrust vector components: (Magnitude * sin(angle_from_+Y), Magnitude * cos(angle_from_+Y))
        const expectedThrustX = actualThrustMagnitude * Math.sin(spacecraft.angle_rad);
        const expectedThrustY = actualThrustMagnitude * Math.cos(spacecraft.angle_rad);

        const tolerance = 0.01; // Tolerance for floating point comparisons
        assert.ok(Math.abs(derivedThrustX - expectedThrustX) < tolerance,
            `Thrust X component mismatch for ${pos.name}. Expected: ${expectedThrustX.toFixed(2)}, Got: ${derivedThrustX.toFixed(2)}`);
        assert.ok(Math.abs(derivedThrustY - expectedThrustY) < tolerance,
            `Thrust Y component mismatch for ${pos.name}. Expected: ${expectedThrustY.toFixed(2)}, Got: ${derivedThrustY.toFixed(2)}`);

        // Verify thrust is opposite to where gravity *would* act (radially outward)
        const distToCenter = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
        if (distToCenter > 0) { // Avoid division by zero if at center (not a test case here)
            const expectedGravityOppositeDirX = pos.x / distToCenter;
            const expectedGravityOppositeDirY = pos.y / distToCenter;

            const thrustDirX = derivedThrustX / actualThrustMagnitude;
            const thrustDirY = derivedThrustY / actualThrustMagnitude;

            assert.ok(Math.abs(thrustDirX - expectedGravityOppositeDirX) < 0.001,
                `Thrust direction X not radially outward for ${pos.name}. Expected dir: ${expectedGravityOppositeDirX.toFixed(3)}, Got dir: ${thrustDirX.toFixed(3)}`);
            assert.ok(Math.abs(thrustDirY - expectedGravityOppositeDirY) < 0.001,
                `Thrust direction Y not radially outward for ${pos.name}. Expected dir: ${expectedGravityOppositeDirY.toFixed(3)}, Got dir: ${thrustDirY.toFixed(3)}`);
        }
    });

    C.GRAVITATIONAL_CONSTANT_G = originalGravity; // Restore gravity
});


// Summary
process.on('exit', (code) => {
    if (code === 0 || code === undefined || (testsRun > 0 && code ===1 && !allTestsPassed) ) {
        console.log(`
Finished running tests.`);
        console.log(`Total tests: ${testsRun}`);
        console.log(`Passed: ${testsPassed}`);
        console.log(`Failed: ${testsRun - testsPassed}`);
        if (testsRun > 0 && !allTestsPassed && code !== 1) {
            process.exit(1);
        }
    }
});

// Basic export for now, can be expanded
export { C, runTest, assert };
