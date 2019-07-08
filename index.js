const app = require('express')();
const passport = require('passport');
const YoutubeV3Strategy = require('passport-youtube-v3').Strategy;
const { clientId, clientSecret } = require('./config');
const authLib = require('./lib/auth');
const botLib = require('./lib/bot');

passport.use(new YoutubeV3Strategy(
  {
    clientID: clientId,
    clientSecret: clientSecret,
    callbackURL: 'http://localhost:3000/callback',
    scope: ['https://www.googleapis.com/auth/youtube.force-ssl']
  },
  function (accessToken, refreshToken, profile, done) {
    console.log({ accessToken, refreshToken });
    global.youtubeAccessToken = accessToken;
    global.youtubeRefreshToken = refreshToken;
    done(profile);
  }
));

app.get('/authenticate', passport.authenticate('youtube'));
app.get('/callback', passport.authenticate('youtube'));

app.listen(3000, () => {
  console.log('We are live on 3000');
  setInterval(authLib.refreshToken, 59 * 60000); // 59m
  setTimeout(botLib.main, 60000); // 1m
});
