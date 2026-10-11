import React from 'react';

const Background: React.FC = () => (
  <div className="atmospheric-bg" aria-hidden="true">
    <div className="atmospheric-glow-cyan" />
    <div className="atmospheric-glow-violet" />
    <svg className="absolute inset-0 h-full w-full opacity-[.045]" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs><pattern id="energy-fine-grid" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M4 0H0v4" fill="none" stroke="currentColor" strokeWidth=".08" /></pattern></defs>
      <rect width="100" height="100" fill="url(#energy-fine-grid)" />
    </svg>
  </div>
);

export default Background;
