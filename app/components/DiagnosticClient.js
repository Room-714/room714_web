"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, RotateCcw, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PrimaryButton from "@/app/components/PrimaryButton";
import {
  diagnosticTree,
  diagnosticResults,
} from "@/app/data/diagnosticTree";

// ─── Branch-themed accent colours ──────────────────────────────
const branchColors = {
  start: { from: "from-red-600/20", via: "via-transparent", ring: "ring-red-600" },
  product: { from: "from-amber-500/20", via: "via-transparent", ring: "ring-amber-500" },
  ux: { from: "from-blue-500/20", via: "via-transparent", ring: "ring-blue-500" },
  design: { from: "from-purple-500/20", via: "via-transparent", ring: "ring-purple-500" },
  tech: { from: "from-emerald-500/20", via: "via-transparent", ring: "ring-emerald-500" },
};

function getBranch(nodeKey) {
  if (nodeKey === "start") return "start";
  if (nodeKey.startsWith("product")) return "product";
  if (nodeKey.startsWith("ux")) return "ux";
  if (nodeKey.startsWith("design")) return "design";
  if (nodeKey.startsWith("tech")) return "tech";
  return "start";
}

// ─── Framer-motion variants ────────────────────────────────────
const pageVariants = {
  enter: { opacity: 0, y: 30 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

const optionVariants = {
  hidden: { opacity: 0, x: -24 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: { delay: 0.15 + i * 0.08, duration: 0.35, ease: "easeOut" },
  }),
};

// ─── Typewriter hook ───────────────────────────────────────────
function useTypewriter(text, speed = 28) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    setDisplayed("");
    if (!text) return;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  return displayed;
}

// ─── Main component ────────────────────────────────────────────
export default function DiagnosticClient({ dict }) {
  const [currentNode, setCurrentNode] = useState("start");
  const [history, setHistory] = useState([]);
  const [result, setResult] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back

  const params = useParams();
  const lang = params?.lang || "en";

  const node = diagnosticTree[currentNode];
  const stepNumber = history.length + 1;
  const totalSteps = 4;
  const branch = getBranch(currentNode);
  const colors = branchColors[branch];

  // Typewriter for question text
  const questionText = dict.diagnostic[node?.questionKey] || "";
  const typedQuestion = useTypewriter(analyzing ? "" : questionText);

  // ── Keyboard navigation (A/B/C/D or 1/2/3/4) ──
  useEffect(() => {
    if (analyzing || result) return;
    const handler = (e) => {
      if (!node) return;
      const key = e.key.toLowerCase();
      let idx = -1;
      if (key >= "a" && key <= "d") idx = key.charCodeAt(0) - 97;
      if (key >= "1" && key <= "4") idx = parseInt(key) - 1;
      if (idx >= 0 && idx < node.options.length) {
        handleSelect(node.options[idx], idx);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [node, analyzing, result]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──
  const handleSelect = useCallback(
    (option, index) => {
      if (selectedIndex !== null) return; // prevent double-click
      setSelectedIndex(index);
      setDirection(1);

      setTimeout(() => {
        if (option.result) {
          // Show analyzing screen before result
          setAnalyzing(true);
          setTimeout(() => {
            setAnalyzing(false);
            setResult(diagnosticResults[option.result]);
          }, 2400);
        } else {
          setHistory((prev) => [...prev, currentNode]);
          setCurrentNode(option.next);
        }
        setSelectedIndex(null);
      }, 350);
    },
    [currentNode, selectedIndex],
  );

  const handleBack = useCallback(() => {
    setDirection(-1);
    if (result) {
      setResult(null);
      return;
    }
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory((h) => h.slice(0, -1));
      setCurrentNode(prev);
    }
  }, [result, history]);

  const handleReset = useCallback(() => {
    setDirection(-1);
    setCurrentNode("start");
    setHistory([]);
    setResult(null);
    setSelectedIndex(null);
    setAnalyzing(false);
  }, []);

  // Build contact URL with pre-filled interests
  const getContactUrl = () => {
    if (!result) return `/${lang}/contact`;
    const interestValues = result.interestKeys
      .map((key) => dict.contact.interested[key])
      .filter(Boolean);
    const params = new URLSearchParams();
    interestValues.forEach((v) => params.append("interest", v));
    return `/${lang}/contact?${params.toString()}`;
  };

  // ─── ANALYZING SCREEN ───────────────────────────────────────
  if (analyzing) {
    return (
      <main className="bg-black text-white min-h-[70vh] flex flex-col relative overflow-hidden">
        {/* Pulsing background glow */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-96 h-96 rounded-full bg-red-600/20 blur-3xl animate-pulse" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center gap-8"
          >
            {/* Spinner */}
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full border-4 border-white/10" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-red-600 animate-spin" />
              <div className="absolute inset-2 rounded-full border-4 border-transparent border-b-red-400 animate-spin [animation-direction:reverse] [animation-duration:1.5s]" />
            </div>

            {/* Text */}
            <div className="text-center">
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="font-title text-2xl sm:text-3xl md:text-4xl font-bold mb-3"
              >
                {dict.diagnostic.analyzing}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="font-body text-gray-400 text-lg"
              >
                {dict.diagnostic.analyzing_sub}
              </motion.p>
            </div>

            {/* Fake progress bar */}
            <div className="w-64 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-linear-to-r from-red-600 to-red-400 rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 2.2, ease: "easeInOut" }}
              />
            </div>
          </motion.div>
        </div>
      </main>
    );
  }

  // ─── RESULT SCREEN ──────────────────────────────────────────
  if (result) {
    const r = dict.diagnostic.results[result.resultKey];
    return (
      <main className="bg-black text-white min-h-[70vh] flex flex-col relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-150 h-100 bg-red-600/10 blur-3xl rounded-full pointer-events-none" />

        <div className="flex-1 flex flex-col justify-center px-6 md:px-16 lg:px-24 py-16 lg:py-24 max-w-4xl mx-auto w-full relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            {/* Category badge */}
            <motion.span
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-block w-fit px-4 py-1 rounded-full border border-red-600 text-red-500 text-xs sm:text-sm font-bold uppercase tracking-wider mb-6"
            >
              {dict.blog?.categories?.[result.category] || result.category}
            </motion.span>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="font-title text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6"
            >
              {r.title}
            </motion.h2>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.5 }}
              className="font-body text-lg sm:text-xl md:text-2xl text-gray-300 leading-relaxed mb-10"
            >
              {r.description}
            </motion.p>

            {/* Recommended services */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mb-12"
            >
              <p className="font-body text-sm sm:text-base uppercase font-bold text-gray-500 mb-4 tracking-wider">
                {lang === "es"
                  ? "Servicios recomendados"
                  : "Recommended services"}
              </p>
              <div className="flex flex-wrap gap-3">
                {r.services.map((service, i) => (
                  <motion.span
                    key={service}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.7 + i * 0.1 }}
                    className="px-5 py-2 rounded-full bg-white/10 text-white text-sm sm:text-base font-medium"
                  >
                    {service}
                  </motion.span>
                ))}
              </div>
            </motion.div>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="flex flex-col sm:flex-row items-center gap-4"
            >
              <PrimaryButton
                text={dict.diagnostic.cta}
                href={getContactUrl()}
                isRed={true}
                icon={Sparkles}
              />
              <button
                onClick={handleReset}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors font-title text-sm uppercase tracking-wider cursor-pointer"
              >
                <RotateCcw size={16} />
                {dict.diagnostic.start_over}
              </button>
            </motion.div>
          </motion.div>
        </div>
      </main>
    );
  }

  // ─── QUESTION SCREEN ────────────────────────────────────────
  return (
    <main className="bg-black text-white min-h-[70vh] flex flex-col relative overflow-hidden">
      {/* Animated gradient background that shifts per branch */}
      <div
        className={`absolute inset-0 bg-linear-to-br ${colors.from} ${colors.via} to-transparent transition-all duration-1000 pointer-events-none`}
      />

      <div className="flex-1 flex flex-col justify-center px-6 md:px-16 lg:px-24 py-16 lg:py-24 max-w-4xl mx-auto w-full relative z-10">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentNode}
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4, ease: "easeInOut" }}
          >
            {/* Progress indicator */}
            <div className="flex items-center gap-3 mb-10">
              <span className="font-body text-sm text-gray-500 uppercase tracking-wider">
                {dict.diagnostic.step} {stepNumber} {dict.diagnostic.of}{" "}
                {totalSteps}
              </span>
              <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden max-w-48">
                <motion.div
                  className="h-full bg-red-600 rounded-full"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${(stepNumber / totalSteps) * 100}%`,
                  }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
            </div>

            {/* Question with typewriter effect */}
            <h2 className="font-title text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-12 min-h-[2.5em]">
              {typedQuestion}
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{
                  repeat: Infinity,
                  duration: 0.6,
                  repeatType: "reverse",
                }}
                className="inline-block w-0.75 h-[0.85em] bg-red-600 ml-1 align-middle"
              />
            </h2>

            {/* Options with stagger animation */}
            <div className="flex flex-col gap-4">
              {node.options.map((option, index) => (
                <motion.button
                  key={option.labelKey}
                  custom={index}
                  variants={optionVariants}
                  initial="hidden"
                  animate="visible"
                  onClick={() => handleSelect(option, index)}
                  whileHover={{ scale: 1.015, x: 8 }}
                  whileTap={{ scale: 0.97 }}
                  className={`group w-full text-left px-6 sm:px-8 py-5 sm:py-6 rounded-2xl border-2 transition-colors duration-300 cursor-pointer ${
                    selectedIndex === index
                      ? "border-red-600 bg-red-600/10"
                      : "border-white/15 hover:border-white/40 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Option letter with glow on selection */}
                    <span
                      className={`shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm sm:text-base font-bold transition-all duration-300 ${
                        selectedIndex === index
                          ? "bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.5)]"
                          : "bg-white/10 text-gray-400 group-hover:bg-white/20"
                      }`}
                    >
                      {String.fromCharCode(65 + index)}
                    </span>

                    {/* Option text */}
                    <span className="font-body text-base sm:text-lg md:text-xl lg:text-2xl text-white/90 group-hover:text-white transition-colors">
                      {dict.diagnostic[option.labelKey]}
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Keyboard hint */}
            <p className="mt-6 text-gray-600 text-xs font-body tracking-wide hidden md:block">
              {lang === "es"
                ? "Pulsa A, B, C o D para seleccionar"
                : "Press A, B, C or D to select"}
            </p>

            {/* Back button */}
            {history.length > 0 && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                onClick={handleBack}
                className="flex items-center gap-2 mt-8 text-gray-400 hover:text-white transition-colors font-title text-sm uppercase tracking-wider cursor-pointer"
              >
                <ArrowLeft size={16} />
                {dict.diagnostic.back}
              </motion.button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}
