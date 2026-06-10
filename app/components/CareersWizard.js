"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Upload,
  Loader2,
  Code2,
  PenTool,
  Compass,
} from "lucide-react";

const POSITION_OPTIONS = [
  { id: "DEVELOPER", icon: Code2 },
  { id: "DESIGNER", icon: PenTool },
  { id: "PRODUCT_MANAGER", icon: Compass },
];
const EDUCATION_OPTIONS = ["GRADO", "MASTER", "DOCTORADO", "OTHER"];
const MAX_CV_BYTES = 5 * 1024 * 1024;

const pageVariants = {
  enter: { opacity: 0, y: 24 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

export default function CareersWizard({ dict, lang }) {
  const [step, setStep] = useState(1);
  const [position, setPosition] = useState(null);
  const [country, setCountry] = useState("");
  const [education, setEducation] = useState(null);
  const [cv, setCv] = useState(null);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const t = dict.careers;
  const totalSteps = 4;

  const goNext = () => setStep((s) => Math.min(s + 1, totalSteps));
  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  const handleCvChange = (e) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setCv(null);
      return;
    }
    if (file.type !== "application/pdf") {
      setError(t.errors.notPdf);
      e.target.value = "";
      setCv(null);
      return;
    }
    if (file.size > MAX_CV_BYTES) {
      setError(t.errors.tooLarge);
      e.target.value = "";
      setCv(null);
      return;
    }
    setCv(file);
  };

  const canSubmit = !!cv && acceptedPrivacy && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("position", position);
      formData.append("country", country);
      formData.append("education", education);
      formData.append("acceptedPrivacy", "true");
      formData.append("cv", cv);

      const res = await fetch("/api/careers/submit", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || t.errors.generic);
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch (err) {
      console.error(err);
      setError(t.errors.generic);
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="bg-white rounded-3xl p-10 md:p-16 text-center max-w-2xl mx-auto"
      >
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
            <Check className="w-12 h-12 text-red-500" strokeWidth={3} />
          </div>
        </div>
        <h2 className="font-title font-black text-3xl md:text-5xl text-black mb-4 leading-tight">
          {t.thanks.title}
        </h2>
        <p className="font-hand text-2xl md:text-3xl text-red-500 mb-6">
          {t.thanks.subtitle}
        </p>
        <p className="font-body text-base md:text-lg text-gray-700 mb-8 leading-relaxed">
          {t.thanks.body}
        </p>
        <Link
          href={`/${lang}/`}
          className="inline-block bg-black text-white px-8 py-3 rounded-full font-hand text-lg hover:bg-red-600 transition-all hover:scale-105"
        >
          {t.thanks.cta}
        </Link>
      </motion.div>
    );
  }

  return (
    <div className="bg-white rounded-3xl p-6 md:p-10 lg:p-14 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <span className="font-hand text-red-500 text-lg md:text-xl">
          {t.step} {step} / {totalSteps}
        </span>
        {step > 1 && !submitting && (
          <button
            onClick={goBack}
            className="flex items-center gap-2 text-gray-500 hover:text-red-500 transition-colors text-sm font-title uppercase tracking-wide"
          >
            <ArrowLeft size={16} />
            <span>{t.back}</span>
          </button>
        )}
      </div>

      <div className="h-1 w-full bg-gray-100 rounded-full mb-10 overflow-hidden">
        <motion.div
          className="h-full bg-red-500"
          initial={false}
          animate={{ width: `${(step / totalSteps) * 100}%` }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        />
      </div>

      <AnimatePresence mode="wait" custom={step}>
        {step === 1 && (
          <motion.div
            key="step1"
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <h2 className="font-title font-black text-2xl md:text-4xl lg:text-5xl text-black mb-8 leading-tight">
              {t.steps.position.title}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {POSITION_OPTIONS.map(({ id, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => {
                    setPosition(id);
                    goNext();
                  }}
                  className={`group flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all ${
                    position === id
                      ? "border-red-500 bg-red-50"
                      : "border-gray-200 hover:border-black"
                  }`}
                >
                  <Icon
                    className={`w-10 h-10 md:w-12 md:h-12 mb-4 transition-colors ${
                      position === id
                        ? "text-red-500"
                        : "text-black group-hover:text-red-500"
                    }`}
                    strokeWidth={1.6}
                  />
                  <p className="font-title font-black text-base md:text-lg text-black text-center leading-tight">
                    {t.steps.position.options[id].line1}
                    <br />
                    {t.steps.position.options[id].line2}
                  </p>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <h2 className="font-title font-black text-2xl md:text-4xl lg:text-5xl text-black mb-8 leading-tight">
              {t.steps.country.title}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: "ES", label: t.steps.country.yes },
                { value: "OTHER", label: t.steps.country.no },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setCountry(opt.value);
                    goNext();
                  }}
                  className={`p-8 rounded-2xl border-2 transition-all font-title font-black text-2xl md:text-3xl ${
                    country === opt.value
                      ? "border-red-500 bg-red-50 text-red-500"
                      : "border-gray-200 text-black hover:border-black"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step3"
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <h2 className="font-title font-black text-2xl md:text-4xl lg:text-5xl text-black mb-8 leading-tight">
              {t.steps.education.title}
            </h2>
            <div className="space-y-3">
              {EDUCATION_OPTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    setEducation(e);
                    goNext();
                  }}
                  className={`w-full p-5 rounded-2xl border-2 text-left transition-all ${
                    education === e
                      ? "border-red-500 bg-red-50"
                      : "border-gray-200 hover:border-black"
                  }`}
                >
                  <p className="font-title font-bold text-base md:text-lg text-black">
                    {t.steps.education.options[e]}
                  </p>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div
            key="step4"
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <h2 className="font-title font-black text-2xl md:text-4xl lg:text-5xl text-black mb-8 leading-tight">
              {t.steps.cv.title}
            </h2>

            <label
              htmlFor="cv-file"
              className={`block w-full p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-colors ${
                cv
                  ? "border-red-500 bg-red-50"
                  : "border-gray-300 hover:border-black bg-gray-50"
              }`}
            >
              <div className="flex flex-col items-center text-center">
                <Upload className="w-10 h-10 text-gray-400 mb-3" />
                {cv ? (
                  <>
                    <p className="font-title font-bold text-black break-all px-4">
                      {cv.name}
                    </p>
                    <p className="font-body text-sm text-gray-500 mt-1">
                      {(cv.size / 1024 / 1024).toFixed(2)} MB —{" "}
                      {t.steps.cv.replace}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-title font-bold text-black">
                      {t.steps.cv.dropzone}
                    </p>
                    <p className="font-body text-sm text-gray-500 mt-1">
                      {t.steps.cv.requirements}
                    </p>
                  </>
                )}
              </div>
              <input
                id="cv-file"
                type="file"
                accept="application/pdf"
                onChange={handleCvChange}
                className="hidden"
              />
            </label>

            {error && (
              <p className="mt-4 font-body text-sm text-red-600">{error}</p>
            )}

            <label className="flex items-start gap-3 mt-8 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedPrivacy}
                onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                className="mt-1 w-5 h-5 accent-red-500 cursor-pointer flex-none"
              />
              <span className="font-body text-sm md:text-base text-gray-700 leading-relaxed">
                {t.steps.cv.privacyPrefix}{" "}
                <Link
                  href={`/${lang}/privacy`}
                  target="_blank"
                  className="text-red-500 underline hover:text-red-700"
                >
                  {t.steps.cv.privacyLink}
                </Link>
                {t.steps.cv.privacySuffix}
              </span>
            </label>

            <div className="mt-10 flex justify-end">
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="inline-flex items-center gap-2 bg-black text-white font-title font-bold uppercase tracking-wide px-8 py-4 rounded-full hover:bg-red-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting && (
                  <Loader2 className="w-5 h-5 animate-spin" />
                )}
                <span>
                  {submitting ? t.steps.cv.submitting : t.steps.cv.submit}
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
