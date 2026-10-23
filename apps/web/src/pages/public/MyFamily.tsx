import { Link, Navigate } from 'react-router-dom';
import { getSponsorToken } from '@/lib/api';
import { shell } from './shared.tsx';

export default function MyFamily() {
  const token = getSponsorToken();
  if (token) return <Navigate to={`/s/${token}`} replace />;
  return (
    <div className={`${shell} anim-rise`}>
      <div className="mx-auto my-16 max-w-[520px] text-center">
        <h1 className="text-[40px] font-extrabold tracking-[-.045em]">No family yet.</h1>
        <p className="mt-2.5 text-[15px] text-ink-2">Your family page appears here once you claim one.</p>
        <Link to="/families" className="mt-[22px] inline-flex h-[50px] items-center rounded-full bg-pri px-6 text-[15px] font-semibold text-white hover:bg-pri-dark">Find a family</Link>
      </div>
    </div>
  );
}
