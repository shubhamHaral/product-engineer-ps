const express = require("express");
const eventRoutes = require("./routes/events");

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
    res.json({
        status: "ok"
    });
});

app.use("/events", eventRoutes);

module.exports = app;