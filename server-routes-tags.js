// Import necessary modules
const express = require("express")
const jwt = require("jsonwebtoken")
const mysql = require("mysql2/promise")

// Initialize express app
const app = express()

// Database configuration
const pool = mysql.createPool({
  host: "localhost",
  user: "chatuser",
  password: "chatuser",
  database: "chat_app",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

// Middleware to authenticate JWT token
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization

  if (authHeader) {
    const token = authHeader.split(" ")[1]

    jwt.verify(token, "your-secret-key", (err, user) => {
      if (err) {
        return res.sendStatus(403)
      }

      req.user = user
      next()
    })
  } else {
    res.sendStatus(401)
  }
}

// Rota para obter todas as tags
app.get("/api/tags", authenticateJWT, async (req, res) => {
  try {
    const [tags] = await pool.execute(`
      SELECT t.*, 
        (SELECT COUNT(*) FROM user_tags WHERE tag_id = t.id) as user_count,
        (SELECT COUNT(*) FROM chat_tags WHERE tag_id = t.id) as chat_count
      FROM tags t
      ORDER BY t.name ASC
    `)

    res.json({ tags })
  } catch (error) {
    console.error("Error fetching tags:", error)
    res.status(500).json({ message: "Erro interno do servidor" })
  }
})

// Rota para criar uma nova tag
app.post("/api/tags", authenticateJWT, async (req, res) => {
  try {
    const { name, description, color, icon, permissions } = req.body

    // Verificar se o usuário tem permissão para criar tags
    const hasPermission = await checkUserPermission(req.user.id, "manage_tags")

    if (!hasPermission) {
      return res.status(403).json({ message: "Você não tem permissão para criar tags" })
    }

    // Iniciar transação
    const connection = await pool.getConnection()
    await connection.beginTransaction()

    try {
      // Criar tag
      const [result] = await connection.execute(
        "INSERT INTO tags (name, description, color, icon, created_by) VALUES (?, ?, ?, ?, ?)",
        [name, description, color, icon, req.user.id],
      )

      const tagId = result.insertId

      // Adicionar permissões
      if (permissions && permissions.length > 0) {
        for (const permission of permissions) {
          await connection.execute(
            "INSERT INTO tag_permissions (tag_id, permission_name, permission_value, created_by) VALUES (?, ?, ?, ?)",
            [tagId, permission.name, permission.value, req.user.id],
          )
        }
      }

      // Commit transação
      await connection.commit()

      // Obter tag criada
      const [tags] = await pool.execute("SELECT * FROM tags WHERE id = ?", [tagId])

      res.status(201).json({
        message: "Tag criada com sucesso",
        tag: tags[0],
      })
    } catch (error) {
      // Rollback em caso de erro
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error("Error creating tag:", error)
    res.status(500).json({ message: "Erro interno do servidor" })
  }
})

// Rota para atualizar uma tag
app.put("/api/tags/:tagId", authenticateJWT, async (req, res) => {
  try {
    const { tagId } = req.params
    const { name, description, color, icon, permissions } = req.body

    // Verificar se o usuário tem permissão para gerenciar tags
    const hasPermission = await checkUserPermission(req.user.id, "manage_tags")

    if (!hasPermission) {
      return res.status(403).json({ message: "Você não tem permissão para atualizar tags" })
    }

    // Iniciar transação
    const connection = await pool.getConnection()
    await connection.beginTransaction()

    try {
      // Atualizar tag
      await connection.execute("UPDATE tags SET name = ?, description = ?, color = ?, icon = ? WHERE id = ?", [
        name,
        description,
        color,
        icon,
        tagId,
      ])

      // Atualizar permissões
      if (permissions && permissions.length > 0) {
        // Remover permissões existentes
        await connection.execute("DELETE FROM tag_permissions WHERE tag_id = ?", [tagId])

        // Adicionar novas permissões
        for (const permission of permissions) {
          await connection.execute(
            "INSERT INTO tag_permissions (tag_id, permission_name, permission_value, created_by) VALUES (?, ?, ?, ?)",
            [tagId, permission.name, permission.value, req.user.id],
          )
        }
      }

      // Commit transação
      await connection.commit()

      // Obter tag atualizada
      const [tags] = await pool.execute("SELECT * FROM tags WHERE id = ?", [tagId])

      res.json({
        message: "Tag atualizada com sucesso",
        tag: tags[0],
      })
    } catch (error) {
      // Rollback em caso de erro
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error("Error updating tag:", error)
    res.status(500).json({ message: "Erro interno do servidor" })
  }
})

// Rota para excluir uma tag
app.delete("/api/tags/:tagId", authenticateJWT, async (req, res) => {
  try {
    const { tagId } = req.params

    // Verificar se o usuário tem permissão para gerenciar tags
    const hasPermission = await checkUserPermission(req.user.id, "manage_tags")

    if (!hasPermission) {
      return res.status(403).json({ message: "Você não tem permissão para excluir tags" })
    }

    // Excluir tag (as associações serão excluídas automaticamente devido às chaves estrangeiras)
    await pool.execute("DELETE FROM tags WHERE id = ?", [tagId])

    res.json({
      message: "Tag excluída com sucesso",
    })
  } catch (error) {
    console.error("Error deleting tag:", error)
    res.status(500).json({ message: "Erro interno do servidor" })
  }
})

// Rota para obter permissões de uma tag
app.get("/api/tags/:tagId/permissions", authenticateJWT, async (req, res) => {
  try {
    const { tagId } = req.params

    const [permissions] = await pool.execute("SELECT * FROM tag_permissions WHERE tag_id = ?", [tagId])

    res.json({ permissions })
  } catch (error) {
    console.error("Error fetching tag permissions:", error)
    res.status(500).json({ message: "Erro interno do servidor" })
  }
})

// Rota para atribuir tag a um usuário
app.post("/api/users/:userId/tags", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.params
    const { tagId } = req.body

    // Verificar se o usuário tem permissão para gerenciar tags
    const hasPermission = await checkUserPermission(req.user.id, "manage_tags")

    if (!hasPermission) {
      return res.status(403).json({ message: "Você não tem permissão para atribuir tags" })
    }

    // Atribuir tag ao usuário
    await pool.execute("INSERT IGNORE INTO user_tags (user_id, tag_id, assigned_by) VALUES (?, ?, ?)", [
      userId,
      tagId,
      req.user.id,
    ])

    res.json({
      message: "Tag atribuída com sucesso",
    })
  } catch (error) {
    console.error("Error assigning tag to user:", error)
    res.status(500).json({ message: "Erro interno do servidor" })
  }
})

// Rota para remover tag de um usuário
app.delete("/api/users/:userId/tags/:tagId", authenticateJWT, async (req, res) => {
  try {
    const { userId, tagId } = req.params

    // Verificar se o usuário tem permissão para gerenciar tags
    const hasPermission = await checkUserPermission(req.user.id, "manage_tags")

    if (!hasPermission) {
      return res.status(403).json({ message: "Você não tem permissão para remover tags" })
    }

    // Remover tag do usuário
    await pool.execute("DELETE FROM user_tags WHERE user_id = ? AND tag_id = ?", [userId, tagId])

    res.json({
      message: "Tag removida com sucesso",
    })
  } catch (error) {
    console.error("Error removing tag from user:", error)
    res.status(500).json({ message: "Erro interno do servidor" })
  }
})

// Rota para obter tags de um chat
app.get("/api/chats/:chatId/tags", authenticateJWT, async (req, res) => {
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

    // Obter tags do chat
    const [chatTags] = await pool.execute(
      `
      SELECT t.*
      FROM tags t
      JOIN chat_tags ct ON t.id = ct.tag_id
      WHERE ct.chat_id = ?
    `,
      [chatId],
    )

    res.json({ tags: chatTags })
  } catch (error) {
    console.error("Error fetching chat tags:", error)
    res.status(500).json({ message: "Erro interno do servidor" })
  }
})

// Rota para atualizar configurações de um chat
app.put("/api/chats/:chatId", authenticateJWT, async (req, res) => {
  try {
    const { chatId } = req.params
    const { name, settings, tags } = req.body

    // Verificar se o usuário é participante do chat
    const [participants] = await pool.execute("SELECT * FROM chat_participants WHERE chat_id = ? AND user_id = ?", [
      chatId,
      req.user.id,
    ])

    if (!participants || participants.length === 0) {
      return res.status(403).json({ message: "Você não tem permissão para acessar este chat" })
    }

    // Verificar se o usuário é administrador do chat
    const isAdmin = participants[0].is_admin === 1

    // Verificar se apenas administradores podem alterar informações
    const [chats] = await pool.execute("SELECT * FROM chats WHERE id = ?", [chatId])
    const chat = chats[0]
    const chatSettings = chat.settings ? JSON.parse(chat.settings) : {}

    if (chatSettings.onlyAdminsCanChangeInfo && !isAdmin) {
      return res.status(403).json({ message: "Apenas administradores podem alterar informações do grupo" })
    }

    // Iniciar transação
    const connection = await pool.getConnection()
    await connection.beginTransaction()

    try {
      // Atualizar chat
      await connection.execute("UPDATE chats SET name = ?, settings = ? WHERE id = ?", [
        name,
        JSON.stringify(settings),
        chatId,
      ])

      // Atualizar tags do chat
      if (tags && isAdmin) {
        // Remover tags existentes
        await connection.execute("DELETE FROM chat_tags WHERE chat_id = ?", [chatId])

        // Adicionar novas tags
        for (const tagId of tags) {
          await connection.execute("INSERT INTO chat_tags (chat_id, tag_id, assigned_by) VALUES (?, ?, ?)", [
            chatId,
            tagId,
            req.user.id,
          ])
        }
      }

      // Commit transação
      await connection.commit()

      // Obter chat atualizado
      const [updatedChats] = await pool.execute("SELECT * FROM chats WHERE id = ?", [chatId])

      // Obter participantes
      const [chatParticipants] = await pool.execute(
        `
        SELECT u.id, u.name, u.email, u.avatar, u.is_online, cp.is_admin
        FROM users u
        JOIN chat_participants cp ON u.id = cp.user_id
        WHERE cp.chat_id = ?
      `,
        [chatId],
      )

      // Obter tags
      const [chatTags] = await pool.execute(
        `
        SELECT t.*
        FROM tags t
        JOIN chat_tags ct ON t.id = ct.tag_id
        WHERE ct.chat_id = ?
      `,
        [chatId],
      )

      const updatedChat = {
        ...updatedChats[0],
        participants: chatParticipants,
        tags: chatTags,
      }

      res.json(updatedChat)
    } catch (error) {
      // Rollback em caso de erro
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error("Error updating chat:", error)
    res.status(500).json({ message: "Erro interno do servidor" })
  }
})

// Rota para arquivar um chat
app.post("/api/chats/:chatId/archive", authenticateJWT, async (req, res) => {
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

    // Verificar se o chat já está arquivado
    const [archivedChats] = await pool.execute("SELECT * FROM archived_chats WHERE chat_id = ? AND user_id = ?", [
      chatId,
      req.user.id,
    ])

    if (archivedChats && archivedChats.length > 0) {
      // Desarquivar chat
      await pool.execute("DELETE FROM archived_chats WHERE chat_id = ? AND user_id = ?", [chatId, req.user.id])

      res.json({
        message: "Chat desarquivado com sucesso",
        isArchived: false,
      })
    } else {
      // Arquivar chat
      await pool.execute("INSERT INTO archived_chats (chat_id, user_id) VALUES (?, ?)", [chatId, req.user.id])

      res.json({
        message: "Chat arquivado com sucesso",
        isArchived: true,
      })
    }
  } catch (error) {
    console.error("Error archiving chat:", error)
    res.status(500).json({ message: "Erro interno do servidor" })
  }
})

// Função auxiliar para verificar permissões do usuário
async function checkUserPermission(userId, permissionName) {
  // Verificar se o usuário é administrador global
  const [admins] = await pool.execute("SELECT * FROM users WHERE id = ? AND is_admin = 1", [userId])

  if (admins && admins.length > 0) {
    return true
  }

  // Verificar permissões baseadas em tags
  const [permissions] = await pool.execute(
    `
    SELECT tp.*
    FROM tag_permissions tp
    JOIN user_tags ut ON tp.tag_id = ut.tag_id
    WHERE ut.user_id = ? AND tp.permission_name = ? AND tp.permission_value = 1
  `,
    [userId, permissionName],
  )

  return permissions && permissions.length > 0
}

