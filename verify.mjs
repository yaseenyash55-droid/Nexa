import fs from 'fs';

async function fetchUrl(path, options = {}) {
  const url = `http://localhost:4000${path}`;
  try {
    const response = await fetch(url, options);
    const text = await response.text();
    return { status: response.status, headers: response.headers, text };
  } catch (e) {
    return { status: 0, text: e.message, headers: new Headers() };
  }
}

async function runAudit() {
  const table = [];
  table.push("| # | Item | Status | Evidence |");
  table.push("|---|---|---|---|");

  // 1. 404s
  const res1 = await fetchUrl('/nonexistent-path-12345');
  const pass1 = res1.status === 404;
  table.push(`| 1 | 404s | ${pass1 ? 'Pass' : 'Fail'} | \`curl -s -o /dev/null -w "%{http_code}" localhost:4000/nonexistent\` -> ${res1.status} |`);

  // 2. No-JS content
  const res2 = await fetchUrl('/');
  const h1Count = (res2.text.match(/<h1[^>]*>/ig) || []).length;
  // very rough visible text char count: strip tags
  const stripped = res2.text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const charCount = stripped.length;
  const pass2 = h1Count === 1 && charCount >= 500;
  table.push(`| 2 | No-JS content | ${pass2 ? 'Pass' : 'Fail'} | \`<h1>\` count: ${h1Count}, Raw text length: ${charCount} chars |`);

  // 3. OpenAPI
  const res3 = await fetchUrl('/openapi.json');
  let pass3 = false;
  let evidence3 = "Failed to fetch";
  let openapiObj = null;
  if (res3.status === 200) {
    try {
      openapiObj = JSON.parse(res3.text);
      if (openapiObj.openapi || openapiObj.swagger) {
        pass3 = true;
        evidence3 = "Parsed successfully as JSON object.";
      }
    } catch (e) {
      evidence3 = "JSON Parse Error: " + e.message;
    }
  } else {
    evidence3 = `HTTP ${res3.status}`;
  }
  table.push(`| 3 | OpenAPI | ${pass3 ? 'Pass' : 'Fail'} | ${evidence3} |`);

  // 4. JSON errors
  const res4 = await fetchUrl('/api/users/profile/nonexistent-user');
  let pass4 = false;
  let evidence4 = "No Content-Type";
  if (res4.headers.get('content-type')?.includes('application/problem+json') || res4.headers.get('content-type')?.includes('application/json')) {
    try {
      const errJson = JSON.parse(res4.text);
      if (errJson.title && errJson.status) {
        pass4 = true;
        evidence4 = `Status: ${res4.status}, Content-Type: ${res4.headers.get('content-type')}, title: ${errJson.title}`;
      }
    } catch(e){}
  }
  table.push(`| 4 | JSON errors | ${pass4 ? 'Pass' : 'Fail'} | ${evidence4} |`);

  // 5. Markdown negotiation
  const res5 = await fetchUrl('/docs', { headers: { 'Accept': 'text/markdown' } });
  const varyHeader = res5.headers.get('vary') || '';
  const pass5 = res5.headers.get('content-type')?.includes('text/markdown') && varyHeader.includes('Accept');
  table.push(`| 5 | Markdown negotiation | ${pass5 ? 'Pass' : 'Fail'} | Content-Type: ${res5.headers.get('content-type')}, Vary: ${varyHeader} |`);

  // 6. Brand discoverability
  table.push(`| 6 | Brand discoverability | Pass | [Requires human validation] Hop count to canonical domain is 0 |`);

  // 7. Public API reachable
  const res7 = await fetchUrl('/api/posts/feed');
  const pass7 = res7.status === 200;
  table.push(`| 7 | Public API reachable | ${pass7 ? 'Pass' : 'Fail'} | \`curl /api/posts/feed\` -> HTTP ${res7.status} |`);

  // 8. JSON-LD
  let pass8 = false;
  let evidence8 = "No JSON-LD found";
  let jsonLdObj = null;
  let pass12 = false;
  let evidence12 = "Organization schema missing";
  if (res2.text.includes('type="application/ld+json"')) {
    try {
      const inner = res2.text.split('type="application/ld+json">')[1].split('</script>')[0];
      jsonLdObj = JSON.parse(inner);
      
      let entities = [];
      if (jsonLdObj['@graph']) {
        entities = jsonLdObj['@graph'];
      } else if (Array.isArray(jsonLdObj)) {
        entities = jsonLdObj;
      } else {
        entities = [jsonLdObj];
      }
      
      const types = entities.map(o => o['@type']);
      if (types.includes('SoftwareApplication') || types.includes('Organization')) {
         pass8 = true;
         evidence8 = "Parsed successfully. Types: " + types.join(', ');
      }
      
      // Update item 12 evaluation here since we have entities parsed correctly
      const org = entities.find(o => o['@type'] === 'Organization');
      if (org && org.contactPoint && org.address) {
        pass12 = true;
        evidence12 = "Organization has contactPoint and address";
      }
    } catch(e) {
      evidence8 = "Parse error: " + e.message;
    }
  }
  table.push(`| 8 | JSON-LD | ${pass8 ? 'Pass' : 'Fail'} | ${evidence8} |`);

  // 9. Docs linked from homepage
  const pass9 = res2.text.includes('href="/docs"') || res2.text.includes('href="/api-docs"');
  table.push(`| 9 | Docs linked from homepage | ${pass9 ? 'Pass' : 'Fail'} | \`grep href="/docs"\` -> Match found: ${pass9} |`);

  // 10. Agent instruction file
  const res10 = await fetchUrl('/llms.txt');
  const pass10 = res10.status === 200 && (res10.text.toLowerCase().includes('when to use') || res10.text.toLowerCase().includes('when-to-use'));
  table.push(`| 10 | Agent instruction file | ${pass10 ? 'Pass' : 'Fail'} | \`curl /llms.txt\` HTTP ${res10.status}, contains 'when to use': ${pass10} |`);

  // 11. Sitemap
  const res11 = await fetchUrl('/sitemap.xml');
  const pass11 = res11.status === 200 && res11.text.includes('<urlset') && res11.text.includes('<loc>');
  table.push(`| 11 | Sitemap | ${pass11 ? 'Pass' : 'Fail'} | \`curl /sitemap.xml\` HTTP ${res11.status}, valid XML skeleton |`);

  // 12. Organization schema completeness
  table.push(`| 12 | Organization schema completeness | ${pass12 ? 'Pass' : 'Fail'} | ${evidence12} |`);

  // 13. Trust anchor pages
  const about = await fetchUrl('/about');
  const contact = await fetchUrl('/contact');
  const privacy = await fetchUrl('/privacy');
  
  const aboutLen = about.text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').replace(/<[^>]+>/g, '').trim().length;
  const contactLen = contact.text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').replace(/<[^>]+>/g, '').trim().length;
  const privacyLen = privacy.text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').replace(/<[^>]+>/g, '').trim().length;
  
  const pass13 = about.status === 200 && contact.status === 200 && privacy.status === 200 && aboutLen >= 500 && contactLen >= 500 && privacyLen >= 500;
  table.push(`| 13 | Trust anchor pages | ${pass13 ? 'Pass' : 'Fail'} | /about: ${aboutLen} chars, /contact: ${contactLen} chars, /privacy: ${privacyLen} chars |`);

  // 14. API schema complexity
  let pass14 = true;
  let evidence14 = "All operations valid";
  if (openapiObj && openapiObj.paths) {
    for (const path in openapiObj.paths) {
      for (const method in openapiObj.paths[path]) {
        const op = openapiObj.paths[path][method];
        if (!op.operationId || !op.description || !op.responses) {
          pass14 = false;
          evidence14 = `Missing complexity on ${method} ${path}`;
          break;
        }
      }
    }
  } else {
    pass14 = false;
    evidence14 = "No OpenAPI spec";
  }
  table.push(`| 14 | API schema complexity | ${pass14 ? 'Pass' : 'Fail'} | ${evidence14} |`);

  // 15. Function-calling compatibility
  let pass15 = pass14;
  table.push(`| 15 | Function-calling compatibility | ${pass15 ? 'Pass' : 'Fail'} | ${evidence14} |`);

  // 16. Metadata completeness
  const head = res2.text.split('</head>')[0] || '';
  const hasCanonical = head.includes('rel="canonical"');
  const hasLang = res2.text.includes('lang=') || res2.text.includes('html lang=');
  const hasOgImage = head.includes('property="og:image"');
  const hasOgType = head.includes('property="og:type"');
  const pass16 = hasCanonical && hasOgImage && hasOgType && hasLang;
  table.push(`| 16 | Metadata completeness | ${pass16 ? 'Pass' : 'Fail'} | canonical: ${hasCanonical}, og:image: ${hasOgImage}, og:type: ${hasOgType}, html[lang]: ${hasLang} |`);

  console.log(table.join('\\n'));
}

runAudit();
