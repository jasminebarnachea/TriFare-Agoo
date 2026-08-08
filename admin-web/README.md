# Tri Fare Agoo Admin

Run the report dashboard and API:

```bash
npm install
npm run dev
```

The dashboard is available at `http://localhost:3000`. For a physical phone, set the Expo app environment variable to the computer's LAN address before starting Expo:

```bash
EXPO_PUBLIC_ADMIN_API_URL=http://YOUR_COMPUTER_IP:3000 npm start
```

Keep `npm run dev` running in this directory while testing. Mobile submissions made while it is offline are queued on-device and retry automatically every 30 seconds.

Reports are stored in `data/reports.json`; uploaded evidence is stored in `public/uploads`. Use persistent disk storage when deploying this Node app.
