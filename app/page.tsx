"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm Navi, your Personal Life Admin. I can help with scheduling, reminders, and your calendar. Try **\"What do I have today?\"** or ask me to set a reminder—I'll sync it to your iPhone. What would you like to do?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const allMessages = [...messages, userMessage];
      // Bedrock Converse API requires the conversation to start with a user message
      const fromFirstUser = allMessages.slice(
        allMessages.findIndex((m) => m.role === "user")
      );
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: fromFirstUser.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to get response");
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            err instanceof Error
              ? `Sorry, something went wrong: ${err.message}`
              : "Sorry, something went wrong.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      role="application"
      aria-label="Navi chat"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        color: "#f1f5f9",
      }}
    >
      <header
        role="banner"
        style={{
          padding: "1rem 2rem",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          textAlign: "center",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600 }}>
          Navi
        </h1>
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", opacity: 0.7 }}>
          Personal Life Admin — powered by Amazon Nova
        </p>
      </header>

      <main
        style={{
          flex: 1,
          maxWidth: "42rem",
          margin: "0 auto",
          width: "100%",
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          role="log"
          aria-live="polite"
          aria-label="Chat messages"
          style={{
            flex: 1,
            overflowY: "auto",
            marginBottom: "1rem",
          }}
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                marginBottom: "1rem",
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "85%",
                  padding: "0.75rem 1rem",
                  borderRadius: "1rem",
                  background:
                    msg.role === "user"
                      ? "rgba(59, 130, 246, 0.3)"
                      : "rgba(51, 65, 85, 0.8)",
                  border:
                    msg.role === "user"
                      ? "1px solid rgba(59, 130, 246, 0.4)"
                      : "1px solid rgba(255,255,255,0.08)",
                  lineHeight: 1.6,
                }}
              >
                {msg.role === "user" ? (
                  msg.content
                ) : (
                  <ReactMarkdown
                    components={{
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "#60a5fa", textDecoration: "underline" }}
                        >
                          {children}
                        </a>
                      ),
                      ul: ({ children }) => (
                        <ul style={{ margin: "0.5rem 0", paddingLeft: "1.25rem" }}>
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol style={{ margin: "0.5rem 0", paddingLeft: "1.25rem" }}>
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => (
                        <li style={{ marginBottom: "0.25rem" }}>{children}</li>
                      ),
                      strong: ({ children }) => (
                        <strong style={{ fontWeight: 600 }}>{children}</strong>
                      ),
                      h3: ({ children }) => (
                        <h3
                          style={{
                            margin: "0.75rem 0 0.5rem",
                            fontSize: "0.95rem",
                            fontWeight: 600,
                          }}
                        >
                          {children}
                        </h3>
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div
              role="status"
              aria-live="polite"
              aria-label="Navi is thinking"
              style={{
                display: "flex",
                justifyContent: "flex-start",
                marginBottom: "1rem",
              }}
            >
              <div
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "1rem",
                  background: "rgba(51, 65, 85, 0.8)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.6)",
                }}
              >
                Navi is thinking...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              alignItems: "flex-end",
            }}
          >
            <input
              type="text"
              aria-label="Message input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Navi anything..."
              disabled={loading}
              autoComplete="off"
              enterKeyHint="send"
              style={{
                flex: 1,
                padding: "0.75rem 1rem",
                borderRadius: "0.75rem",
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(30, 41, 59, 0.8)",
                color: "#f1f5f9",
                fontSize: "1rem",
              }}
            />
            <button
              type="submit"
              aria-label="Send message"
              disabled={loading || !input.trim()}
              style={{
                padding: "0.75rem 1.25rem",
                borderRadius: "0.75rem",
                border: "none",
                background:
                  loading || !input.trim()
                    ? "rgba(100, 116, 139, 0.5)"
                    : "rgba(59, 130, 246, 0.9)",
                color: "#fff",
                fontWeight: 600,
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              }}
            >
              Send
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
