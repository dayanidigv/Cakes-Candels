import { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';

export const useMasterOptions = (endpoint: string) => {
  const [options, setOptions] = useState<{ value: string, label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOptions = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch max reasonable amount for a dropdown to avoid pagination issues initially
      const res = await apiRequest(`/${endpoint}?limit=500`);
      if (res && res.items) {
        // Handle standard name/id mapping
        const mapped = res.items.map((item: any) => ({
          value: item.id,
          label: item.name || item.symbol || item.code || item.title || item.roleName || 'Unnamed'
        }));
        setOptions(mapped);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load options');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOptions();
  }, [endpoint]);

  return { options, loading, error, retry: loadOptions };
};
