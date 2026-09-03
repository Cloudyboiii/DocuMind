"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import {
  uploadDocument,
  queryDocument,
  getDocuments,
  deleteDocument,
} from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Doc {
  document_id: string;
  filename: string;
  pages: number;
  chunks: number;
}

interface Source {
  text: string;
  page_number: number;
  distance: number;
}

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  confidence_score?: number;
  confidence_label?: string;
  hallucination_risk?: boolean;
  sources?: Source[];
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function Home() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null); // null | "uploading" | "processing" | "done"
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch docs on mount
  useEffect(() => {
    getDocuments()
      .then((res) => setDocs(res.documents))
      .catch(() => {});
  }, []);

  // Auto scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Clear error after 5s
  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(t);
    }
  }, [error]);

  /* ---- Upload ---- */
  const handleUpload = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are accepted.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File exceeds 10 MB limit.");
      return;
    }
    try {
      setUploading("uploading");
      setTimeout(() => setUploading("processing"), 800);
      const result = await uploadDocument(file);
      setUploading("done");
      setDocs((prev) => [
        ...prev,
        {
          document_id: result.document_id,
          filename: result.filename,
          pages: result.pages,
          chunks: result.chunks,
        },
      ]);
      setTimeout(() => {
        setShowUpload(false);
        setUploading(null);
      }, 1000);
    } catch (e: any) {
      setError(e.message || "Upload failed.");
      setUploading(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  /* ---- Delete doc ---- */
  const handleDelete = async (docId: string) => {
    try {
      await deleteDocument(docId);
      setDocs((prev) => prev.filter((d) => d.document_id !== docId));
    } catch (e: any) {
      setError(e.message || "Delete failed.");
    }
  };

  /* ---- Query ---- */
  const handleSend = async () => {
    const q = input.trim();
    if (!q || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: q };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await queryDocument(q);
      const aiMsg: Message = {
        id: crypto.randomUUID(),
        role: "ai",
        content: res.answer,
        confidence_score: res.confidence_score,
        confidence_label: res.confidence_label,
        hallucination_risk: res.hallucination_risk,
        sources: res.sources,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (e: any) {
      const errMsg: Message = {
        id: crypto.randomUUID(),
        role: "ai",
        content: e.message || "Something went wrong. Is the backend running?",
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (q: string) => {
    if (docs.length === 0) return;
    setInput(q);
  };

  const confidenceColor = (label?: string) => {
    if (label === "high") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (label === "medium") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    return "bg-red-500/20 text-red-400 border-red-500/30";
  };

  const examples = [
    "What are the main topics covered in this document?",
    "Summarize the key findings or conclusions.",
    "What data or evidence is presented?",
  ];

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */
  return (
    <div className="flex h-screen overflow-hidden">
      {/* ---- Mobile sidebar toggle ---- */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-3 left-3 z-50 md:hidden p-2 rounded-lg bg-surface-raised border border-border"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {/* ============================================================ */}
      {/*  SIDEBAR                                                      */}
      {/* ============================================================ */}
      <aside
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 fixed md:static z-40 w-[280px] h-full bg-surface-raised border-r border-border flex flex-col transition-transform duration-200`}
      >
        {/* Logo */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="text-lg font-semibold tracking-tight">DocuMind</span>
          </div>
        </div>

        {/* Upload button */}
        <div className="p-4">
          <button
            onClick={() => setShowUpload(true)}
            className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
          >
            Upload Document
          </button>
        </div>

        {/* Doc list */}
        <div className="flex-1 overflow-y-auto px-4 space-y-2">
          {docs.length === 0 && (
            <p className="text-zinc-500 text-sm text-center mt-8">
              No documents yet
            </p>
          )}
          {docs.map((doc) => (
            <div
              key={doc.document_id}
              className="group p-3 rounded-lg bg-surface hover:bg-surface-overlay transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{doc.filename}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {doc.pages} pages · {doc.chunks} chunks
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(doc.document_id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-all"
                  title="Delete document"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <p className="text-[11px] text-zinc-600 text-center">
            Powered by Gemini &amp; ChromaDB
          </p>
        </div>
      </aside>

      {/* ============================================================ */}
      {/*  MAIN CHAT AREA                                               */}
      {/* ============================================================ */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Error toast */}
        {error && (
          <div className="absolute top-4 right-4 z-50 animate-fade-in bg-red-500/15 border border-red-500/30 text-red-400 px-4 py-2.5 rounded-lg text-sm max-w-sm">
            {error}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-5">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    stroke="#6366f1"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2">Upload a document and ask a question</h2>
              <p className="text-zinc-500 text-sm mb-8 max-w-md">
                DocuMind uses RAG with hallucination guardrails to answer your questions accurately from uploaded PDFs.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {examples.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleExampleClick(q)}
                    disabled={docs.length === 0}
                    className="px-3.5 py-2 rounded-lg bg-surface-raised border border-border text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title={docs.length === 0 ? "Upload a document first" : ""}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className="animate-fade-in">
                {msg.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-md bg-accent text-white text-sm">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] space-y-2">
                      {/* Hallucination warning */}
                      {msg.hallucination_risk && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path
                              d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </svg>
                          Hallucination risk detected — retrieved context may not be relevant
                        </div>
                      )}

                      {/* Answer bubble */}
                      <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-surface-raised border border-border text-sm">
                        <div className="prose-ai">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      </div>

                      {/* Confidence badge */}
                      {msg.confidence_score !== undefined && (
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${confidenceColor(
                              msg.confidence_label
                            )}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                msg.confidence_label === "high"
                                  ? "bg-emerald-400"
                                  : msg.confidence_label === "medium"
                                  ? "bg-amber-400"
                                  : "bg-red-400"
                              }`}
                            />
                            {Math.round(msg.confidence_score * 100)}% confidence
                          </span>
                        </div>
                      )}

                      {/* Sources */}
                      {msg.sources && msg.sources.length > 0 && (
                        <SourcesAccordion sources={msg.sources} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex justify-start animate-fade-in">
                <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-surface-raised border border-border">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce-dot" />
                    <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce-dot [animation-delay:0.16s]" />
                    <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce-dot [animation-delay:0.32s]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Input bar */}
        <div className="border-t border-border bg-surface p-4">
          <div className="max-w-3xl mx-auto flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder={docs.length === 0 ? "Upload a document first..." : "Ask a question about your documents..."}
              disabled={loading || docs.length === 0}
              className="flex-1 px-4 py-2.5 rounded-xl bg-surface-raised border border-border text-sm placeholder:text-zinc-600 focus:outline-none focus:border-accent/50 disabled:opacity-50 transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim() || docs.length === 0}
              className="px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium disabled:opacity-40 transition-colors"
            >
              Send
            </button>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="px-3 py-2.5 rounded-xl border border-border text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
                title="Clear chat"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      </main>

      {/* ============================================================ */}
      {/*  UPLOAD MODAL                                                 */}
      {/* ============================================================ */}
      {showUpload && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => !uploading && setShowUpload(false)}
        >
          <div
            className="bg-surface-raised border border-border rounded-2xl p-6 w-full max-w-md mx-4 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Upload Document</h3>

            {!uploading ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-accent/40 rounded-xl p-10 text-center cursor-pointer transition-colors"
              >
                <svg className="mx-auto mb-3" width="36" height="36" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6h.1a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    stroke="#6366f1"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="text-sm text-zinc-400 mb-1">
                  Drag &amp; drop a PDF or click to browse
                </p>
                <p className="text-xs text-zinc-600">Max 10 MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                  }}
                />
              </div>
            ) : (
              <div className="py-8 text-center">
                <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm text-zinc-300">
                  {uploading === "uploading" && "Uploading file..."}
                  {uploading === "processing" && "Processing & embedding..."}
                  {uploading === "done" && "Done!"}
                </p>
              </div>
            )}

            {!uploading && (
              <button
                onClick={() => setShowUpload(false)}
                className="mt-4 w-full py-2 rounded-lg border border-border text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sources Accordion                                                  */
/* ------------------------------------------------------------------ */
function SourcesAccordion({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
      >
        <span>
          View Sources ({sources.length})
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-border px-3 py-2 space-y-2 max-h-60 overflow-y-auto">
          {sources.map((src, i) => (
            <div key={i} className="text-xs text-zinc-500">
              <span className="inline-block px-1.5 py-0.5 rounded bg-accent/15 text-accent text-[10px] font-medium mr-1.5">
                Page {src.page_number}
              </span>
              {src.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
