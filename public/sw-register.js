(function () {
  var isLocalDev = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  if ('serviceWorker' in navigator && !isLocalDev) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
        .then(function (registration) {
          registration.update().catch(function () {});
        })
        .catch(function () {});
    });
  } else if ('serviceWorker' in navigator && isLocalDev) {
    navigator.serviceWorker.getRegistrations()
      .then(function (registrations) {
        registrations.forEach(function (registration) { registration.unregister(); });
      });
  }
})();
