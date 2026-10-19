import React from 'react';

/**
 * Real lab marks — official simple-icons SVG paths (CC0), vendored inline so
 * nothing depends on a CDN at runtime. Monochrome `currentColor` by default so
 * every mark reads on both dark and light themes; pass `brand` for the
 * official brand color where it stays readable.
 *
 * Labs a0 actually serves today:
 *   qwen (Alibaba) · mistral · api (Cohere) · opencode-zen (LongCat, Meituan)
 *   zai (Z.ai / GLM) · nvidia (nemotron) · openai (gpt-oss) · stealth (unnamed)
 */

export type LabId =
  | 'qwen' | 'mistral' | 'api' | 'opencode-zen' | 'stealth'
  | 'zai' | 'nvidia' | 'openai' | 'cohere' | 'longcat';

const BRAND: Partial<Record<LabId, string>> = {
  qwen: '#6950EF',
  mistral: '#FA520F',
  nvidia: '#76B900',
  longcat: '#FFD100',
  zai: '#2D2D2D', // dark mark — readable on light only
  cohere: '#39594D',
};

export function labTitle(lab: string): string {
  switch (lab) {
    case 'api': return 'Cohere';
    case 'mistral': return 'Mistral AI';
    case 'opencode-zen': return 'LongCat';
    case 'longcat': return 'LongCat';
    case 'qwen': return 'Qwen';
    case 'zai': return 'Z.ai';
    case 'nvidia': return 'NVIDIA';
    case 'openai': return 'OpenAI';
    case 'stealth': return 'Stealth';
    case 'cohere': return 'Cohere';
    default: return lab;
  }
}

const QWEN = 'M23.919 14.545 20.817 9.17l1.47-2.544a.56.56 0 0 0 0-.566l-1.633-2.83a.57.57 0 0 0-.49-.283h-6.207L12.487.402a.57.57 0 0 0-.49-.284H8.732a.56.56 0 0 0-.49.284L5.139 5.775h-2.94a.56.56 0 0 0-.49.284L.077 8.887a.56.56 0 0 0 0 .567L3.18 14.83l-1.47 2.545a.56.56 0 0 0 0 .566l1.634 2.83a.57.57 0 0 0 .49.283h6.205l1.47 2.545a.57.57 0 0 0 .49.284h3.266a.57.57 0 0 0 .49-.284l3.104-5.375h2.94a.57.57 0 0 0 .49-.283l1.634-2.828a.55.55 0 0 0-.004-.568M8.733.686l1.634 2.828-1.634 2.828H21.8L20.164 9.17H7.425L5.63 6.06Zm1.306 19.801-6.205-.002 1.634-2.83h3.265L2.201 6.344h3.267q3.182 5.517 6.367 11.032zm10.124-5.66L18.53 12l-6.532 11.315-1.634-2.83c2.129-3.673 4.25-7.351 6.373-11.028h3.592l3.102 5.374z';
const ZAI = 'M12.606 1.806l-1.677 2.388c-.258.374-.697.606-1.161.606h-9.162V1.794C.594 1.806 12.606 1.806 12.606 1.806zM24 1.806L9.6 22.206 0 22.206 14.4 1.806zM11.394 22.206l1.69-2.4c.258-.374.697-.606 1.161-.606h9.149v3.006H11.394z';
const MISTRAL = 'M17.143 3.429v3.428h-3.429v3.429h-3.428V6.857H6.857V3.43H3.43v13.714H0v3.428h10.286v-3.428H6.857v-3.429h3.429v3.429h3.429v-3.429h3.428v3.429h-3.428v3.428H24v-3.428h-3.43V3.429z';
const NVIDIA = 'M8.948 8.798v-1.43a6.7 6.7 0 0 1 .424-.018c3.922-.124 6.493 3.374 6.493 3.374s-2.774 3.851-5.75 3.851c-.398 0-.787-.062-1.158-.185v-4.346c1.528.185 1.837.857 2.747 2.385l2.04-1.714s-1.492-1.952-4-1.952a6.016 6.016 0 0 0-.796.035m0-4.735v2.138l.424-.027c5.45-.185 9.01 4.47 9.01 4.47s-4.08 4.964-8.33 4.964c-.37 0-.733-.035-1.095-.097v1.325c.3.035.61.062.91.062 3.957 0 6.82-2.023 9.593-4.408.459.371 2.34 1.263 2.73 1.652-2.633 2.208-8.772 3.984-12.253 3.984-.335 0-.653-.018-.971-.053v1.864H24V4.063zm0 10.326v1.131c-3.657-.654-4.673-4.46-4.673-4.46s1.758-1.944 4.673-2.262v1.237H8.94c-1.528-.186-2.73 1.245-2.73 1.245s.68 2.412 2.739 3.11M2.456 10.9s2.164-3.197 6.5-3.533V6.201C4.153 6.59 0 10.653 0 10.653s2.35 6.802 8.948 7.42v-1.237c-4.84-.6-6.492-5.936-6.492-5.936z';
const OPENAI = 'M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z';
const MEITuan = 'M6.923 0c-2.408 0-3.28.25-4.16.721A4.906 4.907 0 0 0 .722 2.763C.25 3.643 0 4.516 0 6.923v10.154c0 2.407.25 3.28.72 4.16a4.905 4.906 0 0 0 2.042 2.042c.88.47 1.752.721 4.16.721h10.156c2.407 0 3.28-.25 4.16-.721a4.906 4.907 0 0 0 2.04-2.042c.471-.88.722-1.753.722-4.16V6.923c0-2.407-.25-3.28-.722-4.16A4.906 4.907 0 0 0 21.238.72C20.357.251 19.484 0 17.077 0ZM4.17 7.51h1.084c.04.24.07.488.11.737h3.47c.05-.25.08-.497.1-.736h1.105a9.849 9.85 0 0 1-.09.736h1.562v.866H7.62v.696h3.642v.855h-3.64v.667h3.64v.854h-3.64v.816h3.89v.865H7.88c.775.935 2.218 1.532 3.78 1.651l-.538.936c-1.442-.17-3.103-.846-4.028-2.04-.856 1.194-2.487 1.92-4.525 2.07l.318-1.005c1.382-.02 2.814-.736 3.431-1.612h-3.62v-.865h3.86v-.816h-3.64v-.854h3.64v-.667h-3.64v-.855h3.64v-.697H2.7v-.866h1.56zm8.603.182h7.976c.358 0 .567.198.567.547v8.146H13.33c-.358 0-.557-.199-.557-.547zm1.044.885V15.5h6.455V8.577Zm3.999.476h1.024v.756h.975v.835h-.975V13c0 .806-.1 1.402-.318 2.02h-1.113c.338-.717.408-1.224.408-1.99v-2.387h-.935c-.14 1.541-.736 3.451-1.363 4.376h-1.134c.607-.855 1.303-2.526 1.472-4.376h-1.512v-.835h3.472z';

const MARKS: Partial<Record<LabId, string>> = {
  qwen: QWEN,
  zai: ZAI,
  mistral: MISTRAL,
  nvidia: NVIDIA,
  openai: OPENAI,
  longcat: MEITuan,
};

function Mark({ lab, size, color }: { lab: LabId; size: number; color?: string }) {
  const d = MARKS[lab];
  if (!d) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={labTitle(lab)}
      style={{ display: 'block', fill: color ?? 'currentColor' }}
    >
      <path d={d} />
    </svg>
  );
}

/**
 * The lab mark for a catalog lab id. Real brand mark when one exists; a quiet
 * monogram tile when none does (Cohere publishes no SVG; stealth is masked on
 * purpose). `brand` uses the official brand color where readable.
 */
export function LabLogo({
  lab,
  size = 20,
  brand = false,
  tile = false,
}: {
  lab: string;
  size?: number;
  brand?: boolean;
  tile?: boolean;
}) {
  const id = (lab === 'cohere' ? 'api' : lab) as LabId;
  const mark = MARKS[id];
  const color = brand && BRAND[id] ? BRAND[id] : undefined;

  if (!mark) {
    // Monogram fallback — Cohere + stealth.
    const accent: Partial<Record<LabId, string>> = { api: '#39594D', stealth: '#8d8f89' };
    const c = brand ? accent[id] : undefined;
    return (
      <span
        aria-label={labTitle(lab)}
        role="img"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
          flex: 'none',
          borderRadius: Math.round(size * 0.24),
          background: 'var(--sa-bg-3)',
          border: '1px solid var(--sa-line-2)',
          color: c ?? 'var(--sa-text-2)',
          font: `500 ${Math.round(size * 0.44)}px/1 var(--sa-mono)`,
          letterSpacing: 0,
        }}
      >
        {id === 'api' ? 'C' : 'S'}
      </span>
    );
  }

  if (tile) {
    return (
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
          flex: 'none',
          borderRadius: Math.round(size * 0.24),
          background: 'var(--sa-bg-3)',
          border: '1px solid var(--sa-line-2)',
        }}
      >
        <Mark lab={id} size={Math.round(size * 0.62)} color={color} />
        <span className="sa-sr">{labTitle(lab)}</span>
      </span>
    );
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', flex: 'none' }}>
      <Mark lab={id} size={size} color={color} />
      <span className="sa-sr">{labTitle(lab)}</span>
    </span>
  );
}

/** The labs a0 serves, best-first display order. Real marks only. */
export const SERVED_LABS: LabId[] = ['qwen', 'mistral', 'api', 'opencode-zen', 'zai', 'nvidia', 'openai'];
