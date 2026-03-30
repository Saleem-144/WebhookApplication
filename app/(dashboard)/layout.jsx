import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';

export default function DashboardLayout({ children }) {
  return (
    <div className="h-screen w-full flex bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 ml-[80px] flex flex-col min-w-0 transition-all duration-300">
        <Navbar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-[#fbfbfd]">
          {children}
        </main>
      </div>
    </div>
  );
}
