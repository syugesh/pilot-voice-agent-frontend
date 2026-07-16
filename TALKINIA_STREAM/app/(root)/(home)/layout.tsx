import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { Metadata } from "next";
import React, { ReactNode } from "react";
export const metadata: Metadata = {
  title: "MeetRoom",
  description: "Video Calling App",
  icons:{
    icon:'/icons/text.png'
  }
};
const HomeLayout = ({ children }: { children: ReactNode }) => {
  return (
    <>
    <Navbar />
    <main className="relative w-full">
      
      <div className="flex w-full">
        <Sidebar />
        <section className="flex h-screen flex-1 flex-col overflow-hidden px-6 pb-6 pt-28   max-md:pb-14 sm:px-13 ">
          <div className="w-full h-full overflow-hidden">{children}</div>
        </section>
      </div>
    </main>
    </>
  );
};

export default HomeLayout;
