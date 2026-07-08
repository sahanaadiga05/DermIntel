import "./globals.css";
import { SessionHydrator } from "@/components/session-hydrator";

export const metadata = {
  title: "DermIntel",
  description: "Personalized ingredient intelligence for skincare shoppers."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SessionHydrator />
        {children}
      </body>
    </html>
  );
}

