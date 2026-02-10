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
      <footer className="border-t border-border/40 py-4 text-center text-xs text-muted-foreground" suppressHydrationWarning>
        &copy; {new Date().getFullYear()}{" "}
        <a
          href="https://github.com/mrdemonwolf/dirework"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium transition-colors hover:text-foreground"
        >
          DireWork
        </a>{" "}
        by{" "}
        <a
          href="https://www.mrdemonwolf.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium transition-colors hover:text-foreground"
        >
          MrDemonWolf, Inc.
        </a>
      </footer>
    </div>
  );
}
