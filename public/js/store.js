// ============================================
// VNportal — Store (localStorage persistence)
// ============================================

const Store = (() => {
  const KEY = 'vnportal_data';

  const defaults = {
    vinyls: [],
    covers: {},       // vinylId -> dataURL
    settings: {
      currentVinylId: null,
    }
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
    } catch {
      return { ...defaults };
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function get() {
    return load();
  }

  function addVinyl(vinyl) {
    const data = load();
    vinyl.id = Date.now().toString();
    vinyl.createdAt = new Date().toISOString();
    vinyl.plays = 0;
    data.vinyls.unshift(vinyl);
    save(data);
    return vinyl;
  }

  function getVinyl(id) {
    return load().vinyls.find(v => v.id === id) || null;
  }

  function updateVinyl(id, updates) {
    const data = load();
    data.vinyls = data.vinyls.map(v => v.id === id ? { ...v, ...updates } : v);
    save(data);
  }

  function deleteVinyl(id) {
    const data = load();
    data.vinyls = data.vinyls.filter(v => v.id !== id);
    delete data.covers[id];
    save(data);
  }

  function saveCover(vinylId, dataURL) {
    const data = load();
    data.covers[vinylId] = dataURL;
    save(data);
  }

  function getCover(vinylId) {
    return load().covers[vinylId] || null;
  }

  function setCurrentVinyl(id) {
    const data = load();
    data.settings.currentVinylId = id;
    save(data);
  }

  function getCurrentVinyl() {
    const data = load();
    return data.vinyls.find(v => v.id === data.settings.currentVinylId) || data.vinyls[0] || null;
  }

  return { get, addVinyl, getVinyl, updateVinyl, deleteVinyl, saveCover, getCover, setCurrentVinyl, getCurrentVinyl };
})();

  // Save a plain URL as cover (fallback when canvas is CORS-tainted)
  function saveCoverUrl(vinylId, url) {
    const data = load();
    data.covers[vinylId] = { type: 'url', src: url };
    save(data);
  }

  // getCover returns either a dataURL string or an object {type:'url', src}
  // Callers should handle both
