// .assetpack.js
import { pixiPipes } from '@assetpack/core/pixi';

export default {
    entry: './raw-assets',
    output: './public/assets',
    pipes: [
        ...pixiPipes({
            // PixiJS configuration options
        }),
    ],
};