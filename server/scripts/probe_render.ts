async function probeRender() {
  const urls = [
    'https://nexa-backend-in6s.onrender.com/',
    'https://nexa-backend-in6s.onrender.com/api/health',
    'https://nexa-backend-in6s.onrender.com/api/health/ready'
  ];

  for (const url of urls) {
    console.log(`\n========================================`);
    console.log(`Probing: ${url}`);
    try {
      const start = Date.now();
      const res = await fetch(url, { headers: { 'User-Agent': 'Nexa-Migration-Verifier/1.0' } });
      const duration = Date.now() - start;
      console.log(`Status: ${res.status} ${res.statusText} (${duration}ms)`);
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        console.log(`Body (JSON):`, JSON.stringify(json, null, 2));
      } catch {
        console.log(`Body (Text):`, text.slice(0, 500));
      }
    } catch (err: any) {
      console.error(`Error connecting:`, err.message);
    }
  }
  console.log(`========================================\n`);
}

probeRender();
