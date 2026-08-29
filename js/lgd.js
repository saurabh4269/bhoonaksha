(() => {
  const worker = new Worker("js/lgd-worker.js?v=25");
  const gz = new URL("lgd/villages.json.gz", document.baseURI || location.href).href;
  let n = 0;
  let failed = null;
  const pending = new Map();
  let seq = 1;

  const ready = new Promise((resolve, reject) => {
    worker.addEventListener("message", (e) => {
      const d = e.data || {};
      if (d.type === "ready") {
        n = d.n;
        resolve(d);
        return;
      }
      if (d.type === "error" && !n) {
        failed = d.message;
        reject(new Error(d.message));
        return;
      }
      const p = pending.get(d.id);
      if (!p) return;
      pending.delete(d.id);
      if (d.type === "error") p.reject(new Error(d.message));
      else if (d.type === "near") p.resolve(d.item);
      else p.resolve(d.items || []);
    });
    worker.addEventListener("error", (err) => {
      failed = err.message || "worker";
      reject(err);
    });
  });

  worker.postMessage({ type: "load", url: gz });

  function call(msg) {
    const id = seq++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage(Object.assign({ id }, msg));
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          resolve(msg.type === "near" ? null : []);
        }
      }, 8000);
    });
  }

  window.LGD = {
    ready,
    count: () => n,
    failed: () => failed,
    search: async (q) => {
      try { await ready; } catch (e) { return []; }
      return call({ type: "search", q });
    },
    near: async (lat, lon) => {
      try { await ready; } catch (e) { return null; }
      return call({ type: "near", lat, lon });
    },
    nearby: async (lat, lon) => {
      try { await ready; } catch (e) { return []; }
      return call({ type: "nearby", lat, lon });
    }
  };
})();
