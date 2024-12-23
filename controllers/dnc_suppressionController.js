// controllers/dnc_suppressionController.js
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


async function insertDncSuppressionData(req, res) {
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
            A: 'company_name',
            B: 'company_domain',
            C: 'first_name',
            D: 'last_name',
            E: 'email_address',
            F: 'full_name_and_domain'
        }
    });

    fs.unlinkSync(filePath); // Clean up the file after processing

    const dncSuppressions = result.Sheet1.map(row => ({
        company_name: row.company_name,
        company_domain: row.company_domain,
        first_name: row.first_name,
        last_name: row.last_name,
        email_address: row.email_address,
        full_name_and_domain: row.full_name_and_domain
    }));

    const client = await pool.connect();
    try {
        for (const suppression of dncSuppressions) {
            const insertQuery = 'INSERT INTO public.dnc_suppression (company_name, company_domain, first_name, last_name, email_address, full_name_and_domain) VALUES ($1, $2, $3, $4, $5, $6)';
            await client.query(insertQuery, [
                suppression.company_name,
                suppression.company_domain,
                suppression.first_name,
                suppression.last_name,
                suppression.email_address,
                suppression.full_name_and_domain
            ]);
            logger.info(`${req.session.username} Inserted DNC suppression record: ${suppression.full_name_and_domain}`);
        }
        res.send('DNC suppression records inserted successfully.');
    } catch (error) {
        logger.error(`${req.session.username} Error inserting DNC suppressions: ${error}`);
        res.status(500).send('Failed to insert DNC suppression records.');
    } finally {
        client.release();
        logger.info(`${req.session.username} Database connection released.`);
    }
}

module.exports = {
    insertDncSuppressionData
};