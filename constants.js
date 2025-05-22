export const GRAVITATIONAL_CONSTANT_G = 6.67430e-11;
export const TIME_SCALE = 1; 
export const EARTH_MASS_KG = 5.972e24; 
export const EARTH_RADIUS_M = 6371000; 
export const EARTH_SEA_LEVEL_AIR_DENSITY = 1.225; 
export const EARTH_ATMOSPHERE_SCALE_HEIGHT = 8500; 
export const EARTH_MAX_ATMOSPHERE_ALTITUDE = 100000;
export const DRAG_COEFFICIENT = 0.5; 
export const MAX_ANGULAR_VELOCITY = Math.PI / 2; 
export const BASE_REACTION_WHEEL_TORQUE = 5000; 
export const MAX_GIMBAL_ANGLE_DEG = 7; 
export const GIMBAL_RATE_DEG_S = 15;   
export const SKY_BLUE_COLOR = { r: 135, g: 206, b: 235 }; 
export const SPACE_BLACK_COLOR = { r: 0, g: 0, b: 16 };
export const MIN_CLOUD_ALTITUDE_M = 5000;  
export const MAX_CLOUD_ALTITUDE_M = 12000; 
export const NUM_CLOUD_LAYERS = 3;         
export const CLOUDS_PER_LAYER = 25;        
export const CLOUD_PARALLAX_FACTOR_MIN = 0.2; 
export const CLOUD_PARALLAX_FACTOR_MAX = 0.8; 
export const CLOUD_BASE_SIZE_MIN = 30000;   
export const CLOUD_BASE_SIZE_MAX = 60000;
export const NUM_SURFACE_FEATURES = 200; 
export const MAX_MOUNTAIN_HEIGHT_M = 1500; 
export const MAX_TREE_HEIGHT_M = 30;
export const SURFACE_FEATURE_VISIBILITY_PPM = 0.2; 
export const ORBIT_PATH_VISIBILITY_ALTITUDE_M = 50000; 
export const ORBIT_PATH_VISIBILITY_PPM = 0.001;       
export const ORBIT_PATH_SEGMENTS = 100;
export const SPACECRAFT_INDICATOR_PPM_THRESHOLD = 0.0005; 
export const INSET_VIEW_PPM_THRESHOLD = 0.002;         
export const INSET_VIEW_TARGET_SIZE_PX = 80; 
export const SMOKE_PARTICLES_PER_SECOND_BASE = 40; // Increased
export const SMOKE_LIFETIME_S_MIN = 70;        
export const SMOKE_LIFETIME_S_MAX = 180;       
export const SMOKE_INITIAL_SIZE_M_MIN = 15;    
export const SMOKE_INITIAL_SIZE_M_MAX = 30;
export const SMOKE_EXHAUST_VELOCITY_FACTOR = 0.25; 
export const MAX_SMOKE_PARTICLES = 500;         
export const ISP_VACUUM_DEFAULT = 300;

export const planet = { 
    mass_kg: EARTH_MASS_KG, radius_m: EARTH_RADIUS_M, color: '#3A8D3A', 
    atmosphereColor: 'rgba(173, 216, 230, 0.15)', 
    maxAtmosphereRadius_m: EARTH_RADIUS_M + EARTH_MAX_ATMOSPHERE_ALTITUDE
};