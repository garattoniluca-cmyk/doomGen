import mysql from 'mysql2/promise'

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'jupiter-dev.sandboxgames.it',
  port:     parseInt(process.env.DB_PORT || '3309'),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || 'jupi./20',
  database: process.env.DB_NAME     || 'doomGen',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
})

export default pool
