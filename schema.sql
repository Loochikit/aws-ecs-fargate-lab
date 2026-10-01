-- ==============================================================================
-- Laboratorio AWS: ECS Fargate + ECR + RDS
-- Archivo: schema.sql
-- Motor: PostgreSQL (compatible con RDS PostgreSQL 14/15/16)
-- ==============================================================================

-- 1. Crear tabla requerida: Llave primaria (id) + al menos 3 campos de negocio
CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    precio NUMERIC(10, 2) NOT NULL,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Registros iniciales de prueba (Seed Data)
INSERT INTO items (nombre, descripcion, precio) VALUES
    ('Servidor Cloud ECS', 'Contenedor gestionado con Fargate en subred privada', 45.50),
    ('Base de Datos RDS', 'Instancia relacional PostgreSQL en subred privada de datos', 120.00),
    ('Frontend Nginx', 'Contenedor en subred pública sirviendo UI y proxy inverso', 15.00)
ON CONFLICT DO NOTHING;

-- 3. Verificación de registros
SELECT * FROM items;
