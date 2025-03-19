const mysql = require('mysql2/promise');

async function addColumn() {
  try {
    console.log('Conectando ao banco de dados...');
    const pool = await mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'chatuser',
      password: process.env.MYSQL_PASSWORD || 'chatuser',
      database: process.env.MYSQL_DATABASE || 'chat_app',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log('Verificando se a coluna já existe...');
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
    `, [process.env.MYSQL_DATABASE || 'chat_app', 'messages', 'additional_data']);

    if (columns.length > 0) {
      console.log('A coluna additional_data já existe!');
      process.exit(0);
    }

    console.log('Adicionando coluna additional_data...');
    await pool.execute(`
      ALTER TABLE messages 
      ADD COLUMN additional_data TEXT AFTER reply_to
    `);

    console.log('Coluna additional_data adicionada com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  }
}

addColumn(); 