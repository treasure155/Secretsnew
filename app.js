require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const passportLocalMongoose = require('passport-local-mongoose');
const User = require('./models/user'); // Import the User model
const flash = require('connect-flash');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const Secret = require('./models/secret');


const app = express();
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(flash());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb+srv://Treasure155:Uyioobong155@cluster0.wahenxv.mongodb.net/secretsDB")
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error);
  });

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

passport.use(new GoogleStrategy(
  {
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: 'http://localhost:3000/auth/google/secrets',
    userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo',
  },
  async (accessToken, refreshToken, profile, cb) => {
    try {
      const existingUser = await User.findOne({ googleId: profile.id });
      if (existingUser) {
        return cb(null, existingUser);
      } else {
        const newUser = await User.create({ username: profile.displayName, googleId: profile.id });
        return cb(null, newUser);
      }
    } catch (error) {
      return cb(error, null);
    }
  }
));


passport.use(new FacebookStrategy(
  {
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: 'http://localhost:3000/auth/facebook/secrets',
    profileFields: ['id', 'displayName', 'email'],
  },
  async (accessToken, refreshToken, profile, cb) => {
    try {
      const existingUser = await User.findOne({ facebookId: profile.id });
      if (existingUser) {
        return cb(null, existingUser);
      } else {
        const newUser = await User.create({ username: profile.displayName, facebookId: profile.id });
        return cb(null, newUser);
      }
    } catch (error) {
      return cb(error, null);
    }
  }
));

app.get('/', (req, res) => {
  res.render('home');
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile'] }));

app.get(
  '/auth/google/secrets',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Successful authentication, redirect to secrets page
    res.redirect('/secrets');
  }
);

app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email'] }));

app.get(
  '/auth/facebook/secrets',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  (req, res) => {
    // Successful authentication, redirect to secrets page
    res.redirect('/secrets');
  }
);

app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const newUser = new User({ username, email });
    await User.register(newUser, password);
    res.redirect('/login');
  } catch (error) {
    console.error('Error registering user:', error);
    res.redirect('/register');
  }
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      // Send error as query parameter instead of using flash
      return res.redirect('/login?error=true');
    }
    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      return res.redirect('/secrets');
    });
  })(req, res, next);
});




app.get('/submit', (req, res) => {
  if (req.isAuthenticated()) {
    res.render('submit');
  } else {
    res.redirect('/login');
  }
});

app.post('/submit', async (req, res) => {
  const submittedSecret = req.body.secret;

  // Create a new secret object with the submitted secret
  const newSecret = new Secret({
    secret: submittedSecret,
    // You can associate the secret with the current user if you have user authentication in place
    // user: req.user._id,
  });

  try {
    // Save the secret to the database
    await newSecret.save();
    res.redirect('/secrets');
  } catch (error) {
    console.error('Error saving secret:', error);
    res.redirect('/submit');
  }
});

app.get('/secrets', (req, res) => {
  if (req.isAuthenticated()) {
    Secret.find({}, 'secret') // Only retrieve the 'secret' field
      .then(secrets => {
        // Extract the secret texts from the secrets array
        const secretTexts = secrets.map(secret => secret.secret);
        res.render('secrets', { secrets: secretTexts });
      })
      .catch(err => {
        console.log(err);
        res.redirect('/');
      });
  } else {
    res.redirect('/');
  }
});



app.get('/logout', function (req, res, next) {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect('/');
  });
});

let port = process.env.PORT;
if (port == null || port == ""){
port = 3000;
}

app.listen(port, function () {
  console.log("Server has started.");
});
