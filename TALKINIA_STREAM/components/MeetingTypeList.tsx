/* eslint-disable camelcase */
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

import HomeCard from "./HomeCard";
import MeetingModal from "./MeetingModal";
import { Call, useStreamVideoClient } from "@stream-io/video-react-sdk";
import { useUser } from "../providers/ClerkMockProvider";
import Loader from "./Loader";
import { Textarea } from "./ui/textarea";
import ReactDatePicker from "react-datepicker";
import { useToast } from "./ui/use-toast";
import { Input } from "./ui/input";
import { Mic, MicOff } from "lucide-react";

const initialValues = {
  dateTime: new Date(),
  description: "",
  link: "",
};

const MeetingTypeList = () => {
  const router = useRouter();
  const [meetingState, setMeetingState] = useState<
    "isScheduleMeeting" | "isJoiningMeeting" | "isInstantMeeting" | undefined
  >(undefined);
  const [values, setValues] = useState(initialValues);
  const [callDetail, setCallDetail] = useState<Call>();
  const client = useStreamVideoClient();
  const { user } = useUser();
  const { toast } = useToast();

  // Voice dictation for the description field — browser-native SpeechRecognition
  // (no PILOT backend/MCP round-trip needed for a simple "speak to fill this
  // field" flow). Appends onto whatever text was already there rather than
  // replacing it, so a user can dictate in more than one take.
  const [isDictating, setIsDictating] = useState(false);
  const recognitionRef = useRef<any>(null);
  const descriptionBeforeDictationRef = useRef("");

  const toggleDictation = useCallback(() => {
    const SpeechRecognitionCtor =
      (typeof window !== "undefined" &&
        ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) || null;
    if (!SpeechRecognitionCtor) {
      toast({ title: "Voice dictation isn't supported in this browser — try Chrome or Edge." });
      return;
    }

    if (isDictating) {
      recognitionRef.current?.stop();
      return;
    }

    descriptionBeforeDictationRef.current = values.description;
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += transcript;
        else interimTranscript += transcript;
      }
      const base = descriptionBeforeDictationRef.current;
      const sep = base && !base.endsWith(" ") ? " " : "";
      setValues(v => ({ ...v, description: base + sep + finalTranscript + interimTranscript }));
      if (finalTranscript) {
        descriptionBeforeDictationRef.current = base + sep + finalTranscript;
      }
    };
    recognition.onerror = () => setIsDictating(false);
    recognition.onend = () => setIsDictating(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsDictating(true);
  }, [isDictating, values.description, toast]);

  // Stop dictation if the modal closes mid-recording
  useEffect(() => {
    if (meetingState !== "isScheduleMeeting" && recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, [meetingState]);

  const createMeeting = async () => {
    if (!client || !user) return;
    try {
      if (!values.dateTime) {
        toast({ title: "Please select a date and time" });
        return;
      }
      const id = crypto.randomUUID();
      const call = client.call("default", id);
      if (!call) throw new Error("Failed to create meeting");
      const startsAt =
        values.dateTime.toISOString() || new Date(Date.now()).toISOString();
      const description = values.description || "Instant Meeting";
      await call.getOrCreate({
        data: {
          starts_at: startsAt,
          custom: {
            description,
          },
        },
      });
      setCallDetail(call);
      if (!values.description) {
        router.push(`/meeting/${call.id}`);
      }
      toast({
        title: "Meeting Created",
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Failed to create Meeting" });
    }
  };

  const handleJoinMeeting = () => {
    let link = values.link.trim();
    if (!link) return;

    // Standardize direct URLs or parent PILOT container URLs
    if (link.startsWith('http://') || link.startsWith('https://')) {
      try {
        const urlObj = new URL(link);
        if (urlObj.pathname.includes('/meetings/meeting/')) {
          const meetingId = urlObj.pathname.split('/meetings/meeting/')[1];
          router.push(`/meeting/${meetingId}${urlObj.search}`);
          return;
        }
        if (urlObj.pathname.includes('/meeting/')) {
          const meetingId = urlObj.pathname.split('/meeting/')[1];
          router.push(`/meeting/${meetingId}${urlObj.search}`);
          return;
        }
      } catch (e) {}
    }

    if (link.includes('/meetings/meeting/')) {
      const parts = link.split('/meetings/meeting/');
      router.push(`/meeting/${parts[1]}`);
      return;
    }

    if (link.includes('/meeting/')) {
      const parts = link.split('/meeting/');
      router.push(`/meeting/${parts[1]}`);
      return;
    }

    // Raw UUID / User ID
    router.push(`/meeting/${link}`);
  };

  // Auto-join once the link field looks like a real, complete meeting
  // reference — no need to also click "Join Meeting". Debounced so it
  // fires once typing/pasting settles, not on every keystroke; the length
  // floor avoids triggering on a couple of stray characters before the
  // user has actually finished. handleJoinMeeting's own parsing (URL /
  // path segment / raw UUID) decides what counts as valid — this effect
  // just decides WHEN to call it automatically.
  const autoJoinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (meetingState !== "isJoiningMeeting") return;
    if (autoJoinTimer.current) clearTimeout(autoJoinTimer.current);
    const link = values.link.trim();
    if (link.length < 6) return;
    autoJoinTimer.current = setTimeout(() => {
      handleJoinMeeting();
    }, 600);
    return () => {
      if (autoJoinTimer.current) clearTimeout(autoJoinTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.link, meetingState]);

  // Voice-command mic (LiveTranscriptBar) dispatches a plain window event
  // rather than calling these handlers directly — keeps the mic button
  // decoupled from this component's internal state/handlers. Declared after
  // createMeeting/handleJoinMeeting (not before) so this closure always
  // captures the current render's versions of them, not a stale one from
  // whenever the effect first ran.
  useEffect(() => {
    const onVoiceCommand = (e: Event) => {
      const command = (e as CustomEvent<string>).detail;
      // "instant" skips the "Start an Instant Meeting" confirmation modal
      // entirely and creates + routes straight to the pre-join camera/mic
      // screen (createMeeting already does this when there's no description
      // — see its `if (!values.description) router.push(...)` above) — the
      // whole point of saying it out loud is to not have to click a button
      // afterwards too.
      if (command === "instant") createMeeting();
      else if (command === "join") setMeetingState("isJoiningMeeting");
      else if (command === "schedule") setMeetingState("isScheduleMeeting");
      else if (command === "recordings") router.push("/recordings");
    };
    window.addEventListener("talkinia:voice-command", onVoiceCommand);
    return () => window.removeEventListener("talkinia:voice-command", onVoiceCommand);
  }, [router, createMeeting]);

  if (!client || !user) return <Loader />;

  const meetingLink = `${process.env.NEXT_PUBLIC_BASE_URL}/meeting/${callDetail?.id}`;

  return (
    <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
      <HomeCard
        // video="/images/video.mp4"
        img="/icons/add-meeting.svg"
        title="New Meeting"
        description="Start an instant meeting"
        handleClick={() => setMeetingState("isInstantMeeting")}
        className={"bg-[#F5A700]"}
      />
      <HomeCard
        // video="/images/1.mp4"
        img="/icons/join-meeting.svg"
        title="Join Meeting"
        description="via invitation link"
        className="bg-[#F5A700]"
        handleClick={() => setMeetingState("isJoiningMeeting")}
      />
      <HomeCard
        // video="/images/2.mp4"
        img="/icons/schedule.svg"
        title="Schedule Meeting"
        description="Plan your meeting"
        className="bg-[#F5A700]"
        handleClick={() => setMeetingState("isScheduleMeeting")}
      />
      <HomeCard
        // video="/images/4.mp4"
        img="/icons/recordings.svg"
        title="View Recordings"
        description="Meeting Recordings"
        className="bg-[#F5A700]"
        handleClick={() => router.push("/recordings")}
      />

      {!callDetail ? (
        <MeetingModal
          isOpen={meetingState === "isScheduleMeeting"}
          onClose={() => setMeetingState(undefined)}
          title="Create Meeting"
          handleClick={createMeeting}
          video="/images/2.mp4"
          className=""
        >
          <div className="flex flex-col gap-1">
            {/* <label className="text-base font-normal leading-[22.4px] text-sky-2">
              Add a description
            </label> */}
            <div className="relative">
              <Textarea
                className="border-none bg-dark-3 focus-visible:ring-0 focus-visible:ring-offset-0 pr-11"
                placeholder="Add a description, or click the mic to dictate it"
                value={values.description}
                onChange={(e) =>
                  setValues({ ...values, description: e.target.value })
                }
              />
              <button
                type="button"
                onClick={toggleDictation}
                title={isDictating ? "Stop dictating" : "Dictate description by voice"}
                className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                  isDictating ? "bg-red-500 text-white animate-pulse" : "bg-dark-1 text-sky-2 hover:text-white"
                }`}
              >
                {isDictating ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2.5">
            <label className="text-sm mt-1 font-sans leading-[22.4px] text-sky-2 justify-start ">
              Select Date and Time
            </label>
            <ReactDatePicker
              selected={values.dateTime}
              onChange={(date) => setValues({ ...values, dateTime: date! })}
              showTimeSelect
              timeFormat="HH:mm"
              timeIntervals={15}
              timeCaption="time"
              dateFormat="MMMM d, yyyy h:mm aa"
              className="w-full rounded bg-dark-3 p-2 focus:outline-none"
            />
          </div>
        </MeetingModal>
      ) : (
        <MeetingModal
          isOpen={meetingState === "isScheduleMeeting"}
          onClose={() => setMeetingState(undefined)}
          title="Meeting Created"
          handleClick={() => {
            navigator.clipboard.writeText(meetingLink);
            toast({ title: "Link Copied" });
          }}
          image={"/icons/checked.svg"}
          buttonIcon="/icons/copy.svg"
          className="text-center"
          buttonText="Copy Meeting Link"
        />
      )}

      <MeetingModal
        isOpen={meetingState === "isJoiningMeeting"}
        onClose={() => setMeetingState(undefined)}
        title="Type the link here"
        className="text-center"
        buttonText="Join Meeting"
        handleClick={handleJoinMeeting}
        video="/images/video.mp4"
      >
        <Input
          placeholder="Meeting link"
          value={values.link}
          onChange={(e) => setValues({ ...values, link: e.target.value })}
          className="border-none bg-dark-3 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </MeetingModal>

      <MeetingModal
        isOpen={meetingState === "isInstantMeeting"}
        onClose={() => setMeetingState(undefined)}
        title="Start an Instant Meeting"
        className="text-center"
        buttonText="Start Meeting"
        handleClick={createMeeting}
        video="/images/video.mp4"
      />
    </section>
  );
};

export default MeetingTypeList;
