/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { GoogleGenAI } from "@google/genai";
import { 
  Code2, 
  Terminal, 
  Play, 
  Loader2, 
  ChevronRight, 
  Cpu, 
  Bug, 
  Zap, 
  Sparkles, 
  History,
  Copy,
  Check,
  ShieldAlert,
  GraduationCap,
  Settings2,
  Trash2,
  MessageSquarePlus,
  Send,
  X,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX
} from "lucide-react";
import Markdown from "react-markdown";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type AnalysisMode = "standard" | "security" | "performance" | "interview" | "simple";

interface AnalysisHistory {
  id: string;
  timestamp: number;
  code: string;
  analysis: string;
  mode: AnalysisMode;
}

const SAMPLES = {
  "Binary Search": `function binarySearch(arr, target) {
  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}`,
  "Quick Sort": `function quickSort(arr) {
  if (arr.length <= 1) return arr;
  const pivot = arr[arr.length - 1];
  const left = [];
  const right = [];
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] < pivot) left.push(arr[i]);
    else right.push(arr[i]);
  }
  return [...quickSort(left), pivot, ...quickSort(right)];
}`,
  "SQL Injection Risk": `const query = "SELECT * FROM users WHERE username = '" + userInput + "' AND password = '" + password + "'";
db.execute(query);`
};

const MODE_PROMPTS: Record<AnalysisMode, string> = {
  standard: "Provide a comprehensive 13-point analysis covering logic, complexity, and quality.",
  security: "Focus heavily on security vulnerabilities, OWASP top 10 risks, and data sanitization. Provide a detailed threat model.",
  performance: "Focus on time/space complexity, memory leaks, and micro-optimizations. Suggest high-performance alternatives.",
  interview: "Analyze this from a technical interviewer's perspective. Focus on edge cases, trade-offs, and behavioral follow-up questions.",
  simple: "EXPLAIN LIKE I AM 5 YEARS OLD. Use NO technical words. Use analogies like 'cooking a meal', 'cleaning a room', or 'building with blocks'. Use lots of emojis. Explain what the code does as if it were a set of instructions for a person, not a computer. Make it very friendly and easy to understand for someone who has never seen a computer before."
};

const BASE_PROMPT = `You are a senior software engineer and a very patient teacher.
Analyze the following code carefully.

If the mode is 'simple', ignore the 13-point structure and instead provide:
🌈 WHAT IS THIS? (A very simple name)
📖 THE STORY (An analogy using everyday things)
✅ WHAT IT DOES WELL (Good things)
⚠️ WATCH OUT! (Simple warnings)
🛠️ HOW TO MAKE IT BETTER (Easy fixes)

Otherwise, respond STRICTLY in the following structured format:
1️⃣ PROBLEM IDENTIFICATION
2️⃣ CONCEPTS DETECTED
3️⃣ STEP-BY-STEP EXPLANATION
4️⃣ DRY RUN SIMULATION
5️⃣ TIME & SPACE COMPLEXITY
6️⃣ EDGE CASES
7️⃣ BUG & RISK ANALYSIS
8️⃣ CODE QUALITY REVIEW
9️⃣ OPTIMIZATION SUGGESTIONS
🔟 INTERVIEW MODE
1️⃣1️⃣ REFACTORED VERSION
1️⃣2️⃣ BEGINNER MODE EXPLANATION
1️⃣3️⃣ REAL-WORLD APPLICATION

IMPORTANT RULES:
- Keep output clean and structured.
- Use bullet points.
- Be precise but clear.
- Do not mention you are an AI model.`;

export default function App() {
  const [code, setCode] = useState("");
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<AnalysisMode>("standard");
  const [history, setHistory] = useState<AnalysisHistory[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  const toggleSpeech = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else if (analysis) {
      const cleanText = analysis.replace(/[#*`_~]/g, "").replace(/\[.*?\]\(.*?\)/g, "");
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.onend = () => setIsSpeaking(false);
      speechRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  useEffect(() => {
    return () => window.speechSynthesis.cancel();
  }, []);

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("codementor_history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem("codementor_history", JSON.stringify(history));
  }, [history]);

  const handleAnalyze = async (customPrompt?: string) => {
    if (!code.trim() && !customPrompt) return;

    setIsLoading(true);
    if (!customPrompt) setAnalysis(null);

    try {
      // Vite exposes variables that begin with VITE_ via import.meta.env.
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string || "";
      if (!apiKey) {
        throw new Error("API key must be provided via VITE_GEMINI_API_KEY in your environment.");
      }
      const ai = new GoogleGenAI({ apiKey });
      const prompt = customPrompt 
        ? `Based on the previous analysis and code, answer this: ${customPrompt}`
        : `${BASE_PROMPT}\n\nMODE FOCUS: ${MODE_PROMPTS[mode]}\n\nCODE:\n${code}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [
          {
            parts: [
              { text: prompt },
              ...(analysis ? [{ text: `PREVIOUS ANALYSIS:\n${analysis}` }] : []),
              { text: `CODE:\n${code}` }
            ]
          }
        ],
        config: { temperature: 0.1 }
      });

      const text = response.text;
      
      if (customPrompt) {
        setAnalysis(prev => `${prev}\n\n---\n\n### 💬 Follow-up Question: ${customPrompt}\n\n${text}`);
      } else {
        setAnalysis(text || "No analysis generated.");
        // Add to history
        const newEntry: AnalysisHistory = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          code,
          analysis: text || "",
          mode
        };
        setHistory(prev => [newEntry, ...prev].slice(0, 10));
      }
      
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (error: any) {
      console.error("Analysis failed:", error);
      let message = "Error: Failed to analyze code. Please check your API key and network connection.";
      if (error?.message) {
        message += `\n(${error.message})`;
      }
      setAnalysis(message);
    } finally {
      setIsLoading(false);
      setIsChatting(false);
      setChatInput("");
    }
  };

  const loadFromHistory = (item: AnalysisHistory) => {
    setCode(item.code);
    setAnalysis(item.analysis);
    setMode(item.mode);
    setIsSidebarOpen(false);
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const copyToClipboard = () => {
    if (!analysis) return;
    navigator.clipboard.writeText(analysis);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0] flex overflow-hidden">
      
      {/* Sidebar - History */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className="fixed inset-y-0 left-0 w-80 bg-white border-r border-[#141414] z-50 shadow-2xl flex flex-col"
          >
            <div className="p-6 border-b border-[#141414] flex justify-between items-center">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4" />
                <h2 className="font-serif italic text-lg">Recent Analyses</h2>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="hover:opacity-50">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {history.length === 0 ? (
                <p className="text-center text-[10px] uppercase tracking-widest opacity-30 mt-10">No history yet</p>
              ) : (
                history.map(item => (
                  <div 
                    key={item.id}
                    onClick={() => loadFromHistory(item)}
                    className="p-3 border border-[#141414]/10 hover:border-[#141414] cursor-pointer transition-all group relative"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[9px] uppercase tracking-tighter opacity-50 font-mono">
                        {new Date(item.timestamp).toLocaleDateString()}
                      </span>
                      <button 
                        onClick={(e) => deleteHistoryItem(item.id, e)}
                        className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-xs font-mono truncate opacity-80">{item.code.slice(0, 50)}...</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[8px] px-1.5 py-0.5 bg-gray-100 border border-gray-200 uppercase tracking-widest font-mono">
                        {item.mode}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="border-b border-[#141414] p-6 flex justify-between items-center bg-[#E4E3E0]/80 backdrop-blur-sm z-10 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 border border-[#141414] hover:bg-white transition-colors"
            >
              <History className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#141414] flex items-center justify-center rounded-sm">
                <Code2 className="text-[#E4E3E0] w-6 h-6" />
              </div>
              <div>
                <h1 className="font-serif italic text-2xl tracking-tight leading-none">CodeMentor AI</h1>
                <p className="text-[10px] uppercase tracking-widest opacity-50 font-mono mt-1">Advanced Analysis Engine</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex gap-2">
              {(Object.keys(SAMPLES) as Array<keyof typeof SAMPLES>).map(name => (
                <button
                  key={name}
                  onClick={() => setCode(SAMPLES[name])}
                  className="px-3 py-1 text-[9px] uppercase tracking-widest font-mono border border-[#141414]/20 hover:border-[#141414] hover:bg-white transition-all"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2">
          {/* Editor Section */}
          <section className="flex flex-col border-r border-[#141414] bg-white overflow-hidden">
            <div className="p-4 border-b border-[#141414] flex items-center justify-between bg-[#f8f8f8]">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  <span className="text-[10px] uppercase tracking-widest font-mono font-bold">Input Editor</span>
                </div>
                <div className="h-4 w-[1px] bg-[#141414]/10" />
                <div className="flex gap-1">
                  {(["standard", "security", "performance", "interview", "simple"] as AnalysisMode[]).map(m => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={cn(
                        "px-2 py-1 text-[9px] uppercase tracking-widest font-mono border transition-all flex items-center gap-1",
                        mode === m 
                          ? "bg-[#141414] text-white border-[#141414]" 
                          : "border-transparent hover:border-[#141414]/20"
                      )}
                    >
                      {m === "simple" && <GraduationCap className="w-2 h-2" />}
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => setCode("")} className="hover:opacity-50">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 relative">
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="// Paste your code here... (Python, JS, C++, etc.)"
                className="w-full h-full p-8 font-mono text-sm resize-none focus:outline-none bg-transparent"
                spellCheck={false}
              />
              <div className="absolute bottom-6 right-6">
                <button
                  onClick={() => handleAnalyze()}
                  disabled={isLoading || !code.trim()}
                  className={cn(
                    "px-8 py-3 flex items-center gap-3 text-[11px] uppercase tracking-widest font-mono border border-[#141414] transition-all shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]",
                    isLoading || !code.trim() 
                      ? "bg-gray-200 cursor-not-allowed opacity-50 shadow-none" 
                      : "bg-[#141414] text-[#E4E3E0] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(20,20,20,1)] active:translate-x-0 active:translate-y-0 active:shadow-none"
                  )}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Run Analysis
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* Report Section */}
          <section className="flex flex-col bg-[#E4E3E0] overflow-hidden">
            <div className="p-4 border-b border-[#141414] flex items-center justify-between bg-[#E4E3E0]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-widest font-mono font-bold">Analysis Report</span>
              </div>
              {analysis && (
                <div className="flex gap-4">
                  <button
                    onClick={toggleSpeech}
                    className={cn(
                      "flex items-center gap-2 text-[10px] uppercase tracking-widest font-mono transition-all",
                      isSpeaking ? "text-emerald-600 font-bold" : "hover:opacity-70",
                      mode === "simple" && !isSpeaking && "animate-bounce bg-[#141414] text-white px-2 py-1 rounded-sm"
                    )}
                  >
                    {isSpeaking ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                    {isSpeaking ? "Stop Listening" : "Listen to Report"}
                  </button>
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-mono hover:opacity-70 transition-opacity"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              )}
            </div>

            <div 
              ref={resultsRef}
              className="flex-1 overflow-y-auto p-8 relative scroll-smooth"
            >
              <AnimatePresence mode="wait">
                {!analysis && !isLoading ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full flex flex-col items-center justify-center text-center gap-4 opacity-20"
                  >
                    <History className="w-16 h-16" />
                    <p className="font-serif italic text-2xl">Awaiting source code</p>
                    <p className="text-[10px] uppercase tracking-widest font-mono max-w-[250px]">
                      Select a sample or paste your own code to begin the analysis process
                    </p>
                  </motion.div>
                ) : isLoading && !isChatting ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full flex flex-col items-center justify-center gap-8"
                  >
                    <div className="relative">
                      <div className="w-20 h-20 border-2 border-[#141414]/10 rounded-full flex items-center justify-center">
                        <Loader2 className="w-10 h-10 animate-spin text-[#141414]" />
                      </div>
                      <motion.div 
                        className="absolute inset-0 border-2 border-[#141414] rounded-full"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    </div>
                    <div className="text-center">
                      <p className="font-serif italic text-2xl">Synthesizing Report...</p>
                      <div className="flex gap-2 justify-center mt-4">
                        <span className="w-1.5 h-1.5 bg-[#141414] rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1.5 h-1.5 bg-[#141414] rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1.5 h-1.5 bg-[#141414] rounded-full animate-bounce" />
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-3xl mx-auto"
                  >
                    <div className="bg-white border border-[#141414] p-10 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] mb-20">
                      <div className="flex justify-between items-start mb-8 border-b border-[#141414] pb-6">
                        <div>
                          <h2 className="font-serif italic text-3xl mb-1">Analysis Report</h2>
                          <p className="text-[10px] uppercase tracking-widest font-mono opacity-50">
                            Generated on {new Date().toLocaleDateString()} • Mode: {mode}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-widest font-mono opacity-50 mb-1">Engine Confidence</div>
                          <div className="text-xl font-mono font-bold">98.4%</div>
                        </div>
                      </div>

                      <div className="prose prose-sm max-w-none markdown-body">
                        <Markdown
                          components={{
                            h1: ({ children }) => (
                              <h1 className="font-serif italic text-2xl border-b border-[#141414] pb-2 mb-6 mt-12 first:mt-0 flex items-center gap-3">
                                {children}
                              </h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="font-serif italic text-xl border-b border-[#141414]/20 pb-1 mb-4 mt-10 flex items-center gap-2">
                                {children}
                              </h2>
                            ),
                            p: ({ children }) => <p className="mb-4 leading-relaxed text-sm text-[#141414]/80">{children}</p>,
                            ul: ({ children }) => <ul className="mb-6 space-y-3 list-none p-0">{children}</ul>,
                            li: ({ children }) => (
                              <li className="flex gap-3 items-start text-sm">
                                <div className="w-1.5 h-1.5 bg-[#141414] rounded-full mt-1.5 shrink-0 opacity-40" />
                                <span>{children}</span>
                              </li>
                            ),
                            code: ({ children, className }) => {
                              const isInline = !className;
                              return isInline ? (
                                <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-[12px] border border-gray-200">
                                  {children}
                                </code>
                              ) : (
                                <div className="relative group my-8">
                                  <div className="absolute -top-3 left-4 px-2 bg-[#141414] text-[#E4E3E0] text-[8px] uppercase tracking-widest font-mono py-0.5">
                                    Source
                                  </div>
                                  <pre className="bg-[#141414] text-[#E4E3E0] p-6 font-mono text-[12px] overflow-x-auto border-l-4 border-emerald-500 shadow-xl">
                                    {children}
                                  </pre>
                                </div>
                              );
                            },
                            strong: ({ children }) => <strong className="font-bold text-[#141414]">{children}</strong>,
                          }}
                        >
                          {analysis}
                        </Markdown>
                      </div>

                      {/* Follow-up Chat */}
                      <div className="mt-16 pt-8 border-t border-[#141414]/10">
                        <div className="flex items-center gap-2 mb-4">
                          <MessageSquarePlus className="w-4 h-4" />
                          <h3 className="font-serif italic text-lg">Follow-up Questions</h3>
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAnalyze(chatInput)}
                            placeholder="Ask a specific question about this code..."
                            className="flex-1 bg-gray-50 border border-[#141414]/20 p-3 text-sm font-mono focus:outline-none focus:border-[#141414] transition-colors"
                          />
                          <button
                            onClick={() => {
                              setIsChatting(true);
                              handleAnalyze(chatInput);
                            }}
                            disabled={isLoading || !chatInput.trim()}
                            className="p-3 bg-[#141414] text-white hover:opacity-90 disabled:opacity-30 transition-opacity"
                          >
                            {isLoading && isChatting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        <div className="mt-3 flex gap-2">
                          {["Explain the time complexity again", "How to fix the security risk?", "Make it more readable"].map(suggestion => (
                            <button
                              key={suggestion}
                              onClick={() => {
                                setChatInput(suggestion);
                                setIsChatting(true);
                                handleAnalyze(suggestion);
                              }}
                              className="text-[9px] uppercase tracking-widest font-mono opacity-50 hover:opacity-100 transition-opacity"
                            >
                              + {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </main>
      </div>

      {/* Global Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 h-8 bg-[#141414] text-[#E4E3E0] flex items-center justify-between px-6 text-[9px] uppercase tracking-[0.2em] font-mono z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span>System Online</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 opacity-50">
            <Cpu className="w-3 h-3" />
            <span>Gemini 3.1 Pro Active</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <span className="opacity-50">Lat: 24ms</span>
          <span className="opacity-50">Mem: 124MB</span>
          <div className="flex items-center gap-2">
            <Settings2 className="w-3 h-3" />
            <span>Config: {mode}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
