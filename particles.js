import * as PIXI from 'pixi.js';

// Particle system for flame and smoke effects
export class EngineParticleSystem {
    constructor(container, texture, options = {}) {
        this.container = container;
        this.texture = texture;
        this.particles = [];
        this.maxParticles = options.maxParticles || 100;
        this.emissionRate = options.emissionRate || 10; // particles per second
        this.lifetime = options.lifetime || 1.0; // seconds
        this.speed = options.speed || 50; // pixels per second
        this.speedVariation = options.speedVariation || 0.5;
        this.scale = options.scale || 1.0;
        this.scaleVariation = options.scaleVariation || 0.3;
        this.alpha = options.alpha || 1.0;
        this.alphaVariation = options.alphaVariation || 0.2;
        this.rotation = options.rotation || 0;
        this.rotationVariation = options.rotationVariation || Math.PI;
        this.gravity = options.gravity || { x: 0, y: 0 };
        this.drag = options.drag || 0.98;
        this.isActive = false;
        this.emissionTimer = 0;
        
        // Create particle container for better performance
        this.particleContainer = new PIXI.ParticleContainer({
            dynamicProperties: {
              position: true, // default
              scale: true,
              rotation: true,
              color: false,
            },
          });
        this.container.addChild(this.particleContainer);
    }

    start() {
        this.isActive = true;
    }

    stop() {
        this.isActive = false;
    }

    emit(x, y, angle = 0) {
        if (!this.isActive) return;

        // Create new particle
        const particle = new PIXI.Particle(this.texture);
        
        // Set initial properties
        particle.x = x;
        particle.y = y;
      //  particle.anchor.set(0.5);
        
        // Randomize properties
        const speed = this.speed * (1 + (Math.random() - 0.5) * this.speedVariation);
        const angleVariation = (Math.random() - 0.5) * 0.5; // ±0.25 radians
        const finalAngle = angle + angleVariation;
        
        particle.vx = Math.sin(finalAngle) * speed;
        particle.vy = Math.cos(finalAngle) * speed;
        
        particle.scaleX = this.scale * (1 + (Math.random() - 0.5) * this.scaleVariation)
        
        
        particle.alpha = this.alpha * (1 + (Math.random() - 0.5) * this.alphaVariation);
        particle.rotation = this.rotation + (Math.random() - 0.5) * this.rotationVariation;
        
        particle.life = this.lifetime;
        particle.maxLife = this.lifetime;
        
        // Add to container and particle list
        this.particleContainer.addParticle(particle);
        this.particles.push(particle);
        
        // Remove old particles if we exceed max
       while (this.particles.length > this.maxParticles) {
            const oldParticle = this.particles.shift();

            if (oldParticle) {
                this.particleContainer.removeParticle(oldParticle);
                
                //oldParticle.destroy();
            }
        }
    }

    update(deltaTime) {
        if (!this.isActive) return;

        // Update emission timer
        this.emissionTimer += deltaTime;
        const emissionInterval = 1.0 / this.emissionRate;
        
        // Emit particles based on rate
        while (this.emissionTimer >= emissionInterval) {
            this.emit(0, 0, Math.PI); // Emit from origin, adjust position in main update
            this.emissionTimer -= emissionInterval;
        }

        // Update existing particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            
            // Update life
            particle.life -= deltaTime;
            
            if (particle.life <= 0) {
                // Remove dead particle
                this.particles.splice(i, 1);
                if (particle) {
                    this.particleContainer.removeParticle(particle);
                }
                continue;
            }

            // Update position
            particle.x += particle.vx * deltaTime;
            particle.y += particle.vy * deltaTime;
            
            // Apply gravity
            particle.vx += this.gravity.x * deltaTime;
            particle.vy += this.gravity.y * deltaTime;
            
            // Apply drag
            particle.vx *= this.drag;
            particle.vy *= this.drag;
            
            // Update alpha based on life
            const lifeRatio = particle.life / particle.maxLife;
            particle.alpha = this.alpha * lifeRatio;
            
            // Update scale based on life (optional)
            const scaleRatio = 0.5 + 0.5 * lifeRatio;
            particle.scaleX *= scaleRatio;
            particle.scaleY *= scaleRatio;
        }
    }

    destroy() {
        this.stop();
        this.particleContainer.particleChildren.length = 0;
        this.particleContainer.update();
        this.particles = [];
        if (this.particleContainer.parent) {
            this.particleContainer.parent.removeChild(this.particleContainer);
            this.particleContainer.destroy();
        }
    }
}

// Create flame particle system
export function createFlameParticleSystem(container, flameTexture) {
    return new EngineParticleSystem(container, flameTexture, {
        maxParticles: 50,
        emissionRate: 20,
        lifetime: 0.8,
        speed: 30,
        speedVariation: 0.8,
        scale: 0.8,
        scaleVariation: 0.4,
        alpha: 0.9,
        alphaVariation: 0.3,
        rotation: 0,
        rotationVariation: Math.PI * 2,
        gravity: { x: 0, y: 20 },
        drag: 0.95
    });
}

// Create smoke particle system
export function createSmokeParticleSystem(container, smokeTexture) {
    return new EngineParticleSystem(container, smokeTexture, {
        maxParticles: 100,
        emissionRate: 15,
        lifetime: 12.0,
        speed: -50,
        speedVariation: 0.6,
        scale: 0.2,
        scaleVariation: 0.5,
        alpha: 1,
        alphaVariation: 0.4,
        rotation: 0,
        rotationVariation: Math.PI * 4,
        gravity: { x: 0, y: -10 },
        drag: 0.98
    });
} 