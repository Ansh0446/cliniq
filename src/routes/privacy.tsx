import { createFileRoute } from '@tanstack/react-router'
import { LegalPage, contact, grievance, operator } from '@/components/legal'
import { pageHead } from '@/lib/site'

export const Route = createFileRoute('/privacy')({
  head: () => pageHead({ title: 'Privacy policy', description: 'What ClinIQ collects, why, who sees it, and how to access or delete your data.', path: '/privacy' }),
  component: Privacy,
})

function Privacy() {
  return (
    <LegalPage title="Privacy policy" updated="[DATE]">
      <section>
        <h2>1. Who we are</h2>
        <p>ClinIQ is run by {operator()} ("we"). You can reach us at <a href={`mailto:${contact()}`}>{contact()}</a>. [ADDRESS AND REGISTRATION DETAILS]</p>
      </section>

      <section>
        <h2>2. What ClinIQ does</h2>
        <p>ClinIQ helps you describe your symptoms, turns what you say into a structured summary using AI, lets you correct and confirm it, and sends it to a clinic that you choose. ClinIQ does not diagnose conditions or recommend treatment, and it is not an emergency service.</p>
      </section>

      <section>
        <h2>3. What we collect</h2>
        <ul>
          <li><strong>Account details:</strong> your email address, name, and a password (stored only as a one-way hash) or your Google sign-in identity.</li>
          <li><strong>Health profile (optional):</strong> date of birth, sex, blood group, allergies, long-term conditions, regular medicines, and an emergency contact's name and phone number.</li>
          <li><strong>Intake content:</strong> the symptoms you type or dictate, the AI-written summary, your edits to it, the urgency level suggested by our rules and AI, and warning signs that were detected. If you dictate, only the resulting text is kept; we do not store audio.</li>
          <li><strong>Assistant chat:</strong> the messages you type to the in-app assistant. ClinIQ does not store the chat; it disappears when you close it or start a new one. If you choose to turn a conversation into an intake, only the text you approve is saved, like any other intake.</li>
          <li><strong>Case activity:</strong> when a case was created, confirmed, sent, opened by the clinic, or changed status. This is kept as an audit trail.</li>
          <li><strong>Clinic and clinician details</strong> (for clinic users): clinic name, address, phone, email, map position, opening hours, specialties, and clinicians' names and licence numbers.</li>
          <li><strong>Location:</strong> only if you tap "Use my location". Your device position is used in your browser; a copy rounded to about one kilometre is sent to our server to look up nearby clinics, and is not stored.</li>
        </ul>
        <p>Health information is sensitive. We collect it only to provide the service you ask for.</p>
      </section>

      <section>
        <h2>4. How we use it</h2>
        <ul>
          <li>To build your summary and suggested urgency, and to let you review and confirm it.</li>
          <li>To send your confirmed case to the clinic you choose, and to show you its progress.</li>
          <li>To keep the service secure, prevent abuse, and keep an audit trail of who opened or changed a case.</li>
          <li>We do not sell your information, and we do not use it for advertising.</li>
        </ul>
      </section>

      <section>
        <h2>5. Who can see your information</h2>
        <ul>
          <li><strong>The clinic you choose, only after you press send.</strong> Doctors and admins at that clinic can see your name, age, sex, blood group, emergency contact, allergies, conditions, medicines, the confirmed summary, and your original words. A case you have not sent is not visible to any clinic.</li>
          <li><strong>Other patients cannot see your information.</strong></li>
          <li><strong>The operator's platform administrators</strong> may see limited clinic registration details to verify clinics.</li>
        </ul>
      </section>

      <section>
        <h2>6. Service providers we use</h2>
        <p>These companies process data on our behalf. What each one receives:</p>
        <ul>
          <li><strong>Supabase</strong> hosts our database and sign-in. It stores everything described in section 3. Our database is hosted in the Asia-Pacific (Mumbai) region. [OPERATOR TO CONFIRM REGION]</li>
          <li><strong>Google (Gemini API)</strong> turns your text into a structured summary. It receives what you typed or dictated, the messages you send to the in-app assistant, and your age, sex, allergies, medicines and long-term conditions from your profile. It does not receive your name, email, or contact details. [OPERATOR TO CONFIRM: check that your Google API plan does not use submitted content to train models.]</li>
          <li><strong>Google sign-in</strong>, if you choose "Continue with Google", shares your name and email with us.</li>
          <li><strong>Your browser's speech service.</strong> When you use dictation, your browser (for example Chrome or Edge) may send your voice to its provider to convert it to text. That happens under the browser maker's terms, not ours.</li>
          <li><strong>OpenStreetMap services</strong> (Overpass and Nominatim) find clinics near a rounded location and match place names you type in "search by area". They do not receive your identity or health information.</li>
          <li><strong>Hosting provider:</strong> [HOSTING PROVIDER AND REGION].</li>
          <li><strong>Analytics</strong> (only if you allow it, public pages only): [ANALYTICS PROVIDER, OR "none"]. It is never loaded inside your account.</li>
          <li><strong>Bot protection</strong> (only if enabled): Cloudflare Turnstile checks that sign-ups come from people.</li>
        </ul>
      </section>

      <section>
        <h2>7. Cookies and similar storage</h2>
        <p>ClinIQ uses your browser's local storage to keep you signed in and to remember your privacy choice. These are essential. We do not use advertising or cross-site tracking cookies. Optional analytics loads only if you opt in, and you can change your choice at any time with "Cookie settings" at the bottom of public pages.</p>
      </section>

      <section>
        <h2>8. How long we keep it</h2>
        <p>We keep your account and cases until you delete your account. When you delete it, your profile and all your cases are removed from ClinIQ, including cases already sent to a clinic. A clinic may have copied information into its own records before that; those copies are governed by the clinic's own policies and the law that applies to it. Backups are overwritten on the provider's normal schedule. [OPERATOR TO CONFIRM ANY LEGAL RETENTION DUTIES]</p>
      </section>

      <section>
        <h2>9. Your choices and rights</h2>
        <ul>
          <li><strong>See and download your data:</strong> Account page, "Download my data".</li>
          <li><strong>Correct it:</strong> edit your health profile, or edit a summary before you confirm it.</li>
          <li><strong>Delete it:</strong> Account page, "Delete your account".</li>
          <li><strong>Withdraw consent</strong> to optional analytics: "Cookie settings".</li>
          <li>Depending on where you live, you may have further rights (for example under India's Digital Personal Data Protection Act, the GDPR, or similar laws), including the right to complain to a regulator. Contact us at <a href={`mailto:${contact()}`}>{contact()}</a>.</li>
          <li>Grievance officer: [NAME], <a href={`mailto:${grievance()}`}>{grievance()}</a>.</li>
        </ul>
      </section>

      <section>
        <h2>10. Security</h2>
        <p>Data is encrypted in transit. Access is limited by role and by the clinic you chose, and enforced in the database. Opening a case, changing its status, and moving it between clinics are recorded. No system is perfectly secure, so please use a strong password and sign out on shared devices.</p>
      </section>

      <section>
        <h2>11. Children</h2>
        <p>ClinIQ is intended for adults. [OPERATOR TO DECIDE: whether a parent or guardian may complete an intake for a child, and any age rules that apply in your country.]</p>
      </section>

      <section>
        <h2>12. Emergencies</h2>
        <p>If you think you or someone else is in danger, call your local emergency number (112 in India and the EU, 911 in the US and Canada) now. Do not wait for an online review.</p>
      </section>

      <section>
        <h2>13. Changes</h2>
        <p>If we change this policy in a way that matters, we will tell you in the app before it takes effect.</p>
      </section>
    </LegalPage>
  )
}
