import { useEffect, useState } from "react";
import BookingConfirmation from "./BookingConfirmation";
import "./BookingConfirmation.css";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function BookAppointment({ defaultPatientName = "", defaultSymptoms = "" }) {
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState("");
  const [patientName, setPatientName] = useState(defaultPatientName);
  const [phone, setPhone] = useState("");
  const [datetime, setDatetime] = useState("");
  const [reason, setReason] = useState(defaultSymptoms);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/doctors?accepting=true&location=Sudbury`)
      .then((res) => res.json())
      .then((data) => {
        setDoctors(data.doctors || []);
        if (data.doctors?.length) {
          setDoctorId(data.doctors[0].id);
          const slot = data.doctors[0].next_available || data.doctors[0].nextSlot;
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
    if (defaultSymptoms) setReason(defaultSymptoms);
  }, [defaultSymptoms]);

  const handleDoctorChange = (id) => {
    setDoctorId(id);
    const doctor = doctors.find((d) => d.id === id);
    const slot = doctor?.next_available || doctor?.nextSlot;
    if (slot) {
      setDatetime(slot.slice(0, 16));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setConfirmation(null);

    try {
      const response = await fetch(`${API_BASE}/api/book-appointment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctor_id: doctorId,
          patient_name: patientName,
          phone,
          datetime: new Date(datetime).toISOString(),
          reason,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Booking failed");
      }

      setConfirmation({
        confirmationId: data.confirmation_id,
        doctorName: data.doctor_name,
        appointmentTime: data.appointment_time,
        zoomLink: data.zoom_link,
        zoomMeetingId: data.zoom_meeting_id,
        zoomPassword: data.zoom_password,
        zoomStartTime: data.zoom_start_time,
        zoomDurationMinutes: data.zoom_duration_minutes,
        message: data.message,
        patientName,
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
        appointment={{
          patientName: confirmation.patientName,
          doctorName: confirmation.doctorName,
          datetime: confirmation.appointmentTime,
          status: "confirmed",
          zoomLink: confirmation.zoomLink,
          zoomMeetingId: confirmation.zoomMeetingId,
          zoomPassword: confirmation.zoomPassword,
          zoomDurationMinutes: confirmation.zoomDurationMinutes,
        }}
        message={confirmation.message}
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
        <label htmlFor="phone">Phone</label>
        <input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="705-555-0100"
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
              {doc.name} — {doc.specialty} ({doc.location})
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

      <div className="booking-form__field">
        <label htmlFor="reason">Reason for visit</label>
        <input
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
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
