import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizes = {
  sm: 18,
  md: 28,
  lg: 40,
  xl: 56,
};

const strokes = {
  sm: 2,
  md: 2.5,
  lg: 3,
  xl: 3.5,
};

const arcSize = 0.35;

const Loader: React.FC<LoaderProps> = ({ size = 'md', className }) => {
  const dim = sizes[size];
  const stroke = strokes[size];
  const r = (dim - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arcLen = c * arcSize;
  const gapLen = c - arcLen;

  return (
    <div className={cn('flex items-center justify-center', className)} style={{ width: dim, height: dim }}>
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} fill="none">
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          className="opacity-15"
        />
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLen} ${gapLen}`}
          className="animate-loading-sweep"
          style={{ transformOrigin: 'center' }}
        />
      </svg>
    </div>
  );
};

export { Loader };
export default Loader;
