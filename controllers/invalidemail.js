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
// Helper function to normalize strings
const normalizeString = (str) => {
  if (str === undefined || str === null) {
    return "";
  }
  if (typeof str !== "string") {
    return "";
  }
  return str.trim();
};

// Function to check the database for a match based on email
async function checkDatabase(email, username) {
  logger.info(`${username} - Checking database for email: ${email}`);
  const client = await pool.connect();
  try {
    const query = `
      SELECT CASE WHEN EXISTS (
        SELECT 1 FROM public.invalid_email_addresses WHERE email_address = $1
      ) THEN 'Match' ELSE 'Unmatch' END AS match_status;
    `;
    const result = await client.query(query, [email]);
    const row = result.rows[0];
    const status = row ? row.match_status : 'Unmatch';
    logger.info(`${username} - Database check result for email ${email}: ${status}`);
    return status;
  } catch (error) {
    logger.error(`${username} - Database query error for email ${email}: ${error.message}`);
    return 'Error';
  } finally {
    client.release();
    logger.info(`${username} - Database connection released after checking email: ${email}`);
  }
}

// Function to process the uploaded file
async function processFile(filePath, username) {
  logger.info(`${username} - Processing file: ${filePath}`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.getWorksheet(1);

  // Check if the required column name "Email ID" is present
  const emailIndex = worksheet.getRow(1).values.indexOf('Email ID');
  if (emailIndex === -1) {
    logger.error(`${username} - Missing column: Email ID`);
    return { error: 'Missing column: Email ID' };
  }

  // Add the "Match Status" column
  const statusColumn = worksheet.getColumn(worksheet.columnCount + 1);
  statusColumn.header = 'Match Status';

  for (let i = 2; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i);
    const email = normalizeString(row.getCell(emailIndex).value);
    const matchStatus = await checkDatabase(email, username);
    row.getCell(statusColumn.number).value = matchStatus;
    row.commit();
    logger.info(`${username} - Processed row ${i} with email ${email} - Match Status: ${matchStatus}`);
  }

  const newFilePath = "Updated-" + Date.now() + ".xlsx";
  await workbook.xlsx.writeFile(newFilePath);
  logger.info(`${username} - File processed successfully. New file created: ${newFilePath}`);
  return newFilePath;
}

uploadFile = async (req, res) => {
  const username = req.session.username || 'Anonymous'; // Fallback if username is not set
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
  checkDatabase, // Make sure to include this line
  // Other exports as needed...
};