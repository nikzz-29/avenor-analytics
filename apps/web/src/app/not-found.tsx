import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="state recovery-page">
      <p className="eyebrow">404 · A DIFFERENT PERSPECTIVE</p>
      <h1>This page wandered off.</h1>
      <p>Let’s get you back to somewhere useful.</p>
      <Link className="button primary" href="/workspace/overview">
        Back to overview
      </Link>
    </main>
  );
}
