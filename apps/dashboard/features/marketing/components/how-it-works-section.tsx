"use client";

import { useRef } from "react";
import { useT } from "@/lib/i18n/context";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { HOW_IT_WORKS_SLIDES, type HowItWorksSlide } from "../constants/how-it-works";

const MOCK_UNIVERSITIES = [
  { name: "Peking University", picked: true },
  { name: "Nanjing University", picked: true },
  { name: "Sichuan University", picked: true },
  { name: "Beijing University of Technology", picked: false },
];
const APPLY_UNIVERSITY_COUNT = 3;

export function HowItWorksSection() {
  const t = useT();
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const pin = root.current;
        if (!pin) return;

        const panels = gsap.utils.toArray<HTMLElement>("[data-hiw-panel]");
        const captions = gsap.utils.toArray<HTMLElement>("[data-hiw-caption]");
        const ticks = gsap.utils.toArray<HTMLElement>("[data-hiw-tick]");
        const counter = pin.querySelector<HTMLElement>("[data-hiw-counter]");
        const steps = panels.length;
        if (steps === 0) return;

        gsap.set(panels.slice(1), { autoAlpha: 0, y: 16, filter: "blur(4px)" });
        gsap.set(captions.slice(1), { autoAlpha: 0, y: 16 });
        gsap.set(panels[0], { autoAlpha: 1, y: 0, filter: "blur(0px)" });
        gsap.set(captions[0], { autoAlpha: 1, y: 0 });

        const tl = gsap.timeline({ paused: true, defaults: { ease: "power2.inOut" } });

        panels.forEach((panel, i) => {
          if (i > 0) {
            tl.to(panels[i - 1], { autoAlpha: 0, y: -16, filter: "blur(4px)", duration: 0.4 });
            tl.to(captions[i - 1], { autoAlpha: 0, y: -12, duration: 0.18 }, "<");
            tl.fromTo(
              panel,
              { autoAlpha: 0, y: 16, filter: "blur(4px)" },
              { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.4 },
              "<",
            );
            tl.fromTo(
              captions[i],
              { autoAlpha: 0, y: 12 },
              { autoAlpha: 1, y: 0, duration: 0.25 },
              "<0.14",
            );
            if (ticks[i - 1]) tl.to(ticks[i - 1], { backgroundColor: "#e2e8f0", duration: 0.2 }, "<");
            if (ticks[i]) tl.to(ticks[i], { backgroundColor: "#2563eb", duration: 0.2 }, "<");
          }

          const kind = panel.dataset.kind;
          if (kind === "form") {
            const bar = panel.querySelector("[data-hiw-progress]");
            if (bar) tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 0.45, ease: "none" });
          }
          if (kind === "universities" || kind === "upload") {
            const marks = panel.querySelectorAll("[data-hiw-check]");
            tl.fromTo(
              marks,
              { scale: 0.25, autoAlpha: 0, filter: "blur(4px)" },
              { scale: 1, autoAlpha: 1, filter: "blur(0px)", stagger: 0.08, duration: 0.3 },
            );
          }
          if (kind === "apply") {
            const loading = panel.querySelector("[data-hiw-apply-loading]");
            const done = panel.querySelector("[data-hiw-apply-done]");
            gsap.set(done, { autoAlpha: 0 });
            tl.to(loading, { autoAlpha: 0, duration: 0.2 });
            tl.to(done, { autoAlpha: 1, duration: 0.2 }, "<");
          }
          if (kind === "status") {
            const a = panel.querySelector("[data-hiw-status-a]");
            const b = panel.querySelector("[data-hiw-status-b]");
            const c = panel.querySelector("[data-hiw-status-c]");
            gsap.set([b, c], { autoAlpha: 0 });
            tl.to(a, { autoAlpha: 0, duration: 0.15 });
            tl.to(b, { autoAlpha: 1, duration: 0.15 }, "<");
            tl.to(b, { autoAlpha: 0, duration: 0.15 });
            tl.to(c, { autoAlpha: 1, duration: 0.15 }, "<");
          }

          tl.addLabel(`step-${i}`);
        });

        tl.time(tl.labels["step-0"] ?? 0);

        let current = 0;
        let animating = false;
        let allowStep = true;

        const setCounter = (index: number) => {
          if (counter) counter.textContent = `${index + 1} / ${steps}`;
        };

        const unlock = gsap.delayedCall(0.28, () => {
          allowStep = true;
        }).pause();

        let st: ScrollTrigger;

        const goto = (index: number, scrollingDown: boolean) => {
          if ((index >= steps && scrollingDown) || (index < 0 && !scrollingDown)) {
            observer.disable();
            if (scrollingDown) st.scroll(st.end + 1);
            else st.scroll(Math.max(0, st.start - 1));
            return;
          }
          if (animating || !allowStep || index < 0 || index >= steps || index === current) return;

          animating = true;
          allowStep = false;
          current = index;
          setCounter(index);
          tl.tweenTo(`step-${index}`, {
            duration: 0.45,
            ease: "power2.inOut",
            overwrite: true,
            onComplete: () => {
              animating = false;
              allowStep = true;
            },
          });
        };

        const observer = ScrollTrigger.observe({
          type: "wheel,touch",
          tolerance: 10,
          preventDefault: true,
          onDown: () => goto(current + 1, true),
          onUp: () => goto(current - 1, false),
          onEnable() {
            allowStep = false;
            unlock.restart(true);
          },
          onDisable() {
            unlock.pause();
            allowStep = true;
            animating = false;
          },
        });
        observer.disable();

        const showStep = (index: number) => {
          current = index;
          tl.time(tl.labels[`step-${index}`] ?? 0);
          setCounter(index);
        };

        st = ScrollTrigger.create({
          trigger: pin,
          pin: true,
          start: "top top",
          end: "+=50%",
          invalidateOnRefresh: true,
          onEnter: () => {
            if (observer.isEnabled) return;
            showStep(0);
            observer.enable();
          },
          onEnterBack: () => {
            if (observer.isEnabled) return;
            showStep(steps - 1);
            observer.enable();
          },
          onLeave: () => observer.disable(),
          onLeaveBack: () => observer.disable(),
        });

        const onWheelCapture = (event: WheelEvent) => {
          if (observer.isEnabled || event.deltaY === 0) return;

          const top = pin.getBoundingClientRect().top;

          if (event.deltaY > 0 && top > 0 && top <= event.deltaY) {
            event.preventDefault();
            window.scrollTo(0, st.start);
            return;
          }

          if (event.deltaY < 0 && top < 0 && top - event.deltaY >= 0) {
            event.preventDefault();
            window.scrollTo(0, st.end);
          }
        };

        window.addEventListener("wheel", onWheelCapture, { passive: false, capture: true });

        return () => {
          unlock.kill();
          window.removeEventListener("wheel", onWheelCapture, { capture: true });
          observer.kill();
          st.kill();
        };
      });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        const pin = root.current;
        if (!pin) return;
        const panels = gsap.utils.toArray<HTMLElement>("[data-hiw-panel]");
        const captions = gsap.utils.toArray<HTMLElement>("[data-hiw-caption]");
        const last = panels.length - 1;
        if (last < 0) return;
        gsap.set(panels.slice(0, last), { opacity: 0 });
        gsap.set(panels[last], { opacity: 1, y: 0, filter: "none" });
        gsap.set(captions.slice(0, last), { opacity: 0 });
        gsap.set(captions[last], { opacity: 1, y: 0 });
      });
    },
    { scope: root },
  );

  return (
    <section id="how-it-works" className="border-t border-slate-100 bg-white">
      <div ref={root} className="flex h-svh flex-col justify-center">
        <div className="mx-auto w-full max-w-7xl px-6 py-8 lg:py-16">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
              {t.landing.howItWorks.badge}
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
              {t.landing.howItWorks.title}
            </h2>
            <p className="mt-3 text-base leading-7 text-slate-500">
              {t.landing.howItWorks.description}
            </p>
          </div>

          <div className="mt-10 grid items-center gap-10 lg:grid-cols-2">
            <div>
              <div className="relative min-h-24 overflow-hidden">
                {HOW_IT_WORKS_SLIDES.map((slide, index) => {
                  const caption = captionFor(slide, t.landing.howItWorks);
                  return (
                    <div
                      key={index}
                      data-hiw-caption
                      className="absolute inset-x-0 top-0"
                      style={{ opacity: index === 0 ? 1 : 0 }}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                        {caption.step}
                      </p>
                      <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                        {caption.title}
                      </h3>
                    </div>
                  );
                })}
              </div>
              <div className="mt-8 flex items-center gap-3">
                <div className="flex flex-1 gap-1.5" aria-hidden>
                  {HOW_IT_WORKS_SLIDES.map((_, index) => (
                    <span
                      key={index}
                      data-hiw-tick
                      className={`h-1 flex-1 rounded-full ${index === 0 ? "bg-blue-600" : "bg-slate-200"}`}
                    />
                  ))}
                </div>
                <span
                  data-hiw-counter
                  className="shrink-0 text-xs font-medium tabular-nums text-slate-400"
                >
                  1 / {HOW_IT_WORKS_SLIDES.length}
                </span>
              </div>
            </div>

            <div className="relative mx-auto h-[min(22rem,42vh)] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08),0_12px_45px_rgba(15,23,42,0.06)] ring-1 ring-black/5 lg:h-[min(26.25rem,52vh)]">
              <div className="flex h-9 items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
              </div>

              {HOW_IT_WORKS_SLIDES.map((slide, index) => (
                <div
                  key={index}
                  data-hiw-panel
                  data-kind={slide.kind}
                  className="absolute inset-x-0 top-9 bottom-0 p-6"
                  style={{ opacity: index === 0 ? 1 : 0 }}
                >
                  {slide.kind === "form" ? (
                    <FormSlide {...slide} />
                  ) : slide.kind === "upload" ? (
                    <UploadSlide />
                  ) : slide.kind === "universities" ? (
                    <UniversitiesSlide />
                  ) : slide.kind === "apply" ? (
                    <ApplySlide />
                  ) : (
                    <StatusSlide />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function captionFor(
  slide: HowItWorksSlide,
  copy: {
    documentsLabel: string;
    uploadTitle: string;
    universitiesLabel: string;
    chooseTitle: string;
    oneClickLabel: string;
    applyTitle: string;
    statusLabel: string;
    statusTitle: string;
  },
) {
  if (slide.kind === "form") return { step: slide.step, title: slide.title };
  if (slide.kind === "upload") return { step: copy.documentsLabel, title: copy.uploadTitle };
  if (slide.kind === "universities") return { step: copy.universitiesLabel, title: copy.chooseTitle };
  if (slide.kind === "apply") return { step: copy.oneClickLabel, title: copy.applyTitle };
  return { step: copy.statusLabel, title: copy.statusTitle };
}

function FormSlide({
  step,
  title,
  fields,
}: {
  step: string;
  title: string;
  fields: { label: string; labelEn: string; value: string }[];
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
        <div data-hiw-progress className="h-full origin-left scale-x-0 rounded-full bg-blue-600 motion-reduce:scale-x-100" />
      </div>
      <p className="mt-3 text-xs font-semibold text-blue-600">{step}</p>
      <h3 className="mt-1 text-sm font-semibold text-slate-950">{title}</h3>

      <div className="mt-4 flex flex-col gap-2.5">
        {fields.map((field) => (
          <div key={field.labelEn}>
            <div className="text-[11px] text-slate-400">
              {field.label} / {field.labelEn}
            </div>
            <div className="mt-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800">
              {field.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UploadSlide() {
  const t = useT();

  return (
    <div className="flex h-full flex-col">
      <p className="text-xs font-semibold text-blue-600">{t.landing.howItWorks.documentsLabel}</p>
      <h3 className="mt-1 text-sm font-semibold text-slate-950">
        {t.landing.howItWorks.uploadTitle}
      </h3>
      <div className="mt-4 flex flex-col gap-2.5">
        {t.landing.howItWorks.mockDocuments.map((name) => (
          <div
            key={name}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"
          >
            <span className="text-xs font-medium text-slate-800">{name}</span>
            <span
              data-hiw-check
              className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"
            >
              <CheckIcon />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function UniversitiesSlide() {
  const t = useT();

  return (
    <div className="flex h-full flex-col">
      <p className="text-xs font-semibold text-blue-600">{t.landing.howItWorks.universitiesLabel}</p>
      <h3 className="mt-1 text-sm font-semibold text-slate-950">
        {t.landing.howItWorks.chooseTitle}
      </h3>
      <div className="mt-4 flex flex-col gap-2.5">
        {MOCK_UNIVERSITIES.map((university) => (
          <div
            key={university.name}
            className={`flex items-center justify-between rounded-lg border px-3 py-2.5 ${
              university.picked
                ? "border-blue-200 bg-blue-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <span className="text-xs font-medium text-slate-800">
              {university.name}
            </span>
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-md border text-white ${
                university.picked
                  ? "border-blue-600 bg-blue-600"
                  : "border-slate-300 bg-white"
              }`}
            >
              {university.picked ? (
                <span data-hiw-check>
                  <CheckIcon />
                </span>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ApplySlide() {
  const t = useT();

  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <p className="text-xs font-semibold text-blue-600">{t.landing.howItWorks.oneClickLabel}</p>
      <h3 className="mt-1 text-sm font-semibold text-slate-950">
        {t.landing.howItWorks.applyTitle}
      </h3>

      <div className="relative mt-6 flex h-12 w-56 items-center justify-center">
        <div
          data-hiw-apply-loading
          className="absolute inset-0 flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white motion-reduce:opacity-0"
        >
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          {t.landing.howItWorks.submitting}
        </div>
        <div
          data-hiw-apply-done
          className="absolute inset-0 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white opacity-0 motion-reduce:opacity-100"
        >
          <CheckIcon />
          {APPLY_UNIVERSITY_COUNT} {t.landing.howItWorks.applicationsSubmitted}
        </div>
      </div>
    </div>
  );
}

function StatusSlide() {
  const t = useT();

  return (
    <div className="flex h-full flex-col">
      <p className="text-xs font-semibold text-blue-600">{t.landing.howItWorks.statusLabel}</p>
      <h3 className="mt-1 text-sm font-semibold text-slate-950">
        {t.landing.howItWorks.statusTitle}
      </h3>
      <div className="mt-4 flex flex-col gap-2.5">
        <StatusRow name="Peking University" tone="ring-emerald-100 bg-emerald-50 text-emerald-700" label={t.landing.howItWorks.statusSubmitted} />
        <StatusRow name="Nanjing University" tone="ring-emerald-100 bg-emerald-50 text-emerald-700" label={t.landing.howItWorks.statusSubmitted} />
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
          <span className="text-xs font-medium text-slate-800">
            Sichuan University
          </span>
          <span className="relative inline-flex h-5 w-24 shrink-0 items-center justify-end">
            <span
              data-hiw-status-a
              className="absolute right-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200 motion-reduce:opacity-0"
            >
              {t.landing.howItWorks.statusDraft}
            </span>
            <span
              data-hiw-status-b
              className="absolute right-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 opacity-0 ring-1 ring-amber-100"
            >
              {t.landing.howItWorks.statusInProgress}
            </span>
            <span
              data-hiw-status-c
              className="absolute right-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 opacity-0 ring-1 ring-emerald-100 motion-reduce:opacity-100"
            >
              {t.landing.howItWorks.statusSubmitted}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

function StatusRow({
  name,
  label,
  tone,
}: {
  name: string;
  label: string;
  tone: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
      <span className="text-xs font-medium text-slate-800">{name}</span>
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${tone}`}>
        {label}
      </span>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m5 13 4 4L19 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
