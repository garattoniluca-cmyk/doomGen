import pool from './connection.js'

const TABLES = [
  // Users
  `CREATE TABLE IF NOT EXISTS users (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    google_id   VARCHAR(255) NOT NULL UNIQUE,
    email       VARCHAR(255) NOT NULL UNIQUE,
    name        VARCHAR(255) NOT NULL,
    avatar_url  TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Admins
  `CREATE TABLE IF NOT EXISTS admins (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Monsters
  `CREATE TABLE IF NOT EXISTS monsters (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    name            VARCHAR(255) NOT NULL,
    health          INT NOT NULL DEFAULT 100,
    speed           INT NOT NULL DEFAULT 5,
    damage          INT NOT NULL DEFAULT 20,
    behavior        ENUM('patrol','chase','shoot','ambush','stationary') DEFAULT 'patrol',
    resistances     JSON,
    appearance      TEXT,
    special_attacks JSON,
    lore            TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Surfaces
  `CREATE TABLE IF NOT EXISTS surfaces (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    name            VARCHAR(255) NOT NULL,
    surface_type    ENUM('wall','floor','ceiling') NOT NULL,
    primary_color   VARCHAR(7) NOT NULL,
    secondary_color VARCHAR(7) NOT NULL,
    pattern         ENUM('solid','brick','stone','metal','wood','organic') DEFAULT 'brick',
    mood            VARCHAR(50),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Levels
  `CREATE TABLE IF NOT EXISTS levels (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    grid        JSON NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Supplies (forniture — oggetti/arredi per popolare i livelli)
  `CREATE TABLE IF NOT EXISTS supplies (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    name       VARCHAR(255) NOT NULL,
    geometry   JSON         DEFAULT NULL,
    sounds     JSON         DEFAULT NULL,
    thumbnail  MEDIUMTEXT   DEFAULT NULL,
    lore       TEXT         DEFAULT NULL,
    active     TINYINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
]

export async function initDB() {
  const conn = await pool.getConnection()
  try {
    for (const sql of TABLES) {
      await conn.query(sql)
    }
    // Users columns
    await conn.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen    DATETIME     DEFAULT NULL`)
    await conn.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS current_page VARCHAR(50)  DEFAULT NULL`)
    // Monster columns
    await conn.query(`ALTER TABLE monsters ADD COLUMN IF NOT EXISTS geometry     JSON         DEFAULT NULL`)
    await conn.query(`ALTER TABLE monsters ADD COLUMN IF NOT EXISTS thumbnail    MEDIUMTEXT   DEFAULT NULL`)
    await conn.query(`ALTER TABLE monsters ADD COLUMN IF NOT EXISTS sight_range  INT          DEFAULT 10`)
    await conn.query(`ALTER TABLE monsters ADD COLUMN IF NOT EXISTS attack_range INT          DEFAULT 2`)
    // Soft-delete: active flag on all content tables
    await conn.query(`ALTER TABLE monsters ADD COLUMN IF NOT EXISTS sounds JSON DEFAULT NULL`)
    await conn.query(`ALTER TABLE monsters ADD COLUMN IF NOT EXISTS move_type VARCHAR(10) NOT NULL DEFAULT 'walk'`)
    await conn.query(`ALTER TABLE monsters ADD COLUMN IF NOT EXISTS rotate_speed FLOAT NOT NULL DEFAULT 90`)
    await conn.query(`ALTER TABLE monsters ADD COLUMN IF NOT EXISTS fov_angle FLOAT NOT NULL DEFAULT 90`)
    await conn.query(`ALTER TABLE monsters ADD COLUMN IF NOT EXISTS hp_regen TINYINT NOT NULL DEFAULT 0`)
    await conn.query(`ALTER TABLE monsters ADD COLUMN IF NOT EXISTS hp_regen_rate FLOAT NOT NULL DEFAULT 0`)
    await conn.query(`ALTER TABLE monsters ADD COLUMN IF NOT EXISTS attack_type VARCHAR(10) NOT NULL DEFAULT 'melee'`)
    await conn.query(`ALTER TABLE monsters ADD COLUMN IF NOT EXISTS melee_rate FLOAT NOT NULL DEFAULT 1`)
    await conn.query(`ALTER TABLE monsters ADD COLUMN IF NOT EXISTS ranged_range FLOAT NOT NULL DEFAULT 15`)
    await conn.query(`ALTER TABLE monsters ADD COLUMN IF NOT EXISTS ranged_damage FLOAT NOT NULL DEFAULT 15`)
    await conn.query(`ALTER TABLE monsters ADD COLUMN IF NOT EXISTS ranged_rate FLOAT NOT NULL DEFAULT 0.5`)
    await conn.query(`ALTER TABLE monsters ADD COLUMN IF NOT EXISTS hover_height FLOAT NOT NULL DEFAULT 1.5`)
    await conn.query(`ALTER TABLE monsters ADD COLUMN IF NOT EXISTS fov_angle_v FLOAT NOT NULL DEFAULT 60`)
    await conn.query(`ALTER TABLE monsters ADD COLUMN IF NOT EXISTS active TINYINT NOT NULL DEFAULT 1`)
    await conn.query(`ALTER TABLE surfaces ADD COLUMN IF NOT EXISTS active TINYINT NOT NULL DEFAULT 1`)
    await conn.query(`ALTER TABLE levels   ADD COLUMN IF NOT EXISTS active TINYINT NOT NULL DEFAULT 1`)
    // Surface columns — expand pattern to VARCHAR for new hell patterns, add description
    await conn.query(`ALTER TABLE surfaces ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL`)
    await conn.query(`ALTER TABLE surfaces MODIFY COLUMN pattern VARCHAR(50) NOT NULL DEFAULT 'hellstone'`)

    // Session tracking table (one row per session)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        user_id        INT NOT NULL,
        login_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        logout_at      DATETIME DEFAULT NULL,
        duration_secs  INT DEFAULT NULL,
        logout_reason  ENUM('manual','timeout','system') DEFAULT NULL,
        ip             VARCHAR(45) DEFAULT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_login (user_id, login_at),
        INDEX idx_active (logout_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    console.log('[db] Tabelle verificate/create ✓')
  } catch (err) {
    console.error('[db] Errore init schema:', err.message)
    throw err
  } finally {
    conn.release()
  }
}
