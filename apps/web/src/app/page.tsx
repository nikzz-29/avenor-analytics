import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  Database,
  LayoutDashboard,
  SlidersHorizontal,
} from 'lucide-react';
import { DemoButton } from '@/features/auth-form';
import { Button } from '@/components/ui/button';
export default function Home() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Link className="brand" href="/">
          <span className="brand-mark">a</span>
          <span className="brand-name">avenor.</span>
        </Link>
        <nav>
          <a href="#possibilities">The workspace</a>
          <Link href="/sign-in">Sign in</Link>
          <Button asChild>
            <Link href="/sign-up">
              Get started
              <ArrowUpRight size={15} />
            </Link>
          </Button>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="live-dot" />A QUIETER KIND OF ANALYTICS
            </p>
            <h1>
              Clarity in
              <br />
              every <em>number.</em>
            </h1>
            <p>
              Your data has a story to tell.
              <br />
              Give it a little room to make sense.
            </p>
            <div className="hero-actions">
              <Button asChild>
                <Link href="/sign-up">
                  Explore Avenor
                  <ArrowRight size={16} />
                </Link>
              </Button>
              <DemoButton />
            </div>
            <span className="hero-footnote">YOUR DATA. YOUR QUESTIONS. A FRESH PERSPECTIVE.</span>
          </div>
          <div className="hero-visual">
            <div className="editorial-grid" aria-hidden="true">
              <span>01 / A BETTER VIEW</span>
              <div className="hero-sculpture">
                <svg viewBox="0 0 420 390" fill="none">
                  <path d="M55 330 L55 265 L115 240 L115 330 Z" fill="#c9dbcf" />
                  <path d="M140 330 L140 210 L200 175 L200 330 Z" fill="#92b7a2" />
                  <path d="M225 330 L225 140 L285 100 L285 330 Z" fill="#4e937c" />
                  <path d="M310 330 L310 75 L370 35 L370 330 Z" fill="#147d70" />
                  <path d="M25 340 H395 M45 30 V360" stroke="#adc5b6" strokeDasharray="3 5" />
                  <path
                    d="M50 250 C140 255 120 150 205 170 S290 85 365 65"
                    stroke="#1b4536"
                    strokeWidth="2"
                  />
                  <circle cx="365" cy="65" r="5" fill="#1b4536" />
                </svg>
              </div>
              <div className="hero-visual-caption">
                <span>
                  Less noise.
                  <br />
                  <strong>More perspective.</strong>
                </span>
                <ArrowUpRight size={32} />
              </div>
            </div>
          </div>
        </section>
        <div className="landing-divider">
          <span>MADE FOR THE WAY YOU THINK</span>
          <span>01 — IMPORT. 02 — EXPLORE. 03 — UNDERSTAND.</span>
        </div>
        <section className="product-preview">
          <div>
            <p className="eyebrow">A LOOK INSIDE</p>
            <h2>A real workspace. Ready to explore.</h2>
            <p>Captured from Avenor’s live demo. Try every view for yourself.</p>
          </div>
          <Link href="/sign-in" aria-label="Open Avenor workspace">
            <Image
              src="/workspace-preview.png"
              width={1440}
              height={1000}
              alt="Avenor overview showing real demo revenue, orders, category performance and sales trends"
              sizes="(max-width: 700px) 100vw, 1200px"
            />
          </Link>
        </section>
        <section id="possibilities" className="possibilities">
          <div>
            <p className="eyebrow">FROM DATA TO DIRECTION</p>
            <h2>
              The big picture.
              <br />
              And every little detail.
            </h2>
            <p className="muted">
              A considered workspace for understanding your business,
              <br />
              without getting lost in the numbers.
            </p>
          </div>
          <div className="feature-grid">
            {[
              [
                Database,
                'Bring it all together.',
                'Import CSV and Excel files, map your columns, and start with a reliable foundation.',
              ],
              [
                ChartNoAxesCombined,
                'Find your momentum.',
                'Follow revenue, products, and customers through one consistent set of metrics.',
              ],
              [
                SlidersHorizontal,
                'Follow a question.',
                'Explore dimensions, metrics, and filters. Every chart starts with real data.',
              ],
              [
                LayoutDashboard,
                'Make it your own.',
                'Arrange dashboards, keep your favorite reports, and return to fresh answers.',
              ],
            ].map(([Icon, title, description]) => {
              const I = Icon as typeof Database;
              return (
                <article key={title as string}>
                  <I size={21} />
                  <h3>{title as string}</h3>
                  <p>{description as string}</p>
                </article>
              );
            })}
          </div>
        </section>
        <section className="landing-demo">
          <div>
            <p className="eyebrow">MEET YOUR NEXT WORKSPACE</p>
            <h2>
              A little curiosity
              <br />
              goes a long way.
            </h2>
            <p>
              Explore a real workspace with a year of commerce data.
              <br />
              Every chart, filter, and saved view is yours to try.
            </p>
          </div>
          <DemoButton>Step inside the live workspace</DemoButton>
        </section>
      </main>
      <footer className="landing-footer">
        <Link className="brand" href="/">
          <span className="brand-mark">a</span>
          <span className="brand-name">avenor.</span>
        </Link>
        <span>Clarity in every number.</span>
        <Link href="/sign-up">
          Find your perspective <ArrowUpRight size={14} />
        </Link>
      </footer>
    </div>
  );
}
