import {
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import "./tailwind.css";
import { OfflineUpdateNotice } from "./offline/OfflineUpdateNotice";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" >
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#111827" />
        <link rel="icon" href="/favicon.ico" />
        <Meta />
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
  return <Outlet />;
}


export function HydrateFallback() {
  return <p></p>;
}
