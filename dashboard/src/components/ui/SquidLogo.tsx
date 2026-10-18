import React from 'react';
import { cn } from '@/lib/utils';
import { isNativePlatform } from '@/utils/mobile';

interface SquidLogoProps {
  size?: number;
  className?: string;
  showBg?: boolean;
  /** Pure black-on-white brand mark — no gradients, no color. */
  mono?: boolean;
}

const SquidLogo: React.FC<SquidLogoProps> = ({ size = 32, className, showBg = true, mono = false }) => {
  const iconSize = Math.round(size * 0.625);

  if (mono) {
    return (
      <div
        className={cn('flex items-center justify-center shrink-0 rounded-[6px] bg-white', className)}
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 512 512" width={Math.round(size * 0.72)} height={Math.round(size * 0.72)} fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M208 160 C260 120 340 130 360 180 C380 230 360 270 320 290 C280 310 240 300 220 280 C200 260 190 240 200 210 C210 180 240 170 270 180"
            fill="none" stroke="#000000" strokeWidth={44} strokeLinecap="round" strokeLinejoin="round"
          />
          <path
            d="M320 290 C350 310 370 340 360 370"
            fill="none" stroke="#000000" strokeWidth={28} strokeLinecap="round" opacity={0.75}
          />
        </svg>
      </div>
    );
  }

  // In the native Android app, render the bundled PNG app icon instead of the inline SVG.
  if (isNativePlatform()) {
    return (
      <img
        src="/icon-512x512.png"
        alt="SquidCloud"
        width={size}
        height={size}
        className={cn('shrink-0 rounded-[10px]', className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center shrink-0',
        showBg
          ? 'bg-gradient-to-br from-[#1a365d] via-[#2563eb] to-[#06b6d4] shadow-sm shadow-brand/20 rounded-[10px]'
          : '',
        className
      )}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 512 512"
        width={iconSize}
        height={iconSize}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-white"
      >
        {showBg && (
          <circle cx="256" cy="256" r="248" fill="url(#grad)" />
        )}
        <defs>
          <linearGradient id="grad" x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="#1a365d"/>
            <stop offset="40%" stopColor="#2563eb"/>
            <stop offset="100%" stopColor="#06b6d4"/>
          </linearGradient>
          <linearGradient id="mark" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff"/>
            <stop offset="100%" stopColor="#e0f2fe"/>
          </linearGradient>
        </defs>
        {/* Abstract squid tentacle / cloud swirl forming an 'S' */}
        <path
          d="M208 160 C260 120 340 130 360 180 C380 230 360 270 320 290 C280 310 240 300 220 280 C200 260 190 240 200 210 C210 180 240 170 270 180"
          fill="none"
          stroke="url(#mark)"
          strokeWidth={36}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.95}
        />
        {/* Secondary tentacle arc */}
        <path
          d="M320 290 C350 310 370 340 360 370"
          fill="none"
          stroke="url(#mark)"
          strokeWidth={24}
          strokeLinecap="round"
          opacity={0.7}
        />
        {/* Accent dots */}
        <circle cx="155" cy="190" r="9" fill="#67e8f9" opacity={0.5} />
        <circle cx="135" cy="220" r="6" fill="#67e8f9" opacity={0.35} />
        <circle cx="370" cy="130" r="8" fill="#67e8f9" opacity={0.4} />
        <circle cx="390" cy="160" r="5" fill="#67e8f9" opacity={0.25} />
      </svg>
    </div>
  );
};

export default SquidLogo;
