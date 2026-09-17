const express = require("express");
const { getDatabase, saveDatabase } = require("../db");
const { deliverEvent } = require("../services/deliveryService");

const router = express.Router();

router.post("/", async (req, res) => {
    const { eventId, type, occurredAt, payload } = req.body;

    if (!eventId || !type || !occurredAt || payload === undefined) {
        return res.status(400).json({
            error: "eventId, type, occurredAt and payload are required"
        });
    }

    const db = getDatabase();

    const existing = db.exec(
        "SELECT * FROM events WHERE event_id = ?",
        [eventId]
    );

    if (existing.length > 0 && existing[0].values.length > 0) {
        const row = existing[0].values[0];

        return res.status(200).json({
            message: "Event already accepted",
            eventId: row[1],
            status: row[5]
        });
    }

    const now = new Date().toISOString();

    try {
        db.run(
            `
        INSERT INTO events
        (
          event_id,
          type,
          occurred_at,
          payload,
          status,
          attempt_count,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, 'PENDING', 0, ?, ?)
      `,
            [
                eventId,
                type,
                occurredAt,
                JSON.stringify(payload),
                now,
                now
            ]
        );

        saveDatabase();
    } catch (error) {
        // Another request may have inserted the same eventId
        if (error.message.includes("UNIQUE constraint failed")) {
            const duplicate = db.exec(
                "SELECT * FROM events WHERE event_id = ?",
                [eventId]
            );

            if (duplicate.length > 0 && duplicate[0].values.length > 0) {
                const row = duplicate[0].values[0];

                return res.status(200).json({
                    message: "Event already accepted",
                    eventId: row[1],
                    status: row[5]
                });
            }
        }

        return res.status(500).json({
            error: "Failed to store event"
        });
    }

    const result = db.exec(
        "SELECT * FROM events WHERE event_id = ?",
        [eventId]
    );

    const row = result[0].values[0];

    const event = {
        id: row[0],
        event_id: row[1],
        type: row[2],
        occurred_at: row[3],
        payload: row[4],
        status: row[5],
        attempt_count: row[6],
        created_at: row[7],
        updated_at: row[8]
    };

    deliverEvent(event).catch((error) => {
        console.error("Delivery error:", error);
    });

    res.status(201).json({
        message: "Event accepted",
        eventId,
        status: "PENDING"
    });
});

router.get("/:eventId", (req, res) => {
    const db = getDatabase();
    const { eventId } = req.params;

    const eventResult = db.exec(
        "SELECT * FROM events WHERE event_id = ?",
        [eventId]
    );

    if (eventResult.length === 0 || eventResult[0].values.length === 0) {
        return res.status(404).json({
            error: "Event not found"
        });
    }

    const row = eventResult[0].values[0];

    const attemptsResult = db.exec(
        `
      SELECT *
      FROM delivery_attempts
      WHERE event_id = ?
      ORDER BY attempt_number
    `,
        [eventId]
    );

    const attempts =
        attemptsResult.length > 0
            ? attemptsResult[0].values.map((attempt) => ({
                id: attempt[0],
                eventId: attempt[1],
                attemptNumber: attempt[2],
                startedAt: attempt[3],
                finishedAt: attempt[4],
                status: attempt[5],
                httpStatus: attempt[6],
                error: attempt[7]
            }))
            : [];

    res.json({
        eventId: row[1],
        type: row[2],
        occurredAt: row[3],
        payload: JSON.parse(row[4]),
        status: row[5],
        attemptCount: row[6],
        createdAt: row[7],
        updatedAt: row[8],
        attempts
    });
});

module.exports = router;