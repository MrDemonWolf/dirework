// Marketing home page (`/`) of the docs site. A server component, statically exported with
// the rest of the site to GitHub Pages; the only client JS is the OverlayThemePreview island.
// Styles live in marketing.css (`.marketing*` classes, so they don't leak into docs pages).

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowRight, Check, MessageSquare, Monitor, Radio, Timer } from "lucide-react";
import {
  BRAND,
  DEMO_SESSION,
  type DemoChatLine,
  cycleLabel,
  formatClock,
} from "@dirework/overlay-kit";
import { GithubIcon } from "@/components/icons/github-icon";
import { ChatCommandWidget } from "./_widgets/ChatCommandWidget";
import { OverlayThemePreview } from "./_widgets/OverlayThemePreview";
import "./marketing.css";

const GITHUB = "https://github.com/mrdemonwolf/dirework";

/**
 * Home-page metadata; overrides the root layout's default description. The title is
 * absolute, bypassing the root layout's `%s | DireWork` template.
 */
export const metadata: Metadata = {
  // absolute: the layout's "%s | DireWork" template would repeat the brand.
  title: { absolute: BRAND.title },
  description: BRAND.description,
  alternates: { canonical: "/" },
};

const SCENE_TASKS = DEMO_SESSION.tasks;
const SCENE_DONE = SCENE_TASKS.filter((t) => t.status === "done").length;
const SCENE_CYCLE = cycleLabel(DEMO_SESSION.cycle.current, DEMO_SESSION.cycle.total);

/** The demo chat's `!done` line: the caption shows the command that finished a listed task. */
const FINISHED_FROM_CHAT = DEMO_SESSION.chat.find(
  (line): line is Extract<DemoChatLine, { kind: "command" }> =>
    line.kind === "command" && line.text === "!done",
);

/** Illustrative stream scene built from the shared demo session, not a live channel. */
function StreamScene() {
  return (
    <figure
      className="marketing-scene"
      aria-label="Example stream with a focus timer and viewer tasks"
    >
      <div className="marketing-scene-bar">
        <span>
          <Radio size={14} aria-hidden /> CO-WORKING STREAM
        </span>
        <span className="marketing-scene-example">EXAMPLE SCENE</span>
      </div>
      <div className="marketing-scene-canvas">
        <div className="marketing-scene-notes">
          <span className="marketing-label">TODAY'S INTENTION</span>
          <p>
            A little progress.
            <br />
            Good company.
          </p>
          <span className="marketing-scene-rule" />
          <span className="marketing-scene-note">Bring your work. Stay for the company.</span>
        </div>
        <div className="marketing-timer">
          <span className="marketing-label">
            <span className="marketing-led" /> {DEMO_SESSION.phaseLabel.toUpperCase()}
          </span>
          <span className="marketing-timer-clock">{formatClock(DEMO_SESSION.remainingMs)}</span>
          <div className="marketing-cycle" aria-hidden>
            {Array.from({ length: DEMO_SESSION.cycle.total }, (_, i) => {
              const n = i + 1;
              const state =
                n < DEMO_SESSION.cycle.current
                  ? "is-done"
                  : n === DEMO_SESSION.cycle.current
                    ? "is-current"
                    : undefined;
              return <span key={n} className={state} />;
            })}
          </div>
          <span className="marketing-timer-caption">{SCENE_CYCLE}</span>
        </div>
        <div className="marketing-scene-tasks">
          <div className="marketing-scene-task-heading">
            <span>VIEWER TASKS</span>
            <span>
              {SCENE_DONE}/{SCENE_TASKS.length} done
            </span>
          </div>
          {SCENE_TASKS.map(({ author, text, status }) => (
            // The check icon is aria-hidden, so the sr-only status carries the row's state.
            <div key={text} className={`marketing-scene-task is-${status}`}>
              <span className="marketing-task-check" aria-hidden>
                {status === "done" && <Check size={14} />}
              </span>
              <div>
                <span className="marketing-task-author">{author}</span>
                <p>{text}</p>
              </div>
              {status === "active" && <span className="sr-only">Active</span>}
              {status === "done" && <span className="sr-only">Completed</span>}
            </div>
          ))}
        </div>
      </div>
      {FINISHED_FROM_CHAT && (
        <figcaption className="marketing-scene-caption">
          <MessageSquare size={15} aria-hidden />
          <span>
            <strong>{FINISHED_FROM_CHAT.user}</strong> {FINISHED_FROM_CHAT.text}
          </span>
          <span className="marketing-scene-added">
            <Check size={13} aria-hidden /> Marked done
          </span>
        </figcaption>
      )}
    </figure>
  );
}

/** FAQ entries, rendered as native <details> disclosures (no client JS). */
const questions = [
  {
    q: "Is this a hosted service?",
    a: "You deploy your own copy on Cloudflare Workers and D1. Each instance belongs to one streamer, using their own Cloudflare account and Twitch application. The deployment guide walks you through it.",
  },
  {
    q: "What does it cost?",
    a: "DireWork is free and open source, with no paid feature tier. Cloudflare's free Workers and D1 plans are the supported baseline. They have daily usage limits shared with your other projects, so a busy instance may need a paid Cloudflare plan.",
  },
  {
    q: "Do viewers need an account?",
    a: "Viewers use their existing Twitch accounts to add and complete tasks in chat. Only the streamer signs in to DireWork. The first Twitch sign-in claims the instance; after that, no one else can sign in.",
  },
  {
    q: "Does the bot need to stay open?",
    a: "Yes. The bot connects to Twitch from a private browser page. Keep that page running in OBS or a pinned browser tab while you stream. Closing it disconnects the bot.",
  },
  {
    q: "Can I use it outside Twitch?",
    a: "Twitch is the supported platform today. The timer and task overlays work as browser sources in OBS, but login and viewer chat commands depend on Twitch.",
  },
];

/** Landing page: hero, features, overlay theme preview, chat commands, setup steps, FAQ. */
export default function HomePage() {
  return (
    // `nd-page` is the root layout's skip-link target; Fumadocs' DocsPage sets the same id
    // on docs pages, so the home page provides it itself.
    <div id="nd-page" className="marketing dw-font dw-bg-base dw-text-1">
      <section className="marketing-hero" aria-labelledby="hero-title">
        <div className="marketing-wrap">
          <div className="marketing-hero-topline">
            <span className="marketing-eyebrow">
              <span className="marketing-led" /> BUILT FOR CO-WORKING STREAMS
            </span>
          </div>
          <div className="marketing-hero-grid">
            <div className="marketing-hero-copy">
              <h1 id="hero-title">{BRAND.tagline}.</h1>
              <p>{BRAND.description}</p>
              <div className="marketing-actions">
                <Link href="/docs/getting-started" className="dw-btn dw-btn-primary">
                  Set up DireWork <ArrowRight size={17} aria-hidden />
                </Link>
                <a href="#overlays" className="marketing-text-link">
                  Explore the overlays <ArrowDown size={16} aria-hidden />
                </a>
              </div>
              <p className="marketing-hero-fine">
                Free &amp; open source · One streamer per instance · Cloudflare free tier supported
              </p>
            </div>
            <div className="marketing-scene-wrap">
              <StreamScene />
            </div>
          </div>
          <div className="marketing-proof-strip">
            <span>
              <Timer size={18} aria-hidden /> A shared rhythm
            </span>
            <span>
              <MessageSquare size={18} aria-hidden /> Tasks straight from Twitch chat
            </span>
            <span>
              <Monitor size={18} aria-hidden /> Made for OBS
            </span>
            <a
              href={GITHUB}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Browse the source on GitHub (opens in a new tab)"
            >
              <GithubIcon size={18} /> Open source <ArrowRight size={14} aria-hidden />
            </a>
          </div>
        </div>
      </section>
      <section
        id="features"
        className="marketing-section marketing-wrap"
        aria-labelledby="features-title"
      >
        <div className="marketing-section-head">
          <span className="marketing-eyebrow">HOW IT WORKS</span>
          <h2 id="features-title">A shared focus session.</h2>
          <p>You set the timer. Viewers bring their tasks. Everyone makes progress together.</p>
        </div>
        <div className="marketing-benefits">
          {[
            {
              icon: Timer,
              title: "Set the pace",
              text: "Run focus blocks, short breaks, and long breaks. Adjust the durations to the way your community works.",
            },
            {
              icon: MessageSquare,
              title: "Let chat join in",
              text: "Viewers add their own tasks, choose a focus, and mark things done without leaving Twitch chat.",
            },
            {
              icon: Monitor,
              title: "Put progress on screen",
              text: "Bring the timer and task list into OBS as browser sources. Everyone can see what they're working toward.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <article key={title} className="marketing-benefit">
              <div className="marketing-benefit-top">
                <Icon size={26} aria-hidden />
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section
        id="overlays"
        className="marketing-section marketing-overlays"
        aria-labelledby="overlays-title"
      >
        <div className="marketing-wrap marketing-overlay-grid">
          <div className="marketing-section-head">
            <span className="marketing-eyebrow">OBS OVERLAYS</span>
            <h2 id="overlays-title">Make it fit your stream.</h2>
            <p>
              Start with one of six themes, then make it yours. Colors, fonts, spacing, and timer
              shapes are all adjustable in the Theme Center.
            </p>
            <p className="marketing-supporting">
              Transparent browser sources fit into your existing scene. The countdown runs locally;
              task and timer changes appear within a few seconds.
            </p>
            <Link href="/docs/overlays" className="marketing-text-link">
              How to add overlays to OBS <ArrowRight size={16} aria-hidden />
            </Link>
            <span className="marketing-preview-hint">CHOOSE A THEME TO PREVIEW</span>
          </div>
          <OverlayThemePreview />
        </div>
      </section>
      <section
        id="chat"
        className="marketing-section marketing-wrap marketing-chat-grid"
        aria-labelledby="chat-title"
      >
        <div className="marketing-chat-preview">
          <ChatCommandWidget />
          <p className="marketing-preview-note">
            Example commands and replies. No Twitch connection needed to preview.
          </p>
        </div>
        <div className="marketing-section-head">
          <span className="marketing-eyebrow">TWITCH CHAT COMMANDS</span>
          <h2 id="chat-title">Let chat join in.</h2>
          <p>
            No extra account for your viewers. They add a task with <code>!task</code>, pick what to
            work on with <code>!focus</code>, and celebrate a finish with <code>!done</code>.
          </p>
          <p className="marketing-supporting">
            Broadcasters and mods get timer and moderation controls. Customize command aliases and
            bot replies to match your community.
          </p>
          <Link href="/docs/chat-commands" className="marketing-text-link">
            See the chat commands <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </section>
      <section
        id="setup"
        className="marketing-section marketing-setup"
        aria-labelledby="setup-title"
      >
        <div className="marketing-wrap">
          <div className="marketing-setup-head marketing-section-head">
            <div>
              <span className="marketing-eyebrow">YOUR OWN INSTANCE</span>
              <h2 id="setup-title">Ready for your first session?</h2>
            </div>
            <p>
              You'll need a Cloudflare account, a Twitch application, and OBS. Keep the bot's
              private browser page open in OBS or a pinned tab while streaming.
            </p>
          </div>
          <ol className="marketing-steps">
            {[
              {
                title: "Deploy your copy",
                body: "Create your Twitch application and deploy to Cloudflare. Follow the guide for the required accounts and settings.",
                href: "/docs/deployment",
                link: "Deployment guide",
              },
              {
                title: "Claim your room",
                body: "Sign in with Twitch to claim your instance. Connect your bot account and keep its private browser page open while streaming.",
                href: "/docs/twitch-oauth",
                link: "Twitch setup",
              },
              {
                title: "Bring it into OBS",
                body: "Choose your style, copy the timer and task overlay URLs into browser sources, and start your first focus session.",
                href: "/docs/overlays",
                link: "Overlay setup",
              },
            ].map(({ title, body, href, link }, index) => (
              <li key={title}>
                <span className="marketing-step-number">0{index + 1}</span>
                <h3>{title}</h3>
                <p>{body}</p>
                <Link href={href} className="marketing-text-link">
                  {link} <ArrowRight size={15} aria-hidden />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section
        id="faq"
        className="marketing-section marketing-wrap marketing-faq-grid"
        aria-labelledby="faq-title"
      >
        <div className="marketing-section-head">
          <span className="marketing-eyebrow">BEFORE YOU START</span>
          <h2 id="faq-title">A few things to know.</h2>
          <p>
            Need a hand?{" "}
            <a
              href="https://mrdwolf.net/discord"
              target="_blank"
              rel="noopener noreferrer"
              className="marketing-inline-link"
              aria-label="Ask in Discord (opens in a new tab)"
            >
              Ask in Discord.
            </a>
          </p>
        </div>
        <div className="marketing-faqs">
          {questions.map(({ q, a }) => (
            <details key={q}>
              <summary>
                {q}
                <span className="marketing-faq-plus" aria-hidden>
                  +
                </span>
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="marketing-finale" aria-labelledby="finale-title">
        <div className="marketing-wrap">
          <h2 id="finale-title">Start your next focus session.</h2>
          <div className="marketing-actions">
            <Link href="/docs/getting-started" className="dw-btn dw-btn-primary">
              Set up DireWork <ArrowRight size={17} aria-hidden />
            </Link>
            <a
              href={GITHUB}
              className="marketing-text-link"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Explore the source on GitHub (opens in a new tab)"
            >
              <GithubIcon size={17} /> Explore the source
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
