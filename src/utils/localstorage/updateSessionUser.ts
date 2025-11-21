import type { SessionData } from "@/stores/session";

type Session = NonNullable<SessionData>;

const updateSessionUser = <K extends keyof Session>(
  key: K,
  newValue: Session[K]
): void => {
  const raw = localStorage.getItem("session");
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw) as Session | null;
    if (!parsed || typeof parsed !== "object") return;

    const updated: Session = {
      ...parsed,
      [key]: newValue,
    } as Session;

    localStorage.setItem("session", JSON.stringify(updated));
  } catch {
    // Silently ignore parse errors to avoid breaking flow
  }
};

export { updateSessionUser };
