export const APP_TITLE = "Karten";

if (typeof document !== "undefined") {
  const heading = document.createElement("h1");
  heading.textContent = APP_TITLE;
  document.getElementById("app").append(heading);
  document.title = APP_TITLE;
}
