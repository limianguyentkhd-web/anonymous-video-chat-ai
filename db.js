const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const envPath = path.resolve(__dirname, '.env');

// --- DEBUG: Load .env và kiểm tra file ---
console.log('[ENV] Đường dẫn file .env:', envPath);
console.log('[ENV] File .env tồn tại:', fs.existsSync(envPath));
const envResult = dotenv.config({ path: envPath, override: true });
if (envResult.error) {
  console.error('[ENV] LỖI khi load .env:', envResult.error.message);
} else {
  console.log('[ENV] Load .env thành công. Các biến đã đọc:', Object.keys(envResult.parsed || {}).join(', '));
}
console.log('[ENV] Giá trị biến môi trường DB hiện tại:', {
  DB_HOST: process.env.DB_HOST || '(KHÔNG CÓ)',
  DB_PORT: process.env.DB_PORT || '(KHÔNG CÓ)',
  DB_NAME: process.env.DB_NAME || '(KHÔNG CÓ)',
  DB_USER: process.env.DB_USER || '(KHÔNG CÓ)',
  DB_PASSWORD: process.env.DB_PASSWORD ? `(đã đặt, ${process.env.DB_PASSWORD.length} ký tự)` : '(KHÔNG CÓ)'
});

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const INCIDENTS_FILE = path.join(DATA_DIR, 'incidents.json');
const BANNED_FILE = path.join(DATA_DIR, 'banned.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getDbConfig() {
  const databaseUrl = (process.env.DATABASE_URL || process.env.DB_URL || '').trim();
  if (databaseUrl) {
    try {
      const url = new URL(databaseUrl);
      const protocol = url.protocol.replace(':', '');
      const client = protocol === 'postgres' ? 'postgres' : 'mysql';
      const connection = {
        host: url.hostname,
        port: Number(url.port || (client === 'postgres' ? 5432 : 3306)),
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.replace(/^\/+/, '')
      };
      return { client, connection, connectionString: databaseUrl };
    } catch (error) {
      console.warn('Invalid DATABASE_URL provided, falling back to file storage.', error.message);
    }
  }

  const client = (process.env.DB_CLIENT || process.env.DB_DIALECT || 'mysql').toLowerCase();
  const connection = {
    host: (process.env.DB_HOST || process.env.DB_HOSTNAME || process.env.MYSQL_HOST || '').trim(),
    port: Number(process.env.DB_PORT || process.env.MYSQL_PORT || (client === 'postgres' ? 5432 : 3306)),
    user: (process.env.DB_USER || process.env.DB_USERNAME || process.env.DB_USER_NAME || process.env.MYSQL_USER || '').trim(),
    password: (process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '').trim(),
    database: (process.env.DB_NAME || process.env.DB_DATABASE || process.env.DB_SCHEMA || process.env.MYSQL_DATABASE || '').trim()
  };

  return { client, connection };
}

function getMysqlConnectionOptions(connectionString, connection) {
  if (connectionString) {
    const url = new URL(connectionString);
    const sslEnabled = url.searchParams.get('ssl') === 'true' || url.searchParams.get('sslmode') === 'require';
    const options = {
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\/+/, '')
    };
    if (sslEnabled || process.env.DB_SSL === 'true' || process.env.MYSQL_SSL === 'true' || process.env.DB_SSLMODE === 'require') {
      options.ssl = { rejectUnauthorized: false };
    }
    if (process.env.DB_SOCKET_PATH) {
      options.socketPath = process.env.DB_SOCKET_PATH;
    }
    if (process.env.DB_CONNECT_TIMEOUT) {
      options.connectTimeout = Number(process.env.DB_CONNECT_TIMEOUT);
    }
    return options;
  }

  const options = { ...connection };
  if (process.env.DB_SSL === 'true' || process.env.MYSQL_SSL === 'true' || process.env.DB_SSLMODE === 'require') {
    options.ssl = { rejectUnauthorized: false };
  }
  if (process.env.DB_SOCKET_PATH) {
    options.socketPath = process.env.DB_SOCKET_PATH;
  }
  if (process.env.DB_CONNECT_TIMEOUT) {
    options.connectTimeout = Number(process.env.DB_CONNECT_TIMEOUT);
  }
  return options;
}

async function connectWithConfiguredHost(connectionString, connection) {
  const mysql = require('mysql2/promise');
  const baseOptions = getMysqlConnectionOptions(connectionString, connection);

  const configuredHost = (process.env.DB_HOST || process.env.DB_HOSTNAME || process.env.MYSQL_HOST || '').trim();
  const hosts = [];

  if (configuredHost && configuredHost !== '') {
    hosts.push(configuredHost);
  } else if (connection && connection.host) {
    hosts.push(connection.host);
  } else {
    hosts.push('localhost');
  }

  if (!baseOptions.connectTimeout) {
    baseOptions.connectTimeout = 10000;
  }

  const poolOptions = {
    ...baseOptions,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  };

  console.log('[DB] Chuẩn bị khởi tạo MySQL Connection Pool với options:', {
    host: poolOptions.host,
    port: poolOptions.port,
    user: poolOptions.user,
    database: poolOptions.database,
    connectionLimit: poolOptions.connectionLimit
  });

  const attemptedHosts = [];
  for (const host of hosts) {
    const options = { ...poolOptions, host };
    attemptedHosts.push(host);
    console.log(`[DB] Đang thử kết nối MySQL Pool: host=${host}, port=${options.port}, user=${options.user}, database=${options.database}`);
    try {
      const pool = mysql.createPool(options);
      await pool.execute('SELECT 1');
      console.log(`[DB] ✅ Kết nối MySQL Pool thành công tại host: ${host}`);
      return pool;
    } catch (error) {
      console.error(`[DB] ❌ Kết nối thất bại tại host ${host}:`);
      console.error(`     Mã lỗi: ${error.code || 'N/A'}`);
      console.error(`     Thông báo: ${error.message}`);
      if (error && (error.code === 'ER_ACCESS_DENIED_ERROR' || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT')) {
        continue;
      }
      throw error;
    }
  }

  const error = new Error(`Không thể kết nối MySQL với host: ${attemptedHosts.join(', ')}. Kiểm tra lại DB_HOST, DB_USER, DB_PASSWORD, DB_NAME trong file .env`);
  error.code = 'DB_CONNECT_FAILED';
  throw error;
}

function isDbConfigured() {
  const { client, connection, connectionString } = getDbConfig();
  if (connectionString) return Boolean(connectionString);
  return Boolean(client && connection.host && connection.user && connection.database);
}

let dbClient = null;
let dbType = null;
let dbPromise = null;

// Lưu log lỗi kết nối gần nhất để debug qua API
let lastDbError = null;
let dbInitAttemptTime = null;
let dbStatus = 'not_initialized'; // 'not_initialized' | 'connecting' | 'connected' | 'failed' | 'file_fallback'

function getDbStatus() {
  return {
    status: dbStatus,
    dbType: dbType,
    lastError: lastDbError,
    initAttemptTime: dbInitAttemptTime,
    isConnected: dbClient !== null,
    envConfig: {
      DB_HOST: process.env.DB_HOST || '(chưa đặt)',
      DB_PORT: process.env.DB_PORT || '(chưa đặt)',
      DB_NAME: process.env.DB_NAME || '(chưa đặt)',
      DB_USER: process.env.DB_USER || '(chưa đặt)',
      DB_PASSWORD: process.env.DB_PASSWORD ? `(đã đặt, ${process.env.DB_PASSWORD.length} ký tự)` : '(chưa đặt)',
      DATABASE_URL: process.env.DATABASE_URL ? '(đã đặt)' : '(chưa đặt)'
    }
  };
}

async function initDatabase() {
  if (dbPromise) {
    return dbPromise;
  }

  dbStatus = 'connecting';
  dbInitAttemptTime = new Date().toISOString();

  dbPromise = (async () => {
    ensureDataDir();

    if (!isDbConfigured()) {
      dbStatus = 'file_fallback';
      console.log('[DB] ⚠️  Không tìm thấy cấu hình SQL đầy đủ trong .env. Đang dùng lưu trữ file JSON.');
      console.log('[DB] Cấu hình .env hiện tại:', {
        DB_HOST: process.env.DB_HOST || '(chưa đặt)',
        DB_PORT: process.env.DB_PORT || '(chưa đặt)',
        DB_NAME: process.env.DB_NAME || '(chưa đặt)',
        DB_USER: process.env.DB_USER || '(chưa đặt)',
        DB_PASSWORD: process.env.DB_PASSWORD ? '(đã đặt)' : '(chưa đặt)'
      });
      console.log('[DB] Tip: Đảm bảo file .env có đủ DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
      return null;
    }

    const { client, connection, connectionString } = getDbConfig();
    console.log(`[DB] Đang khởi tạo kết nối đến database loại: ${client}`);
    console.log('[DB] Thông tin kết nối sẽ dùng:', {
      client,
      host: connection.host,
      port: connection.port,
      database: connection.database,
      user: connection.user,
      passwordProvided: connection.password ? true : false
    });

    try {
      if (client === 'postgres') {
        const { Pool } = require('pg');
        dbClient = new Pool(connectionString ? { connectionString } : connection);
        await dbClient.query('SELECT NOW()');
        dbType = 'postgres';
        dbStatus = 'connected';
        lastDbError = null;
        console.log('[DB] ✅ Kết nối PostgreSQL thành công!');
      } else {
        dbClient = await connectWithConfiguredHost(connectionString, connection);
        dbType = 'mysql';
        dbStatus = 'connected';
        lastDbError = null;
        console.log('[DB] ✅ Kết nối MySQL thành công!');
      }

      await ensureTables();
      console.log('[DB] ✅ Các bảng đã sẵn sàng.');
      return dbClient;
    } catch (error) {
      dbStatus = 'failed';
      lastDbError = {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        time: new Date().toISOString()
      };
      console.error('[DB] ❌ Kết nối database thất bại! Đang dùng lưu trữ file JSON làm dự phòng.');
      console.error('[DB] Chi tiết lỗi:');
      console.error('     Thông báo:', error.message);
      console.error('     Mã lỗi:', error.code || 'N/A');
      console.error('     errno:', error.errno || 'N/A');
      console.error('[DB] ➡️  Kiểm tra lại DB_HOST, DB_USER, DB_PASSWORD, DB_NAME trong file .env');
      dbClient = null;
      dbType = null;
      dbPromise = null; // Reset để cho phép thử lại ở lần sau
      return null;
    }
  })();

  return dbPromise;
}

async function closeDatabase() {
  if (dbClient && typeof dbClient.end === 'function') {
    await dbClient.end();
  }
  dbClient = null;
  dbType = null;
  dbPromise = null;
}

async function ensureTables() {
  if (!dbClient) {
    return;
  }

  if (dbType === 'postgres') {
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(100) PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        nickname VARCHAR(255),
        passwordHash TEXT,
        role VARCHAR(50),
        age INTEGER,
        gender VARCHAR(50),
        location VARCHAR(255),
        interests TEXT,
        purpose TEXT,
        verified BOOLEAN,
        avatar TEXT,
        coinBalance INTEGER,
        transactionHistory TEXT
      );
    `);

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS incidents (
        id VARCHAR(100) PRIMARY KEY,
        timestamp VARCHAR(255),
        user_name VARCHAR(255),
        type VARCHAR(50),
        desc TEXT,
        confidence VARCHAR(50),
        status VARCHAR(50)
      );
    `);

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS banned_users (
        username VARCHAR(255) PRIMARY KEY
      );
    `);
  } else {
    await dbClient.execute(`
      CREATE TABLE IF NOT EXISTS users (
        \`id\` VARCHAR(100) PRIMARY KEY,
        \`username\` VARCHAR(100) UNIQUE NOT NULL,
        \`nickname\` VARCHAR(255),
        \`passwordHash\` TEXT,
        \`role\` VARCHAR(50),
        \`age\` INTEGER,
        \`gender\` VARCHAR(50),
        \`location\` VARCHAR(255),
        \`interests\` TEXT,
        \`purpose\` TEXT,
        \`verified\` BOOLEAN,
        \`avatar\` TEXT,
        \`coinBalance\` INTEGER,
        \`transactionHistory\` TEXT
      );
    `);

    await dbClient.execute(`
      CREATE TABLE IF NOT EXISTS incidents (
        id VARCHAR(100) PRIMARY KEY,
        timestamp VARCHAR(255),
        user_name VARCHAR(255),
        type VARCHAR(50),
        desc TEXT,
        confidence VARCHAR(50),
        status VARCHAR(50)
      );
    `);

    await dbClient.execute(`
      CREATE TABLE IF NOT EXISTS banned_users (
        \`username\` VARCHAR(255) PRIMARY KEY
      );
    `);
  }
}

async function readJsonFile(filePath, fallback = []) {
  ensureDataDir();
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    return JSON.parse(content || '[]');
  } catch (error) {
    return fallback;
  }
}

async function writeJsonFile(filePath, data) {
  ensureDataDir();
  const tmpPath = `${filePath}.tmp.${Date.now()}`;
  await fs.promises.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  await fs.promises.rename(tmpPath, filePath);
}

async function getUsersStore() {
  const connection = await initDatabase();
  if (!connection) {
    return readJsonFile(USERS_FILE);
  }

  if (dbType === 'postgres') {
    const result = await connection.query('SELECT * FROM users ORDER BY username ASC');
    return result.rows.map(row => ({
      ...row,
      interests: typeof row.interests === 'string' ? JSON.parse(row.interests || '[]') : row.interests || [],
      transactionHistory: typeof row.transactionHistory === 'string' ? JSON.parse(row.transactionHistory || '[]') : row.transactionHistory || []
    }));
  }

  const [rows] = await connection.execute('SELECT * FROM users ORDER BY username ASC');
  return rows.map(row => ({
    ...row,
    interests: typeof row.interests === 'string' ? JSON.parse(row.interests || '[]') : row.interests || [],
    transactionHistory: typeof row.transactionHistory === 'string' ? JSON.parse(row.transactionHistory || '[]') : row.transactionHistory || []
  }));
}

async function saveUsersStore(users) {
  const connection = await initDatabase();
  if (!connection) {
    return writeJsonFile(USERS_FILE, users);
  }

  if (dbType === 'postgres') {
    for (const user of users) {
      await connection.query(
        `INSERT INTO users (id, username, nickname, passwordHash, role, age, gender, location, interests, purpose, verified, avatar, coinBalance, transactionHistory)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO UPDATE SET
           nickname = EXCLUDED.nickname,
           passwordHash = EXCLUDED.passwordHash,
           role = EXCLUDED.role,
           age = EXCLUDED.age,
           gender = EXCLUDED.gender,
           location = EXCLUDED.location,
           interests = EXCLUDED.interests,
           purpose = EXCLUDED.purpose,
           verified = EXCLUDED.verified,
           avatar = EXCLUDED.avatar,
           coinBalance = EXCLUDED.coinBalance,
           transactionHistory = EXCLUDED.transactionHistory`,
        [
          user.id,
          user.username,
          user.nickname,
          user.passwordHash,
          user.role,
          user.age,
          user.gender,
          user.location,
          JSON.stringify(user.interests || []),
          user.purpose,
          Boolean(user.verified),
          user.avatar,
          user.coinBalance,
          JSON.stringify(user.transactionHistory || [])
        ]
      );
    }
    return;
  }

  for (const user of users) {
    await connection.execute(
      `INSERT INTO users (id, username, nickname, passwordHash, role, age, gender, location, interests, purpose, verified, avatar, coinBalance, transactionHistory)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         nickname = VALUES(nickname),
         passwordHash = VALUES(passwordHash),
         role = VALUES(role),
         age = VALUES(age),
         gender = VALUES(gender),
         location = VALUES(location),
         interests = VALUES(interests),
         purpose = VALUES(purpose),
         verified = VALUES(verified),
         avatar = VALUES(avatar),
         coinBalance = VALUES(coinBalance),
         transactionHistory = VALUES(transactionHistory)`,
      [
        user.id,
        user.username,
        user.nickname,
        user.passwordHash,
        user.role,
        user.age,
        user.gender,
        user.location,
        JSON.stringify(user.interests || []),
        user.purpose,
        Boolean(user.verified),
        user.avatar,
        user.coinBalance,
        JSON.stringify(user.transactionHistory || [])
      ]
    );
  }
}

async function getIncidentsStore() {
  const connection = await initDatabase();
  if (!connection) {
    return readJsonFile(INCIDENTS_FILE);
  }

  if (dbType === 'postgres') {
    const result = await connection.query('SELECT * FROM incidents ORDER BY timestamp ASC');
    return result.rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      user: row.user_name,
      type: row.type,
      desc: row.desc,
      confidence: row.confidence,
      status: row.status
    }));
  }

  const [rows] = await connection.execute('SELECT * FROM incidents ORDER BY timestamp ASC');
  return rows.map(row => ({
    id: row.id,
    timestamp: row.timestamp,
    user: row.user_name,
    type: row.type,
    desc: row.desc,
    confidence: row.confidence,
    status: row.status
  }));
}

async function saveIncidentsStore(incidents) {
  const connection = await initDatabase();
  if (!connection) {
    return writeJsonFile(INCIDENTS_FILE, incidents);
  }

  if (dbType === 'postgres') {
    for (const incident of incidents) {
      await connection.query(
        `INSERT INTO incidents (id, timestamp, user_name, type, desc, confidence, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           timestamp = EXCLUDED.timestamp,
           user_name = EXCLUDED.user_name,
           type = EXCLUDED.type,
           desc = EXCLUDED.desc,
           confidence = EXCLUDED.confidence,
           status = EXCLUDED.status`,
        [incident.id, incident.timestamp, incident.user, incident.type, incident.desc, incident.confidence, incident.status]
      );
    }
    return;
  }

  for (const incident of incidents) {
    await connection.execute(
      `INSERT INTO incidents (id, timestamp, user_name, type, \`desc\`, confidence, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         timestamp = VALUES(timestamp),
         user_name = VALUES(user_name),
         type = VALUES(type),
         \`desc\` = VALUES(\`desc\`),
         confidence = VALUES(confidence),
         status = VALUES(status)`,
      [incident.id, incident.timestamp, incident.user, incident.type, incident.desc, incident.confidence, incident.status]
    );
  }
}

async function getBannedStore() {
  const connection = await initDatabase();
  if (!connection) {
    return readJsonFile(BANNED_FILE);
  }

  if (dbType === 'postgres') {
    const result = await connection.query('SELECT username FROM banned_users ORDER BY username ASC');
    return result.rows.map(row => row.username);
  }

  const [rows] = await connection.execute('SELECT username FROM banned_users ORDER BY username ASC');
  return rows.map(row => row.username);
}

async function saveBannedStore(banned) {
  const connection = await initDatabase();
  if (!connection) {
    return writeJsonFile(BANNED_FILE, banned);
  }

  if (dbType === 'postgres') {
    await connection.query('DELETE FROM banned_users');
    for (const username of banned) {
      await connection.query('INSERT INTO banned_users (username) VALUES ($1)', [username]);
    }
    return;
  }

  await connection.execute('DELETE FROM banned_users');
  for (const username of banned) {
    await connection.execute('INSERT INTO banned_users (username) VALUES (?)', [username]);
  }
}

function getDbClient() {
  return dbClient;
}

module.exports = {
  initDatabase,
  closeDatabase,
  getUsersStore,
  saveUsersStore,
  getIncidentsStore,
  saveIncidentsStore,
  getBannedStore,
  saveBannedStore,
  getDbClient,
  getDbStatus
};
