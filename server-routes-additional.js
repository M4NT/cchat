// Assuming these are defined elsewhere in the main server file
// For example:
// const app = require('express')();
// const authenticateJWT = require('./middleware/auth');
// const pool = require('./db');
// const { decryptMessage, encryptMessage } = require('./utils/encryption');
// const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

// Rota para tradução de mensagens
app.post("/api/translate", authenticateJWT, async (req, res) => {
  try {
    const { text, targetLanguage } = req.body

    if (!text || !targetLanguage) {
      return res.status(400).json({ message: "Texto e idioma de destino são obrigatórios" })
    }

    // Aqui você usaria uma API de tradução como Google Translate, DeepL, etc.
    // Para este exemplo, vamos simular uma tradução

    // Detectar idioma (simulado)
    const detectedLanguage = "pt" // Simulando que o texto original é em português

    // Traduzir texto (simulado)
    const translatedText = `[Tradução para ${targetLanguage}]: ${text}`

    // Salvar tradução no banco de dados
    // Isso seria implementado em um caso real

    res.json({
      translatedText,
      detectedLanguage,
      targetLanguage,
    })
  } catch (error) {
    console.error("Error translating message:", error)
    res.status(500).json({ message: "Erro interno do servidor" })
  }
})

// Rota para exportar mensagens de um chat
app.get("/api/chats/:chatId/export", authenticateJWT, async (req, res) => {
  try {
    const { chatId } = req.params

    // Verificar se o usuário é participante do chat
    const [participants] = await pool.execute("SELECT * FROM chat_participants WHERE chat_id = ? AND user_id = ?", [
      chatId,
      req.user.id,
    ])

    if (!participants || participants.length === 0) {
      return res.status(403).json({ message: "Você não tem permissão para acessar este chat" })
    }

    // Obter informações do chat
    const [chats] = await pool.execute("SELECT * FROM chats WHERE id = ?", [chatId])

    if (!chats || chats.length === 0) {
      return res.status(404).json({ message: "Chat não encontrado" })
    }

    const chat = chats[0]

    // Obter participantes do chat
    const [chatParticipants] = await pool.execute(
      "SELECT u.id, u.name, u.email, u.avatar, cp.is_admin FROM users u JOIN chat_participants cp ON u.id = cp.user_id WHERE cp.chat_id = ?",
      [chatId],
    )

    // Obter mensagens do chat
    const [messages] = await pool.execute(
      "SELECT m.*, u.name as sender_name, u.avatar as sender_avatar FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.chat_id = ? ORDER BY m.created_at ASC",
      [chatId],
    )

    // Formatar mensagens
    const formattedMessages = messages.map((message) => {
      // Descriptografar mensagem se for do tipo texto
      let content = message.content
      if (message.type === "text") {
        try {
          content = decryptMessage(content, ENCRYPTION_KEY)
        } catch (error) {
          console.error("Error decrypting message:", error)
        }
      }

      return {
        id: message.id,
        content,
        type: message.type,
        timestamp: message.created_at,
        sender: {
          id: message.sender_id,
          name: message.sender_name,
          avatar: message.sender_avatar,
        },
      }
    })

    // Criar objeto de backup
    const backupData = {
      chat: {
        id: chat.id,
        name: chat.name,
        isGroup: chat.is_group === 1,
        avatar: chat.avatar,
        createdAt: chat.created_at,
      },
      participants: chatParticipants,
      messages: formattedMessages,
      exportedAt: new Date().toISOString(),
      exportedBy: req.user.id,
    }

    // Salvar backup no banco de dados
    await pool.execute("INSERT INTO chat_backups (user_id, chat_id, backup_data) VALUES (?, ?, ?)", [
      req.user.id,
      chatId,
      JSON.stringify(backupData),
    ])

    // Registrar ação
    await pool.execute("INSERT INTO action_logs (chat_id, user_id, action_type, details) VALUES (?, ?, ?, ?)", [
      chatId,
      req.user.id,
      "OTHER",
      "Exportou o histórico de mensagens",
    ])

    res.json(backupData)
  } catch (error) {
    console.error("Error exporting chat:", error)
    res.status(500).json({ message: "Erro interno do servidor" })
  }
})

// Rota para importar mensagens
app.post("/api/chats/import", authenticateJWT, async (req, res) => {
  try {
    const { userId, chatData } = req.body

    if (!chatData || !chatData.chat || !chatData.messages) {
      return res.status(400).json({ message: "Dados de backup inválidos" })
    }

    // Verificar se o usuário tem permissão
    if (userId !== req.user.id) {
      return res.status(403).json({ message: "Você não tem permissão para realizar esta ação" })
    }

    // Iniciar transação
    const connection = await pool.getConnection()
    await connection.beginTransaction()

    try {
      // Criar chat se não existir
      let chatId
      const [existingChats] = await connection.execute("SELECT id FROM chats WHERE id = ?", [chatData.chat.id])

      if (existingChats && existingChats.length > 0) {
        chatId = existingChats[0].id
      } else {
        const [chatResult] = await connection.execute("INSERT INTO chats (name, is_group, avatar) VALUES (?, ?, ?)", [
          chatData.chat.name,
          chatData.chat.isGroup ? 1 : 0,
          chatData.chat.avatar,
        ])

        chatId = chatResult.insertId

        // Adicionar participantes
        for (const participant of chatData.participants) {
          // Verificar se o usuário existe
          const [existingUsers] = await connection.execute("SELECT id FROM users WHERE id = ?", [participant.id])

          if (existingUsers && existingUsers.length > 0) {
            await connection.execute(
              "INSERT IGNORE INTO chat_participants (chat_id, user_id, is_admin) VALUES (?, ?, ?)",
              [chatId, participant.id, participant.is_admin ? 1 : 0],
            )
          }
        }

        // Adicionar o usuário atual como participante se não estiver na lista
        await connection.execute("INSERT IGNORE INTO chat_participants (chat_id, user_id, is_admin) VALUES (?, ?, ?)", [
          chatId,
          userId,
          1,
        ])
      }

      // Importar mensagens
      for (const message of chatData.messages) {
        // Verificar se a mensagem já existe
        const [existingMessages] = await connection.execute("SELECT id FROM messages WHERE id = ?", [message.id])

        if (existingMessages && existingMessages.length === 0) {
          // Criptografar mensagem se for do tipo texto
          let content = message.content
          if (message.type === "text") {
            content = encryptMessage(message.content, ENCRYPTION_KEY)
          }

          await connection.execute(
            "INSERT INTO messages (id, chat_id, sender_id, content, type, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            [message.id, chatId, message.sender.id, content, message.type, message.timestamp],
          )
        }
      }

      // Registrar ação
      await connection.execute("INSERT INTO action_logs (user_id, chat_id, action_type, details) VALUES (?, ?, ?, ?)", [
        userId,
        chatId,
        "OTHER",
        "Importou histórico de mensagens",
      ])

      // Commit transação
      await connection.commit()

      res.json({
        message: "Chat importado com sucesso",
        chatId,
      })
    } catch (error) {
      // Rollback em caso de erro
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error("Error importing chat:", error)
    res.status(500).json({ message: "Erro interno do servidor" })
  }
})

// Rota para sincronizar mensagens
app.post("/api/chats/:chatId/sync", authenticateJWT, async (req, res) => {
  try {
    const { chatId } = req.params

    // Verificar se o usuário é participante do chat
    const [participants] = await pool.execute("SELECT * FROM chat_participants WHERE chat_id = ? AND user_id = ?", [
      chatId,
      req.user.id,
    ])

    if (!participants || participants.length === 0) {
      return res.status(403).json({ message: "Você não tem permissão para acessar este chat" })
    }

    // Simular sincronização
    // Em um caso real, você implementaria a lógica para buscar mensagens
    // que o cliente não possui e enviá-las

    // Registrar ação
    await pool.execute("INSERT INTO action_logs (chat_id, user_id, action_type, details) VALUES (?, ?, ?, ?)", [
      chatId,
      req.user.id,
      "OTHER",
      "Sincronizou mensagens",
    ])

    res.json({
      message: "Mensagens sincronizadas com sucesso",
      syncedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error syncing messages:", error)
    res.status(500).json({ message: "Erro interno do servidor" })
  }
})

// Rota para obter logs de ações de um chat
app.get("/api/logs/chat/:chatId", authenticateJWT, async (req, res) => {
  try {
    const { chatId } = req.params

    // Verificar se o usuário é participante do chat
    const [participants] = await pool.execute("SELECT * FROM chat_participants WHERE chat_id = ? AND user_id = ?", [
      chatId,
      req.user.id,
    ])

    if (!participants || participants.length === 0) {
      return res.status(403).json({ message: "Você não tem permissão para acessar este chat" })
    }

    // Verificar se o usuário é administrador (para logs completos)
    const isAdmin = participants[0].is_admin === 1

    // Obter logs
    let sql = `
      SELECT l.*, u.name as user_name, u.avatar as user_avatar, 
             t.name as target_name, t.avatar as target_avatar
      FROM action_logs l
      JOIN users u ON l.user_id = u.id
      LEFT JOIN users t ON l.target_id = t.id
      WHERE l.chat_id = ?
    `

    if (!isAdmin) {
      // Se não for admin, limitar os tipos de logs visíveis
      sql += ' AND l.action_type IN ("ADD_MEMBER", "REMOVE_MEMBER", "PIN_MESSAGE", "CHANGE_ADMIN")'
    }

    sql += " ORDER BY l.timestamp DESC LIMIT 100"

    const [logs] = await pool.execute(sql, [chatId])

    // Formatar logs
    const formattedLogs = logs.map((log) => ({
      id: log.id,
      chatId: log.chat_id,
      userId: log.user_id,
      targetId: log.target_id,
      actionType: log.action_type,
      details: log.details,
      timestamp: log.timestamp,
      user: {
        name: log.user_name,
        avatar: log.user_avatar,
      },
      target: log.target_id
        ? {
            name: log.target_name,
            avatar: log.target_avatar,
          }
        : undefined,
    }))

    res.json({ logs: formattedLogs })
  } catch (error) {
    console.error("Error fetching logs:", error)
    res.status(500).json({ message: "Erro interno do servidor" })
  }
})

// Rota para obter logs de ações de um usuário
app.get("/api/logs/user/:userId", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.params

    // Verificar se o usuário tem permissão
    if (userId !== req.user.id.toString()) {
      return res.status(403).json({ message: "Você não tem permissão para acessar estes logs" })
    }

    // Obter logs
    const [logs] = await pool.execute(
      `SELECT l.*, c.name as chat_name
       FROM action_logs l
       LEFT JOIN chats c ON l.chat_id = c.id
       WHERE l.user_id = ?
       ORDER BY l.timestamp DESC LIMIT 100`,
      [userId],
    )

    // Formatar logs
    const formattedLogs = logs.map((log) => ({
      id: log.id,
      chatId: log.chat_id,
      chatName: log.chat_name,
      actionType: log.action_type,
      details: log.details,
      timestamp: log.timestamp,
    }))

    res.json({ logs: formattedLogs })
  } catch (error) {
    console.error("Error fetching user logs:", error)
    res.status(500).json({ message: "Erro interno do servidor" })
  }
})

// Rota para criar enquete
app.post("/api/polls", authenticateJWT, async (req, res) => {
  try {
    const { chatId, question, options } = req.body

    if (!chatId || !question || !options || options.length < 2) {
      return res.status(400).json({ message: "Dados incompletos para criar enquete" })
    }

    // Verificar se o usuário é participante do chat
    const [participants] = await pool.execute("SELECT * FROM chat_participants WHERE chat_id = ? AND user_id = ?", [
      chatId,
      req.user.id,
    ])

    if (!participants || participants.length === 0) {
      return res.status(403).json({ message: "Você não tem permissão para acessar este chat" })
    }

    // Iniciar transação
    const connection = await pool.getConnection()
    await connection.beginTransaction()

    try {
      // Criar mensagem
      const pollContent = JSON.stringify({ question, options: options.map((o) => ({ text: o })) })
      const encryptedContent = encryptMessage(pollContent, ENCRYPTION_KEY)

      const [messageResult] = await connection.execute(
        "INSERT INTO messages (chat_id, sender_id, content, type) VALUES (?, ?, ?, ?)",
        [chatId, req.user.id, encryptedContent, "poll"],
      )

      const messageId = messageResult.insertId

      // Criar enquete
      const [pollResult] = await connection.execute(
        "INSERT INTO polls (message_id, question, created_by) VALUES (?, ?, ?)",
        [messageId, question, req.user.id],
      )

      const pollId = pollResult.insertId

      // Adicionar opções
      for (const option of options) {
        await connection.execute("INSERT INTO poll_options (poll_id, text) VALUES (?, ?)", [pollId, option])
      }

      // Registrar ação
      await connection.execute("INSERT INTO action_logs (chat_id, user_id, action_type, details) VALUES (?, ?, ?, ?)", [
        chatId,
        req.user.id,
        "OTHER",
        "Criou uma enquete",
      ])

      // Commit transação
      await connection.commit()

      // Obter dados completos da enquete
      const [pollData] = await pool.execute(
        "SELECT p.*, m.chat_id FROM polls p JOIN messages m ON p.message_id = m.id WHERE p.id = ?",
        [pollId],
      )

      const [pollOptions] = await pool.execute("SELECT * FROM poll_options WHERE poll_id = ?", [pollId])

      const formattedOptions = pollOptions.map((option) => ({
        id: option.id,
        text: option.text,
        votes: 0,
      }))

      // Enviar resposta
      res.status(201).json({
        id: pollId,
        messageId,
        chatId,
        question,
        options: formattedOptions,
        totalVotes: 0,
        createdBy: req.user.id,
        createdAt: pollData[0].created_at,
      })
    } catch (error) {
      // Rollback em caso de erro
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error("Error creating poll:", error)
    res.status(500).json({ message: "Erro interno do servidor" })
  }
})

// Rota para votar em enquete
app.post("/api/polls/:pollId/vote", authenticateJWT, async (req, res) => {
  try {
    const { pollId } = req.params
    const { optionId } = req.body

    if (!optionId) {
      return res.status(400).json({ message: "ID da opção é obrigatório" })
    }

    // Verificar se a enquete existe
    const [polls] = await pool.execute(
      "SELECT p.*, m.chat_id FROM polls p JOIN messages m ON p.message_id = m.id WHERE p.id = ?",
      [pollId],
    )

    if (!polls || polls.length === 0) {
      return res.status(404).json({ message: "Enquete não encontrada" })
    }

    const poll = polls[0]

    // Verificar se o usuário é participante do chat
    const [participants] = await pool.execute("SELECT * FROM chat_participants WHERE chat_id = ? AND user_id = ?", [
      poll.chat_id,
      req.user.id,
    ])

    if (!participants || participants.length === 0) {
      return res.status(403).json({ message: "Você não tem permissão para acessar este chat" })
    }

    // Verificar se a opção existe
    const [options] = await pool.execute("SELECT * FROM poll_options WHERE id = ? AND poll_id = ?", [optionId, pollId])

    if (!options || options.length === 0) {
      return res.status(404).json({ message: "Opção não encontrada" })
    }

    // Verificar se o usuário já votou
    const [existingVotes] = await pool.execute("SELECT * FROM poll_votes WHERE poll_id = ? AND user_id = ?", [
      pollId,
      req.user.id,
    ])

    // Iniciar transação
    const connection = await pool.getConnection()
    await connection.beginTransaction()

    try {
      if (existingVotes && existingVotes.length > 0) {
        // Atualizar voto existente
        await connection.execute(
          "UPDATE poll_votes SET option_id = ?, voted_at = NOW() WHERE poll_id = ? AND user_id = ?",
          [optionId, pollId, req.user.id],
        )
      } else {
        // Adicionar novo voto
        await connection.execute("INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES (?, ?, ?)", [
          pollId,
          optionId,
          req.user.id,
        ])
      }

      // Commit transação
      await connection.commit()

      // Obter resultados atualizados
      const [pollOptions] = await pool.execute(
        `SELECT po.*, COUNT(pv.id) as vote_count
         FROM poll_options po
         LEFT JOIN poll_votes pv ON po.id = pv.option_id
         WHERE po.poll_id = ?
         GROUP BY po.id`,
        [pollId],
      )

      const [totalVotes] = await pool.execute("SELECT COUNT(*) as total FROM poll_votes WHERE poll_id = ?", [pollId])

      const formattedOptions = pollOptions.map((option) => ({
        id: option.id,
        text: option.text,
        votes: Number.parseInt(option.vote_count),
      }))

      // Enviar resposta
      res.json({
        id: pollId,
        question: poll.question,
        options: formattedOptions,
        totalVotes: Number.parseInt(totalVotes[0].total),
        hasVoted: true,
        votedOption: optionId,
      })
    } catch (error) {
      // Rollback em caso de erro
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error("Error voting in poll:", error)
    res.status(500).json({ message: "Erro interno do servidor" })
  }
})

// Rota para fixar/desafixar mensagem
app.post("/api/messages/:messageId/pin", authenticateJWT, async (req, res) => {
  try {
    const { messageId } = req.params
    const { pin } = req.body // true para fixar, false para desafixar

    // Verificar se a mensagem existe
    const [messages] = await pool.execute("SELECT * FROM messages WHERE id = ?", [messageId])

    if (!messages || messages.length === 0) {
      return res.status(404).json({ message: "Mensagem não encontrada" })
    }

    const message = messages[0]

    // Verificar se o usuário é participante do chat
    const [participants] = await pool.execute("SELECT * FROM chat_participants WHERE chat_id = ? AND user_id = ?", [
      message.chat_id,
      req.user.id,
    ])

    if (!participants || participants.length === 0) {
      return res.status(403).json({ message: "Você não tem permissão para acessar este chat" })
    }

    // Verificar se o usuário é administrador (apenas admins podem fixar mensagens)
    const isAdmin = participants[0].is_admin === 1

    if (!isAdmin) {
      return res.status(403).json({ message: "Apenas administradores podem fixar mensagens" })
    }

    if (pin) {
      // Fixar mensagem
      await pool.execute("INSERT IGNORE INTO pinned_messages (chat_id, message_id, pinned_by) VALUES (?, ?, ?)", [
        message.chat_id,
        messageId,
        req.user.id,
      ])

      // Registrar ação
      await pool.execute("INSERT INTO action_logs (chat_id, user_id, action_type, details) VALUES (?, ?, ?, ?)", [
        message.chat_id,
        req.user.id,
        "PIN_MESSAGE",
        "Fixou uma mensagem",
      ])
    } else {
      // Desafixar mensagem
      await pool.execute("DELETE FROM pinned_messages WHERE chat_id = ? AND message_id = ?", [
        message.chat_id,
        messageId,
      ])

      // Registrar ação
      await pool.execute("INSERT INTO action_logs (chat_id, user_id, action_type, details) VALUES (?, ?, ?, ?)", [
        message.chat_id,
        req.user.id,
        "PIN_MESSAGE",
        "Desafixou uma mensagem",
      ])
    }

    res.json({
      messageId,
      chatId: message.chat_id,
      isPinned: pin,
      pinnedBy: req.user.id,
      pinnedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error pinning message:", error)
    res.status(500).json({ message: "Erro interno do servidor" })
  }
})

