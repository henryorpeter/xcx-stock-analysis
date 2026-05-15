import type React from 'react';
import { cn } from '../../utils/cn';

type BrandMarkProps = {
  compact?: boolean;
  className?: string;
  subtitle?: string;
  hideText?: boolean;
};

export const BrandMark: React.FC<BrandMarkProps> = ({
  compact = false,
  className,
  subtitle = '未来信号矩阵',
  hideText = false,
}) => (
  <div
    className={cn(
      'flex items-center gap-3 text-left',
      compact ? 'gap-2.5' : 'gap-3.5',
      className,
    )}
  >
    <div className={cn('brand-mark-shell', compact ? 'h-11 w-11 rounded-2xl' : 'h-14 w-14 rounded-[1.4rem]')}>
      <div className="brand-mark-grid" aria-hidden="true" />
      <div className="brand-mark-core" aria-hidden="true">
        <span className="brand-mark-letter">IK</span>
      </div>
      <div className="brand-mark-ring brand-mark-ring-one" aria-hidden="true" />
      <div className="brand-mark-ring brand-mark-ring-two" aria-hidden="true" />
      <div className="brand-mark-scan" aria-hidden="true" />
    </div>
    {!hideText ? (
      <div className="min-w-0">
        <p className={cn('brand-wordmark truncate', compact ? 'text-sm' : 'text-[1.1rem]')}>
          IKUN
        </p>
        <p className={cn('brand-subtitle truncate', compact ? 'text-[0.6rem]' : 'text-[0.68rem]')}>
          {subtitle}
        </p>
      </div>
    ) : null}
  </div>
);
