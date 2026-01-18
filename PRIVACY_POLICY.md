# Privacy Policy for GCP Pub/Sub Message Memory

**Last Updated:** January 18, 2026

## Overview

GCP Pub/Sub Message Memory is a Chrome extension designed to improve your workflow when publishing messages to Google Cloud Pub/Sub topics. This privacy policy explains what data the extension collects, how it is stored, and how it is used.

## Data Collection and Storage

### What Data We Collect

The extension collects and stores the following data **locally on your device only**:

1. **Pub/Sub Message Bodies**: The content of messages you publish to Pub/Sub topics through the Google Cloud Console
2. **Message Attributes**: Key-value pairs (attributes) that you attach to published messages
3. **Topic Names**: The names of Pub/Sub topics extracted from the Google Cloud Console URLs you visit

### How We Store Your Data

All data is stored **exclusively in your browser's local storage** using Chrome's `chrome.storage.local` API. This means:

- Data never leaves your device
- Data is not transmitted to any external servers
- Data is not shared with any third parties
- Data is not accessible to us (the extension developers)

### Data Retention

Data is stored locally in your browser indefinitely until you:

- Manually clear your browser's extension data
- Uninstall the extension
- Clear Chrome's local storage

## What We Don't Do

- **No Data Transmission**: We do not send any data to external servers or services
- **No Analytics**: We do not collect usage statistics or analytics
- **No Tracking**: We do not track your browsing activity
- **No Third-Party Sharing**: We do not share any data with third parties
- **No Personal Information**: We do not collect any personal information beyond what you enter into Pub/Sub messages

## Permissions Explained

The extension requires the following permissions:

### `storage`
Used to save your last published message and attributes locally in Chrome's storage, allowing the extension to prefill them the next time you publish to the same topic.

### `host_permissions` for `https://console.cloud.google.com/*`
Allows the extension to run only on Google Cloud Console pages where you manage Pub/Sub topics. This permission is required to detect when you open the publish message dialog and to prefill your previous message content.

## Data Security

Since all data is stored locally on your device using Chrome's built-in storage mechanisms, the security of your data depends on:

- The security of your Chrome browser
- The security of your device
- Your browser's security settings

We recommend:

- Keeping Chrome updated to the latest version
- Using strong device authentication
- Being cautious when using the extension on shared or public computers

## Changes to This Privacy Policy

We may update this privacy policy from time to time. Any changes will be reflected in the "Last Updated" date at the top of this policy. Continued use of the extension after changes constitutes acceptance of the updated policy.

## Contact

If you have questions or concerns about this privacy policy, please create an issue on the extension's GitHub repository or contact the developer.

## Your Rights

Since all data is stored locally on your device, you have complete control over your data. You can:

- View your stored data using Chrome's developer tools (inspect `chrome.storage.local`)
- Delete all stored data by uninstalling the extension
- Clear specific data by clearing Chrome's local storage for the extension

## Compliance

This extension:

- Does not collect personal data as defined by GDPR
- Does not transmit data to external servers
- Operates entirely within your browser's local storage
- Does not require user registration or authentication
