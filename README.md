# Navi — Personal Life Admin Agent

> **Amazon Nova AI Hackathon Project** | [Devpost](https://amazon-nova.devpost.com) | Deadline: Mar 16, 2026

Navi is a **Personal Life Admin Agent** powered by **Amazon Nova** that helps users manage everyday tasks—scheduling appointments, setting reminders, and organizing important documents—through natural conversation.

## Overview

Navi uses Amazon Nova's reasoning capabilities to act as an intelligent personal assistant. Tell Navi what you need in plain language, and it will help you stay on top of your life admin.

### Features (Planned)

- **Scheduling** — Create and manage calendar events and appointments
- **Reminders** — Set and track reminders for tasks and deadlines
- **Document organization** — Organize, categorize, and find important documents
- **Natural conversation** — Interact via chat using everyday language

---

## Tech Stack

Built with **JavaScript/TypeScript**. Core components:

| Component       | Technology |
|----------------|------------|
| Runtime        | Node.js 20+ |
| Language       | TypeScript |
| AI / Agent     | Amazon Bedrock + Nova 2 Lite |
| Agent framework| LangChain.js + @langchain/aws |
| Nova model     | `amazon.nova-2-lite-v1:0` (via Bedrock Converse API) |
| Tools protocol | MCP (Model Context Protocol) supported by hackathon |
| API / UI       | Next.js 14 (App Router) |

### Why This Stack?

- **Amazon Nova 2 Lite** — Fast, cost-effective reasoning model for everyday tasks ([AWS docs](https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html))
- **LangChain.js** — Hackathon-recommended framework for agentic AI; integrates with Bedrock and supports tool use
- **Bedrock Converse API** — Provides tool use (function calling), streaming, and document understanding
- **MCP** — Optional Model Context Protocol for extending tools (hackathon-supported)

---

## Amazon Nova Integration

Navi uses **Amazon Nova** through **Amazon Bedrock**:

1. **Nova 2 Lite** — Primary model for reasoning, scheduling, reminders, and document handling
2. **Nova 2 Multimodal Embeddings** (optional) — For richer document understanding and retrieval (`amazon.nova-2-multimodal-embeddings-v1:0`)
3. **Nova 2 Sonic** (optional) — For future voice AI features

### Resources

- [Amazon Nova 2 Developer Guide](https://docs.aws.amazon.com/nova/latest/userguide/)
- [Amazon Nova in Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/service_code_examples_bedrock-runtime_amazon_nova.html)
- [LangChain.js Bedrock Integration](https://js.langchain.com/v0.1/docs/integrations/chat/bedrock/)
- [AWS Sample: LangChain.js Stream Agent](https://github.com/aws-samples/langchain-agents/tree/main/bedrock/langchain-js-stream-agent)

---

## Prerequisites

- **Node.js** 20.x or later
- **AWS Account** with Bedrock access
- **AWS credentials** (AWS CLI profile or environment variables)

### Model access

Serverless foundation models like Amazon Nova 2 Lite are **automatically enabled** when you first invoke them in Bedrock. No manual activation needed—just call the Converse API or use the [model playground](https://console.aws.amazon.com/bedrock/) and the model will be enabled on first use.

---

## Getting Started

```bash
# Install dependencies
npm install

# Configure environment (create .env from .env.example)
cp .env.example .env

# Run development server
npm run dev
```

### Environment Variables

Create a `.env` file (see `.env.example`):

```env
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=amazon.nova-2-lite-v1:0
```

---

## Project Structure

```
navi/
├── app/
│   ├── api/chat/     # POST /api/chat — Nova conversation
│   ├── layout.tsx    # Root layout
│   └── page.tsx     # Chat UI
├── lib/
│   └── bedrock.ts    # Bedrock client & chat()
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
