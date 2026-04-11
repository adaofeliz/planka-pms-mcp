# Apple Shortcuts Integration

## Overview

This guide explains how to build two Apple Shortcuts for capturing tasks into your Planka INBOX. These shortcuts allow you to bypass the web UI for rapid entry from any Apple device.

The first shortcut, Send to Planka, works through the system share sheet. It handles URLs and text from apps like Safari or Notes. When you share a link, it can use Apple Intelligence to summarize the page for a richer card name.

Quick Inbox is the second shortcut, providing a fast entry popup. You can trigger it via a widget, the Action Button, or a keyboard shortcut. It's designed for those moments when you need to get a thought out of your head and into your system immediately.

## Prerequisites

Before you begin, ensure you have the following information:

- Your Planka instance base URL.
- An API key. Generate this in the Planka UI or via the admin API.
- The list ID for your INBOX. Find this by calling `GET /api/boards/:boardId` and looking for the list named INBOX in the `included.lists` array. You can also find it in the URL when you click on the INBOX list in the web UI.
- A device running iOS 18+ or macOS 15+ if you want to use Apple Intelligence features. The basic shortcuts work on iOS 16+ and macOS 13+.

## Configuration

Store your credentials in a way that makes them easy to reuse. You can use a Dictionary action at the start of each shortcut or save them in a separate shortcut that returns a dictionary.

Key variables to define:
- `PLANKA_BASE_URL`: The full URL to your instance.
- `PLANKA_API_KEY`: Your secret API key.
- `INBOX_LIST_ID`: The unique ID of your INBOX list.

## Shortcut 1: Send to Planka (Share Sheet)

This shortcut appears in the share menu of other apps.

1. Create a new shortcut named Send to Planka.
2. Open the shortcut settings and enable Show in Share Sheet.
3. Set the accepted types to URLs, Text, Articles, and Safari Web Pages.
4. Add an If action to check the Shortcut Input.
5. When the input is a URL:
   - Add a Get Article from Web Page action.
   - Add a Summarize action (requires iOS 18.1+ for Apple Intelligence) to create a brief title.
   - Set the card name to the summary and the card description to the original URL.
6. If the input is Text:
   - Set the card name to the input text.
7. Add a Get Contents of URL action.
8. Configure the action:
   - URL: `{PLANKA_BASE_URL}/api/lists/{INBOX_LIST_ID}/cards`
   - Method: POST
   - Headers: Add `Content-Type: application/json` and `X-Api-Key: {PLANKA_API_KEY}`.
   - Request Body: Select JSON and add three fields. Set `type` to `project`, `name` to your card name variable, and `description` to your description variable.
9. Use a Show Notification action to confirm the card was created.

Apple Intelligence can help here. Add a Summarize action before the API call to generate a concise card name from long articles or web pages.

## Shortcut 2: Quick Inbox (Popup Input)

Use this shortcut for manual entry when you aren't sharing from another app.

1. Create a new shortcut named Quick Inbox.
2. Add an Ask for Input action. Set the prompt to "What's on your mind?" and the type to Text.
3. Add a Get Contents of URL action.
4. Configure the action:
   - URL: `{PLANKA_BASE_URL}/api/lists/{INBOX_LIST_ID}/cards`
   - Method: POST
   - Headers: Add `Content-Type: application/json` and `X-Api-Key: {PLANKA_API_KEY}`.
   - Request Body: Select JSON. Add `type` as `project` and `name` as the Provided Input from the previous step.
5. Finish with a Show Notification action.

For faster access, add this shortcut to your Home Screen as a widget. If you have an iPhone with an Action Button, you can map this shortcut to it. On macOS, you can assign a global keyboard shortcut in the shortcut settings. Siri can also trigger the shortcut if you say "Hey Siri, Quick Inbox".

## Advanced Tips

### Adding Labels
The card creation API doesn't support adding labels in the same request. To add a label, you must make a second API call. Use `POST /api/cards/:cardId/card-labels` with a JSON body of `{ "labelId": "your-label-id" }`. You can get the card ID from the response of the first call.

### Finding Label IDs
Call `GET /api/boards/:boardId` to see all available labels. Look in the `included.labels` section of the response.

### Markdown Support
The card description field supports standard Markdown. You can use this in your shortcuts to format links or lists within the card.

### Error Handling
Check the status code of the API response. If it starts with 2, show a success message. Any other code should trigger an error notification with the response body to help with debugging.

### Automations
You can trigger the Quick Inbox shortcut based on time of day or location. For example, set an automation to run it every morning at 8 AM to prompt for your daily goals.

## API Reference Quick Card

```
POST /api/lists/{listId}/cards
Headers: 
  X-Api-Key: {key}
  Content-Type: application/json
Body: 
  { 
    "type": "project", 
    "name": "Card title", 
    "description": "Optional description" 
  }
Response: 
  { 
    "item": { "id": "...", "name": "...", ... } 
  }
```

## Troubleshooting

If the shortcut fails, check your INBOX list ID first. A common mistake is using the board ID instead of the list ID.

Ensure your API key hasn't expired. If you self-host Planka with a self-signed certificate, the Shortcuts app might block the request. You can fix this by installing the certificate on your device or using a valid Let's Encrypt certificate.

Use the Quick Look action after the Get Contents of URL action to see the full API response. This is the best way to find out why a request failed.
