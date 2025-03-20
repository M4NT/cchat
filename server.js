const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")
const mysql = require("mysql2/promise")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const multer = require("multer")
const path = require("path")
const fs = require("fs")
const sharp = require("sharp")
const schedule = require("node-schedule")
const crypto = require("crypto")
const { v4: uuid } = require("uuid")

// Initialize express app
const app = express()
const server = http.createServer(app)

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}))
app.use(express.json())
app.use("/uploads", express.static(path.join(__dirname, "uploads")))
app.use("/uploads/user_avatars", express.static(path.join(__dirname, "uploads", "user_avatars"))) // Rota específica para avatares de usuários

// Diretórios de upload
const uploadsDir = path.join(__dirname, 'uploads');
const imagesDir = path.join(uploadsDir, 'images');
const filesDir = path.join(uploadsDir, 'files');
const audioDir = path.join(uploadsDir, 'audio');
const userAvatarsDir = path.join(uploadsDir, 'user_avatars');
const groupsDir = path.join(uploadsDir, 'groups');
const groupAvatarsDir = path.join(uploadsDir, 'group_avatars');

// Criar diretórios se não existirem
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

if (!fs.existsSync(filesDir)) {
  fs.mkdirSync(filesDir, { recursive: true });
}

if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

if (!fs.existsSync(userAvatarsDir)) {
  fs.mkdirSync(userAvatarsDir, { recursive: true });
}

if (!fs.existsSync(groupsDir)) {
  fs.mkdirSync(groupsDir, { recursive: true });
}

if (!fs.existsSync(groupAvatarsDir)) {
  fs.mkdirSync(groupAvatarsDir, { recursive: true });
}

// Set up multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isAvatar = req.path.includes("avatar")
    const isGroupAvatar = req.path.includes("groups/avatar")
    const isAudio = req.path.includes("audio")
    
    if (isAvatar) {
      cb(null, imagesDir)
    } else if (isGroupAvatar) {
      cb(null, groupsDir)
    } else if (isAudio) {
      cb(null, audioDir)
    } else {
      cb(null, filesDir)
    }
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname)
  },
})

const upload = multer({ storage })

// Database connection
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "localhost",
  user: process.env.MYSQL_USER || "chatuser",
  password: process.env.MYSQL_PASSWORD || "chatuser",
  database: process.env.MYSQL_DATABASE || "chat_app",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

// Initialize database tables
async function initDatabase() {
  try {
    // Create users table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        avatar VARCHAR(255),
        is_online BOOLEAN DEFAULT FALSE,
        socket_id VARCHAR(255),
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Create chats table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS chats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        avatar VARCHAR(255),
        is_group BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)

    // Create chat_participants table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS chat_participants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        chat_id INT NOT NULL,
        user_id INT NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_chat_participant (chat_id, user_id)
      )
    `)

    // Create messages table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        chat_id INT NOT NULL,
        sender_id INT NOT NULL,
        content TEXT NOT NULL,
        type ENUM('text', 'image', 'audio', 'file', 'location', 'poll', 'link', 'system') DEFAULT 'text',
        is_read BOOLEAN DEFAULT FALSE,
        reply_to INT,
        additional_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reply_to) REFERENCES messages(id) ON DELETE SET NULL
      )
    `)

    // Create message_reactions table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS message_reactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message_id INT NOT NULL,
        user_id INT NOT NULL,
        emoji VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_reaction (message_id, user_id, emoji)
      )
    `)

    // Create scheduled_messages table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS scheduled_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        chat_id INT NOT NULL,
        sender_id INT NOT NULL,
        content TEXT NOT NULL,
        scheduled_for TIMESTAMP NOT NULL,
        is_sent BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)
    
    // Create chat_settings table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS chat_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        chat_id INT NOT NULL,
        settings TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
      )
    `)
    
    // Create chat_tags table if not exists
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS chat_tags (
        id INT AUTO_INCREMENT PRIMARY KEY,
        chat_id INT NOT NULL,
        tag_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
      )
    `)
    
    // Create tags table if not exists
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS tags (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        color VARCHAR(20),
        description VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by INT,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `)

    // Create polls table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS polls (
        id INT AUTO_INCREMENT PRIMARY KEY,
        chat_id INT NOT NULL,
        creator_id INT NOT NULL,
        question TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NULL,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
        FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)
    
    // Create poll options table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS poll_options (
        id INT AUTO_INCREMENT PRIMARY KEY,
        poll_id INT NOT NULL,
        text VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
      )
    `)
    
    // Create poll votes table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS poll_votes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        poll_id INT NOT NULL,
        option_id INT NOT NULL,
        user_id INT NOT NULL,
        voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
        FOREIGN KEY (option_id) REFERENCES poll_options(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_vote (poll_id, user_id)
      )
    `)

    console.log("Database tables initialized")
  } catch (error) {
    console.error("Error initializing database:", error)
    throw error
  }
}

// Initialize database
initDatabase().catch(console.error)

// Alteração adicional para permitir o tipo 'link' na tabela mensagens
async function updateMessageTypes() {
  try {
    console.log("Tentando atualizar a tabela de mensagens para suportar o tipo 'link'...");
    await pool.execute(`
      ALTER TABLE messages 
      MODIFY COLUMN type ENUM('text', 'image', 'audio', 'file', 'location', 'poll', 'link', 'system') DEFAULT 'text'
    `);
    console.log("Tabela de mensagens atualizada com sucesso!");
  } catch (error) {
    console.error("Erro ao atualizar tabela de mensagens:", error.message);
  }

  try {
    console.log("Verificando se é necessário modificar a coluna 'sender_id' para permitir NULL...");
    await pool.execute(`
      ALTER TABLE messages 
      MODIFY COLUMN sender_id INT NULL
    `);
    console.log("Coluna sender_id modificada para aceitar NULL com sucesso!");
  } catch (error) {
    console.error("Erro ao modificar coluna sender_id:", error.message);
  }
}

// Executar atualização
updateMessageTypes().catch(console.error);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  debug: false // Desativa logs excessivos
})

// Adicionar io à aplicação para que as rotas possam acessá-lo
app.set('socketio', io);

// Socket connection tracking to avoid duplicate connections
const socketConnections = new Map();

// Adicionar o mapa de conexões à aplicação para que as rotas possam acessá-lo
app.set('socketConnections', socketConnections);

// Middleware for JWT authentication
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization

  if (authHeader) {
    const token = authHeader.split(" ")[1]

    jwt.verify(token, process.env.JWT_SECRET || "your-secret-key", (err, user) => {
      if (err) {
        return res.status(403).json({ message: "Token inválido ou expirado" })
      }

      req.user = user
      next()
    })
  } else {
    res.status(401).json({ message: "Token de autenticação não fornecido" })
  }
}

// Helper function to encrypt messages
function encryptMessage(text, key) {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(key, "hex"), iv)
  let encrypted = cipher.update(text)
  encrypted = Buffer.concat([encrypted, cipher.final()])
  return iv.toString("hex") + ":" + encrypted.toString("hex")
}

// Helper function to decrypt messages
function decryptMessage(text, key) {
  const textParts = text.split(":")
  const iv = Buffer.from(textParts[0], "hex")
  const encryptedText = Buffer.from(textParts[1], "hex")
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(key, "hex"), iv)
  let decrypted = decipher.update(encryptedText)
  decrypted = Buffer.concat([decrypted, decipher.final()])
  return decrypted.toString()
}

// Generate a random encryption key
const ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex")

// Socket.io connection handler
io.on("connection", (socket) => {
  console.log(`Nova conexão socket: ${socket.id}`)
  
  socket.on("disconnect", (reason) => {
    // Remove do mapa ao desconectar
    for (const [userId, socketId] of socketConnections.entries()) {
      if (socketId === socket.id) {
        console.log(`Usuário ${userId} desconectado: ${reason}`)
        socketConnections.delete(userId)
      }
    }
  })

  socket.on("error", (error) => {
    console.error(`Erro no socket ${socket.id}:`, error)
  })

  // User login
  socket.on("user:login", async (user) => {
    try {
      if (!user || !user.id) {
        console.log("Tentativa de login inválida - usuário sem ID", user)
        return socket.emit("error", { message: "Dados de usuário inválidos" })
      }
      
      console.log(`Login de usuário: ${user.id} (Socket: ${socket.id})`)
      
      // Verifica se já existe uma conexão para este usuário
      if (socketConnections.has(user.id)) {
        const existingSocketId = socketConnections.get(user.id)
        if (existingSocketId !== socket.id) {
          console.log(`Desconectando socket anterior para usuário ${user.id}: ${existingSocketId}`)
          const existingSocket = io.sockets.sockets.get(existingSocketId)
          if (existingSocket) {
            existingSocket.disconnect(true)
          }
        }
      }
      
      // Registra esta conexão para o usuário
      socketConnections.set(user.id, socket.id)

      // Update user status to online and socket ID
      await pool.execute("UPDATE users SET is_online = 1, socket_id = ?, last_seen = NOW() WHERE id = ?", [
        socket.id,
        user.id,
      ])

      // Join user's room
      socket.join(`user:${user.id}`)

      // Get user's chats
      const [chats] = await pool.execute(
        `
        SELECT c.*, 
          (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_content,
          (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time,
          (SELECT sender_id FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_sender_id
        FROM chats c
        JOIN chat_participants cp ON c.id = cp.chat_id
        WHERE cp.user_id = ?
        ORDER BY c.updated_at DESC
      `,
        [user.id],
      )

      // Get participants for each chat
      for (const chat of chats) {
        const [participants] = await pool.execute(
          `
          SELECT u.id, u.name, u.email, u.avatar, u.is_online, cp.is_admin
          FROM users u
          JOIN chat_participants cp ON u.id = cp.user_id
          WHERE cp.chat_id = ? AND u.id != ?
        `,
          [chat.id, user.id],
        )

        chat.participants = participants

        // Get last message
        if (chat.last_message_content) {
          chat.lastMessage = {
            content: chat.last_message_content,
            timestamp: chat.last_message_time,
          }

          // Remove these properties as they're now in lastMessage
          delete chat.last_message_content
          delete chat.last_message_time
        }
      }

      // Send chats to user
      socket.emit("chat:list", chats)

      // Broadcast user's online status to other users
      socket.broadcast.emit("user:status", { userId: user.id, isOnline: true })
    } catch (error) {
      console.error("Error in user:login:", error)
      socket.emit("error", { message: "Failed to login" })
    }
  })

  // User logout
  socket.on("disconnect", async () => {
    try {
      // Find user by socket id and update status to offline
      const [users] = await pool.execute("SELECT * FROM users WHERE socket_id = ?", [socket.id])

      if (users && users.length > 0) {
        const user = users[0]

        await pool.execute("UPDATE users SET is_online = 0, last_seen = NOW() WHERE id = ?", [user.id])

        // Broadcast user's offline status to other users
        socket.broadcast.emit("user:status", { userId: user.id, isOnline: false })
      }
    } catch (error) {
      console.error("Error in disconnect:", error)
    }
  })

  // Join chat room
  socket.on("chat:join", (chatId) => {
    socket.join(`chat:${chatId}`)
  })

  // Get chat history
  socket.on("message:history", async (chatId) => {
    try {
      const [messages] = await pool.execute(
        `
        SELECT m.*, u.id as sender_id, u.name as sender_name, u.avatar as sender_avatar,
          rm.id as reply_id, rm.content as reply_content, ru.name as reply_sender_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        LEFT JOIN messages rm ON m.reply_to = rm.id
        LEFT JOIN users ru ON rm.sender_id = ru.id
        WHERE m.chat_id = ?
        ORDER BY m.created_at ASC
      `,
        [chatId],
      )

      // Get reactions for each message
      for (const message of messages) {
        const [reactions] = await pool.execute(
          `
          SELECT mr.emoji, COUNT(*) as count, GROUP_CONCAT(mr.user_id) as users
          FROM message_reactions mr
          WHERE mr.message_id = ?
          GROUP BY mr.emoji
        `,
          [message.id],
        )

        if (reactions.length > 0) {
          message.reactions = reactions.map((r) => ({
            emoji: r.emoji,
            count: Number.parseInt(r.count),
            users: r.users.split(","),
          }))
        }
      }

      // Format messages
      const formattedMessages = messages.map((message) => {
        // Parse additional data if exists
        let additionalData = null;
        if (message.additional_data) {
          try {
            additionalData = JSON.parse(message.additional_data);
          } catch (error) {
            console.error("Error parsing additional data for message ID " + message.id, error);
          }
        }
        
        const formattedMessage = {
          id: message.id,
          chatId: message.chat_id,
          content: message.content,
          type: message.type,
          timestamp: message.created_at,
          sender: {
            id: message.sender_id,
            name: message.sender_name,
            avatar: message.sender_avatar,
          },
        }

        // Add reply information if this message is a reply
        if (message.reply_id) {
          formattedMessage.replyTo = {
            id: message.reply_id,
            content: message.reply_content,
            sender: {
              name: message.reply_sender_name,
            },
          }
        }

        // Add reactions if any
        if (message.reactions) {
          formattedMessage.reactions = message.reactions
        }
        
        // Add additional data (like fileName for audio/file)
        if (additionalData) {
          // Merge additional data into the message
          Object.assign(formattedMessage, additionalData);
        }

        return formattedMessage
      })

      socket.emit("message:history", formattedMessages)
    } catch (error) {
      console.error("Error in message:history:", error)
      socket.emit("error", { message: "Failed to get message history" })
    }
  })

  // Send message
  socket.on("message:send", async (message) => {
    try {
      console.log("[DEBUG] Recebendo mensagem para enviar:", message);
      console.log("[DEBUG] Tipo da mensagem:", message.type, "É link?", message.type === 'link', "isLink flag:", message.isLink);

      // Garantir que temos um sender válido
      if (!message.sender || !message.sender.id) {
        return socket.emit("error", { message: "Dados do remetente inválidos" });
      }

      // Obter informações completas do remetente
      const [senders] = await pool.execute(
        "SELECT id, name, email, avatar, is_online FROM users WHERE id = ?",
        [message.sender.id]
      );

      if (senders.length === 0) {
        return socket.emit("error", { message: "Usuário não encontrado" });
      }

      const sender = senders[0];
      
      // Verificar se há informações adicionais específicas do tipo de mensagem
      let additionalData = null;
      
      if (message.type === "audio") {
        additionalData = {
          fileName: message.fileName || "Audio Recording"
        };
      } else if (message.type === "file") {
        additionalData = {
          fileName: message.fileName || "File"
        };
      } else if (message.type === "link") {
        console.log("[DEBUG] Processando mensagem do tipo LINK no servidor:", message.content);
        additionalData = {
          fileName: message.fileName || "Link compartilhado",
          isLink: true // Sempre definimos isLink como true para mensagens de tipo 'link'
        };

        // Verificar se a mensagem tem a propriedade isLink explícita
        if (message.isLink !== undefined) {
          additionalData.isLink = Boolean(message.isLink);
          console.log("[DEBUG] Preservando flag isLink como:", additionalData.isLink);
        }
        
        // Não modifica content, pois ele contém o JSON do link
      }
      
      // Construir a coluna de conteúdo
      let content = message.content;
      
      console.log("Preparando para salvar mensagem no banco:", {
        chatId: message.chatId,
        senderId: message.sender.id,
        content: typeof content === 'string' && content.length > 100 ? content.substring(0, 100) + '...' : content,
        type: message.type || "text",
        replyTo: message.replyTo ? message.replyTo.id : null,
        additionalData: additionalData
      });
      
      // Save message to database
      const [result] = await pool.execute(
        "INSERT INTO messages (chat_id, sender_id, content, type, reply_to, additional_data) VALUES (?, ?, ?, ?, ?, ?)",
        [
          message.chatId,
          message.sender.id,
          content,
          message.type || "text",
          message.replyTo ? message.replyTo.id : null,
          additionalData ? JSON.stringify(additionalData) : null
        ]
      );

      // Atualizar o chat para mostrar a última mensagem
      await pool.execute("UPDATE chats SET updated_at = NOW() WHERE id = ?", [message.chatId]);

      // Criar mensagem com ID e informações completas do remetente
      const newMessage = {
        id: result.insertId,
        chatId: message.chatId,
        content: message.content,
        timestamp: new Date().toISOString(),
        type: message.type || "text",
        sender: {
          id: sender.id.toString(),
          name: sender.name,
          avatar: sender.avatar,
          is_online: Boolean(sender.is_online)
        },
        replyTo: message.replyTo,
        additionalData: additionalData
      };

      console.log("Enviando mensagem para o chat:", message.chatId);

      // Broadcast message to all users in the chat
      console.log("[DEBUG] Enviando mensagem para o chat:", message.chatId, 
        "Tipo:", newMessage.type, 
        "AdditionalData:", additionalData);
      
      io.to(`chat:${message.chatId}`).emit("message:new", newMessage);
    } catch (error) {
      console.error("Error in message:send:", error);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  // Delete message
  socket.on("message:delete", async ({ messageId, chatId }) => {
    try {
      // Check if user is the sender of the message
      const [messages] = await pool.execute("SELECT * FROM messages WHERE id = ?", [messageId])

      if (messages.length === 0) {
        return socket.emit("error", { message: "Message not found" })
      }

      const message = messages[0]

      // Get user ID from socket
      const [users] = await pool.execute("SELECT * FROM users WHERE socket_id = ?", [socket.id])

      if (users.length === 0) {
        return socket.emit("error", { message: "User not found" })
      }

      const user = users[0]

      // Check if user is the sender or an admin
      if (message.sender_id !== user.id) {
        const [participants] = await pool.execute(
          "SELECT * FROM chat_participants WHERE chat_id = ? AND user_id = ? AND is_admin = 1",
          [chatId, user.id],
        )

        if (participants.length === 0) {
          return socket.emit("error", { message: "You are not authorized to delete this message" })
        }
      }

      // Delete message
      await pool.execute("DELETE FROM messages WHERE id = ?", [messageId])

      // Notify all users in the chat
      io.to(`chat:${chatId}`).emit("message:deleted", { messageId, chatId })
    } catch (error) {
      console.error("Error in message:delete:", error)
      socket.emit("error", { message: "Failed to delete message" })
    }
  })

  // Add reaction to message
  socket.on("message:reaction", async ({ messageId, chatId, userId, emoji }) => {
    try {
      // Check if reaction already exists
      const [existingReactions] = await pool.execute(
        "SELECT * FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?",
        [messageId, userId, emoji],
      )

      if (existingReactions.length > 0) {
        // Remove reaction
        await pool.execute("DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?", [
          messageId,
          userId,
          emoji,
        ])
      } else {
        // Add reaction
        await pool.execute("INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)", [
          messageId,
          userId,
          emoji,
        ])
      }

      // Notify all users in the chat
      io.to(`chat:${chatId}`).emit("message:reaction", { messageId, userId, emoji })
    } catch (error) {
      console.error("Error in message:reaction:", error)
      socket.emit("error", { message: "Failed to add reaction" })
    }
  })

  // Schedule message
  socket.on("message:schedule", async ({ chatId, senderId, content, scheduledFor }) => {
    try {
      // Save scheduled message to database
      const [result] = await pool.execute(
        "INSERT INTO scheduled_messages (chat_id, sender_id, content, scheduled_for) VALUES (?, ?, ?, ?)",
        [chatId, senderId, content, scheduledFor],
      )

      const scheduledMessageId = result.insertId

      // Schedule job to send message
      const scheduledDate = new Date(scheduledFor)
      schedule.scheduleJob(scheduledDate, async () => {
        try {
          // Get scheduled message
          const [scheduledMessages] = await pool.execute(
            "SELECT * FROM scheduled_messages WHERE id = ? AND is_sent = 0",
            [scheduledMessageId],
          )

          if (scheduledMessages.length === 0) {
            return // Message already sent or deleted
          }

          const scheduledMessage = scheduledMessages[0]

          // Get sender info
          const [senders] = await pool.execute("SELECT * FROM users WHERE id = ?", [scheduledMessage.sender_id])

          if (senders.length === 0) {
            return // Sender not found
          }

          const sender = senders[0]

          // Save message to database without encryption
          const [result] = await pool.execute(
            "INSERT INTO messages (chat_id, sender_id, content, type) VALUES (?, ?, ?, ?)",
            [scheduledMessage.chat_id, scheduledMessage.sender_id, scheduledMessage.content, "text"],
          )

          // Mark scheduled message as sent
          await pool.execute("UPDATE scheduled_messages SET is_sent = 1 WHERE id = ?", [scheduledMessageId])

          // Broadcast message to all users in the chat
          const newMessage = {
            id: result.insertId,
            chatId: scheduledMessage.chat_id,
            content: scheduledMessage.content,
            timestamp: new Date().toISOString(),
            type: "text",
            sender: {
              id: sender.id,
              name: sender.name,
              avatar: sender.avatar,
            },
          }

          io.to(`chat:${scheduledMessage.chat_id}`).emit("message:new", newMessage)

          // Update last message in chat
          await pool.execute("UPDATE chats SET updated_at = NOW() WHERE id = ?", [scheduledMessage.chat_id])
        } catch (error) {
          console.error("Error sending scheduled message:", error)
        }
      })

      socket.emit("message:scheduled", { id: scheduledMessageId, scheduledFor })
    } catch (error) {
      console.error("Error in message:schedule:", error)
      socket.emit("error", { message: "Failed to schedule message" })
    }
  })

  // Create new chat or group
  socket.on("chat:create", async (chatData) => {
    try {
      console.log("Recebido evento chat:create com dados:", chatData);
      
      // Start a transaction
      const connection = await pool.getConnection()
      await connection.beginTransaction()

      try {
        // Verificar se já existe um chat individual entre os usuários
        if (!chatData.isGroup) {
          const [existingChats] = await connection.execute(
            `
            SELECT c.id
            FROM chats c
            JOIN chat_participants cp1 ON c.id = cp1.chat_id
            JOIN chat_participants cp2 ON c.id = cp2.chat_id
            WHERE c.is_group = 0
            AND cp1.user_id = ?
            AND cp2.user_id = ?
            `,
            [chatData.participants[0], chatData.participants[1]]
          )

          if (existingChats.length > 0) {
            // Se já existe um chat, apenas retorna ele
            const chatId = existingChats[0].id
            const [chats] = await connection.execute(
              `
              SELECT 
                c.*,
                GROUP_CONCAT(DISTINCT u.id) as participant_ids,
                GROUP_CONCAT(DISTINCT u.name) as participant_names,
                GROUP_CONCAT(DISTINCT u.email) as participant_emails,
                GROUP_CONCAT(DISTINCT u.avatar) as participant_avatars,
                GROUP_CONCAT(DISTINCT u.is_online) as participant_online_status,
                GROUP_CONCAT(DISTINCT cp.is_admin) as participant_is_admin
              FROM chats c
              JOIN chat_participants cp ON c.id = cp.chat_id
              JOIN users u ON cp.user_id = u.id
              WHERE c.id = ?
              GROUP BY c.id
              `,
              [chatId]
            )

            if (chats.length > 0) {
              const chat = chats[0]
              
              // Parse participant information
              const participantIds = chat.participant_ids.split(',')
              const participantNames = chat.participant_names.split(',')
              const participantEmails = chat.participant_emails.split(',')
              const participantAvatars = chat.participant_avatars.split(',')
              const participantOnlineStatus = chat.participant_online_status.split(',').map(status => status === '1')
              const participantIsAdmin = chat.participant_is_admin.split(',').map(status => status === '1')
              
              // Format participants array
              chat.participants = participantIds.map((id, index) => ({
                id: id.toString(),
                name: participantNames[index],
                email: participantEmails[index],
                avatar: participantAvatars[index],
                is_online: participantOnlineStatus[index],
                isAdmin: participantIsAdmin[index]
              }))

              // Remove concatenated fields
              delete chat.participant_ids
              delete chat.participant_names
              delete chat.participant_emails
              delete chat.participant_avatars
              delete chat.participant_online_status
              delete chat.participant_is_admin

              // Notify creator about the existing chat
              socket.emit("chat:new", chat)
              return
            }
          }
        }

        // Se não existe chat ou é um grupo, cria um novo
        // Verificar se temos um avatar para o grupo
        let avatarUrl = null;
        if (chatData.isGroup && chatData.avatar) {
          // Processar a URL do avatar
          // Garantir que a URL do avatar seja absoluta
          if (chatData.avatar && !chatData.avatar.startsWith('http')) {
            const host = process.env.PUBLIC_HOST || 'localhost:3001';
            const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
            avatarUrl = `${protocol}://${host}${chatData.avatar.startsWith('/') ? '' : '/'}${chatData.avatar}`;
            console.log("URL do avatar do grupo convertida para:", avatarUrl);
          } else {
            avatarUrl = chatData.avatar;
          }
        }
        
        console.log(`Criando ${chatData.isGroup ? 'grupo' : 'chat'} com avatar:`, avatarUrl);
        
        // Inserir o chat com o avatar se for disponibilizado
        const [chatResult] = await connection.execute(
          "INSERT INTO chats (name, is_group, avatar) VALUES (?, ?, ?)",
          [chatData.isGroup ? chatData.name || `Grupo (${chatData.participants.length})` : null, chatData.isGroup, avatarUrl]
        )

        const chatId = chatResult.insertId
        console.log(`${chatData.isGroup ? 'Grupo' : 'Chat'} criado com ID:`, chatId);
        
        // Add creator as admin if it's a group
        await connection.execute(
          "INSERT INTO chat_participants (chat_id, user_id, is_admin) VALUES (?, ?, ?)",
          [chatId, chatData.createdBy, chatData.isGroup]
        )

        // Add other participants
        for (const participantId of chatData.participants) {
          if (participantId !== chatData.createdBy) {
            await connection.execute(
              "INSERT INTO chat_participants (chat_id, user_id, is_admin) VALUES (?, ?, ?)",
              [chatId, participantId, false]
            )
          }
        }

        // Commit transaction
        await connection.commit()

        // Get complete chat data
        const [chats] = await pool.execute(
          `
          SELECT 
            c.*,
            GROUP_CONCAT(DISTINCT u.id) as participant_ids,
            GROUP_CONCAT(DISTINCT u.name) as participant_names,
            GROUP_CONCAT(DISTINCT u.email) as participant_emails,
            GROUP_CONCAT(DISTINCT u.avatar) as participant_avatars,
            GROUP_CONCAT(DISTINCT u.is_online) as participant_online_status,
            GROUP_CONCAT(DISTINCT cp.is_admin) as participant_is_admin
          FROM chats c
          JOIN chat_participants cp ON c.id = cp.chat_id
          JOIN users u ON cp.user_id = u.id
          WHERE c.id = ?
          GROUP BY c.id
          `,
          [chatId]
        )

        if (chats.length > 0) {
          const chat = chats[0]
          
          // Parse participant information
          const participantIds = chat.participant_ids.split(',')
          const participantNames = chat.participant_names.split(',')
          const participantEmails = chat.participant_emails.split(',')
          const participantAvatars = chat.participant_avatars.split(',')
          const participantOnlineStatus = chat.participant_online_status.split(',').map(status => status === '1')
          const participantIsAdmin = chat.participant_is_admin.split(',').map(status => status === '1')
          
          // Format participants array
          chat.participants = participantIds.map((id, index) => ({
            id: id.toString(),
            name: participantNames[index],
            email: participantEmails[index],
            avatar: participantAvatars[index],
            is_online: participantOnlineStatus[index],
            isAdmin: participantIsAdmin[index]
          }))

          // Remove concatenated fields
          delete chat.participant_ids
          delete chat.participant_names
          delete chat.participant_emails
          delete chat.participant_avatars
          delete chat.participant_online_status
          delete chat.participant_is_admin

          // Notify all participants about the new chat
          for (const participant of chat.participants) {
            io.to(`user:${participant.id}`).emit("chat:new", chat)
          }
        }
      } catch (error) {
        // Rollback transaction on error
        await connection.rollback()
        throw error
      } finally {
        connection.release()
      }
    } catch (error) {
      console.error("Error in chat:create:", error)
      socket.emit("error", { message: "Failed to create chat" })
    }
  })

  // Update chat/group
  socket.on("chat:update", async (chatData) => {
    try {
      console.log("Recebido pedido de atualização do grupo:", chatData);
      
      // Check if user is admin
      const [participants] = await pool.execute(
        "SELECT * FROM chat_participants WHERE chat_id = ? AND user_id = ? AND is_admin = 1",
        [chatData.id, chatData.userId],
      )

      if (participants.length === 0) {
        return socket.emit("error", { message: "You are not authorized to update this chat" })
      }
      
      // Se tem avatar, verificar se é uma URL completa ou relativa
      let avatarUrl = chatData.avatar;
      if (avatarUrl && !avatarUrl.startsWith('http')) {
        // Se for relativa, converter para URL completa
        avatarUrl = `${process.env.SERVER_URL || 'http://localhost:3001'}${avatarUrl.startsWith('/') ? '' : '/'}${avatarUrl}`;
        console.log("Avatar URL convertida para:", avatarUrl);
      }

      // Update chat
      await pool.execute("UPDATE chats SET name = ?, avatar = ? WHERE id = ?", [
        chatData.name,
        avatarUrl,
        chatData.id,
      ])
      
      console.log("Chat atualizado no banco de dados com avatar:", avatarUrl);
      
      // Atualizar configurações do grupo se fornecidas
      if (chatData.settings) {
        // Convertemos settings para string JSON para armazenar no banco
        const settingsJson = JSON.stringify(chatData.settings);
        
        // Verificar se já existe configuração para este grupo
        const [existingSettings] = await pool.execute(
          "SELECT * FROM chat_settings WHERE chat_id = ?",
          [chatData.id]
        );
        
        if (existingSettings && existingSettings.length > 0) {
          // Atualizar configurações existentes
          await pool.execute(
            "UPDATE chat_settings SET settings = ? WHERE chat_id = ?",
            [settingsJson, chatData.id]
          );
        } else {
          // Inserir novas configurações
          await pool.execute(
            "INSERT INTO chat_settings (chat_id, settings) VALUES (?, ?)",
            [chatData.id, settingsJson]
          );
        }
      }
      
      // Atualizar tags se fornecidas
      if (chatData.tags && Array.isArray(chatData.tags)) {
        // Primeiro remova todas as tags existentes
        await pool.execute(
          "DELETE FROM chat_tags WHERE chat_id = ?",
          [chatData.id]
        );
        
        // Depois insira as novas tags
        if (chatData.tags.length > 0) {
          // Preparar query para inserção em massa
          const placeholders = chatData.tags.map(() => "(?, ?)").join(", ");
          const values = [];
          
          chatData.tags.forEach(tagId => {
            values.push(id, tagId);
          });
          
          if (values.length > 0) {
            await pool.execute(
              `INSERT INTO chat_tags (chat_id, tag_id) VALUES ${placeholders}`,
              values
            );
          }
        }
      }

      // Get updated chat
      const [chats] = await pool.execute(
        `
        SELECT c.*
        FROM chats c
        WHERE c.id = ?
      `,
        [chatData.id],
      )

      if (chats.length > 0) {
        const chat = chats[0]

        // Get participants
        const [participants] = await pool.execute(
          `
          SELECT u.id, u.name, u.email, u.avatar, u.is_online, cp.is_admin
          FROM users u
          JOIN chat_participants cp ON u.id = cp.user_id
          WHERE cp.chat_id = ?
        `,
          [chatData.id],
        )

        chat.participants = participants
        
        // Obter configurações atualizadas
        const [groupSettings] = await pool.execute(
          "SELECT settings FROM chat_settings WHERE chat_id = ?",
          [chatData.id]
        );
        
        if (groupSettings && groupSettings.length > 0 && groupSettings[0].settings) {
          try {
            chat.settings = JSON.parse(groupSettings[0].settings);
          } catch (e) {
            console.error("Erro ao analisar configurações do grupo:", e);
            chat.settings = {};
          }
        } else {
          chat.settings = {};
        }
        
        console.log("Enviando dados atualizados do grupo para os clientes:", chat);

        // Notify all participants about the updated chat
        io.to(`chat:${chatData.id}`).emit("chat:updated", chat)
      }
    } catch (error) {
      console.error("Error in chat:update:", error)
      socket.emit("error", { message: "Failed to update chat" })
    }
  })

  // Delete chat
  socket.on("chat:delete", async (chatId) => {
    try {
      // Get participants before deleting
      const [participants] = await pool.execute(
        `
        SELECT user_id
        FROM chat_participants
        WHERE chat_id = ?
      `,
        [chatId],
      )

      // Delete chat (cascade will delete messages and participants)
      await pool.execute("DELETE FROM chats WHERE id = ?", [chatId])

      // Notify all participants about the deleted chat
      for (const participant of participants) {
        io.to(`user:${participant.user_id}`).emit("chat:deleted", chatId)
      }
    } catch (error) {
      console.error("Error in chat:delete:", error)
      socket.emit("error", { message: "Failed to delete chat" })
    }
  })

  // Leave chat/group
  socket.on("chat:leave", async (data) => {
    try {
      const { chatId, userId } = data;
      
      if (!chatId || !userId) {
        return socket.emit("error", { message: "Dados inválidos para sair do grupo" });
      }
      
      console.log(`Usuário ${userId} está saindo do grupo ${chatId}`);
      
      // Verificar se o chat é um grupo
      const [chatResults] = await pool.execute(
        "SELECT is_group FROM chats WHERE id = ?",
        [chatId]
      );
      
      if (chatResults.length === 0) {
        return socket.emit("error", { message: "Grupo não encontrado" });
      }
      
      if (!chatResults[0].is_group) {
        return socket.emit("error", { message: "Esta operação só é válida para grupos" });
      }
      
      // Verificar se o usuário está no grupo
      const [participantResults] = await pool.execute(
        "SELECT * FROM chat_participants WHERE chat_id = ? AND user_id = ?",
        [chatId, userId]
      );
      
      if (participantResults.length === 0) {
        return socket.emit("error", { message: "Você não é membro deste grupo" });
      }
      
      // Verificar se o usuário é o último administrador
      const [adminResults] = await pool.execute(
        "SELECT * FROM chat_participants WHERE chat_id = ? AND is_admin = 1",
        [chatId]
      );
      
      const isLastAdmin = adminResults.length === 1 && adminResults[0].user_id === userId;
      
      if (isLastAdmin) {
        const [otherParticipantsResults] = await pool.execute(
          "SELECT user_id FROM chat_participants WHERE chat_id = ? AND user_id != ?",
          [chatId, userId]
        );
        
        if (otherParticipantsResults.length > 0) {
          // Promover outro participante a administrador
          const newAdminId = otherParticipantsResults[0].user_id;
          await pool.execute(
            "UPDATE chat_participants SET is_admin = 1 WHERE chat_id = ? AND user_id = ?",
            [chatId, newAdminId]
          );
          
          console.log(`Novo administrador promovido: ${newAdminId}`);
        }
      }
      
      // Remover o usuário do grupo
      await pool.execute(
        "DELETE FROM chat_participants WHERE chat_id = ? AND user_id = ?",
        [chatId, userId]
      );
      
      console.log(`Usuário ${userId} removido do grupo ${chatId}`);
      
      // Notificar o usuário que saiu
      socket.emit("chat:left", { 
        chatId, 
        message: "Você saiu do grupo com sucesso" 
      });
      
      // Notificar outros participantes
      socket.to(`chat:${chatId}`).emit("chat:memberRemoved", {
        chatId,
        userId,
        success: true,
        message: `Um participante saiu do grupo`
      });
      
      // Verificar se não há mais participantes no grupo
      const [remainingParticipants] = await pool.execute(
        "SELECT COUNT(*) as count FROM chat_participants WHERE chat_id = ?",
        [chatId]
      );
      
      if (remainingParticipants[0].count === 0) {
        // Se não há mais participantes, excluir o grupo
        console.log(`Grupo ${chatId} não tem mais participantes, excluindo...`);
        await pool.execute("DELETE FROM chats WHERE id = ?", [chatId]);
      }
      
    } catch (error) {
      console.error("Erro ao sair do grupo:", error);
      socket.emit("error", { message: "Falha ao sair do grupo" });
    }
  });

  // Update user profile
  socket.on("user:update", async (userData) => {
    try {
      console.log("Recebido evento user:update:", userData);
      
      // Verificar se o usuário é o proprietário do socket
      const userId = userData.id;
      let isAuthorized = false;
      
      // Verificar se o ID do usuário corresponde ao socket atual
      for (const [id, socketId] of socketConnections.entries()) {
        if (id === userId && socketId === socket.id) {
          isAuthorized = true;
          break;
        }
      }
      
      if (!isAuthorized) {
        console.error(`Tentativa não autorizada de atualizar perfil de usuário ${userId} a partir do socket ${socket.id}`);
        return socket.emit("error", { message: "Não autorizado a atualizar este perfil de usuário" });
      }
      
      // Garantir que o avatar seja uma URL absoluta
      if (userData.avatar && !userData.avatar.startsWith('http')) {
        const host = process.env.PUBLIC_HOST || 'localhost:3001';
        const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
        userData.avatar = `${protocol}://${host}${userData.avatar.startsWith('/') ? '' : '/'}${userData.avatar}`;
      }
      
      // Update user in database
      await pool.execute("UPDATE users SET name = ?, email = ?, avatar = ? WHERE id = ?", [
        userData.name,
        userData.email,
        userData.avatar,
        userData.id,
      ]);
      
      console.log("Usuário atualizado no banco de dados, enviando broadcast");
      
      // Atualizar dados do usuário após a atualização
      const [updatedUsers] = await pool.execute(
        "SELECT id, name, email, avatar, is_online FROM users WHERE id = ?", 
        [userData.id]
      );
      
      if (!updatedUsers || updatedUsers.length === 0) {
        throw new Error("Usuário não encontrado após atualização");
      }
      
      const updatedUser = updatedUsers[0];
      
      // Notify ALL connected clients, including the sender
      io.emit("user:updated", updatedUser);
      
      // Broadcast to specific users in chats with this user
      const [userChats] = await pool.execute(
        "SELECT c.id FROM chats c JOIN chat_participants cp ON c.id = cp.chat_id WHERE cp.user_id = ?",
        [userData.id]
      );
      
      if (userChats && userChats.length > 0) {
        console.log(`Notificando ${userChats.length} chats sobre a atualização do usuário`);
        userChats.forEach(chat => {
          socket.to(`chat:${chat.id}`).emit("user:updated", updatedUser);
        });
      }
      
    } catch (error) {
      console.error("Error in user:update:", error);
      socket.emit("error", { message: "Falha ao atualizar perfil de usuário" });
    }
  });

  // Remove participant
  socket.on("chat:removeMember", async (data) => {
    try {
      const { chatId, userId, removedBy } = data;
      
      if (!chatId || !userId) {
        return socket.emit("error", { 
          message: "Dados inválidos para remover participante",
          code: "INVALID_DATA"
        });
      }
      
      console.log(`Removendo usuário ${userId} do grupo ${chatId} pelo usuário ${removedBy}`);
      
      // Verificar se o chat é um grupo
      const [chatResults] = await pool.execute(
        "SELECT is_group FROM chats WHERE id = ?",
        [chatId]
      );
      
      if (chatResults.length === 0) {
        return socket.emit("error", { 
          message: "Chat não encontrado",
          code: "CHAT_NOT_FOUND"
        });
      }
      
      const chat = chatResults[0];
      
      if (!chat.is_group) {
        return socket.emit("error", { 
          message: "Não é possível remover participantes de chats individuais",
          code: "NOT_GROUP"
        });
      }
      
      // Verificar se quem está removendo é admin
      const [adminCheck] = await pool.execute(
        "SELECT is_admin FROM chat_participants WHERE chat_id = ? AND user_id = ?",
        [chatId, removedBy]
      );
      
      if (adminCheck.length === 0 || !adminCheck[0].is_admin) {
        return socket.emit("error", { 
          message: "Apenas administradores podem remover participantes",
          code: "NOT_ADMIN"
        });
      }
      
      // Verificar se o usuário a ser removido é membro do grupo
      const [memberResults] = await pool.execute(
        "SELECT * FROM chat_participants WHERE chat_id = ? AND user_id = ?",
        [chatId, userId]
      );
      
      if (memberResults.length === 0) {
        return socket.emit("error", { 
          message: "Participante não encontrado no grupo",
          code: "PARTICIPANT_NOT_FOUND"
        });
      }
      
      // Verificar se o usuário a ser removido é administrador
      const [targetAdminCheck] = await pool.execute(
        "SELECT is_admin FROM chat_participants WHERE chat_id = ? AND user_id = ?",
        [chatId, userId]
      );
      
      const isTargetAdmin = targetAdminCheck.length > 0 && targetAdminCheck[0].is_admin;
      
      // Impedir tentativa de remover um administrador (exceto se for autorremoção)
      if (isTargetAdmin && userId !== removedBy) {
        return socket.emit("error", { 
          message: "Não é possível remover outro administrador do grupo",
          code: "CANNOT_REMOVE_ADMIN"
        });
      }
      
      // Contar quantos administradores existem no grupo
      const [adminCountResult] = await pool.execute(
        "SELECT COUNT(*) as count FROM chat_participants WHERE chat_id = ? AND is_admin = 1",
        [chatId]
      );
      
      const adminCount = adminCountResult[0].count;
      
      // Se for o último administrador e não for autorremoção, impedir remoção
      if (adminCount === 1 && isTargetAdmin && userId !== removedBy) {
        return socket.emit("error", { 
          message: "Não é possível remover o último administrador do grupo",
          code: "LAST_ADMIN"
        });
      }
      
      // Se for autorremoção do último administrador, precisamos promover alguém
      if (adminCount === 1 && isTargetAdmin && userId === removedBy) {
        // Buscar outro participante para promover a administrador
        const [otherParticipants] = await pool.execute(
          "SELECT user_id FROM chat_participants WHERE chat_id = ? AND user_id != ? LIMIT 1",
          [chatId, userId]
        );
        
        if (otherParticipants.length > 0) {
          // Promover outro participante a administrador antes de sair
          await pool.execute(
            "UPDATE chat_participants SET is_admin = 1 WHERE chat_id = ? AND user_id = ?",
            [chatId, otherParticipants[0].user_id]
          );
          
          console.log(`Usuário ${otherParticipants[0].user_id} promovido a administrador do grupo ${chatId}`);
          
          // Salvar mensagem do sistema sobre a promoção
          const [newAdminInfo] = await pool.execute(
            "SELECT name FROM users WHERE id = ?",
            [otherParticipants[0].user_id]
          );
          
          const newAdminName = newAdminInfo.length > 0 ? newAdminInfo[0].name : "Novo administrador";
          
          await pool.execute(
            "INSERT INTO messages (chat_id, sender_id, content, type) VALUES (?, ?, ?, ?)",
            [chatId, null, `${newAdminName} foi promovido a administrador do grupo`, "system"]
          );
        }
      }
      
      // Agora podemos remover o usuário
      await pool.execute(
        "DELETE FROM chat_participants WHERE chat_id = ? AND user_id = ?",
        [chatId, userId]
      );
      
      console.log(`Usuário ${userId} removido do grupo ${chatId}`);
      
      // Verificar se ainda há participantes no grupo
      const [remainingParticipants] = await pool.execute(
        "SELECT COUNT(*) as count FROM chat_participants WHERE chat_id = ?",
        [chatId]
      );
      
      // Se não há mais participantes, excluir o grupo
      if (remainingParticipants[0].count === 0) {
        await pool.execute("DELETE FROM chats WHERE id = ?", [chatId]);
        console.log(`Grupo ${chatId} excluído por não ter mais participantes`);
        socket.emit("chat:deleted", chatId);
        return;
      }
      
      // Se o usuário que saiu era o último administrador (caso improvável, mas vamos verificar)
      const [adminResults] = await pool.execute(
        "SELECT COUNT(*) as count FROM chat_participants WHERE chat_id = ? AND is_admin = 1",
        [chatId]
      );
      
      if (adminResults[0].count === 0) {
        // Não há mais admins, designar o primeiro participante como admin
        const [firstParticipant] = await pool.execute(
          "SELECT user_id FROM chat_participants WHERE chat_id = ? LIMIT 1",
          [chatId]
        );
        
        if (firstParticipant.length > 0) {
          await pool.execute(
            "UPDATE chat_participants SET is_admin = 1 WHERE chat_id = ? AND user_id = ?",
            [chatId, firstParticipant[0].user_id]
          );
          console.log(`Usuário ${firstParticipant[0].user_id} promovido a administrador do grupo ${chatId}`);
          
          // Salvar mensagem do sistema sobre a promoção
          const [newAdminInfo] = await pool.execute(
            "SELECT name FROM users WHERE id = ?",
            [firstParticipant[0].user_id]
          );
          
          const newAdminName = newAdminInfo.length > 0 ? newAdminInfo[0].name : "Novo administrador";
          
          await pool.execute(
            "INSERT INTO messages (chat_id, sender_id, content, type) VALUES (?, ?, ?, ?)",
            [chatId, null, `${newAdminName} foi promovido a administrador do grupo`, "system"]
          );
        }
      }
      
      // Obter informações do grupo atualizado
      const [updatedGroupData] = await pool.execute(
        `
        SELECT 
          c.id, c.name, c.is_group, c.avatar, c.created_at, c.updated_at,
          GROUP_CONCAT(DISTINCT u.id) as participant_ids,
          GROUP_CONCAT(DISTINCT u.name) as participant_names,
          GROUP_CONCAT(DISTINCT u.email) as participant_emails,
          GROUP_CONCAT(DISTINCT u.avatar) as participant_avatars,
          GROUP_CONCAT(DISTINCT u.is_online) as participant_online_status,
          GROUP_CONCAT(DISTINCT cp.is_admin) as participant_is_admin
        FROM chats c
        JOIN chat_participants cp ON c.id = cp.chat_id
        JOIN users u ON cp.user_id = u.id
        WHERE c.id = ?
        GROUP BY c.id
        `,
        [chatId]
      );
      
      if (updatedGroupData.length === 0) {
        return socket.emit("error", { 
          message: "Grupo não encontrado após atualização",
          code: "GROUP_NOT_FOUND"
        });
      }
      
      const group = updatedGroupData[0];
      
      // Parse participant information
      const participantIds = group.participant_ids.split(',');
      const participantNames = group.participant_names.split(',');
      const participantEmails = group.participant_emails.split(',');
      const participantAvatars = group.participant_avatars.split(',');
      const participantOnlineStatus = group.participant_online_status.split(',').map(status => status === '1');
      const participantIsAdmin = group.participant_is_admin.split(',').map(status => status === '1');
      
      // Format participants array
      group.participants = participantIds.map((id, index) => ({
        id: id.toString(),
        name: participantNames[index],
        email: participantEmails[index],
        avatar: participantAvatars[index],
        is_online: participantOnlineStatus[index],
        isAdmin: participantIsAdmin[index]
      }));
      
      // Remove concatenated fields
      delete group.participant_ids;
      delete group.participant_names;
      delete group.participant_emails;
      delete group.participant_avatars;
      delete group.participant_online_status;
      delete group.participant_is_admin;
      
      // Obter informações do usuário removido
      const [userInfo] = await pool.execute(
        "SELECT name FROM users WHERE id = ?",
        [userId]
      );
      
      const userName = userInfo.length > 0 ? userInfo[0].name : "Usuário";
      
      // Determinar mensagem do sistema com base em quem foi removido
      let systemMessage;
      if (userId === removedBy) {
        systemMessage = `${userName} saiu do grupo`;
      } else {
        systemMessage = `${userName} foi removido do grupo`;
      }
      
      // Salvar uma mensagem do sistema no grupo
      const [messageResult] = await pool.execute(
        "INSERT INTO messages (chat_id, sender_id, content, type) VALUES (?, ?, ?, ?)",
        [chatId, null, systemMessage, "system"]
      );
      
      // Criar mensagem do sistema para notificar os participantes
      const systemMessageObj = {
        id: messageResult.insertId,
        chatId: String(chatId),
        content: systemMessage,
        timestamp: new Date().toISOString(),
        type: "system"
      };
      
      // Notificar todos os participantes sobre a atualização do grupo
      io.to(`chat:${chatId}`).emit("chat:updated", group);
      io.to(`chat:${chatId}`).emit("message:new", systemMessageObj);
      
      // Notificar o usuário removido 
      // Encontrar o socket do usuário removido
      const userSocketId = Array.from(socketConnections.entries())
        .find(([id, sid]) => id === userId)?.[1];
        
      if (userSocketId) {
        io.to(userSocketId).emit("chat:left", { 
          chatId,
          message: userId === removedBy ? "Você saiu do grupo" : "Você foi removido do grupo"
        });
      }
      
      // Notificar quem iniciou a remoção
      socket.emit("chat:memberRemoved", { 
        chatId, 
        userId, 
        success: true,
        message: userId === removedBy ? "Você saiu do grupo com sucesso" : "Participante removido com sucesso" 
      });
    } catch (error) {
      console.error("Error in chat:removeMember:", error);
      socket.emit("error", { 
        message: "Falha ao remover participante", 
        details: error.message,
        code: "SERVER_ERROR"
      });
    }
  });
})

// API Routes
// Register user
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body

    // Check if user already exists
    const [existingUsers] = await pool.execute("SELECT * FROM users WHERE email = ?", [email])

    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({ message: "Email já está em uso" })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const [result] = await pool.execute("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", [
      name,
      email,
      hashedPassword,
    ])

    res.status(201).json({
      message: "Usuário registrado com sucesso",
      userId: result.insertId,
    })
  } catch (error) {
    console.error("Registration error:", error)
    res.status(500).json({ message: "Erro interno do servidor" })
  }
})

// Login user
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body

    // Find user in database
    const [users] = await pool.execute("SELECT * FROM users WHERE email = ?", [email])

    if (!users || users.length === 0) {
      return res.status(401).json({ message: "Credenciais inválidas" })
    }

    const user = users[0]

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Credenciais inválidas" })
    }

    // Generate JWT token
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || "your-secret-key", {
      expiresIn: "7d",
    })

    // Update user status to online and socket id
    await pool.execute("UPDATE users SET is_online = 1, socket_id = NULL WHERE id = ?", [user.id])

    // Return user data and token (excluding password)
    const { password: _, ...userWithoutPassword } = user

    res.json({
      user: userWithoutPassword,
      token,
    })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({ message: "Erro interno do servidor" })
  }
})

// Get users
app.get("/api/users", authenticateJWT, async (req, res) => {
  try {
    const { q } = req.query;
    const currentUserId = req.user.id;
    
    let query = `
      SELECT id, name, email, avatar, is_online 
      FROM users 
      WHERE id != ? 
    `;
    
    let params = [currentUserId];
    
    // Adicionar filtro de pesquisa se fornecido
    if (q) {
      query += `AND (name LIKE ? OR email LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`);
    }
    
    query += ` ORDER BY name ASC`;
    
    console.log("Buscando usuários com query:", query);
    console.log("Params:", params);
    
    const [users] = await pool.execute(query, params);
    
    console.log(`Encontrados ${users.length} usuários para seleção de grupo`);
    
    // Garantir que todos os avatares tenham URLs absolutas
    users.forEach(user => {
      if (user.avatar && !user.avatar.startsWith('http')) {
        const host = process.env.PUBLIC_HOST || 'localhost:3001';
        const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
        user.avatar = `${protocol}://${host}${user.avatar.startsWith('/') ? '' : '/'}${user.avatar}`;
      }
    });
    
    res.json(users);
  } catch (error) {
    console.error("Error getting users:", error);
    res.status(500).json({ message: "Erro interno do servidor", error: error.message });
  }
})

// Update user profile
app.put("/api/users/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params
    const { name, email, avatar } = req.body

    // Check if user exists
    const [users] = await pool.execute("SELECT * FROM users WHERE id = ?", [id])

    if (!users || users.length === 0) {
      return res.status(404).json({ message: "Usuário não encontrado" })
    }

    // Check if email is already in use by another user
    if (email !== users[0].email) {
      const [existingUsers] = await pool.execute("SELECT * FROM users WHERE email = ? AND id != ?", [email, id])

      if (existingUsers && existingUsers.length > 0) {
        return res.status(400).json({ message: "Email já está em uso" })
      }
    }

    // Update user
    await pool.execute("UPDATE users SET name = ?, email = ?, avatar = ? WHERE id = ?", [name, email, avatar, id])

    // Get updated user
    const [updatedUsers] = await pool.execute("SELECT id, name, email, avatar, is_online FROM users WHERE id = ?", [id])

    res.json({
      message: "Perfil atualizado com sucesso",
      user: updatedUsers[0],
    })
  } catch (error) {
    console.error("Error updating user:", error)
    res.status(500).json({ message: "Erro interno do servidor" })
  }
})

// Upload user avatar
app.post("/api/users/avatar", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Nenhum arquivo enviado" })
    }

    const userId = req.body.userId
    console.log(`Recebido upload de avatar para o usuário ${userId}:`, req.file);
    
    // Garantir que o diretório existe
    if (!fs.existsSync(userAvatarsDir)) {
      fs.mkdirSync(userAvatarsDir, { recursive: true });
      console.log(`Diretório de avatares de usuários criado: ${userAvatarsDir}`);
    }

    // Detectar o formato da imagem original
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    console.log(`Extensão do arquivo original: ${fileExtension}`);
    
    // Determinar o formato de saída com base na extensão do arquivo original
    let outputFormat = 'jpeg'; // padrão
    
    if (fileExtension === '.png') {
      outputFormat = 'png';
    } else if (fileExtension === '.webp') {
      outputFormat = 'webp';
    } else if (fileExtension === '.gif') {
      outputFormat = 'gif';
    }
    
    console.log(`Formato de saída selecionado: ${outputFormat}`);

    // Optimize image
    const timestamp = Date.now();
    const optimizedFilename = `user-${userId}-${timestamp}.${outputFormat}`; // Inclui userId no nome do arquivo e usa a extensão correta
    const optimizedPath = path.join(userAvatarsDir, optimizedFilename); // Usar a pasta de avatares de usuários

    // Processa a imagem de acordo com o formato
    let sharpInstance = sharp(req.file.path).resize(200, 200);
    
    if (outputFormat === 'jpeg') {
      sharpInstance = sharpInstance.jpeg({ quality: 80 });
    } else if (outputFormat === 'png') {
      sharpInstance = sharpInstance.png({ compressionLevel: 9 });
    } else if (outputFormat === 'webp') {
      sharpInstance = sharpInstance.webp({ quality: 80 });
    } else if (outputFormat === 'gif') {
      // Para GIFs, mantém o formato mas redimensiona
      sharpInstance = sharpInstance.gif();
    }
    
    await sharpInstance.toFile(optimizedPath);
    console.log(`Imagem otimizada salva em: ${optimizedPath}`);

    // Delete original file - com tratamento de erro
    try {
      fs.unlinkSync(req.file.path);
    } catch (unlinkError) {
      console.log(`Aviso: Não foi possível excluir o arquivo original: ${unlinkError.message}`);
      // Continua a execução mesmo se não conseguir excluir o arquivo original
    }

    // Obter o host da requisição
    const host = process.env.PUBLIC_HOST || req.get("host");
    const protocol = process.env.NODE_ENV === "production" ? "https" : req.protocol;
    
    // Criar URL absoluta para o avatar
    const fileUrl = `${protocol}://${host}/uploads/user_avatars/${optimizedFilename}`;
    console.log(`URL do avatar gerada: ${fileUrl}`);

    // Atualizar o avatar do usuário diretamente no banco de dados
    try {
      await pool.execute("UPDATE users SET avatar = ? WHERE id = ?", [fileUrl, userId]);
      console.log(`Avatar do usuário ${userId} atualizado no banco de dados`);
    } catch (dbError) {
      console.error(`Erro ao atualizar avatar no banco de dados: ${dbError.message}`);
      // Continua mesmo se houver erro no banco de dados, já que o URL ainda será retornado
    }

    res.json({
      message: "Avatar do usuário enviado com sucesso",
      url: fileUrl,
      format: outputFormat
    });
  } catch (error) {
    console.error("Erro ao processar avatar do usuário:", error);
    res.status(500).json({ 
      message: "Erro interno do servidor",
      error: error.message
    });
  }
})

// Upload group avatar
app.post("/api/groups/avatar", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Nenhum arquivo enviado" });
    }

    const groupId = req.body.groupId;
    console.log(`Recebido upload de avatar para o grupo ${groupId}:`, req.file);
    
    // Garantir que o diretório existe
    if (!fs.existsSync(groupAvatarsDir)) {
      fs.mkdirSync(groupAvatarsDir, { recursive: true });
      console.log(`Diretório de avatares de grupos criado: ${groupAvatarsDir}`);
    }

    // Detectar o formato da imagem original
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    console.log(`Extensão do arquivo original: ${fileExtension}`);
    
    // Determinar o formato de saída com base na extensão do arquivo original
    let outputFormat = 'jpeg'; // padrão
    
    if (fileExtension === '.png') {
      outputFormat = 'png';
    } else if (fileExtension === '.webp') {
      outputFormat = 'webp';
    } else if (fileExtension === '.gif') {
      outputFormat = 'gif';
    }
    
    console.log(`Formato de saída selecionado: ${outputFormat}`);

    // Optimize image
    const timestamp = Date.now();
    // Incluir groupId no nome do arquivo para evitar conflitos
    const optimizedFilename = `group-${groupId}-${timestamp}.${outputFormat}`;
    const optimizedPath = path.join(groupAvatarsDir, optimizedFilename);

    // Processa a imagem de acordo com o formato
    let sharpInstance = sharp(req.file.path).resize(200, 200);
    
    if (outputFormat === 'jpeg') {
      sharpInstance = sharpInstance.jpeg({ quality: 80 });
    } else if (outputFormat === 'png') {
      sharpInstance = sharpInstance.png({ compressionLevel: 9 });
    } else if (outputFormat === 'webp') {
      sharpInstance = sharpInstance.webp({ quality: 80 });
    } else if (outputFormat === 'gif') {
      // Para GIFs, mantém o formato mas redimensiona
      sharpInstance = sharpInstance.gif();
    }
    
    await sharpInstance.toFile(optimizedPath);
    console.log(`Imagem otimizada salva em: ${optimizedPath}`);

    // Delete original file - com tratamento de erro
    try {
      fs.unlinkSync(req.file.path);
    } catch (unlinkError) {
      console.log(`Aviso: Não foi possível excluir o arquivo original: ${unlinkError.message}`);
      // Continua a execução mesmo se não conseguir excluir o arquivo original
    }

    // Obter o host da requisição
    const host = process.env.PUBLIC_HOST || req.get("host");
    const protocol = process.env.NODE_ENV === "production" ? "https" : req.protocol;
    
    // Criar URL absoluta para o avatar
    const fileUrl = `${protocol}://${host}/uploads/group_avatars/${optimizedFilename}`;
    console.log(`URL do avatar gerada: ${fileUrl}`);

    // Se o id do grupo não for "temp", atualiza o avatar no banco de dados
    if (groupId !== "temp") {
      try {
        await pool.execute("UPDATE chats SET avatar = ? WHERE id = ?", [fileUrl, groupId]);
        console.log(`Avatar do grupo ${groupId} atualizado no banco de dados`);
      } catch (dbError) {
        console.error(`Erro ao atualizar avatar no banco de dados: ${dbError.message}`);
        // Continua mesmo se houver erro no banco de dados, já que o URL ainda será retornado
      }
    }

    res.json({
      message: "Avatar do grupo enviado com sucesso",
      url: fileUrl,
      format: outputFormat
    });
  } catch (error) {
    console.error("Erro ao processar avatar do grupo:", error);
    res.status(500).json({ 
      message: "Erro interno do servidor",
      error: error.message
    });
  }
});

// Upload file
app.post("/api/upload/file", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: "Nenhum arquivo enviado" 
      });
    }
    
    console.log("Recebido upload de arquivo:", req.file);
    
    // Verifica se a pasta de arquivos existe
    if (!fs.existsSync(filesDir)) {
      fs.mkdirSync(filesDir, { recursive: true });
      console.log(`Diretório de arquivos criado: ${filesDir}`);
    }
    
    // Gera um nome único para o arquivo
    const timestamp = Date.now();
    const fileExtension = path.extname(req.file.originalname);
    const safeFileName = req.file.originalname
      .replace(/[^a-zA-Z0-9-_.]/g, '_')
      .substring(0, 100); // limitar tamanho do nome
    
    const uniqueFileName = `file-${timestamp}-${safeFileName}`;
    const filePath = path.join(filesDir, uniqueFileName);
    
    // Copia o arquivo recebido
    fs.copyFileSync(req.file.path, filePath);
    console.log(`Arquivo copiado para: ${filePath}`);
    
    // Remove arquivo temporário
    try {
      fs.unlinkSync(req.file.path);
    } catch (unlinkError) {
      console.log(`Aviso: Não foi possível excluir o arquivo temporário: ${unlinkError.message}`);
    }
    
    // Gerar URL absoluta
    const host = process.env.PUBLIC_HOST || req.get("host");
    const protocol = process.env.NODE_ENV === "production" ? "https" : req.protocol;
    const fileUrl = `${protocol}://${host}/uploads/files/${uniqueFileName}`;
    
    console.log(`URL do arquivo gerada: ${fileUrl}`);
    
    res.json({
      success: true,
      message: "Arquivo enviado com sucesso",
      url: fileUrl,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size
    });
  } catch (error) {
    console.error("Erro ao processar arquivo:", error);
    res.status(500).json({ 
      success: false,
      message: "Erro ao processar o arquivo",
      error: error.message 
    });
  }
});

// Upload audio
app.post("/api/upload/audio", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Nenhum arquivo enviado" });
    }
    
    console.log("Recebido upload de áudio:", req.file);
    
    // Verifica se a pasta de áudios existe
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
      console.log(`Diretório de áudios criado: ${audioDir}`);
    }
    
    // Gera um nome único para o arquivo
    const timestamp = Date.now();
    const audioFileName = `audio-${timestamp}.mp3`;
    const audioPath = path.join(audioDir, audioFileName);
    
    // Copia o arquivo recebido
    fs.copyFileSync(req.file.path, audioPath);
    console.log(`Áudio copiado para: ${audioPath}`);
    
    // Remove arquivo temporário
    try {
      fs.unlinkSync(req.file.path);
    } catch (unlinkError) {
      console.log(`Aviso: Não foi possível excluir o arquivo temporário: ${unlinkError.message}`);
    }
    
    // Gerar URL absoluta
    const host = process.env.PUBLIC_HOST || req.get("host");
    const protocol = process.env.NODE_ENV === "production" ? "https" : req.protocol;
    const audioUrl = `${protocol}://${host}/uploads/audio/${audioFileName}`;
    
    console.log(`URL do áudio gerada: ${audioUrl}`);
    
    res.json({
      success: true,
      message: "Áudio enviado com sucesso",
      audioUrl,
      fileName: audioFileName
    });
  } catch (error) {
    console.error("Erro ao processar áudio:", error);
    res.status(500).json({ 
      success: false,
      message: "Erro ao processar o arquivo de áudio",
      error: error.message 
    });
  }
});

// Get tags
app.get("/api/tags", authenticateJWT, async (req, res) => {
  try {
    // Por enquanto, retornaremos uma lista vazia já que não temos a tabela de tags ainda
    res.json({ tags: [] })
  } catch (error) {
    console.error("Error getting tags:", error)
    res.status(500).json({ message: "Erro interno do servidor" })
  }
})

// Debug endpoint para verificar diretórios de upload
app.get("/api/debug/uploads", (req, res) => {
  try {
    const dirs = {
      uploads: {
        path: uploadsDir,
        exists: fs.existsSync(uploadsDir),
        isDir: fs.existsSync(uploadsDir) ? fs.statSync(uploadsDir).isDirectory() : false,
        readable: fs.existsSync(uploadsDir) ? fs.accessSync(uploadsDir, fs.constants.R_OK) || true : false,
        writable: fs.existsSync(uploadsDir) ? fs.accessSync(uploadsDir, fs.constants.W_OK) || true : false,
        contents: fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : []
      },
      avatars: {
        path: avatarsDir,
        exists: fs.existsSync(avatarsDir),
        isDir: fs.existsSync(avatarsDir) ? fs.statSync(avatarsDir).isDirectory() : false,
        readable: fs.existsSync(avatarsDir) ? fs.accessSync(avatarsDir, fs.constants.R_OK) || true : false,
        writable: fs.existsSync(avatarsDir) ? fs.accessSync(avatarsDir, fs.constants.W_OK) || true : false,
        contents: fs.existsSync(avatarsDir) ? fs.readdirSync(avatarsDir) : []
      },
      groups: {
        path: groupsDir,
        exists: fs.existsSync(groupsDir),
        isDir: fs.existsSync(groupsDir) ? fs.statSync(groupsDir).isDirectory() : false,
        readable: fs.existsSync(groupsDir) ? fs.accessSync(groupsDir, fs.constants.R_OK) || true : false,
        writable: fs.existsSync(groupsDir) ? fs.accessSync(groupsDir, fs.constants.W_OK) || true : false,
        contents: fs.existsSync(groupsDir) ? fs.readdirSync(groupsDir) : []
      },
      files: {
        path: filesDir,
        exists: fs.existsSync(filesDir),
        isDir: fs.existsSync(filesDir) ? fs.statSync(filesDir).isDirectory() : false,
        readable: fs.existsSync(filesDir) ? fs.accessSync(filesDir, fs.constants.R_OK) || true : false,
        writable: fs.existsSync(filesDir) ? fs.accessSync(filesDir, fs.constants.W_OK) || true : false,
        contents: fs.existsSync(filesDir) ? fs.readdirSync(filesDir) : []
      },
      audio: {
        path: audioDir,
        exists: fs.existsSync(audioDir),
        isDir: fs.existsSync(audioDir) ? fs.statSync(audioDir).isDirectory() : false,
        readable: fs.existsSync(audioDir) ? fs.accessSync(audioDir, fs.constants.R_OK) || true : false,
        writable: fs.existsSync(audioDir) ? fs.accessSync(audioDir, fs.constants.W_OK) || true : false,
        contents: fs.existsSync(audioDir) ? fs.readdirSync(audioDir) : []
      }
    };
    
    // Verificar permissões de acesso
    const access = {
      cwd: process.cwd(),
      user: process.getuid ? process.getuid() : 'N/A',
      group: process.getgid ? process.getgid() : 'N/A'
    };
    
    res.json({
      success: true,
      dirs,
      access
    });
  } catch (error) {
    console.error("Error checking uploads directories:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Update group via REST API (manter esta rota para compatibilidade)
app.put("/api/groups/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params
    const { name, avatar, settings, tags } = req.body

    // Check if group exists
    const [groups] = await pool.execute("SELECT * FROM chats WHERE id = ? AND is_group = 1", [id])

    if (!groups || groups.length === 0) {
      return res.status(404).json({ message: "Grupo não encontrado" })
    }

    // Check if user is admin
    const [participants] = await pool.execute(
      "SELECT * FROM chat_participants WHERE chat_id = ? AND user_id = ? AND is_admin = 1",
      [id, req.user.id],
    )

    if (!participants || participants.length === 0) {
      return res.status(403).json({ message: "Você não tem permissão para editar este grupo" })
    }

    // Update group
    await pool.execute("UPDATE chats SET name = ?, avatar = ? WHERE id = ?", [name, avatar, id])

    // Atualizar configurações do grupo se fornecidas
    if (settings) {
      // Convertemos settings para string JSON para armazenar no banco
      const settingsJson = JSON.stringify(settings);
      
      // Verificar se já existe configuração para este grupo
      const [existingSettings] = await pool.execute(
        "SELECT * FROM chat_settings WHERE chat_id = ?",
        [id]
      );
      
      if (existingSettings && existingSettings.length > 0) {
        // Atualizar configurações existentes
        await pool.execute(
          "UPDATE chat_settings SET settings = ? WHERE chat_id = ?",
          [settingsJson, id]
        );
      } else {
        // Inserir novas configurações
        await pool.execute(
          "INSERT INTO chat_settings (chat_id, settings) VALUES (?, ?)",
          [id, settingsJson]
        );
      }
    }
    
    // Atualizar tags se fornecidas
    if (tags && Array.isArray(tags)) {
      // Primeiro remova todas as tags existentes
      await pool.execute(
        "DELETE FROM chat_tags WHERE chat_id = ?",
        [id]
      );
      
      // Depois insira as novas tags
      if (tags.length > 0) {
        // Preparar query para inserção em massa
        const placeholders = tags.map(() => "(?, ?)").join(", ");
        const values = [];
        
        tags.forEach(tagId => {
          values.push(id, tagId);
        });
        
        if (values.length > 0) {
          await pool.execute(
            `INSERT INTO chat_tags (chat_id, tag_id) VALUES ${placeholders}`,
            values
          );
        }
      }
    }

    // Get updated group
    const [updatedGroups] = await pool.execute("SELECT * FROM chats WHERE id = ?", [id])

    // Get participants
    const [groupParticipants] = await pool.execute(
      `
      SELECT u.id, u.name, u.email, u.avatar, u.is_online, cp.is_admin
      FROM users u
      JOIN chat_participants cp ON u.id = cp.user_id
      WHERE cp.chat_id = ?
    `,
      [id],
    )
    
    // Obter configurações atualizadas
    const [groupSettings] = await pool.execute(
      "SELECT settings FROM chat_settings WHERE chat_id = ?",
      [id]
    );
    
    let parsedSettings = {};
    if (groupSettings && groupSettings.length > 0 && groupSettings[0].settings) {
      try {
        parsedSettings = JSON.parse(groupSettings[0].settings);
      } catch (e) {
        console.error("Erro ao analisar configurações do grupo:", e);
      }
    }

    const updatedGroup = {
      ...updatedGroups[0],
      participants: groupParticipants,
      settings: parsedSettings
    }

    res.json(updatedGroup)
  } catch (error) {
    console.error("Error updating group:", error)
    res.status(500).json({ message: "Erro interno do servidor" })
  }
})

// Search messages
app.get("/api/messages/search", authenticateJWT, async (req, res) => {
  try {
    const { chatId, query, startDate, endDate, senderId, type } = req.query

    if (!chatId) {
      return res.status(400).json({ message: "ID do chat é obrigatório" })
    }

    // Check if user is participant in the chat
    const [participants] = await pool.execute("SELECT * FROM chat_participants WHERE chat_id = ? AND user_id = ?", [
      chatId,
      req.user.id,
    ])

    if (!participants || participants.length === 0) {
      return res.status(403).json({ message: "Você não tem permissão para acessar este chat" })
    }

    // Build query
    let sql = `
      SELECT m.*, u.id as sender_id, u.name as sender_name, u.avatar as sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.chat_id = ?
    `

    const params = [chatId]

    if (query) {
      sql += " AND m.content LIKE ?"
      params.push(`%${query}%`)
    }

    if (startDate) {
      sql += " AND m.created_at >= ?"
      params.push(startDate)
    }

    if (endDate) {
      sql += " AND m.created_at <= ?"
      params.push(endDate)
    }

    if (senderId) {
      sql += " AND m.sender_id = ?"
      params.push(senderId)
    }

    if (type) {
      sql += " AND m.type = ?"
      params.push(type)
    }

    sql += " ORDER BY m.created_at DESC LIMIT 50"

    const [messages] = await pool.execute(sql, params)

    // Format messages
    const formattedMessages = messages.map((message) => {
      // Parse additional data if exists
      let additionalData = null;
      if (message.additional_data) {
        try {
          additionalData = JSON.parse(message.additional_data);
        } catch (error) {
          console.error("Error parsing additional data for message ID " + message.id, error);
        }
      }
      
      const formattedMessage = {
        id: message.id,
        chatId: message.chat_id,
        content: message.content,
        type: message.type,
        timestamp: message.created_at,
        sender: {
          id: message.sender_id,
          name: message.sender_name,
          avatar: message.sender_avatar,
        },
      }

      // Add reply information if this message is a reply
      if (message.reply_id) {
        formattedMessage.replyTo = {
          id: message.reply_id,
          content: message.reply_content,
          sender: {
            name: message.reply_sender_name,
          },
        }
      }

      // Add reactions if any
      if (message.reactions) {
        formattedMessage.reactions = message.reactions
      }
      
      // Add additional data (like fileName for audio/file)
      if (additionalData) {
        // Merge additional data into the message
        Object.assign(formattedMessage, additionalData);
      }

      return formattedMessage
    })

    res.json({ messages: formattedMessages })
  } catch (error) {
    console.error("Error searching messages:", error)
    res.status(500).json({ message: "Erro interno do servidor" })
  }
})

// Logo após as rotas das APIs existentes, antes da inicialização do socket.io
// Adicionar endpoint para remover participantes de um grupo
app.delete("/api/chats/:chatId/members/:userId", async (req, res) => {
  try {
    const { chatId, userId } = req.params;
    
    console.log(`Tentativa de remover usuário ${userId} do grupo ${chatId}`);
    
    // Verificar se o removedor é um administrador (a partir do token)
    const adminId = req.headers.authorization ? 
      jwt.verify(
        req.headers.authorization.split(" ")[1], 
        process.env.JWT_SECRET || "your-secret-key"
      ).id : null;
      
    if (!adminId) {
      return res.status(401).json({ error: "Autenticação necessária para remover participantes" });
    }
    
    console.log(`Administrador ${adminId} está tentando remover usuário ${userId}`);
    
    // Verificar se o chat é um grupo
    const [chatResults] = await pool.execute(
      "SELECT is_group FROM chats WHERE id = ?",
      [chatId]
    );
    
    if (chatResults.length === 0) {
      return res.status(404).json({ error: "Chat não encontrado" });
    }
    
    const chat = chatResults[0];
    
    if (!chat.is_group) {
      return res.status(400).json({ error: "Não é possível remover participantes de chats individuais" });
    }
    
    // Verificar se quem está removendo é administrador
    const [adminCheck] = await pool.execute(
      "SELECT is_admin FROM chat_participants WHERE chat_id = ? AND user_id = ?",
      [chatId, adminId]
    );
    
    if (adminCheck.length === 0 || !adminCheck[0].is_admin) {
      return res.status(403).json({ 
        error: "Apenas administradores podem remover participantes",
        code: "NOT_ADMIN"
      });
    }
    
    // Verificar se o usuário a ser removido é membro do grupo
    const [memberResults] = await pool.execute(
      "SELECT * FROM chat_participants WHERE chat_id = ? AND user_id = ?",
      [chatId, userId]
    );
    
    if (memberResults.length === 0) {
      return res.status(404).json({ 
        error: "Participante não encontrado no grupo",
        code: "PARTICIPANT_NOT_FOUND"
      });
    }
    
    // Verificar se o usuário a ser removido é administrador
    const [targetAdminCheck] = await pool.execute(
      "SELECT is_admin FROM chat_participants WHERE chat_id = ? AND user_id = ?",
      [chatId, userId]
    );
    
    const isTargetAdmin = targetAdminCheck.length > 0 && targetAdminCheck[0].is_admin;
    
    // Impedir tentativa de remover um administrador (exceto se for autorremoção)
    if (isTargetAdmin && userId !== adminId) {
      return res.status(403).json({ 
        error: "Não é possível remover outro administrador do grupo",
        code: "CANNOT_REMOVE_ADMIN"
      });
    }
    
    // Contar quantos administradores existem no grupo
    const [adminCountResult] = await pool.execute(
      "SELECT COUNT(*) as count FROM chat_participants WHERE chat_id = ? AND is_admin = 1",
      [chatId]
    );
    
    const adminCount = adminCountResult[0].count;
    
    // Se for o último administrador e não for autorremoção, impedir remoção
    if (adminCount === 1 && isTargetAdmin && userId !== adminId) {
      return res.status(403).json({ 
        error: "Não é possível remover o último administrador do grupo",
        code: "LAST_ADMIN"
      });
    }
    
    // Se for autorremoção do último administrador, precisamos promover alguém
    if (adminCount === 1 && isTargetAdmin && userId === adminId) {
      // Buscar outro participante para promover a administrador
      const [otherParticipants] = await pool.execute(
        "SELECT user_id FROM chat_participants WHERE chat_id = ? AND user_id != ? LIMIT 1",
        [chatId, userId]
      );
      
      if (otherParticipants.length > 0) {
        // Promover outro participante a administrador antes de sair
        await pool.execute(
          "UPDATE chat_participants SET is_admin = 1 WHERE chat_id = ? AND user_id = ?",
          [chatId, otherParticipants[0].user_id]
        );
        
        console.log(`Usuário ${otherParticipants[0].user_id} promovido a administrador do grupo ${chatId}`);
        
        // Salvar mensagem do sistema sobre a promoção
        const [newAdminInfo] = await pool.execute(
          "SELECT name FROM users WHERE id = ?",
          [otherParticipants[0].user_id]
        );
        
        const newAdminName = newAdminInfo.length > 0 ? newAdminInfo[0].name : "Novo administrador";
        
        await pool.execute(
          "INSERT INTO messages (chat_id, sender_id, content, type) VALUES (?, ?, ?, ?)",
          [chatId, null, `${newAdminName} foi promovido a administrador do grupo`, "system"]
        );
      }
    }
    
    // Agora podemos remover o usuário
    await pool.execute(
      "DELETE FROM chat_participants WHERE chat_id = ? AND user_id = ?",
      [chatId, userId]
    );
    
    console.log(`Usuário ${userId} removido do grupo ${chatId}`);
    
    // Verificar se ainda há participantes no grupo
    const [remainingParticipants] = await pool.execute(
      "SELECT COUNT(*) as count FROM chat_participants WHERE chat_id = ?",
      [chatId]
    );
    
    // Se não há mais participantes, excluir o grupo
    if (remainingParticipants[0].count === 0) {
      await pool.execute("DELETE FROM chats WHERE id = ?", [chatId]);
      console.log(`Grupo ${chatId} excluído por não ter mais participantes`);
      return res.status(200).json({ 
        message: "Grupo excluído pois não há mais participantes",
        code: "GROUP_DELETED"
      });
    }
    
    // Se o usuário que saiu era o último administrador (caso improvável, mas vamos verificar)
    const [adminResults] = await pool.execute(
      "SELECT COUNT(*) as count FROM chat_participants WHERE chat_id = ? AND is_admin = 1",
      [chatId]
    );
    
    if (adminResults[0].count === 0) {
      // Não há mais admins, designar o primeiro participante como admin
      const [firstParticipant] = await pool.execute(
        "SELECT user_id FROM chat_participants WHERE chat_id = ? LIMIT 1",
        [chatId]
      );
      
      if (firstParticipant.length > 0) {
        await pool.execute(
          "UPDATE chat_participants SET is_admin = 1 WHERE chat_id = ? AND user_id = ?",
          [chatId, firstParticipant[0].user_id]
        );
        console.log(`Usuário ${firstParticipant[0].user_id} promovido a administrador do grupo ${chatId}`);
        
        // Salvar mensagem do sistema sobre a promoção
        const [newAdminInfo] = await pool.execute(
          "SELECT name FROM users WHERE id = ?",
          [firstParticipant[0].user_id]
        );
        
        const newAdminName = newAdminInfo.length > 0 ? newAdminInfo[0].name : "Novo administrador";
        
        await pool.execute(
          "INSERT INTO messages (chat_id, sender_id, content, type) VALUES (?, ?, ?, ?)",
          [chatId, null, `${newAdminName} foi promovido a administrador do grupo`, "system"]
        );
      }
    }
    
    // Obter informações do grupo atualizado
    const [updatedGroupData] = await pool.execute(
      `
      SELECT 
        c.id, c.name, c.is_group, c.avatar, c.created_at, c.updated_at,
        GROUP_CONCAT(DISTINCT u.id) as participant_ids,
        GROUP_CONCAT(DISTINCT u.name) as participant_names,
        GROUP_CONCAT(DISTINCT u.email) as participant_emails,
        GROUP_CONCAT(DISTINCT u.avatar) as participant_avatars,
        GROUP_CONCAT(DISTINCT u.is_online) as participant_online_status,
        GROUP_CONCAT(DISTINCT cp.is_admin) as participant_is_admin
      FROM chats c
      JOIN chat_participants cp ON c.id = cp.chat_id
      JOIN users u ON cp.user_id = u.id
      WHERE c.id = ?
      GROUP BY c.id
      `,
      [chatId]
    );
    
    if (updatedGroupData.length === 0) {
      return res.status(404).json({ 
        error: "Grupo não encontrado após atualização",
        code: "GROUP_NOT_FOUND"
      });
    }
    
    const group = updatedGroupData[0];
    
    // Parse participant information
    const participantIds = group.participant_ids.split(',');
    const participantNames = group.participant_names.split(',');
    const participantEmails = group.participant_emails.split(',');
    const participantAvatars = group.participant_avatars.split(',');
    const participantOnlineStatus = group.participant_online_status.split(',').map(status => status === '1');
    const participantIsAdmin = group.participant_is_admin.split(',').map(status => status === '1');
    
    // Format participants array
    group.participants = participantIds.map((id, index) => ({
      id: id.toString(),
      name: participantNames[index],
      email: participantEmails[index],
      avatar: participantAvatars[index],
      is_online: participantOnlineStatus[index],
      isAdmin: participantIsAdmin[index]
    }));
    
    // Remove concatenated fields
    delete group.participant_ids;
    delete group.participant_names;
    delete group.participant_emails;
    delete group.participant_avatars;
    delete group.participant_online_status;
    delete group.participant_is_admin;
    
    // Obter informações do usuário removido
    const [userInfo] = await pool.execute(
      "SELECT name FROM users WHERE id = ?",
      [userId]
    );
    
    const userName = userInfo.length > 0 ? userInfo[0].name : "Usuário";
    
    // Determinar mensagem do sistema com base em quem foi removido
    let systemMessage;
    if (userId === adminId) {
      systemMessage = `${userName} saiu do grupo`;
    } else {
      systemMessage = `${userName} foi removido do grupo`;
    }
    
    // Salvar uma mensagem do sistema no grupo
    const [messageResult] = await pool.execute(
      "INSERT INTO messages (chat_id, sender_id, content, type) VALUES (?, ?, ?, ?)",
      [chatId, null, systemMessage, "system"]
    );
    
    // Criar mensagem do sistema para notificar os participantes
    const systemMessageObj = {
      id: messageResult.insertId,
      chatId: String(chatId),
      content: systemMessage,
      timestamp: new Date().toISOString(),
      type: "system"
    };
    
    // Notificar todos os participantes sobre a atualização do grupo
    io.to(`chat:${chatId}`).emit("chat:updated", group);
    io.to(`chat:${chatId}`).emit("message:new", systemMessageObj);
    
    // Notificar o usuário removido
    const removedUserSocketId = socketConnections.get(userId);
    if (removedUserSocketId) {
      io.to(removedUserSocketId).emit("chat:left", { 
        chatId,
        message: userId === adminId ? "Você saiu do grupo" : "Você foi removido do grupo"
      });
    }
    
    // Notificar quem iniciou a remoção
    socket.emit("chat:memberRemoved", { 
      chatId, 
      userId, 
      success: true,
      message: userId === adminId ? "Saiu do grupo com sucesso" : "Participante removido com sucesso" 
    });
  } catch (error) {
    console.error("Erro ao remover participante:", error);
    return res.status(500).json({ 
      error: "Erro ao remover participante", 
      details: error.message,
      code: "SERVER_ERROR"
    });
  }
});

// API para criar enquetes
app.post("/api/polls", authenticateJWT, async (req, res) => {
  try {
    const { question, options, chatId, expiresAt } = req.body;
    const creatorId = req.user.id;
    
    if (!question || !options || !chatId) {
      return res.status(400).json({ 
        message: "Pergunta, opções e ID do chat são obrigatórios"
      });
    }
    
    if (!Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ 
        message: "A enquete precisa ter pelo menos 2 opções"
      });
    }

    // Verificar se o chat existe e o usuário é participante
    const [chats] = await pool.execute(
      "SELECT is_group FROM chats WHERE id = ?",
      [chatId]
    );
    
    if (chats.length === 0) {
      return res.status(404).json({ message: "Chat não encontrado" });
    }
    
    if (!chats[0].is_group) {
      return res.status(400).json({ 
        message: "Enquetes só podem ser criadas em grupos"
      });
    }
    
    const [participants] = await pool.execute(
      "SELECT * FROM chat_participants WHERE chat_id = ? AND user_id = ?",
      [chatId, creatorId]
    );
    
    if (participants.length === 0) {
      return res.status(403).json({ 
        message: "Você não é participante deste grupo"
      });
    }
    
    // Iniciar transação
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      const pollId = uuid();
      
      // Criar a enquete
      await connection.execute(
        `INSERT INTO polls (id, chat_id, creator_id, question, expires_at) 
         VALUES (?, ?, ?, ?, ?)`,
        [pollId, chatId, creatorId, question, expiresAt || null]
      );
      
      // Criar as opções da enquete
      const optionValues = [];
      const optionPlaceholders = [];
      const optionIds = [];
      
      for (const option of options) {
        const optionId = uuid();
        optionIds.push(optionId);
        optionValues.push(optionId, pollId, option.text);
        optionPlaceholders.push("(?, ?, ?)");
      }
      
      await connection.execute(
        `INSERT INTO poll_options (id, poll_id, text) VALUES ${optionPlaceholders.join(", ")}`,
        optionValues
      );
      
      await connection.commit();
      
      // Obter os dados completos da enquete
      const [polls] = await pool.execute(
        `SELECT p.id, p.chat_id, p.creator_id, u.name as creator_name, 
                p.question, p.created_at, p.expires_at
         FROM polls p
         JOIN users u ON p.creator_id = u.id
         WHERE p.id = ?`,
        [pollId]
      );
      
      const [pollOptions] = await pool.execute(
        "SELECT id, text FROM poll_options WHERE poll_id = ?",
        [pollId]
      );
      
      const poll = {
        ...polls[0],
        options: pollOptions,
        votes: []
      };
      
      // Enviar a nova enquete por socket para todos os participantes do grupo
      io.to(`chat:${chatId}`).emit("poll:new", poll);
      
      // Criar uma mensagem especial para a enquete
      const messageId = uuid();
      const additionalData = JSON.stringify({ pollId });
      
      await pool.execute(
        `INSERT INTO messages (id, chat_id, sender_id, content, type, additional_data) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [messageId, chatId, creatorId, question, "poll", additionalData]
      );
      
      // Obter os dados do remetente para a mensagem
      const [senders] = await pool.execute(
        "SELECT id, name, avatar FROM users WHERE id = ?",
        [creatorId]
      );
      
      // Formatar a mensagem para enviar pelo socket
      const message = {
        id: messageId,
        chatId,
        senderId: creatorId,
        sender: senders[0],
        content: question,
        type: "poll",
        timestamp: new Date().toISOString(),
        poll: poll
      };
      
      // Notificar todos os participantes sobre a nova mensagem
      io.to(`chat:${chatId}`).emit("message:new", message);
      
      res.status(201).json(poll);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error creating poll:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

// API para votar em uma enquete
app.post("/api/polls/:pollId/vote", authenticateJWT, async (req, res) => {
  try {
    const { pollId } = req.params;
    const { optionId } = req.body;
    const userId = req.user.id;
    
    if (!optionId) {
      return res.status(400).json({ message: "ID da opção é obrigatório" });
    }
    
    // Verificar se a enquete existe
    const [polls] = await pool.execute(
      `SELECT p.id, p.chat_id, p.creator_id, p.question, p.created_at, p.expires_at 
       FROM polls p WHERE p.id = ?`,
      [pollId]
    );
    
    if (polls.length === 0) {
      return res.status(404).json({ message: "Enquete não encontrada" });
    }
    
    const poll = polls[0];
    
    // Verificar se o usuário é participante do chat
    const [participants] = await pool.execute(
      "SELECT * FROM chat_participants WHERE chat_id = ? AND user_id = ?",
      [poll.chat_id, userId]
    );
    
    if (participants.length === 0) {
      return res.status(403).json({ 
        message: "Você não tem permissão para votar nesta enquete"
      });
    }
    
    // Verificar se a opção existe e pertence à enquete
    const [options] = await pool.execute(
      "SELECT * FROM poll_options WHERE id = ? AND poll_id = ?",
      [optionId, pollId]
    );
    
    if (options.length === 0) {
      return res.status(404).json({ message: "Opção não encontrada" });
    }
    
    // Iniciar transação
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // Verificar se o usuário já votou nesta enquete
      const [existingVotes] = await connection.execute(
        "SELECT * FROM poll_votes WHERE poll_id = ? AND user_id = ?",
        [pollId, userId]
      );
      
      // Se já votou, atualiza o voto
      if (existingVotes.length > 0) {
        await connection.execute(
          "UPDATE poll_votes SET option_id = ? WHERE poll_id = ? AND user_id = ?",
          [optionId, pollId, userId]
        );
      } else {
        // Se não votou, cria um novo voto
        const voteId = uuid();
        await connection.execute(
          "INSERT INTO poll_votes (id, poll_id, option_id, user_id) VALUES (?, ?, ?, ?)",
          [voteId, pollId, optionId, userId]
        );
      }
      
      await connection.commit();
      
      // Obter todos os dados da enquete para retornar ao cliente
      const [updatedPoll] = await pool.execute(
        `SELECT p.id, p.chat_id, p.creator_id, u.name as creator_name, 
                p.question, p.created_at, p.expires_at
         FROM polls p
         JOIN users u ON p.creator_id = u.id
         WHERE p.id = ?`,
        [pollId]
      );
      
      const [pollOptions] = await pool.execute(
        "SELECT id, text FROM poll_options WHERE poll_id = ?",
        [pollId]
      );
      
      const [votes] = await pool.execute(
        `SELECT pv.id, pv.option_id, pv.user_id, u.name as user_name, pv.created_at
         FROM poll_votes pv
         JOIN users u ON pv.user_id = u.id
         WHERE pv.poll_id = ?`,
        [pollId]
      );
      
      const result = {
        ...updatedPoll[0],
        options: pollOptions,
        votes: votes
      };
      
      // Notificar todos os participantes sobre a atualização da enquete
      io.to(`chat:${poll.chat_id}`).emit("poll:updated", result);
      
      res.json(result);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error voting on poll:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

// Endpoint para criar uma enquete
app.post("/api/messages/poll", authenticateJWT, async (req, res) => {
  try {
    console.log("Recebido pedido para criar enquete:", req.body);
    const { chatId, senderId, question, options } = req.body;
    
    if (!chatId || !senderId || !question || !options || !Array.isArray(options) || options.length < 2) {
      console.error("Dados inválidos para criar enquete:", req.body);
      return res.status(400).json({ 
        success: false,
        message: "Dados inválidos para criar uma enquete. A enquete precisa de um título e pelo menos 2 opções."
      });
    }
    
    console.log(`Criando enquete para o chat ${chatId} por ${senderId}: "${question}" com ${options.length} opções`);
    
    // Verificar se o chat existe
    const [chatResults] = await pool.execute(
      "SELECT * FROM chats WHERE id = ?",
      [chatId]
    );
    
    if (chatResults.length === 0) {
      console.error(`Chat ${chatId} não encontrado para criar enquete`);
      return res.status(404).json({ 
        success: false,
        message: "Chat não encontrado" 
      });
    }
    
    // Verificar se o usuário é membro do chat
    const [memberResults] = await pool.execute(
      "SELECT * FROM chat_participants WHERE chat_id = ? AND user_id = ?",
      [chatId, senderId]
    );
    
    if (memberResults.length === 0) {
      console.error(`Usuário ${senderId} não tem permissão para criar enquete no chat ${chatId}`);
      return res.status(403).json({ 
        success: false,
        message: "Você não tem permissão para criar enquetes neste chat" 
      });
    }
    
    // Iniciar uma transação para garantir que tudo seja salvo corretamente
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // Criar a enquete
      console.log("Inserindo enquete no banco de dados");
      const [pollResult] = await connection.execute(
        "INSERT INTO polls (chat_id, creator_id, question, created_at) VALUES (?, ?, ?, NOW())",
        [chatId, senderId, question]
      );
      
      const pollId = pollResult.insertId;
      console.log(`Enquete criada com ID ${pollId}`);
      
      // Adicionar as opções da enquete
      console.log(`Adicionando ${options.length} opções para a enquete ${pollId}`);
      for (const option of options) {
        await connection.execute(
          "INSERT INTO poll_options (poll_id, text) VALUES (?, ?)",
          [pollId, option]
        );
      }
      
      // Finalizar a transação
      await connection.commit();
      connection.release();
      
      console.log(`Enquete ${pollId} criada com sucesso`);
      res.json({
        success: true,
        message: "Enquete criada com sucesso",
        pollId: pollId
      });
      
    } catch (error) {
      // Reverter a transação em caso de erro
      console.error("Erro na transação ao criar enquete:", error);
      await connection.rollback();
      connection.release();
      throw error;
    }
    
  } catch (error) {
    console.error("Erro ao criar enquete:", error);
    res.status(500).json({ 
      success: false,
      message: "Erro ao criar enquete", 
      error: error.message 
    });
  }
});

// Endpoint para votar em uma enquete
app.post("/api/polls/vote", authenticateJWT, async (req, res) => {
  try {
    const { pollId, optionId, userId } = req.body;
    
    if (!pollId || !optionId || !userId) {
      return res.status(400).json({ 
        success: false,
        message: "Dados inválidos para registrar voto" 
      });
    }
    
    // Verificar se a enquete existe
    const [pollResults] = await pool.execute(
      "SELECT * FROM polls WHERE id = ?",
      [pollId]
    );
    
    if (pollResults.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: "Enquete não encontrada" 
      });
    }
    
    // Verificar se o usuário já votou nesta enquete
    const [existingVotes] = await pool.execute(
      "SELECT * FROM poll_votes WHERE poll_id = ? AND user_id = ?",
      [pollId, userId]
    );
    
    if (existingVotes.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: "Você já votou nesta enquete" 
      });
    }
    
    // Verificar se a opção pertence a esta enquete
    const [optionResults] = await pool.execute(
      "SELECT * FROM poll_options WHERE id = ? AND poll_id = ?",
      [optionId, pollId]
    );
    
    if (optionResults.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: "Opção de voto inválida" 
      });
    }
    
    // Registrar o voto
    await pool.execute(
      "INSERT INTO poll_votes (poll_id, option_id, user_id, voted_at) VALUES (?, ?, ?, NOW())",
      [pollId, optionId, userId]
    );
    
    res.json({
      success: true,
      message: "Voto registrado com sucesso"
    });
    
  } catch (error) {
    console.error("Erro ao registrar voto:", error);
    res.status(500).json({ 
      success: false,
      message: "Erro ao registrar voto", 
      error: error.message 
    });
  }
});

// Start server
const PORT = process.env.PORT || 3001
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT} (http://0.0.0.0:${PORT})`)
  console.log(`Acesse localmente: http://localhost:${PORT}`)
  console.log(`Acesse na rede: http://192.168.3.180:${PORT}`)
})
