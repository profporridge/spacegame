export const GRAVITATIONAL_CONSTANT_G = 6.67430e-11;
export const TIME_SCALE = 1; 
export const EARTH_MASS_KG = 5.972e24; 
export const EARTH_RADIUS_M = 6371000; 
export const EARTH_SEA_LEVEL_AIR_DENSITY = 1.225; 
export const EARTH_ATMOSPHERE_SCALE_HEIGHT = 8500; 
export const EARTH_MAX_ATMOSPHERE_ALTITUDE = 30000; // in reality this is supposed to be around 100 km, but we use a smaller value for gameplay purposes
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
export const INSET_VIEW_PPM_THRESHOLD = 2;         
export const INSET_VIEW_TARGET_SIZE_PX = 80; 
export const SMOKE_PARTICLES_PER_SECOND_BASE = 90; // Increased
export const SMOKE_LIFETIME_S_MIN = 70;        
export const SMOKE_LIFETIME_S_MAX = 380;       
export const SMOKE_INITIAL_SIZE_M_MIN = 1;    
export const SMOKE_INITIAL_SIZE_M_MAX = 8;
export const SMOKE_EXHAUST_VELOCITY_FACTOR = 0.25; 
export const MAX_SMOKE_PARTICLES = 50; 
export const MAX_OLD_SMOKE_PARTICLES = 10;        
export const SMOKE_PERSIST_CHANCE = 0.07;
export const ISP_VACUUM_DEFAULT = 300;
export const LANDING_GEAR_MAX_ABSORPTION_SPEED_M_S = 5.0; // Max safe landing speed in m/s
export const MOON_MASS_KG = 7.34767309e22;
export const MOON_RADIUS_M = 1737100;
export const MOON_ORBIT_RADIUS_M = 384400000; // Average distance from Earth
export const MOON_ORBITAL_PERIOD_S = 27.322 * 24 * 3600; // 27.322 days in seconds
export const PLANET_ROTATION_PERIOD_S = 24 * 3600; // 24 hours in seconds

// Simplified continent data (approximate shapes)
export const CONTINENTS = [
    {
        name: "North America",
        color: "#4CAF50",
        points: [
            {x: -0.4, y: 0.3}, {x: -0.3, y: 0.4}, {x: -0.2, y: 0.35},
            {x: -0.1, y: 0.4}, {x: 0, y: 0.35}, {x: 0.1, y: 0.3},
            {x: 0.2, y: 0.25}, {x: 0.3, y: 0.2}, {x: 0.2, y: 0.1},
            {x: 0.1, y: 0.05}, {x: -0.1, y: 0}, {x: -0.2, y: 0.1},
            {x: -0.3, y: 0.15}, {x: -0.4, y: 0.2}
        ]
    },
    {
        name: "South America",
        color: "#8BC34A",
        points: [
            {x: -0.2, y: -0.1}, {x: -0.15, y: -0.2}, {x: -0.1, y: -0.3},
            {x: -0.05, y: -0.4}, {x: 0, y: -0.45}, {x: 0.1, y: -0.4},
            {x: 0.15, y: -0.3}, {x: 0.1, y: -0.2}, {x: 0, y: -0.15},
            {x: -0.1, y: -0.1}
        ]
    },
    {
        name: "Europe",
        color: "#CDDC39",
        points: [
            {x: 0.1, y: 0.3}, {x: 0.2, y: 0.35}, {x: 0.3, y: 0.3},
            {x: 0.35, y: 0.25}, {x: 0.3, y: 0.2}, {x: 0.25, y: 0.15},
            {x: 0.2, y: 0.2}, {x: 0.15, y: 0.25}, {x: 0.1, y: 0.3}
        ]
    },
    {
        name: "Africa",
        color: "#FFC107",
        points: [
            {x: 0.1, y: 0.1}, {x: 0.2, y: 0.05}, {x: 0.3, y: 0},
            {x: 0.35, y: -0.1}, {x: 0.3, y: -0.2}, {x: 0.2, y: -0.25},
            {x: 0.1, y: -0.2}, {x: 0, y: -0.15}, {x: -0.1, y: -0.1},
            {x: -0.05, y: 0}, {x: 0, y: 0.05}, {x: 0.1, y: 0.1}
        ]
    },
    {
        name: "Asia",
        color: "#FF9800",
        points: [
            {x: 0.3, y: 0.2}, {x: 0.4, y: 0.15}, {x: 0.45, y: 0.1},
            {x: 0.5, y: 0}, {x: 0.45, y: -0.1}, {x: 0.4, y: -0.15},
            {x: 0.3, y: -0.1}, {x: 0.25, y: 0}, {x: 0.2, y: 0.1},
            {x: 0.25, y: 0.15}, {x: 0.3, y: 0.2}
        ]
    },
    {
        name: "Australia",
        color: "#FF5722",
        points: [
            {x: 0.4, y: -0.2}, {x: 0.45, y: -0.25}, {x: 0.5, y: -0.3},
            {x: 0.45, y: -0.35}, {x: 0.4, y: -0.3}, {x: 0.35, y: -0.25},
            {x: 0.4, y: -0.2}
        ]
    }
];

export const planet = { 
    mass_kg: EARTH_MASS_KG, 
    radius_m: EARTH_RADIUS_M, 
    color: '#3A8D3A', 
    atmosphereColor: 'rgba(173, 216, 230, 0.15)', 
    maxAtmosphereRadius_m: EARTH_RADIUS_M + EARTH_MAX_ATMOSPHERE_ALTITUDE,
    rotationPeriod_s: PLANET_ROTATION_PERIOD_S,
    currentRotation_rad: 0,
    moon: {
        mass_kg: MOON_MASS_KG,
        radius_m: MOON_RADIUS_M,
        orbitRadius_m: MOON_ORBIT_RADIUS_M,
        orbitalPeriod_s: MOON_ORBITAL_PERIOD_S,
        color: '#CCCCCC',
        currentAngle_rad: 0, 
        moonX_m: 0,
        moonY_m: 0, 
    }
};

export const COLOR_NAMES = {"aliceblue":"#f0f8ff", "antiquewhite":"#faebd7", "aqua":"#00ffff", "aquamarine":"#7fffd4", "azure":"#f0ffff", "beige":"#f5f5dc", "bisque":"#ffe4c4", "black":"#000000", "blanchedalmond":"#ffebcd", "blue":"#0000ff", "blueviolet":"#8a2be2", "brown":"#a52a2a", "burlywood":"#deb887", "cadetblue":"#5f9ea0", "chartreuse":"#7fff00", "chocolate":"#d2691e", "coral":"#ff7f50", "cornflowerblue":"#6495ed", "cornsilk":"#fff8dc", "crimson":"#dc143c", "cyan":"#00ffff", "darkblue":"#00008b", "darkcyan":"#008b8b", "darkgoldenrod":"#b8860b", "darkgray":"#a9a9a9", "darkgreen":"#006400", "darkkhaki":"#bdb76b", "darkmagenta":"#8b008b", "darkolivegreen":"#556b2f", "darkorange":"#ff8c00", "darkorchid":"#9932cc", "darkred":"#8b0000", "darksalmon":"#e9967a", "darkseagreen":"#8fbc8f", "darkslateblue":"#483d8b", "darkslategray":"#2f4f4f", "darkturquoise":"#00ced1", "darkviolet":"#9400d3", "deeppink":"#ff1493", "deepskyblue":"#00bfff", "dimgray":"#696969", "dodgerblue":"#1e90ff", "firebrick":"#b22222", "floralwhite":"#fffaf0", "forestgreen":"#228b22", "fuchsia":"#ff00ff", "gainsboro":"#dcdcdc", "ghostwhite":"#f8f8ff", "gold":"#ffd700", "goldenrod":"#daa520", "gray":"#808080", "green":"#008000", "greenyellow":"#adff2f",
     "honeydew":"#f0fff0", "hotpink":"#ff69b4", "indianred ":"#cd5c5c", "indigo":"#4b0082", "ivory":"#fffff0", "khaki":"#f0e68c", "lavender":"#e6e6fa", "lavenderblush":"#fff0f5", "lawngreen":"#7cfc00", "lemonchiffon":"#fffacd", "lightblue":"#add8e6", "lightcoral":"#f08080", "lightcyan":"#e0ffff", "lightgoldenrodyellow":"#fafad2", "lightgrey":"#d3d3d3", "lightgreen":"#90ee90", "lightpink":"#ffb6c1", "lightsalmon":"#ffa07a", "lightseagreen":"#20b2aa", "lightskyblue":"#87cefa", "lightslategray":"#778899", "lightsteelblue":"#b0c4de", "lightyellow":"#ffffe0", "lime":"#00ff00", "limegreen":"#32cd32", "linen":"#faf0e6", "magenta":"#ff00ff", "maroon":"#800000", "mediumaquamarine":"#66cdaa", "mediumblue":"#0000cd", "mediumorchid":"#ba55d3", "mediumpurple":"#9370d8", "mediumseagreen":"#3cb371", "mediumslateblue":"#7b68ee",  "mediumspringgreen":"#00fa9a", "mediumturquoise":"#48d1cc", "mediumvioletred":"#c71585", "midnightblue":"#191970", "mintcream":"#f5fffa", "mistyrose":"#ffe4e1", "moccasin":"#ffe4b5", "navajowhite":"#ffdead", "navy":"#000080", "oldlace":"#fdf5e6", "olive":"#808000", "olivedrab":"#6b8e23", "orange":"#ffa500", "orangered":"#ff4500", "orchid":"#da70d6", "palegoldenrod":"#eee8aa",
     "palegreen":"#98fb98", "paleturquoise":"#afeeee", "palevioletred":"#d87093", "papayawhip":"#ffefd5", "peachpuff":"#ffdab9", "peru":"#cd853f", "pink":"#ffc0cb", "plum":"#dda0dd", "powderblue":"#b0e0e6", "purple":"#800080", "rebeccapurple":"#663399", "red":"#ff0000", "rosybrown":"#bc8f8f", "royalblue":"#4169e1", "saddlebrown":"#8b4513", "salmon":"#fa8072", "sandybrown":"#f4a460", "seagreen":"#2e8b57", "seashell":"#fff5ee", "sienna":"#a0522d", "silver":"#c0c0c0", "skyblue":"#87ceeb", "slateblue":"#6a5acd", "slategray":"#708090", "snow":"#fffafa", "springgreen":"#00ff7f", "steelblue":"#4682b4", "tan":"#d2b48c", "teal":"#008080", "thistle":"#d8bfd8", "tomato":"#ff6347", "turquoise":"#40e0d0", "violet":"#ee82ee", "wheat":"#f5deb3", "white":"#ffffff", "whitesmoke":"#f5f5f5", "yellow":"#ffff00", "yellowgreen":"#9acd32"};