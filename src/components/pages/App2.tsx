import { useState, useRef } from "react";
import axios from "axios";
import { Base_URL } from "../../service/endpoints";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function App2() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus("Uploading...");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(`${Base_URL}/app1/ingest`, formData);
      setUploadStatus(res.data.message);
    } catch (err: any) {
      setUploadStatus(err.response?.data?.detail || "Upload failed");
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post(`${Base_URL}/app1/query`, {
        question: input,
      });
      const assistantMsg: Message = {
        role: "assistant",
        content: res.data.answer,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error getting response." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-semibold mb-2">RAG Chatbot</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          >
            Upload PDF / Text
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt"
            onChange={handleUpload}
            className="hidden"
          />
          {uploadStatus && (
            <span className="text-sm text-gray-600">{uploadStatus}</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-gray-400 text-center mt-20">
            Upload a document and ask questions about it.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[80%] p-3 rounded-lg ${
              msg.role === "user"
                ? "ml-auto bg-blue-600 text-white"
                : "mr-auto bg-white border border-gray-200"
            }`}
          >
            {msg.content}
          </div>
        ))}
        {loading && (
          <div className="mr-auto bg-white border border-gray-200 p-3 rounded-lg text-gray-400">
            Thinking...
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask a question about your documents..."
            className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleSend}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
