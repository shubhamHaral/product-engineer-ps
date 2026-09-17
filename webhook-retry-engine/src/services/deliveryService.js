const { getDatabase, saveDatabase } = require("../db");

const WEBHOOK_URL =
    process.env.WEBHOOK_URL || "http://localhost:4000/webhook";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
    return status === 408 || status === 429 || status >= 500;
}

async function deliverEvent(event) {
    const db = getDatabase();

    for (let attemptNumber = event.attempt_count + 1;
        attemptNumber <= MAX_ATTEMPTS;
        attemptNumber++) {

        const startedAt = new Date().toISOString();

        db.run(
            `
        INSERT INTO delivery_attempts
        (event_id, attempt_number, started_at, status)
        VALUES (?, ?, ?, 'IN_PROGRESS')
      `,
            [event.event_id, attemptNumber, startedAt]
        );

        const attemptResult = db.exec(
            "SELECT last_insert_rowid()"
        );

        const attemptId = attemptResult[0].values[0][0];

        db.run(
            `
        UPDATE events
        SET status = 'DELIVERING',
            attempt_count = ?,
            updated_at = ?
        WHERE event_id = ?
      `,
            [attemptNumber, startedAt, event.event_id]
        );

        saveDatabase();

        try {
            const response = await fetch(WEBHOOK_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    eventId: event.event_id,
                    type: event.type,
                    occurredAt: event.occurred_at,
                    payload: JSON.parse(event.payload)
                })
            });

            const finishedAt = new Date().toISOString();

            if (response.ok) {
                db.run(
                    `
            UPDATE delivery_attempts
            SET finished_at = ?,
                status = 'SUCCESS',
                http_status = ?
            WHERE id = ?
          `,
                    [finishedAt, response.status, attemptId]
                );

                db.run(
                    `
            UPDATE events
            SET status = 'SUCCESS',
                updated_at = ?
            WHERE event_id = ?
          `,
                    [finishedAt, event.event_id]
                );

                saveDatabase();

                return {
                    success: true,
                    status: response.status,
                    attempts: attemptNumber
                };
            }

            const retryable = isRetryableStatus(response.status);

            db.run(
                `
          UPDATE delivery_attempts
          SET finished_at = ?,
              status = 'FAILED',
              http_status = ?,
              error = ?
          WHERE id = ?
        `,
                [
                    finishedAt,
                    response.status,
                    `HTTP ${response.status}`,
                    attemptId
                ]
            );

            db.run(
                `
          UPDATE events
          SET status = ?,
              updated_at = ?
          WHERE event_id = ?
        `,
                [
                    retryable && attemptNumber < MAX_ATTEMPTS
                        ? "PENDING"
                        : "FAILED",
                    finishedAt,
                    event.event_id
                ]
            );

            saveDatabase();

            if (!retryable || attemptNumber >= MAX_ATTEMPTS) {
                return {
                    success: false,
                    error: `HTTP ${response.status}`,
                    attempts: attemptNumber
                };
            }

        } catch (error) {
            const finishedAt = new Date().toISOString();

            db.run(
                `
          UPDATE delivery_attempts
          SET finished_at = ?,
              status = 'FAILED',
              error = ?
          WHERE id = ?
        `,
                [finishedAt, error.message, attemptId]
            );

            db.run(
                `
          UPDATE events
          SET status = ?,
              updated_at = ?
          WHERE event_id = ?
        `,
                [
                    attemptNumber < MAX_ATTEMPTS ? "PENDING" : "FAILED",
                    finishedAt,
                    event.event_id
                ]
            );

            saveDatabase();

            if (attemptNumber >= MAX_ATTEMPTS) {
                return {
                    success: false,
                    error: error.message,
                    attempts: attemptNumber
                };
            }
        }

        await sleep(RETRY_DELAY_MS);
    }
}

module.exports = {
    deliverEvent,
    isRetryableStatus
};