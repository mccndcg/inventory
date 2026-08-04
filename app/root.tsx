import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import "./tailwind.css";
import { OfflineUpdateNotice } from "./offline/OfflineUpdateNotice";
import { EnrollmentGate } from "./features/sync/EnrollmentGate";

const localOnly = import.meta.env.VITE_LOCAL_ONLY === "true";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" >
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#111827" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <Meta />
        <Links />
      </head>
      <body suppressHydrationWarning>
        {children}
        <OfflineUpdateNotice />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  if (localOnly) {
    return <Outlet />;
  }

  return (
    <EnrollmentGate>
      <Outlet />
    </EnrollmentGate>
  );
}


export function HydrateFallback() {
  return <p></p>;
}
