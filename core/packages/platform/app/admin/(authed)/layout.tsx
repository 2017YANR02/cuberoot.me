import { AdminNav } from "../_components/AdminNav";

export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col md:grid md:grid-cols-[220px_minmax(0,1fr)] min-h-[80vh]">
      <aside className="border-b md:border-b-0 md:border-r border-line bg-white md:flex md:flex-col">
        <AdminNav />
      </aside>
      <main className="min-w-0 px-5 md:px-8 py-8 bg-bg-soft">
        <div className="mx-auto w-full max-w-[1180px]">{children}</div>
      </main>
    </div>
  );
}
