import React, { useEffect, useRef } from "react";
import { href } from "../../lib/router";
import { opportunities } from "../../data/opportunities";
import { evidenceRecords } from "../../data/evidenceRecords";
import { intentTokens } from "../../data/intentTokens";
import { canonEntries, operatingPrimitives } from "../../data/canon";
import { ENGINES } from "../../data/engines";
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

/* ── state → chip tone helpers (read the real enums, render them) ──── */
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

/* ── the page ──────────────────────────────────────────────────────── */
export default function PublicHome() {
  const topOpp = opportunities[1];
  const canonized = evidenceRecords.find((r) => r.state === "CANONIZED");
  const revokedToken = intentTokens.find((t) => t.revoked);

  return (
    <div className="pub-page pub-page--cp">
      {/* 00 — HERO */}
      <section className="pub-hero pub-hero--cp" aria-label="Introduction">
        <ParticleCanvas />
        <div className="pub-hero-copy">
          <SectionLabel num="00" text="FABLE-5 · CONTROL PLANE FOR AI WORK" />
          <h1 className="pub-hero-title">
            Build companies that <span className="gold-shimmer">learn</span> before they{" "}
            <span className="gold-shimmer">spend</span>.
          </h1>
          <p className="pub-hero-sub">
            FABLE-5 runs every AI decision through one governed path — evidence, boundary, receipt, independent
            verification, measured outcome. Nothing is called progress until it is proven, and no cash moves
            without a founder-approved token.
          </p>
          <div className="pub-hero-actions">
            <a className="pub-btn pub-btn--gold" href={href("/founding-access")}>
              Enter founding access
            </a>
            <a className="pub-btn pub-btn--ghost" href={href("/how-it-works")}>
              View how it works
            </a>
          </div>
          <p className="pub-hero-fine">
            This page renders live from the real product data model — the same ledgers your control plane would
            hold. There is no invented pricing and no fabricated metrics anywhere on this site.
          </p>
        </div>

        <div className="pub-hero-console" aria-label="Live control-plane readout">
          <PanelHead label="LIVE CONSOLE" live />
          <div className="pub-console-row">
            <span className="pub-console-k">OPPORTUNITY #1</span>
            <span className="pub-console-v">
              {topOpp.title} · <span className="pub-console-hi">{topOpp.epistemicType}</span>
            </span>
            <span className="pub-console-m">
              score {topOpp.score} · EV {money.format(topOpp.expectedValue)}
            </span>
          </div>
          <div className="pub-console-row">
            <span className="pub-console-k">EVIDENCE LEDGER</span>
            <span className="pub-console-v">
              {canonized?.id} · {canonized?.state}
            </span>
            <span className="pub-console-m">
              {canonized?.measurement?.kpi} {canonized?.measurement?.value} vs threshold{" "}
              {canonized?.measurement?.threshold}
            </span>
          </div>
          <div className="pub-console-row">
            <span className="pub-console-k">CAPITAL</span>
            <span className="pub-console-v">
              {revokedToken?.tokenId} · <span className="pub-console-warn">REVOKED</span>
            </span>
            <span className="pub-console-m">
              {money.format(revokedToken?.maxAmount ?? 0)} frozen
            </span>
          </div>
          <div className="pub-console-row">
            <span className="pub-console-k">CANON</span>
            <span className="pub-console-v">
              {canonEntries.length} entries · {operatingPrimitives.length} primitive
            </span>
            <span className="pub-console-m">
              conf {canonEntries.map((c) => c.confidence.toFixed(2)).join(" / ")}
            </span>
          </div>
        </div>
      </section>

      {/* 01 — OPPORTUNITY QUEUE */}
      <section className="pub-section" aria-labelledby="cp-opp-title">
        <SectionLabel num="01" text="OPPORTUNITY QUEUE" />
        <h2 id="cp-opp-title" className="pub-h2">
          The ranked graph decides what gets attention — evidence, not narrative.
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

      {/* 02 — ACTIVE MISSIONS */}
      <section className="pub-section" aria-labelledby="cp-mission-title">
        <SectionLabel num="02" text="ACTIVE MISSIONS" />
        <h2 id="cp-mission-title" className="pub-h2">
          Every mission names its success criteria and its escalation condition up front.
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

      {/* 03 — EVIDENCE RAIL */}
      <section className="pub-section" aria-labelledby="cp-ev-title">
        <SectionLabel num="03" text="EVIDENCE RAIL" />
        <h2 id="cp-ev-title" className="pub-h2">
          Claims advance one gate at a time — PROPOSED → … → CANONIZED — and nothing skips a gate.
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
              {r.isFinancial && <p className="pub-panel-tag">FINANCIAL · requires Intent Token</p>}
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

      {/* 04 — CAPITAL VERDICTS */}
      <section className="pub-section" aria-labelledby="cp-cap-title">
        <SectionLabel num="04" text="CAPITAL VERDICTS" />
        <h2 id="cp-cap-title" className="pub-h2">
          No cash moves by default. Every spend path is an explicit, founder-approved token.
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

      {/* 05 — CANON MEMORY */}
      <section className="pub-section" aria-labelledby="cp-canon-title">
        <SectionLabel num="05" text="CANON MEMORY" />
        <h2 id="cp-canon-title" className="pub-h2">
          Only proven outcomes write back. What the company knows compounds in one place.
        </h2>
        <div className="pub-cp-grid pub-cp-grid--2">
          {canonEntries.map((c) => (
            <article className="pub-panel pub-panel--gold" key={c.id}>
              <div className="pub-panel-head">
                <span className="pub-panel-label">{c.id}</span>
                <Chip tone={c.kind === "pattern" ? "gold" : "warn"}>{c.kind}</Chip>
              </div>
              <h3 className="pub-panel-title">{c.title}</h3>
              <div className="pub-panel-metrics">
                <div className="pub-metric">
                  <span className="pub-metric-label">CONFIDENCE</span>
                  <Gauge value={c.confidence} max={1} digits={2} />
                </div>
                <div className="pub-metric">
                  <span className="pub-metric-label">ORIGIN</span>
                  <span className="pub-metric-val">{c.origin}</span>
                </div>
              </div>
            </article>
          ))}
          {operatingPrimitives.map((p) => (
            <article className="pub-panel" key={p.id}>
              <div className="pub-panel-head">
                <span className="pub-panel-label">{p.id}</span>
                <Chip tone="cyan">primitive</Chip>
              </div>
              <h3 className="pub-panel-title">{p.name}</h3>
              <div className="pub-panel-metrics">
                <div className="pub-metric">
                  <span className="pub-metric-label">CONFIDENCE</span>
                  <Gauge value={p.confidence} max={1} digits={2} />
                </div>
                <div className="pub-metric">
                  <span className="pub-metric-label">REUSABLE IN</span>
                  <span className="pub-metric-val">{p.reusableIn.join(", ")}</span>
                </div>
              </div>
              <p className="pub-panel-foot">{p.evidence}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 06 — CONTRADICTIONS & ESCALATIONS */}
      <section className="pub-section" aria-labelledby="cp-con-title">
        <SectionLabel num="06" text="CONTRADICTIONS & ESCALATIONS" />
        <h2 id="cp-con-title" className="pub-h2">
          Disagreements block progress until they are resolved. Boundaries re-assert themselves.
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
                    <span className="pub-panel-foot pub-panel-foot--dim"> · in {record.id} — {record.state}</span>
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

      {/* 07 — ENGINE MAP */}
      <section className="pub-section" aria-labelledby="cp-engine-title">
        <SectionLabel num="07" text="ENGINE MAP" />
        <h2 id="cp-engine-title" className="pub-h2">
          Nine engines, one substrate. Engine 07 is the hub every outcome writes back to.
        </h2>
        <div className="pub-engine-map">
          {ENGINES.map((e) => (
            <article
              className={`pub-panel pub-engine${e.id === "07" ? " pub-engine--hub" : ""}`}
              key={e.id}
            >
              <div className="pub-panel-head">
                <span className="pub-panel-label">E{e.id} · {e.name}</span>
                <Chip tone={e.id === "07" ? "gold" : "dim"}>{e.layer}</Chip>
              </div>
              <p className="pub-engine-role">{e.role}</p>
              {e.id === "07" && <p className="pub-engine-gate">{e.gate}</p>}
            </article>
          ))}
        </div>
      </section>

      {/* 08 — FINAL CTA */}
      <section className="pub-final" aria-label="Closing call to action">
        <SectionLabel num="08" text="THE OFFER" />
        <h2 className="pub-final-title">
          Stop managing AI output.{" "}
          <span className="gold-shimmer">Start governing company truth.</span>
        </h2>
        <p className="pub-lead">
          Founding access is granted directly by the founder of FABLE-5. No pricing page to hide behind — we prove
          it on your own company first.
        </p>
        <div className="pub-hero-actions">
          <a className="pub-btn pub-btn--gold" href={href("/founding-access")}>
            Enter founding access
          </a>
          <a className="pub-btn pub-btn--ghost" href={href("/how-it-works")}>
            How it works →
          </a>
        </div>
      </section>
    </div>
  );
}
