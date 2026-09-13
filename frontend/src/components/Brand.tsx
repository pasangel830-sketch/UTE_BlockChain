import Image from 'next/image';

type Size = 'sm' | 'md' | 'lg';

const PX: Record<Size, number> = { sm: 40, md: 56, lg: 96 };

export function LogoUte({ size = 'md' }: { size?: Size }) {
  const px = PX[size];
  return (
    <Image
      src="/brand/logo-ute-blockchain.png?v=3"
      alt="UTE Blockchain Solutions"
      width={px}
      height={px}
      className="bg-transparent drop-shadow-sm transition-transform duration-300 ease-out hover:scale-[1.04]"
      unoptimized
      priority={size !== 'sm'}
    />
  );
}

export function LogoMadrid({ size = 'md' }: { size?: Size }) {
  const px = PX[size];
  return (
    <Image
      src="/brand/logo-ayuntamiento-madrid.png?v=3"
      alt="Ayuntamiento de Madrid"
      width={px}
      height={px}
      className="bg-transparent drop-shadow-sm transition-transform duration-300 ease-out hover:scale-[1.04]"
      unoptimized
      priority={size !== 'sm'}
    />
  );
}

export function BrandLockup({
  size = 'md',
  invert = false,
}: {
  size?: Size;
  invert?: boolean;
}) {
  const caption = invert ? 'text-gold/90' : 'text-gold';
  const rule = invert ? 'bg-gold/50' : 'bg-gold/70';
  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <LogoUte size={size} />
      <span className={`hidden h-10 w-px sm:block ${rule}`} aria-hidden />
      <LogoMadrid size={size} />
      {size !== 'sm' && (
        <p className={`hidden max-w-[11rem] text-[10px] font-semibold uppercase tracking-[0.18em] sm:block ${caption}`}>
          Convenio de colaboración
        </p>
      )}
    </div>
  );
}
