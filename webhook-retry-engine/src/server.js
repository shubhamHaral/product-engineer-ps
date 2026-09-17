const app = require("./app");
const { initializeDatabase } = require("./db");

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        await initializeDatabase();

        app.listen(PORT, () => {
            console.log(`Webhook Retry Engine running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}

startServer();