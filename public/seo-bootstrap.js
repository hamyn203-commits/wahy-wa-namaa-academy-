(function () {
  var path = window.location.pathname || '/';
  var clean = path.replace(/\/+$/, '') || '/';
  var match = clean.match(/^\/(ar|en|fr|de|tr|ur|id|ms|ku)(?:\/|$)/);
  var loc = match ? match[1] : 'ar';
  var isRtl = loc === 'ar' || loc === 'ur' || loc === 'ku';
  document.documentElement.lang = loc;
  document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
  var noindexRe = /^(?:\/(?:ar|en|fr|de|tr|ur|id|ms|ku))?\/(?:login|register(?:\/(?:student|guardian))?|forgot-password|reset-password|admin(?:\/.*)?|student(?:\/.*)?|teacher\/dashboard(?:\/.*)?|guardian(?:\/.*)?|live(?:\/.*)?|meeting(?:\/.*)?|payment(?:\/.*)?|profile(?:\/.*)?|notifications(?:\/.*)?|settings(?:\/.*)?|ai|journey|verify-certificate(?:\/.*)?|book-trial(?:\/.*)?|courses\/[^/]+\/learn(?:\/.*)?)$/i;
  var canonicalEl = document.querySelector('link[rel="canonical"]');
  if (noindexRe.test(clean)) {
    if (canonicalEl) canonicalEl.remove();
    ['robots', 'googlebot'].forEach(function (n) {
      var m = document.querySelector('meta[name="' + n + '"]');
      if (m) m.setAttribute('content', 'noindex, nofollow');
    });
  } else {
    if (!canonicalEl) {
      canonicalEl = document.createElement('link');
      canonicalEl.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute('href', 'https://wahywanamaa.com' + (clean === '/' ? '/ar' : clean));
  }
})();
