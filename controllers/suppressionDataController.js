const { Pool } = require('pg');
const readXlsxFile = require('read-excel-file/node');
const { format, parse, isValid } = require('date-fns');
const logger = require('./logger'); // Ensure you have a logger module

const pool = new Pool({
    user: "postgres",
    host: "158.220.121.203",
    database: "postgres",
    password: "P0stgr3s%098",
    port: 5432,
  });


async function insertSuppressionData(rowData, index, username) {
    const client = await pool.connect();
    try {
        const checkQuery = `
            SELECT 1 FROM campaigns 
            WHERE client = $1 AND campaign_id = $2 AND end_client_name = $3 
            AND left_3 = $4 AND left_4 = $5 AND linkedin_link = $6;
        `;
        const checkResult = await client.query(checkQuery, [
            rowData.client, rowData.campaignId, rowData.endClientName, 
            rowData.left3, rowData.left4, rowData.linkedinLink
        ]);

        if (checkResult.rows.length === 0) {
            const insertQuery = `
                INSERT INTO campaigns (
                    date_, month_, campaign_id, client, end_client_name, campaign_name,
                    first_name, last_name, company_name, country, phone, email,
                    linkedin_link, job_title, employee_size, asset, delivery_spoc,
                    left_3, left_4, call_disposition, bcl_ops_tl_name, response_date
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                    $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
                );
            `;
            await client.query(insertQuery, [
                rowData.date, rowData.month, rowData.campaignId, rowData.client, rowData.endClientName, rowData.campaignName,
                rowData.firstName, rowData.lastName, rowData.companyName, rowData.country, rowData.phone, rowData.email,
                rowData.linkedinLink, rowData.jobTitle, rowData.employeeSize, rowData.asset, rowData.deliverySpoc,
                rowData.left3, rowData.left4, rowData.callDisposition, rowData.bclOpsTlName, rowData.responseDate
            ]);
            logger.info(`${username} - Inserted new record for row ${index + 1}: email=${rowData.email}, left3=${rowData.left3}, left4=${rowData.left4}, client=${rowData.client}`);
        } else {
            logger.info(`${username} - Duplicate record found for row ${index + 1}: email=${rowData.email}, left3=${rowData.left3}, left4=${rowData.left4}, client=${rowData.client}`);
        }
    } catch (error) {
        logger.error(`${username} - Error processing row ${index + 1}: ${error.message}`);
    } finally {
        client.release();
        logger.info(`${username} - Database connection released.`);
    }
}

async function processExcel(req, res) {
    const username = req.session.username || 'Anonymous'; // Fallback if username is not set
    logger.info(`${username} - File upload request received.`);

    if (!req.file) {
        logger.warn(`${username} - No file uploaded.`);
        return res.status(400).send('No file uploaded.');
    }

    if (!req.file.originalname.endsWith(".xlsx")) {
        logger.warn(`${username} - Uploaded file is not an Excel file.`);
        return res.status(400).send("Uploaded file is not an Excel file.");
    }

    const path = req.file.path;
    try {
        const rows = await readXlsxFile(path);
        logger.info(`${username} - Total rows (including header): ${rows.length}`);

        const headers = rows[0];
        const dataRows = rows.slice(1);
        logger.info(`${username} - Processing ${dataRows.length} rows of data.`);

        const requiredHeaders = [
            'date_', 'month_', 'campaign_id', 'client', 'end_client_name', 'campaign_name',
            'first_name', 'last_name', 'company_name', 'country', 'phone', 'email',
            'linkedin_link', 'job_title', 'employee_size', 'asset', 'delivery_spoc',
            'left_3', 'left_4', 'call_disposition', 'bcl_ops_tl_name', 'response_date'
        ];

        const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
        if (missingHeaders.length > 0) {
            logger.warn(`${username} - Missing required headers: ${missingHeaders.join(', ')}`);
            return res.status(400).send(`Missing required headers: ${missingHeaders.join(', ')}`);
        }

        const indexes = {
            date: headers.indexOf('date_'),
            month: headers.indexOf('month_'),
            campaignId: headers.indexOf('campaign_id'),
            client: headers.indexOf('client'),
            endClientName: headers.indexOf('end_client_name'),
            campaignName: headers.indexOf('campaign_name'),
            firstName: headers.indexOf('first_name'),
            lastName: headers.indexOf('last_name'),
            companyName: headers.indexOf('company_name'),
            country: headers.indexOf('country'),
            phone: headers.indexOf('phone'),
            email: headers.indexOf('email'),
            linkedinLink: headers.indexOf('linkedin_link'),
            jobTitle: headers.indexOf('job_title'),
            employeeSize: headers.indexOf('employee_size'),
            asset: headers.indexOf('asset'),
            deliverySpoc: headers.indexOf('delivery_spoc'),
            left3: headers.indexOf('left_3'),
            left4: headers.indexOf('left_4'),
            callDisposition: headers.indexOf('call_disposition'),
            bclOpsTlName: headers.indexOf('bcl_ops_tl_name'),
            responseDate: headers.indexOf('response_date')
        };

        await Promise.all(dataRows.map(async (row, index) => {
            const parseDate = (dateValue) => {
                if (dateValue === '-') {
                    return '-';
                } else if (dateValue instanceof Date) {
                    return format(dateValue, 'dd-MMM-yy');
                } else if (typeof dateValue === 'string') {
                    const parsedDate = parse(dateValue, 'dd-MMM-yy', new Date());
                    if (!isValid(parsedDate)) {
                        logger.error(`${username} - Invalid date format at row ${index + 1}: ${dateValue}`);
                        throw new Error(`Invalid date format at row ${index + 1}: ${dateValue}`);
                    }
                    return format(parsedDate, 'dd-MMM-yy');
                } else if (typeof dateValue === 'number') {
                    const excelEpoch = new Date(0, 0, dateValue - (25567 + 1)); // days since 1900-01-01
                    return format(excelEpoch, 'dd-MMM-yy');
                } else {
                    logger.error(`${username} - Unexpected dateValue type: ${typeof dateValue} at row ${index + 1}. Uploaded date: ${dateValue}`);
                    throw new Error(`Unexpected dateValue type: ${typeof dateValue} at row ${index + 1}. Uploaded date: ${dateValue}`);
                }
            };

            logger.info(`${username} - Row ${index + 1} - Raw date value: ${row[indexes.date]}, Type: ${typeof row[indexes.date]}`);
            logger.info(`${username} - Row ${index + 1} - Raw response date value: ${row[indexes.responseDate]}, Type: ${typeof row[indexes.responseDate]}`);

            const rowData = {
                date: parseDate(row[indexes.date]),
                month: row[indexes.month],
                campaignId: row[indexes.campaignId],
                client: row[indexes.client],
                endClientName: row[indexes.endClientName],
                campaignName: row[indexes.campaignName],
                firstName: row[indexes.firstName],
                lastName: row[indexes.lastName],
                companyName: row[indexes.companyName],
                country: row[indexes.country],
                phone: row[indexes.phone],
                email: row[indexes.email],
                linkedinLink: row[indexes.linkedinLink],
                jobTitle: row[indexes.jobTitle],
                employeeSize: row[indexes.employeeSize],
                asset: row[indexes.asset],
                deliverySpoc: row[indexes.deliverySpoc],
                left3: row[indexes.left3],
                left4: row[indexes.left4],
                callDisposition: row[indexes.callDisposition],
                bclOpsTlName: row[indexes.bclOpsTlName],
                responseDate: (typeof row[indexes.responseDate] === 'string' && row[indexes.responseDate].trim() !== '') 
                              ? parseDate(row[indexes.responseDate]) 
                              : '-' // Default to '-' if empty or not a string
            };
            return insertSuppressionData(rowData, index, username);
        }));

        res.send('Processed successfully. Check server logs for results.');
    } catch (err) {
        logger.error(`${username} - Error processing file: ${err.message}`);
        res.status(500).send('Failed to process file.');
    }
}

module.exports = {
    processExcel,
    insertSuppressionData
};


