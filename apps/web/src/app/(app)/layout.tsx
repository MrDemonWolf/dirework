import Header from "@/components/header";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-svh grid-rows-[auto_1fr_auto]">
      <Header />
      {children}
      <footer className="border-t border-border/40 py-4 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} DireWork by{" "}
        <a
          href="https://www.mrdemonwolf.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 transition-colors hover:text-foreground"
        >
          MrDemonWolf, Inc.
        </a>
      </footer>
    </div>
  );
}
