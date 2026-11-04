---
title: QRIS Tap — paying with a tap
order: 3
kicker: Feature study · OctoMobile
summary: Contactless QRIS payments where the phone talks to the merchant's reader over NFC, with feedback the customer can trust after a few seconds of tapping.
product: OctoMobile, a native Android mobile-banking application.
context: QRIS Tap lets a customer pay by holding their phone near a merchant's reader instead of showing or scanning a code. The phone exchanges the payment over NFC, and the result is decided outside the phone.
userTask: Pay at the counter with a quick tap, and know whether the payment went through.
contribution: I built UI and integration on the Android client for QRIS Tap payments.
teamBoundary: This was team work on a shared product. The study describes my implementation work on the Android client only, not product, backend or design ownership.
responsibilities:
  - UI and integration for the QRIS Tap payment flow on the Android client.
  - Part of the wider customer-presented QR payment work described in the QR payments study.
technologies:
  - Kotlin
  - Native Android
  - VIPER architecture
  - NFC
walkthrough: tap
diagram:
  src: diagrams/tap-flow.svg
  alt: Flow diagram — Ready to tap, then Tap the reader over NFC with no code shown, then a result decided off-device, then a receipt shared with other QR payments.
  caption: Original explanatory diagram. A tap replaces showing a code; the feedback after it works like any QR payment.
---

## The problem

Tapping is the fastest way to pay, and also the easiest to get wrong. The interaction lasts a moment, the phone has to stay close to the reader, and for most of that moment the customer is looking at the reader rather than at their screen.

That shifts the job of the interface to the moments around the tap: getting the customer ready before it, keeping them informed while the phone is near the reader, and giving an unmistakable answer once they look back at the screen.

## What the feature has to handle

- **Before the tap.** The customer needs to know which account will pay and that the phone is ready to tap, before they reach the counter.
- **During the tap.** The phone may be moved away too early. The screen has to make it obvious that holding still matters, and what to do if the tap did not complete.
- **After the tap.** The result is decided outside the phone. The customer looks back at the screen and needs a clear answer and a receipt, as with any other QR payment.

## How it relates to the other QR work

QRIS Tap sits next to the customer-presented QR flows in the [QR payments study](../qr-payments/). The difference is how the payment reaches the merchant — a tap instead of a code on screen — while the need for clear payment feedback stays the same.

*Screens on this page are original illustrations with synthetic data. They explain the concepts and do not reproduce the production application.*
