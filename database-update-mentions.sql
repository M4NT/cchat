-- Adicionar tabela para menções
CREATE TABLE IF NOT EXISTS user_mentions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NOT NULL,
  user_id INT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_mention (message_id, user_id)
);

-- Adicionar índices para consultas eficientes
CREATE INDEX idx_user_mentions_user_id ON user_mentions(user_id);
CREATE INDEX idx_user_mentions_message_id ON user_mentions(message_id);

