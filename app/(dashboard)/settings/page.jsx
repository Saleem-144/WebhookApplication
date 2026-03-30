'use client';

import { User, Plus, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const users = [
    { id: 1, name: 'Sohaib Saleem', email: 'xyz@example.com', initials: 'SS', color: 'bg-[#eef4ff] text-[#3b5998]' },
    { id: 2, name: 'Mahad Baig', email: 'xyz@example.com', initials: 'MB', color: 'bg-[#eef2fa] text-[#4f46e5]' },
  ];

  return (
    <div className="h-[calc(100vh-80px)] flex-1 overflow-y-auto bg-[#fbfbfd]">
      <div className="max-w-[1000px] w-full mx-auto px-10 py-16">
        
        {/* Profile Edit Section */}
        <div className="flex justify-between items-start gap-12 mb-20 px-4">
          
          {/* Form */}
          <div className="flex-1 w-full mt-2">
            <div className="grid grid-cols-2 gap-x-8 gap-y-10">
              <div className="flex flex-col gap-3">
                <label className="text-[13px] font-bold text-gray-500">User's Name</label>
                <input 
                  type="text" 
                  defaultValue="Admin Name" 
                  className="bg-[#f4f7fa] border border-transparent focus:border-[#2563eb] rounded-xl px-5 py-3.5 text-[15px] text-[#1e293b] font-medium outline-none transition-colors"
                />
              </div>
              <div className="flex flex-col gap-3">
                <label className="text-[13px] font-bold text-gray-500">New Password</label>
                <input 
                  type="password" 
                  defaultValue="........" 
                  className="bg-[#f4f7fa] border border-transparent focus:border-[#2563eb] rounded-xl px-5 py-3.5 text-[15px] text-[#1e293b] font-medium outline-none transition-colors tracking-[0.2em] font-mono"
                />
              </div>
              <div className="col-span-2 flex flex-col gap-3 max-w-[calc(100%+32px)]">
                <label className="text-[13px] font-bold text-gray-500">Re-enter Password</label>
                <input 
                  type="password" 
                  defaultValue="........" 
                  className="bg-[#f4f7fa] border border-transparent focus:border-[#2563eb] rounded-xl px-5 py-3.5 text-[15px] text-[#1e293b] font-medium outline-none transition-colors tracking-[0.2em] font-mono w-full"
                />
              </div>
            </div>
          </div>

          {/* Profile Picture Upload */}
          <div className="w-[240px] bg-[#f4f7fa] rounded-[20px] p-8 flex flex-col items-center shrink-0 shadow-sm border border-gray-100">
             <div className="w-[120px] h-[120px] bg-white rounded-2xl shadow-sm relative flex items-center justify-center mb-6">
                {/* Fallback silhouette for avatar */}
                <User className="w-14 h-14 text-gray-400 mt-4" />
                
                {/* Edit Badge */}
                <div className="absolute -bottom-2 -right-2 bg-[#3b5998] hover:bg-[#2a437a] text-white p-2 rounded-full shadow-md cursor-pointer transition-colors border-2 border-[#f4f7fa]">
                   <Pencil className="w-[14px] h-[14px]" />
                </div>
             </div>
             <p className="text-[11px] font-bold text-[#3b5998] tracking-widest uppercase">
               Profile Picture
             </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end mb-10 mr-1">
           <button className="bg-[#3b5998] hover:bg-[#2a437a] text-white px-8 py-2.5 rounded-lg flex items-center gap-2 font-bold text-[14px] transition-colors shadow-sm">
              <Plus className="w-[18px] h-[18px]" strokeWidth={2.5} />
              Add
           </button>
        </div>

        {/* Users Table */}
        <div className="mb-12">
           <div className="inline-block border-b-[3px] border-[#3b5998] pb-1.5 mb-6 ml-2">
             <h2 className="text-[22px] font-bold text-[#1e293b] pr-2">
               Total users : 02
             </h2>
           </div>

           <div className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-gray-100/50">
              {/* Table Header */}
              <div className="bg-[#f8f9fc] px-10 py-4 flex justify-between items-center border-b border-gray-100">
                 <span className="text-[12px] font-bold text-[#64748b] tracking-wider uppercase">NAME</span>
                 <span className="text-[12px] font-bold text-[#64748b] tracking-wider uppercase">ACTIONS</span>
              </div>
              
              {/* Table Body */}
              <div className="divide-y divide-gray-100">
                  {users.map((user) => (
                    <div key={user.id} className="px-10 py-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center gap-5">
                        <div className={cn("w-12 h-12 rounded-[14px] flex items-center justify-center font-bold text-[15px]", user.color)}>
                          {user.initials}
                        </div>
                        <div>
                          <p className="text-[16px] font-bold text-[#1e293b]">{user.name}</p>
                          <p className="text-[13px] font-medium text-gray-500 mt-1 hover:text-[#2563eb] cursor-pointer transition-colors">&lt;{user.email}&gt;</p>
                        </div>
                      </div>
                      <div>
                         {/* Empty actions area in mockup */}
                      </div>
                    </div>
                  ))}
              </div>
           </div>
        </div>
        
      </div>
    </div>
  );
}
