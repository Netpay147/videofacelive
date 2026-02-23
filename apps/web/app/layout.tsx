import "./globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "VideoFaceLive Dashboard",
  description: "DeepFaceLive controller dashboard"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
