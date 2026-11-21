/**
 * Everything the assistant is allowed to state as a fact about ClinIQ. If the product changes,
 * change this text; the assistant is told not to answer product questions from anywhere else.
 */
export const KNOWLEDGE = `
WHAT CLINIQ IS
ClinIQ lets a patient describe their symptoms once, check an organised summary, and send it to a clinic before the visit. ClinIQ does not diagnose, prescribe, or recommend treatment, and it is not an emergency service.

THE STEPS
1. Health profile (optional, "Health profile" in the menu): date of birth, sex, blood group, allergies, long-term conditions, regular medicines, emergency contact. It is filled in automatically on every intake.
2. Describe: type your symptoms, or tap Dictate to speak (dictation works in Chrome and Edge and uses the browser's speech service; ClinIQ keeps only the text, not audio). A draft is saved automatically.
3. Review: AI turns your words into a structured summary. It can contain mistakes. You can edit every section: main problem, symptoms, severity, timeline, background and type of doctor. Then tick the box and confirm.
4. Choose where to send it: clinics on ClinIQ (you can send digitally after agreeing to share) or other clinics near you (not on ClinIQ; you cannot send to them digitally, so download the intake slip and hand it over in person). Use "Use my location" or search by area, city or pincode. Your exact location stays in your browser.
5. After sending, the case page shows progress and updates by itself.

CASE STATUSES
Draft: not confirmed yet. Confirmed: you approved the summary, not sent yet. Sent to clinic: the clinic can now see it. Under doctor review: a doctor started reading it. More information requested: the clinic asked you a question; open the case and choose "Add information and send again". Consultation ready: the clinic has reviewed it.

URGENCY
Each summary gets a suggested urgency: Urgent, Soon or Routine. It comes from fixed warning-sign rules plus AI and tells the clinic how soon someone should look. It is not a diagnosis, you cannot lower it, and "Routine" does not mean it is safe to wait. A doctor makes the real decision.

WARNING SIGNS
If you describe things like chest pain or pressure, trouble breathing, a drooping face, sudden weakness, heavy bleeding, fainting, seizures, signs of a severe allergic reaction, or thoughts of self-harm, ClinIQ shows an emergency warning. In an emergency call 112 (India, EU) or 911 (US, Canada) right away.

WHAT A CLINIC CAN SEE
Only after you press send, the doctors and admins of that clinic see: your name, age, sex, blood group, emergency contact, allergies, conditions, medicines, your confirmed summary, and your original words. Nothing is visible to a clinic before you send. Other patients never see your information. A clinic cannot see your other cases.

CLINIC NOT LISTED
A clinic only appears if it is verified by ClinIQ's operator and is accepting intakes. Ticking "Show all specialties" shows clinics that do not match the suggested specialty.

INTAKE SLIP
After you confirm a summary you can open the intake slip from the case page or the send page. Choose Print, then "Save as PDF" to download it or print it for a clinic visit.

ACCOUNT AND PRIVACY
Account page: "Download my data" gives a file with everything ClinIQ holds about you. "Delete your account" permanently deletes your profile and all your cases, including cases already sent. Copies a clinic already made in its own records are not affected. ClinIQ does not sell data or use it for advertising. Chats with this assistant are not saved by ClinIQ; only text you choose to turn into an intake is saved.

TROUBLESHOOTING
Location blocked: allow location for the site in the browser, or use "search by area". Summary could not be built: your description is saved; try again in a moment. "Too many requests": wait a few minutes. Dictation not available: use a recent Chrome or Edge, or type instead.

WHAT THE ASSISTANT CANNOT DO
It cannot see your cases or personal records, cannot confirm or send anything for you, cannot contact a clinic, and cannot give medical advice.
`.trim()
