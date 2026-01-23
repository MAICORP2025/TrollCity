import React from 'react'
import LegalLayout from '../../components/LegalLayout'

export default function PayoutPolicy() {
  return (
    <LegalLayout>
      <article className="prose prose-invert max-w-none prose-headings:text-slate-50 prose-a:text-purple-300 prose-strong:text-slate-100">
        <p className="text-xs uppercase tracking-[0.15em] text-purple-300">
          Legal
        </p>
        <h1 className="mb-2 text-2xl font-bold tracking-tight">
          Creator & Payout Policy
        </h1>
        <p className="text-xs text-slate-400 mb-6">
          Last updated: January 2025
        </p>

        <h2>1. Eligibility for Payouts</h2>
        <p>
          To be eligible for payouts, you must meet all of the following requirements:
        </p>
        <ul>
          <li>Hold at least <strong>7,000 troll_coins</strong> in your account</li>
          <li>Complete identity verification (KYC/ID check)</li>
          <li>Submit required tax forms (W-9 for US users, or equivalent for international)</li>
          <li>Have a verified email address on file</li>
          <li>Have no active bans, suspensions, or fraud flags</li>
          <li>Have no pending chargebacks or payment disputes</li>
        </ul>

        <h2>2. Payout Process</h2>
        <p>
          Payouts and cashouts are currently disabled. You may continue to earn and
          use troll_coins inside Troll City, but you cannot convert them to cash or
          gift cards at this time.
        </p>

        <h2>3. Conversion Rate</h2>
        <p>
          Current conversion rate: <strong>100 troll_coins = $1.00 USD</strong>
        </p>
        <p>
          This rate may be adjusted at any time. You will be notified of rate changes
          before they take effect. The rate at the time of your request submission
          will be honored.
        </p>

        <h2>4. Minimum and Maximum Payouts</h2>
        <p>
          Because payouts are disabled, minimums, maximums, and payout frequencies
          are not currently applicable. If payouts are re-enabled in the future,
          updated limits and requirements will be published here.
        </p>

        <h2>5. Tax Obligations</h2>
        <p>
          <strong>US Users:</strong> If you receive $600 or more in payouts in a
          calendar year, we are required to collect a W-9 form and may issue a
          1099-NEC or 1099-K form for tax reporting purposes.
        </p>
        <p>
          <strong>International Users:</strong> You are responsible for reporting
          and paying any taxes required by your local jurisdiction. We may request
          tax documentation as required by law.
        </p>
        <p>
          <strong>Important:</strong> Payouts may be delayed or denied if required
          tax forms are not submitted and approved.
        </p>

        <h2>6. Payout Denials</h2>
        <p>
          Payout requests may be denied for the following reasons:
        </p>
        <ul>
          <li>Insufficient Paid Coin balance</li>
          <li>Incomplete identity verification</li>
          <li>Missing or unapproved tax forms</li>
          <li>Active account restrictions (bans, suspensions)</li>
          <li>Suspected fraud or chargeback history</li>
          <li>Violation of Terms of Service</li>
          <li>PayPal account issues or restrictions</li>
        </ul>
        <p>
          If your payout is denied, you will receive a notification with the reason.
          You may address the issue and resubmit your request.
        </p>

        <h2>7. Processing Fees</h2>
        <p>
          Because payouts are disabled, no payout processing fees are charged. If
          payouts return in the future, details about any applicable fees will be
          updated in this section.
        </p>

        <h2>8. Payment Method</h2>
        <p>
          Payouts, including gift card payouts, are currently unavailable. If payout
          methods are reintroduced, the supported options and requirements will be
          documented here.
        </p>

        <h2>9. Payout Timeline</h2>
        <p>
          There is no payout processing timeline while payouts are disabled. Any
          future payout program will include updated processing expectations.
        </p>

        <h2>10. Disputes and Appeals</h2>
        <p>
          If you disagree with a payout denial or have questions about your payout
          status, contact support through the in-app support system. Include your
          payout request ID and any relevant documentation.
        </p>
      </article>
    </LegalLayout>
  )
}

