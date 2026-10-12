# Razorpay and Shiprocket account setup

The application code can be tested locally without merchant accounts, but real payments and courier bookings require merchant credentials. Do not use placeholder keys in production.

## Razorpay

Set these **backend** environment variables using a matching pair of Razorpay test keys first, then live keys after account approval:

```text
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

The frontend obtains the public Key ID from the backend payment order response. No `VITE_RAZORPAY_KEY_ID` is required. Set the Razorpay webhook URL to `https://YOUR_BACKEND_HOST/api/payments/webhook/razorpay` and subscribe to `payment.captured`, `payment.failed`, and `order.paid`. Use the same webhook secret in Razorpay and the backend. Enable automatic payment capture in the Razorpay dashboard. Run a complete test payment and failed payment/retry in test mode before switching to live keys.

If the backend key pair is absent or rejected, online payment cannot start. Existing unpaid orders can be retried from their order detail page after valid credentials are configured.
Until Razorpay test keys are available, the admin setting `onlineEnabled` can be turned off so customers see only Cash on Delivery.

## Shiprocket

Set these backend variables after creating a Shiprocket API user and registered pickup location:

```text
SHIPROCKET_EMAIL=
SHIPROCKET_PASSWORD=
SHIPROCKET_PICKUP_LOCATION=Primary
SHIPROCKET_WEBHOOK_TOKEN=
SHIPROCKET_CONTACT_EMAIL=
SHIPROCKET_DEFAULT_ITEM_WEIGHT_KG=0.5
SHIPROCKET_PACKAGE_LENGTH_CM=10
SHIPROCKET_PACKAGE_BREADTH_CM=10
SHIPROCKET_PACKAGE_HEIGHT_CM=10
```

Configure the Shiprocket webhook URL as `https://YOUR_BACKEND_HOST/api/shipping/webhook/courier`. Shiprocket requires a security token supplied in the `x-api-key` header; set the same token in `SHIPROCKET_WEBHOOK_TOKEN`. The URL intentionally avoids the word “shiprocket”, per Shiprocket's webhook rules. The backend rejects webhook calls until the token is configured. Keep this token secret.

The pickup location value must exactly match the nickname registered in Shiprocket. If sellers ship from different locations, register and configure the operational pickup arrangement before creating their courier shipments. Admin must process a Shiprocket order to create a shipment/AWB, then schedule pickup and generate the label. Without Shiprocket credentials, local development can simulate these actions; production rejects them and does not create a fake AWB.

`SHIPROCKET_CONTACT_EMAIL` is used only when the customer account has no email address. Product weights such as `500 g` and `1 kg` are read from the product catalog; the default item weight and parcel dimensions above cover products without shipping metadata. Confirm these values against the actual packed parcel before live dispatch, because Shiprocket rates and courier acceptance depend on them.

For a live smoke test: place one order with both seller and customer in active local pincodes and confirm rider assignment; place one with either side outside and confirm no rider broadcast; complete payment (or COD), then create the Shiprocket shipment, verify AWB/pickup/label, and send an authenticated status webhook. Never use a real customer order for a test webhook.
