// controllers/linkedinLinkController.js

const { Pool } = require('pg');
const logger = require('./logger'); // Ensure you have a logger module

const pool = new Pool({
    user: "postgres",
    host: "158.220.121.203",
    database: "postgres",
    password: "P0stgr3s%098",
    port: 5432,
  });

async function linkedinLinkApi(req, res) {
    const { linkedinLink } = req.body; // Get linkedinLink and clientCode from the request body

    if (!linkedinLink ) {
        return res.status(400).json({ error: 'Missing required fields: linkedinLink' });
    }

    logger.info(`Received LinkedIn link: ${linkedinLink}`);

    // Optimize query by using specific columns and ensuring that columns are indexed.
    const selectQuery = `
        SELECT date_,first_name, last_name, company_name, job_title, email, linkedin_link, client, campaign_name
        FROM public.campaigns
        WHERE linkedin_link = $1;
    `;

    // Using connection pooling and handling errors efficiently
    let client;
    try {
        client = await pool.connect();

        logger.info(`Executing SELECT query with LinkedIn link: ${linkedinLink}`);
        const result = await client.query(selectQuery, [linkedinLink]);

        if (result.rows.length === 0) {
            logger.info(`No data found for LinkedIn link: ${linkedinLink}`);
            return res.status(404).json({ message: 'No data found for the provided LinkedIn link.' });
        }

        logger.info(`Query result: ${JSON.stringify(result.rows[0])}`);
        res.json(result.rows[0]);
    } catch (error) {
        // Improved error handling with specific error codes
        logger.error(`Error occurred while fetching LinkedIn link data: ${error.message}`);
        res.status(500).json({ error: 'An error occurred while fetching data.' });
    } finally {
        if (client) {
            client.release();
            logger.info('Database connection released.');
        }
    }
}

module.exports = {
    linkedinLinkApi
};
