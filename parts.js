import { COLOR_NAMES, ISP_VACUUM_DEFAULT } from './constants.js'; // Added import

// import {PIXI} from './main.js'; // Import PIXI from main.js, assuming it's globally available
// In parts.js

// Mock PIXI.Graphics for testing environment
const MockGraphics = function() {
    return {
        clear: () => MockGraphics.self,
        setStrokeStyle: () => MockGraphics.self,
        beginFill: () => MockGraphics.self,
        moveTo: () => MockGraphics.self,
        lineTo: () => MockGraphics.self,
        closePath: () => MockGraphics.self,
        rect: () => MockGraphics.self,
        roundRect: () => MockGraphics.self,
        quadraticCurveTo: () => MockGraphics.self,
        fill: () => MockGraphics.self,
        stroke: () => MockGraphics.self,
        position: { set: () => MockGraphics.self },
        addChild: () => MockGraphics.self, // Added to mock container behavior
        circle: () => MockGraphics.self, // Added for node drawing
        self: this, // To allow chaining like partGraphics.fill().stroke()
    };
};
const PIXI = { Graphics: MockGraphics }; // Replace actual PIXI.Graphics with the mock

// Helper function to parse rgba string (copied from environment.js)
function parseRgba(rgbaString) {
    if (typeof rgbaString === 'number') return { hex: rgbaString, alpha: 1 }; // Already a hex
    if (typeof COLOR_NAMES[rgbaString.toLowerCase()] != 'undefined')
    {
        return parseRgba(COLOR_NAMES[rgbaString.toLowerCase()]);
    }
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

// Modify base Part constructor for default nodes
export class Part { 
    constructor(config) { 
        this.type = config.type; 
        this.name = config.name || config.type; 
        this.dryMass_kg = config.dryMass_kg || 0; 
        this.width_m = config.width_m || 1; 
        this.height_m = config.height_m || 1; 
        this.color = config.color || 'gray'; 
        this.cost = config.cost || 0; 
        this.relative_y_m = 0; 
        this.cachedGraphics = null; // For caching graphics if needed
        // Default attachment nodes
        this.attachmentNodes = config.attachmentNodes || [ 
            { id: 'N', type: 'stack_top', position: { x: 0, y: 1 }, acceptedTypes: ['stack_bottom'], size: 'SML' }, // S, M, L sizes
            { id: 'S', type: 'stack_bottom', position: { x: 0, y: 0 }, acceptedTypes: ['stack_top', 'engine_top'], size: 'SML' }
        ];
    }
    get mass() { return this.dryMass_kg; }

    // PixiJS draw method.
    // targetTopLeftX_px, targetTopLeftY_px are the desired top-left coordinates of this part
    // within the parent `container` (which is shipGraphicsContainer, centered at CoM and rotated).
    draw(container, targetTopLeftX_px, targetTopLeftY_px, currentPPM, showNodes = false) {
        // This function is heavily reliant on PIXI. It will now use the mock.
        // For testing physics, the actual drawing isn't important.
        // We just need to ensure it doesn't crash.
        if (!container) container = new PIXI.Graphics(); // Mock container if none passed

        const drawWidth_px = this.width_m * currentPPM;
        const drawHeight_px = this.height_m * currentPPM;
        const { partGraphics } = this.graphics(currentPPM, targetTopLeftX_px, targetTopLeftY_px, drawWidth_px, drawHeight_px);
        container.addChild(partGraphics);

        // --- Draw Attachment Nodes ---
        if (showNodes && this.attachmentNodes) {
            // const nodeColor = parseRgba('rgba(255, 255, 255, 0.7)');
            // const nodeStroke = parseRgba('rgba(0, 0, 0, 0.7)');
            // const nodeRadiusBase = 0.1; // Base radius in meters

            this.attachmentNodes.forEach(node => {
                const nodeGraphics = new PIXI.Graphics(); // Uses MockGraphics
                
                // Node positions (node.position.x, node.position.y) are:
                // x: -0.5 (left edge of part) to 0.5 (right edge of part)
                // y: 0 (bottom of part) to 1 (top of part)
                // Convert these to pixel coordinates relative to the part's top-left (0,0) for partGraphics
                // const nodeLocalX_relToPartTopLeft = (node.position.x * drawWidth_px) + (drawWidth_px / 2);
                // const nodeLocalY_relToPartTopLeft = (1 - node.position.y) * drawHeight_px; // Y is inverted (1=top, 0=bottom)

                // const nodeRadius_px = Math.max(2, nodeRadiusBase * currentPPM * Math.min(this.width_m, this.height_m));

                // nodeGraphics.setStrokeStyle(1, nodeStroke.hex, nodeStroke.alpha);
               // // nodeGraphics.beginFill(nodeColor.hex, nodeColor.alpha);
                // nodeGraphics.circle(0, 0, nodeRadius_px); // Draw circle at its own (0,0)
                // nodeGraphics.fill({color:nodeColor.hex, alpha:nodeColor.alpha}); // Finalize fill
                
                // // Position node relative to the part's top-left (targetTopLeftX_px, targetTopLeftY_px)
                // nodeGraphics.position.set(targetTopLeftX_px + nodeLocalX_relToPartTopLeft, targetTopLeftY_px + nodeLocalY_relToPartTopLeft);
                container.addChild(nodeGraphics); // Add to the same container as the part (shipGraphicsContainer)
            });
        }
    }

   graphics(currentPPM, targetTopLeftX_px, targetTopLeftY_px, drawWidth_px, drawHeight_px) {
    // if (this.cachedGraphics) { // Caching might be problematic with mock
    //     return { partGraphics: this.cachedGraphics };
    // }
    const partGraphics = new PIXI.Graphics(); // Uses MockGraphics

        const mainColor = parseRgba(this.color);
        // const strokeColor = parseRgba('#000000'); // Standard stroke
        const nozzleColor = parseRgba('#777777'); // Mocked PIXI won't use these colors directly
        const tankStrokeColor = parseRgba('#555555');
        var fillColor = mainColor; // Mocked PIXI won't use these colors directly

        // All drawing commands below will now go to the MockGraphics object, which does nothing.
        partGraphics.setStrokeStyle(1, 0x000000, 1);
        //partGraphics.beginFill(mainColor.hex, mainColor.alpha);

        if (this.type === 'pod') {
            partGraphics.moveTo(0, drawHeight_px);
            partGraphics.lineTo(drawWidth_px, drawHeight_px);
            partGraphics.lineTo(drawWidth_px / 2, 0);
            partGraphics.closePath();
        } else if (this.type === 'tank') {
            const r = Math.min(drawWidth_px * 0.1, drawHeight_px * 0.1, 5 * (currentPPM / 0.5));
            partGraphics.roundRect(0, 0, drawWidth_px, drawHeight_px, r);
            partGraphics.setStrokeStyle(1, 0x555555, 1);
        } else if (this.type === 'engine') {
            const housingHeight_px = drawHeight_px * 0.4;
            const nozzleHeight_px = drawHeight_px * 0.6;
            const nozzleExitWidth_px = drawWidth_px * 1.2;

            partGraphics.rect(0, 0, drawWidth_px, housingHeight_px);
            partGraphics.fill({color:mainColor.hex, alpha:mainColor.alpha});

            fillColor = nozzleColor;
            partGraphics.moveTo(drawWidth_px / 2 - drawWidth_px / 2, housingHeight_px);
            partGraphics.lineTo(drawWidth_px / 2 + drawWidth_px / 2, housingHeight_px);
            partGraphics.lineTo(drawWidth_px / 2 + nozzleExitWidth_px / 2, housingHeight_px + nozzleHeight_px);
            partGraphics.lineTo(drawWidth_px / 2 - nozzleExitWidth_px / 2, housingHeight_px + nozzleHeight_px);
            partGraphics.closePath();
        } else if (this.type === 'fairing') {
            partGraphics.moveTo(0, drawHeight_px);
            partGraphics.lineTo(drawWidth_px, drawHeight_px);
            partGraphics.quadraticCurveTo(drawWidth_px, drawHeight_px * 0.3, drawWidth_px / 2, 0 );
            partGraphics.quadraticCurveTo(0, drawHeight_px * 0.3, 0, drawHeight_px);
            partGraphics.closePath();
        } else {
            partGraphics.rect(0, 0, drawWidth_px, drawHeight_px);
        }
        partGraphics.fill({color:fillColor.hex, alpha:fillColor.alpha});
        partGraphics.stroke({color:0x000000});

        partGraphics.position.set(targetTopLeftX_px, targetTopLeftY_px);
        // this.cachedGraphics = partGraphics; // Caching the mock might not be useful or could be problematic
        return { partGraphics };
    }
}

// Derived classes now primarily define default configs including their specific attachmentNodes
export class CommandPod extends Part { 
    constructor(config) { 
        const defaults = {type: 'pod', name:'Pod', color: '#c0c0c0', width_m: 2, height_m: 1.5, dryMass_kg: 500,
                          attachmentNodes: [
                              { id: 'bottom', type: 'stack_bottom', position: {x:0, y:0}, acceptedTypes:['stack_top'], size: 'medium' }
                              // Example radial nodes:
                              // { id: 'radial_L', type: 'radial_out', position: {x:-0.5, y:0.3}, acceptedTypes:['radial_in'], size: 'small' },
                              // { id: 'radial_R', type: 'radial_out', position: {x:0.5, y:0.3}, acceptedTypes:['radial_in'], size: 'small' }
                          ]};
        super({...defaults, ...config}); 
    } 
    // draw method is now in base Part, but can be overridden if unique shape needed beyond fillRect
}
export class FuelTank extends Part { 
    constructor(config) { 
        const defaults = {type: 'tank', name:'Tank', color: '#aabbcc', width_m: 1.8, height_m: 4, dryMass_kg: 150,
                          attachmentNodes: [
                              { id: 'top', type: 'stack_top', position: {x:0, y:1}, acceptedTypes:['stack_bottom', 'fuel_output'], size: 'medium' },
                              { id: 'bottom', type: 'stack_bottom', position: {x:0, y:0}, acceptedTypes:['stack_top', 'engine_top', 'fuel_input'], size: 'medium' },
                              { id: 'fuel_out_T', type: 'fuel_output', position: {x:0, y:1}, acceptedTypes:['fuel_input'], size:'small'}, // For surface attach fuel lines
                              { id: 'fuel_out_B', type: 'fuel_output', position: {x:0, y:0}, acceptedTypes:['fuel_input'], size:'small'}
                          ]};
        super({...defaults, ...config}); 
        this.fuelCapacity_kg = config.fuelCapacity_kg || 1000; 
        // Use currentFuel from config if provided, otherwise default to full capacity
        this.currentFuel = config.currentFuel !== undefined ? config.currentFuel : this.fuelCapacity_kg;
    } 
    get mass() { return this.dryMass_kg + this.currentFuel; }
}
export class Engine extends Part { 
    constructor(config) { 
        const defaults = {type: 'engine', name:'Engine', color: '#505050', width_m: 2.2, height_m: 2, dryMass_kg: 200,
                          attachmentNodes: [
                              { id: 'top', type: 'engine_top', position: {x:0, y:1}, acceptedTypes:['stack_bottom', 'fuel_output'], size: 'medium' },
                              { id: 'fuel_in', type: 'fuel_input', position: {x:0, y:0.8}, acceptedTypes:['fuel_output'], size:'small'} // Fuel intake node slightly below top
                          ]};
        super({...defaults, ...config}); 
        this.thrust_N = config.thrust_N || 30000; 
        this.fuelConsumptionRate_kg_s = config.fuelConsumptionRate_kg_s || 10; 
        this.isp = config.isp || ISP_VACUUM_DEFAULT; 
        this.isActive = false; 
        this.thrustLimiter = config.thrustLimiter || 1.0; 
        this.isEngineActiveByUser = true; 
    } 
    get effectiveThrust() { return this.thrust_N * this.thrustLimiter; }
}
export class Fairing extends Part { 
    constructor(config) { 
        const defaults = {type: 'fairing', name:'Fairing', color: '#e0e0e0', width_m: 2.5, height_m: 3, dryMass_kg: 100,
                          attachmentNodes: [
                            { id: 'bottom', type: 'stack_bottom', position: {x:0, y:0}, acceptedTypes:['stack_top'], size: 'medium' }
                            // Fairings typically don't have a top attachment node in the same way
                          ]};
        super({...defaults, ...config}); 
    }
}