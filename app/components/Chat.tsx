"use client";

import { useState, useRef, useEffect } from "react";
import {
  Menu,
  Plus,
  MessageCircle,
  Settings,
  HelpCircle,
  ChevronDown,
  Paperclip,
} from "lucide-react";
import { GEMINI_MODELS, DEFAULT_GEMINI_MODEL } from "@/app/lib/models";
import {
  DEFAULT_GENERATION_SETTINGS,
  GenerationSettings,
  clampGenerationSettings,
} from "@/app/lib/settings";
import SettingsPanel from "./SettingsPanel";
import MessageActions, { MessageFeedback } from "./MessageActions";
import AttachmentChip, { AttachmentState } from "./AttachmentChip";

const ALLOWED_ATTACHMENT_EXTENSIONS = [".pdf", ".txt", ".md"];

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  feedback?: MessageFeedback;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
}

export default function Chat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_GEMINI_MODEL);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [generationSettings, setGenerationSettings] = useState<GenerationSettings>(
    DEFAULT_GENERATION_SETTINGS
  );
  const [attachments, setAttachments] = useState<Record<string, AttachmentState>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentConv = conversations.find((c) => c.id === currentConvId);
  const messages = currentConv?.messages || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startNewChat = () => {
    const newId = Date.now().toString();
    setConversations((prev) => [...prev, { id: newId, title: "New chat", messages: [] }]);
    setCurrentConvId(newId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    if (!currentConvId) {
      startNewChat();
    }

    const convId = currentConvId || Date.now().toString();
    const userMessage: Message = { id: generateId(), role: "user", content: input };
    const modelForRequest = selectedModel;

    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? { ...c, messages: [...c.messages, userMessage] }
          : c
      )
    );

    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          model: modelForRequest,
          settings: generationSettings,
          ...(attachments[convId]?.status === "ready"
            ? { conversationId: convId }
            : {}),
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch response");

      const data = await response.json();
      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: data.text,
        model: modelForRequest,
        feedback: null,
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? { ...c, messages: [...c.messages, assistantMessage] }
            : c
        )
      );

      if (messages.length === 0) {
        const title = userMessage.content.substring(0, 30) + (userMessage.content.length > 30 ? "..." : "");
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, title } : c))
        );
      }
    } catch (error) {
      console.error("Error:", error);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: [
                  ...c.messages,
                  {
                    id: generateId(),
                    role: "assistant",
                    content: "Sorry, I encountered an error. Please try again.",
                    model: modelForRequest,
                    feedback: null,
                  },
                ],
              }
            : c
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const setMessageFeedback = (
    convId: string,
    messageId: string,
    next: MessageFeedback
  ) => {
    const conv = conversations.find((c) => c.id === convId);
    const msg = conv?.messages.find((m) => m.id === messageId);

    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, feedback: next } : m
              ),
            }
          : c
      )
    );

    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: convId,
        messageId,
        model: msg?.model ?? selectedModel,
        feedback: next ?? "none",
        content: msg?.content ?? "",
      }),
    }).catch((error) => {
      console.error("Failed to record feedback:", error);
    });
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const extension = "." + (file.name.split(".").pop() || "").toLowerCase();
    if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(extension)) {
      alert(
        `Unsupported file type. Allowed: ${ALLOWED_ATTACHMENT_EXTENSIONS.join(", ")}`
      );
      return;
    }

    if (!currentConvId) {
      startNewChat();
    }
    const convId = currentConvId || Date.now().toString();

    setAttachments((prev) => ({
      ...prev,
      [convId]: { filename: file.name, status: "uploading" },
    }));

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("conversationId", convId);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: form,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setAttachments((prev) => ({
        ...prev,
        [convId]: { filename: data.filename || file.name, status: "ready" },
      }));
    } catch (error) {
      console.error("Attachment upload failed:", error);
      setAttachments((prev) => ({
        ...prev,
        [convId]: {
          filename: file.name,
          status: "error",
          error: error instanceof Error ? error.message : "Upload failed",
        },
      }));
    }
  };

  const removeAttachment = (convId: string) => {
    setAttachments((prev) => {
      const next = { ...prev };
      delete next[convId];
      return next;
    });
  };

  const suggestedPrompts = [
    "Explain quantum computing",
    "Write a Python function",
    "Plan a trip to Japan",
    "Summarize a topic",
  ];

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-white">
      {/* Sidebar */}
      <div
        className={`transition-all duration-300 flex flex-col bg-white border-r border-gray-200 ${
          sidebarOpen ? "w-64" : "w-0"
        } overflow-hidden`}
      >
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors font-medium"
          >
            <Plus size={18} />
            New chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-3 space-y-2">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setCurrentConvId(conv.id)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm ${
                  currentConvId === conv.id
                    ? "bg-gray-200 text-gray-900 font-medium"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <div className="flex items-center gap-2">
                  <MessageCircle size={16} />
                  <span className="truncate">{conv.title}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 border-t border-gray-200 space-y-2">
          <button className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 text-gray-600 text-sm transition-colors">
            <HelpCircle size={18} />
            Help & FAQ
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 text-gray-600 text-sm transition-colors"
          >
            <Settings size={18} />
            Settings
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white bg-opacity-80 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Menu size={20} className="text-gray-700" />
              </button>
              <h1 className="text-2xl font-semibold text-gray-900">My Gemini App</h1>
            </div>

            <div className="relative">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                aria-label="Select model"
                className="appearance-none pl-3 pr-9 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-colors"
              >
                {GEMINI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              />
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto w-full px-4 py-8">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
                <h2 className="text-3xl font-semibold text-gray-900 mb-2">Hello there</h2>
                <p className="text-gray-600 mb-8">How can I help you today?</p>

                <div className="grid grid-cols-2 gap-3 w-full max-w-2xl">
                  {suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setInput(prompt)}
                      className="p-4 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-left transition-colors"
                    >
                      <p className="text-gray-900 text-sm font-medium">{prompt}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-4 py-6 animate-in fade-in ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-lg">
                    🤖
                  </div>
                )}
                <div
                  className={`max-w-2xl ${
                    msg.role === "user"
                      ? "text-right"
                      : "text-left"
                  }`}
                >
                  <p className="text-gray-900 leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </p>
                  {msg.role === "assistant" && (
                    <MessageActions
                      content={msg.content}
                      feedback={msg.feedback ?? null}
                      onToggleLike={() =>
                        setMessageFeedback(
                          currentConvId as string,
                          msg.id,
                          msg.feedback === "like" ? null : "like"
                        )
                      }
                      onToggleDislike={() =>
                        setMessageFeedback(
                          currentConvId as string,
                          msg.id,
                          msg.feedback === "dislike" ? null : "dislike"
                        )
                      }
                    />
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-semibold text-lg">
                    👤
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-4 py-6 animate-in fade-in">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-lg">
                  🤖
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="bg-white bg-opacity-80 backdrop-blur-sm border-t border-gray-200 py-4">
          <div className="max-w-4xl mx-auto px-4">
            {currentConvId && attachments[currentConvId] && (
              <div className="mb-2">
                <AttachmentChip
                  attachment={attachments[currentConvId]}
                  onRemove={() => removeAttachment(currentConvId)}
                />
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_ATTACHMENT_EXTENSIONS.join(",")}
                onChange={handleFileSelected}
                className="hidden"
              />
              <button
                type="button"
                onClick={handleAttachClick}
                disabled={
                  !!currentConvId && attachments[currentConvId]?.status === "uploading"
                }
                aria-label="Attach a file"
                title="Attach a file"
                className="p-3 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Paperclip size={18} />
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Message Gemini"
                disabled={loading}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500 disabled:bg-gray-50 disabled:cursor-not-allowed transition-all bg-white text-gray-900"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>

      <SettingsPanel
        open={settingsOpen}
        initialSettings={generationSettings}
        onSave={(settings) => {
          setGenerationSettings(clampGenerationSettings(settings));
          setSettingsOpen(false);
        }}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
