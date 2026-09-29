import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Serves the Firebase Cloud Messaging service worker with runtime config.
 * Rewrite: /firebase-messaging-sw.js -> this route.
 * FCM requires the SW at the root path; we inject public Firebase config here.
 */
export async function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };

  const js = `
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp(${JSON.stringify(config)});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  // FCM already displays messages that carry a notification payload.
  if (payload.notification) return;
  const title = payload.notification?.title || payload.data?.title || 'CheckinHUB';
  const options = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: '/icon-192.png',
    badge: '/badge-96.png',
    tag: payload.data?.tag || 'checkinhub',
    renotify: true,
    data: payload.data || {},
    requireInteraction: false,
  };
  return self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const data = event.notification.data || {};
  const fcm = data.FCM_MSG || {};
  const rawUrl = data.url || data.link || fcm.data?.url || fcm.fcmOptions?.link || '/client';
  const target = new URL(rawUrl, self.location.origin);
  const url = self.location.origin + target.pathname + target.search + target.hash;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Only reuse a window already on screen; background Chrome tabs would pull the user out of the installed app.
      for (var i = 0; i < clientList.length; i++) {
        var c = clientList[i];
        if ((c.focused || c.visibilityState === 'visible') && 'focus' in c) {
          return c.navigate(url).then(function(w) { return (w || c).focus(); });
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
`.trim();

  return new NextResponse(js, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
