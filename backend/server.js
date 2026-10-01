require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Middlewares
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Configuración dinámica de la conexión a la Base de Datos (RDS / Local)
// Ningún parámetro está hardcodeado; todos provienen de variables de entorno.
// ---------------------------------------------------------------------------
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'appdb',
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 10
};

// Si nos conectamos a Amazon RDS, podemos habilitar SSL flexible según necesidad
if (process.env.DB_SSL === 'true' || (process.env.DB_HOST && process.env.DB_HOST.includes('rds.amazonaws.com'))) {
  dbConfig.ssl = {
    rejectUnauthorized: false
  };
}

console.log(`[DB] Intentando inicializar conexión a: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database} con usuario: ${dbConfig.user}`);
const pool = new Pool(dbConfig);

// ---------------------------------------------------------------------------
// Inicialización automática de la tabla 'items' si no existe
// (Garantiza que la aplicación funcione en RDS aún si no se ejecutó schema.sql manualmente)
// ---------------------------------------------------------------------------
async function initDatabase() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS items (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      descripcion TEXT,
      precio NUMERIC(10, 2) NOT NULL,
      fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    const client = await pool.connect();
    await client.query(createTableQuery);
    console.log('[DB] Tabla "items" verificada/creada exitosamente en la base de datos.');
    client.release();
  } catch (err) {
    console.error('[DB] Advertencia al verificar/crear la tabla inicial en BD:', err.message);
    console.log('[DB] Se reintentará la conexión en las siguientes solicitudes.');
  }
}

initDatabase();

// ---------------------------------------------------------------------------
// Endpoints de Salud (Health Checks) para ECS Fargate
// ---------------------------------------------------------------------------
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    res.status(200).json({
      status: 'UP',
      service: 'aws-ecs-backend',
      database: 'connected',
      db_time: result.rows[0].current_time
    });
  } catch (error) {
    res.status(500).json({
      status: 'DOWN',
      service: 'aws-ecs-backend',
      database: 'disconnected',
      error: error.message
    });
  }
});

// Endpoint raíz informativo
app.get('/', (req, res) => {
  res.json({
    message: 'API Backend en ECS Fargate operativa',
    endpoints: {
      health: 'GET /health',
      getItems: 'GET /api/items',
      createItem: 'POST /api/items'
    }
  });
});

// ---------------------------------------------------------------------------
// Endpoint 1: GET /api/items
// Consulta y retorna los registros almacenados en Amazon RDS / DB
// ---------------------------------------------------------------------------
app.get('/api/items', async (req, res) => {
  try {
    const query = 'SELECT id, nombre, descripcion, precio, fecha_creacion FROM items ORDER BY id DESC;';
    const { rows } = await pool.query(query);
    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('[GET /api/items] Error al consultar registros:', error);
    res.status(500).json({
      success: false,
      message: 'Error al consultar registros de la base de datos',
      error: error.message
    });
  }
});

// ---------------------------------------------------------------------------
// Endpoint 2: POST /api/items
// Inserta un nuevo registro en Amazon RDS / DB
// ---------------------------------------------------------------------------
app.post('/api/items', async (req, res) => {
  const { nombre, descripcion, precio } = req.body;

  // Validación básica de campos de negocio
  if (!nombre || precio === undefined || precio === null) {
    return res.status(400).json({
      success: false,
      message: 'Campos obligatorios faltantes: nombre y precio son requeridos.'
    });
  }

  const numericPrecio = parseFloat(precio);
  if (isNaN(numericPrecio) || numericPrecio < 0) {
    return res.status(400).json({
      success: false,
      message: 'El campo "precio" debe ser un número válido mayor o igual a 0.'
    });
  }

  try {
    const insertQuery = `
      INSERT INTO items (nombre, descripcion, precio)
      VALUES ($1, $2, $3)
      RETURNING id, nombre, descripcion, precio, fecha_creacion;
    `;
    const values = [nombre.trim(), descripcion ? descripcion.trim() : null, numericPrecio];
    const { rows } = await pool.query(insertQuery, values);

    console.log(`[POST /api/items] Nuevo registro creado exitosamente con ID ${rows[0].id}: ${rows[0].nombre}`);

    res.status(201).json({
      success: true,
      message: 'Registro insertado exitosamente en Amazon RDS',
      data: rows[0]
    });
  } catch (error) {
    console.error('[POST /api/items] Error al insertar registro:', error);
    res.status(500).json({
      success: false,
      message: 'Error al insertar registro en la base de datos',
      error: error.message
    });
  }
});

// Iniciar servidor HTTP
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(` Backend API REST en ejecución en http://0.0.0.0:${PORT}`);
  console.log(` Modo: ${process.env.NODE_ENV || 'development'}`);
  console.log(`=======================================================`);
});
