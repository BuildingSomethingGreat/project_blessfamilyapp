import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="anim-rise mx-auto my-20 max-w-[520px] px-4 text-center">
      <div className="text-[12px] font-semibold uppercase tracking-[.1em] text-pri">404</div>
      <h1 className="mt-2 text-[40px] font-extrabold tracking-[-.045em]">That page wandered off.</h1>
      <p className="mt-2.5 text-[15px] text-ink-2">The link may be old, or the family may already be blessed.</p>
      <Link to="/families" className="mt-[22px] inline-flex h-[50px] items-center rounded-full bg-ink px-6 text-[15px] font-semibold text-white hover:bg-pri">Find a family</Link>
    </div>
  );
}
