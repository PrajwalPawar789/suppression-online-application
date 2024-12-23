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

// Function to check the database for a match based on email, company name, and domain
async function checkDatabase(email, companyName, domain, username) {
  logger.info(`${username} - Checking database for email: ${email}, company: ${companyName}, domain: ${domain}`);
  const client = await pool.connect();
  try {
    const query = `
      SELECT 
        CASE WHEN EXISTS (
          SELECT 1 FROM public.dnc_suppression WHERE email_address = $1
        ) THEN 'Match' ELSE 'Unmatch' END AS email_status,
        CASE WHEN EXISTS (
          SELECT 1 FROM public.dnc_suppression WHERE company_name = $2
        ) THEN 'Match' ELSE 'Unmatch' END AS company_status,
        CASE WHEN EXISTS (
          SELECT 1 FROM public.dnc_suppression WHERE company_domain = $3
        ) THEN 'Match' ELSE 'Unmatch' END AS domain_status,
        CASE WHEN EXISTS (
          SELECT 1 FROM public.dnc_company WHERE dnc_company_name = $2
        ) THEN 'Match' ELSE 'Unmatch' END AS dnc_company_status,
        CASE WHEN EXISTS (
          SELECT 1 FROM public.dnc_company WHERE domain = $3
        ) THEN 'Match' ELSE 'Unmatch' END AS dnc_domain_status;
    `;
    const result = await client.query(query, [email, companyName, domain]);
    const row = result.rows[0];
    const status = row ? row : { 
      email_status: 'Unmatch', 
      company_status: 'Unmatch', 
      domain_status: 'Unmatch',
      dnc_company_status: 'Unmatch',
      dnc_domain_status: 'Unmatch' 
    };
    logger.info(`${username} - Database check result: ${JSON.stringify(status)}`);
    return status;
  } catch (error) {
    logger.error(`${username} - Database query error for email ${email}: ${error.message}`);
    return { 
      email_status: 'Error', 
      company_status: 'Error', 
      domain_status: 'Error',
      dnc_company_status: 'Error',
      dnc_domain_status: 'Error' 
    };
  } finally {
    client.release();
    logger.info(`${username} - Database connection released.`);
  }
}

// Function to process the uploaded file
async function processFile(filePath, username) {
  logger.info(`${username} - Processing file: ${filePath}`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.getWorksheet(1);

  // Check if the required columns are present
  const emailIndex = worksheet.getRow(1).values.indexOf('Email ID');
  const companyNameIndex = worksheet.getRow(1).values.indexOf('Company Name');
  const domainIndex = worksheet.getRow(1).values.indexOf('Domain');
  if (emailIndex === -1 || companyNameIndex === -1 || domainIndex === -1) {
    logger.error(`${username} - Missing required columns: Email ID, Company Name, or Domain`);
    return { error: 'Missing required columns: Email ID, Company Name, or Domain' };
  }

  // Add new columns for the status checks
  const statusColumn = worksheet.getColumn(worksheet.columnCount + 1);
  statusColumn.header = 'Email Status';
  const companyStatusColumn = worksheet.getColumn(worksheet.columnCount + 2);
  companyStatusColumn.header = 'Company Status';
  const domainStatusColumn = worksheet.getColumn(worksheet.columnCount + 3);
  domainStatusColumn.header = 'Domain Status';
  const dncCompanyStatusColumn = worksheet.getColumn(worksheet.columnCount + 4);
  dncCompanyStatusColumn.header = 'DNC Company Status';
  const dncDomainStatusColumn = worksheet.getColumn(worksheet.columnCount + 5);
  dncDomainStatusColumn.header = 'DNC Domain Status';

  for (let i = 2; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i);
    const email = normalizeString(row.getCell(emailIndex).value);
    const companyName = normalizeString(row.getCell(companyNameIndex).value);
    const domain = normalizeString(row.getCell(domainIndex).value);
    
    // Fetch status from the database
    const { email_status, company_status, domain_status, dnc_company_status, dnc_domain_status } = await checkDatabase(email, companyName, domain, username);
    
    // Set the status in the new columns
    row.getCell(statusColumn.number).value = email_status;
    row.getCell(companyStatusColumn.number).value = company_status;
    row.getCell(domainStatusColumn.number).value = domain_status;
    row.getCell(dncCompanyStatusColumn.number).value = dnc_company_status;
    row.getCell(dncDomainStatusColumn.number).value = dnc_domain_status;
    row.commit();
    logger.info(`${username} - Processed row ${i} with email ${email}, company ${companyName}, domain ${domain}`);
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
