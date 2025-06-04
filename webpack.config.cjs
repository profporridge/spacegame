const path = require('path');

module.exports = {
  mode: 'development', // Can be 'production' for minified builds
  entry: './main.js', // Entry point of your application
  output: {
    path: path.resolve(__dirname, 'public'), // Output directory
    filename: 'bundle.js', // Output bundle file name
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/, // Transpile .js and .jsx files
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react'],
          },
        },
      },
      {
        test: /\.css$/, // Example for handling CSS files
        use: ['style-loader', 'css-loader'],
      },
       {
         test: /\.(png|svg|jpg|jpeg|gif)$/i,
         type: 'asset/resource',
       },
    ],
  },
  resolve: {
    alias:{
      images: path.resolve(__dirname, 'images'), // Alias for images directory
    },
    extensions: ['.js', '.jsx'], // Automatically resolve these extensions
  },
  devServer: {
    static: {
      directory: path.join(__dirname, 'public'), // Serve files from public directory
      directory: path.join(__dirname, 'images'), // Serve files from public directory
    },
    compress: true,
    port: 3000, // Development server port
    historyApiFallback: true, // Redirect all 404s to index.html
  },
  devtool: 'source-map', // Optional: for better debugging
};
