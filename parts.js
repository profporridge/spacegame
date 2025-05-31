import { COLOR_NAMES, ISP_VACUUM_DEFAULT } from './constants.js'; // Added import

// In parts.js

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
        const drawWidth_px = this.width_m * currentPPM;
        const drawHeight_px = this.height_m * currentPPM;
        const { partGraphics } = this.graphics(currentPPM, targetTopLeftX_px, targetTopLeftY_px, drawWidth_px, drawHeight_px);
        container.addChild(partGraphics);

        // --- Draw Attachment Nodes ---
        if (showNodes && this.attachmentNodes) {
            const nodeColor = parseRgba('rgba(255, 255, 255, 0.7)');
            const nodeStroke = parseRgba('rgba(0, 0, 0, 0.7)');
            const nodeRadiusBase = 0.1; // Base radius in meters

            this.attachmentNodes.forEach(node => {
                const nodeGraphics = new PIXI.Graphics();
                
                // Node positions (node.position.x, node.position.y) are:
                // x: -0.5 (left edge of part) to 0.5 (right edge of part)
                // y: 0 (bottom of part) to 1 (top of part)
                // Convert these to pixel coordinates relative to the part's top-left (0,0) for partGraphics
                const nodeLocalX_relToPartTopLeft = (node.position.x * drawWidth_px) + (drawWidth_px / 2);
                const nodeLocalY_relToPartTopLeft = (1 - node.position.y) * drawHeight_px; // Y is inverted (1=top, 0=bottom)

                const nodeRadius_px = Math.max(2, nodeRadiusBase * currentPPM * Math.min(this.width_m, this.height_m));

                nodeGraphics.lineStyle(1, nodeStroke.hex, nodeStroke.alpha);
                nodeGraphics.beginFill(nodeColor.hex, nodeColor.alpha);
                nodeGraphics.drawCircle(0, 0, nodeRadius_px); // Draw circle at its own (0,0)
                nodeGraphics.endFill();
                
                // Position node relative to the part's top-left (targetTopLeftX_px, targetTopLeftY_px)
                nodeGraphics.position.set(targetTopLeftX_px + nodeLocalX_relToPartTopLeft, targetTopLeftY_px + nodeLocalY_relToPartTopLeft);
                container.addChild(nodeGraphics); // Add to the same container as the part (shipGraphicsContainer)
            });
        }
    }

   graphics(currentPPM, targetTopLeftX_px, targetTopLeftY_px, drawWidth_px, drawHeight_px) {
    if (this.cachedGraphics) {
        // If cached graphics exist, return them directly
        return { partGraphics: this.cachedGraphics };
    }    
    const partGraphics = new PIXI.Graphics();



        const mainColor = parseRgba(this.color);
        const strokeColor = parseRgba('#000000'); // Standard stroke
        const nozzleColor = parseRgba('#777777');
        const tankStrokeColor = parseRgba('#555555');

        partGraphics.lineStyle(1, strokeColor.hex, strokeColor.alpha);
        partGraphics.beginFill(mainColor.hex, mainColor.alpha);

        if (this.type === 'pod') {
            // Draw pod shape (triangle) relative to (0,0) of partGraphics
            partGraphics.moveTo(0, drawHeight_px); // Bottom-left
            partGraphics.lineTo(drawWidth_px, drawHeight_px); // Bottom-right
            partGraphics.lineTo(drawWidth_px / 2, 0); // Top-center
            partGraphics.closePath();
        } else if (this.type === 'tank') {
            const r = Math.min(drawWidth_px * 0.1, drawHeight_px * 0.1, 5 * (currentPPM / 0.5));
            // For roundedRect, x,y is top-left corner
            partGraphics.drawRoundedRect(0, 0, drawWidth_px, drawHeight_px, r);
            // Overwrite linestyle for tank outline
            partGraphics.lineStyle(1, tankStrokeColor.hex, tankStrokeColor.alpha);
        } else if (this.type === 'engine') {
            const housingHeight_px = drawHeight_px * 0.4;
            const nozzleHeight_px = drawHeight_px * 0.6;
            const nozzleExitWidth_px = drawWidth_px * 1.2; // Wider than base


            // Housing (drawn from 0,0 of partGraphics)
            partGraphics.drawRect(0, 0, drawWidth_px, housingHeight_px);
            partGraphics.endFill(); // End housing fill


            // Nozzle (drawn relative to 0,0 of partGraphics)
            partGraphics.beginFill(nozzleColor.hex, nozzleColor.alpha);
            partGraphics.lineStyle(1, strokeColor.hex, strokeColor.alpha); // Reset stroke for nozzle
            partGraphics.moveTo(drawWidth_px / 2 - drawWidth_px / 2, housingHeight_px); // Top-left of nozzle base
            partGraphics.lineTo(drawWidth_px / 2 + drawWidth_px / 2, housingHeight_px); // Top-right of nozzle base
            partGraphics.lineTo(drawWidth_px / 2 + nozzleExitWidth_px / 2, housingHeight_px + nozzleHeight_px); // Bottom-right of nozzle exit
            partGraphics.lineTo(drawWidth_px / 2 - nozzleExitWidth_px / 2, housingHeight_px + nozzleHeight_px); // Bottom-left of nozzle exit
            partGraphics.closePath();
        } else if (this.type === 'fairing') {
            // Fairings are typically wider at base, tapering to top
            partGraphics.moveTo(0, drawHeight_px); // Bottom-left
            partGraphics.lineTo(drawWidth_px, drawHeight_px); // Bottom-right
            partGraphics.quadraticCurveTo(
                drawWidth_px, drawHeight_px * 0.3, // Control point right
                drawWidth_px / 2, 0 // Top-center
            );
            partGraphics.quadraticCurveTo(
                0, drawHeight_px * 0.3, // Control point left
                0, drawHeight_px // Back to Bottom-left (effectively)
            );
            partGraphics.closePath();
        } else { // Default fallback: simple rectangle
            partGraphics.drawRect(0, 0, drawWidth_px, drawHeight_px);
        }
        partGraphics.endFill(); // Must be called to finalize fill and stroke for current path


        // Position the partGraphics object within its parent container
        partGraphics.position.set(targetTopLeftX_px, targetTopLeftY_px);
        this.cachedGraphics = partGraphics; // Cache the graphics object for future use
        return { partGraphics};
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
        this.currentFuel = this.fuelCapacity_kg; 
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