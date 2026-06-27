const fs = require("fs").promises;
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const logger = require("../utils/logger");

const DOCTORS_PATH = path.join(__dirname, "../../data/doctors.json");
const APPOINTMENTS_PATH = path.join(__dirname, "../../data/appointments.json");

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
};

const writeJson = async (filePath, data) => {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
};

const getDoctors = async (req, res, next) => {
  try {
    const doctors = await readJson(DOCTORS_PATH);
    const { specialty, available } = req.query;

    let filtered = doctors;

    if (specialty) {
      filtered = filtered.filter(
        (doc) => doc.specialty.toLowerCase() === specialty.toLowerCase()
      );
    }

    if (available !== undefined) {
      const isAvailable = available === "true";
      filtered = filtered.filter((doc) => doc.available === isAvailable);
    }

    res.json({ count: filtered.length, doctors: filtered });
  } catch (error) {
    next(error);
  }
};

const bookAppointment = async (req, res, next) => {
  try {
    const { doctorId, patientName, patientEmail, datetime, symptoms, notes } =
      req.body;

    if (!doctorId || !patientName || !patientEmail || !datetime) {
      return res.status(400).json({
        error: "doctorId, patientName, patientEmail, and datetime are required",
      });
    }

    const doctors = await readJson(DOCTORS_PATH);
    const doctor = doctors.find((doc) => doc.id === doctorId);

    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    if (!doctor.available) {
      return res.status(409).json({ error: "Doctor is not currently available" });
    }

    const appointments = await readJson(APPOINTMENTS_PATH);

    const appointment = {
      id: uuidv4(),
      doctorId,
      doctorName: doctor.name,
      specialty: doctor.specialty,
      patientName,
      patientEmail,
      datetime,
      symptoms: symptoms || null,
      notes: notes || null,
      status: "confirmed",
      createdAt: new Date().toISOString(),
    };

    appointments.push(appointment);
    await writeJson(APPOINTMENTS_PATH, appointments);

    logger.info("Appointment booked", { appointmentId: appointment.id, doctorId });

    res.status(201).json({ message: "Appointment booked successfully", appointment });
  } catch (error) {
    next(error);
  }
};

const getAppointments = async (req, res, next) => {
  try {
    const appointments = await readJson(APPOINTMENTS_PATH);
    const { patientEmail, doctorId } = req.query;

    let filtered = appointments;

    if (patientEmail) {
      filtered = filtered.filter(
        (appt) => appt.patientEmail.toLowerCase() === patientEmail.toLowerCase()
      );
    }

    if (doctorId) {
      filtered = filtered.filter((appt) => appt.doctorId === doctorId);
    }

    filtered.sort(
      (a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()
    );

    res.json({ count: filtered.length, appointments: filtered });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDoctors, bookAppointment, getAppointments };
