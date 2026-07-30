import "./globals.css";
import { SessionHydrator } from "@/components/session-hydrator";

export const metadata = {
  title: "DermIntel — Know your formula",
  description: "Verified skincare ingredient intelligence, personalized to your skin."
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

