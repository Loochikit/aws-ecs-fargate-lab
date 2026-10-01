# Laboratorio AWS: Arquitectura de Tres Capas en Contenedores
## Docker → Amazon ECR → Amazon ECS con AWS Fargate → Amazon RDS (PostgreSQL)

Solución técnica completa e implementación de referencia para el laboratorio de arquitectura en la nube de AWS.

---

## 1. Arquitectura de la Solución (Desplegada en Ohio `us-east-2`)

```
                                  AWS Cloud (Ohio - us-east-2)
                                       VPC: 10.0.0.0/16
          ┌────────────────────────────────────────────────────────────────────────┐
          │                                                                        │
          │   [Subred Pública: 10.0.1.0/24 (us-east-2a)]                           │
          │   ┌──────────────────────────────────────────────────────────────┐     │
          │   │  Frontend Web (ECS Fargate)                                  │     │
[Internet]│──>│  - Nginx Alpine (Puerto 80)                                  │     │
 (Cliente)│   │  - IP Pública: 18.227.81.116:80                              │     │
          │   │  - Servidor Web (HTML/CSS/JS) + Reverse Proxy interno        │     │
          │   └──────────────────────────────┬───────────────────────────────┘     │
          │                                  │ (Tráfico interno Service Connect)   │
          │                                  ▼                                     │
          │   [Subred Privada App: 10.0.2.0/24 (us-east-2a)]                       │
          │   ┌──────────────────────────────────────────────────────────────┐     │
          │   │  Backend REST API (ECS Fargate)                              │     │
          │   │  - Node.js / Express (Puerto 3000)                           │     │
          │   │  - Endpoints: GET /api/items | POST /api/items               │     │
          │   │  - Sin IP Pública (Totalmente Aislado)                       │     │
          │   └──────────────────────────────┬───────────────────────────────┘     │
          │                                  │ (Puerto 5432 - sg-rds)              │
          │                                  ▼                                     │
          │   [Subredes Privadas de Datos: 10.0.3.0/24 y 10.0.4.0/24]              │
          │   ┌──────────────────────────────────────────────────────────────┐     │
          │   │  Amazon RDS (PostgreSQL 18.3 - Free Tier)                    │     │
          │   │  - Instancia: db.t3.micro (db-laboratorio)                   │     │
          │   │  - Base de Datos: appdb | Usuario: appuser                   │     │
          │   │  - Persistencia de datos gestionada                          │     │
          │   └──────────────────────────────────────────────────────────────┘     │
          └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. ¿Para qué sirve el archivo HTML (`index.html`)?

El archivo `index.html` es la **Capa de Presentación (Frontend)** de la arquitectura:
1. **Interfaz Gráfica de Usuario:** Sin el HTML, la aplicación solo sería un backend invisible que responde texto plano o código JSON en la consola. El HTML proporciona la interfaz visual que el usuario abre en su navegador (`http://18.227.81.116`).
2. **Formulario de Negocio (INSERT):** Permite al usuario ingresar los campos requeridos (`nombre`, `descripcion`, `precio`) y enviarlos mediante un botón interactivo a la base de datos sin tener que escribir comandos SQL manuales.
3. **Tabla de Visualización (SELECT):** Consulta automáticamente los registros existentes en Amazon RDS y los pinta en una tabla estilizada con formato de moneda y fecha local.
4. **Desacoplamiento arquitectónico:** El HTML es servido por un contenedor ligero **Nginx**, el cual actúa simultáneamente como servidor de archivos estáticos y como **Reverse Proxy**, reenviando las llamadas `/api/*` al contenedor privado del Backend sin necesidad de un balanceador ALB.

---

## 3. Resumen de Recursos Desplegados en AWS

* **Región:** `us-east-2` (EE. UU. Este - Ohio)
* **VPC ID:** `vpc-016761ebd9408a416` (`10.0.0.0/16`)
* **Subred Pública:** `subnet-0385f376c2a651e7b` (`10.0.1.0/24` en `us-east-2a`)
* **Subred Privada App:** `subnet-0e61d9488a4a84bdc` (`10.0.2.0/24` en `us-east-2a`)
* **Subredes Datos RDS:** 
  * `subnet-004bc6d3d4bc29696` (`10.0.3.0/24` en `us-east-2a`)
  * `subnet-0462b854c1d408748` (`10.0.4.0/24` en `us-east-2b`)
* **Internet Gateway:** `igw-0540478f502ad97cf`
* **NAT Gateway:** `nat-0bbf706796a5df419` (IP Elástica: `16.58.232.26`)
* **Security Groups:**
  * `frontend-sg` (`sg-0de85ed0ac1183315`): Inbound 80 desde `0.0.0.0/0`.
  * `backend-sg` (`sg-09388bf44dadfaf67`): Inbound 3000 solo desde `frontend-sg`.
  * `rds-sg` (`sg-04b98906b7c4e8245`): Inbound 5432 solo desde `backend-sg`.
* **Amazon ECR:**
  * Backend: `985882743176.dkr.ecr.us-east-2.amazonaws.com/laboratorio-backend:latest`
  * Frontend: `985882743176.dkr.ecr.us-east-2.amazonaws.com/laboratorio-frontend:latest`
* **Amazon RDS:**
  * Identificador: `db-laboratorio`
  * Endpoint: `db-laboratorio.clka2qwsw3i8.us-east-2.rds.amazonaws.com`
  * Motor: PostgreSQL 18.3 en `db.t3.micro`
  * Base de datos: `appdb`
* **Amazon ECS Fargate:**
  * Cluster: `cluster-laboratorio`
  * Servicio Backend: `svc-backend` (en subred privada, Service Connect: `backend`)
  * Servicio Frontend: `svc-frontend` (en subred pública, IP Pública: `18.227.81.116`)

---

## 4. Estructura del Repositorio

```
aws-ecs-fargate-lab/
│
├── backend/
│   ├── package.json           # Dependencias: express, pg, cors, dotenv
│   ├── server.js              # Servidor API REST con conexión dinámica a RDS
│   ├── Dockerfile             # Imagen Node.js 20 Alpine
│   └── .dockerignore          # Filtros para compilación Docker
│
├── frontend/
│   ├── index.html             # Interfaz web con formulario y tabla de registros
│   ├── styles.css             # Estilos modernos (Dark Mode, Glassmorphism)
│   ├── app.js                 # Lógica cliente para peticiones GET y POST /api/items
│   ├── default.conf.template  # Configuración Nginx con Reverse Proxy a Backend
│   ├── Dockerfile             # Imagen Nginx Alpine con inyección de variables
│   └── .dockerignore          # Filtros de Docker
│
├── schema.sql                 # Definición SQL de la tabla 'items' y seed data
├── docker-compose.yml         # Entorno local para pruebas antes del despliegue
├── test-api.ps1               # Script PowerShell para pruebas automatizadas
├── .gitignore                 # Exclusiones de Git (seguridad y credenciales)
└── README.md                  # Documentación completa del proyecto
```

---

## 5. Pruebas Locales con Docker Compose

Para ejecutar y probar todo el stack localmente en cualquier otra computadora con Docker:

```bash
# 1. Clonar el repositorio y entrar a la carpeta
git clone <URL_DE_TU_REPOSITORIO>
cd aws-ecs-fargate-lab

# 2. Levantar los tres contenedores (PostgreSQL + Backend + Frontend)
docker compose up --build -d

# 3. Acceder en el navegador
http://localhost:8085

# 4. Probar los endpoints automáticamente
powershell -ExecutionPolicy Bypass -File .\test-api.ps1

# 5. Detener el entorno local
docker compose down
```

---

## 6. Comandos para Compilar y Subir a Amazon ECR

```bash
# Autenticación con ECR
aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 985882743176.dkr.ecr.us-east-2.amazonaws.com

# Backend
docker build -t laboratorio-backend ./backend
docker tag laboratorio-backend:latest 985882743176.dkr.ecr.us-east-2.amazonaws.com/laboratorio-backend:latest
docker push 985882743176.dkr.ecr.us-east-2.amazonaws.com/laboratorio-backend:latest

# Frontend
docker build -t laboratorio-frontend ./frontend
docker tag laboratorio-frontend:latest 985882743176.dkr.ecr.us-east-2.amazonaws.com/laboratorio-frontend:latest
docker push 985882743176.dkr.ecr.us-east-2.amazonaws.com/laboratorio-frontend:latest
```

---

## 7. Eliminación de Recursos (Teardown)

Para evitar cobros al terminar la evaluación:

1. **ECS:** Reducir tareas a 0 en `svc-frontend` y `svc-backend`, luego eliminar ambos servicios y el cluster `cluster-laboratorio`.
2. **NAT Gateway:** Eliminar `nat-0bbf706796a5df419` y liberar la IP Elástica `eipalloc-0388d60c09cba306b`.
3. **RDS:** Eliminar la base de datos `db-laboratorio` (sin crear snapshot final) y eliminar el Subnet Group `dbsng-laboratorio`.
4. **VPC:** Eliminar los Security Groups, el Internet Gateway `igw-0540478f502ad97cf` y la VPC `vpc-016761ebd9408a416`.
