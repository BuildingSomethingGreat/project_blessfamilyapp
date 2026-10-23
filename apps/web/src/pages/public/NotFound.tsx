import { Link } from 'react-router-dom';
import { Button, Page } from '@/components/ui';

export default function NotFound() {
  return (
    <Page className="flex min-h-[70dvh] flex-col items-center justify-center py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-ember">404</p>
      <h1 className="display-tight mt-3 text-5xl sm:text-7xl">That page wandered off.</h1>
      <p className="mt-4 max-w-md text-ink-2">The link may be old, or it was never here. The families are still waiting, though.</p>
      <div className="mt-8 flex gap-3">
        <Link to="/families"><Button size="lg">Find a family</Button></Link>
        <Link to="/"><Button size="lg" variant="secondary">Home</Button></Link>
      </div>
    </Page>
  );
}
