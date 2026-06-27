import "./BookingConfirmation.css";

function formatDisplayTime(datetime) {
  return new Date(datetime).toLocaleString("en-CA", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function BookingConfirmation({ appointment, audioUrl, message }) {
  const hasAudio = Boolean(audioUrl);

  return (
    <div className="booking-confirmation">
      <div className="booking-confirmation__header">
        <span className="booking-confirmation__check">✓</span>
        <h2>Appointment Confirmed</h2>
      </div>

      {message && <p className="booking-confirmation__message">{message}</p>}

      <dl className="booking-confirmation__details">
        <div>
          <dt>Patient</dt>
          <dd>{appointment.patientName}</dd>
        </div>
        <div>
          <dt>Doctor</dt>
          <dd>
            {appointment.doctorName}
            {appointment.specialty && (
              <span className="booking-confirmation__specialty">{appointment.specialty}</span>
            )}
          </dd>
        </div>
        <div>
          <dt>When</dt>
          <dd>{formatDisplayTime(appointment.datetime)}</dd>
        </div>
        {appointment.zoomLink && (
          <div>
            <dt>Video call</dt>
            <dd>
              <a href={appointment.zoomLink} target="_blank" rel="noreferrer">
                {appointment.zoomLink}
              </a>
            </dd>
          </div>
        )}
        <div>
          <dt>Status</dt>
          <dd className="booking-confirmation__status">{appointment.status}</dd>
        </div>
      </dl>

      <div className="booking-confirmation__voice">
        {hasAudio ? (
          <div className="booking-confirmation__player">
            <label htmlFor="appointment-audio">Play your appointment reminder</label>
            <audio id="appointment-audio" controls src={audioUrl}>
              Your browser does not support audio playback.
            </audio>
          </div>
        ) : (
          <p className="booking-confirmation__voice-unavailable">
            Voice confirmation powered by Valencia API
          </p>
        )}

        <p className="booking-confirmation__attribution">Powered by Valencia Voice API</p>
      </div>
    </div>
  );
}
