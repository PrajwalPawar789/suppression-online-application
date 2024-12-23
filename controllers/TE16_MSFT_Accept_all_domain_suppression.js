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

// Helper function to normalize domain names
const normalizeDomain = (str) => {
  if (str === undefined || str === null) {
    logger.warn('normalizeDomain: Received undefined or null');
    return '';
  }

  if (typeof str !== 'string') {
    logger.warn('normalizeDomain: Received non-string input, converting to string');
    str = String(str);
  }

  logger.info(`normalizeDomain: Raw domain name before normalization: '${str}'`);

  // Remove any leading/trailing whitespace and ensure lower case for consistency
  const normalized = str.trim().toLowerCase();

  // Check if the domain is now empty
  if (normalized.length === 0) {
    logger.warn(`normalizeDomain: After normalization, domain name is empty: '${str}'`);
    return '';
  }

  logger.info(`normalizeDomain: Normalized domain name: '${normalized}'`);
  return normalized;
};

// Function to check the database for a match based on domain name
async function checkDatabase(domainName, username) {
  logger.info(`${username} - Checking database for domain: ${domainName}`);
  const client = await pool.connect();
  try {
    // Log the normalized domain name before the query
    logger.info(`${username} - Normalized domain name for database check: ${domainName}`);

    const query = `
      SELECT domain_name
      FROM public.TE16_MSFT_Accept_all_domain_suppression
      WHERE domain_name = $1;
    `;
    const result = await client.query(query, [domainName]);
    const row = result.rows[0];
    if (row) {
      logger.info(`${username} - Match found in database for domain: ${domainName}`);
      return 'Match';
    } else {
      logger.info(`${username} - No match found in database for domain: ${domainName}`);
      return 'Unmatch';
    }
  } catch (error) {
    logger.error(`${username} - Database query error for domain ${domainName}: ${error.message}`);
    return 'Error';
  } finally {
    client.release();
    logger.info(`${username} - Database connection released after checking domain: ${domainName}`);
  }
}

// Function to process the uploaded file
async function processFile(filePath, username) {
  logger.info(`${username} - Processing file: ${filePath}`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.getWorksheet(1);

  const domainIndex = worksheet.getRow(1).values.indexOf('Domain');
  if (domainIndex === -1) {
    logger.error(`${username} - Missing column: Domain`);
    return { error: 'Missing column: Domain' };
  }

  const headers = worksheet.getRow(1).values;
  logger.info(`${username} - Found headers: ${JSON.stringify(headers)}`);

  const statusColumn = worksheet.getColumn(worksheet.columnCount + 1);
  statusColumn.header = 'Match Status';

  for (let i = 2; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i);
    const rawDomainName = row.getCell(domainIndex).value;
    logger.info(`${username} - Raw domain name from cell: '${rawDomainName}'`);

    const domainName = normalizeDomain(rawDomainName);

    // Check for domain name length issues
    if (domainName.length === 0) {
      logger.warn(`${username} - Normalized domain name is empty: '${domainName}'`);
      row.getCell(statusColumn.number).value = 'Error: Empty Domain';
      row.commit();
      continue;
    }

    logger.info(`${username} - Normalized domain name: '${domainName}'`);
    const matchStatus = await checkDatabase(domainName, username);

    row.getCell(statusColumn.number).value = matchStatus;
    row.commit();
    logger.info(`${username} - Processed row ${i} with domain name ${domainName} - Match Status: ${matchStatus}`);
  }

  const newFilePath = "Updated-" + Date.now() + ".xlsx";
  await workbook.xlsx.writeFile(newFilePath);
  logger.info(`${username} - File processed successfully. New file created: ${newFilePath}`);
  return newFilePath;
}

// Function to handle a single domain check API
async function checkSingleDomainAPI(req, res) {
    const { domain } = req.body;  // Get domain from the request body
    const username = req.session.username || 'Anonymous';  // Get the username (optional)
  
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });  // Error if no domain is provided
    }
  
    const normalizedDomain = normalizeDomain(domain);  // Normalize the domain name
  
    if (normalizedDomain.length === 0) {
      return res.status(400).json({ error: 'Invalid domain' });  // Error if domain is empty after normalization
    }
  
    try {
      // Call checkDatabase function to check if the domain is suppressed in the database
      const matchStatus = await checkDatabase(normalizedDomain, username);
      
      res.json({
        domain: normalizedDomain,
        status: matchStatus  // Return match/unmatch status
      });
    } catch (error) {
      res.status(500).json({ error: 'An error occurred while checking the domain.' });
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
  checkSingleDomainAPI
};
