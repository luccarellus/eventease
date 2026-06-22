export function toDate(value: string): Date {
  return new Date(value);
}

export function toDateOrUndefined(value?: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }

  return new Date(value);
}
