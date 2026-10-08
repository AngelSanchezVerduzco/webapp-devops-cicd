# WebApp DevOps — Pipeline CI/CD

API REST (Node.js + Express + SQLite) con pruebas automatizadas (Jest), contenedorización (Docker) y despliegue continuo en AWS EC2 mediante **GitHub Actions**.

## Arquitectura

```text
Developer (git push)
        |
        v
GitHub Actions (CI/CD)
  1) npm test + coverage (>= 70%)
  2) docker build + push -> Docker Hub
  3) SSH a EC2 -> docker pull/run
        |
        v
AWS EC2 (Ubuntu + Docker)
  Contenedor: webapp-container
  HTTP: puerto 80
  Socket TCP: puerto 6061
```

## Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Health / listado de endpoints |
| GET | `/api/health` | Health (ruta /api) |
| GET | `/categories` | Listar categorías |
| POST | `/categories` | Crear categoría |
| PUT | `/categories/:id` | Actualizar categoría |
| DELETE | `/categories/:id` | Eliminar categoría |
| GET | `/products` | Listar productos |
| GET | `/products/:id` | Producto por id |
| POST | `/products` | Crear producto |
| PUT | `/products/:id` | Actualizar producto |
| DELETE | `/products/:id` | Eliminar producto |
| POST | `/db/backup` | Backup SQLite |
| DELETE | `/db/reset` | Vaciar BD |

Formato de respuesta:

```json
{ "statusCode": 200, "data": [] }
```

## Comandos locales

```bash
# Instalar
npm install

# Pruebas + cobertura (umbral 70%)
npm test

# API local (sin Docker)
set PORT=3000
npm start
# http://localhost:3000/api/health

# Docker local
docker build -t webapp:latest .
docker run -d -p 8080:80 -p 6061:6061 --name webapp-container webapp:latest
# http://localhost:8080/api/health
```

## GitHub Secrets (obligatorios)

En el repositorio: **Settings → Secrets and variables → Actions**

| Secret | Descripción |
|--------|-------------|
| `DOCKERHUB_USERNAME` | Usuario de Docker Hub (ej. `ansave17`) |
| `DOCKERHUB_TOKEN` | Access Token de Docker Hub (no la contraseña) |
| `EC2_HOST` | IP pública de la instancia EC2 |
| `EC2_USERNAME` | Usuario SSH (normalmente `ubuntu`) |
| `EC2_SSH_KEY` | Contenido completo del archivo `.pem` |

> **Nunca** subas contraseñas, IPs, tokens o claves `.pem` al código.

### Cómo crear el token de Docker Hub

1. Docker Hub → Account Settings → Security → New Access Token  
2. Copia el token y guárdalo en `DOCKERHUB_TOKEN`

### Cómo pegar la clave SSH

Abre tu `.pem` en un editor, copia **todo** (incluyendo `BEGIN/END PRIVATE KEY`) y pégalo en `EC2_SSH_KEY`.

## Configuración de EC2

1. Ubuntu Server con Docker instalado  
2. Security Group:
   - TCP **22** (SSH)
   - TCP **80** (HTTP API)
   - TCP **6061** (socket, opcional)
3. La clave pública asociada al `.pem` debe estar en `~/.ssh/authorized_keys` del usuario `ubuntu`

## Pipeline (GitHub Actions)

Archivo: `.github/workflows/main.yml`

Al hacer `push` a `main`:

1. **CI** — instala dependencias, corre Jest y valida cobertura ≥ 70%  
2. **Build** — construye imagen y la publica en Docker Hub como:
   - `USER/webapp:latest`
   - `USER/webapp:<commit-sha>`
3. **CD** — por SSH en EC2:
   - `docker pull`
   - detiene contenedor anterior
   - levanta nueva versión en puerto **80**

## URL pública (después del deploy)

```text
http://<IP_EC2>/api/health
http://<IP_EC2>/products
```

## Demostración en vivo

1. Cambia un mensaje en `app.js` (por ejemplo en `/api/health`)  
2. `git add . && git commit -m "demo: actualiza mensaje health" && git push`  
3. En GitHub → Actions observa tests → push Docker → deploy EC2  
4. Recarga `http://<IP_EC2>/api/health` y verifica el cambio

## Estructura del proyecto

```text
webapp-devops/
├── .github/workflows/main.yml
├── tests/http.endpoints.test.js
├── app.js
├── server.js
├── db.js
├── socket.js
├── Dockerfile
├── .dockerignore
├── package.json
└── README.md
```
