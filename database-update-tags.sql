-- Tabela para tags
CREATE TABLE IF NOT EXISTS tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  color VARCHAR(20) DEFAULT '#6b7280',
  icon VARCHAR(50),
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_tag_name (name)
);

-- Tabela para associar tags a usuários
CREATE TABLE IF NOT EXISTS user_tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  tag_id INT NOT NULL,
  assigned_by INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_tag (user_id, tag_id)
);

-- Tabela para associar tags a chats/grupos
CREATE TABLE IF NOT EXISTS chat_tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  chat_id INT NOT NULL,
  tag_id INT NOT NULL,
  assigned_by INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_chat_tag (chat_id, tag_id)
);

-- Tabela para permissões baseadas em tags
CREATE TABLE IF NOT EXISTS tag_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tag_id INT NOT NULL,
  permission_name VARCHAR(50) NOT NULL,
  permission_value BOOLEAN DEFAULT TRUE,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_tag_permission (tag_id, permission_name)
);

-- Tabela para arquivamento de chats
CREATE TABLE IF NOT EXISTS archived_chats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  chat_id INT NOT NULL,
  archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  UNIQUE KEY unique_archived_chat (user_id, chat_id)
);

-- Adicionar índices para consultas eficientes
CREATE INDEX idx_user_tags_user_id ON user_tags(user_id);
CREATE INDEX idx_user_tags_tag_id ON user_tags(tag_id);
CREATE INDEX idx_chat_tags_chat_id ON chat_tags(chat_id);
CREATE INDEX idx_chat_tags_tag_id ON chat_tags(tag_id);
CREATE INDEX idx_tag_permissions_tag_id ON tag_permissions(tag_id);
CREATE INDEX idx_archived_chats_user_id ON archived_chats(user_id);
CREATE INDEX idx_archived_chats_chat_id ON archived_chats(chat_id);

-- Adicionar coluna para armazenar configurações de grupo
ALTER TABLE chats ADD COLUMN settings JSON DEFAULT NULL;

