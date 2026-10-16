import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { localDay } from '@/lib/dates';
import type { Analysis, AnalysisPage } from './types';
export function useAnalyses() {
  const [data, setData] = useState<AnalysisPage | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1),
    [status, setStatus] = useState('Todas'),
    [due, setDue] = useState(false);
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const id = ++sequence.current;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', today: localDay() });
      if (status !== 'Todas') params.set('status', status);
      if (due) params.set('followUp', 'due');
      const next = await api<AnalysisPage>('/api/analyses/page?' + params);
      if (id === sequence.current) setData(next);
    } catch (e) {
      if (id === sequence.current) setError((e as Error).message);
    } finally {
      if (id === sequence.current) setLoading(false);
    }
  }, [page, status, due]);
  useEffect(() => {
    void reload();
    return () => {
      sequence.current++;
    };
  }, [reload]);
  const mutate = async (url: string, method: string, body: unknown) => {
    setBusy(true);
    try {
      const result = await api<Analysis>(url, { method, body: JSON.stringify(body) });
      await reload();
      return result;
    } finally {
      setBusy(false);
    }
  };
  return {
    data,
    error,
    loading,
    busy,
    page: data?.page ?? page,
    status,
    due,
    reload,
    setPage,
    filterStatus: (value: string) => {
      setPage(1);
      setStatus(value);
    },
    filterDue: (value: boolean) => {
      setPage(1);
      setDue(value);
    },
    mutate,
  };
}
