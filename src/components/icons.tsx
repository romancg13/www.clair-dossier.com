/**
 * Icons : 24x24 stroke 1.5, dessin au trait minimaliste.
 * Jamais d'isométrique, jamais de cliché (shield/lock pour la sécurité, etc).
 * Chaque icône doit avoir un sens visuel ≠ d'une métaphore consensuelle.
 */
import type { SVGProps } from 'react';

const baseProps: Partial<SVGProps<SVGSVGElement>> = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export function FormGuideIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <line x1="7" y1="8" x2="14" y2="8" />
      <line x1="7" y1="12" x2="17" y2="12" />
      <line x1="7" y1="16" x2="12" y2="16" />
      <circle cx="17.5" cy="16" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function ScanOcrIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M4 8V5a1 1 0 011-1h3" />
      <path d="M16 4h3a1 1 0 011 1v3" />
      <path d="M20 16v3a1 1 0 01-1 1h-3" />
      <path d="M8 20H5a1 1 0 01-1-1v-3" />
      <line x1="3.5" y1="12" x2="20.5" y2="12" />
      <line x1="7.5" y1="9.5" x2="7.5" y2="14.5" />
      <line x1="12" y1="9.5" x2="12" y2="14.5" />
      <line x1="16.5" y1="9.5" x2="16.5" y2="14.5" />
    </svg>
  );
}

export function TimelineIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <line x1="3" y1="12" x2="21" y2="12" />
      <circle cx="6" cy="12" r="2" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      <circle cx="18" cy="12" r="2" />
      <line x1="6" y1="6" x2="6" y2="9.5" />
      <line x1="12" y1="14.5" x2="12" y2="18" />
      <line x1="18" y1="6" x2="18" y2="9.5" />
    </svg>
  );
}

export function AiBriefIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 3v3" />
      <path d="M5.5 6.5l2 2" />
      <path d="M18.5 6.5l-2 2" />
      <circle cx="12" cy="13" r="5" />
      <path d="M10 13h4M12 11v4" />
      <path d="M9 21h6" />
      <path d="M10 18l-.5 3M14 18l.5 3" />
    </svg>
  );
}

export function ValidateIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M4 12.5l4 4 12-10" />
      <path d="M4 19.5l4 4" opacity="0.4" />
    </svg>
  );
}

export function StatusTrackIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="5" cy="6" r="1.5" fill="currentColor" />
      <circle cx="5" cy="12" r="1.5" fill="currentColor" />
      <circle cx="5" cy="18" r="1.5" />
      <line x1="9" y1="6" x2="20" y2="6" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="18" x2="16" y2="18" />
    </svg>
  );
}

export function MessageSecureIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M4 5h16v11H8l-4 4z" />
      <path d="M10 11h.01M12 11h.01M14 11h.01" strokeWidth="2" />
    </svg>
  );
}

export function VaultIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <line x1="3.5" y1="9" x2="20.5" y2="9" />
      <circle cx="12" cy="13.5" r="2.5" />
      <line x1="12" y1="13.5" x2="12" y2="17.5" />
    </svg>
  );
}

export function HostingFranceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="3" y="4" width="18" height="6" rx="1.5" />
      <rect x="3" y="14" width="18" height="6" rx="1.5" />
      <circle cx="6.5" cy="7" r="0.8" fill="currentColor" />
      <circle cx="6.5" cy="17" r="0.8" fill="currentColor" />
      <line x1="10" y1="7" x2="18" y2="7" />
      <line x1="10" y1="17" x2="18" y2="17" />
    </svg>
  );
}

export function EncryptionIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M6 11V8a6 6 0 0112 0v3" />
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M12 15v3" />
    </svg>
  );
}

export function RgpdIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 3l8 3.5v6c0 4.5-3.4 7.8-8 8.5-4.6-.7-8-4-8-8.5v-6L12 3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function ComplianceRinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 3v18M5 8h14M7 13l-3 5h6M17 13l3 5h-6" />
      <circle cx="12" cy="6" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function BackupIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M21 12a9 9 0 11-3-6.7" />
      <polyline points="21 4 21 9 16 9" />
    </svg>
  );
}

export function AuditIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="11" cy="11" r="6" />
      <line x1="15.5" y1="15.5" x2="21" y2="21" />
      <path d="M8 11h6M11 8v6" opacity="0.6" />
    </svg>
  );
}

export function ArrowRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props} strokeWidth={2}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function CrossIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

export const FEATURE_ICONS = {
  'form-guide': FormGuideIcon,
  'scan-ocr': ScanOcrIcon,
  'timeline': TimelineIcon,
  'ai-brief': AiBriefIcon,
  'validate': ValidateIcon,
  'status-track': StatusTrackIcon,
  'message-secure': MessageSecureIcon,
  'vault': VaultIcon,
} as const;

export type FeatureIconKey = keyof typeof FEATURE_ICONS;

export const SECURITY_ICONS = {
  'hosting-france': HostingFranceIcon,
  'encryption': EncryptionIcon,
  'rgpd': RgpdIcon,
  'compliance-rin': ComplianceRinIcon,
  'backup': BackupIcon,
  'audit': AuditIcon,
} as const;

export type SecurityIconKey = keyof typeof SECURITY_ICONS;
