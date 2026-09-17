# Webhook Retry Engine — Submission

## 1. Retryable HTTP Responses and Errors

The service treats these HTTP responses as retryable:

- HTTP 408 Request Timeout
- HTTP 429 Too Many Requests
- HTTP 5xx Server Errors

Network errors such as connection failures are also retried.

Other HTTP 4xx responses are treated as non-retryable failures.

## 2. Retry Policy

The maximum number of delivery attempts is 3.

A 2-second delay is used between retry attempts.

The retry policy is bounded so an event cannot retry forever.

## 3. Delivery Guarantee

The service provides at-least-once delivery semantics.

An event is persisted before delivery starts, and every delivery attempt is recorded.

Exactly-once delivery cannot be guaranteed across an external HTTP boundary.

## 4. Idempotency

Each event requires a caller-supplied `eventId`.

The database has a UNIQUE constraint on `eventId`.

Repeated submissions with the same `eventId` are treated as the same logical event instead of creating another event.

## 5. Attempt History

Each delivery attempt records:

- Event ID
- Attempt number
- Start time
- Finish time
- Status
- HTTP status
- Error message when applicable

The history can be inspected using:

`GET /events/:eventId`

## 6. System Design

The system separates responsibilities into:

- API route: accepts events and handles idempotency
- Database: persists events and delivery attempts
- Delivery service: sends HTTP requests and classifies failures
- Receiver: local test webhook used for demonstration

## 7. Duplicate Delivery Causes

Duplicate delivery can happen when a worker sends a request successfully but crashes before recording the response.

At-least-once delivery therefore allows the external receiver to see the same event more than once.

The receiver should use the event ID for idempotent processing when necessary.

## 8. Multiple Workers

If multiple workers are used in production, events should be claimed atomically using database locking or a queue.

Only one worker should own a delivery attempt at a time.

The current implementation is intentionally small and does not implement a distributed queue.

## 9. Endpoint Capacity Isolation

In production, webhook delivery should be isolated from event ingestion.

A queue and worker pool can prevent a slow external endpoint from blocking API requests.

Per-endpoint concurrency limits and timeouts can also protect the system.

## 10. Production Metrics and Alerts

Useful metrics include:

- Successful deliveries
- Failed deliveries
- Retry count
- Delivery latency
- HTTP status distribution
- Events reaching maximum attempts
- Queue/worker backlog

Alerts can be created for increasing failure rates, high retry counts, and growing backlog.

## 11. AI Assistance Disclosure

AI assistance was used during development for implementation guidance, debugging, test planning, and documentation.
