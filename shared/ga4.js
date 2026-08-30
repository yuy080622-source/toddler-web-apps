(() => {
  "use strict";

  const measurementId = "G-M5FPMG34LE";
  const scriptUrl = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;

  if (window.__PRJ003_GA4_INITIALIZED__) return;
  window.__PRJ003_GA4_INITIALIZED__ = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", measurementId);

  if (document.querySelector(`script[src="${scriptUrl}"]`)) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = scriptUrl;
  document.head.appendChild(script);
})();
