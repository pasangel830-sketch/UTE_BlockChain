'use client';

import { Shell } from '@/components/Shell';
import { ExplorerPanel } from '@/components/ExplorerPanel';

export default function ExplorerPage() {
  return (
    <Shell>
      <h1 className="page-title">Explorer</h1>
      <div className="gold-rule my-4 animate-hairline" />
      <ExplorerPanel />
    </Shell>
  );
}
