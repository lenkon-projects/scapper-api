# REST API Documentation

The WordPress Events Management Platform provides a RESTful API for managing parse jobs and accessing event data. The API uses Express.js with comprehensive middleware for authentication, rate limiting, logging, and error handling.

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://your-domain.com`

## Authentication

All API endpoints (except health check and documentation) require API key authentication.

### API Key Authentication

Include the API key in requests using either:

**Header (Recommended):**

```bash
X-API-Key: your-uuid-v4-api-key
```

**Query Parameter:**

```bash
?apiKey=your-uuid-v4-api-key
```

### Generate API Key

Create a UUID v4 key for your `.env` file:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomUUID())"

# Using uuidgen (macOS/Linux)
uuidgen
```

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Window**: 60 seconds (configurable via `RATE_LIMIT_WINDOW_MS`)
- **Max Requests**: 10 per window (configurable via `RATE_LIMIT_MAX_REQUESTS`)
- **Response**: 429 Too Many Requests with retry information

## API Endpoints

### Health Check

Check API server status and uptime.

**Endpoint:** `GET /api/health`  
**Authentication:** None required

#### Request

```bash
curl -X GET http://localhost:3000/api/health
```

#### Response

```json
{
  "status": "ok",
  "timestamp": "2025-11-27T10:30:00.000Z",
  "uptime": 3600.123
}
```

---

### Parse Management

#### Create Parse Job

Create and queue a new WordPress events parsing job. Returns immediately with job ID for status tracking.

**Endpoint:** `POST /api/parse`  
**Authentication:** Required

#### Request Body

```json
{
  "headless": true,
  "closeAfter": true
}
```

**Parameters:**

- `headless` (boolean, optional): Run browser in headless mode. Default: `true`
- `closeAfter` (boolean, optional): Close browser after parsing. Default: `true`

#### Request Example

```bash
curl -X POST http://localhost:3000/api/parse \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "headless": true,
    "closeAfter": true
  }'
```

#### Response (202 Accepted)

```json
{
  "jobId": "123e4567-e89b-12d3-a456-426614174000",
  "status": "pending",
  "createdAt": "2025-11-27T10:30:00.000Z",
  "message": "Parse job queued successfully"
}
```

#### Error Responses

```json
// 400 Bad Request
{
  "error": "Invalid request body"
}

// 401 Unauthorized
{
  "error": "Unauthorized"
}

// 503 Service Unavailable
{
  "error": "Queue is full. Please try again later."
}
```

---

#### Get Parse Job Status

Retrieve the status and results of a specific parse job.

**Endpoint:** `GET /api/parse/:jobId`  
**Authentication:** Required

#### Request Example

```bash
curl -X GET http://localhost:3000/api/parse/123e4567-e89b-12d3-a456-426614174000 \
  -H "X-API-Key: your-api-key"
```

#### Response Examples

**Pending Job:**

```json
{
  "jobId": "123e4567-e89b-12d3-a456-426614174000",
  "status": "pending",
  "createdAt": "2025-11-27T10:30:00.000Z"
}
```

**Running Job:**

```json
{
  "jobId": "123e4567-e89b-12d3-a456-426614174000",
  "status": "running",
  "createdAt": "2025-11-27T10:30:00.000Z",
  "startedAt": "2025-11-27T10:31:00.000Z"
}
```

**Completed Job:**

```json
{
  "jobId": "123e4567-e89b-12d3-a456-426614174000",
  "status": "completed",
  "createdAt": "2025-11-27T10:30:00.000Z",
  "startedAt": "2025-11-27T10:31:00.000Z",
  "completedAt": "2025-11-27T10:33:00.000Z",
  "result": {
    "outputFile": "events_1732708380000.json",
    "eventCount": 25,
    "screenshotPath": "events_screenshot.png"
  }
}
```

**Failed Job:**

```json
{
  "jobId": "123e4567-e89b-12d3-a456-426614174000",
  "status": "failed",
  "createdAt": "2025-11-27T10:30:00.000Z",
  "startedAt": "2025-11-27T10:31:00.000Z",
  "completedAt": "2025-11-27T10:32:00.000Z",
  "error": "Failed to authenticate with WordPress"
}
```

#### Error Responses

```json
// 404 Not Found
{
  "error": "Job not found"
}

// 401 Unauthorized
{
  "error": "Unauthorized"
}
```

---

### Events Data

#### Get Latest Events

Retrieve the most recently parsed events data.

**Endpoint:** `GET /api/events/latest`  
**Authentication:** Required

#### Request Example

```bash
curl -X GET http://localhost:3000/api/events/latest \
  -H "X-API-Key: your-api-key"
```

#### Response

```json
{
  "source": "events_1732708380000.json",
  "parsedAt": "2025-11-27T10:33:00.000Z",
  "eventCount": 25,
  "events": [
    {
      "active": true,
      "eventId": "146628",
      "ticketsSold": {
        "total": 4,
        "capacity": 220
      }
    },
    {
      "active": false,
      "eventId": "146629",
      "ticketsSold": {
        "total": 180,
        "capacity": 200
      }
    }
  ]
}
```

#### Error Responses

```json
// 404 Not Found
{
  "error": "No events data available"
}
```

---

#### Get Specific Events File

Retrieve events data from a specific timestamped file.

**Endpoint:** `GET /api/events/:filename`  
**Authentication:** Required

#### Request Example

```bash
curl -X GET http://localhost:3000/api/events/events_1732708380000.json \
  -H "X-API-Key: your-api-key"
```

#### Response

```json
{
  "source": "events_1732708380000.json",
  "parsedAt": "2025-11-27T10:33:00.000Z",
  "eventCount": 25,
  "events": [
    {
      "active": true,
      "eventId": "146628",
      "ticketsSold": {
        "total": 4,
        "capacity": 220
      }
    }
  ]
}
```

---

#### List Available Event Files

Get a list of all available event data files with metadata.

**Endpoint:** `GET /api/events`  
**Authentication:** Required

#### Request Example

```bash
curl -X GET http://localhost:3000/api/events \
  -H "X-API-Key: your-api-key"
```

#### Response

```json
{
  "files": [
    {
      "filename": "events_1732708380000.json",
      "timestamp": 1732708380000,
      "parsedAt": "2025-11-27T10:33:00.000Z",
      "size": 2048
    },
    {
      "filename": "events_1732704780000.json",
      "timestamp": 1732704780000,
      "parsedAt": "2025-11-27T09:33:00.000Z",
      "size": 1924
    }
  ],
  "totalFiles": 2
}
```

## Event Data Structure

### Event Object

```json
{
  "active": true,
  "eventId": "146628",
  "ticketsSold": {
    "total": 4,
    "capacity": 220
  }
}
```

**Fields:**

- `active` (boolean): Whether the event is currently active/published
- `eventId` (string): Unique WordPress event identifier
- `ticketsSold.total` (number): Current number of tickets sold
- `ticketsSold.capacity` (number): Total event capacity/maximum tickets

## Error Handling

The API uses consistent error response format:

```json
{
  "error": "Error description",
  "timestamp": "2025-11-27T10:30:00.000Z",
  "path": "/api/endpoint",
  "method": "GET"
}
```

### HTTP Status Codes

- **200 OK**: Successful request
- **202 Accepted**: Job queued successfully
- **400 Bad Request**: Invalid request data
- **401 Unauthorized**: Missing or invalid API key
- **404 Not Found**: Resource not found
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error
- **503 Service Unavailable**: Service temporarily unavailable

## Swagger Documentation

Interactive API documentation is available at `/api-docs` when the server is running:

- **Development**: `http://localhost:3000/api-docs`
- **Production**: `https://your-domain.com/api-docs`

The Swagger UI provides:

- Complete endpoint documentation
- Interactive request testing
- Request/response examples
- Schema definitions
- Authentication testing

## Job Queue System

The API uses an in-memory job queue for managing parse operations:

### Job States

1. **pending**: Job created and waiting to execute
2. **running**: Job currently being processed
3. **completed**: Job finished successfully
4. **failed**: Job failed with error

### Queue Configuration

Configure via environment variables:

```bash
MAX_QUEUE_SIZE=5                    # Maximum queued jobs
JOB_TIMEOUT_MS=300000              # Job timeout (5 minutes)
JOB_CLEANUP_INTERVAL_MS=3600000    # Cleanup interval (1 hour)
```

### Queue Management

- Jobs are processed sequentially (FIFO)
- Automatic cleanup of old completed/failed jobs
- Queue size limits prevent memory issues
- Job timeouts prevent stuck operations

## Integration Examples

### Node.js/JavaScript

```javascript
const API_KEY = "your-api-key";
const BASE_URL = "http://localhost:3000";

// Create parse job
async function createParseJob() {
  const response = await fetch(`${BASE_URL}/api/parse`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
    },
    body: JSON.stringify({
      headless: true,
      closeAfter: true,
    }),
  });

  return await response.json();
}

// Check job status
async function checkJobStatus(jobId) {
  const response = await fetch(`${BASE_URL}/api/parse/${jobId}`, {
    headers: {
      "X-API-Key": API_KEY,
    },
  });

  return await response.json();
}

// Get latest events
async function getLatestEvents() {
  const response = await fetch(`${BASE_URL}/api/events/latest`, {
    headers: {
      "X-API-Key": API_KEY,
    },
  });

  return await response.json();
}
```

### Python

```python
import requests
import json

API_KEY = 'your-api-key'
BASE_URL = 'http://localhost:3000'

headers = {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY
}

# Create parse job
def create_parse_job():
    data = {
        'headless': True,
        'closeAfter': True
    }

    response = requests.post(
        f'{BASE_URL}/api/parse',
        headers=headers,
        json=data
    )

    return response.json()

# Check job status
def check_job_status(job_id):
    response = requests.get(
        f'{BASE_URL}/api/parse/{job_id}',
        headers=headers
    )

    return response.json()

# Get latest events
def get_latest_events():
    response = requests.get(
        f'{BASE_URL}/api/events/latest',
        headers=headers
    )

    return response.json()
```

### cURL Examples

```bash
# Create parse job
curl -X POST http://localhost:3000/api/parse \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"headless": true, "closeAfter": true}'

# Check job status
curl -X GET http://localhost:3000/api/parse/job-id \
  -H "X-API-Key: your-api-key"

# Get latest events
curl -X GET http://localhost:3000/api/events/latest \
  -H "X-API-Key: your-api-key"

# List all event files
curl -X GET http://localhost:3000/api/events \
  -H "X-API-Key: your-api-key"
```

## Security Considerations

### API Key Management

- Use UUID v4 format for API keys
- Store API keys securely (environment variables)
- Rotate keys periodically
- Never commit keys to version control
- Use different keys for different environments

### Network Security

- Use HTTPS in production
- Configure CORS appropriately
- Implement rate limiting
- Use security headers (Helmet.js)
- Monitor for suspicious activity

### Error Information

- Error messages don't expose sensitive data
- Stack traces are logged but not returned to clients
- Request logging includes correlation IDs for debugging

## Performance Considerations

### Rate Limiting

- Default: 10 requests per minute per IP
- Adjustable via environment variables
- Returns 429 status with retry information

### Response Times

- Health check: < 50ms
- Event data retrieval: < 200ms
- Parse job creation: < 100ms
- Parse job execution: 30-120 seconds (depends on site response)

### Caching

- Event data is file-based (no database queries)
- In-memory job queue for fast status checks
- Static file serving for screenshots

## Monitoring & Observability

### Logging

Winston structured logging with:

- Request/response logging
- Error tracking with stack traces
- Performance timing
- Security events (auth failures, rate limits)

### Health Monitoring

- `/api/health` endpoint for uptime checks
- Process uptime and memory usage
- HTTP status code monitoring
- Response time tracking

### Metrics

Monitor these key metrics:

- API response times
- Error rates by endpoint
- Job queue size and processing time
- Rate limit violations
- Authentication failures
