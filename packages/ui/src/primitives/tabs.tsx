'use client';

import React, { createContext, useContext, useState, useId, useRef } from 'react';
import type {
  TabsProps,
  TabsListProps,
  TabsTriggerProps,
  TabsContentProps,
  TabsOrientation,
  TabsVariant,
} from './types';

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
  orientation: TabsOrientation;
  baseId: string;
  variant: TabsVariant;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs compound components must be rendered within a <Tabs /> provider.');
  }
  return context;
}

export const Tabs: React.FC<TabsProps> & {
  List: typeof TabsList;
  Trigger: typeof TabsTrigger;
  Content: typeof TabsContent;
} = ({
  value: controlledValue,
  defaultValue = '',
  onValueChange,
  orientation = 'horizontal',
  children,
  className = '',
  ...rest
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const baseId = useId();

  const isControlled = controlledValue !== undefined;
  const activeValue = isControlled ? controlledValue : internalValue;

  const handleValueChange = (val: string) => {
    if (!isControlled) {
      setInternalValue(val);
    }
    onValueChange?.(val);
  };

  return (
    <TabsContext.Provider
      value={{
        value: activeValue,
        setValue: handleValueChange,
        orientation,
        baseId,
        variant: 'neon',
      }}
    >
      <div
        className={`tabs-root ${orientation === 'vertical' ? 'flex gap-4' : 'flex flex-col'} ${className}`.trim()}
        {...rest}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
};

export const TabsList: React.FC<TabsListProps> = ({
  variant = 'neon',
  children,
  className = '',
  'aria-label': ariaLabel = 'Navigation Tabs',
  ...rest
}) => {
  const context = useTabs();
  const listRef = useRef<HTMLDivElement>(null);

  // Update variant in context
  context.variant = variant;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!listRef.current) return;
    const triggers = Array.from(
      listRef.current.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])')
    );
    const currentIndex = triggers.findIndex((t) => t === document.activeElement);

    if (currentIndex === -1) return;

    let nextIndex = currentIndex;
    const isHorizontal = context.orientation === 'horizontal';

    if ((isHorizontal && e.key === 'ArrowRight') || (!isHorizontal && e.key === 'ArrowDown')) {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % triggers.length;
    } else if ((isHorizontal && e.key === 'ArrowLeft') || (!isHorizontal && e.key === 'ArrowUp')) {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + triggers.length) % triggers.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = triggers.length - 1;
    }

    if (nextIndex !== currentIndex) {
      const nextTrigger = triggers[nextIndex];
      nextTrigger.focus();
      const val = nextTrigger.getAttribute('data-value');
      if (val) {
        context.setValue(val);
      }
    }
  };

  let variantClasses = '';
  if (variant === 'pills') {
    variantClasses = 'bg-[#151119] p-1 rounded-lg border border-white/10 gap-1';
  } else if (variant === 'underline') {
    variantClasses = 'border-b border-white/10 gap-4';
  } else {
    // neon variant
    variantClasses = 'bg-[#100d14]/80 backdrop-blur-sm p-1 rounded-lg border border-white/10 gap-1.5 shadow-inner';
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-orientation={context.orientation}
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={`tabs-list inline-flex items-center select-none ${variantClasses} ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
};

export const TabsTrigger: React.FC<TabsTriggerProps> = ({
  value,
  children,
  icon,
  className = '',
  disabled = false,
  ...rest
}) => {
  const { value: activeValue, setValue, baseId, variant } = useTabs();
  const isActive = activeValue === value;
  const tabId = `${baseId}-tab-${value}`;
  const panelId = `${baseId}-panel-${value}`;

  let activeClasses = '';
  if (variant === 'pills') {
    activeClasses = isActive
      ? 'bg-[#2ba6df] text-white shadow-md font-semibold'
      : 'text-[#9ca3af] hover:text-white hover:bg-white/5';
  } else if (variant === 'underline') {
    activeClasses = isActive
      ? 'text-[#2ba6df] border-b-2 border-[#2ba6df] font-semibold -mb-px shadow-[0_2px_8px_rgba(43,166,223,0.3)]'
      : 'text-[#9ca3af] hover:text-white border-b-2 border-transparent';
  } else {
    // neon variant
    activeClasses = isActive
      ? 'bg-[rgba(43,166,223,0.18)] text-[#55c2ef] border border-[#2ba6df]/70 shadow-[0_0_12px_rgba(43,166,223,0.3)] font-semibold'
      : 'text-[#9ca3af] hover:text-[#f3f4f6] hover:bg-white/5 border border-transparent';
  }

  return (
    <button
      type="button"
      role="tab"
      id={tabId}
      aria-selected={isActive}
      aria-controls={panelId}
      tabIndex={isActive ? 0 : -1}
      data-value={value}
      disabled={disabled}
      onClick={() => setValue(value)}
      className={`tabs-trigger inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm rounded-md transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2ba6df] disabled:opacity-40 disabled:cursor-not-allowed ${activeClasses} ${className}`.trim()}
      {...rest}
    >
      {icon && <span className="inline-flex shrink-0 items-center">{icon}</span>}
      {children}
    </button>
  );
};

export const TabsContent: React.FC<TabsContentProps> = ({
  value,
  children,
  className = '',
  ...rest
}) => {
  const { value: activeValue, baseId } = useTabs();
  const isActive = activeValue === value;
  const tabId = `${baseId}-tab-${value}`;
  const panelId = `${baseId}-panel-${value}`;

  if (!isActive) return null;

  return (
    <div
      role="tabpanel"
      id={panelId}
      aria-labelledby={tabId}
      tabIndex={0}
      className={`tabs-content focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2ba6df] rounded-md ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
};

Tabs.List = TabsList;
Tabs.Trigger = TabsTrigger;
Tabs.Content = TabsContent;
