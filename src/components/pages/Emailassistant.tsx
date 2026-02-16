import { useState, useRef, useCallback } from "react";
import { Base_URL } from "../../service/endpoints";

const ACTIONS = [
  {
    id: "auto",
    label: "Auto Detect",
    description: "Let AI figure out what you need",
    icon: "✨",
  },
  {
    id: "draft",
    label: "Draft Reply",
    description: "Write a reply to an email",
    icon: "✏️",
  },
  {
    id: "summarize",
    label: "Summarize",
    description: "Summarize an email thread",
    icon: "📋",
  },
  {
    id: "grammar",
    label: "Fix Grammar",
    description: "Correct errors in your email",
    icon: "🔤",
  },
  {
    id: "improve",
    label: "Improve",
    description: "Make your email more professional",
    icon: "🚀",
  },
];

export default function EmailAssistant() {
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [response, setResponse] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [selectedAction, setSelectedAction] = useState("auto");
  const abortControllerRef = useRef(null);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
      setStatus("");
    }
  }, []);

  const handleSend = async () => {
    if (!text.trim() || loading) return;

    setLoading(true);
    setResponse("");
    setError("");
    setStatus("Starting...");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch(`${Base_URL}/email-assistant/process/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, action: selectedAction }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;

            try {
              const parsed = JSON.parse(data);
              if (parsed.token) {
                setStatus("");
                setResponse((prev) => prev + parsed.token);
              }
              if (parsed.status) {
                setStatus(parsed.status);
              }
              if (parsed.error) {
                setError(parsed.error);
              }
            } catch {
              setResponse((prev) => prev + data);
            }
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
      setStatus("");
      abortControllerRef.current = null;
    }
  };

  const handleClear = () => {
    setText("");
    setResponse("");
    setError("");
    setStatus("");
  };

  const handleCopy = async () => {
    if (response) {
      await navigator.clipboard.writeText(response);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-semibold">Email Assistant</h1>
        <p className="text-gray-500 text-sm mb-3">
          Draft replies, summarize threads, fix grammar, or improve your emails
          with AI.
        </p>

        {/* Action selector */}
        <div className="flex gap-2 mb-3 flex-wrap">
          {ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => setSelectedAction(action.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                selectedAction === action.id
                  ? "bg-blue-100 text-blue-700 border border-blue-300"
                  : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
              }`}
              title={action.description}
            >
              <span>{action.icon}</span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>

        {/* Input area */}
        <div className="space-y-2">
          <textarea
            rows={6}
            className="border border-gray-300 rounded-md w-full p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-y"
            placeholder={getPlaceholder(selectedAction)}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {text.length.toLocaleString()} characters
            </span>

            <div className="flex gap-2">
              {(text || response) && (
                <button
                  className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
                  onClick={handleClear}
                >
                  Clear
                </button>
              )}

              {loading ? (
                <button
                  className="bg-red-500 hover:bg-red-600 text-white text-sm px-4 py-1.5 rounded-md shadow transition-colors"
                  onClick={handleStop}
                >
                  Stop
                </button>
              ) : (
                <button
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-200 disabled:cursor-not-allowed text-white text-sm px-4 py-1.5 rounded-md shadow transition-colors"
                  disabled={!text.trim()}
                  onClick={handleSend}
                >
                  {getButtonLabel(selectedAction)}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Response area */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-md mb-4">
            {error}
          </div>
        )}

        {status && (
          <div className="flex items-center gap-2 text-blue-500 text-sm mb-3">
            <svg
              className="animate-spin h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            {status}
          </div>
        )}

        {response && (
          <div className="relative bg-gray-50 border border-gray-200 rounded-md p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {getResultLabel(selectedAction)}
              </span>
              <button
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                onClick={handleCopy}
              >
                Copy
              </button>
            </div>
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {response}
            </div>
            {loading && (
              <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse rounded-sm ml-0.5" />
            )}
          </div>
        )}

        {!response && !loading && !error && (
          <p className="text-gray-300 text-sm text-center mt-20">
            Your result will appear here
          </p>
        )}
      </div>
    </div>
  );
}

// ── Helper functions ──

function getPlaceholder(action) {
  switch (action) {
    case "draft":
      return "Paste the email you want to reply to...\n\nOptionally add instructions like:\n- Keep it formal\n- Decline the meeting politely\n- Confirm availability for Thursday";
    case "summarize":
      return "Paste the email thread you want summarized...";
    case "grammar":
      return "Paste your email to check for grammar and spelling errors...";
    case "improve":
      return "Paste your email draft to get improvement suggestions...";
    default:
      return "Paste your email content here and tell me what you need help with...";
  }
}

function getButtonLabel(action) {
  switch (action) {
    case "draft":
      return "Draft Reply";
    case "summarize":
      return "Summarize";
    case "grammar":
      return "Fix Grammar";
    case "improve":
      return "Improve";
    default:
      return "Process";
  }
}

function getResultLabel(action) {
  switch (action) {
    case "draft":
      return "Draft Reply";
    case "summarize":
      return "Summary";
    case "grammar":
      return "Corrected Email";
    case "improve":
      return "Improved Email";
    default:
      return "Result";
  }
}
