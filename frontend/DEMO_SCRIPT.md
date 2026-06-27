# MediReach — Voice Feature Demo Script

Practice this out loud before presenting to judges.

---

## Part 1 — Green (Self-Care)

**[Before touching the mic]**

> One thing we knew early on — not everyone in a remote Northern Ontario community types easily. Elderly patients, people with limited mobility, someone in pain. They shouldn't need a keyboard to get help.

**[Click mic button, wait for red pulse]**

> So we integrated Valencia API for real-time voice transcription. Watch.

**[Speak clearly into the mic — for GREEN result]**

> I have a runny nose, mild headache, and I feel a little tired.

**[While transcription appears]**

> You can see Valencia transcribing in real time. The text is now being sent simultaneously to Claude and Nemotron for analysis.

**[When green result appears]**

> Self-care recommended. Both AIs agree — high confidence. The patient gets plain-language home treatment guidance instantly. No doctor needed. No roads needed.

---

## Part 2 — Red (Emergency)

**[Pause. Then say:]**

> Now watch what happens when I describe something more serious.

**[Speak for RED result]**

> I have severe chest pain and I cannot breathe properly.

**[When red emergency banner fires]**

> Red tier. Emergency. Both AIs fired the same verdict in under two seconds. The patient sees Call 911 immediately — in large, unmissable text. No typing. No menu navigation. Voice in. Life-saving guidance out.

---

## Closing

**[Closing line for judges]**

> For a 70-year-old Cree elder in a fly-in community three hours from the nearest ER — this could be the difference between life and death. That is why Valencia is in MediReach.

---

## Demo tips

| Step | UI cue |
|------|--------|
| Mic idle | Gray button — "Speak your symptoms" |
| Recording | Red pulse + bouncing bars |
| Live text | Gray italic interim text below textarea |
| Analyzing | "Sending to Claude & Nemotron..." spinner |
| Green result | Green card + home treatment tips |
| Red result | Full-width red banner: **Call 911 immediately** |
| Booking (optional) | Play Valencia TTS appointment reminder |
