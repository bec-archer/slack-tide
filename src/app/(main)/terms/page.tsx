export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-text-primary mb-2">Terms and Conditions</h1>
      <p className="text-text-tertiary text-sm mb-8">Last updated: March 17, 2026</p>

      <div className="space-y-8 text-text-secondary text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">1. Acceptance of Terms</h2>
          <p>By accessing or using QRSTKR (&ldquo;the Service&rdquo;), you agree to be bound by these Terms and Conditions. If you do not agree, do not use the Service.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">2. Description of Service</h2>
          <p>QRSTKR provides QR code-based stickers for tracking ownership, maintenance history, and provenance of physical items. The Service includes item registration, maintenance record management, shop verification, and related features.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">3. User Accounts</h2>
          <p className="mb-2">You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You must provide accurate information when creating an account and keep it up to date.</p>
          <p>You must be at least 18 years old to create an account.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">4. Item Registration and Ownership</h2>
          <p className="mb-2">By registering an item, you represent that you are the lawful owner or authorized representative of the item. QRSTKR does not verify ownership claims and is not responsible for disputes regarding item ownership.</p>
          <p>Maintenance records are part of an item&rsquo;s history and may persist through ownership transfers.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">5. Shop Accounts</h2>
          <p className="mb-2">Shops that register on QRSTKR represent that they are legitimate businesses authorized to provide the services they claim. Shop verification through Google Business Profile and phone verification does not constitute an endorsement by QRSTKR.</p>
          <p className="mb-2">Shops may submit maintenance records on behalf of item owners. Item owners may dispute any record they believe is inaccurate.</p>
          <p>By registering a shop, you consent to receiving a one-time SMS verification code to the phone number associated with your business listing. Standard message and data rates may apply.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">6. Acceptable Use</h2>
          <p className="mb-2">You agree not to use the Service to submit false or misleading information, impersonate another person or business, submit fraudulent maintenance records, attempt to gain unauthorized access to other users&rsquo; accounts, use the Service for any illegal purpose, or interfere with the operation of the Service.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">7. Intellectual Property</h2>
          <p>The QRSTKR name, logo, and Service design are the property of QRSTKR. You retain ownership of content you submit (item descriptions, photos, etc.) but grant us a license to display and process it as part of the Service.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">8. Disclaimers</h2>
          <p className="mb-2">The Service is provided &ldquo;as is&rdquo; without warranties of any kind. QRSTKR does not guarantee the accuracy of information submitted by users or shops.</p>
          <p>QRSTKR is not responsible for the quality of services performed by registered shops. Shop verification confirms only that a business exists, not the quality of their work.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">9. Limitation of Liability</h2>
          <p>To the fullest extent permitted by law, QRSTKR shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">10. Termination</h2>
          <p>We may suspend or terminate your account at any time for violations of these terms. You may delete your account at any time through your account settings.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">11. Changes to Terms</h2>
          <p>We may update these terms from time to time. Continued use of the Service after changes constitutes acceptance of the updated terms.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">12. Governing Law</h2>
          <p>These terms are governed by the laws of the State of Florida, without regard to conflict of law principles.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">13. Contact</h2>
          <p>Questions about these terms? Contact us at <a href="mailto:legal@qrstkr.com" className="text-accent hover:underline">legal@qrstkr.com</a>.</p>
        </section>
      </div>
    </div>
  )
}
