import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"

export async function POST(req: Request) {
  const { path } = await req.json()

  if (path === "/login") {
    return handleLogin(req)
  } else if (path === "/register") {
    return handleRegister(req)
  }

  return NextResponse.json({ error: "Invalid path" }, { status: 400 })
}

async function handleLogin(req: Request) {
  try {
    const { email, password } = await req.json()

    // Find user in database
    const [users] = await db.execute("SELECT * FROM users WHERE email = ?", [email])

    if (!users || users.length === 0) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 })
    }

    const user = users[0]

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 })
    }

    // Generate JWT token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" })

    // Update user status to online
    await db.execute("UPDATE users SET is_online = 1 WHERE id = ?", [user.id])

    // Return user data and token (excluding password)
    const { password: _, ...userWithoutPassword } = user

    return NextResponse.json({
      user: userWithoutPassword,
      token,
    })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

async function handleRegister(req: Request) {
  try {
    const { name, email, password } = await req.json()

    // Check if user already exists
    const [existingUsers] = await db.execute("SELECT * FROM users WHERE email = ?", [email])

    if (existingUsers && existingUsers.length > 0) {
      return NextResponse.json({ message: "Email already in use" }, { status: 400 })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const [result] = await db.execute("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", [
      name,
      email,
      hashedPassword,
    ])

    return NextResponse.json({
      message: "User registered successfully",
      userId: result.insertId,
    })
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

