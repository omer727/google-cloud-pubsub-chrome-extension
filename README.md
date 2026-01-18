## GCP Pub/Sub Message Memory (Chrome Extension)

Saves the last Pub/Sub message body you published via Google Cloud Console and prefills it the next time you open the Publish dialog on the same topic.

### What it does
- Detects the Publish Message modal on Google Cloud Console Pub/Sub topic pages.
- Stores the message body to Chrome local storage when you click Publish.
- Prefills the message body with the last value the next time you open the modal.
- Stores per-topic, with a global fallback.

Example page: [`console.cloud.google.com/cloudpubsub/topic/detail/ActionCompleted?...`](https://console.cloud.google.com/cloudpubsub/topic/detail/ActionCompleted?project=cloudcore-dev&tab=messages&modal=publishmessage)

### Install (Developer Mode)
1. Build steps are not required — this is a plain MV3 extension.
2. Visit `chrome://extensions` in Chrome.
3. Enable Developer mode (top right).
4. Click "Load unpacked" and select this folder: `/Users/omer_s/gcp_chrome_extension`.
5. Navigate to a Pub/Sub topic page in the Google Cloud Console and open the Publish Message modal.

### Files
- `manifest.json` — MV3 manifest, requests `storage` permission and injects the content script on `https://console.cloud.google.com/*`.
- `content-script.js` — Watches for the Publish Message modal, saves on publish, and prefills on open. Handles SPA navigation and modal insertion.

### Notes
- This extension targets the Google Cloud Console UI and uses best-effort selectors. If Google changes the Console markup, selectors may need adjustments.
- Storage is per-topic using a key like `gcp_pubsub_last_message:<topic>`, with a global fallback.


