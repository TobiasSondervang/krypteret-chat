AnoChat
En prototype af en sikker webapp til at sende krypterede beskeder med login, mapper til organisering og en dansksproget brugerflade. Udrullet på https://anochat.netlify.app.
Struktur

public/:
index.html: Brugerflade med HTML og Tailwind CSS.
index.js: Frontend-logik, kryptering (CryptoJS) og API-kald.
logo.png: Logo og favicon.


functions/:
chat.js: Serverless funktioner til login, beskeder og mapper (MongoDB, bcrypt).


netlify.toml: Konfiguration til Netlify-deployment.

