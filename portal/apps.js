(() => {
  "use strict";
  const apps = [
    { name: "シャボン玉", icon: "🫧", href: "apps/APP-002-bubble-touch/", className: "bubble" },
    { name: "くだものポン！", icon: "🍎", href: "apps/APP-003-fruit-pop/", className: "fruit" },
    { name: "音あそびピアノ", icon: "🎹", href: "apps/APP-004-sound-play-piano/", className: "piano" },
    { name: "カラフル花火", icon: "🎆", href: "apps/APP-006-colorful-fireworks/", className: "fireworks" }
  ];
  const grid = document.querySelector("#appGrid");
  const fragment = document.createDocumentFragment();
  apps.forEach((app) => {
    const link = document.createElement("a");
    link.className = `app-card app-card--${app.className}`;
    link.href = app.href;
    link.setAttribute("aria-label", `${app.name}であそぶ`);
    const icon = document.createElement("span");
    icon.className = "app-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = app.icon;
    const name = document.createElement("span");
    name.className = "app-name";
    name.textContent = app.name;
    link.append(icon, name);
    fragment.append(link);
  });
  grid.append(fragment);
})();
