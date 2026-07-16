// src/hooks/useSkeleton.ts
import { useState, useEffect, useCallback } from 'react';

interface UseSkeletonOptions<T> {
  fetcher: () => Promise<T>;
  initialData?: T | null;
  delay?: number;
  deps?: any[];
}

interface UseSkeletonResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  setData: (data: T | null) => void;
}

export function useSkeleton<T>({
  fetcher,
  initialData = null,
  delay = 300,
  deps = [],
}: UseSkeletonOptions<T>): UseSkeletonResult<T> {
  
  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    const startTime = Date.now();
    
    try {
      const result = await fetcher();
      
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, delay - elapsed);
      
      if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, remaining));
      }
      
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Error al cargar datos');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    setData,
  };
}