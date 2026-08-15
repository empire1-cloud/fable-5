import React, { useEffect, useRef } from "react";
import { href } from "../../lib/router";
import { opportunities } from "../../data/opportunities";
import { evidenceRecords } from "../../data/evidenceRecords";
import { intentTokens } from "../../data/intentTokens";
import { canonEntries, operatingPrimitives } from "../../data/canon";
import { ENGINES, ENGINE_MAP } from "../../data/engines";
import { SEED_MISSIONS } from "../../data/missions";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/* ── ambient particle field behind the hero ────────────────────────── */
function ParticleCanvas() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const dots = Array.from({ length: 56 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0004,
      vy: (Math.random() - 0.5) * 0.0004,
      r: Math.random() * 1.6 + 0.6,
      ph: Math.random() * Math.PI * 2,
    }));
    let w = 0;
    let h = 0;
    let raf = 0;
    let t = 0;

    const resize = () => {
      w = canvas.offsetWidth;
      h = canvas.offsetHeight;
      canvas.width = Math.max(1, Math.round(w * DPR));
      canvas.height = Math.max(1, Math.round(h * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const step = () => {
      t += 1;
      ctx.clearRect(0, 0, w, h);
      for (const d of dots) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0) d.x += 1;
        if (d.x > 1) d.x -= 1;
        if (d.y < 0) d.y += 1;
        if (d.y > 1) d.y -= 1;
        const tw = 0.5 + 0.5 * Math.sin(t * 0.02 + d.ph);
        ctx.beginPath();
        ctx.arc(d.x * w, d.y * h, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212, 175, 55, ${0.1 + 0.2 * tw})`;
        ctx.fill();
      }
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const a = dots[i];
          const b = dots[j];
          const dx = (a.x - b.x) * w;
          const dy = (a.y - b.y) * h;
          const dist = Math.hypot(dx, dy);
          if (dist < 110) {
            ctx.beginPath();
            ctx.moveTo(a.x * w, a.y * h);
            ctx.lineTo(b.x * w, b.y * h);
            ctx.strokeStyle = `rgba(212, 175, 55, ${(1 - dist / 110) * 0.08})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="pub-canvas" aria-hidden="true" />;
}

/* ── small presentational helpers ──────────────────────────────────── */
type ChipTone = "gold" | "dim" | "warn" | "cyan";

function Chip({ tone = "dim", children }: { tone?: ChipTone; children: React.ReactNode }) {
  return <span className={`pub-chip pub-chip--${tone}`}>{children}</span>;
}

function Gauge({ value, max = 100, digits = 0 }: { value: number; max?: number; digits?: number }) {
  const pct = Math.max(2, Math.min(100, (value / max) * 100));
  return (
    <div className="pub-gauge" aria-hidden="true">
      <span className="pub-gauge-num">{value.toFixed(digits)}</span>
      <span className="pub-gauge-track">
        <span className="pub-gauge-fill" style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

function PanelHead({ label, live = false, right }: { label: string; live?: boolean; right?: string }) {
  return (
    <div className="pub-panel-head">
      <span className="pub-panel-label">{label}</span>
      <span className="pub-panel-side">
        {live && (
          <span className="pub-panel-live">
            <span className="pub-live-dot" /> LIVE
          </span>
        )}
        {right && <span className="pub-panel-right">{right}</span>}
      </span>
    </div>
  );
}

function SectionLabel({ num, text }: { num: string; text: string }) {
  return (
    <div className="pub-sectlabel">
      <span className="pub-sectnum">{num}</span>
      <span className="pub-sectrule" aria-hidden="true" />
      <span className="pub-secttext">{text}</span>
    </div>
  );
}

/* ── state → chip tone helpers ─────────────────────────────────────── */
function missionTone(status: string): ChipTone {
  if (status === "ACTIVE") return "gold";
  if (status === "BLOCKED") return "warn";
  return "dim";
}

function stateTone(state: string): ChipTone {
  if (["VERIFIED", "MEASURED", "LEARNED", "CANONIZED"].includes(state)) return "gold";
  if (["BLOCKED", "KILLED"].includes(state)) return "warn";
  return "dim";
}

function epistemicTone(type: string): ChipTone {
  if (type === "FACT") return "gold";
  if (type === "FORECAST") return "cyan";
  return "dim";
}

function tokenStatus(t: (typeof intentTokens)[number]): { label: string; tone: ChipTone } {
  if (t.revoked) return { label: "REVOKED", tone: "warn" };
  const expired = new Date(t.expiresAt).getTime() < Date.now();
  return expired ? { label: "EXPIRED", tone: "dim" } : { label: "ACTIVE", tone: "gold" };
}

/* ── the company loop — the evidence lifecycle every piece of work runs ── */
const LIFE_CYCLE: { id: string; label: string; role: string }[] = [
  { id: "01", label: "PROPOSED", role: "The company proposes. Ideas enter as ranked claims." },
  { id: "02", label: "AUTHORIZED", role: "The company decides. Gates are met; permission is granted." },
  { id: "03", label: "EXECUTED", role: "The company acts. Work ships; the evidence trail opens." },
  { id: "04", label: "RECEIPTED", role: "The company proves. Every action must produce a receipt." },
  { id: "05", label: "VERIFIED", role: "The company checks. Nothing counts unless independently confirmed." },
  { id: "06", label: "MEASURED", role: "The company measures. Results are read against typed gates." },
  { id: "07", label: "LEARNED", role: "The company learns. What worked becomes a supported lesson." },
  { id: "08", label: "CANONIZED", role: "The company remembers. Lessons become institutional memory." },
];

const DEPARTMENTS = [
  { e: "00", name: "Strategy", core: false },
  { e: "01", name: "Markets", core: false },
  { e: "02", name: "Products", core: false },
  { e: "03", name: "Operations", core: false },
  { e: "04", name: "Growth", core: false },
  { e: "05", name: "Finance", core: false },
  { e: "06", name: "Scale", core: false },
  { e: "07", name: "Memory", core: true },
  { e: "08", name: "Capital", core: true },
];

/* The department count is DERIVED from the grid above, never typed into copy.
   A headline once claimed "ten departments" while the grid rendered nine and
   the engine registry (plus its test) held exactly nine — on a page whose
   whole claim is that every number is evidenced, the count is the one thing
   that cannot drift. */
const DEPT_COUNT = DEPARTMENTS.length;
const DEPT_WORD =
  ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][DEPT_COUNT] ??
  String(DEPT_COUNT);

const COMPARISON: { today: string; fable: string }[] = [
  { today: "Buy AI tools", fable: "Run an AI company" },
  { today: "Separate software", fable: "Unified operating system" },
  { today: "Activity", fable: "Outcomes" },
  { today: "Dashboards", fable: "Decisions" },
  { today: "Reports", fable: "Governance" },
  { today: "Automation", fable: "Company execution" },
  { today: "AI assistants", fable: "AI workforce" },
];

const PROMISES = [
  {
    title: "Never repeat the same expensive mistake twice.",
    body: "What gets killed stays known. Negative intelligence is kept, not deleted — the next company that tries the same thing finds it before it spends.",
    tag: "MEMORY",
  },
  {
    title: "Know why every decision was made.",
    body: "Every decision carries its evidence, its assumptions, and the authority that allowed it. Nothing is a one-off you have to re-explain.",
    tag: "DECISIONS",
  },
  {
    title: "See who approved every dollar.",
    body: "Cash moves only on a founder-approved, in-scope token. Every dollar has an owner, a ceiling, and a logged trail.",
    tag: "CAPITAL",
  },
  {
    title: "Prove every result.",
    body: "A claim counts as done only when it is independently verified. Until then it is labelled exactly what it is: a claim.",
    tag: "PROOF",
  },
];

/* ── live-company counts, computed from real demo data ─────────────── */
const LIVE = {
  decisions: opportunities.length,
  missionsInMotion: SEED_MISSIONS.filter((m) => m.status !== "BLOCKED").length,
  missionsBlocked: SEED_MISSIONS.filter((m) => m.status === "BLOCKED").length,
  evidence: evidenceRecords.length,
  tokens: intentTokens.length,
  revoked: intentTokens.filter((t) => t.revoked).length,
  expired: intentTokens.filter((t) => !t.revoked && new Date(t.expiresAt).getTime() < Date.now()).length,
  contradictions: evidenceRecords.flatMap((r) => r.contradictions).filter((c) => !c.resolved).length,
  memory: canonEntries.length + operatingPrimitives.length,
};

/* ── the page ──────────────────────────────────────────────────────── */
export default function PublicHome() {
  return (
    <div className="pub-page pub-page--cp">
      {/* 00 — THE HERO: a live company, not a pitch */}
      <section className="pub-hero pub-hero--live" aria-label="A live company running on FABLE-5">
        <ParticleCanvas />
        <div className="pub-hero-inner">
          <SectionLabel num="00" text="FABLE-5 · THE GOVERNANCE LAYER FOR AI-NATIVE COMPANIES" />

          <h1 className="pub-hero-title pub-hero-title--live">
            This company is <span className="gold-shimmer">alive.</span>
          </h1>

          {/* live readout — real counts from the product's own data model */}
          <div className="pub-console" aria-label="Live company readout">
            <div className="pub-console-bar">
              <span className="pub-console-dots" aria-hidden="true">
                <i /><i /><i />
              </span>
              <span className="pub-console-title">FABLE-5 · LIVE COMPANY</span>
              <span className="pub-console-live">
                <span className="pub-live-dot" /> LIVE
              </span>
            </div>
            <div className="pub-console-body">
              <div className="pub-console-hline" />
              <ConsoleRow k="LIVE DECISIONS" v={String(LIVE.decisions)} m="ranked by evidence" />
              <ConsoleRow k="MISSIONS IN MOTION" v={String(LIVE.missionsInMotion)} m={`${LIVE.missionsBlocked} blocked`} />
              <ConsoleRow k="EVIDENCE RECORDS" v={String(LIVE.evidence)} m="proof-gated" />
              <ConsoleRow k="CAPITAL TOKENS" v={String(LIVE.tokens)} m={`${LIVE.revoked} revoked · ${LIVE.expired} expired`} />
              <ConsoleRow k="CONTRADICTIONS" v={String(LIVE.contradictions)} m="blocking a decision" tone="warn" />
              <ConsoleRow k="MEMORY WRITTEN" v={String(LIVE.memory)} m="proven outcomes only" />
              <div className="pub-console-hline" />
              <ConsoleRow k="MEMORY" v="NORMAL" m="remembers everything" />
              <ConsoleRow k="CAPITAL" v="NO SILENT SPENDING" m="permission required" tone="warn" />
              <ConsoleRow k="VERIFICATION" v="ENFORCED" m="nothing skips the gate" tone="info" />
              <span className="pub-console-cursor" aria-hidden="true">█</span>
            </div>
          </div>

          <p className="pub-hero-sub pub-hero-sub--live">
            FABLE-5 is the governance layer for AI-native companies. It sits on top of your agents and decides what
            counts as done — across the whole company, strategy to scale, not one automated department.
          </p>

          <div className="pub-hero-actions">
            <a className="pub-btn pub-btn--gold" href={href("/founding-access")}>
              Enter founding access
            </a>
            <a className="pub-btn pub-btn--ghost" href={href("/how-it-works")}>
              How it works →
            </a>
          </div>

          <p className="pub-hero-fine">
            Every number above is real — computed from the product's own data model. There is no invented pricing and
            no fabricated metrics on this site.
          </p>
        </div>
      </section>

      {/* 01 — THE COMPANY LOOP */}
      <section className="pub-section" aria-labelledby="cp-loop-title">
        <SectionLabel num="01" text="THE COMPANY LOOP" />
        <h2 id="cp-loop-title" className="pub-h2">
          One path runs the whole company — every decision, every action, through the same gates.
        </h2>
        <div className="pub-panel pub-panel--plain pub-loop-panel">
          <PanelHead label="PROPOSED → AUTHORIZED → EXECUTED → RECEIPTED → VERIFIED → MEASURED → LEARNED → CANONIZED" />
          <div className="pub-loop">
            {LIFE_CYCLE.map((s, i) => (
              <div className="pub-loop-step" key={s.id}>
                <span className="pub-loop-e">{s.id}</span>
                <span className="pub-loop-name">{s.label}</span>
                <span className="pub-loop-role">{s.role}</span>
                {i < LIFE_CYCLE.length - 1 && (
                  <span className="pub-loop-arrow" aria-hidden="true">
                    ↓
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="pub-loop-divider" aria-hidden="true">
            ────────────────
          </div>
          <div className="pub-loop-governed">
            {["Every decision", "Every action", "Every dollar", "Every lesson"].map((g) => (
              <span key={g} className="pub-loop-governed-item">
                {g}
              </span>
            ))}
            <span className="pub-loop-governed-item pub-loop-governed-item--gold">Governed.</span>
          </div>
          <p className="pub-loop-sub">
            Memory and Capital sit under the whole loop — one remembers everything, one lets no dollar move without
            permission. Nothing advances without them.
          </p>
        </div>
      </section>

      {/* 02 — TODAY vs FABLE-5 */}
      <section className="pub-section" aria-labelledby="cp-market-title">
        <SectionLabel num="02" text="THE CATEGORY" />
        <h2 id="cp-market-title" className="pub-h2">
          You were never buying a category. You were buying {DEPT_WORD} departments.
        </h2>
        <div className="pub-compare-wrap">
          <table className="pub-compare">
            <thead>
              <tr>
                <th>Today</th>
                <th>FABLE-5</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.today}>
                  <td>{row.today}</td>
                  <td className="pub-compare-fable">{row.fable}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="pub-note">
          Salesforce, HubSpot, Monday, Jira, Notion, Stripe, GitHub, OpenAI, Ramp, Rippling — every one solves a
          department. Nobody says <em className="pub-em">"this runs the company."</em> That's the category FABLE-5
          exists in.
        </p>
      </section>

      {/* 03 — YOUR COMPANY REMEMBERS */}
      <section className="pub-section" aria-labelledby="cp-remember-title">
        <SectionLabel num="03" text="YOUR COMPANY REMEMBERS" />
        <div className="pub-remember-grid">
          <div>
            <h2 id="cp-remember-title" className="pub-remember-stanza">
              Companies forget.
              <br />
              <span className="pub-remember-dim">People leave. Chats disappear. Docs drift. AI forgets.</span>
              <br />
              FABLE-5 <span className="gold-shimmer">doesn't.</span>
            </h2>
            <p className="pub-remember-sub">
              Every lesson becomes institutional memory. Your company keeps what it learned, what it killed, and why —
              long after the people and the threads are gone.
            </p>
          </div>

          <div className="pub-panel pub-panel--gold">
            <PanelHead label="WHAT THIS COMPANY ALREADY REMEMBERS" right={`${LIVE.memory} entries`} />
            {canonEntries.map((c) => (
              <div className="pub-remember-entry" key={c.id}>
                <div className="pub-remember-entry-head">
                  <span className="pub-remember-entry-id">{c.id}</span>
                  <Chip tone={c.kind === "pattern" ? "gold" : "warn"}>{c.kind}</Chip>
                </div>
                <p className="pub-remember-entry-text">{c.title}</p>
                <p className="pub-remember-entry-meta">
                  learned from {c.origin} · confidence {c.confidence.toFixed(2)}
                </p>
              </div>
            ))}
            {operatingPrimitives.map((p) => (
              <div className="pub-remember-entry" key={p.id}>
                <div className="pub-remember-entry-head">
                  <span className="pub-remember-entry-id">{p.id}</span>
                  <Chip tone="cyan">reusable</Chip>
                </div>
                <p className="pub-remember-entry-text">{p.name}</p>
                <p className="pub-remember-entry-meta">
                  {p.evidence} · reusable in {p.reusableIn.join(", ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 04 — THE PROMISES */}
      <section className="pub-section" aria-labelledby="cp-promise-title">
        <SectionLabel num="04" text="THE PROMISES" />
        <h2 id="cp-promise-title" className="pub-h2">
          Four promises. Four outcomes.
        </h2>
        <div className="pub-cp-grid pub-cp-grid--2">
          {PROMISES.map((p) => (
            <article className="pub-panel pub-panel--gold" key={p.tag}>
              <div className="pub-panel-head">
                <Chip tone="gold">{p.tag}</Chip>
              </div>
              <h3 className="pub-panel-title pub-promise-title">{p.title}</h3>
              <p className="pub-card-body">{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 05 — THE COMPANY DECIDES */}
      <section className="pub-section" aria-labelledby="cp-opp-title">
        <SectionLabel num="05" text="STRATEGY · THE COMPANY DECIDES" />
        <h2 id="cp-opp-title" className="pub-h2">
          The OS decides what deserves attention — ranked by evidence, not narrative.
        </h2>
        <div className="pub-cp-grid pub-cp-grid--3">
          {opportunities.map((o, i) => (
            <article className="pub-panel pub-panel--gold" key={o.id}>
              <div className="pub-panel-head">
                <span className="pub-panel-label">#{i + 1} · {o.id}</span>
                <Chip tone={epistemicTone(o.epistemicType)}>{o.epistemicType}</Chip>
              </div>
              <h3 className="pub-panel-title">{o.title}</h3>
              <div className="pub-panel-metrics">
                <div className="pub-metric">
                  <span className="pub-metric-label">SCORE</span>
                  <Gauge value={o.score} />
                </div>
                <div className="pub-metric">
                  <span className="pub-metric-label">EXPECTED VALUE</span>
                  <span className="pub-metric-val">{money.format(o.expectedValue)}</span>
                </div>
                <div className="pub-metric">
                  <span className="pub-metric-label">CONFIDENCE</span>
                  <Gauge value={o.confidence} max={1} digits={2} />
                </div>
                <div className="pub-metric">
                  <span className="pub-metric-label">RISK</span>
                  <Chip tone={o.risk === "low" ? "gold" : o.risk === "high" ? "warn" : "dim"}>
                    {o.risk.toUpperCase()}
                  </Chip>
                </div>
              </div>
              <ul className="pub-panel-list">
                {o.evidence.map((e) => (
                  <li key={e}>▸ {e}</li>
                ))}
              </ul>
              <p className="pub-panel-foot">next · {o.nextExperiment}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 06 — THE COMPANY EXECUTES */}
      <section className="pub-section" aria-labelledby="cp-mission-title">
        <SectionLabel num="06" text="OPERATIONS · THE COMPANY EXECUTES" />
        <h2 id="cp-mission-title" className="pub-h2">
          Every mission names its success criteria and its stop condition up front.
        </h2>
        <div className="pub-panel pub-panel--plain">
          <PanelHead label="MISSION QUEUE" right={`${SEED_MISSIONS.length} missions`} />
          <ul className="pub-queue">
            {SEED_MISSIONS.map((m) => (
              <li className="pub-queue-row" key={m.id}>
                <span className="pub-queue-id">{m.id}</span>
                <span className="pub-queue-obj">
                  {m.objective}
                  {m.blocker && <span className="pub-queue-block"> · {m.blocker}</span>}
                </span>
                <span className="pub-queue-owner">{m.owner}</span>
                <span className="pub-queue-meta">
                  {m.autonomy} · E{m.engineId} · {m.budget}
                </span>
                <Chip tone={missionTone(m.status)}>{m.status}</Chip>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 07 — NOTHING IS PROGRESS UNTIL IT IS PROVEN */}
      <section className="pub-section" aria-labelledby="cp-ev-title">
        <SectionLabel num="07" text="PROOF · NOTHING COUNTS TWICE" />
        <h2 id="cp-ev-title" className="pub-h2">
          A claim only counts when it is proven — one gate at a time, nothing skips.
        </h2>
        <div className="pub-rail">
          {evidenceRecords.map((r) => (
            <article className="pub-panel pub-panel--rail" key={r.id}>
              <div className="pub-panel-head">
                <span className="pub-panel-label">{r.id}</span>
                <Chip tone={stateTone(r.state)}>{r.state}</Chip>
              </div>
              <h3 className="pub-panel-title">{r.subject}</h3>
              <div className="pub-panel-metrics">
                <div className="pub-metric">
                  <span className="pub-metric-label">CONFIDENCE</span>
                  <Gauge value={r.confidence} max={1} digits={2} />
                </div>
                <div className="pub-metric">
                  <span className="pub-metric-label">RECEIPTS</span>
                  <span className="pub-metric-val">{r.evidence.length}</span>
                </div>
                <div className="pub-metric">
                  <span className="pub-metric-label">CONTRADICTIONS</span>
                  <span className="pub-metric-val">
                    {r.contradictions.length > 0 ? (
                      <Chip tone="warn">{r.contradictions.length}</Chip>
                    ) : (
                      "0"
                    )}
                  </span>
                </div>
              </div>
              {r.isFinancial && <p className="pub-panel-tag">FINANCIAL · permission required</p>}
              {r.measurement && (
                <p className="pub-panel-tag">
                  {r.measurement.kpi} {r.measurement.value} vs threshold {r.measurement.threshold}{" "}
                  {r.measurement.passed ? "· PASSED" : "· FAILED"}
                </p>
              )}
              {r.failureReason && <p className="pub-panel-tag pub-panel-tag--warn">{r.failureReason}</p>}
            </article>
          ))}
        </div>
      </section>

      {/* 08 — NO MONEY WITHOUT PERMISSION */}
      <section className="pub-section" aria-labelledby="cp-cap-title">
        <SectionLabel num="08" text="CAPITAL · NO MONEY WITHOUT PERMISSION" />
        <h2 id="cp-cap-title" className="pub-h2">
          The company cannot spend money without permission. Here is the proof.
        </h2>
        <div className="pub-cp-grid pub-cp-grid--3">
          {intentTokens.map((t) => {
            const s = tokenStatus(t);
            const last = t.auditLog[t.auditLog.length - 1];
            return (
              <article className="pub-panel" key={t.tokenId}>
                <div className="pub-panel-head">
                  <span className="pub-panel-label">{t.tokenId}</span>
                  <Chip tone={s.tone}>{s.label}</Chip>
                </div>
                <h3 className="pub-panel-title">{t.action}</h3>
                <div className="pub-panel-metrics">
                  <div className="pub-metric">
                    <span className="pub-metric-label">CEILING</span>
                    <span className="pub-metric-val">
                      {money.format(t.maxAmount)} {t.currency}
                    </span>
                  </div>
                  <div className="pub-metric">
                    <span className="pub-metric-label">ENV</span>
                    <Chip tone={t.environment === "prod" ? "gold" : "cyan"}>{t.environment}</Chip>
                  </div>
                  <div className="pub-metric">
                    <span className="pub-metric-label">EXPIRY</span>
                    <span className="pub-metric-val">{t.expiresAt.slice(0, 10)}</span>
                  </div>
                </div>
                <p className="pub-panel-foot">
                  {t.vendorOrSystem} · {t.recurrence}
                </p>
                {last && (
                  <p className="pub-panel-foot pub-panel-foot--dim">
                    {last.actor} → {last.action}: {last.detail}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* 09 — BAD DECISIONS, REFUSED */}
      <section className="pub-section" aria-labelledby="cp-con-title">
        <SectionLabel num="09" text="MEMORY · BAD DECISIONS, REFUSED" />
        <h2 id="cp-con-title" className="pub-h2">
          Disagreement blocks progress until it is resolved. Boundaries re-assert themselves.
        </h2>
        <div className="pub-cp-grid pub-cp-grid--2">
          <div className="pub-panel pub-panel--warn">
            <PanelHead label="OPEN CONTRADICTIONS" />
            <ul className="pub-panel-list">
              {evidenceRecords
                .flatMap((r) => r.contradictions.map((c) => ({ record: r, c })))
                .filter(({ c }) => !c.resolved)
                .map(({ record, c }) => (
                  <li key={c.id}>
                    <Chip tone="warn">{c.id}</Chip> {c.description}
                    <span className="pub-panel-foot pub-panel-foot--dim">
                      {" "}· in {record.id} — {record.state}
                    </span>
                  </li>
                ))}
              {SEED_MISSIONS.filter((m) => m.status === "BLOCKED").map((m) => (
                <li key={`block-${m.id}`}>
                  <Chip tone="warn">BLOCKED</Chip> {m.objective}
                  <span className="pub-panel-foot pub-panel-foot--dim"> · {m.blocker}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="pub-panel">
            <PanelHead label="ESCALATION LATCHES" />
            <ul className="pub-panel-list">
              {ENGINES.filter((e) => ["07", "08", "01"].includes(e.id)).map((e) => (
                <li key={`esc-${e.id}`}>
                  <Chip tone="dim">E{e.id}</Chip> {e.escalation[0]}
                </li>
              ))}
              {intentTokens
                .filter((t) => t.revoked)
                .map((t) => (
                  <li key={`rev-${t.tokenId}`}>
                    <Chip tone="warn">{t.tokenId}</Chip> {t.auditLog[t.auditLog.length - 1]?.detail}
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 10 — NINE DEPARTMENTS, ONE OPERATING SYSTEM */}
      <section className="pub-section" aria-labelledby="cp-dept-title">
        <SectionLabel num="10" text="THE OPERATING SYSTEM" />
        <h2 id="cp-dept-title" className="pub-h2">
          {DEPT_WORD.charAt(0).toUpperCase() + DEPT_WORD.slice(1)} departments. One operating system.
        </h2>
        <div className="pub-dept-grid">
          {DEPARTMENTS.map((d) => {
            const e = ENGINE_MAP[d.e];
            return (
              <article className={`pub-panel pub-dept${d.core ? " pub-dept--core" : ""}`} key={d.e}>
                <h3 className="pub-dept-name">{d.name}</h3>
                <p className="pub-dept-role">{e.role}</p>
              </article>
            );
          })}
        </div>
        <p className="pub-note pub-dept-under">
          One substrate runs them all — the same memory, the same boundaries, the same ledger underneath every
          department.
        </p>
      </section>

      {/* 11 — FINAL CTA */}
      <section className="pub-final" aria-label="Closing call to action">
        <SectionLabel num="11" text="THE OFFER" />
        <h2 className="pub-final-title">
          The operating system for the{" "}
          <span className="gold-shimmer">AI-native company.</span>
        </h2>
        <p className="pub-final-spec">
          {DEPARTMENTS.length} departments. One governed execution layer. Every action evidenced, every dollar
          authorized, every outcome accountable.
        </p>
        <p className="pub-lead">
          Founding access is granted directly by the founder of FABLE-5. No pricing page to hide behind — we prove
          it on your own company first.
        </p>
        <div className="pub-hero-actions">
          <a className="pub-btn pub-btn--gold" href={href("/signup")}>
            Run your company
          </a>
          <a className="pub-btn pub-btn--ghost" href={href("/how-it-works")}>
            See the system →
          </a>
        </div>
      </section>
    </div>
  );
}

/* ── console row ───────────────────────────────────────────────────── */
function ConsoleRow({
  k,
  v,
  m,
  tone = "ok",
}: {
  k: string;
  v: string;
  m?: string;
  tone?: "ok" | "warn" | "info";
}) {
  return (
    <div className="pub-console-row">
      <span className="pub-console-k">{k}</span>
      <span className={`pub-console-v pub-console-v--${tone}`}>{v}</span>
      {m && <span className="pub-console-m">{m}</span>}
    </div>
  );
}
