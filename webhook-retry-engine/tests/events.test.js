const request = require("supertest");

jest.mock("../src/services/deliveryService", () => ({
    deliverEvent: jest.fn().mockResolvedValue({
        success: true,
        status: 200
    })
}));

const app = require("../src/app");
const { initializeDatabase } = require("../src/db");

beforeAll(async () => {
    await initializeDatabase();
});

describe("Webhook Retry Engine", () => {
    test("accepts a new event", async () => {
        const response = await request(app)
            .post("/events")
            .send({
                eventId: "test_success_001",
                type: "order.created",
                occurredAt: new Date().toISOString(),
                payload: {
                    orderId: 1
                }
            });

        expect(response.status).toBe(201);
        expect(response.body.eventId).toBe("test_success_001");
    });

    test("handles duplicate eventId", async () => {
        const event = {
            eventId: "test_duplicate_001",
            type: "order.created",
            occurredAt: new Date().toISOString(),
            payload: {
                orderId: 2
            }
        };

        await request(app)
            .post("/events")
            .send(event);

        const response = await request(app)
            .post("/events")
            .send(event);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe("Event already accepted");
    });

    test("returns 404 for unknown event", async () => {
        const response = await request(app)
            .get("/events/does_not_exist");

        expect(response.status).toBe(404);
    });
});
