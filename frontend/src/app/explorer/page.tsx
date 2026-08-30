'use client';

import { Shell } from '@/components/Shell';
import { ExplorerPanel } from '@/components/ExplorerPanel';

export default function ExplorerPage() {
  return (
    <Shell>
      <h1 className="mb-4 text-2xl font-bold">Explorer</h1>
      <ExplorerPanel />
    </Shell>
  );
}
