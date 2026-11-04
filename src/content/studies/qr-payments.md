---
title: QR payments and receipt feedback
order: 1
kicker: Feature study · OctoMobile
summary: Payment feedback that stays clear whether the customer is watching the screen, has switched apps, or returns from a notification.
product: OctoMobile, a native Android mobile-banking application.
context: Customers pay merchants with QR codes, either by scanning a merchant's code or by presenting their own code at the counter. A payment's result is decided outside the phone and can arrive after the customer has looked away.
userTask: Pay with a QR code and know, without guessing, whether the payment went through.
contribution: I built the UI and integration on the Android client for QR payment flows, including QR code generation and the receipt and summary shown from push notifications.
teamBoundary: This was team work on a shared product. The study describes my implementation work on the Android client only, not product, backend or design ownership.
responsibilities:
  - Payment with QRIS and cross-border QR, in merchant-presented and customer-presented modes.
  - Generating QR codes to receive money, send money, and pay as a customer-presented code.
  - QRIS Tap and QRIS Transfer flows.
  - Receipt and summary screens for customer-presented QR payments, opened from push notifications.
technologies:
  - Kotlin
  - Native Android
  - VIPER architecture
  - Push notifications
walkthrough: qr
diagram:
  src: diagrams/qr-feedback.svg
  alt: Diagram with three lanes — app in foreground, app in background, app closed — each ending at the same receipt screen. The foreground lane updates the open screen; the other two lanes reach the receipt by tapping a notification.
  caption: Original explanatory diagram. One payment result, three ways the customer can be when it arrives, one receipt.
---

## The problem

A QR payment is a conversation between two parties who are not looking at the same screen. When the customer presents a code, the merchant scans it on their own device, and the result is confirmed by systems outside the phone. From the customer's side, the moment of truth arrives *later* — sometimes seconds later, sometimes after they have pocketed the phone.

That makes the feedback, not the code itself, the hard part of the feature. A customer who is unsure whether they paid may pay twice, or walk away from a purchase they actually completed.

## Feedback across application states

The result has to make sense in each state the app can be in when it arrives:

- **Foreground, on the payment screen.** The open screen moves from waiting to the outcome directly.
- **Background, or on another screen.** A push notification carries the result, and opening it leads to the receipt.
- **Not running.** The notification is still the entry point, and the receipt must open correctly from a cold start.

The diagram above shows these three paths converging on one receipt presentation, so that the customer sees the same confirmation however they got there.

## Receipts and summaries

The receipt is the customer's evidence. For customer-presented payments I implemented the receipt and summary screens that open from push notifications, so the confirmation is available even when the customer was not watching the app at the moment the payment completed.

## Related work in the same area

Beyond the core flow, my QR work on OctoMobile covered merchant-presented and customer-presented payments, cross-border QR, QRIS Tap, QRIS Transfer, and generating QR codes to receive and send money.

*Screens on this page are original illustrations with synthetic data. They explain the concepts and do not reproduce the production application.*
