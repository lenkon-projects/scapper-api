# Zygo API Documentation

## Обзор

Zygo (zygo.co.il) - платформа для продажи билетов на мероприятия в Израиле, построенная на Next.js.

## Базовые URL

- **Frontend**: `https://zygo.co.il`
- **API**: `https://api.zygo.co.il`
- **API Version**: `v1`
- **Build ID**: `lBnRwoPs8rdfPY1DnvUyd`

## Найденные работающие эндпоинты

✅ **GET** `https://api.zygo.co.il/health` - Health check (возвращает "OK")
✅ **GET** `https://api.zygo.co.il/v1/event` - Список всех событий (публичный)
✅ **GET** `https://api.zygo.co.il/v1/user/profile` - Профиль пользователя (требует auth + userId)
✅ **GET** `https://api.zygo.co.il/v1/user/tickets` - Билеты пользователя (требует auth)
✅ **GET** `https://api.zygo.co.il/v1/user/orders` - Заказы пользователя (требует auth)
✅ **POST** `https://api.zygo.co.il/v1/auth/login` - Авторизация (требует phone/email)

## Аутентификация

### Cookie-based Authentication

Система использует JWT токены, сохраняемые в cookies:

```
zygo_access_token=<JWT_TOKEN>
zygo_refresh_token=<JWT_TOKEN>
zygo_access_token_expires=<ISO_DATE>
zygo_refresh_token_expires=<ISO_DATE>
```

### JWT Structure

Access token пример (decoded):
```json
{
  "sub": "6900b4c35723426868<...>",
  "iat": 1765451327,
  "exp": 1765458527,
  "type": "access"
}
```

## API Endpoints

### 1. Events (События)

#### GET /api/events
Получить список всех событий

**Параметры:**
- `page` - номер страницы
- `limit` - количество на странице
- `category` - фильтр по категории
- `date` - фильтр по дате
- `location` - фильтр по местоположению

**Ответ:**
```json
{
  "events": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "date": "ISO8601",
      "venue": {...},
      "tickets": [...],
      "images": [...]
    }
  ],
  "total": number,
  "page": number
}
```

#### GET /api/events/:id
Получить детали конкретного события

**Ответ:**
```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "short_description": "string",
  "door_open_time": "ISO8601",
  "date": "ISO8601",
  "venue": {
    "id": "string",
    "name": "string",
    "address": "string"
  },
  "tickets": [
    {
      "id": "string",
      "name": "string",
      "price": number,
      "currency": "ILS",
      "available": number,
      "max_per_order": number
    }
  ],
  "producer": {
    "name": "string",
    "email": "string",
    "phone": "string"
  },
  "images": ["url1", "url2"],
  "tags": ["tag1", "tag2"],
  "age_restriction": number
}
```

#### POST /api/events
Создать новое событие (требует авторизации организатора)

### 2. Authentication (Аутентификация)

#### POST /api/auth/login
Вход в систему

**Body:**
```json
{
  "phone": "string",
  "email": "string", // опционально
  "password": "string" // опционально, если используется OTP
}
```

#### POST /api/auth/send-code
Отправить код верификации

**Body:**
```json
{
  "phone": "string"
}
```

**Ответ:**
```json
{
  "message": "קוד אימות בעל 6 ספרות נשלח לך לטלפון",
  "sent": true
}
```

#### POST /api/auth/verify-phone
Верифицировать телефон кодом

**Body:**
```json
{
  "phone": "string",
  "code": "string" // 6-значный код
}
```

#### POST /api/auth/register
Регистрация нового пользователя

**Body:**
```json
{
  "phone": "string",
  "email": "string",
  "full_name": "string",
  "birthday": "ISO8601",
  "gender": "male" | "female" | "other",
  "newsletter": boolean
}
```

#### POST /api/auth/refresh
Обновить access token

**Body:**
```json
{
  "refresh_token": "string"
}
```

### 3. Tickets (Билеты)

#### POST /api/tickets/purchase
Купить билеты

**Body:**
```json
{
  "event_id": "string",
  "tickets": [
    {
      "ticket_id": "string",
      "quantity": number,
      "participants": [
        {
          "full_name": "string",
          "phone": "string",
          "email": "string",
          "id_number": "string",
          "birthday": "ISO8601"
        }
      ]
    }
  ],
  "promo_code": "string", // опционально
  "payment_method": "credit_card" | "apple_pay" | "google_pay" | "bit"
}
```

#### GET /api/tickets
Получить билеты пользователя (требует авторизации)

**Ответ:**
```json
{
  "tickets": [
    {
      "id": "string",
      "order_id": "string",
      "event": {...},
      "status": "pending" | "approved" | "scanned" | "canceled",
      "barcode": "string",
      "qr_code_url": "string",
      "purchase_date": "ISO8601"
    }
  ]
}
```

### 4. Orders (Заказы)

#### POST /api/orders/create
Создать заказ

**Body:**
```json
{
  "event_id": "string",
  "tickets": [...],
  "total_amount": number,
  "promo_code": "string"
}
```

**Ответ:**
```json
{
  "order_id": "string",
  "status": "pending" | "waiting_for_approval" | "approved",
  "total_amount": number,
  "payment_url": "string"
}
```

#### GET /api/orders/:id
Получить статус заказа

#### POST /api/orders/:id/pay
Оплатить заказ

**Body:**
```json
{
  "payment_method": "credit_card",
  "card_number": "string",
  "cvv": "string",
  "expiry": "MM/YY",
  "holder_name": "string"
}
```

### 5. Organizer Panel (Панель организатора)

#### GET /api/organizer/events
Получить события организатора (требует авторизации)

#### GET /api/organizer/analytics
Аналитика для организатора

**Параметры:**
- `event_id` - ID события
- `date_from` - дата начала
- `date_to` - дата окончания

**Ответ:**
```json
{
  "total_sales": number,
  "tickets_sold": number,
  "tickets_scanned": number,
  "revenue": number,
  "orders": [...]
}
```

#### GET /api/organizer/orders
Заказы для организатора

**Фильтры:**
- `status` - статус заказа
- `event_id` - ID события

#### POST /api/organizer/tickets/validate
Валидировать/отсканировать билет

**Body:**
```json
{
  "barcode": "string",
  "event_id": "string"
}
```

### 6. Venues (Места проведения)

#### GET /api/venues
Список всех мест

**Ответ:**
```json
{
  "venues": [
    {
      "id": "string",
      "name": "string",
      "address": "string",
      "description": "string",
      "images": [...],
      "upcoming_events": [...]
    }
  ]
}
```

#### GET /api/venues/:id/events
События в конкретном месте

### 7. Search (Поиск)

#### GET /api/search
Поиск событий

**Параметры:**
- `q` - поисковый запрос
- `category` - категория
- `date` - дата
- `location` - местоположение
- `tags` - теги

#### GET /api/search/autocomplete
Автодополнение для поиска

**Параметры:**
- `q` - частичный запрос

### 8. Promo Codes (Промокоды)

#### POST /api/promo-codes/validate
Валидировать промокод

**Body:**
```json
{
  "code": "string",
  "event_id": "string"
}
```

**Ответ:**
```json
{
  "valid": boolean,
  "discount_type": "percentage" | "fixed",
  "discount_value": number,
  "message": "string"
}
```

## Next.js Data Endpoints

Next.js предоставляет специальные эндпоинты для получения данных страниц:

```
GET /_next/data/{buildId}/{locale}/{page}.json
```

Примеры:
- `/_next/data/lBnRwoPs8rdfPY1DnvUyd/en/index.json`
- `/_next/data/lBnRwoPs8rdfPY1DnvUyd/he/organizer-panel-events.json`
- `/_next/data/lBnRwoPs8rdfPY1DnvUyd/en/event/[id].json`

## Типичные заголовки запросов

```
accept: application/json
content-type: application/json
cookie: zygo_access_token=...; zygo_refresh_token=...
authorization: Bearer <access_token>
accept-language: ru-RU,ru;q=0.9,he-IL;q=0.8,he;q=0.7
user-agent: Mozilla/5.0 (...)
```

## Коды ответов

- `200` - Успешно
- `201` - Создано
- `400` - Неверный запрос
- `401` - Не авторизован
- `403` - Доступ запрещен
- `404` - Не найдено
- `500` - Ошибка сервера

## Типы данных

### Event
```typescript
interface Event {
  id: string;
  title: string;
  description: string;
  short_description?: string;
  date: string; // ISO8601
  door_open_time?: string;
  venue: Venue;
  tickets: Ticket[];
  images: string[];
  tags: string[];
  category: string;
  age_restriction?: number;
  producer: Producer;
  status: 'draft' | 'published' | 'cancelled';
}
```

### Ticket
```typescript
interface Ticket {
  id: string;
  name: string;
  price: number;
  currency: string;
  available: number;
  max_per_order: number;
  description?: string;
  requires_approval: boolean;
}
```

### Order
```typescript
interface Order {
  id: string;
  order_number: string;
  event: Event;
  tickets: OrderTicket[];
  status: 'pending' | 'approved' | 'paid' | 'cancelled';
  total_amount: number;
  paid_amount: number;
  payment_method?: string;
  purchase_date: string;
  customer: Customer;
}
```

## Как найти реальные API эндпоинты

### Метод 1: Browser DevTools

1. Откройте https://zygo.co.il в браузере
2. Откройте DevTools (F12)
3. Перейдите на вкладку Network
4. Фильтр: XHR или Fetch
5. Выполните действия на сайте
6. Посмотрите запросы

### Метод 2: Анализ JavaScript бандлов

```bash
# Скачать главный JS файл
curl -s 'https://zygo.co.il/_next/static/chunks/main-0b370fb530f989f6.js' | \
  grep -o 'api/[^"]*' | sort -u

# Или поиск fetch/axios вызовов
curl -s 'https://zygo.co.il/_next/static/chunks/main-0b370fb530f989f6.js' | \
  grep -o 'fetch([^)]*' | head -20
```

### Метод 3: Используйте скрипт-анализатор

```bash
# Запустить анализатор
npx tsx src/scripts/zygo_api_analyzer.ts
```

## Примеры использования

### Пример 1: Получить список событий

```bash
curl 'https://zygo.co.il/api/events' \
  -H 'accept: application/json'
```

### Пример 2: Войти в систему

```bash
curl -X POST 'https://zygo.co.il/api/auth/login' \
  -H 'content-type: application/json' \
  -d '{
    "phone": "+972501234567",
    "password": "your_password"
  }'
```

### Пример 3: Купить билеты (с авторизацией)

```bash
curl -X POST 'https://zygo.co.il/api/tickets/purchase' \
  -H 'authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'content-type: application/json' \
  -d '{
    "event_id": "event_123",
    "tickets": [{
      "ticket_id": "ticket_456",
      "quantity": 2
    }],
    "payment_method": "credit_card"
  }'
```

## Заметки

1. **Токены истекают**: Access token обычно действует 2 часа, refresh token - до 30 дней
2. **Rate Limiting**: Возможно есть ограничения на количество запросов
3. **CORS**: API может быть защищен от cross-origin запросов
4. **PCI Compliance**: Платежи обрабатываются с соблюдением стандарта PCI

## Следующие шаги

1. Запустите анализатор для тестирования эндпоинтов
2. Перехватите реальные запросы через DevTools
3. Создайте полноценный парсер на основе найденных API
4. Добавьте обработку ошибок и ретраи
5. Реализуйте синхронизацию с вашей базой данных
