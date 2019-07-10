const dotenvResult = require('dotenv').config();

module.exports = {
  apps: [
    {
      name: 'youtube-stop-scam-bot',
      script: './index.js',
      watch: false,
      error_file: 'err_only.log',
      out_file: 'info_only.log',
      time: true,
      env: dotenvResult.parsed
    }
  ]
};
