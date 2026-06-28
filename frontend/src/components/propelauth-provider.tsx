"use client";

/**
 * PropelAuthProvider — stub for Pounce (no PropelAuth).
 * Returns children directly without any auth context.
 */
export function PropelAuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export default PropelAuthProvider;
