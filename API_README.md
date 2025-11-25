# WordPress Parser API

REST API сервер для асинхронного парсинга WordPress событий.

## Быстрый старт

### 1. Запуск API сервера

```bash
# Development mode (with hot reload)
npm run api:dev

# Production mode
npm run api

# Build and run
npm run api:build
```

Сервер запустится на `http://localhost:3000`

### 2. API Key

API key находится в файле `.env`:
```
API_KEY=41eeaa4f-0e2d-4f8a-b489-9b314704c95d
```

Передавайте ключ в header `X-API-Key` или в query параметре `?apiKey=`.

## Endpoints

### Health Check (без авторизации)
```bash
curl http://localhost:3000/api/health
```

### Swagger Documentation (без авторизации)
Откройте в браузере: http://localhost:3000/api-docs

---

## Parse Jobs

### 1. Создать задачу парсинга
```bash
POST /api/parse
```

**Request:**
```bash
curl -X POST 'http://localhost:3000/api/parse' \
  -H 'X-API-Key: 41eeaa4f-0e2d-4f8a-b489-9b314704c95d' \
  -H 'Content-Type: application/json' \
  -d '{
    "headless": true,
    "closeAfter": true
  }'
```

**Response (202 Accepted):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "message": "Parse job queued successfully",
  "createdAt": "2025-11-25T12:00:00.000Z",
  "statusUrl": "/api/parse/550e8400-e29b-41d4-a716-446655440000"
}
```

### 2. Проверить статус задачи
```bash
GET /api/parse/{jobId}
```

**Request:**
```bash
curl 'http://localhost:3000/api/parse/550e8400-e29b-41d4-a716-446655440000' \
  -H 'X-API-Key: 41eeaa4f-0e2d-4f8a-b489-9b314704c95d'
```

**Response (completed):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "createdAt": "2025-11-25T12:00:00.000Z",
  "startedAt": "2025-11-25T12:00:05.000Z",
  "completedAt": "2025-11-25T12:01:30.000Z",
  "result": {
    "outputFile": "events_1764067369234.json",
    "eventCount": 15,
    "screenshotPath": "events_screenshot.png"
  }
}
```

**Job статусы:**
- `pending` - в очереди
- `running` - выполняется
- `completed` - успешно завершен
- `failed` - ошибка (содержит поле `error`)

---

## Events

### 1. Получить последние события
```bash
GET /api/events
```

**Request:**
```bash
curl 'http://localhost:3000/api/events' \
  -H 'X-API-Key: 41eeaa4f-0e2d-4f8a-b489-9b314704c95d'
```

**Response:**
```json
{
  "source": "events_1764067369234.json",
  "parsedAt": "2025-11-25T12:42:49.234Z",
  "eventCount": 15,
  "events": [
    {
      "active": true,
      "eventId": "147846",
      "ticketsSold": {
        "total": 3,
        "capacity": 220
      }
    }
  ]
}
```

### 2. Получить события из конкретного файла
```bash
GET /api/events?file={filename}
```

**Request:**
```bash
curl 'http://localhost:3000/api/events?file=events_1764067369234.json' \
  -H 'X-API-Key: 41eeaa4f-0e2d-4f8a-b489-9b314704c95d'
```

### 3. Список всех файлов
```bash
GET /api/events/files
```

**Request:**
```bash
curl 'http://localhost:3000/api/events/files' \
  -H 'X-API-Key: 41eeaa4f-0e2d-4f8a-b489-9b314704c95d'
```

**Response:**
```json
{
  "files": [
    {
      "filename": "events_1764067369234.json",
      "timestamp": 1764067369234,
      "parsedAt": "2025-11-25T12:42:49.234Z",
      "size": 1603
    }
  ],
  "totalFiles": 3
}
```

---

## Errors

### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```

### 404 Not Found
```json
{
  "error": "Job not found",
  "message": "No job exists with ID: ..."
}
```

### 503 Service Unavailable
```json
{
  "error": "Service unavailable",
  "message": "Too many jobs in queue. Please try again later.",
  "queueSize": 5
}
```

---

## Конфигурация (.env)

```env
# API Configuration
API_KEY=41eeaa4f-0e2d-4f8a-b489-9b314704c95d
API_PORT=3000
API_HOST=0.0.0.0
NODE_ENV=development

# Job Queue Configuration
MAX_QUEUE_SIZE=5
JOB_TIMEOUT_MS=300000
JOB_CLEANUP_INTERVAL_MS=3600000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=10
```

---

## Архитектура

### Структура проекта
```
src/
├── core/                    # Логика парсинга
│   ├── scraper.ts
│   ├── types.ts
│   └── utils.ts
├── api/                     # API слой
│   ├── server.ts           # Express сервер
│   ├── routes/             # Маршруты
│   ├── controllers/        # HTTP обработчики
│   ├── services/           # Бизнес-логика
│   ├── middleware/         # Auth, logger, error
│   ├── types/              # TypeScript типы
│   └── config/             # Swagger конфиг
```

### Job Queue
- **In-memory** очередь с Map хранилищем
- **Single worker** модель (один job одновременно)
- Автоматическая очистка старых jobs (24 часа)
- Timeout: 5 минут на job (настраивается)

### Middleware Stack
1. Helmet (security headers)
2. CORS
3. Compression
4. Body parsing
5. Winston logger
6. Rate limiter (10 req/min)
7. Routes + Auth
8. Error handler

---

## Тестирование

### Примеры команд

```bash
# Health check
curl http://localhost:3000/api/health

# Создать job
curl -X POST 'http://localhost:3000/api/parse' \
  -H 'X-API-Key: YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"headless": true}'

# Проверить статус
curl 'http://localhost:3000/api/parse/JOB_ID' \
  -H 'X-API-Key: YOUR_API_KEY'

# Получить события
curl 'http://localhost:3000/api/events' \
  -H 'X-API-Key: YOUR_API_KEY'
```

---

## Логирование

Логи сохраняются в:
- `logs/combined.log` - все логи
- `logs/error.log` - только ошибки
- Console - цветной вывод в dev mode

---

## CLI vs API

### CLI (старый способ)
```bash
npm run events
```

### API (новый способ)
```bash
# Запустить сервер
npm run api:dev

# Создать job через API
curl -X POST 'http://localhost:3000/api/parse' ...
```

Оба способа используют одну и ту же core логику парсинга.
