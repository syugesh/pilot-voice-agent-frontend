'use client'

if (typeof window !== "undefined") {
  // 1. Suppress the noisy "Setting direction is not supported on this device" console warnings
  const suppressMsg = "Setting direction is not supported on this device";
  const consoleMethods: Array<"log" | "warn" | "error" | "info"> = ["log", "warn", "error", "info"];
  for (const method of consoleMethods) {
    const originalConsoleMethod = console[method];
    if (originalConsoleMethod) {
      console[method] = function (...args: any[]) {
        const str = args.join(" ");
        if (str.includes(suppressMsg)) {
          return;
        }
        originalConsoleMethod.apply(console, args);
      };
    }
  }

  // 2. Patch MediaDevices constraints to report facingMode as unsupported
  if (typeof navigator !== "undefined" && navigator.mediaDevices) {
    try {
      const originalGetSupportedConstraints = navigator.mediaDevices.getSupportedConstraints;
      if (originalGetSupportedConstraints) {
        navigator.mediaDevices.getSupportedConstraints = function () {
          const constraints = originalGetSupportedConstraints.call(navigator.mediaDevices);
          if (constraints) {
            constraints.facingMode = false;
          }
          return constraints;
        };
      }
    } catch (e) {
      console.warn("Failed to patch MediaDevices constraints:", e);
    }
  }
}

import { tokenProvider } from '@/actions/stream.actions';
import Loader from '@/components/Loader';
import { useUser } from './ClerkMockProvider';
import {
    
    StreamVideo,
    StreamVideoClient,
  
    
  } from '@stream-io/video-react-sdk';
import { ReactNode, useEffect, useState } from 'react';
  
  const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
  
 const  StreamVideoProvider= ({children}:{children:ReactNode}) => {
  const [videoClient,setVideoClient]=useState<StreamVideoClient>();
  const {user,isLoaded}=useUser();
useEffect(()=>{
if(!isLoaded || !user) return;
if(!apiKey) throw new Error('stream API key missing')

const client=new StreamVideoClient({
  apiKey,
  user:{
    id:user?.id,
    name:user?.username ||user?.id,
    image:user?.imageUrl,

  },
  tokenProvider: () => tokenProvider(user.id),
})

setVideoClient(client);
},[user,isLoaded]);

if(!videoClient) return <Loader />
    return (
     
      <StreamVideo client={videoClient}>
       {children}
      </StreamVideo>
    );
  };
  export default StreamVideoProvider
