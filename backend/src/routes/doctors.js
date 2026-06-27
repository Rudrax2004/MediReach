const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const logger = require("../utils/logger");
const { createScheduledMeeting } = require("../utils/zoomClient");

const router = express.Router();

const DOCTORS_PATH = path.join(__dirname, "../../data/doctors.json");
const APPOINTMENTS_PATH = path.join(__dirname, "../../data/appointments.json");

const FALLBACK_DOCTORS = [
  {
    id: "no-001",
    name: "Dr. Sarah Mitchell",
    specialty: "Family Medicine",
    location: "Sudbury",
    rating: 4.9,
    accepting_patients: true,
    languages: ["English", "French"],
    next_available: "2026-06-30T09:00:00Z",
  },
  {
    id: "no-002",
    name: "Dr. James Okonkwo",
    specialty: "Cardiology",
    location: "Thunder Bay",
    rating: 4.8,
    accepting_patients: true,
    languages: ["English"],
    next_available: "2026-07-01T11:00:00Z",
  },
  {
    id: "no-003",
    name: "Dr. Maria Rodriguez",
    specialty: "Pediatrics",
    location: "Sudbury",
    rating: 4.7,
    accepting_patients: true,
    languages: ["English", "Spanish"],
    next_available: "2026-06-29T14:00:00Z",
  },
  {
    id: "no-004",
    name: "Dr. David Kim",
    specialty: "Pulmonology",
    location: "Timmins",
    rating: 4.9,
    accepting_patients: false,
    languages: ["English", "Korean"],
    next_available: "2026-07-05T10:00:00Z",
  },
  {
    id: "no-005",
    name: "Dr. Emily Watson",
    specialty: "Emergency Medicine",
    location: "North Bay",
    rating: 4.8,
    accepting_patients: true,
    languages: ["English"],
    next_available: "2026-06-28T08:00:00Z",
  },
  {
    id: "no-006",
    name: "Dr. Ahmed Hassan",
    specialty: "Internal Medicine",
    location: "Sudbury",
    rating: 4.6,
    accepting_patients: true,
    languages: ["English", "Arabic"],
    next_available: "2026-07-02T13:00:00Z",
  },
  {
    id: "no-007",
    name: "Dr. Patricia Nish",
    specialty: "Family Medicine",
    location: "Kapuskasing",
    rating: 4.5,
    accepting_patients: false,
    languages: ["English", "Cree"],
    next_available: "2026-07-08T09:30:00Z",
  },
  {
    id: "no-008",
    name: "Dr. Robert Leblanc",
    specialty: "Mental Health",
    location: "Sudbury",
    rating: 4.8,
    accepting_patients: true,
    languages: ["English", "French"],
    next_available: "2026-06-30T15:00:00Z",
  },
];

const readJson = async (filePath, fallback = []) => {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const writeJson = async (filePath, data) => {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
};

const normalizeDoctor = (doctor) => ({
  ...doctor,
  id: doctor.id || doctor.doctor_id,
  accepting_patients: doctor.accepting_patients ?? doctor.available ?? false,
});

const loadDoctors = async () => {
  try {
    const stat = await fs.stat(DOCTORS_PATH);
    const raw = await readJson(DOCTORS_PATH, null);

    if (!Array.isArray(raw) || raw.length === 0) {
      return {
        doctors: FALLBACK_DOCTORS,
        dataSource: "fallback",
        lastUpdated: new Date().toISOString(),
      };
    }

    return {
      doctors: raw.map(normalizeDoctor),
      dataSource: "apify",
      lastUpdated: stat.mtime.toISOString(),
    };
  } catch {
    return {
      doctors: FALLBACK_DOCTORS,
      dataSource: "fallback",
      lastUpdated: new Date().toISOString(),
    };
  }
};

const findDoctorById = async (doctorId) => {
  const { doctors } = await loadDoctors();
  return doctors.find(
    (doc) => doc.id === doctorId || doc.doctor_id === doctorId
  );
};

router.get("/doctors", async (req, res, next) => {
  try {
    const { specialty, location, accepting } = req.query;
    const { doctors, dataSource, lastUpdated } = await loadDoctors();

    let filtered = [...doctors];

    if (specialty) {
      const specialtyLower = specialty.toLowerCase();
      filtered = filtered.filter((doc) =>
        (doc.specialty || "").toLowerCase().includes(specialtyLower)
      );
    }

    if (location) {
      const locationLower = location.toLowerCase();
      filtered = filtered.filter((doc) =>
        (doc.location || "").toLowerCase().includes(locationLower)
      );
    }

    if (accepting !== undefined) {
      const wantsAccepting = accepting === "true";
      filtered = filtered.filter(
        (doc) => Boolean(doc.accepting_patients) === wantsAccepting
      );
    }

    filtered.sort((a, b) => {
      const aAccepting = a.accepting_patients ? 1 : 0;
      const bAccepting = b.accepting_patients ? 1 : 0;
      if (bAccepting !== aAccepting) {
        return bAccepting - aAccepting;
      }
      return (b.rating || 0) - (a.rating || 0);
    });

    res.set("X-Data-Source", dataSource);

    res.json({
      doctors: filtered,
      total: filtered.length,
      data_source: dataSource,
      last_updated: lastUpdated,
      powered_by: "Apify Web Scraper",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/book-appointment", async (req, res, next) => {
  try {
    const { doctor_id, patient_name, phone, datetime, reason } = req.body;

    if (!doctor_id || !patient_name || !phone || !datetime || !reason) {
      return res.status(400).json({
        error: "doctor_id, patient_name, phone, datetime, and reason are required",
      });
    }

    const doctor = await findDoctorById(doctor_id);

    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    const confirmation_id = uuidv4();
    const meetingTopic = `MediReach Teleconsult — ${doctor.name} & ${patient_name}`;

    let zoomMeeting;
    try {
      zoomMeeting = await createScheduledMeeting({
        topic: meetingTopic,
        startTime: datetime,
        durationMinutes: 60,
      });
    } catch (error) {
      logger.error("Zoom meeting creation failed", { error: error.message });
      return res.status(502).json({
        error: "Failed to schedule Zoom meeting",
        details:
          process.env.NODE_ENV === "development"
            ? error.message
            : "Please verify Zoom API credentials and try again.",
      });
    }

    const appointment = {
      confirmation_id,
      doctor_id,
      doctor_name: doctor.name,
      patient_name,
      phone,
      datetime,
      reason,
      zoom_link: zoomMeeting.join_url,
      zoom_meeting_id: zoomMeeting.meeting_id,
      zoom_password: zoomMeeting.password,
      zoom_start_time: zoomMeeting.start_time,
      zoom_duration_minutes: zoomMeeting.duration,
      zoom_timezone: zoomMeeting.timezone,
      specialty: doctor.specialty,
      location: doctor.location,
      status: "confirmed",
      created_at: new Date().toISOString(),
    };

    const appointments = await readJson(APPOINTMENTS_PATH, []);
    appointments.push(appointment);
    await writeJson(APPOINTMENTS_PATH, appointments);

    logger.info("Appointment booked with Zoom meeting", {
      confirmation_id,
      doctor_id,
      zoom_meeting_id: zoomMeeting.meeting_id,
    });

    res.status(201).json({
      confirmation_id,
      doctor_name: doctor.name,
      appointment_time: datetime,
      zoom_link: zoomMeeting.join_url,
      zoom_meeting_id: zoomMeeting.meeting_id,
      zoom_password: zoomMeeting.password,
      zoom_start_time: zoomMeeting.start_time,
      zoom_duration_minutes: 60,
      zoom_timezone: zoomMeeting.timezone,
      message: "Appointment confirmed! Check your phone for voice confirmation.",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/appointments", async (req, res, next) => {
  try {
    const appointments = await readJson(APPOINTMENTS_PATH, []);

    res.json({
      appointments,
      total: appointments.length,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
