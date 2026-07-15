
'use client';

export const dynamic = 'force-dynamic';

import MeetingTypeList from '@/components/MeetingTypeList';
import LiveTranscriptBar from '@/components/LiveTranscriptBar';
import { useGetCalls } from '@/hooks/useGetCalls';
import React, { Suspense, useState, useEffect } from 'react';

const Home = () => {
  const { upcomingCalls } = useGetCalls();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Ticking clock ensures that the home dashboard is fully real-time and reactive!
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Dynamically filter and isolate the closest future meeting in real-time.
  // As soon as a meeting starts or passes, the banner instantly shifts to the next lowest timestamp meeting!
  const nextMeeting = upcomingCalls && upcomingCalls.length > 0
    ? [...upcomingCalls]
        .filter(call => {
          if (!call.state.startsAt) return false;
          return new Date(call.state.startsAt).getTime() > currentTime.getTime();
        })
        .sort((a, b) => {
          const timeA = new Date(a.state.startsAt!).getTime();
          const timeB = new Date(b.state.startsAt!).getTime();
          return timeA - timeB;
        })[0]
    : null;

  const upcomingMeetingTime = nextMeeting?.state?.startsAt
    ? new Date(nextMeeting.state.startsAt).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const time = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const date = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
  }).format(currentTime);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      {/* h-full + overflow-hidden, and every child below sized to actually fit
          inside it (banner: fixed height, cards: flex-1 min-h-0, transcript
          bar: natural height) — the page is never meant to scroll. */}
      <section className="h-full gap-4 text-zinc-50 flex flex-col overflow-hidden">
        <div className="relative h-[220px] w-full flex-shrink-0 rounded-[20px] overflow-hidden">

          <video
              autoPlay
              muted
              loop
              playsInline
              className="absolute top-0 left-0 w-full h-full object-cover z-0"
          >
            <source type="video/mp4"/>
            Your browser does not support the video tag.
          </video>

          <div className="absolute inset-0 bg-black bg-opacity-40 z-10"/>


          <div className="relative z-20 flex h-full flex-col justify-between max-md:px-5 max-md:py-6 lg:p-8">
            <h2 className="glassmorphism max-w-[270px] rounded py-2 text-center text-base  font-bold shadow-stone-100">
              {upcomingMeetingTime ? `Upcoming Meeting at: ${upcomingMeetingTime}` : 'No Upcoming Meetings'}
            </h2>
            <div className="flex flex-col gap-2">
              <h1 className="text-4xl font-extrabold lg:text-6xl">{time}</h1>
              <p className="text-lg font-medium text-zinc-50 lg:text-xl">{date}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <MeetingTypeList/>
        </div>

        <div className="flex-shrink-0">
          <LiveTranscriptBar />
        </div>
      </section>
    </Suspense>
  );
};

export default Home;
