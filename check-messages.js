const mysql = require('mysql2/promise');

async function checkAudioMessages() {
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

    console.log('Verificando mensagens de áudio...');
    const [rows] = await pool.execute(
      'SELECT id, chat_id, sender_id, content, type, additional_data, created_at FROM messages WHERE type = ? ORDER BY created_at DESC LIMIT 10',
      ['audio']
    );
    
    console.log(`Encontradas ${rows.length} mensagens de áudio:`);
    rows.forEach(row => {
      console.log('------------------------------------');
      console.log(`ID: ${row.id}`);
      console.log(`Chat ID: ${row.chat_id}`);
      console.log(`Sender ID: ${row.sender_id}`);
      console.log(`Content (URL): ${row.content}`);
      console.log(`Additional Data: ${row.additional_data}`);
      console.log(`Created At: ${row.created_at}`);
      console.log('------------------------------------');
    });

    process.exit(0);
  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  }
}

checkAudioMessages(); 