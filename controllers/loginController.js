const { Pool } = require('pg');
const logger = require('./logger');

const pool = new Pool({
  user: "postgres",
  host: "158.220.121.203",
  database: "postgres",
  password: "P0stgr3s%098",
  port: 5432,
});

const login = async (req, res) => {
  const { username, password } = req.body;
  logger.info(`Login attempt for username: ${username}`); // Log login attempt

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);

    if (result.rows.length > 0) {
      req.session.isAuthenticated = true; // Set isAuthenticated flag in session
      req.session.username = username; // Store the username in session
      logger.info(`Successful login for username: ${username}`); // Log successful login
      res.redirect('/');
    } else {
      req.session.isAuthenticated = false;
      logger.warn(`Failed login attempt for username: ${username} - Invalid username or password`); // Log failed login
      res.send('Invalid username or password');
    }
  } catch (error) {
    logger.error(`Error executing query for username: ${username}`, { error: error.message }); // Log query error
    res.status(500).send('Internal Server Error');
  }
};

const logout = (req, res) => {
  logger.info(`Logout request received for username: ${req.session.username}`); // Log logout request
  req.session.destroy((err) => {
    if (err) {
      logger.error(`Failed to logout for username: ${req.session.username}`, { error: err.message }); // Log logout error
      return res.status(500).json({ message: 'Failed to logout' });
    }
    logger.info(`Successfully logged out for username: ${req.session.username}`); // Log successful logout
    res.redirect('/login');
  });
};

module.exports = { login, logout };
