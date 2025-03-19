const mysql = require('mysql2/promise');

async function showSchema() {
  try {
    console.log('Conectando ao banco de dados...');
    const pool = await mysql.createPool({
      host: 'localhost',
      user: 'chatuser',
      password: 'chatuser',
      database: 'chat_app',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log('Verificando schema da tabela messages...');
    const [rows] = await pool.execute('DESCRIBE messages');
    console.log('Schema da tabela messages:');
    
    // Imprime cada linha separadamente
    rows.forEach(row => {
      console.log(`Campo: ${row.Field}, Tipo: ${row.Type}, Null: ${row.Null}, Key: ${row.Key}, Default: ${row.Default}, Extra: ${row.Extra}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  }
}

showSchema(); 