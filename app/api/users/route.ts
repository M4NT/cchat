import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET() {
  try {
    // Buscar todos os usuários
    const [users] = await db.execute(`
      SELECT id, name, email, avatar, is_online, last_seen 
      FROM users 
      ORDER BY name ASC
    `)

    return NextResponse.json({ users })
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json({ message: "Erro interno do servidor" }, { status: 500 })
  }
} 