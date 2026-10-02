# Laboratorio Práctico: Arquitectura en AWS
## Universidad Tecnológica de Panamá · FISC · Ingeniería de Software
**Asignatura:** Tópicos Especiales 1 | **Facilitador:** José Grimaldo | **Grupo:** 1SF241 | **II Semestre 2026**

---

### 👥 Integrantes del Equipo
* **Diego Gordón** — `8-1017-349`
* **Manuel Campos** — `8-1022-1118`
* **Fernando Jimenez** — `20-24-7669`
* **Bryan Law** — `8-104-2459`
* **Alexis Miranda** — `9-765-1202`

---

## 1. Diagrama de Arquitectura de la Solución

![Diagrama de Arquitectura AWS](diagram_page2.png)

### Flujo de Tráfico Numerado:
1. **Acceso de Usuarios:** El usuario envía peticiones HTTP (Puerto 80) a la IP Pública del Frontend (`18.227.81.116`) a través de Internet.
2. **Recepción en Internet Gateway:** El `igw-laboratorio` enruta la solicitud hacia el contenedor Frontend ubicado en la subred pública (`10.0.1.0/24`).
3. **Servidor Web y Reverse Proxy:** Nginx sirve la interfaz web (HTML5/CSS3/JS) y actúa como Reverse Proxy interceptando las llamadas `/api/*`.
4. **Enrutamiento Interno (Sin ALB):** El tráfico API se enruta internamente hacia el backend vía ECS Service Connect (`backend:3000`) sin necesidad de un balanceador ALB.
5. **Procesamiento de Negocio:** El contenedor Backend (Node.js Express) en la subred privada procesa las solicitudes `GET /api/items` y `POST /api/items`.
6. **Conexión a Base de Datos:** El backend consulta PostgreSQL conectándose al puerto TCP 5432 en las subredes privadas de datos.
7. **Persistencia Gestionada en RDS:** Amazon RDS persiste los datos en almacenamiento EBS gestionado y cuenta con DB Subnet Group multi-AZ para resiliencia.
8. **Egress y Monitoreo:** La subred privada sale a Internet por NAT Gateway para descargar de ECR; CloudWatch centraliza los logs (`/ecs/laboratorio-*`).

### Convenciones de Red:
* **Tráfico externo:** Flecha continua naranja (HTTP 80).
* **Tráfico interno:** Flecha continua azul (Service Connect TCP 3000).
* **Consultas SQL:** Flecha continua morada (PostgreSQL TCP 5432).
* **Salida a Internet (Egress):** Flecha discontinua violeta (NAT Gateway).
* **Grupos de Seguridad (SG):** `frontend-sg`, `backend-sg`, `rds-sg`.
* **Subred Pública:** `10.0.1.0/24` en `us-east-2a`.
* **Subredes Privadas:** `10.0.2.0/24` (App), `10.0.3.0/24` y `10.0.4.0/24` (RDS Multi-AZ).

---

## 2. Explicación de la Arquitectura Propuesta

La arquitectura desarrollada para la aplicación de tres capas se encuentra desplegada sobre Amazon Web Services (AWS) en la región de Ohio (`us-east-2`), utilizando una Virtual Private Cloud (VPC) con direccionamiento `10.0.0.0/16` distribuida en subredes públicas y privadas con el objetivo de garantizar aislamiento de red, seguridad perimetral y alta disponibilidad. El flujo comienza cuando los usuarios acceden a la aplicación web a través de Internet mediante el protocolo HTTP en el puerto estándar 80. Las solicitudes son recibidas e introducidas a la red interna de la nube por medio de un Internet Gateway (`igw-laboratorio`), el cual proporciona el punto de enlace bidireccional entre la VPC y la red pública de Internet.

En estricto cumplimiento con las restricciones técnicas del laboratorio, la arquitectura prescinde totalmente del uso de un Application Load Balancer (ALB). Para resolver el enrutamiento y la distribución de solicitudes sin dicho balanceador, la capa de presentación fue implementada utilizando un contenedor ligero basado en Nginx Alpine sobre AWS Fargate, ubicado estratégicamente en una subred pública (`10.0.1.0/24`) con una dirección IP pública estática asignada (`18.227.81.116`). Nginx desempeña una doble función arquitectónica crítica: por un lado, sirve los recursos estáticos de la interfaz web (HTML5, estilos CSS3 modernos con diseño oscuro y scripts de JavaScript asíncrono para manipulación dinámica del DOM); y por otro lado, opera como un Reverse Proxy de capa 7 de alto rendimiento, interceptando de forma transparente todas las solicitudes dirigidas al prefijo de ruta `/api/*` y reexpidiéndolas directamente hacia el backend.

Una vez interceptada la petición API, el tráfico es reenviado de manera directa y privada hacia la capa de aplicación, la cual reside en una subred privada (`10.0.2.0/24`) y carece de dirección IP pública, impidiendo cualquier intento de acceso directo no autorizado desde el exterior. La resolución de nombres y la comunicación directa de servicio a servicio se articulan mediante el mecanismo nativo de AWS Cloud Map y ECS Service Connect bajo el espacio de nombres privado `laboratorio.local`. De este modo, el contenedor frontend se comunica internamente con el backend mediante el nombre de descubrimiento `backend:3000`. Este servicio ejecuta una API REST desarrollada en Node.js con el framework Express, encargada de la lógica de negocio, validación de parámetros y procesamiento de los endpoints `GET /api/items` (consulta de catálogo) y `POST /api/items` (creación de nuevos productos).

Para la capa de persistencia y almacenamiento relacional, el backend interactúa con una instancia de Amazon RDS con motor PostgreSQL versión 18.3 (`db.t3.micro`), emplazada en subredes privadas de datos (`10.0.3.0/24` y `10.0.4.0/24`). La base de datos está asociada a un DB Subnet Group (`dbsng-laboratorio`) que abarca dos Zonas de Disponibilidad (`us-east-2a` y `us-east-2b`), preparando la infraestructura para alta disponibilidad y resiliencia ante contingencias físicas mediante redundancia Multi-AZ. La instancia aloja la base de datos `appdb` y la tabla `items`, cuyo esquema incorpora un identificador autoincremental (`id SERIAL PRIMARY KEY`), campos de negocio (`nombre`, `descripcion`, `precio`) y una columna de auditoría (`fecha_creacion TIMESTAMP DEFAULT NOW()`). Este modelo relacional desacoplado garantiza la persistencia definitiva de los datos en volúmenes EBS administrados por AWS, asegurando que la información permanezca inmutable e íntegra independientemente del ciclo de vida efímero de los contenedores Fargate.

Debido a que las tareas de AWS Fargate en la subred privada no disponen de direcciones IP públicas para interactuar con servicios externos, se desplegó un NAT Gateway (`nat-laboratorio`) en la subred pública asociado a una Elastic IP dedicada (`16.58.232.26`), enrutando el tráfico de egreso (`0.0.0.0/0`) mediante tablas de ruteo personalizadas. Esto permite a las tareas privadas descargar de forma segura las imágenes de contenedor alojadas en los repositorios privados de Amazon ECR (`laboratorio-backend` y `laboratorio-frontend`) e instalar dependencias necesarias. Asimismo, se configuró el controlador de registros nativo de AWS (`awslogs`) para canalizar en tiempo real todas las salidas estándar y de error de los contenedores hacia grupos de registros unificados en Amazon CloudWatch (`/ecs/laboratorio-*`), posibilitando la auditoría operativa, métricas de rendimiento y trazabilidad de eventos.

La seguridad integral de la solución se encuentra gobernada por el principio de mínimo privilegio implementado a través de Security Groups: `frontend-sg` únicamente permite tráfico entrante en el puerto 80 desde cualquier origen (`0.0.0.0/0`); `backend-sg` restringe estrictamente el tráfico entrante en el puerto 3000 admitiendo de forma exclusiva conexiones originadas desde el identificador de `frontend-sg`; y `rds-sg` restringe el puerto 5432 permitiendo únicamente conexiones provenientes de `backend-sg`. Las credenciales de acceso a la base de datos no se encuentran incrustadas en el código fuente, sino que se inyectan de forma dinámica en tiempo de ejecución como variables de entorno seguras. En conjunto, esta arquitectura desacoplada en contenedores sobre AWS Fargate y RDS proporciona una solución moderna, altamente escalable, costo-eficiente y con tolerancia a fallos que satisface con creces todos los lineamientos y objetivos pedagógicos del laboratorio.
