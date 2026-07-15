import Sidebar from "./Sidebar";
import Header from "./Header";
import { Toaster } from "@/components/ui/sonner";

export default function AppShell({ title, subtitle, actions, children }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F4F5F7] text-[#06182F]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header title={title} subtitle={subtitle} actions={actions} />
        <main className="flex-1 overflow-auto p-6 lg:p-8" data-testid="page-content">
          <div className="fade-in-up">{children}</div>
        </main>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}
