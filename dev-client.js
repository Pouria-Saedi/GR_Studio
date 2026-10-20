(() => {
  const stream = new EventSource('/__dev/events');
  let connectedOnce = false;
  stream.addEventListener('open', () => {
    if (connectedOnce) window.location.reload();
    connectedOnce = true;
  });
  stream.addEventListener('message', (event) => {
    let change;
    try { change = JSON.parse(event.data); } catch { return; }
    if (change.path === 'server.js') return;
    if (change.path.endsWith('.css')) {
      for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
        const url = new URL(link.href);
        url.searchParams.set('_live', String(Date.now()));
        link.href = url.toString();
      }
      return;
    }
    window.location.reload();
  });
})();