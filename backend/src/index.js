require("dotenv").config();

const express = require("express");
const cors = require("cors");
const logger = require("./utils/logger");

const analyzeRoutes = require("./routes/analyze");
const doctorsRoutes = require("./routes/doctors");
const bookingRoutes = require("./routes/booking");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    models: ["claude", "nemotron", "random-forest"],
    version: "1.0.0",
  });
});

app.use("/api/analyze", analyzeRoutes);
app.use("/api/doctors", doctorsRoutes);
app.use("/api", bookingRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, _req, res, _next) => {
  logger.error("Unhandled error", { error: err.message, stack: err.stack });

  const status = err.status || 500;
  res.status(status).json({
    error: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

app.listen(PORT, () => {
  logger.info(`MediReach API running on port ${PORT}`, {
    env: process.env.NODE_ENV || "development",
  });
});

module.exports = app;
