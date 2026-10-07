export function requireWriteConfirm(args: {
  confirm: unknown;
  reason?: string;
}): void {
  // Only the JSON value true counts; "yes", 1, or "true" do not.
  if (args.confirm !== true) {
    throw new Error("Write requires 'confirm: true'");
  }
  const reason = typeof args.reason === 'string' ? args.reason.trim() : '';
  if (!reason) {
    throw new Error("Write requires a non-empty 'reason'");
  }
}

