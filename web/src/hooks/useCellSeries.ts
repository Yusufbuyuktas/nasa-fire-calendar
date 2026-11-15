import { useEffect, useMemo, useState } from 'react';
import type { FireDataRow } from '../types/fireData';
import {
  getCachedCellSeries,
  loadCellSeries,
} from '../services/fireDataService';

interface UseCellSeriesResult {
  rows: FireDataRow[];
  loading: boolean;
  error: string | null;
}

export function useCellSeries(gridId: string | null): UseCellSeriesResult {
  const [loadedState, setLoadedState] = useState<{
    gridId: string | null;
    rows: FireDataRow[];
    error: string | null;
  }>({ gridId: null, rows: [], error: null });

  const cachedRows = gridId ? getCachedCellSeries(gridId) : undefined;
  const isCurrentLoaded = Boolean(gridId) && loadedState.gridId === gridId;

  const rows = useMemo(() => {
    if (!gridId) return [];
    return cachedRows ?? (isCurrentLoaded ? loadedState.rows : []);
  }, [gridId, cachedRows, isCurrentLoaded, loadedState.rows]);

  const loading = Boolean(gridId) && !cachedRows && !isCurrentLoaded;
  const error =
    Boolean(gridId) && !cachedRows && isCurrentLoaded
      ? loadedState.error
      : null;

  useEffect(() => {
    if (!gridId) return;

    let cancelled = false;

    loadCellSeries(gridId)
      .then((seriesRows) => {
        if (!cancelled) {
          setLoadedState({ gridId, rows: seriesRows, error: null });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadedState({
            gridId,
            rows: [],
            error:
              err instanceof Error
                ? err.message
                : 'Hücre zaman serisi yüklenemedi',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [gridId]);

  return { rows, loading, error };
}