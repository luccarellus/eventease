import React from 'react';

export interface AtomSpinnerProps extends React.SVGProps<SVGSVGElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
}

export const AtomSpinner: React.FC<AtomSpinnerProps> = ({
  className = '',
  size,
  style,
  ...props
}) => {
  let sizeClass = '';
  if (typeof size === 'number') {
    // numeric size handled via inline style
  } else if (size === 'sm') {
    sizeClass = 'w-4 h-4';
  } else if (size === 'md') {
    sizeClass = 'w-6 h-6';
  } else if (size === 'lg') {
    sizeClass = 'w-10 h-10';
  } else if (size === 'xl') {
    sizeClass = 'w-16 h-16';
  }

  const hasSize = size || /\b(w-|h-|size-)/.test(className);
  const hasColor = /\b(text-|stroke-|fill-)/.test(className);
  
  // Remove animate-spin if passed, since AtomSpinner manages its internal orbit animations
  const cleanClassName = className.replace(/\banimate-spin\b/g, '').trim();
  
  const finalClass = `${hasSize ? '' : 'w-6 h-6'} ${hasColor ? '' : 'text-primary'} ${sizeClass} ${cleanClassName}`.trim();

  const customStyle: React.CSSProperties = {
    ...(typeof size === 'number' ? { width: size, height: size } : {}),
    ...style,
  };

  return (
    <svg
      viewBox="0 0 100 100"
      className={`atom-spinner overflow-visible inline-block shrink-0 ${finalClass}`}
      style={customStyle}
      {...props}
    >
      {/* Central Nucleus */}
      <circle
        cx="50"
        cy="50"
        r="7.5"
        fill="currentColor"
        className="atom-nucleus"
        style={{ filter: 'drop-shadow(0 0 6px currentColor)' }}
      />

      {/* Orbit 1 (0 deg baseline) */}
      <g className="atom-orbit atom-orbit-1">
        <ellipse
          cx="50"
          cy="50"
          rx="38"
          ry="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeOpacity="0.4"
        />
        <circle
          cx="88"
          cy="50"
          r="4"
          fill="currentColor"
          style={{ filter: 'drop-shadow(0 0 5px currentColor)' }}
        />
      </g>

      {/* Orbit 2 (60 deg baseline) */}
      <g className="atom-orbit atom-orbit-2">
        <ellipse
          cx="50"
          cy="50"
          rx="38"
          ry="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeOpacity="0.4"
        />
        <circle
          cx="88"
          cy="50"
          r="4"
          fill="currentColor"
          style={{ filter: 'drop-shadow(0 0 5px currentColor)' }}
        />
      </g>

      {/* Orbit 3 (120 deg baseline) */}
      <g className="atom-orbit atom-orbit-3">
        <ellipse
          cx="50"
          cy="50"
          rx="38"
          ry="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeOpacity="0.4"
        />
        <circle
          cx="88"
          cy="50"
          r="4"
          fill="currentColor"
          style={{ filter: 'drop-shadow(0 0 5px currentColor)' }}
        />
      </g>
    </svg>
  );
};

export default AtomSpinner;
