const rp = require('request-promise');
const { clientId, clientSecret } = require('../config');

const refreshToken = () => {
  return rp({
    method: 'POST',
    uri: 'https://www.googleapis.com/oauth2/v4/token',
    qs: {
      refresh_token: global.youtubeRefreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: 'http://localhost:3000/callback',
      grant_type: 'refresh_token'
    },
    json: true
  }).then((response) => {
    global.youtubeAccessToken = response.access_token;
  }).catch((err) => {
    console.log(err.message);
  });
};

module.exports = {
  refreshToken
};
