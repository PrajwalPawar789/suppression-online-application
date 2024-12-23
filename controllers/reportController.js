// controllers/reportController.js
const { Pool } = require('pg');

// Initialize the PostgreSQL connection pool
const pool = new Pool({
  user: "postgres",
  host: "158.220.121.203",
  database: "postgres",
  password: "P0stgr3s%098",
  port: 5432,
});


// Function to test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('Database connection successful');
    client.release();
  } catch (err) {
    console.error('Database connection error:', err.message);
  }
};

// Function to get the report data
const getReportData = async (req, res) => {
  console.log("Inside the getReportData function");

  const query = `
    SELECT  
      date_,
      client, 
      delivery_spoc, 
      country, 
      campaign_name, 
      end_client_name,
      call_disposition,
      COUNT(*) AS total_records
    FROM 
      public.campaigns
    WHERE
      date_ ~ $1 AND
      TO_DATE(date_, 'DD-Mon-YY') = CURRENT_DATE - INTERVAL '2 day'
    GROUP BY 
      date_,
      client, 
      delivery_spoc, 
      country, 
      campaign_name,
      end_client_name,
      call_disposition
    ORDER BY 
      date_ ASC, 
      client ASC, 
      delivery_spoc ASC, 
      country ASC, 
      campaign_name ASC, 
      end_client_name ASC, 
      call_disposition ASC;
  `;

  // Regular expression for date format validation
  const values = ['^\\d{2}-[A-Za-z]{3}-\\d{2}$'];

  try {
    // Test database connection (optional, can be removed if connection is stable)
    await testConnection();

    // Execute the query
    const result = await pool.query(query, values);

    console.log('Query Result:', result.rows); // Log the result for debugging

    // Send the result as JSON
    res.json(result.rows);
  } catch (error) {
    console.error('Error executing query:', error.message); // Log the error message for debugging
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = { getReportData };
