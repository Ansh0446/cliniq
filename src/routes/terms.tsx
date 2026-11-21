import { createFileRoute, Link } from '@tanstack/react-router'
import { LegalPage, contact, operator } from '@/components/legal'
import { pageHead } from '@/lib/site'

export const Route = createFileRoute('/terms')({
  head: () => pageHead({ title: 'Terms of use', description: 'The rules for using ClinIQ: what it is, what it is not, and what you and clinics agree to.', path: '/terms' }),
  component: Terms,
})

function Terms() {
  return (
    <LegalPage title="Terms of use" updated="[DATE]">
      <section>
        <h2>1. About these terms</h2>
        <p>These terms are an agreement between you and {operator()} ("we") about your use of ClinIQ. By creating an account or using ClinIQ you agree to them and to our <Link to="/privacy">privacy policy</Link>. If you do not agree, please do not use ClinIQ.</p>
      </section>

      <section>
        <h2>2. ClinIQ is not medical advice or an emergency service</h2>
        <ul>
          <li>ClinIQ organises what you tell it so a clinic can read it before your visit. It does not diagnose conditions, prescribe, or recommend treatment.</li>
          <li>Suggested urgency levels come from fixed warning-sign rules and AI. They are a prompt for a clinician to look sooner, not a medical judgement. A level of "routine" does not mean you are safe to wait.</li>
          <li>Sending a case does not guarantee that anyone will read it by a particular time. If you feel seriously unwell, call your local emergency number (112 in India and the EU, 911 in the US and Canada) or go to an emergency department.</li>
          <li>The in-app assistant explains how ClinIQ works and helps you describe your symptoms. It cannot give medical advice, cannot say what symptoms mean, and can make mistakes.</li>
          <li>Using ClinIQ does not by itself create a doctor-patient relationship. That relationship, if any, is between you and the clinic.</li>
        </ul>
      </section>

      <section>
        <h2>3. AI-written summaries</h2>
        <p>Summaries are produced by AI from your words and can contain mistakes or leave things out. You must read the summary, correct anything wrong, and confirm it before it can be sent. By confirming, you say that it correctly describes what you reported.</p>
      </section>

      <section>
        <h2>4. Who can use ClinIQ</h2>
        <p>You must be at least 18, or the age of majority where you live, unless your clinic and the law allow a parent or guardian to act for you. [OPERATOR TO CONFIRM]</p>
      </section>

      <section>
        <h2>5. Your account</h2>
        <ul>
          <li>Give accurate information and keep your sign-in details private. You are responsible for activity under your account.</li>
          <li>Tell us promptly at <a href={`mailto:${contact()}`}>{contact()}</a> if you think someone else has accessed it.</li>
        </ul>
      </section>

      <section>
        <h2>6. What you may not do</h2>
        <ul>
          <li>Give false or misleading information, or use someone else's identity.</li>
          <li>Use ClinIQ to harass anyone, send unlawful or abusive content, or flood clinics with unnecessary cases.</li>
          <li>Try to access other people's data, probe or disrupt the service, scrape it, or bypass its limits or security.</li>
          <li>Use ClinIQ for an emergency.</li>
        </ul>
      </section>

      <section>
        <h2>7. Clinics and clinicians</h2>
        <ul>
          <li>Clinics are independent of us and are responsible for the care they provide and for how they handle information once they receive it.</li>
          <li>A "verified" clinic means we checked that it registered with us. It is not an endorsement of the quality of care.</li>
          <li>Clinic users must be properly licensed where required, use patient information only for care and as the law allows, keep their sign-in private, and add only staff who need access.</li>
        </ul>
      </section>

      <section>
        <h2>8. The service</h2>
        <p>We work to keep ClinIQ available and accurate, but we do not promise that it will be uninterrupted, error-free, or that map and clinic listings are complete or current. Please call a clinic before you travel. We may change or stop features, with notice where we reasonably can.</p>
      </section>

      <section>
        <h2>9. Responsibility</h2>
        <p>Nothing in these terms limits liability that cannot be limited by law. Subject to that, [OPERATOR AND LAWYER TO COMPLETE: limits on liability, and any indemnities].</p>
      </section>

      <section>
        <h2>10. Ending your use</h2>
        <p>You can stop at any time and delete your account from the Account page. We may suspend or close accounts that break these terms or put others at risk.</p>
      </section>

      <section>
        <h2>11. Changes, law and contact</h2>
        <p>We may update these terms and will tell you in the app about changes that matter. These terms are governed by the laws of [JURISDICTION], and the courts of [JURISDICTION] have jurisdiction, subject to any consumer rights you have where you live. Questions: <a href={`mailto:${contact()}`}>{contact()}</a>.</p>
      </section>
    </LegalPage>
  )
}
