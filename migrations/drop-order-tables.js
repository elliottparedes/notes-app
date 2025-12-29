import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function dropTables() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('Dropping order tables...');

    await connection.query('DROP TABLE IF EXISTS user_page_orders');
    console.log('Dropped user_page_orders');

    await connection.query('DROP TABLE IF EXISTS user_section_orders');
    console.log('Dropped user_section_orders');

    await connection.query('DROP TABLE IF EXISTS user_notebook_orders');
    console.log('Dropped user_notebook_orders');

    console.log('✅ All order tables dropped successfully');
  } finally {
    await connection.end();
  }
}

dropTables().catch(console.error);
