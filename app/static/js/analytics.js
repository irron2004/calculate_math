(function () {
  function normalizePayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return {};
    }
    var entries = Object.entries
      ? Object.entries(payload)
      : Object.keys(payload).map(function (key) {
          return [key, payload[key]];
        });
    var filtered = entries.filter(function (pair) {
      var value = pair[1];
      return value !== undefined && value !== null;
    });
    if (Object.fromEntries) {
      return Object.fromEntries(filtered);
    }
    var result = {};
    filtered.forEach(function (pair) {
      result[pair[0]] = pair[1];
    });
    return result;
  }

  function pushMatomo(eventName, payload) {
    if (!Array.isArray(window._paq)) {
      return;
    }
    try {
      window._paq.push(['trackEvent', 'practice', eventName, JSON.stringify(payload)]);
    } catch (error) {
      console.debug('matomo:error', error);
    }
  }

  function pushGA(eventName, payload) {
    if (typeof window.gtag !== 'function') {
      return;
    }
    try {
      window.gtag('event', eventName, payload);
    } catch (error) {
      console.debug('ga4:error', error);
    }
  }

  function trackEvent(eventName, payload) {
    var normalized = normalizePayload(payload);
    pushMatomo(eventName, normalized);
    pushGA(eventName, normalized);
  }

  function trackProblemRT(data) {
    trackEvent('problem_rt', normalizePayload(data));
  }

  function trackProblemExplanation(data) {
    trackEvent('problem_explanation', normalizePayload(data));
  }

  window.analytics = window.analytics || {};
  window.analytics.trackEvent = trackEvent;
  window.analytics.trackProblemRT = trackProblemRT;
  window.analytics.trackProblemExplanation = trackProblemExplanation;
})();
