import BottomNav from "./BottomNav";

export default function MobileShell({ children, title = "DropIt" }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-10 backdrop-blur border-b bg-background/70">
        <div className="mx-auto max-w-md px-4 py-3">
          <h1 className="text-xl font-bold tracking-wide" aria-label={title}>{title}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-4 space-y-4">{children}</main>
      <BottomNav />
    </div>
  );
}
