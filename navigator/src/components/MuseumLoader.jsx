import { useEffect, useState } from 'react';

export default function MuseumLoader({ children }) {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    fetch('/config/museum.json')
      .then(r => r.json())
      .then(setConfig);
  }, []);

  if (!config) return <p>Loading museum...</p>;
  return children(config);
}
