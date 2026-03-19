export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-text-primary mb-2">Privacy Policy</h1>
      <p className="text-text-tertiary text-sm mb-8">Last updated: March 17, 2026</p>

      <div className="space-y-8 text-text-secondary text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">1. Information We Collect</h2>
          <p className="mb-3">
            QRSTKR (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects information you provide directly when using our service, including:
          </p>
          <p className="mb-2"><strong className="text-text-primary">Account Information:</strong> Email address, display name, and authentication credentials when you create an account.</p>
          <p className="mb-2"><strong className="text-text-primary">Item Information:</strong> Details about items you register (make, model, year, nickname, photos, maintenance records).</p>
          <p className="mb-2"><strong className="text-text-primary">Shop Information:</strong> Business name, address, phone number, email, website, and service categories for registered shops.</p>
          <p className="mb-2"><strong className="text-text-primary">Phone Numbers:</strong> We may collect and verify phone numbers for shop verification purposes. Verification codes are sent via SMS to confirm business ownership.</p>
          <p className="mb-2"><strong className="text-text-primary">Order Information:</strong> Shipping address and order details when purchasing stickers.</p>
          <p><strong className="text-text-primary">Usage Data:</strong> Standard server logs including IP addresses, browser type, and pages visited.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">2. How We Use Your Information</h2>
          <p className="mb-2">We use your information to provide and improve the QRSTKR service, including to create and maintain your account, process sticker orders, display item information to authorized viewers, facilitate shop verification and service record submissions, send transactional communications (order confirmations, verification codes, service notifications), and prevent fraud and abuse.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">3. SMS and Phone Communications</h2>
          <p className="mb-2">We use SMS messaging solely for shop verification purposes. When a shop registers, we may send a one-time verification code via SMS to the phone number associated with the business listing. We do not send marketing messages via SMS. Message and data rates may apply. You will receive at most one SMS message per verification attempt.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">4. Information Sharing</h2>
          <p className="mb-2">We do not sell your personal information. We share information only in the following circumstances:</p>
          <p className="mb-2"><strong className="text-text-primary">Public Item Pages:</strong> Item details (make, model, year, photos, maintenance history) are visible to anyone who scans the QR sticker. Contact information is only shown if you opt in.</p>
          <p className="mb-2"><strong className="text-text-primary">Shop Records:</strong> Service records submitted by shops are visible to the item owner.</p>
          <p className="mb-2"><strong className="text-text-primary">Service Providers:</strong> We use third-party services including Supabase (database and authentication), Vercel (hosting), Google Maps Platform (business verification), and Twilio (SMS verification). These providers process data as necessary to provide their services.</p>
          <p><strong className="text-text-primary">Legal Requirements:</strong> We may disclose information if required by law or to protect our rights and safety.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">5. Data Security</h2>
          <p>We use industry-standard security measures including encrypted connections (HTTPS), row-level security policies on our database, and secure authentication. However, no method of transmission over the internet is 100% secure.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">6. Data Retention</h2>
          <p>We retain your account and item data for as long as your account is active. You may request deletion of your account and associated data by contacting us. Maintenance records associated with items may be retained as part of the item&rsquo;s provenance history even after account deletion.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">7. Your Rights</h2>
          <p>You may access, update, or delete your account information at any time through your account settings. To request a complete data export or deletion, contact us at the email below.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">8. Changes to This Policy</h2>
          <p>We may update this policy from time to time. We will notify registered users of material changes via email or in-app notification.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">9. Contact Us</h2>
          <p>Questions about this privacy policy? Contact us at <a href="mailto:privacy@qrstkr.com" className="text-accent hover:underline">privacy@qrstkr.com</a>.</p>
        </section>
      </div>
    </div>
  )
}
