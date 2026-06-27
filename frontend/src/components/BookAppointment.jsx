import { useEffect, useState } from "react";
import BookingConfirmation from "./BookingConfirmation";
import "./BookingConfirmation.css";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function BookAppointment({ defaultPatientName = "", defaultSymptoms = "" }) {
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState("");
  const [patientName, setPatientName] = useState(defaultPatientName);
  const [patientEmail, setPatientEmail] = useState("");
  const [datetime, setDatetime] = useState("");
  const [symptoms, setSymptoms] = useState(defaultSymptoms);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/doctors?available=true`)
      .then((res) => res.json())
      .then((data) => {
        setDoctors(data.doctors || []);
        if (data.doctors?.length) {
          setDoctorId(data.doctors[0].id);
          const slot = data.doctors[0].nextSlot;
          if (slot) {
            setDatetime(slot.slice(0, 16));
          }
        }
      })
      .catch(() => setError("Could not load doctors"));
  }, []);

  useEffect(() => {
    if (defaultPatientName) setPatientName(defaultPatientName);
  }, [defaultPatientName]);

  useEffect(() => {
    if (defaultSymptoms) setSymptoms(defaultSymptoms);
  }, [defaultSymptoms]);

  const handleDoctorChange = (id) => {
    setDoctorId(id);
    const doctor = doctors.find((d) => d.id === id);
    if (doctor?.nextSlot) {
      setDatetime(doctor.nextSlot.slice(0, 16));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setConfirmation(null);

    try {
      const response = await fetch(`${API_BASE}/api/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId,
          patientName,
          patientEmail,
          datetime: new Date(datetime).toISOString(),
          symptoms: symptoms || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Booking failed");
      }

      setConfirmation({
        appointment: data.appointment,
        audioUrl: data.audio_url,
        voiceSource: data.voice_source,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (confirmation) {
    return (
      <BookingConfirmation
        appointment={confirmation.appointment}
        audioUrl={confirmation.audioUrl}
      />
    );
  }

  return (
    <form className="booking-form" onSubmit={handleSubmit}>
      <h2>Book Teleconsult</h2>

      <div className="booking-form__field">
        <label htmlFor="patientName">Your name</label>
        <input
          id="patientName"
          value={patientName}
          onChange={(e) => setPatientName(e.target.value)}
          required
        />
      </div>

      <div className="booking-form__field">
        <label htmlFor="patientEmail">Email</label>
        <input
          id="patientEmail"
          type="email"
          value={patientEmail}
          onChange={(e) => setPatientEmail(e.target.value)}
          required
        />
      </div>

      <div className="booking-form__field">
        <label htmlFor="doctorId">Doctor</label>
        <select
          id="doctorId"
          value={doctorId}
          onChange={(e) => handleDoctorChange(e.target.value)}
          required
        >
          {doctors.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc.name} — {doc.specialty}
            </option>
          ))}
        </select>
      </div>

      <div className="booking-form__field">
        <label htmlFor="datetime">Appointment time</label>
        <input
          id="datetime"
          type="datetime-local"
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
          required
        />
      </div>

      {error && <p className="app__error">{error}</p>}

      <button type="submit" className="booking-form__submit" disabled={loading}>
        {loading ? "Booking..." : "Confirm Appointment"}
      </button>
    </form>
  );
}
