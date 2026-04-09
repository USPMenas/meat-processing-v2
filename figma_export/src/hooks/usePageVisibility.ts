import { useEffect, useState } from 'react';

function getVisibilityState(): boolean {
  if (typeof document === 'undefined') {
    return true;
  }

  return document.visibilityState !== 'hidden';
}

export function usePageVisibility(): boolean {
  const [isVisible, setIsVisible] = useState<boolean>(getVisibilityState);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return () => undefined;
    }

    const handleVisibilityChange = () => {
      setIsVisible(getVisibilityState());
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return isVisible;
}
