# 23. System Integration Specification

This document details how external hardware and third-party software interfaces connect to the Cakes & Candles ERP platform.

---

## 1. Payment Gateway Integration

### A. Razorpay & PhonePe Webhooks
* **Supported Modes**: UPI QR dynamic displays, debit/credit cards processing, net banking.
* **Flow**:
  ```text
  POS submits Checkout Order ➔ Request dynamic QR from gateway API ➔ Render QR on POS Screen
          │
    [Webhook Listener: payment.captured]
          │
  Validate amount matches invoice ➔ Seal POS Order ➔ Print Receipt
  ```
* **Payload example (`payment.captured` webhook)**:
  ```json
  {
    "event": "payment.captured",
    "payload": {
      "payment": {
        "entity": {
          "id": "pay_K1s2t3u4v5",
          "amount": 99750, // Value in paise (INR 997.50)
          "status": "captured",
          "method": "upi",
          "notes": {
            "invoice_id": "i1i2-i3"
          }
        }
      }
    }
  }
  ```

---

## 2. WhatsApp Business Cloud API Integration

### A. Core Workflows
* **Trigger Events**:
  1. `CustomCakeCreated` (Order Booking Receipt template notification).
  2. `CustomCakeStatusChanged` to `READY` (Ready for Pickup template notification).
  3. `CampaignDispatched` (Targeted marketing blasts).

### B. Meta WhatsApp Integration Properties
* **Authentication**: Permanent System User Access Token stored in AWS Systems Manager Parameter Store.
* **DLR Tracking**: Webhook listening to META status events (`sent`, `delivered`, `read`) to write update logs to `communication_log`.

---

## 3. Thermal Printer Integration
* **Hardware Standard**: 80mm POS Thermal printers (e.g. Epson TM-T82 or similar ESC/POS compatible printers).
* **Connection**: WebUSB API or lightweight local print service utility daemon hosted on POS terminals.
* **Auto-Print Rules**:
  - Automatically prints receipt invoice upon checkout completion (`InvoiceCreated` event).
  - reprint logic locked under cashier validation checks; logged as "REPRINT" watermark on footer receipts to prevent billing fraud.

---

## 4. Barcode Scanner Integration
* **Hardware**: USB/Bluetooth HID Barcode Scanners (configured to send a carriage return `\n` suffix upon scan) or camera-based WebRTC scanners on mobile devices.
* **Format Standards**:
  - EAN-13 barcodes for packaged materials (e.g. Breads, Buns).
  - Custom internal SKUs generated for central kitchen batches.
* **POS Action**: Scanning an item automatically inputs SKU to the POS register search and increments quantity in the active cart.

---

## 5. SMS Gateway Integration
* **Provider**: Twilio or local SMS route providers (e.g. MSG91).
* **Triggers**:
  - `UserLoginRequest` (Generates a 6-digit OTP code).
  - `InvoiceCreated` (Sends basic short-link invoice summary when WhatsApp delivery fails).

---

## 6. Future ERP & Financial Integrations (Phase 3)
* **Zoho Books / Tally Prime**: Dynamic ledger exports.
  - Automatically runs nightly balance reconciliations and builds XML/CSV journal logs matching Tally standard imports.
* **GST API Portal**:
  - Integrates with GST portal to auto-submit e-invoice registries for purchases exceeding statutory thresholds.
