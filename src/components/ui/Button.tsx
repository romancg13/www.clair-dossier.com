import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary:
    'sheen bg-gold-500 text-navy-900 shadow-gold hover:-translate-y-0.5 hover:shadow-gold-strong',
  secondary: 'bg-navy-900 text-cream-50 hover:bg-navy-800 hover:-translate-y-0.5',
  ghost: 'bg-cream-100 text-navy-900 hover:bg-cream-200',
  outline: 'border hairline bg-transparent text-navy-900 hover:border-gold-500 hover:text-navy-900',
};

const SIZE: Record<Size, string> = {
  sm: 'px-3.5 py-2 text-sm',
  md: 'px-5 py-3 text-sm',
  lg: 'px-6 py-3.5 text-base',
};

type CommonProps = {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
  full?: boolean;
};

type ButtonProps = CommonProps & {
  to?: undefined;
  href?: undefined;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
};

type LinkProps = CommonProps & {
  to: string;
  href?: undefined;
};

type AnchorProps = CommonProps & {
  href: string;
  to?: undefined;
  target?: string;
  rel?: string;
};

export function Button(props: ButtonProps | LinkProps | AnchorProps) {
  const {
    children,
    variant = 'primary',
    size = 'md',
    className = '',
    full = false,
  } = props;
  const cls = [
    'inline-flex items-center justify-center gap-2 rounded-full font-semibold leading-none transition-[background-color,transform,box-shadow,border-color] duration-200',
    VARIANT[variant],
    SIZE[size],
    full ? 'w-full' : '',
    className,
  ].filter(Boolean).join(' ');

  if ('to' in props && props.to) {
    return (
      <Link to={props.to} className={cls}>
        {children}
      </Link>
    );
  }
  if ('href' in props && props.href) {
    return (
      <a href={props.href} target={props.target} rel={props.rel} className={cls}>
        {children}
      </a>
    );
  }
  const { onClick, type = 'button', disabled } = props as ButtonProps;
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls + (disabled ? ' opacity-60 cursor-not-allowed' : '')}>
      {children}
    </button>
  );
}
