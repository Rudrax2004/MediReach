const axios = require("axios");
const logger = require("./logger");

let cachedToken = null;
let tokenExpiresAt = 0;

const getZoomCredentials = () => {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    throw new Error("Zoom API credentials are not configured");
  }

  return { accountId, clientId, clientSecret };
};

const getAccessToken = async () => {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const { accountId, clientId, clientSecret } = getZoomCredentials();
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await axios.post(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
    null,
    {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      timeout: 15000,
    }
  );

  cachedToken = response.data.access_token;
  tokenExpiresAt = Date.now() + (response.data.expires_in - 60) * 1000;

  return cachedToken;
};

const formatZoomStartTime = (date, timezone) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value;

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
};

const createScheduledMeeting = async ({
  topic,
  startTime,
  durationMinutes = 60,
  timezone = process.env.ZOOM_TIMEZONE || "America/Toronto",
}) => {
  const startDate = new Date(startTime);

  if (Number.isNaN(startDate.getTime())) {
    throw new Error("Invalid appointment datetime");
  }

  if (startDate.getTime() <= Date.now()) {
    throw new Error("Appointment must be scheduled in the future");
  }

  const token = await getAccessToken();
  const userId = process.env.ZOOM_USER_ID || "me";

  logger.info("Creating Zoom scheduled meeting", {
    topic,
    start_time: formatZoomStartTime(startDate, timezone),
    timezone,
    duration: durationMinutes,
  });

  const response = await axios.post(
    `https://api.zoom.us/v2/users/${encodeURIComponent(userId)}/meetings`,
    {
      topic,
      type: 2,
      start_time: formatZoomStartTime(startDate, timezone),
      duration: durationMinutes,
      timezone,
      settings: {
        join_before_host: false,
        waiting_room: true,
        approval_type: 2,
        host_video: true,
        participant_video: true,
        mute_upon_entry: true,
        auto_recording: "none",
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      timeout: 20000,
    }
  );

  const meeting = response.data;

  return {
    meeting_id: String(meeting.id),
    join_url: meeting.join_url,
    start_url: meeting.start_url,
    password: meeting.password || null,
    start_time: meeting.start_time,
    duration: meeting.duration,
    timezone: meeting.timezone,
  };
};

module.exports = { createScheduledMeeting, getAccessToken };
