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
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dragging, setDragging] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getDocuments()
      .then((res) => setDocs(res.documents))
      .catch(() => {});
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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
    if (file.size > 25 * 1024 * 1024) {
      setError("File exceeds 25 MB limit.");
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
      }, 800);
    } catch (e: any) {
      setError(e.message || "Upload failed.");
      setUploading(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

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
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "ai", content: e.message || "Something went wrong." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const examples = [
    "What are the main topics in this document?",
    "Summarize the key conclusions.",
    "What evidence or data is presented?",
  ];

  /* ---------------------------------------------------------------- */
  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {/* Mobile toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 md:hidden w-9 h-9 rounded-lg bg-panel border border-subtle flex items-center justify-center"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {/* ============================================================ */}
      {/*  SIDEBAR                                                      */}
      {/* ============================================================ */}
      <aside className={`${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      } md:translate-x-0 fixed md:static z-40 w-[272px] h-full bg-panel flex flex-col transition-transform duration-200`}>

        {/* Brand */}
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <img 
              src="/logo.png" 
              alt="DocuMind Logo" 
              className="w-10 h-10 rounded-xl shadow-lg shadow-mint/10"
            />
            <div>
              <h1 className="text-[15px] font-semibold tracking-tight text-zinc-100">DocuMind</h1>
              <p className="text-[11px] text-muted leading-tight">Document Q&A</p>
            </div>
          </div>
        </div>

        {/* Upload */}
        <div className="px-4 mb-3">
          <button
            onClick={() => setShowUpload(true)}
            className="w-full h-10 rounded-xl bg-mint/10 hover:bg-mint/[0.16] border border-mint/20 hover:border-mint/30 text-mint text-[13px] font-medium transition-all duration-200 flex items-center justify-center gap-2"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Add document
          </button>
        </div>

        {/* Document list */}
        <div className="flex-1 overflow-y-auto px-3 space-y-1">
          {docs.length === 0 && (
            <div className="pt-12 text-center">
              <div className="w-10 h-10 rounded-xl bg-raised mx-auto mb-3 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" stroke="#71717a" strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-[13px] text-muted">No documents yet</p>
              <p className="text-[11px] text-zinc-600 mt-1">Upload a PDF to get started</p>
            </div>
          )}
          {docs.map((doc) => (
            <div
              key={doc.document_id}
              className="group relative px-3 py-2.5 rounded-xl hover:bg-raised/70 transition-colors cursor-default"
            >
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-coral/10 flex items-center justify-center shrink-0 mt-0.5">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#fb7185" strokeWidth="1.5" strokeLinejoin="round"/>
                    <path d="M14 2v6h6" stroke="#fb7185" strokeWidth="1.5" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-zinc-200 truncate leading-tight">
                    {doc.filename}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {doc.pages} {doc.pages === 1 ? "page" : "pages"}, {doc.chunks} chunks
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(doc.document_id)}
                  className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md hover:bg-coral/15 flex items-center justify-center text-zinc-500 hover:text-coral transition-all shrink-0 mt-0.5"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
            <span className="w-1 h-1 rounded-full bg-mint/60" />
            Gemini + ChromaDB
          </div>
        </div>
      </aside>

      {/* ============================================================ */}
      {/*  MAIN                                                         */}
      {/* ============================================================ */}
      <main className="flex-1 flex flex-col min-w-0">

        {/* Error toast */}
        {error && (
          <div className="absolute top-4 right-4 z-50 animate-enter">
            <div className="bg-coral/10 border border-coral/20 text-coral px-4 py-2.5 rounded-xl text-[13px] max-w-sm backdrop-blur-sm">
              {error}
            </div>
          </div>
        )}

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            /* ---- Empty state ---- */
            <div className="h-full flex items-center justify-center px-6">
              <div className="max-w-lg w-full">
                <div className="text-center mb-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-raised text-[11px] text-muted mb-6">
                    <span className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse-slow" />
                    RAG-powered with guardrails
                  </div>
                  <h2 className="text-2xl font-semibold text-zinc-100 mb-2 tracking-tight">
                    What would you like to know?
                  </h2>
                  <p className="text-[14px] text-muted leading-relaxed max-w-sm mx-auto">
                    Upload a document, then ask anything.
                    Every answer is cited with page numbers and scored for reliability.
                  </p>
                </div>

                <div className="space-y-2">
                  {examples.map((q) => (
                    <button
                      key={q}
                      onClick={() => docs.length > 0 && setInput(q)}
                      disabled={docs.length === 0}
                      className="w-full text-left px-4 py-3 rounded-xl bg-panel hover:bg-raised border border-subtle/50 hover:border-subtle text-[13px] text-soft hover:text-zinc-200 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed group"
                    >
                      <span className="text-mint mr-2 opacity-50 group-hover:opacity-100 transition-opacity">→</span>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ---- Messages ---- */
            <div className="max-w-2xl mx-auto px-5 py-8 space-y-6">
              {messages.map((msg) => (
                <div key={msg.id} className="animate-enter">
                  {msg.role === "user" ? (
                    <div className="flex justify-end">
                      <div className="max-w-[75%] px-4 py-2.5 rounded-2xl rounded-tr-lg bg-raised text-[14px] text-zinc-200 leading-relaxed">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Hallucination warning */}
                      {msg.hallucination_risk && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-coral/[0.06] border border-coral/15 text-coral text-[12px]">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M12 9v4m0 4h.01M12 3l9.5 16.5H2.5L12 3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Low relevance detected — the retrieved context may not fully support this answer
                        </div>
                      )}

                      {/* Answer */}
                      <div className="prose-answer">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>

                      {/* Confidence + sources row */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {msg.confidence_score !== undefined && (
                          <ConfidencePill
                            score={msg.confidence_score}
                            label={msg.confidence_label}
                          />
                        )}
                        {msg.sources && msg.sources.length > 0 && (
                          <SourcesToggle sources={msg.sources} />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Thinking indicator */}
              {loading && (
                <div className="animate-enter flex items-center gap-2 text-muted text-[13px]">
                  <span className="inline-block w-4 h-4 border-2 border-muted/30 border-t-mint rounded-full animate-spin" />
                  Reading your documents...
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* ---- Input ---- */}
        <div className="border-t border-subtle/40 bg-canvas/80 backdrop-blur-md px-4 py-4">
          <div className="max-w-2xl mx-auto flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder={
                  docs.length === 0
                    ? "Upload a document to start asking..."
                    : "Ask about your documents..."
                }
                disabled={loading || docs.length === 0}
                className="w-full h-11 px-4 pr-11 rounded-xl bg-panel border border-subtle/60 text-[14px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-mint/30 focus:ring-1 focus:ring-mint/10 disabled:opacity-40 transition-all"
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim() || docs.length === 0}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-mint/90 hover:bg-mint flex items-center justify-center disabled:opacity-20 disabled:hover:bg-mint/90 transition-all"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M12 5l7 7-7 7" stroke="#101014" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="w-11 h-11 rounded-xl border border-subtle/60 hover:border-subtle flex items-center justify-center text-muted hover:text-soft transition-all shrink-0"
                title="Clear chat"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v8M14 10v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => !uploading && setShowUpload(false)}
        >
          <div
            className="bg-panel border border-subtle rounded-2xl w-full max-w-md mx-4 overflow-hidden animate-enter"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-4">
              <h3 className="text-[16px] font-semibold text-zinc-100">Add a document</h3>
              <p className="text-[13px] text-muted mt-1">PDF files up to 25 MB</p>
            </div>

            <div className="px-6 pb-6">
              {!uploading ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`drop-zone ${dragging ? "dragging" : ""} border-2 border-dashed border-subtle rounded-xl p-8 text-center cursor-pointer`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-raised mx-auto mb-3 flex items-center justify-center">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path d="M12 16V8m0 0l-3 3m3-3l3 3" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M20 16.7V17a4 4 0 01-4 4H8a4 4 0 01-4-4v-.3" stroke="#71717a" strokeWidth="1.5" strokeLinecap="round"/>
                      <path d="M6.34 12.34a4 4 0 01-.22-5.46A4.5 4.5 0 0114.5 5a4.5 4.5 0 014.37 5.47A3 3 0 0120 16" stroke="#71717a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <p className="text-[13px] text-soft">
                    Drop a PDF here, or <span className="text-mint">browse</span>
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files) Array.from(files).forEach(handleUpload);
                    }}
                  />
                </div>
              ) : (
                <div className="py-10 text-center">
                  <div className="w-10 h-10 border-2 border-mint/40 border-t-mint rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-[13px] text-zinc-300">
                    {uploading === "uploading" && "Uploading..."}
                    {uploading === "processing" && "Extracting & embedding..."}
                    {uploading === "done" && "Done"}
                  </p>
                </div>
              )}
            </div>

            {!uploading && (
              <div className="border-t border-subtle/60 px-6 py-3 flex justify-end">
                <button
                  onClick={() => setShowUpload(false)}
                  className="px-4 h-8 rounded-lg text-[13px] text-muted hover:text-soft transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Confidence Pill                                                    */
/* ------------------------------------------------------------------ */
function ConfidencePill({ score, label }: { score: number; label?: string }) {
  const pct = Math.round(score * 100);
  const colorMap: Record<string, { bg: string; text: string; dot: string }> = {
    high: { bg: "bg-mint/[0.08]", text: "text-mint", dot: "bg-mint" },
    medium: { bg: "bg-amber/[0.08]", text: "text-amber", dot: "bg-amber" },
    low: { bg: "bg-coral/[0.08]", text: "text-coral", dot: "bg-coral" },
  };
  const c = colorMap[label || "low"] || colorMap.low;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {pct}% confidence
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Sources Toggle                                                     */
/* ------------------------------------------------------------------ */
function SourcesToggle({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 text-[11px] text-muted hover:text-soft transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M9 12h6M9 16h6M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-7-6z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {sources.length} sources
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div className="mt-2 space-y-1.5 animate-enter">
          {sources.map((src, i) => (
            <div key={i} className="flex gap-2 text-[12px] leading-relaxed">
              <span className="shrink-0 px-1.5 py-0.5 rounded bg-sky/10 text-sky text-[10px] font-mono font-medium h-fit mt-0.5">
                p.{src.page_number}
              </span>
              <span className="text-zinc-500">{src.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
