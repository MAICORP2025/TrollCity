export const sessions: Map<string, string> = new Map();

export const generateSessionId = () =>
  Math.random().toString(36).substring(2) + Date.now().toString(36);

export const getUserIdFromSession = (sessionId: string): string | undefined => {
  return sessions.get(sessionId);
};

export const createSession = (userId: string): string => {
  const sessionId = generateSessionId();
  sessions.set(sessionId, userId);
  return sessionId;
};

export const deleteSession = (sessionId: string): boolean => {
  return sessions.delete(sessionId);
};
