const fs = require('fs');
const { Pool } = require('pg');
const ExcelJS = require('exceljs');
const logger = require('./logger'); // Ensure you have a logger module

// PostgreSQL connection settings
const pool = new Pool({
  user: "postgres",
  host: "158.220.121.203",
  database: "postgres",
  password: "P0stgr3s%098",
  port: 5432,
});

// Helper function to normalize phone numbers
const normalizePhoneNumber = (str) => {
  if (str === undefined || str === null) {
    logger.warn('normalizePhoneNumber: Received undefined or null');
    return '';
  }

  if (typeof str !== 'string') {
    logger.warn('normalizePhoneNumber: Received non-string input, converting to string');
    str = String(str);
  }

  logger.info(`normalizePhoneNumber: Raw phone number before normalization: '${str}'`);

  // Remove all non-numeric characters (except spaces or special chars you need)
  const normalized = str.replace(/[^\d]/g, '').trim();

  // Check if the phone number is now empty
  if (normalized.length === 0) {
    logger.warn(`normalizePhoneNumber: After normalization, phone number is empty: '${str}'`);
    return '';
  }

  logger.info(`normalizePhoneNumber: Normalized phone number: '${normalized}'`);
  return normalized;
};


// Function to check the database for a match based on phone number
// Function to check the database for a match based on phone number
// Function to check the database for a match based on phone number
async function checkDatabase(phoneNumber, username) {
  logger.info(`${username} - Checking database for phone number: ${phoneNumber}`);
  const client = await pool.connect();
  try {
    // Log the normalized phone number before the query
    logger.info(`${username} - Normalized phone number for database check: ${phoneNumber}`);

    const query = `
      SELECT phone_number
      FROM public.phone_campaigns
      WHERE phone_number = $1;
    `;
    const result = await client.query(query, [phoneNumber]);
    const row = result.rows[0];
    if (row) {
      logger.info(`${username} - Match found in database for phone number: ${phoneNumber}`);
      return 'Match';
    } else {
      logger.info(`${username} - No match found in database for phone number: ${phoneNumber}`);
      return 'Unmatch';
    }
  } catch (error) {
    logger.error(`${username} - Database query error for phone number ${phoneNumber}: ${error.message}`);
    return 'Error';
  } finally {
    client.release();
    logger.info(`${username} - Database connection released after checking phone number: ${phoneNumber}`);
  }
}

async function processFile(filePath, username) {
  logger.info(`${username} - Processing file: ${filePath}`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.getWorksheet(1);

  const phoneNumberIndex = worksheet.getRow(1).values.indexOf('Phone Number');
  if (phoneNumberIndex === -1) {
    logger.error(`${username} - Missing column: Phone Number`);
    return { error: 'Missing column: Phone Number' };
  }

  const headers = worksheet.getRow(1).values;
  logger.info(`${username} - Found headers: ${JSON.stringify(headers)}`);

  const statusColumn = worksheet.getColumn(worksheet.columnCount + 1);
  statusColumn.header = 'Match Status';

  for (let i = 2; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i);
    const rawPhoneNumber = row.getCell(phoneNumberIndex).value;
    logger.info(`${username} - Raw phone number from cell: '${rawPhoneNumber}'`);

    const phoneNumber = normalizePhoneNumber(rawPhoneNumber);
    
    // Check for phone number length issues
    if (phoneNumber.length > 15) {
      logger.warn(`${username} - Normalized phone number exceeds length limit: '${phoneNumber}'`);
      row.getCell(statusColumn.number).value = 'Error: Too Long';
      row.commit();
      continue;
    }

    logger.info(`${username} - Normalized phone number: '${phoneNumber}'`);
    const matchStatus = await checkDatabase(phoneNumber, username);

    row.getCell(statusColumn.number).value = matchStatus;
    row.commit();
    logger.info(`${username} - Processed row ${i} with phone number ${phoneNumber} - Match Status: ${matchStatus}`);
  }

  const newFilePath = "Updated-" + Date.now() + ".xlsx";
  await workbook.xlsx.writeFile(newFilePath);
  logger.info(`${username} - File processed successfully. New file created: ${newFilePath}`);
  return newFilePath;
}

// Function to handle single phone number check API
async function checkSinglePhoneNumberAPI(req, res) {
  const { phoneNumber } = req.body;  // Get phone number from request body
  const username = req.session.username || 'Anonymous';  // Get the username (optional)

  if (!phoneNumber) {
    return res.status(400).json({ error: 'Phone number is required' });  // Error if no phone number is provided
  }

  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);  // Normalize the phone number

  if (normalizedPhoneNumber.length === 0) {
    return res.status(400).json({ error: 'Invalid phone number' });  // Error if phone number is invalid (empty after normalization)
  }

  try {
    // Call checkDatabase function to check if the phone number exists in the database
    const matchStatus = await checkDatabase(normalizedPhoneNumber, username);

    // Send back the result
    res.json({
      phoneNumber: normalizedPhoneNumber,
      status: matchStatus  // Return match/unmatch status
    });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while checking the phone number.' });
  }
}


// Express upload function...
const uploadFile = async (req, res) => {
  const username = req.session.username || 'Anonymous';
  if (!req.file) {
    logger.warn(`${username} - No file uploaded.`);
    return res.status(400).send("No file uploaded.");
  }

  const filePath = req.file.path;
  try {
    const result = await processFile(filePath, username);
    if (result.error) {
      logger.error(`${username} - File processing error: ${result.error}`);
      return res.status(400).send(result.error);
    }
    logger.info(`${username} - File download initiated: ${result}`);
    res.download(result);
  } catch (error) {
    logger.error(`${username} - Error while processing file: ${error.message}`);
    res.status(500).send("An error occurred while processing the file.");
  } finally {
    fs.unlinkSync(filePath);
    logger.info(`${username} - Temporary file deleted: ${filePath}`);
  }
};

module.exports = {
  uploadFile,
  processFile,
  checkDatabase,
  checkSinglePhoneNumberAPI
};
