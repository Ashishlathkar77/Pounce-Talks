"use client";

import {
  Surface,
  EmptyState,
} from "@hemut2025/design-system";

/**
 * TeamMembers — stubbed for Pounce (no Clerk auth).
 * Shows a placeholder explaining team management is disabled in demo mode.
 */
export default function TeamMembers() {
  return (
    <Surface variant="primary" radius="lg" border="primary" padding="lg">
      <EmptyState
        size="md"
        icon="users-three"
        title="Team management unavailable"
        description="Team management is not available in demo mode."
      />
    </Surface>
  );
}
