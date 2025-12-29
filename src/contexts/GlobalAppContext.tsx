import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface GlobalAppContextType {
  isLoading: boolean;
  loadingMessage: string;
  error: string | null;
  errorType: 'error' | 'offline' | null;
  clearError: () => void;
  retryLastAction: () => void;
  isReconnecting: boolean;
  reconnectMessage: string;
  setError: (message: string | null, type?: 'error' | 'offline') => void;
  setRetryAction: (action: (() => void) | null) => void;
  setStreamEnded: (ended: boolean) => void;
}

const GlobalAppContext = createContext<GlobalAppContextType | undefined>(undefined);

interface GlobalAppProviderProps {
  children: ReactNode;
}

export const GlobalAppProvider: React.FC<GlobalAppProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setErrorState] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'error' | 'offline' | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectMessage, setReconnectMessage] = useState('');
  const [retryAction, setRetryActionState] = useState<(() => void) | null>(null);
  const [isStreamEnded, setIsStreamEndedState] = useState(false);

  const setError = useCallback((message: string | null, type: 'error' | 'offline' = 'error') => {
    setErrorState(message);
    setErrorType(message ? type : null);
  }, []);

  const setRetryAction = useCallback((action: (() => void) | null) => {
    setRetryActionState(() => action);
  }, []);

  const setStreamEnded = useCallback((ended: boolean) => {
    setIsStreamEndedState(ended);
  }, []);

  const clearError = useCallback(() => {
    setErrorState(null);
    setErrorType(null);
    setRetryActionState(null);
    setIsStreamEndedState(false);
  }, []);

  const retryLastAction = useCallback(() => {
    if (retryAction) {
      retryAction();
    }
  }, [retryAction]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const goOnline = () => {
      clearError();
    };

    const goOffline = () => {
      setError(
        'You are offline. The Troll City shell remains available but live data may be delayed until you reconnect.',
        'offline'
      );
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    if (!navigator.onLine) {
      goOffline();
    }

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [clearError, setError]);

  const value: GlobalAppContextType = {
    isLoading,
    loadingMessage,
    error,
    errorType,
    clearError,
    retryLastAction,
    isReconnecting,
    reconnectMessage,
    setError,
    setRetryAction,
    setStreamEnded,
  };

  return (
    <GlobalAppContext.Provider value={value}>
      {children}
    </GlobalAppContext.Provider>
  );
};

export const useGlobalApp = (): GlobalAppContextType => {
  const context = useContext(GlobalAppContext);
  if (context === undefined) {
    throw new Error('useGlobalApp must be used within a GlobalAppProvider');
  }
  return context;
};

