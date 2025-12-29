import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function checkTable() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    const [rows] = await connection.query('SHOW CREATE TABLE pages');
    console.log('Pages table structure:');
    console.log(rows[0]['Create Table']);
  } finally {
    await connection.end();
  }
}

checkTable().catch(console.error);
