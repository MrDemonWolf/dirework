export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-fd-border py-6 text-center text-xs text-fd-muted-foreground">
      &copy; {year}{" "}
      <a
        href="https://github.com/mrdemonwolf/dirework"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium transition-colors hover:text-fd-foreground"
      >
        DireWork
      </a>{" "}
      by{" "}
      <a
        href="https://www.mrdemonwolf.com"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium transition-colors hover:text-fd-foreground"
      >
        MrDemonWolf, Inc.
      </a>
    </footer>
  );
}
