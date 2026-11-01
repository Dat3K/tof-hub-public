import React from "react";
import { LoadingIndicator } from "./loading-indicator";
import type { LoadingStateProps } from "../types";

/** One animation for routes and regions. Old variants remain compatibility aliases. */
export function LoadingState({
  message = "Loading…",
  submessage,
  fullPage = false,
  className = "",
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`tof-loading ${fullPage ? "tof-loading--page" : "tof-loading--region"} ${className}`}
    >
      <LoadingIndicator />
      <div className="tof-loading__copy">
        <p className="tof-loading__message">{message}</p>
        {submessage && <p className="tof-loading__description">{submessage}</p>}
      </div>
    </div>
  );
}
