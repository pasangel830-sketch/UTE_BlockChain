'use client';

import { Shell } from '@/components/Shell';
import { ExplorerPanel } from '@/components/ExplorerPanel';

export default function ExplorerPage() {
  return (
    <Shell>
      <h1 className="page-title mb-2">Explorer</h1>
      <p className="page-kicker mb-4">Bloques del canal channel-obra. Registro inmutable.</p>
      <div className="gold-rule mb-6 animate-hairline" />
      <ExplorerPanel />
    </Shell>
  );
}
