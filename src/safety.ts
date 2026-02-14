export function requireWriteConfirm(args: {
  confirm: boolean;
  reason?: string;
}): void {
  if (!args.confirm) {
    throw new Error("Write requires 'confirm: true'");
  }
  const reason = typeof args.reason === 'string' ? args.reason.trim() : '';
  if (!reason) {
    throw new Error("Write requires a non-empty 'reason'");
  }
}

