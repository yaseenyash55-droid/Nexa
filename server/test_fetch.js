async function run() {
  const res = await fetch('http://localhost:4000/api/v1/groups', { // Wait, what is the exact base path?
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test Group', memberIds: [2, 3] })
  });
  console.log(res.status, await res.text());
}
run();
