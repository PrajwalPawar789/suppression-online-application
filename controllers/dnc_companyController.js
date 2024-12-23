const { Pool } = require('pg');
const logger = require('./logger');
const path = require('path');
const fs = require('fs');
const excelToJson = require('convert-excel-to-json');

const pool = new Pool({
    user: "postgres",
    host: "158.220.121.203",
    database: "postgres",
    password: "P0stgr3s%098",
    port: 5432,
  });


async function insertDncCompanyData(req, res) {
    console.log("Logging Request", req.session.username);
    if (!req.file) {
        return res.status(400).send('File is required.');
    }

    // Process the uploaded file
    const filePath = path.join(__dirname, '../uploads/', req.file.filename);
    const result = excelToJson({
        sourceFile: filePath,
        header: { rows: 1 },
        columnToKey: {
            A: 'dnc_company_name',
            B: 'domain'
        }
    });

    fs.unlinkSync(filePath); // Clean up the file after processing

    const dncCompanies = result.Sheet1.map(row => ({
        dnc_company_name: row.dnc_company_name,
        domain: row.domain
    }));

    const client = await pool.connect();
    try {
        for (const company of dncCompanies) {
            const insertQuery = `INSERT INTO public.dnc_company (dnc_company_name, domain) VALUES ($1, $2);`;
            await client.query(insertQuery, [company.dnc_company_name, company.domain]);
            logger.info(`${req.session.username} Inserted DNC company: ${company.dnc_company_name}`);
        }
        res.send('DNC companies inserted successfully.');
    } catch (error) {
        logger.error(`${req.session.username} Error inserting DNC companies:`, error);
        res.status(500).send('Failed to insert DNC companies.');
    } finally {
        client.release();
        logger.info(`${req.session.username} Database connection released.`);
    }
}

module.exports = {
    insertDncCompanyData
};