require("dotenv").config;
const Pool = require("pg").Pool;
const env = require("dotenv");
env.config();

const pool = new Pool({
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  database: process.env.PG_DB,
  max: 5, // Limit connections to avoid overloading
  idleTimeoutMillis: 10000, // Close idle clients after 10 seconds
});

module.exports = pool;
