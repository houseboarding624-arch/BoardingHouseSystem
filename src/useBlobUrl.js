import { useEffect, useState } from 'react';
import { api } from './api.js';

/** Loads an API image (needs login) and returns a local URL for <img src>. Pass null to skip. */
export function useBlobUrl(path) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!path) return undefined;
    let alive = true;
    let objectUrl = null;
    setUrl(null);
    setFailed(false);
    api
      .blob(path)
      .then((b) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(b);
        setUrl(objectUrl);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  return { url, failed };
}
