"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, RotateCcw, Sparkles } from "lucide-react";
import PrimaryButton from "@/app/components/PrimaryButton";
import { diagnosticTree, diagnosticResults } from "@/app/data/diagnosticTree";

export default function DiagnosticClient({ dict }) {
  const [currentNode, setCurrentNode] = useState("start");
  const [history, setHistory] = useState([]);
  const [result, setResult] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);

  const params = useParams();
  const lang = params?.lang || "en";

  const node = diagnosticTree[currentNode];
  const stepNumber = history.length + 1;
  const totalSteps = 3; // max depth of the tree

  const handleSelect = useCallback(
    (option, index) => {
      setSelectedIndex(index);

      // Small delay for visual feedback before transitioning
      setTimeout(() => {
        if (option.result) {
          setResult(diagnosticResults[option.result]);
        } else {
          setHistory((prev) => [...prev, currentNode]);
          setCurrentNode(option.next);
        }
        setSelectedIndex(null);
      }, 300);
    },
    [currentNode],
  );

  const handleBack = useCallback(() => {
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
    setCurrentNode("start");
    setHistory([]);
    setResult(null);
    setSelectedIndex(null);
  }, []);

  // Build contact URL with pre-filled interests from the diagnostic result
  const getContactUrl = () => {
    if (!result) return `/${lang}/contact`;
    const interestValues = result.interestKeys
      .map((key) => dict.contact.interested[key])
      .filter(Boolean);
    const params = new URLSearchParams();
    interestValues.forEach((v) => params.append("interest", v));
    return `/${lang}/contact?${params.toString()}`;
  };

  // --- RESULT SCREEN ---
  if (result) {
    const r = dict.diagnostic.results[result.resultKey];
    return (
      <main className="bg-black text-white min-h-[70vh] flex flex-col">
        <div className="flex-1 flex flex-col justify-center px-6 md:px-16 lg:px-24 py-16 lg:py-24 max-w-4xl mx-auto w-full">
          {/* Category badge */}
          <span className="inline-block w-fit px-4 py-1 rounded-full border border-red-600 text-red-500 text-xs sm:text-sm font-bold uppercase tracking-wider mb-6">
            {dict.blog?.categories?.[result.category] || result.category}
          </span>

          {/* Title */}
          <h2 className="font-title text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
            {r.title}
          </h2>

          {/* Description */}
          <p className="font-body text-lg sm:text-xl md:text-2xl text-gray-300 leading-relaxed mb-10">
            {r.description}
          </p>

          {/* Recommended services */}
          <div className="mb-12">
            <p className="font-body text-sm sm:text-base uppercase font-bold text-gray-500 mb-4 tracking-wider">
              {lang === "es"
                ? "Servicios recomendados"
                : "Recommended services"}
            </p>
            <div className="flex flex-wrap gap-3">
              {r.services.map((service) => (
                <span
                  key={service}
                  className="px-5 py-2 rounded-full bg-white/10 text-white text-sm sm:text-base font-medium"
                >
                  {service}
                </span>
              ))}
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
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
          </div>
        </div>
      </main>
    );
  }

  // --- QUESTION SCREEN ---
  return (
    <main className="bg-black text-white min-h-[70vh] flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-6 md:px-16 lg:px-24 py-16 lg:py-24 max-w-4xl mx-auto w-full">
        {/* Progress indicator */}
        <div className="flex items-center gap-3 mb-10">
          {/* Step counter */}
          <span className="font-body text-sm text-gray-500 uppercase tracking-wider">
            {dict.diagnostic.step} {stepNumber} {dict.diagnostic.of}{" "}
            {totalSteps}
          </span>

          {/* Progress bar */}
          <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden max-w-48">
            <div
              className="h-full bg-red-600 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${(stepNumber / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <h2 className="font-title text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-12">
          {dict.diagnostic[node.questionKey]}
        </h2>

        {/* Options */}
        <div className="flex flex-col gap-4">
          {node.options.map((option, index) => (
            <button
              key={option.labelKey}
              onClick={() => handleSelect(option, index)}
              className={`group w-full text-left px-6 sm:px-8 py-5 sm:py-6 rounded-2xl border-2 transition-all duration-300 cursor-pointer ${
                selectedIndex === index
                  ? "border-red-600 bg-red-600/10 scale-[0.98]"
                  : "border-white/15 hover:border-white/40 hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-4">
                {/* Option number */}
                <span
                  className={`shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm sm:text-base font-bold transition-colors duration-300 ${
                    selectedIndex === index
                      ? "bg-red-600 text-white"
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
            </button>
          ))}
        </div>

        {/* Back button */}
        {history.length > 0 && (
          <button
            onClick={handleBack}
            className="flex items-center gap-2 mt-10 text-gray-400 hover:text-white transition-colors font-title text-sm uppercase tracking-wider cursor-pointer"
          >
            <ArrowLeft size={16} />
            {dict.diagnostic.back}
          </button>
        )}
      </div>
    </main>
  );
}
