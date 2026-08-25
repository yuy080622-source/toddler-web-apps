(() => {
  "use strict";

  const projectId = "y7wygqymd5";
  const clarityName = "clarity";

  window[clarityName] = window[clarityName] || function () {
    (window[clarityName].q = window[clarityName].q || []).push(arguments);
  };

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${projectId}`;

  const firstScript = document.getElementsByTagName("script")[0];
  firstScript.parentNode.insertBefore(script, firstScript);
})();
