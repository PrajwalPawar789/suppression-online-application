const express = require('express');
const session = require('express-session');
const fileRoutes = require('./routes/fileRoutes');
const path = require('path');
const cors = require('cors');

const app = express();

const allowedOrigins = [
  'http://localhost:3000', 
  'http://localhost:3001', 
  'http://192.168.1.47',
  'http://192.168.0.16',
  'http://192.168.1.36:3000',
  'https://crm.techresearchinfo.com',
  'http://127.0.0.1:5500', 
  'https://www.techresearchinfo.com'
];

app.use(cors({
  origin: function(origin, callback) {
  // console.log('Origin:', origin);  // Log the incoming origin for debugging
  if (!origin || allowedOrigins.indexOf(origin) !== -1) {
    return callback(null, true);
  }
  callback(new Error('Not allowed by CORS'));
},
  methods: ['GET', 'POST', 'PUT', 'DELETE'],  // Add allowed methods
  allowedHeaders: ['Content-Type', 'Authorization'],  // Add allowed headers
  credentials: true, // If you need to send cookies or authentication headers
  preflightContinue: false // Don't manually handle preflight requests
}));

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true
}));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/', fileRoutes);

const port = 3000;
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
