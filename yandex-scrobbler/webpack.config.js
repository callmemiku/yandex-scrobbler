const path = require('path');

module.exports = {
  entry: './background.js', // Your main background script
  output: {
    filename: 'background.bundle.js', // Output bundled file
    path: path.resolve(__dirname, 'dist'),
  },
  mode: 'production',
};
