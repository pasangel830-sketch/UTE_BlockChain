'use client';

import { Shell } from '@/components/Shell';

const GRAFANA =
  process.env.NEXT_PUBLIC_GRAFANA_URL ||
  (process.env.NODE_ENV === 'development'
    ? 'http://localhost:3001/d/ute-fabric/ute-fabric?orgId=1&kiosk&theme=light'
    : 'https://ute-tfm.duckdns.org/grafana/d/ute-fabric/ute-fabric?orgId=1&refresh=10s&kiosk&theme=light');

export default function MonitorPage() {
  return (
    <Shell>
      <h1 className="page-title">Monitorización</h1>
      <div className="gold-rule my-4 animate-hairline" />
      <p className="mb-4 text-sm text-slate-500">
        Peers, latencia de bloque y endorsement. Alertas del pliego embebidas en kiosco.
      </p>
      <div className="card overflow-hidden p-0">
        <iframe
          title="Grafana UTE Fabric"
          src={GRAFANA}
          className="h-[70vh] w-full border-0 bg-paper"
          allow="fullscreen"
        />
      </div>
    </Shell>
  );
}
