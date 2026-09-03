import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocuMind — RAG Document Q&A",
  description:
    "Upload documents and ask questions with AI-powered retrieval, confidence scoring, and hallucination guardrails.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
