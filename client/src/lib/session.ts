export function getOrCreateSessionId(): string {
  const SESSION_KEY = 'curalina_session_id';
  
  let sessionId = localStorage.getItem(SESSION_KEY);
  
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  
  return sessionId;
}

export function getSessionId(): string | null {
  return localStorage.getItem('curalina_session_id');
}

export function clearSession(): void {
  localStorage.removeItem('curalina_session_id');
}
