import { FileText } from 'lucide-react';
import branding from '../config/branding';

/**
 * Logo Component
 * 
 * Displays either a custom logo image or the default icon.
 * Configure in src/config/branding.js or via environment variables.
 */
export default function Logo({ className = '', size = 'default' }) {
  const sizes = {
    small: { icon: 'h-6 w-6', img: '24' },
    default: { icon: 'h-8 w-8', img: branding.logoHeight || '40' },
    large: { icon: 'h-16 w-16', img: '64' },
  };

  const currentSize = sizes[size] || sizes.default;

  if (branding.logoUrl) {
    return (
      <img
        src={branding.logoUrl}
        alt={branding.logoAlt}
        className={className}
        style={{ height: `${currentSize.img}px`, width: 'auto' }}
      />
    );
  }

  return (
    <FileText className={`${currentSize.icon} text-primary-600 ${className}`} />
  );
}

/**
 * Logo with App Name
 * Used in header/navigation
 */
export function LogoWithName({ className = '' }) {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <Logo size="default" />
      <span className="text-xl font-bold text-gray-900">{branding.appName}</span>
    </div>
  );
}
