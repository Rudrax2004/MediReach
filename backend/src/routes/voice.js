const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const logger = require("../utils/logger");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.post("/", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Audio file is required (field: audio)" });
  }

  const valenciaUrl = process.env.VALENCIA_API_URL;
  const valenciaKey = process.env.VALENCIA_API_KEY;

  if (!valenciaUrl || !valenciaKey) {
    logger.warn("Valencia API not configured");
    return res.json({
      transcript: "",
      error: "Valencia unavailable",
      fallback_mode: true,
      source: "web-speech-api",
    });
  }

  try {
    const form = new FormData();
    form.append("audio", req.file.buffer, {
      filename: req.file.originalname || "recording.webm",
      contentType: req.file.mimetype || "audio/webm;codecs=opus",
    });

    const response = await axios.post(`${valenciaUrl.replace(/\/$/, "")}/transcribe`, form, {
      headers: {
        Authorization: `Bearer ${valenciaKey}`,
        ...form.getHeaders(),
      },
      timeout: 30000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    const data = response.data || {};
    const transcript = data.transcript || data.text || data.result || "";
    const confidence = data.confidence ?? data.score ?? 0;

    if (!transcript) {
      throw new Error("Valencia returned empty transcript");
    }

    logger.info("Valencia transcription successful", { confidence });

    return res.json({
      transcript,
      confidence,
      source: "valencia",
    });
  } catch (error) {
    logger.error("Valencia transcription failed", {
      error: error.message,
      status: error.response?.status,
    });

    return res.json({
      transcript: "",
      error: "Valencia unavailable",
      fallback_mode: true,
      source: "web-speech-api",
    });
  }
});

module.exports = router;
