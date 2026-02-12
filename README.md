# Navi — Personal Life Admin Agent

> **Amazon Nova AI Hackathon Project** | [Devpost](https://amazon-nova.devpost.com) | Deadline: Mar 16, 2026

Navi is a **Personal Life Admin Agent** powered by **Amazon Nova** that helps users manage everyday tasks—scheduling appointments, setting reminders, and organizing important documents—through natural conversation.

## Overview

Navi uses Amazon Nova's reasoning capabilities to act as an intelligent personal assistant. Tell Navi what you need in plain language, and it will help you stay on top of your life admin.

### Features

- **Reminders** — Create reminders with the `create_reminder` tool (stored in session)
- **Natural conversation** — Chat with formatted Markdown (headings, lists, links)
- **Apple Calendar** — Sync reminders to iCloud via CalDAV (visible on iPhone with notifications)
  - Calendar groups: Family, Work, Home, Personal (e.g. "put in my Work calendar")
  - iPhone notifications: default 15 min before; customizable (e.g. "remind me at 9:30" or "30 min before")
- **Document organization** (planned) — Organize and find important documents

---

## Tech Stack

Built with **JavaScript/TypeScript**. Core components:

| Component       | Technology |
|----------------|------------|
| Runtime        | Node.js 20+ |
| Language       | TypeScript |
| AI / Agent     | Amazon Bedrock + Nova 2 Lite |
| SDK            | @aws-sdk/client-bedrock-runtime (Converse API) |
| Nova model     | `us.amazon.nova-2-lite-v1:0` (inference profile) |
| Calendar       | tsdav (iCloud CalDAV) |
| API / UI       | Next.js 14 (App Router) |

### Why This Stack?

- **Amazon Nova 2 Lite** — Fast, cost-effective reasoning model for everyday tasks ([AWS docs](https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html))
- **Bedrock Converse API** — Tool use (function calling), streaming, and document understanding
- **iCloud CalDAV (tsdav)** — Sync reminders to Apple Calendar; events appear on iPhone with optional notifications

---

## Amazon Nova Integration

Navi uses **Amazon Nova** through **Amazon Bedrock**:

1. **Nova 2 Lite** — Primary model for reasoning, scheduling, reminders, and document handling
2. **Nova 2 Multimodal Embeddings** (optional) — For richer document understanding and retrieval (`amazon.nova-2-multimodal-embeddings-v1:0`)
3. **Nova 2 Sonic** (optional) — For future voice AI features

### Resources

- [Amazon Nova 2 Developer Guide](https://docs.aws.amazon.com/nova/latest/userguide/)
- [Amazon Nova in Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/service_code_examples_bedrock-runtime_amazon_nova.html)
- [Bedrock Converse API](https://docs.aws.amazon.com/bedrock/latest/userguide/converse.html) — tool use, streaming, structured output

---

## Prerequisites

- **Node.js** 18.x or later (20+ recommended)
- **AWS Account** with Bedrock access
- **AWS credentials** — required for the app to call Amazon Nova

### Model access

Serverless foundation models like Amazon Nova 2 Lite are **automatically enabled** when you first invoke them in Bedrock. No manual activation needed—just call the Converse API and the model will be enabled on first use.

---

## Getting Started

```bash
# Install dependencies
npm install

# Configure environment (create .env from .env.example)
cp .env.example .env

# Add your AWS credentials to .env (see below)
# Then run the dev server:
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to chat with Navi.

### AWS Credentials

You need valid AWS credentials so the app can call Amazon Bedrock. Choose one option:

**Option A: Environment variables (recommended for local dev)**

1. Create an access key in [IAM](https://console.aws.amazon.com/iam/) → Users → your user → Security credentials → Access keys.
2. Copy `.env.example` to `.env` and fill in:

```env
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=us.amazon.nova-2-lite-v1:0
```

> **Note:** Use the inference profile ID `us.amazon.nova-2-lite-v1:0` (not the direct model ID). Nova 2 Lite requires inference profiles for on-demand invocation.

**Option B: AWS CLI profile**

Run `aws configure` and enter your access key, secret key, and region. The app will use the default profile. To use a named profile, add `AWS_PROFILE=your-profile` to `.env`.

**Required IAM permission**

Your user needs `bedrock:InvokeModel` for the Nova model. Example policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "bedrock:InvokeModel",
    "Resource": "arn:aws:bedrock:*::foundation-model/amazon.nova-2-lite-v1:0"
  }]
}
```

---

## Apple Calendar (iCloud) Integration

To sync reminders to your iPhone’s Calendar via iCloud:

### 1. Create an app-specific password

1. Go to [account.apple.com](https://account.apple.com) and sign in
2. Open **Sign-In and Security** → **App-Specific Passwords**
3. Click **Generate an app-specific password**
4. Name it "Navi" (or similar) and copy the 16-character password

Your Apple ID must have two-factor authentication enabled.

### 2. Add to `.env`

```env
APPLE_ID=your_icloud_email@icloud.com
APPLE_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

Use your iCloud email and the app-specific password (not your main Apple ID password).

### 3. Restart the dev server

Reminders you create through Navi will be added to your iCloud calendar and sync to your iPhone.

### Calendar options

You can tell Navi which calendar to use:
- **Family** / **Work** / **Home** / **Personal** — e.g. "put this in my Work calendar" or "add to Family"
- Events appear with your calendar’s color on your iPhone (Family = yellow, etc.)

### iPhone notifications

Each event gets a notification by default (**15 minutes before**). You can say:
- "Remind me at 9:30" → notification at the event time
- "Remind me 30 minutes before" → notification 30 min before

---

## Project Structure

```
navi/
├── app/
│   ├── api/chat/     # POST /api/chat — Nova conversation
│   ├── layout.tsx    # Root layout
│   └── page.tsx     # Chat UI
├── lib/
│   ├── bedrock.ts    # Bedrock client & chat()
│   └── appleCalendar.ts  # iCloud CalDAV integration
├── package.json
├── tsconfig.json
└── README.md
```

---

## Hackathon Category

**Agentic AI** — Solutions where agents use Amazon Nova reasoning to tackle complex, real-world problems.

---

## License

MIT
