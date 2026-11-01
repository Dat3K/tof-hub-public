'use client';

import React from 'react';
import {Toast} from '@tof-hub/ui';

interface CompToastProps {
  message: string;
  visible: boolean;
}

export const CompToast: React.FC<CompToastProps> = ({ message, visible }) => {
  return <Toast eventKey={message} duration={3000}>{visible?(
    <div
      className="flex items-center gap-2"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#38bdf8"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span>{message}</span>
    </div>
  ):null}</Toast>;
};
