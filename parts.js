import { ISP_VACUUM_DEFAULT } from './constants.js';

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
        this.attachmentNodes = config.attachmentNodes || [ 
            { id: 'top', type: 'stack_top', position: { x: 0, y: 1 }, acceptedTypes: ['stack_bottom'], size: 'medium' }, 
            { id: 'bottom', type: 'stack_bottom', position: { x: 0, y: 0 }, acceptedTypes: ['stack_top', 'engine_top'], size: 'medium' }
        ];
    }
    get mass() { return this.dryMass_kg; }
    draw(ctx, partStackCenterX_px, spacecraftDrawBottomY_px, currentPPM) { 
        const drawWidth_px = this.width_m * currentPPM; 
        const drawHeight_px = this.height_m * currentPPM; 
        const partBottomY_onCanvas_relative = spacecraftDrawBottomY_px - (this.relative_y_m * currentPPM);
        const partTopY_onCanvas_relative = partBottomY_onCanvas_relative - drawHeight_px;
        const partLeftX_onCanvas_relative = partStackCenterX_px - drawWidth_px / 2; 
        
        ctx.fillStyle = this.color; 
        ctx.fillRect(partLeftX_onCanvas_relative, partTopY_onCanvas_relative, drawWidth_px, drawHeight_px); 
        ctx.strokeStyle = 'black'; 
        ctx.strokeRect(partLeftX_onCanvas_relative, partTopY_onCanvas_relative, drawWidth_px, drawHeight_px); 
    }
}

export class CommandPod extends Part { 
    constructor(config) { 
        const defaults = {type: 'pod', name:'Pod', color: '#c0c0c0', width_m: 2, height_m: 1.5, dryMass_kg: 500,
                          attachmentNodes: [{ id: 'bottom', type: 'stack_bottom', position: {x:0, y:0}, acceptedTypes:['stack_top'], size: 'medium' }]};
        super({...defaults, ...config}); 
    } 
    draw(ctx, partStackCenterX_px, spacecraftDrawBottomY_px, currentPPM) {
        const drawWidth_px = this.width_m * currentPPM; 
        const drawHeight_px = this.height_m * currentPPM; 
        const partBottomY_onCanvas_relative = spacecraftDrawBottomY_px - (this.relative_y_m * currentPPM);
        const partTopY_onCanvas_relative = partBottomY_onCanvas_relative - drawHeight_px;
        const partLeftX_onCanvas_relative = partStackCenterX_px - drawWidth_px / 2; 

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(partLeftX_onCanvas_relative, partBottomY_onCanvas_relative);
        ctx.lineTo(partLeftX_onCanvas_relative + drawWidth_px, partBottomY_onCanvas_relative);
        ctx.lineTo(partLeftX_onCanvas_relative + drawWidth_px / 2, partTopY_onCanvas_relative);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'black'; ctx.stroke();
    }
}

export class FuelTank extends Part { 
    constructor(config) { 
        const defaults = {type: 'tank', name:'Tank', color: '#aabbcc', width_m: 1.8, height_m: 4, dryMass_kg: 150,
                          attachmentNodes: [
                              { id: 'top', type: 'stack_top', position: {x:0, y:1}, acceptedTypes:['stack_bottom'], size: 'medium' },
                              { id: 'bottom', type: 'stack_bottom', position: {x:0, y:0}, acceptedTypes:['stack_top', 'engine_top'], size: 'medium' }
                          ]};
        super({...defaults, ...config}); 
        this.fuelCapacity_kg = config.fuelCapacity_kg || 1000; 
        this.currentFuel = this.fuelCapacity_kg; 
    } 
    get mass() { return this.dryMass_kg + this.currentFuel; }
    draw(ctx, partStackCenterX_px, spacecraftDrawBottomY_px, currentPPM) { 
        const r = Math.min(this.width_m * currentPPM * 0.2, this.height_m * currentPPM * 0.2, 10); 
        const x = partStackCenterX_px - (this.width_m * currentPPM) / 2;
        const y = spacecraftDrawBottomY_px - (this.relative_y_m * currentPPM) - (this.height_m * currentPPM);
        const w = this.width_m * currentPPM;
        const h = this.height_m * currentPPM;

        ctx.beginPath();
        ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fillStyle = this.color; ctx.fill();
        ctx.strokeStyle = '#555'; ctx.stroke();
    }
}

export class Engine extends Part { 
    constructor(config) { 
        const defaults = {type: 'engine', name:'Engine', color: '#505050', width_m: 2.2, height_m: 2, dryMass_kg: 200,
                          attachmentNodes: [{ id: 'top', type: 'engine_top', position: {x:0, y:1}, acceptedTypes:['stack_bottom'], size: 'medium' }]};
        super({...defaults, ...config}); 
        this.thrust_N = config.thrust_N || 30000; 
        this.fuelConsumptionRate_kg_s = config.fuelConsumptionRate_kg_s || 10; 
        this.isp = config.isp || ISP_VACUUM_DEFAULT; 
        this.isActive = false; 
        this.thrustLimiter = config.thrustLimiter || 1.0; 
        this.isEngineActiveByUser = true; 
    } 
    get effectiveThrust() { return this.thrust_N * this.thrustLimiter; }
    draw(ctx, partStackCenterX_px, spacecraftDrawBottomY_px, currentPPM) {
        const baseWidth_px = this.width_m * currentPPM; 
        const housingHeight_px = this.height_m * 0.4 * currentPPM;
        const nozzleHeight_px = this.height_m * 0.6 * currentPPM;
        const nozzleExitWidth_px = baseWidth_px * 1.2; 

        const partBottomY_onCanvas_relative = spacecraftDrawBottomY_px - (this.relative_y_m * currentPPM);
        const housingTopY = partBottomY_onCanvas_relative - this.height_m * currentPPM;
        const housingBottomY = housingTopY + housingHeight_px;
        const housingLeftX = partStackCenterX_px - baseWidth_px / 2;

        ctx.fillStyle = this.color;
        ctx.fillRect(housingLeftX, housingTopY, baseWidth_px, housingHeight_px);
        ctx.strokeStyle = 'black'; ctx.strokeRect(housingLeftX, housingTopY, baseWidth_px, housingHeight_px);
        
        ctx.fillStyle = '#777';
        ctx.beginPath();
        ctx.moveTo(partStackCenterX_px - baseWidth_px / 2, housingBottomY);      
        ctx.lineTo(partStackCenterX_px + baseWidth_px / 2, housingBottomY);      
        ctx.lineTo(partStackCenterX_px + nozzleExitWidth_px / 2, housingBottomY + nozzleHeight_px); 
        ctx.lineTo(partStackCenterX_px - nozzleExitWidth_px / 2, housingBottomY + nozzleHeight_px); 
        ctx.closePath();
        ctx.fill(); ctx.stroke();
    }
}

export class Fairing extends Part { 
    constructor(config) { 
        const defaults = {type: 'fairing', name:'Fairing', color: '#e0e0e0', width_m: 2.5, height_m: 3, dryMass_kg: 100,
                          attachmentNodes: [{ id: 'bottom', type: 'stack_bottom', position: {x:0, y:0}, acceptedTypes:['stack_top'], size: 'medium' }]};
        super({...defaults, ...config}); 
    }
    draw(ctx, partStackCenterX_px, spacecraftDrawBottomY_px, currentPPM) {
        const drawWidth_px = this.width_m * currentPPM; 
        const drawHeight_px = this.height_m * currentPPM; 
        const partBottomY_onCanvas_relative = spacecraftDrawBottomY_px - (this.relative_y_m * currentPPM);
        const partTopY_onCanvas_relative = partBottomY_onCanvas_relative - drawHeight_px;
        const partLeftX_onCanvas_relative = partStackCenterX_px - drawWidth_px / 2; 

        ctx.fillStyle = this.color;
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
        ctx.fill();
        ctx.strokeStyle = 'black'; ctx.stroke();
    }
}