const express = require("express");

const receiver = express();

receiver.use(express.json());

let failureCount = 0;

receiver.post("/webhook", (req, res) => {
  console.log("Received webhook:");
  console.log(JSON.stringify(req.body, null, 2));

  if (failureCount > 0) {
    failureCount--;

    console.log("Receiver: returning 500");

    return res.status(500).json({
      message: "Temporary failure"
    });
  }

  console.log("Receiver: returning 200");

  res.status(200).json({
    message: "Webhook received"
  });
});

receiver.post("/fail", (req, res) => {
  failureCount = 1;

  res.json({
    message: "Receiver will fail once"
  });
});

receiver.get("/status", (req, res) => {
  res.json({
    failureCount
  });
});

receiver.listen(4000, () => {
  console.log("Test webhook receiver running on port 4000");
});