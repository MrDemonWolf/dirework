import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  Check,
  Github,
  MessageSquare,
  Monitor,
  Radio,
  Timer,
} from "lucide-react";
import { ChatCommandWidget } from "./_widgets/ChatCommandWidget";
import { OverlayThemePreview } from "./_widgets/OverlayThemePreview";
import "./marketing.css";

const GITHUB = "https://github.com/mrdemonwolf/dirework";
export const metadata: Metadata = {
  title: "DireWork — A focus room for your Twitch stream",
  description:
    "Bring your Twitch community into the same focus session. A self-hosted Pomodoro timer, viewer task lists, and customizable OBS overlays. Free and open source.",
  alternates: { canonical: "/" },
};

/** Illustrative stream scene, not a screenshot or a live channel. */
function StreamScene() {
  return (
    <figure
      className="marketing-scene"
      aria-label="Example stream with a focus timer and viewer tasks"
    >
      <div className="marketing-scene-bar">
        <span>
          <Radio size={14} aria-hidden /> THE FOCUS ROOM
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
            <span className="marketing-led" /> FOCUS SESSION
          </span>
          <span className="marketing-timer-clock">25:00</span>
          <div className="marketing-cycle" role="img" aria-label="Focus cycle 1 of 4">
            <span className="is-current" />
            <span />
            <span />
            <span />
          </div>
          <span className="marketing-timer-caption">One thing at a time.</span>
        </div>
        <div className="marketing-scene-tasks">
          <div className="marketing-scene-task-heading">
            <span>IN THIS TOGETHER</span>
            <span>Tasks</span>
          </div>
          {[
            { name: "ada_codes", task: "Ship the last little fix", done: false },
            { name: "pixel_pat", task: "Finish the first sketch", done: false },
            { name: "night_owl", task: "Read one chapter", done: true },
          ].map(({ name, task, done }) => (
            <div key={name} className={`marketing-scene-task ${done ? "is-done" : ""}`}>
              <span className="marketing-task-check" aria-hidden>
                {done && <Check size={14} />}
              </span>
              <div>
                <span className="marketing-task-author">{name}</span>
                <p>{task}</p>
              </div>
              {done && <span className="sr-only">Completed</span>}
            </div>
          ))}
        </div>
      </div>
      <figcaption className="marketing-scene-caption">
        <MessageSquare size={15} aria-hidden />
        <span>
          <strong>ada_codes</strong> !task Ship the last little fix
        </span>
        <span className="marketing-scene-added">
          <Check size={13} aria-hidden /> Added to the room
        </span>
      </figcaption>
    </figure>
  );
}

const questions = [
  {
    q: "Is this a hosted service?",
    a: "No. DireWork is always self-hosted. We do not offer hosted instances or a managed hosting service. You deploy your own copy on Cloudflare Workers and D1 using your own Cloudflare account and Twitch application. The deployment guide walks through the setup.",
  },
  {
    q: "What does it cost?",
    a: "DireWork is free and open source, with no paid feature tier. It is designed for Cloudflare's free Workers and D1 plans. Your usage is still subject to Cloudflare's limits and pricing.",
  },
  {
    q: "Do viewers need an account?",
    a: "Viewers use their existing Twitch accounts to add and complete tasks in chat. Only the streamer signs in to DireWork. The first Twitch login claims the instance; additional signups are then closed.",
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

export default function HomePage() {
  return (
    <div id="nd-page" className="marketing dw-font dw-bg-base dw-text-1">
      <section className="marketing-hero" aria-labelledby="hero-title">
        <div className="marketing-wrap">
          <div className="marketing-hero-topline">
            <span className="marketing-eyebrow">
              <span className="marketing-led" /> BUILT FOR CO-WORKING STREAMS
            </span>
            <span className="marketing-edition">YOUR STREAM. YOUR SPACE.</span>
          </div>
          <div className="marketing-hero-grid">
            <div className="marketing-hero-copy">
              <h1 id="hero-title">
                Focus together.
                <br />
                <span>On your own stream.</span>
              </h1>
              <p>
                Self-hosted Pomodoro timers, shared task lists, and OBS overlays for Twitch
                co-working streams. Deploy your own instance and give your community a rhythm.
              </p>
              <div className="marketing-actions">
                <Link href="/docs/getting-started" className="dw-btn dw-btn-primary">
                  Deploy your own instance <ArrowRight size={17} aria-hidden />
                </Link>
                <a href="#overlays" className="marketing-text-link">
                  Explore the overlays <ArrowDown size={16} aria-hidden />
                </a>
              </div>
              <p className="marketing-hero-fine">
                Free &amp; open source. Self-hosted on your Cloudflare account.
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
              <Github size={18} aria-hidden /> Yours to make your own{" "}
              <ArrowRight size={14} aria-hidden />
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
          <span className="marketing-eyebrow">01 / A LITTLE STRUCTURE. A LOT OF COMPANY.</span>
          <h2 id="features-title">
            Different to-do lists.
            <br />
            The same moment to start.
          </h2>
          <p>
            Coding, studying, drawing, or finally getting through the inbox. Everyone brings their
            own task. You give the room a rhythm.
          </p>
        </div>
        <div className="marketing-benefits">
          {[
            {
              number: "01",
              icon: Timer,
              title: "Set the pace",
              text: "Run focus blocks, short breaks, and long breaks. Adjust the durations to the way your community works.",
              detail: "YOUR TIMER, YOUR RHYTHM",
            },
            {
              number: "02",
              icon: MessageSquare,
              title: "Let chat join in",
              text: "Viewers add their own tasks, choose a focus, and mark things done without leaving Twitch chat.",
              detail: "!task · !focus · !done",
            },
            {
              number: "03",
              icon: Monitor,
              title: "Put progress on screen",
              text: "Bring the timer and task list into OBS as browser sources. Everyone can see what they're working toward.",
              detail: "TWO OVERLAYS. ONE ROOM.",
            },
          ].map(({ number, icon: Icon, title, text, detail }) => (
            <article key={title} className="marketing-benefit">
              <div className="marketing-benefit-top">
                <Icon size={26} aria-hidden />
                <span>{number}</span>
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
              <span className="marketing-label">{detail}</span>
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
            <span className="marketing-eyebrow">02 / LOOKS LIKE YOUR STREAM</span>
            <h2 id="overlays-title">
              Your scene.
              <br />
              <span className="dw-text-brand">Your signature.</span>
            </h2>
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
            <span className="marketing-preview-hint">TRY A THEME →</span>
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
          <span className="marketing-eyebrow">03 / SMALL COMMANDS. SHARED PROGRESS.</span>
          <h2 id="chat-title">
            “Done” feels better
            <br />
            with company.
          </h2>
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
              <span className="marketing-eyebrow">04 / A SPACE OF YOUR OWN</span>
              <h2 id="setup-title">
                Set up once.
                <br />
                Make it part of your stream.
              </h2>
            </div>
            <p>
              One DireWork instance per streamer. Your own deployment, your own data, and a
              dashboard that belongs to you.
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
          <h2 id="faq-title">
            Good questions.
            <br />
            Straight answers.
          </h2>
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
          <span className="marketing-eyebrow">BRING YOUR NEXT LITTLE GOAL.</span>
          <h2 id="finale-title">
            Let's get something
            <br />
            <span>done. Together.</span>
          </h2>
          <div className="marketing-actions">
            <Link href="/docs/getting-started" className="dw-btn dw-btn-primary">
              Deploy your own instance <ArrowRight size={17} aria-hidden />
            </Link>
            <a
              href={GITHUB}
              className="marketing-text-link"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Explore the source on GitHub (opens in a new tab)"
            >
              <Github size={17} aria-hidden /> Explore the source
            </a>
          </div>
          <p>Open source. Self-hosted. Built for the company you keep.</p>
        </div>
      </section>
    </div>
  );
}
