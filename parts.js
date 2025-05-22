// In parts.js

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
        // Default attachment nodes
        this.attachmentNodes = config.attachmentNodes || [ 
            { id: 'N', type: 'stack_top', position: { x: 0, y: 1 }, acceptedTypes: ['stack_bottom'], size: 'SML' }, // S, M, L sizes
            { id: 'S', type: 'stack_bottom', position: { x: 0, y: 0 }, acceptedTypes: ['stack_top', 'engine_top'], size: 'SML' }
        ];
    }
    get mass() { return this.dryMass_kg; }

    // Enhanced draw method to include nodes
    draw(ctx, partStackCenterX_px, spacecraftDrawBottomY_px, currentPPM, showNodes = false) { 
        const drawWidth_px = this.width_m * currentPPM; 
        const drawHeight_px = this.height_m * currentPPM; 
        const partBottomY_onCanvas_relative = spacecraftDrawBottomY_px - (this.relative_y_m * currentPPM);
        const partTopY_onCanvas_relative = partBottomY_onCanvas_relative - drawHeight_px;
        const partLeftX_onCanvas_relative = partStackCenterX_px - drawWidth_px / 2; 
        
        // --- Part Specific Drawing Logic (Moved from derived classes or enhanced here) ---
        ctx.fillStyle = this.color;
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;

        if (this.type === 'pod') {
            ctx.beginPath();
            ctx.moveTo(partLeftX_onCanvas_relative, partBottomY_onCanvas_relative);
            ctx.lineTo(partLeftX_onCanvas_relative + drawWidth_px, partBottomY_onCanvas_relative);
            ctx.lineTo(partLeftX_onCanvas_relative + drawWidth_px / 2, partTopY_onCanvas_relative);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
        } else if (this.type === 'tank') {
            const r = Math.min(drawWidth_px * 0.1, drawHeight_px * 0.1, 5 * (currentPPM / 0.5)); // Adjusted radius
            const x = partLeftX_onCanvas_relative;
            const y = partTopY_onCanvas_relative;
            ctx.beginPath();
            ctx.moveTo(x + r, y); ctx.lineTo(x + drawWidth_px - r, y); ctx.quadraticCurveTo(x + drawWidth_px, y, x + drawWidth_px, y + r);
            ctx.lineTo(x + drawWidth_px, y + drawHeight_px - r); ctx.quadraticCurveTo(x + drawWidth_px, y + drawHeight_px, x + drawWidth_px - r, y + drawHeight_px);
            ctx.lineTo(x + r, y + drawHeight_px); ctx.quadraticCurveTo(x, y + drawHeight_px, x, y + drawHeight_px - r);
            ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
            ctx.fill(); ctx.strokeStyle = '#555'; ctx.stroke();
        } else if (this.type === 'engine') {
            const housingHeight_px = drawHeight_px * 0.4;
            const nozzleHeight_px = drawHeight_px * 0.6;
            const nozzleExitWidth_px = drawWidth_px * 1.2;
            const housingTopY = partTopY_onCanvas_relative;
            const housingBottomY = housingTopY + housingHeight_px;

            ctx.fillStyle = this.color; // Engine housing color
            ctx.fillRect(partLeftX_onCanvas_relative, housingTopY, drawWidth_px, housingHeight_px);
            ctx.strokeRect(partLeftX_onCanvas_relative, housingTopY, drawWidth_px, housingHeight_px);
            
            ctx.fillStyle = '#777'; // Nozzle color
            ctx.beginPath();
            ctx.moveTo(partStackCenterX_px - drawWidth_px / 2, housingBottomY);      
            ctx.lineTo(partStackCenterX_px + drawWidth_px / 2, housingBottomY);      
            ctx.lineTo(partStackCenterX_px + nozzleExitWidth_px / 2, housingBottomY + nozzleHeight_px); 
            ctx.lineTo(partStackCenterX_px - nozzleExitWidth_px / 2, housingBottomY + nozzleHeight_px); 
            ctx.closePath();
            ctx.fill(); ctx.stroke();
        } else if (this.type === 'fairing') {
            ctx.beginPath();
            ctx.moveTo(partLeftX_onCanvas_relative, partBottomY_onCanvas_relative); 
            ctx.lineTo(partLeftX_onCanvas_relative + drawWidth_px, partBottomY_onCanvas_relative); 
            ctx.quadraticCurveTo( 
                partLeftX_onCanvas_relative + drawWidth_px, partBottomY_onCanvas_relative - drawHeight_px * 0.7, 
                partLeftX_onCanvas_relative + drawWidth_px / 2, partTopY_onCanvas_relative 
            );
            ctx.quadraticCurveTo( 
                partLeftX_onCanvas_relative, partBottomY_onCanvas_relative - drawHeight_px * 0.7, 
                partLeftX_onCanvas_relative, partBottomY_onCanvas_relative 
            );
            ctx.closePath();
            ctx.fill(); ctx.stroke();
        } else { // Default fallback: simple rectangle
             ctx.fillRect(partLeftX_onCanvas_relative, partTopY_onCanvas_relative, drawWidth_px, drawHeight_px); 
             ctx.strokeRect(partLeftX_onCanvas_relative, partTopY_onCanvas_relative, drawWidth_px, drawHeight_px); 
        }

        // --- Draw Attachment Nodes ---
        if (showNodes && this.attachmentNodes) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.lineWidth = 1;
            const nodeRadiusBase = 0.1 * currentPPM; // Base radius in meters, then scaled

            this.attachmentNodes.forEach(node => {
                // Node positions are relative to part's own coordinate system (origin at its drawn bottom-center)
                // y=0 is bottom, y=1 is top of part's height_m
                // x=0 is center, x=-0.5 is left edge, x=0.5 is right edge of part's width_m
                const nodeX_local_px = node.position.x * drawWidth_px; 
                const nodeY_local_px = (1 - node.position.y) * drawHeight_px - drawHeight_px/2; // y=1 (top) -> -h/2; y=0 (bottom) -> +h/2
                
                // Translate from partStackCenterX (center of stack) and part's bottom relative to drawing origin
                // The part itself is drawn with its bottom-center at (partStackCenterX_px, partBottomY_onCanvas_relative)
                // For nodes, we need their position relative to the part's graphical center before rotation.
                // The current transform in Spacecraft.draw already handles part's position and rotation.
                // So, node coordinates should be relative to the part's center (0,0) in its local, unrotated frame.
                // The draw function arguments partStackCenterX_px and spacecraftDrawBottomY_px are for the *entire stack*
                // We draw relative to the part's own center for nodes
                // If spacecraftDrawBottomY_px is the bottom of the current part being drawn:
                const partCenterY_onCanvas = partBottomY_onCanvas_relative - drawHeight_px / 2;
                
                const nodeScreenX = partStackCenterX_px + nodeX_local_px;
                // node.position.y=1 (top) should be at partTopY_onCanvas_relative
                // node.position.y=0 (bottom) should be at partBottomY_onCanvas_relative
                // node.position.y=0.5 (middle) should be at partCenterY_onCanvas
                const nodeScreenY = partBottomY_onCanvas_relative - (node.position.y * drawHeight_px) ;


                const nodeRadius_px = Math.max(2, nodeRadiusBase * Math.min(this.width_m, this.height_m));

                ctx.beginPath();
                ctx.arc(nodeScreenX, nodeScreenY, nodeRadius_px, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
            });
        }
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