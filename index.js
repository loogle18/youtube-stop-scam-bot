const app = require('express')();
const passport = require('passport');
const YoutubeV3Strategy = require('passport-youtube-v3').Strategy;
const { clientId, clientSecret, appAuthToken } = require('./config');
const authLib = require('./lib/auth');
const botLib = require('./lib/bot');

const PORT = process.env.PORT || 3000;
const callbackURL = process.env.APP_ENV === 'heroku' ?
  'https://youtube-stop-scam-bot.herokuapp.com/callback' :
  `http://localhost:${PORT}/callback`;

passport.use(new YoutubeV3Strategy(
  {
    clientID: clientId,
    clientSecret,
    callbackURL,
    scope: ['https://www.googleapis.com/auth/youtube.force-ssl']
  },
  function (accessToken, refreshToken, _profile, done) {
    console.log({ accessToken, refreshToken });
    global.youtubeAccessToken = accessToken;
    global.youtubeRefreshToken = refreshToken;
    done(JSON.stringify({ error: false, message: 'Successfully auth and set globals.' }));
  }
));

app.get(
  '/authenticate',
  (req, res, next) => {
    if (req.query.token === appAuthToken) {
      delete req.query.token;
      next();
    } else {
      res.status(401).send({ error: true, message: 'Invalid auth token' });
    }
  },
  passport.authenticate('youtube')
);
app.get('/callback', passport.authenticate('youtube'));

app.listen(PORT, () => {
  console.log(`We are live on ${PORT}`);
  setInterval(authLib.refreshToken, 59 * 60000); // 59m
  setTimeout(botLib.main, 60000); // 1m
});
