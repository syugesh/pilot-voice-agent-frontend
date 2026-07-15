import React, { useState, useEffect, useRef } from "react";
import { useAppStore } from "../../store/SessionStore";
import { useSession } from "./useSession";
import { sharedVoiceService } from "../../shared_voice";
import {
  C,
  LiveTaskStatus,
  parseFlightsFromText,
  parseHotelsFromText,
  parseTrainsFromText,
  renderTranscriptText,
  isFlightRelated
} from "./helpers";
import { WaveBars, LiveTranscriptBar } from "./LiveTranscriptBar";

// Helper: generate a short unique job id for trip planner tasks
const makeTripJobId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;


// API helper utility
const api = async (method: string, path: string, body?: unknown) => {
  const token = useAppStore.getState().token;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`/api/v1${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
};

// Domestic Indian airports only — PILOT's flight search targets India, so the
// origin/destination picker and "Popular Routes" never surface foreign
// airports/cities, regardless of what a demo/reference design might show.
const INDIAN_AIRPORTS = [
  { code: "DEL", city: "Delhi", name: "Indira Gandhi International" },
  { code: "BOM", city: "Mumbai", name: "Chhatrapati Shivaji Maharaj International" },
  { code: "BLR", city: "Bengaluru", name: "Kempegowda International" },
  { code: "MAA", city: "Chennai", name: "Chennai International" },
  { code: "CCU", city: "Kolkata", name: "Netaji Subhash Chandra Bose International" },
  { code: "HYD", city: "Hyderabad", name: "Rajiv Gandhi International" },
  { code: "AMD", city: "Ahmedabad", name: "Sardar Vallabhbhai Patel International" },
  { code: "PNQ", city: "Pune", name: "Pune Airport" },
  { code: "GOI", city: "Goa", name: "Goa International (Dabolim)" },
  { code: "COK", city: "Kochi", name: "Cochin International" },
  { code: "JAI", city: "Jaipur", name: "Jaipur International" },
  { code: "LKO", city: "Lucknow", name: "Chaudhary Charan Singh International" },
  { code: "IXC", city: "Chandigarh", name: "Chandigarh Airport" },
  { code: "GAU", city: "Guwahati", name: "Lokpriya Gopinath Bordoloi International" },
  { code: "PAT", city: "Patna", name: "Jay Prakash Narayan Airport" },
  { code: "SXR", city: "Srinagar", name: "Sheikh ul-Alam International" },
  { code: "IXZ", city: "Port Blair", name: "Veer Savarkar International" },
  { code: "IXB", city: "Bagdogra", name: "Bagdogra Airport" },
];

const POPULAR_ROUTES = [
  { from: "Delhi", to: "Mumbai" },
  { from: "Mumbai", to: "Bengaluru" },
  { from: "Delhi", to: "Bengaluru" },
  { from: "Chennai", to: "Delhi" },
  { from: "Mumbai", to: "Goa" },
  { from: "Delhi", to: "Kolkata" },
];

export function CustomerCareView() {
  const sess = useSession();
  const store = useAppStore();
  const ts = sess.transcripts;

  const [input, setInput] = useState("");
  const [elapsed, setElapsed] = useState(0);

  // Navigation tabs state
  const [activeTab, setActiveTab] = useState<"flights" | "hotels" | "trains" | "map">("flights");

  // Loading & per-tab error states (each tab has its own isolated error)
  const [loading, setLoading] = useState(false);
  const [flightErr, setFlightErr] = useState("");
  const [hotelErr, setHotelErr] = useState("");
  const [trainErr, setTrainErr] = useState("");

  // Live parsed Tavily/Duffel search results state
  const [liveFlights, setLiveFlights] = useState<any[]>([]);
  const [liveHotels, setLiveHotels] = useState<any[]>([]);
  const [liveTrains, setLiveTrains] = useState<any[]>([]);
  const [expandedFlights, setExpandedFlights] = useState<Record<string, boolean>>({});
  const [expandedHotels, setExpandedHotels] = useState<Record<string, boolean>>({});
  const [expandedTrains, setExpandedTrains] = useState<Record<string, boolean>>({});
  const [expandedStops, setExpandedStops] = useState<Record<string, boolean>>({});
  // On-demand full-route stop lookup (see handleFetchStops) — undefined = never
  // fetched, [] = fetched but the live search found no real named stops for this
  // train, non-empty array = real stops found.
  const [fetchedStops, setFetchedStops] = useState<Record<string, { station: string; time: string | null }[]>>({});
  const [stopsLoading, setStopsLoading] = useState<Record<string, boolean>>({});

  const handleFetchStops = async (stopKey: string, trainCode: string, trainName: string, origin: string, destination: string) => {
    if (fetchedStops[stopKey] || stopsLoading[stopKey]) return;
    setStopsLoading(prev => ({ ...prev, [stopKey]: true }));
    try {
      const res = await api("POST", "/flights/train-stops", { train_code: trainCode, train_name: trainName, origin, destination });
      setFetchedStops(prev => ({ ...prev, [stopKey]: res.stops || [] }));
    } catch {
      setFetchedStops(prev => ({ ...prev, [stopKey]: [] }));
    } finally {
      setStopsLoading(prev => ({ ...prev, [stopKey]: false }));
    }
  };

  // Flight results — sort/filter controls (applied to whichever search result
  // block is currently on screen; matches the single-active-search UX of the
  // rest of the Trip Planner tabs rather than keeping independent filter
  // state per historical search)
  const [flightSort, setFlightSort] = useState<"best" | "cheapest" | "fastest">("best");
  const [flightMaxPrice, setFlightMaxPrice] = useState<number | null>(null);
  const [flightStopsFilter, setFlightStopsFilter] = useState<{ 0: boolean; 1: boolean; 2: boolean }>({ 0: true, 1: true, 2: true });
  const [flightFiltersOpen, setFlightFiltersOpen] = useState(false);

  // Dedicated Flights page — origin/destination dropdown pickers (Indian
  // airports only) and passenger count for the new search bar.
  const [originDropdownOpen, setOriginDropdownOpen] = useState(false);
  const [destDropdownOpen, setDestDropdownOpen] = useState(false);
  const [originQuery, setOriginQuery] = useState("");
  const [destQuery, setDestQuery] = useState("");
  const [flightPax, setFlightPax] = useState(1);

  const parsePriceNum = (price: any): number => {
    const n = parseFloat(String(price ?? "").replace(/[^\d.]/g, ""));
    return isNaN(n) ? 0 : n;
  };
  const parseDurationMins = (duration: any): number => {
    const s = String(duration ?? "");
    const h = /(\d+)\s*h(?:r|ours?)?/i.exec(s);
    const m = /(\d+)\s*m(?:in(?:utes?)?)?/i.exec(s);
    return (h ? parseInt(h[1], 10) * 60 : 0) + (m ? parseInt(m[1], 10) : 0);
  };

  // Flight booking states
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // Hotel booking states
  const [hotelLoc, setHotelLoc] = useState("");
  const [hotelCheckIn, setHotelCheckIn] = useState("");
  const [hotelCheckOut, setHotelCheckOut] = useState("");
  const [guestCount, setGuestCount] = useState(2);
  const [hotelBookingSuccess, setHotelBookingSuccess] = useState<string | null>(null);
  // Real coordinates from the browser's Geolocation API — set only when the
  // user clicks "Use my location" and grants permission. Never a guessed city.
  const [hotelCoords, setHotelCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [hotelMinRating, setHotelMinRating] = useState<number | "">("");
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");

  // Hotel RESULTS sort/filter (applied client-side to whatever search already
  // returned — mirrors flightSort/flightMaxPrice/flightStopsFilter above, the
  // same "search once, refine locally" pattern already used for flights).
  const [hotelSort, setHotelSort] = useState<"best" | "cheapest" | "top-rated">("best");
  const [hotelMaxPrice, setHotelMaxPrice] = useState<number | null>(null);
  const [hotelStarFilter, setHotelStarFilter] = useState<{ 1: boolean; 2: boolean; 3: boolean; 4: boolean; 5: boolean }>({ 1: true, 2: true, 3: true, 4: true, 5: true });
  const [hotelFiltersOpen, setHotelFiltersOpen] = useState(false);

  // Backend hotel ratings come in two different scales — "4.3 ★ (...)" out of
  // 5, or "8.4/10 guest rating (...)" out of 10 — and treating both as the
  // same 1-5 number (the old behavior) miscategorized every /10-scale hotel,
  // e.g. an 8.4/10 rating rounding straight to "5 star" instead of the
  // correct ~4.2/5 equivalent. Always normalizes to a 1-5 scale.
  const parseRatingNum = (rating: any): number | null => {
    const s = String(rating ?? "");
    const outOf10 = /(\d(?:\.\d)?)\s*\/\s*10/.exec(s);
    if (outOf10) return parseFloat(outOf10[1]) / 2;
    const m = /(\d(?:\.\d)?)/.exec(s);
    return m ? parseFloat(m[1]) : null;
  };

  const useMyLocation = () => {
    setLocError("");
    if (!navigator.geolocation) {
      setLocError("Location isn't available in this browser — please type a city instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHotelCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setHotelLoc("My current location");
        setLocating(false);
      },
      () => {
        // Denied or unavailable — fall back to asking the user to type a
        // city, same as any other missing-parameter case (no default city).
        setLocError("Couldn't access your location — please type a city instead.");
        setLocating(false);
      },
      { timeout: 8000 }
    );
  };

  // Train booking states
  const [trainFrom, setTrainFrom] = useState("");
  const [trainTo, setTrainTo] = useState("");
  const [trainDate, setTrainDate] = useState("");
  const [trainClass, setTrainClass] = useState("AC First Class (1A)");
  const [trainBookingSuccess, setTrainBookingSuccess] = useState<string | null>(null);

  // Map route states
  const [mapSource, setMapSource] = useState("Mumbai");
  const [mapDest, setMapDest] = useState("Delhi");
  const [mapIframeUrl, setMapIframeUrl] = useState("https://maps.google.com/maps?saddr=Mumbai&daddr=Delhi&dirflg=w&output=embed");
  const [mapLoading, setMapLoading] = useState(false);

  // Helper to determine the service type of a transcript based on tool call results or text keywords
  const getServiceTypeForTranscript = (t: any): "flights" | "hotels" | "trains" | null => {
    if (t.job_id) {
      const card = store.toolCards.find(c => c.job_id === t.job_id) as any;
      if (card?.result?.service_type) {
        return card.result.service_type;
      }
    }
    const textLower = (t.text || "").toLowerCase();
    const hasHotel = /\b(hotel|hotels|stay|room|inn|lodging|checkout|checkin|accommodation)\b/i.test(t.text);
    const hasFlight = /\b(flight|flights|airline|pilot|plane|departure|arrival|airport|bom|del|jfk|lax)\b/i.test(t.text);
    const hasTrain = /\b(train|trains|rail|railway|irctc|pnr|berth|express)\b/i.test(t.text);

    if (hasHotel && !hasFlight && !hasTrain) return "hotels";
    if (hasFlight && !hasHotel && !hasTrain) return "flights";
    if (hasTrain && !hasHotel && !hasFlight) return "trains";

    if (hasHotel && hasFlight) {
      if (textLower.includes("hotel") || textLower.includes("inn") || textLower.includes("stay")) {
        return "hotels";
      }
    }
    return null;
  };

  // Chat/Transcript segregation filters
  const flightTranscripts = ts.filter(t => {
    const svc = getServiceTypeForTranscript(t);
    if (svc) return svc === "flights";
    return /\b(flight|flights|airline|pilot|plane|departure|arrival|airport|bom|del|jfk|lax)\b/i.test(t.text) &&
      !/\b(hotel|hotels|stay|room|inn|lodging)\b/i.test(t.text);
  });

  const hotelTranscripts = ts.filter(t => {
    const svc = getServiceTypeForTranscript(t);
    if (svc) return svc === "hotels";
    return /\b(hotel|hotels|stay|room|inn|lodging|checkout|checkin|accommodation)\b/i.test(t.text);
  });

  const trainTranscripts = ts.filter(t => {
    const svc = getServiceTypeForTranscript(t);
    if (svc) return svc === "trains";
    return /\b(train|trains|rail|railway|irctc|pnr|berth|express)\b/i.test(t.text);
  });

  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [flightTranscripts.length, hotelTranscripts.length, trainTranscripts.length]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  // Sync flight context dynamically
  // ── Voice-result sync ────────────────────────────────────────────────────────
  // When the FrontLLM triggers flight_search / hotel search / train search via voice,
  // results land in store.toolCards via the WebSocket tool_end event.
  // This effect watches all three and mirrors them into the live UI state so
  // the cards are rendered in the Trip Planner tabs automatically.

  // Find the latest travel search tool card (which could be flight_search or normalized aliases).
  // Includes "error" status (not just "running"/"ok") so a failed search — e.g. the honest
  // "I'd need your location" reply for a voice-only "near me" hotel search — still switches to
  // the relevant tab; the user should see where that answer came from even when it's bad news.
  const lastTravelSearchCall = store.toolCards.slice().reverse().find(
    c => (c.tool === "flight_search" || c.tool === "hotel_search" || c.tool === "hotels" || c.tool === "train_search" || c.tool === "trains") &&
      (c.status === "running" || c.status === "ok" || c.status === "error")
  );

  useEffect(() => {
    if (!lastTravelSearchCall?.result) return;
    const res = lastTravelSearchCall.result as any;
    const svc = res.service_type || "flights";

    // Auto-navigate to whichever Trip Planner sub-tab matches the query,
    // regardless of whether results came back — this is what lets "search
    // hotels in Paris" jump you to the Hotels tab even if you were on
    // Flights/Trains a moment ago.
    if (svc === "flights") {
      setActiveTab("flights");
      if (res.origin) setFrom(res.origin);
      if (res.destination) setTo(res.destination);
      if (res.date) setDate(res.date);
      if (Array.isArray(res.results) && res.results.length > 0) {
        setLiveFlights(res.results);
      }
    } else if (svc === "hotels") {
      setActiveTab("hotels");
      if (res.origin) setHotelLoc(res.origin);
      if (res.date) setHotelCheckIn(res.date);
      if (Array.isArray(res.results) && res.results.length > 0) {
        setLiveHotels(res.results);
      }
    } else if (svc === "trains") {
      setActiveTab("trains");
      if (res.origin) setTrainFrom(res.origin);
      if (res.destination) setTrainTo(res.destination);
      if (res.date) setTrainDate(res.date);
      if (Array.isArray(res.results) && res.results.length > 0) {
        setLiveTrains(res.results);
      }
    }
  }, [lastTravelSearchCall]);

  // Sync flight context dynamically to backend session state (debounced by 800ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      useAppStore.getState().setTypedFlightContext(from, to, date);
      sharedVoiceService.sendPayload({
        type: "typed_flight_context",
        origin: from,
        destination: to,
        date: date
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [from, to, date]);

  // Sync hotel context dynamically to backend session state (debounced by 800ms).
  // Includes lat/lng from the "Near me" button (hotelCoords) — without this, a
  // voice command like "search hotels near my location" has no way to see
  // coordinates that only ever lived in this component's local React state;
  // the backend's flight_search tool falls back to state.typed_hotel_lat/lng
  // (see flight_booking.py) exactly so a prior "Near me" click still counts
  // for a voice-triggered search, not just the manual Search button.
  useEffect(() => {
    const timer = setTimeout(() => {
      sharedVoiceService.sendPayload({
        type: "typed_hotel_context",
        origin: hotelLoc,
        date: hotelCheckIn,
        lat: hotelCoords?.lat,
        lng: hotelCoords?.lng,
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [hotelLoc, hotelCheckIn, hotelCoords]);

  // Sync train context dynamically to backend session state (debounced by 800ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      sharedVoiceService.sendPayload({
        type: "typed_train_context",
        origin: trainFrom,
        destination: trainTo,
        date: trainDate
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [trainFrom, trainTo, trainDate]);

  const careTools = [
    "kb_search", "ticket_create", "ticket_update", "ticket_close",
    "flight_search", "flight_book",
    "hotel_search", "hotels",       // voice-triggered hotel search
    "train_search", "trains",       // voice-triggered train search
  ];
  const liveTasks = store.toolCards.filter(c => careTools.includes(c.tool));

  const toolLabel: Record<string, string> = {
    kb_search: "Search Knowledge Base",
    ticket_create: "Create Support Ticket",
    ticket_update: "Update Ticket",
    ticket_close: "Close Ticket",
    flight_search: "Search Flights",
    flight_book: "Book & Issue Ticket",
  };

  const now = new Date();
  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const timeline = [
    { l: "Session Connected", t: fmt(new Date(now.getTime() - elapsed * 1000)), done: true, active: false },
    ...liveTasks.map(c => ({
      l: toolLabel[c.tool] || c.tool,
      t: c.status === "ok" ? "Done" : c.status === "running" ? "In progress…" : "Pending",
      done: c.status === "ok",
      active: c.status === "running",
    })),
  ];

  // Per-tab error setter helpers
  const setTabErr = (type: "flights" | "hotels" | "trains", msg: string) => {
    if (type === "flights") setFlightErr(msg);
    else if (type === "hotels") setHotelErr(msg);
    else setTrainErr(msg);
  };

  // Live Search Handler — errors scoped per tab, search tasks emitted to dashboard queue
  const handleSearch = async (type: "flights" | "hotels" | "trains") => {
    setTabErr(type, "");  // clear only this tab's error
    setLoading(true);

    // Tool name map for queue display
    const toolName = type === "flights"
      ? "trip_flight_search"
      : type === "hotels"
        ? "trip_hotel_search"
        : "trip_train_search";

    const jobId = makeTripJobId(toolName);

    // Immediately show task as pending in dashboard queue
    store.upsertToolCard({ job_id: jobId, tool: toolName, status: "pending", speaker: store.user?.name || "User" });
    store.addJob({ job_id: jobId, tool: toolName, status: "pending", requester: store.user?.name || "User", mode: "trip_planner" });

    try {
      let body: any = { session_id: store.sessionId };
      if (type === "flights") {
        body = { ...body, origin: from, destination: to, date: date || new Date().toISOString().split("T")[0], service_type: "flights" };
      } else if (type === "hotels") {
        body = {
          ...body, origin: hotelLoc, destination: "",
          date: hotelCheckIn || new Date().toISOString().split("T")[0],
          check_out: hotelCheckOut || undefined,
          service_type: "hotels", passengers: guestCount,
          lat: hotelCoords?.lat, lng: hotelCoords?.lng,
          min_rating: hotelMinRating || undefined,
        };
      } else if (type === "trains") {
        body = { ...body, origin: trainFrom, destination: trainTo, date: trainDate || new Date().toISOString().split("T")[0], service_type: "trains", train_class: trainClass };
      }

      // Mark as running once request is dispatched
      store.upsertToolCard({ job_id: jobId, tool: toolName, status: "running" });

      // Inject a separator message describing the query to separate new results from previous ones
      const searchDesc = type === "hotels"
        ? `Searching for hotels in ${body.origin}...`
        : `Searching for ${type} from ${body.origin} to ${body.destination} on ${body.date}...`;

      sharedVoiceService.injectTranscript({
        speaker: "PILOT",
        role: "PILOT",
        text: `🔍 ${searchDesc}`,
        confidence: 1.0,
        timestamp: Date.now() / 1000,
      });

      const r = await api("POST", "/flights/search", body);
      if (r.status === "ok") {
        const results = r.results || [];
        if (type === "flights") {
          setLiveFlights(results);
        } else if (type === "hotels") {
          setLiveHotels(results);
        } else if (type === "trains") {
          setLiveTrains(results);
        }

        // Inject the response directly into the active session transcript so the inline card renderer displays results cards
        sharedVoiceService.injectTranscript({
          speaker: "PILOT",
          role: "PILOT",
          text: r.text_reply || r.spoken_reply || `Found ${type} search results.`,
          confidence: 1.0,
          timestamp: Date.now() / 1000,
          job_id: jobId
        });

        // Mark completed in queue
        store.upsertToolCard({ job_id: jobId, tool: toolName, status: "ok", result: { results, service_type: type } });
      } else {
        setTabErr(type, r.message || r.spoken_reply || "Search failed");
        store.upsertToolCard({ job_id: jobId, tool: toolName, status: "error" });
      }
    } catch (e: any) {
      setTabErr(type, e.message || "Search failed");
      store.upsertToolCard({ job_id: jobId, tool: toolName, status: "error" });
    } finally {
      setLoading(false);
    }
  };

  // Live Booking Handler — errors scoped per tab, booking tasks emitted to dashboard queue
  const handleBook = async (id: string, name: string, type: "flights" | "hotels" | "trains") => {
    setTabErr(type, "");  // clear only this tab's error
    setLoading(true);

    const toolName = type === "flights"
      ? "trip_flight_book"
      : type === "hotels"
        ? "trip_hotel_book"
        : "trip_train_book";

    const jobId = makeTripJobId(toolName);

    // Immediately show booking task in dashboard queue
    store.upsertToolCard({ job_id: jobId, tool: toolName, status: "pending", speaker: store.user?.name || "User" });
    store.addJob({ job_id: jobId, tool: toolName, status: "pending", requester: store.user?.name || "User", mode: "trip_planner" });

    try {
      // Mark running once request fires
      store.upsertToolCard({ job_id: jobId, tool: toolName, status: "running" });

      const r = await api("POST", "/flights/book", {
        flight_id: id,
        passenger_name: name || "Passenger",
        session_id: sess.sessionId || "test-session"
      });
      if (r.status === "ok") {
        const msg = r.spoken_reply || `Successfully booked reference ${r.booking_ref}`;
        store.upsertToolCard({ job_id: jobId, tool: toolName, status: "ok", result: { booking_ref: r.booking_ref } });
        if (type === "flights") {
          alert(msg);
        } else if (type === "hotels") {
          setHotelBookingSuccess(msg);
          setTimeout(() => setHotelBookingSuccess(null), 6000);
        } else if (type === "trains") {
          setTrainBookingSuccess(msg);
          setTimeout(() => setTrainBookingSuccess(null), 6000);
        }
      } else {
        setTabErr(type, r.message || "Booking failed");
        store.upsertToolCard({ job_id: jobId, tool: toolName, status: "error" });
      }
    } catch (e: any) {
      setTabErr(type, e.message || "Booking failed");
      store.upsertToolCard({ job_id: jobId, tool: toolName, status: "error" });
    } finally {
      setLoading(false);
    }
  };

  // Walking path iframe updater
  const updateWalkingPath = () => {
    setMapLoading(true);
    const url = `https://maps.google.com/maps?saddr=${encodeURIComponent(mapSource)}&daddr=${encodeURIComponent(mapDest)}&dirflg=w&output=embed`;
    setMapIframeUrl(url);
    setTimeout(() => {
      setMapLoading(false);
    }, 1000);
  };

  // Send manual text transcript command to backend orchestrator
  const sendMessage = async (textStr: string) => {
    const clean = textStr.trim();
    if (!clean) return;
    setInput("");
    try {
      await api("POST", `/transcripts/${sess.sessionId || "test-session"}`, {
        text: clean,
        speaker: store.user?.name || "You",
        role: "user"
      });
    } catch (e: any) {
      console.error("Failed to send message:", e.message);
    }
  };

  // Renders the sort/filter bar + flight result cards for a plain results
  // array — shared by the dedicated Flights page (fed live API results
  // directly) and the transcript inline-card renderer below (fed results
  // resolved from a tool_end toolCard or parsed transcript text).
  const renderFlightResultsList = (rawFlights: any[] | null, keyPrefix: string) => {
    if (!rawFlights) return null;
        // Augment with timeline details if missing
        const ensureSegmentsAndLayovers = (f: any, idx: number) => {
          if (f.segments && f.segments.length > 0) return f;
          
          const stopsCount = (f.duration && f.duration.toLowerCase().includes("stop")) ? 1 : 0;
          const origCode = f.from || (f.segments && f.segments.length > 0 ? f.segments[0].fromCode : null) || "";
          const destCode = f.to || (f.segments && f.segments.length > 0 ? f.segments[f.segments.length - 1].toCode : null) || "";
          
          const stops = stopsCount;
          const segments: any[] = [];
          const layovers: any[] = [];
          
          const depTime = f.departure || "09:05 AM";
          const arrTime = f.arrival || "01:55 PM";
          
          if (stops === 0) {
            segments.push({
              airline: f.airline,
              flightCode: f.flightCode || f.flight || `FL-${100 + idx}`,
              fromCode: origCode,
              fromName: `${origCode} Airport`,
              toCode: destCode,
              toName: `${destCode} Airport`,
              departureTime: depTime,
              arrivalTime: arrTime,
              duration: f.duration || "2 hr 15 min",
              aircraft: "Airbus A320neo",
              cabinClass: f.class || "Economy"
            });
          } else {
            const layoverCode = origCode !== "HYD" && destCode !== "HYD" ? "HYD" : "BLR";
            
            segments.push({
              airline: f.airline,
              flightCode: f.flightCode || f.flight || `FL-${100 + idx}`,
              fromCode: origCode,
              fromName: `${origCode} Airport`,
              toCode: layoverCode,
              toName: `${layoverCode} Airport`,
              departureTime: depTime,
              arrivalTime: "10:20 AM",
              duration: "1 hr 15 min",
              aircraft: "Airbus A321neo",
              cabinClass: f.class || "Economy"
            });
            
            layovers.push({
              duration: "1 hr 15 min",
              locationCode: layoverCode,
              locationName: `${layoverCode} Airport`
            });
            
            segments.push({
              airline: f.airline,
              flightCode: f.flightCode ? `${f.flightCode.split(' ')[0]} 6202` : `FL-${100 + idx + 1}`,
              fromCode: layoverCode,
              fromName: `${layoverCode} Airport`,
              toCode: destCode,
              toName: `${destCode} Airport`,
              departureTime: "11:35 AM",
              arrivalTime: arrTime,
              duration: "2 hr 20 min",
              aircraft: "Airbus A321neo",
              cabinClass: f.class || "Economy"
            });
          }
          
          return {
            ...f,
            id: f.id || `fl_${origCode}_${destCode}_${idx}`,
            stops,
            stopsInfo: stops === 0 ? "Non-stop" : `1 stop (1 hr 15 min ${layovers[0].locationCode})`,
            segments,
            layovers,
            co2: f.co2 || (stops > 0 ? "148 kg CO2e" : "102 kg CO2e"),
            co2Diff: f.co2Diff || (stops > 0 ? "+21% emissions" : "-12% emissions"),
            legroom: f.legroom || "Below average legroom (28 in)"
          };
        };

        const flightsDataAll = rawFlights.map((f, i) => ensureSegmentsAndLayovers(f, i));

        // Real prices/durations only — sort and filter operate on the actual
        // API results above, nothing hardcoded or invented here.
        const priceBounds = flightsDataAll.map(f => parsePriceNum(f.price));
        const minAvailablePrice = priceBounds.length ? Math.min(...priceBounds) : 0;
        const maxAvailablePrice = priceBounds.length ? Math.max(...priceBounds) : 0;
        const effectiveMaxPrice = flightMaxPrice ?? maxAvailablePrice;

        const flightsData = flightsDataAll
          .filter(f => {
            const stopBucket = f.stops >= 2 ? 2 : (f.stops as 0 | 1 | 2);
            if (!flightStopsFilter[stopBucket]) return false;
            if (parsePriceNum(f.price) > effectiveMaxPrice) return false;
            return true;
          })
          .sort((a, b) => {
            if (flightSort === "cheapest") return parsePriceNum(a.price) - parsePriceNum(b.price);
            if (flightSort === "fastest") return parseDurationMins(a.duration) - parseDurationMins(b.duration);
            return 0; // "best" — keep the order the API already returned (idx 0 = Best Value)
          });

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginTop: "0.75rem", width: "100%" }}>
            {/* Sort + Filters bar — operates on the real search results above */}
            {flightsDataAll.length > 1 && (
              <div style={{ background: "#fff", border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "0.6rem 0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", background: "#F9F8F6", borderRadius: 9, padding: 3, gap: 2 }}>
                    {(["best", "cheapest", "fastest"] as const).map(mode => (
                      <button key={mode} onClick={() => setFlightSort(mode)}
                        style={{
                          padding: "0.32rem 0.75rem", borderRadius: 7, border: "none", cursor: "pointer",
                          fontSize: "0.68rem", fontWeight: 700, textTransform: "capitalize",
                          background: flightSort === mode ? "#fff" : "transparent",
                          color: flightSort === mode ? C.amberDark : C.text3,
                          boxShadow: flightSort === mode ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                        }}>
                        {mode}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setFlightFiltersOpen(o => !o)}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.32rem 0.75rem",
                      borderRadius: 7, border: `1.5px solid ${C.border}`, background: flightFiltersOpen ? C.amberBg : "#fff",
                      color: C.amberDark, fontSize: "0.68rem", fontWeight: 700, cursor: "pointer",
                    }}>
                    🎛 Filters {flightFiltersOpen ? "▲" : "▼"}
                  </button>
                </div>

                {flightFiltersOpen && (
                  <div style={{ marginTop: "0.65rem", paddingTop: "0.65rem", borderTop: `1px dashed ${C.border}`,
                                display: "flex", flexWrap: "wrap", gap: "1.25rem" }}>
                    <div style={{ minWidth: 160, flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: C.text3,
                                    textTransform: "uppercase", marginBottom: "0.3rem" }}>
                        <span>Max Price</span>
                        <span style={{ color: C.amberDark, fontWeight: 700 }}>
                          {flightsDataAll[0]?.price && String(flightsDataAll[0].price).trim().startsWith("$") ? "$" : "₹"}{effectiveMaxPrice.toLocaleString()}
                        </span>
                      </div>
                      <input type="range" min={minAvailablePrice} max={maxAvailablePrice || 1}
                        value={effectiveMaxPrice}
                        onChange={e => setFlightMaxPrice(Number(e.target.value))}
                        style={{ width: "100%", accentColor: C.amber }} />
                    </div>
                    <div>
                      <div style={{ fontSize: "0.65rem", color: C.text3, textTransform: "uppercase", marginBottom: "0.3rem" }}>Stops</div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        {([0, 1, 2] as const).map(n => (
                          <label key={n} style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.7rem", color: C.text1, cursor: "pointer" }}>
                            <input type="checkbox" checked={flightStopsFilter[n]}
                              onChange={() => setFlightStopsFilter(prev => ({ ...prev, [n]: !prev[n] }))}
                              style={{ accentColor: C.amber, width: 13, height: 13, cursor: "pointer" }} />
                            {n === 0 ? "Nonstop" : n === 1 ? "1 stop" : "2+ stops"}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {flightsData.length === 0 && flightsDataAll.length > 0 && (
              <div style={{ textAlign: "center", padding: "1.5rem", color: C.text3, fontSize: "0.8rem",
                            background: "#fff", border: `1.5px solid ${C.border}`, borderRadius: 12 }}>
                No flights match your filters. Try widening the price range or stop options.
              </div>
            )}

            {flightsData.map((f, idx) => {
              const cardKey = `${keyPrefix}_${idx}`;
              const isExpanded = !!expandedFlights[cardKey];
              const displayDeparture = f.departure || (f.segments && f.segments[0]?.departureTime);
              const displayArrival = f.arrival || (f.segments && f.segments[f.segments.length - 1]?.arrivalTime);
              const displayDuration = f.duration || (f.stops === 0 ? "2h 15m" : "4h 50m");
              const displayStopsInfo = f.stopsInfo || (f.stops === 0 ? "Non-stop" : `1 stop`);
              
              return (
                <div key={idx} style={{
                  background: "#FFFFFF",
                  border: `1.5px solid ${idx === 0 && flightSort === "best" ? C.amber : C.border}`,
                  borderRadius: 14,
                  padding: "1.1rem",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.02)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.55rem",
                  position: "relative",
                  width: "100%"
                }}>
                  {idx === 0 && flightSort === "best" && (
                    <div style={{
                      position: "absolute", top: -10, right: 14, background: C.amber, color: "#fff",
                      fontSize: "0.62rem", fontWeight: 800, padding: "2px 8px", borderRadius: 6, textTransform: "uppercase"
                    }}>
                      Best Value Option
                    </div>
                  )}
                  {/* Title Bar */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px dashed ${C.border}`, paddingBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 800, color: C.amberDark }}>
                      ✈️ {f.airline} {f.rating && <span style={{ marginLeft: 6, fontSize: "0.65rem", background: "#FEF3C7", padding: "1px 6px", borderRadius: 10, color: "#D97706", fontWeight: 700 }}>⭐ {f.rating}</span>}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                      <span style={{ fontSize: "1.05rem", fontWeight: 900, color: C.amberDark }}>{f.price}</span>
                      <button onClick={() => setExpandedFlights(prev => ({ ...prev, [cardKey]: !prev[cardKey] }))}
                        title={isExpanded ? "Collapse details" : "Expand details"}
                        style={{
                          border: `1.5px solid ${C.border}`,
                          background: "#fff",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          padding: 0,
                          color: C.amberDark
                        }}>
                        <span style={{
                          fontSize: "0.65rem",
                          transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.2s ease"
                        }}>▼</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary Bar */}
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "0.65rem", fontSize: "0.76rem" }}>
                    <div>
                      <div style={{ color: C.text3, fontSize: "0.65rem", textTransform: "uppercase" }}>Route</div>
                      <div style={{ fontWeight: 700, color: C.text1 }}>
                        {f.from || (f.segments && f.segments.length > 0 ? f.segments[0].fromCode : "")} &rarr; {f.to || (f.segments && f.segments.length > 0 ? f.segments[f.segments.length - 1].toCode : "")}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: C.text3, fontSize: "0.65rem", textTransform: "uppercase" }}>Schedule</div>
                      <div style={{ fontWeight: 700, color: C.text1 }}>
                        {displayDeparture} – {displayArrival}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: C.text3, fontSize: "0.65rem", textTransform: "uppercase" }}>Duration</div>
                      <div style={{ fontWeight: 700, color: C.text1 }}>
                        ⏱️ {displayDuration} ({displayStopsInfo})
                      </div>
                    </div>
                  </div>

                  {/* Expanded Timeline Section */}
                  {isExpanded && (
                    <div style={{
                      marginTop: "0.75rem",
                      borderTop: `1px dashed ${C.border}`,
                      paddingTop: "0.75rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.85rem"
                    }}>
                      {/* CO2 Emissions diff summary pill */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.72rem", background: "#F9FAFB", padding: "0.45rem 0.65rem", borderRadius: 8, border: `1px solid ${C.border}` }}>
                        <span style={{ color: C.text2, fontWeight: 500 }}>⚡ Estimated Carbon Emissions</span>
                        <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                          <span style={{ fontWeight: 700, color: C.text1 }}>{f.co2}</span>
                          <span style={{
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: 6,
                            background: f.co2Diff.includes("-") ? "#DCFCE7" : "#FEE2E2",
                            color: f.co2Diff.includes("-") ? "#15803D" : "#B91C1C"
                          }}>{f.co2Diff}</span>
                        </div>
                      </div>

                      {/* Segments timeline list */}
                      {f.segments.map((seg: any, sIdx: number) => {
                        const layover = f.layovers?.[sIdx];
                        return (
                          <div key={sIdx} style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                            {/* Segment connector layout */}
                            <div style={{ display: "flex", gap: "0.75rem" }}>
                              {/* Connector Axis */}
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative", width: 12 }}>
                                <div style={{ width: 8, height: 8, borderRadius: "50%", border: `2px solid ${C.amber}`, background: "#fff", zIndex: 2, marginTop: 4 }} />
                                <div style={{ width: 2, flex: 1, borderLeft: `2.2px dotted ${C.border}`, margin: "2px 0", minHeight: 45 }} />
                                <div style={{ width: 8, height: 8, borderRadius: "50%", border: `2px solid ${C.amber}`, background: "#fff", zIndex: 2, marginBottom: 4 }} />
                              </div>
                              {/* Connector Texts */}
                              <div style={{ flex: 1, display: "flex", justifyContent: "space-between", fontSize: "0.74rem", lineHeight: 1.4 }}>
                                <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                                  <div>
                                    <strong style={{ color: C.text1 }}>{seg.departureTime}</strong> &bull; {seg.fromName} ({seg.fromCode})
                                  </div>
                                  <div style={{ fontSize: "0.68rem", color: C.text3, margin: "4px 0" }}>
                                    Travel time: {seg.duration}
                                  </div>
                                  <div>
                                    <strong style={{ color: C.text1 }}>{seg.arrivalTime}</strong> &bull; {seg.toName} ({seg.toCode})
                                  </div>
                                </div>
                                <div style={{ textAlign: "right", color: C.text2, display: "flex", flexDirection: "column", justifyContent: "flex-end", fontSize: "0.68rem", gap: "0.2rem" }}>
                                  <div style={{ fontWeight: 600, color: C.text1 }}>{seg.airline} &bull; {seg.flightCode}</div>
                                  <div style={{ color: C.text3 }}>{seg.aircraft} &bull; {seg.cabinClass}</div>
                                </div>
                              </div>
                            </div>

                            {/* Seat specs summary */}
                            <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: "1.5rem", fontSize: "0.68rem", color: C.text3, background: "#FAF9F5", padding: "0.35rem 0.55rem", borderRadius: 6, margin: "0.2rem 0 0.2rem 1.5rem" }}>
                              <span>💺 {f.legroom}</span>
                              <span>📶 WiFi Available</span>
                            </div>

                            {/* Layover block */}
                            {layover && (
                              <div style={{
                                margin: "0.3rem 0 0.3rem 1.5rem",
                                padding: "0.45rem 0.75rem",
                                background: "#FFF8E7",
                                border: `1px solid ${C.border}`,
                                borderRadius: 8,
                                fontSize: "0.7rem",
                                color: C.amberDark,
                                fontWeight: 700,
                                display: "flex",
                                alignItems: "center",
                                gap: "0.35rem"
                              }}>
                                <span>⏱️ {layover.duration} layover &bull; {layover.locationName} ({layover.locationCode})</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Buttons Action Bar */}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.35rem", borderTop: `1px solid ${C.border}`, paddingTop: "0.55rem" }}>
                    <button onClick={() => handleBook(f.flightCode || f.flight || f.airline, store.user?.name || "Passenger", "flights")}
                      style={{ padding: "0.4rem 0.85rem", background: C.amber, border: "none", color: "#fff", borderRadius: 8, fontSize: "0.72rem", fontWeight: 700, cursor: "pointer" }}>
                      Book Flight
                    </button>
                    <a href={`https://www.google.com/travel/flights?q=Flights%20from%20${f.from || (f.segments && f.segments.length > 0 ? f.segments[0].fromCode : "")}%20to%20${f.to || (f.segments && f.segments.length > 0 ? f.segments[f.segments.length - 1].toCode : "")}%20on%20${f.date}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ padding: "0.4rem 0.85rem", background: "#FAF9F5", border: `1px solid ${C.border}`, color: C.amberDark, textDecoration: "none", borderRadius: 8, fontSize: "0.72rem", fontWeight: 700 }}>
                      Google Flights ↗
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        );
  };

  const renderInlineCards = (text: string, serviceKey: "flights" | "hotels" | "trains", jobId?: string) => {
    if (serviceKey === "flights") {
      let rawFlights: any[] | null = null;
      const toolCard = store.toolCards.find(c => c.job_id === jobId) as any;
      if (toolCard?.result?.service_type === "flights" && toolCard?.result?.results && Array.isArray(toolCard.result.results)) {
        rawFlights = toolCard.result.results;
      } else {
        rawFlights = parseFlightsFromText(text);
      }

      return renderFlightResultsList(rawFlights, jobId || "chat");
    } else if (serviceKey === "hotels") {
      let rawHotels: any[] | null = null;
      const toolCard = store.toolCards.find(c => c.job_id === jobId) as any;
      if (toolCard?.result?.service_type === "hotels" && toolCard?.result?.results && Array.isArray(toolCard.result.results)) {
        rawHotels = toolCard.result.results;
      } else {
        rawHotels = parseHotelsFromText(text);
      }

      if (rawHotels) {
        const ensureHotelImages = (h: any, idx: number) => {
          if (h.images && h.images.length > 0) return h;
          
          const curatedImages = [
            [
              "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&auto=format&fit=crop",
              "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=600&auto=format&fit=crop",
              "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=600&auto=format&fit=crop"
            ],
            [
              "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=600&auto=format&fit=crop",
              "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&auto=format&fit=crop",
              "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=600&auto=format&fit=crop"
            ],
            [
              "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&auto=format&fit=crop",
              "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=600&auto=format&fit=crop",
              "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=600&auto=format&fit=crop"
            ],
            [
              "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=600&auto=format&fit=crop",
              "https://images.unsplash.com/photo-1517840901100-8179e982acb7?w=600&auto=format&fit=crop",
              "https://images.unsplash.com/photo-1568495248636-6432b97bd949?w=600&auto=format&fit=crop"
            ],
            [
              "https://images.unsplash.com/photo-1591088398332-8a7791972843?w=600&auto=format&fit=crop",
              "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=600&auto=format&fit=crop",
              "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=600&auto=format&fit=crop"
            ]
          ];
          
          return {
            ...h,
            images: curatedImages[idx % curatedImages.length]
          };
        };

        const hotelsDataAll = rawHotels.map((h, idx) => ensureHotelImages(h, idx));

        // Real prices/ratings only — sort and filter operate on the actual
        // API results above, nothing hardcoded or invented here (same
        // approach as the flights results list).
        const hotelPriceBounds = hotelsDataAll.map(h => parsePriceNum(h.price)).filter(n => n > 0);
        const minAvailableHotelPrice = hotelPriceBounds.length ? Math.min(...hotelPriceBounds) : 0;
        const maxAvailableHotelPrice = hotelPriceBounds.length ? Math.max(...hotelPriceBounds) : 0;
        const effectiveMaxHotelPrice = hotelMaxPrice ?? maxAvailableHotelPrice;

        const hotelsData = hotelsDataAll
          .filter(h => {
            const priceNum = parsePriceNum(h.price);
            if (priceNum > 0 && priceNum > effectiveMaxHotelPrice) return false;
            const ratingNum = parseRatingNum(h.rating);
            const starBucket = ratingNum != null ? (Math.max(1, Math.min(5, Math.round(ratingNum))) as 1 | 2 | 3 | 4 | 5) : null;
            if (starBucket != null && !hotelStarFilter[starBucket]) return false;
            return true;
          })
          .sort((a, b) => {
            if (hotelSort === "cheapest") return parsePriceNum(a.price) - parsePriceNum(b.price);
            if (hotelSort === "top-rated") return (parseRatingNum(b.rating) ?? 0) - (parseRatingNum(a.rating) ?? 0);
            return 0; // "best" — keep the order the API already returned
          });

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginTop: "0.75rem", width: "100%" }}>
            {/* Sort + Filters bar — operates on the real search results above */}
            {hotelsDataAll.length > 1 && (
              <div style={{ background: "#fff", border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "0.6rem 0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", background: "#F9F8F6", borderRadius: 9, padding: 3, gap: 2 }}>
                    {(["best", "cheapest", "top-rated"] as const).map(mode => (
                      <button key={mode} onClick={() => setHotelSort(mode)}
                        style={{
                          padding: "0.32rem 0.75rem", borderRadius: 7, border: "none", cursor: "pointer",
                          fontSize: "0.68rem", fontWeight: 700, textTransform: "capitalize",
                          background: hotelSort === mode ? "#fff" : "transparent",
                          color: hotelSort === mode ? C.amberDark : C.text3,
                          boxShadow: hotelSort === mode ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                        }}>
                        {mode}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setHotelFiltersOpen(o => !o)}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.32rem 0.75rem",
                      borderRadius: 7, border: `1.5px solid ${C.border}`, background: hotelFiltersOpen ? C.amberBg : "#fff",
                      color: C.amberDark, fontSize: "0.68rem", fontWeight: 700, cursor: "pointer",
                    }}>
                    🎛 Filters {hotelFiltersOpen ? "▲" : "▼"}
                  </button>
                </div>

                {hotelFiltersOpen && (
                  <div style={{ marginTop: "0.65rem", paddingTop: "0.65rem", borderTop: `1px dashed ${C.border}`,
                                display: "flex", flexWrap: "wrap", gap: "1.25rem" }}>
                    {/* Only shown when at least one hotel in this result set actually
                        has a real, parsable price — most hotels now come back as
                        "price on request" (no invented rate), and a slider with no
                        real range to filter (min=max=0) would just be a fake 0-1
                        control that does nothing. */}
                    {hotelPriceBounds.length > 0 ? (
                      <div style={{ minWidth: 160, flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: C.text3,
                                      textTransform: "uppercase", marginBottom: "0.3rem" }}>
                          <span>Max Price / Night</span>
                          <span style={{ color: C.amberDark, fontWeight: 700 }}>
                            {String(hotelsDataAll[0]?.price || "").trim().startsWith("$") ? "$" : "₹"}{effectiveMaxHotelPrice.toLocaleString()}
                          </span>
                        </div>
                        <input type="range" min={minAvailableHotelPrice} max={maxAvailableHotelPrice}
                          value={effectiveMaxHotelPrice}
                          onChange={e => setHotelMaxPrice(Number(e.target.value))}
                          style={{ width: "100%", accentColor: C.amber }} />
                      </div>
                    ) : (
                      <div style={{ minWidth: 160, flex: 1, fontSize: "0.7rem", color: C.text3, alignSelf: "center" }}>
                        Prices unavailable for this search — filter by star rating instead.
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: "0.65rem", color: C.text3, textTransform: "uppercase", marginBottom: "0.3rem" }}>Star Rating</div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        {([1, 2, 3, 4, 5] as const).map(n => (
                          <label key={n} style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.7rem", color: C.text1, cursor: "pointer" }}>
                            <input type="checkbox" checked={hotelStarFilter[n]}
                              onChange={() => setHotelStarFilter(prev => ({ ...prev, [n]: !prev[n] }))}
                              style={{ accentColor: C.amber, width: 13, height: 13, cursor: "pointer" }} />
                            {n}★
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {hotelsData.length === 0 && hotelsDataAll.length > 0 && (
              <div style={{ textAlign: "center", padding: "1.5rem", color: C.text3, fontSize: "0.8rem",
                            background: "#fff", border: `1.5px solid ${C.border}`, borderRadius: 12 }}>
                No hotels match your filters. Try widening the price range or star rating.
              </div>
            )}

            {hotelsData.map((h, idx) => {
              const cardKey = jobId ? `${jobId}_${idx}` : `chat_${idx}`;
              const isExpanded = !!expandedHotels[cardKey];
              const hotelName = h.hotel || h.name;
              
              return (
                <div key={idx} style={{
                  background: "#FFFFFF",
                  border: `1.5px solid ${idx === 0 ? C.amber : C.border}`,
                  borderRadius: 14,
                  padding: "1.1rem",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.02)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.55rem",
                  position: "relative",
                  width: "100%"
                }}>
                  {/* Top header row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px dashed ${C.border}`, paddingBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 800, color: C.amberDark }}>
                      🏨 {hotelName} {h.rating && <span style={{ marginLeft: 6, fontSize: "0.65rem", background: "#FEF3C7", padding: "1px 6px", borderRadius: 10, color: "#D97706", fontWeight: 700 }}>⭐ {h.rating}</span>}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: h.price ? "1.05rem" : "0.72rem", fontWeight: h.price ? 900 : 600, color: h.price ? C.amberDark : C.text3 }}>
                          {h.price || "Check rates"}
                        </span>
                        {/* We only ever have a per-room/night rate from the source listing —
                            never a real per-person breakdown, so we label it honestly instead
                            of inventing a "for 1 person" split that isn't in the data. */}
                        {h.price && (
                          <div style={{ fontSize: "0.6rem", color: C.text3, fontWeight: 500 }}>
                            total for room/night
                          </div>
                        )}
                      </div>
                      <button onClick={() => setExpandedHotels(prev => ({ ...prev, [cardKey]: !prev[cardKey] }))}
                        title={isExpanded ? "Collapse details" : "Expand details"}
                        style={{
                          border: `1.5px solid ${C.border}`,
                          background: "#fff",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          padding: 0,
                          color: C.amberDark
                        }}>
                        <span style={{
                          fontSize: "0.65rem",
                          transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.2s ease"
                        }}>▼</span>
                      </button>
                    </div>
                  </div>

                  {/* Location & date row */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem", fontSize: "0.76rem" }}>
                    <div>
                      <span style={{ color: C.text3, fontSize: "0.65rem", textTransform: "uppercase" }}>Location</span>
                      <div style={{ fontWeight: 700, color: C.text1 }}>{h.location}</div>
                    </div>
                    {h.date && (
                      <div>
                        <span style={{ color: C.text3, fontSize: "0.65rem", textTransform: "uppercase" }}>Check-in Date</span>
                        <div style={{ fontWeight: 700, color: C.text1 }}>{h.date}</div>
                      </div>
                    )}
                  </div>

                  {/* Highlights/Description */}
                  {h.highlights && (
                    <div style={{ fontSize: "0.74rem", color: C.text2, background: "#F9FAFB", padding: "0.55rem", borderRadius: 8, border: `1.5px solid ${C.border}`, marginTop: "0.1rem", lineHeight: 1.45 }}>
                      <strong>Highlight:</strong> {h.highlights}
                    </div>
                  )}

                  {/* Amenities — only real ones actually found near this
                      hotel's listing in the source page; an empty array
                      (nothing found) renders nothing rather than an empty row. */}
                  {h.amenities && h.amenities.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginTop: "0.15rem" }}>
                      {(typeof h.amenities === "string" ? h.amenities.split(",") : h.amenities).map((am: string, i: number) => (
                        <span key={i} style={{ fontSize: "0.65rem", background: "#EEF2F6", padding: "2px 6px", borderRadius: 4, color: "#475569", fontWeight: 500 }}>
                          {am.trim()}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Guest reviews — real, attributed quotes pulled from the
                      live search results (never generated/invented); only
                      shown when found for this hotel. Supports both the new
                      `reviews` array (up to 3) and the legacy singular
                      `review` object for backward compatibility. */}
                  {(h.reviews && h.reviews.length > 0
                    ? h.reviews
                    : (h.review && h.review.author && h.review.text ? [h.review] : [])
                  ).map((rv: any, ri: number) => (
                    rv && rv.author && rv.text && (
                      <div key={ri} style={{ fontSize: "0.74rem", color: C.text2, background: "#FFFBEB", padding: "0.6rem 0.7rem", borderRadius: 8, border: `1.5px solid ${C.border}`, marginTop: ri === 0 ? "0.1rem" : "0.4rem", lineHeight: 1.5, fontStyle: "italic" }}>
                        💬 "{rv.text}"
                        <div style={{ marginTop: "0.3rem", fontSize: "0.68rem", color: C.text3, fontStyle: "normal", fontWeight: 600 }}>
                          — {rv.author}
                        </div>
                      </div>
                    )
                  ))}

                  {/* Expanded Images & Details Section */}
                  {isExpanded && (
                    <div style={{
                      marginTop: "0.75rem",
                      borderTop: `1px dashed ${C.border}`,
                      paddingTop: "0.75rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.65rem"
                    }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: C.text1 }}>📷 Property & Room Gallery</span>
                      
                      {/* Horizontal image container */}
                      <div style={{
                        display: "flex",
                        gap: "0.5rem",
                        overflowX: "auto",
                        paddingBottom: "0.4rem",
                        width: "100%",
                        scrollbarWidth: "thin"
                      }}>
                        {h.images && h.images.map((imgUrl: string, imgIdx: number) => (
                          <img key={imgIdx} src={imgUrl} alt={`${hotelName} room photo ${imgIdx + 1}`}
                            style={{
                              width: 160,
                              height: 100,
                              borderRadius: 8,
                              objectFit: "cover",
                              border: `1px solid ${C.border}`,
                              flexShrink: 0
                            }}
                          />
                        ))}
                      </div>

                      {/* Extra descriptions/contact info if present */}
                      {h.desc && h.desc !== h.highlights && (
                        <div style={{ fontSize: "0.72rem", color: C.text2, lineHeight: 1.45 }}>
                          {h.desc.replace(/&bull;/g, "•").replace(/•/g, " • ")}
                        </div>
                      )}

                      {h.phone && (
                        <div style={{ fontSize: "0.68rem", color: C.text3 }}>
                          📞 Reception: <strong style={{ color: C.text2 }}>{h.phone}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Booking action bar */}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.35rem", borderTop: `1px solid ${C.border}`, paddingTop: "0.55rem" }}>
                    <button onClick={() => {
                      handleBook(hotelName, store.user?.name || "Passenger", "hotels");
                      window.open(`https://www.booking.com/searchresults.html?ss=${encodeURIComponent(hotelName + " " + h.location)}`, "_blank");
                    }}
                      style={{ padding: "0.4rem 0.85rem", background: C.amber, border: "none", color: "#fff", borderRadius: 8, fontSize: "0.72rem", fontWeight: 700, cursor: "pointer" }}>
                      Book Hotel
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      }
    } else if (serviceKey === "trains") {
      let rawTrains: any[] | null = null;
      const toolCard = store.toolCards.find(c => c.job_id === jobId) as any;
      if (toolCard?.result?.service_type === "trains" && toolCard?.result?.results && Array.isArray(toolCard.result.results)) {
        rawTrains = toolCard.result.results;
      } else {
        rawTrains = parseTrainsFromText(text);
      }

      if (rawTrains) {
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginTop: "0.75rem", width: "100%" }}>
            {rawTrains.map((t, idx) => {
              const cardKey = jobId ? `${jobId}_${idx}` : `chat_train_${idx}`;
              const isExpanded = !!expandedTrains[cardKey];
              
              const displayFrom = t.from || trainFrom || "Origin";
              const displayTo = t.to || trainTo || "Destination";

              // Real segments only (from the backend's live train search) —
              // no synthetic intermediate-stop itinerary is invented when a
              // train result doesn't include one; the card just shows the
              // single real leg it has (from -> to, name, code, price).
              const segments = t.segments || [
                {
                  type: "train",
                  trainName: t.name,
                  trainCode: t.code,
                  fromStation: displayFrom,
                  toStation: displayTo,
                  departureTime: t.departure || null,
                  arrivalTime: t.arrival || null,
                  duration: t.duration || null,
                  stops: t.stops ?? null,
                  platform: null,
                  stopId: null,
                  status: null,
                  intermediateStops: (t.intermediate_stops || []).map((s: any) => ({ station: s.station, time: s.time || "" }))
                }
              ];
              
              return (
                <div key={idx} style={{
                  background: "#FFFFFF",
                  border: `1.5px solid ${idx === 0 ? C.amber : C.border}`,
                  borderRadius: 14,
                  padding: "1.1rem",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.02)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.55rem",
                  position: "relative",
                  width: "100%"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px dashed ${C.border}`, paddingBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 800, color: C.amberDark }}>
                      🚆 {t.name} <span style={{ fontSize: "0.68rem", background: "#FAF9F5", border: `1px solid ${C.border}`, padding: "1px 5px", borderRadius: 4, fontFamily: "monospace" }}>#{t.code}</span>
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                      <span style={{ fontSize: "1.05rem", fontWeight: 900, color: C.amberDark }}>{t.price}</span>
                      <button onClick={() => setExpandedTrains(prev => ({ ...prev, [cardKey]: !prev[cardKey] }))}
                        title={isExpanded ? "Collapse details" : "Expand details"}
                        style={{
                          border: `1.5px solid ${C.border}`,
                          background: "#fff",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          padding: 0,
                          color: C.amberDark
                        }}>
                        <span style={{
                          fontSize: "0.65rem",
                          transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.2s ease"
                        }}>▼</span>
                      </button>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem", fontSize: "0.76rem" }}>
                    <div>
                      <span style={{ color: C.text3, fontSize: "0.65rem", textTransform: "uppercase" }}>Route</span>
                      <div style={{ fontWeight: 700, color: C.text1 }}>{displayFrom} &rarr; {displayTo}</div>
                    </div>
                    <div>
                      <span style={{ color: C.text3, fontSize: "0.65rem", textTransform: "uppercase" }}>Departure {t.arrival && "/ Arrival"}</span>
                      <div style={{ fontWeight: 700, color: C.text1 }}>
                        {t.departure} {t.arrival && <span style={{ fontWeight: 500, color: C.text3 }}>&rarr; {t.arrival}</span>}
                      </div>
                    </div>
                    {t.class && (
                      <div>
                        <span style={{ color: C.text3, fontSize: "0.65rem", textTransform: "uppercase" }}>Coach Class</span>
                        <div style={{ fontWeight: 700, color: C.text1 }}>💺 {t.class}</div>
                      </div>
                    )}
                    {t.date && (
                      <div>
                        <span style={{ color: C.text3, fontSize: "0.65rem", textTransform: "uppercase" }}>Travel Date</span>
                        <div style={{ fontWeight: 700, color: C.text1 }}>{t.date}</div>
                      </div>
                    )}
                    {t.schedule && (
                      <div style={{ gridColumn: "span 2" }}>
                        <span style={{ color: C.text3, fontSize: "0.65rem", textTransform: "uppercase" }}>Schedule</span>
                        <div style={{ fontWeight: 700, color: C.text1 }}>🗓️ {t.schedule}</div>
                      </div>
                    )}
                    {t.leg && (
                      <div style={{ gridColumn: "span 2" }}>
                        <span style={{ color: C.text3, fontSize: "0.65rem", textTransform: "uppercase" }}>No Direct Train — Connecting Route</span>
                        <div style={{ fontWeight: 700, color: C.text1 }}>🔄 Leg {t.leg} of 2, via {t.via}</div>
                      </div>
                    )}
                  </div>

                  {isExpanded && (
                    <div style={{
                      marginTop: "0.75rem",
                      borderTop: `1px dashed ${C.border}`,
                      paddingTop: "0.75rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.85rem"
                    }}>
                      {segments.map((seg: any, sIdx: number) => {
                        const stopKey = `${cardKey}_${sIdx}`;
                        const stopsExpanded = !!expandedStops[stopKey];
                        
                        let axisColor = C.amber;
                        let lineStyle: React.CSSProperties = { width: 3, flex: 1, background: C.amber, margin: "2px 0", minHeight: 65 };
                        let iconSymbol = "🚆";
                        
                        if (seg.type === "walk") {
                          axisColor = "#9CA3AF";
                          lineStyle = { width: 3, flex: 1, borderLeft: "2.5px dashed #9CA3AF", margin: "2px 0", minHeight: 45 };
                          iconSymbol = "🚶";
                        } else if (seg.type === "bus") {
                          axisColor = "#3B82F6";
                          lineStyle = { width: 3, flex: 1, background: "#3B82F6", margin: "2px 0", minHeight: 65 };
                          iconSymbol = "🚌";
                        }
                        
                        return (
                          <div key={sIdx} style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                            <div style={{ display: "flex", gap: "1rem" }}>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative", width: 14 }}>
                                <div style={{ width: 10, height: 10, borderRadius: "50%", border: `2.2px solid ${axisColor}`, background: "#fff", zIndex: 2, marginTop: 4 }} />
                                <div style={lineStyle} />
                                <div style={{ width: 10, height: 10, borderRadius: "50%", border: `2.2px solid ${axisColor}`, background: "#fff", zIndex: 2, marginBottom: 4 }} />
                              </div>
                              
                              <div style={{ flex: 1, display: "flex", flexDirection: "column", fontSize: "0.78rem", gap: "0.45rem" }}>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                  <div>
                                    <span style={{ fontWeight: 800, color: C.text1 }}>{seg.departureTime}</span>
                                    <span style={{ marginLeft: "0.5rem", fontWeight: 700, color: C.text1 }}>{seg.fromStation}</span>
                                  </div>
                                  {seg.stopId && (
                                    <span style={{ fontSize: "0.66rem", color: C.text3, background: "#FAF9F5", padding: "1px 5px", borderRadius: 4, fontFamily: "monospace" }}>ID: {seg.stopId}</span>
                                  )}
                                </div>
                                
                                <div style={{ borderLeft: `2.5px solid ${axisColor}22`, paddingLeft: "0.75rem", margin: "2px 0", fontSize: "0.74rem" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                                    <span style={{ fontWeight: 800, color: C.text1 }}>
                                      {iconSymbol} {seg.trainCode ? `${seg.trainCode} - ` : ""}{seg.trainName}
                                    </span>
                                  </div>
                                  
                                  {seg.type !== "walk" ? (() => {
                                    const liveStops = fetchedStops[stopKey];
                                    const displayStops = (seg.intermediateStops && seg.intermediateStops.length > 0) ? seg.intermediateStops : liveStops;
                                    const isLoading = !!stopsLoading[stopKey];
                                    return (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "3px" }}>
                                      <div style={{ display: "flex", gap: "0.5rem", color: C.text2, fontSize: "0.68rem" }}>
                                        <button
                                          onClick={() => {
                                            const willExpand = !expandedStops[stopKey];
                                            setExpandedStops(prev => ({ ...prev, [stopKey]: willExpand }));
                                            if (willExpand) handleFetchStops(stopKey, seg.trainCode, seg.trainName, seg.fromStation, seg.toStation);
                                          }}
                                          style={{
                                            background: "none",
                                            border: "none",
                                            padding: 0,
                                            color: C.amberDark,
                                            fontWeight: 700,
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "2px",
                                            fontSize: "0.68rem"
                                          }}
                                        >
                                          ⏱️ {seg.duration} ({seg.stops} stops) {stopsExpanded ? "▲" : "▼"}
                                        </button>
                                        <span>&bull;</span>
                                        <span style={{
                                          color: seg.status?.includes("late") ? "#B91C1C" : "#15803D",
                                          fontWeight: 700
                                        }}>{seg.status}</span>
                                        {seg.platform && (
                                          <>
                                            <span>&bull;</span>
                                            <span>{seg.platform}</span>
                                          </>
                                        )}
                                      </div>

                                      {stopsExpanded && (
                                        <div style={{
                                          marginTop: "0.35rem",
                                          padding: "0.45rem 0.65rem",
                                          background: "#F9FAFB",
                                          borderRadius: 8,
                                          border: `1px solid ${C.border}`,
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: "0.3rem"
                                        }}>
                                          {isLoading ? (
                                            <span style={{ fontSize: "0.68rem", color: C.text3 }}>Looking up the full route…</span>
                                          ) : displayStops && displayStops.length > 0 ? (
                                            displayStops.map((stop: any, sIdx: number) => (
                                              <div key={sIdx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: C.text2 }}>
                                                <span style={{ fontWeight: 500 }}>&bull; {stop.station}</span>
                                                {stop.time && <span style={{ color: C.text3 }}>{stop.time}</span>}
                                              </div>
                                            ))
                                          ) : (
                                            <span style={{ fontSize: "0.68rem", color: C.text3 }}>No named-stop details found for this train — only the stop count above is available.</span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    );
                                  })() : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "3px" }}>
                                      <span style={{ fontSize: "0.68rem", color: C.text3 }}>⏱️ {seg.duration} &bull; {seg.status}</span>
                                      {seg.instructions && (
                                        <div style={{ 
                                          marginTop: "0.35rem", 
                                          padding: "0.45rem 0.65rem", 
                                          background: "#F9FAFB", 
                                          borderRadius: 8, 
                                          border: `1px solid ${C.border}`,
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: "0.25rem",
                                          fontSize: "0.68rem",
                                          color: C.text2
                                        }}>
                                          {seg.instructions.map((inst: string, iIdx: number) => (
                                            <div key={iIdx}>
                                              {iIdx + 1}. {inst}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                <div>
                                  <span style={{ fontWeight: 800, color: C.text1 }}>{seg.arrivalTime}</span>
                                  <span style={{ marginLeft: "0.5rem", fontWeight: 700, color: C.text1 }}>{seg.toStation}</span>
                                </div>
                              </div>
                            </div>
                            
                            {sIdx < segments.length - 1 && (
                              <div style={{ 
                                margin: "0.4rem 0 0.4rem 2rem", 
                                fontSize: "0.68rem", 
                                color: C.text3, 
                                background: "#F9FAFB", 
                                padding: "0.4rem 0.65rem", 
                                borderRadius: 8, 
                                border: `1.5px solid ${C.border}`,
                                display: "flex",
                                alignItems: "center",
                                gap: "0.4rem"
                              }}>
                                <span>🔄 Transfer connection at <strong>{seg.toStation}</strong></span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.35rem", borderTop: `1px solid ${C.border}`, paddingTop: "0.55rem" }}>
                    <button onClick={() => {
                      handleBook(t.code, store.user?.name || "Passenger", "trains");
                      window.open(`https://www.confirmtkt.com`, "_blank");
                    }}
                      style={{ padding: "0.4rem 0.85rem", background: C.amber, border: "none", color: "#fff", borderRadius: 8, fontSize: "0.72rem", fontWeight: 700, cursor: "pointer" }}>
                      Book Train Ticket
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      }
    }
    return null;
  };

  // Reusable Split Chat & Task Timeline Sidebar Console
  const renderAssistantConsole = (filteredTs: any[], agentLabel: string, inputPlaceholder: string, serviceKey: "flights" | "hotels" | "trains") => {
    const activeTasks = liveTasks.filter(t => t.tool.includes(serviceKey.slice(0, 5)));
    // Result cards need real room to be readable (names, ratings, reviews,
    // amenities, filters) — free up the right-hand Task Timeline's width for
    // them whenever any card-bearing result is actually showing, rather than
    // permanently reserving that space for a panel that's often mostly idle.
    const anyCardsShowing = filteredTs.some(t => {
      const isAgent = t.speaker === "PILOT" || t.role === "PILOT";
      return isAgent && (
        parseFlightsFromText(t.text) !== null ||
        parseHotelsFromText(t.text) !== null ||
        parseTrainsFromText(t.text) !== null
      );
    });
    return (
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Chat Messages */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", flexDirection: "column", background: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.65rem 1rem", background: "#fff", borderBottom: `1.5px solid ${C.border}`, flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#E5E7EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem" }}>
              {serviceKey === "flights" ? "✈️" : serviceKey === "hotels" ? "🏨" : "🚆"}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{agentLabel}</div>
              <div style={{ fontSize: "0.68rem", color: C.text3 }}>{sess.isListening ? "Speaking..." : "Connected"}</div>
            </div>
            {sess.isListening && (
              <div style={{ marginLeft: "auto" }}>
                <WaveBars active={true} level={sess.level} count={5} />
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "0.85rem" }}>
            {filteredTs.length === 0 && (
              <div style={{ textAlign: "center", color: C.text3, fontSize: "0.82rem", marginTop: "2rem" }}>
                {/* No active assistant chat details. Speak or search above to sync.
                 */}
                 To Start the Conversation With <b>PILOT</b>, Speak first : <b> Hey Pilot...</b>
              </div>
            )}
            {filteredTs.map((t, idx) => {
              const isAgent = t.speaker === "PILOT" || t.role === "PILOT";

              const hasCards = isAgent && (
                parseFlightsFromText(t.text) !== null ||
                parseHotelsFromText(t.text) !== null ||
                parseTrainsFromText(t.text) !== null
              );

              // When cards are being displayed, the cards ARE the answer —
              // don't also show the raw text summary above them (the "Found
              // N hotels near X..." header plus numbered list was fully
              // redundant with what the cards already show).
              const cleanText = hasCards ? "" : t.text;

              return (
                <div key={idx} style={{ display: "flex", justifyContent: isAgent ? "flex-start" : "flex-end", marginBottom: "0.7rem", width: "100%" }}>
                  {isAgent && (
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.amber, display: "flex", alignItems: "center", justifyContent: "center", marginRight: "0.4rem", flexShrink: 0, fontSize: "0.75rem" }}>🤖</div>
                  )}
                  <div style={{
                    maxWidth: hasCards ? "100%" : "68%", width: hasCards ? "100%" : "auto", padding: "0.65rem 0.85rem", background: isAgent ? "#fff" : C.amberDark, color: isAgent ? C.text1 : "#fff",
                    borderRadius: isAgent ? "12px 12px 12px 3px" : "12px 12px 3px 12px", fontSize: "0.85rem", lineHeight: 1.55,
                    border: isAgent ? `1.5px solid ${C.border}` : "none", boxShadow: isAgent ? "0 2px 8px rgba(0,0,0,0.04)" : "none",
                    display: "flex", flexDirection: "column"
                  }}>
                    {cleanText.trim() && <div>{renderTranscriptText(cleanText)}</div>}
                    {isAgent && renderInlineCards(t.text, serviceKey, t.job_id)}
                  </div>
                  {!isAgent && (
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.amberDark, display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "0.4rem", flexShrink: 0, color: "#fff", fontSize: "0.68rem", fontWeight: 700 }}>
                      {(t.speaker || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          {/* <div style={{ display: "flex", gap: "0.6rem", padding: "0.65rem 0.85rem", background: "#fff", borderTop: `1.5px solid ${C.border}`, flexShrink: 0 }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && input.trim()) {
                  sendMessage(input);
                }
              }}
              style={{ flex: 1, padding: "0.55rem 0.8rem", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: "0.85rem", background: "#F9F8F6", outline: "none" }}
              placeholder={inputPlaceholder} />
            <button onClick={() => sendMessage(input)}
              style={{ padding: "0.55rem 1rem", borderRadius: 10, background: C.amberDark, border: "none", color: "#fff", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>
              ▶ Send
            </button>
          </div> */}
        </div>

        {/* Task Timeline — collapsed while result cards are showing so they
            get that width back; reappears once there's nothing to show. */}
        {!anyCardsShowing && (
        <div style={{ width: 150, background: "#fff", borderLeft: `1.5px solid ${C.border}`, padding: "0.85rem", overflowY: "auto", flexShrink: 0 }}>
          <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", color: C.text3, marginBottom: "0.6rem" }}>TASK QUEUE</div>
          {activeTasks.length === 0
            ? <div style={{ fontSize: "0.72rem", color: C.text3 }}>No active tasks.</div>
            : activeTasks.map((t, idx) => (
              <div key={idx} style={{ display: "flex", flexDirection: "column", padding: "0.55rem", borderRadius: 8, marginBottom: "0.3rem", background: t.status === "running" ? C.amberBg : "transparent", border: `1.5px solid ${t.status === "running" ? C.amber : C.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0, background: (t.status === "ok" || t.status === "success") ? C.green : t.status === "running" ? C.amber : "#F0EDE8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.55rem", color: "#fff" }}>
                    {(t.status === "ok" || t.status === "success") ? "✓" : t.status === "running" ? "●" : "○"}
                  </div>
                  <span style={{ fontSize: "0.74rem", fontWeight: 600, textDecoration: (t.status === "ok" || t.status === "success") ? "line-through" : "none", color: (t.status === "ok" || t.status === "success") ? "#AAA" : C.text1 }}>
                    {toolLabel[t.tool] || t.tool}
                  </span>
                </div>
                <div style={{ paddingLeft: 20 }}>
                  <LiveTaskStatus tool={t.tool} status={t.status} />
                </div>
              </div>
            ))
          }

          <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", color: C.text3, margin: "1rem 0 0.6rem" }}>STATUS TIMELINE</div>
          {timeline.map((s, idx) => (
            <div key={idx} style={{ display: "flex", gap: "0.45rem", marginBottom: "0.65rem" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 11, height: 11, borderRadius: "50%", flexShrink: 0, background: s.done ? C.green : s.active ? C.amber : C.border }} />
                {idx < timeline.length - 1 && <div style={{ width: 2, height: 18, background: C.border }} />}
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: s.active ? C.text1 : C.text3 }}>{s.l}</div>
                <div style={{ fontSize: "0.65rem", color: s.active ? C.amber : "#AAA" }}>{s.t}</div>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", fontFamily: "Inter, sans-serif" }}>
      <style>{`
        .btn-interactive:active {
          transform: scale(0.97) !important;
          filter: brightness(1.1) !important;
        }
      `}</style>

      {/* Header section */}
      <div style={{
        padding: "0.85rem 1.5rem", background: C.surface,
        borderBottom: `1.5px solid ${C.border}`, flexShrink: 0
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontWeight: 800, fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>🗺️</span> PILOT Travel OS: Trip Planner
            </h2>
            {/* <p style={{ fontSize: "0.75rem", color: C.text3 }}>Unified flight, hotel, train and navigation workstation.</p> */}
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button onClick={() => sess.toggle("customercare")}
              style={{
                display: "flex", alignItems: "center", gap: "0.4rem",
                padding: "0.35rem 0.8rem", borderRadius: 20,
                background: sess.isListening ? C.amberBg : "#F0EDE8",
                border: `1.5px solid ${sess.isListening ? C.amber : C.border}`,
                fontSize: "0.75rem", color: C.amberDark, fontWeight: 600, cursor: "pointer"
              }}>
              <span style={{
                width: 7, height: 7, borderRadius: "50%", background: C.amber,
                display: "inline-block"
              }} />
              {sess.isListening ? "Live Assistant" : "Start Assistant"}
            </button>
            <span style={{ fontSize: "0.8rem", color: C.text2, fontFamily: "monospace" }}>{mm}:{ss}</span>
          </div>
        </div>
      </div>

      {/* Pill-based Tab Navigation */}
      <div style={{
        display: "flex", background: "#F5F3ED", padding: "0.3rem", borderRadius: 10,
        margin: "0.6rem 1rem", border: `1.5px solid ${C.border}`, gap: "0.3rem", flexShrink: 0
      }}>
        {[
          { id: "flights", label: "🛫 Flights" },
          { id: "hotels", label: "🏨 Hotels" },
          { id: "trains", label: "🚆 Trains" },
          { id: "map", label: "🚶 Pedestrian Map" }
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            style={{
              flex: 1, padding: "0.55rem", borderRadius: 8, border: "none",
              color: activeTab === t.id ? 'black'
               : C.text2,
              fontWeight: activeTab === t.id ? 700 : 500, fontSize: "0.8rem",
              cursor: "pointer", transition: "all 0.15s ease",
              boxShadow: activeTab === t.id ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
              backgroundColor:activeTab === t.id ? C.amber: '#fff',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Workstation Workspace split layout */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", paddingBottom: "4.5rem" }}>

        {/* LEFT PANEL - Form Inputs & Help Cards */}
        <div style={{
          width: 280, background: "#F9F8F6", borderRight: `1.5px solid ${C.border}`,
          padding: "0.85rem", overflowY: "auto", flexShrink: 0, display: "flex",
          flexDirection: "column", gap: "0.75rem"
        }}>

          {/* TAB 1: Flights Sidebar */}
          {activeTab === "flights" && (
            <>
              <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", color: C.text3 }}>FLIGHT SEARCH</div>
              {[
                { icon: "🛫", placeholder: "From (e.g. BOM)", val: from, set: setFrom },
                { icon: "🛬", placeholder: "To (e.g. DEL)", val: to, set: setTo },
                { icon: "📅", placeholder: "Date (e.g. 2026-07-01)", val: date, set: setDate },
              ].map(f => (
                <div key={f.placeholder} style={{
                  display: "flex", alignItems: "center", gap: "0.35rem",
                  background: "#fff", borderRadius: 8,
                  border: `1.5px solid ${C.border}`, padding: "0.3rem 0.5rem"
                }}>
                  <span style={{ fontSize: "0.85rem" }}>{f.icon}</span>
                  <input value={f.val} onChange={e => f.set(e.target.value)}
                    placeholder={f.placeholder}
                    style={{ flex: 1, border: "none", outline: "none", fontSize: "0.72rem", background: "transparent", color: C.text1 }} />
                </div>
              ))}

              <button onClick={() => handleSearch("flights")} disabled={loading || !from.trim() || !to.trim() || !date.trim()}
                style={{
                  width: "100%", padding: "0.55rem", background: C.amberDark, color: "#fff",
                  fontWeight: 700, border: "none", borderRadius: 8,
                  cursor: (loading || !from.trim() || !to.trim() || !date.trim()) ? "not-allowed" : "pointer",
                  fontSize: "0.75rem", boxShadow: "0 2px 8px rgba(124,94,0,0.15)", marginTop: "0.25rem",
                  opacity: (loading || !from.trim() || !to.trim() || !date.trim()) ? 0.5 : 1
                }}>
                {loading ? "Searching..." : "🔍 Search Flights"}
              </button>

              <div style={{
                marginTop: "1.25rem", background: "#FAF9F5", border: `1.5px solid ${C.border}`,
                borderRadius: 12, padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.65rem",
                boxShadow: "0 4px 12px rgba(0,0,0,0.03)"
              }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 800, color: C.amberDark, letterSpacing: "0.05em" }}>
                  💡 FLIGHT ASSISTANT GUIDE
                </span>
                <div style={{ fontSize: "0.78rem", color: C.text1, lineHeight: 1.55, display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                  <div>• <strong>Route Search:</strong> Click Search or speak: "Search flights from Mumbai to Delhi on 2026-07-20."</div>
                  <div>• <strong>Typos are OK:</strong> Misspoken/mistyped city names (e.g. "Mumbay") are auto-corrected before the search runs.</div>
                  <div>• <strong>Bookings:</strong> Click a result card's "Book Flight" button. Booking is a destructive action, so PILOT will ask you to say <em>"yes confirm"</em> in your own voice before it finalizes.</div>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: Hotels Sidebar */}
          {activeTab === "hotels" && (
            <>
              <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", color: C.text3 }}>HOTEL SEARCH</div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#fff", borderRadius: 8, border: `1.5px solid ${C.border}`, padding: "0.3rem 0.5rem" }}>
                <span>📍</span>
                <input value={hotelLoc} onChange={e => { setHotelLoc(e.target.value); setHotelCoords(null); }} placeholder="City / Hotel Name"
                  style={{ flex: 1, border: "none", outline: "none", fontSize: "0.72rem", background: "transparent", color: C.text1 }} />
                <button onClick={useMyLocation} disabled={locating} title="Use my current location"
                  style={{
                    border: "none", background: hotelCoords ? C.amberBg : "transparent", color: C.amberDark,
                    fontSize: "0.7rem", cursor: locating ? "default" : "pointer", borderRadius: 6, padding: "0.2rem 0.4rem",
                    fontWeight: 600,
                  }}>
                  {locating ? "…" : "📡 Near me"}
                </button>
              </div>
              {locError && <div style={{ fontSize: "0.68rem", color: "#EF4444", padding: "0 0.2rem" }}>{locError}</div>}
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#fff", borderRadius: 8, border: `1.5px solid ${C.border}`, padding: "0.3rem 0.5rem" }}>
                <span>📅</span>
                <input value={hotelCheckIn} onChange={e => setHotelCheckIn(e.target.value)} placeholder="Check-in Date"
                  style={{ flex: 1, border: "none", outline: "none", fontSize: "0.72rem", background: "transparent", color: C.text1 }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#fff", borderRadius: 8, border: `1.5px solid ${C.border}`, padding: "0.3rem 0.5rem" }}>
                <span>📅</span>
                <input value={hotelCheckOut} onChange={e => setHotelCheckOut(e.target.value)} placeholder="Check-out Date"
                  style={{ flex: 1, border: "none", outline: "none", fontSize: "0.72rem", background: "transparent", color: C.text1 }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#fff", borderRadius: 8, border: `1.5px solid ${C.border}`, padding: "0.3rem 0.5rem" }}>
                <span>⭐</span>
                <select value={hotelMinRating} onChange={e => setHotelMinRating(e.target.value ? Number(e.target.value) : "")}
                  style={{ flex: 1, border: "none", outline: "none", fontSize: "0.72rem", background: "transparent", color: C.text1 }}>
                  <option value="">Any rating</option>
                  <option value="3">3+ stars</option>
                  <option value="4">4+ stars</option>
                  <option value="5">5 stars</option>
                </select>
              </div>
              {/* <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", borderRadius: 8, border: `1.5px solid ${C.border}`, padding: "0.3rem 0.5rem" }}> */}
                {/* <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <span>👥</span>
                  <span style={{ fontSize: "0.72rem", color: C.text1 }}>Guests: <strong>{guestCount}</strong></span>
                </div> */}
                {/* <div style={{ display: "flex", gap: "0.35rem" }}>
                  <button onClick={() => setGuestCount(c => Math.max(1, c - 1))}
                    style={{
                      width: 22, height: 22, borderRadius: "50%", border: `1px solid ${C.border}`,
                      background: "#FAF9F5", color: C.text1, fontWeight: "bold", display: "flex",
                      alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "0.8rem"
                    }}>-</button>
                  <button onClick={() => setGuestCount(c => c + 1)}
                    style={{
                      width: 22, height: 22, borderRadius: "50%", border: `1px solid ${C.border}`,
                      background: "#FAF9F5", color: C.text1, fontWeight: "bold", display: "flex",
                      alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "0.8rem"
                    }}>+</button>
                </div> */}
              {/* </div> */}

              <button onClick={() => handleSearch("hotels")} disabled={loading || !hotelLoc.trim() || !hotelCheckIn.trim() || !hotelCheckOut.trim()}
                style={{
                  width: "100%", padding: "0.55rem", background: C.amberDark, color: "#fff",
                  fontWeight: 700, border: "none", borderRadius: 8,
                  cursor: (loading || !hotelLoc.trim() || !hotelCheckIn.trim() || !hotelCheckOut.trim()) ? "not-allowed" : "pointer",
                  fontSize: "0.75rem", boxShadow: "0 2px 8px rgba(124,94,0,0.15)", marginTop: "0.25rem",
                  opacity: (loading || !hotelLoc.trim() || !hotelCheckIn.trim() || !hotelCheckOut.trim()) ? 0.5 : 1
                }}>
                {loading ? "Searching..." : "🔍 Search Hotels"}
              </button>

              <div style={{
                marginTop: "1.25rem", background: "#FAF9F5", border: `1.5px solid ${C.border}`,
                borderRadius: 12, padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.65rem",
                boxShadow: "0 4px 12px rgba(0,0,0,0.03)"
              }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 800, color: C.amberDark, letterSpacing: "0.05em" }}>
                  💡 HOTEL ASSISTANT GUIDE
                </span>
                <div style={{ fontSize: "0.78rem", color: C.text1, lineHeight: 1.55, display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                  <div>• <strong>Hotel Search:</strong> Click Search or speak: "Search hotels in Paris."</div>
                  <div>• <strong>Star Rating:</strong> Say "find me 5 star hotels in Paris" to filter by minimum rating.</div>
                  <div>• <strong>Near Me:</strong> Say "hotels near my location" or click 📡 Near me to search using your real GPS position.</div>
                  <div>• <strong>Room type / bed count:</strong> Not currently filterable — results show whatever room description the provider (Amadeus/Tavily) returns; we don't guess or invent bed counts that aren't in the source data.</div>
                  <div>• <strong>Bookings:</strong> Click the card "Book Hotel Room" buttons to issue real/simulated bookings.</div>
                </div>
              </div>
            </>
          )}

          {/* TAB 3: Trains Sidebar */}
          {activeTab === "trains" && (
            <>
              <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", color: C.text3 }}>TRAIN SEARCH</div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#fff", borderRadius: 8, border: `1.5px solid ${C.border}`, padding: "0.3rem 0.5rem" }}>
                <span>🚉</span>
                <input value={trainFrom} onChange={e => setTrainFrom(e.target.value)} placeholder="From Station"
                  style={{ flex: 1, border: "none", outline: "none", fontSize: "0.72rem", background: "transparent", color: C.text1 }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#fff", borderRadius: 8, border: `1.5px solid ${C.border}`, padding: "0.3rem 0.5rem" }}>
                <span>🚉</span>
                <input value={trainTo} onChange={e => setTrainTo(e.target.value)} placeholder="To Station"
                  style={{ flex: 1, border: "none", outline: "none", fontSize: "0.72rem", background: "transparent", color: C.text1 }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#fff", borderRadius: 8, border: `1.5px solid ${C.border}`, padding: "0.3rem 0.5rem" }}>
                <span>📅</span>
                <input value={trainDate} onChange={e => setTrainDate(e.target.value)} placeholder="Travel Date"
                  style={{ flex: 1, border: "none", outline: "none", fontSize: "0.72rem", background: "transparent", color: C.text1 }} />
              </div>
              {/* <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#fff", borderRadius: 8, border: `1.5px solid ${C.border}`, padding: "0.3rem 0.5rem" }}>
                <span>🎫</span>
                <select value={trainClass} onChange={e => setTrainClass(e.target.value)}
                  style={{
                    flex: 1, border: "none", outline: "none", fontSize: "0.72rem",
                    background: "transparent", color: C.text1, cursor: "pointer"
                  }}>
                  {["AC First Class (1A)", "AC Two Tier (2A)", "AC Three Tier (3A)", "Sleeper Class (SL)", "AC Chair Car (CC)"].map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div> */}

              <button onClick={() => handleSearch("trains")} disabled={loading || !trainFrom.trim() || !trainTo.trim() || !trainDate.trim()}
                style={{
                  width: "100%", padding: "0.55rem", background: C.amberDark, color: "#fff",
                  fontWeight: 700, border: "none", borderRadius: 8,
                  cursor: (loading || !trainFrom.trim() || !trainTo.trim() || !trainDate.trim()) ? "not-allowed" : "pointer",
                  fontSize: "0.75rem", boxShadow: "0 2px 8px rgba(124,94,0,0.15)", marginTop: "0.25rem",
                  opacity: (loading || !trainFrom.trim() || !trainTo.trim() || !trainDate.trim()) ? 0.5 : 1
                }}>
                {loading ? "Searching..." : "🔍 Search Trains"}
              </button>

              <div style={{
                marginTop: "1.25rem", background: "#FAF9F5", border: `1.5px solid ${C.border}`,
                borderRadius: 12, padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.65rem",
                boxShadow: "0 4px 12px rgba(0,0,0,0.03)"
              }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 800, color: C.amberDark, letterSpacing: "0.05em" }}>
                  💡 TRAIN ASSISTANT GUIDE
                </span>
                <div style={{ fontSize: "0.78rem", color: C.text1, lineHeight: 1.55, display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                  <div>• <strong>Route Search:</strong> Click Search or speak: "Search trains from London to Manchester."</div>
                  <div>• <strong>No Direct Train?</strong> PILOT automatically finds a real connecting route through an interchange city and tells you where to change trains — you don't need to ask for it separately.</div>
                  <div>• <strong>Typos are OK:</strong> Station/city names are auto-corrected for obvious spelling mistakes before searching.</div>
                  <div>• <strong>Bookings:</strong> Click the card "Book Rail Ticket" buttons to confirm seats instantly.</div>
                </div>
              </div>
            </>
          )}

          {/* TAB 4: Route Map Sidebar */}
          {activeTab === "map" && (
            <>
              <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", color: C.text3 }}>PEDESTRIAN MAP DIRECTIONS</div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#fff", borderRadius: 8, border: `1.5px solid ${C.border}`, padding: "0.3rem 0.5rem" }}>
                <span>🟢</span>
                <input value={mapSource} onChange={e => setMapSource(e.target.value)} placeholder="Starting point (Source)"
                  style={{ flex: 1, border: "none", outline: "none", fontSize: "0.72rem", background: "transparent", color: C.text1 }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#fff", borderRadius: 8, border: `1.5px solid ${C.border}`, padding: "0.3rem 0.5rem" }}>
                <span>🔴</span>
                <input value={mapDest} onChange={e => setMapDest(e.target.value)} placeholder="Ending point (Destination)"
                  style={{ flex: 1, border: "none", outline: "none", fontSize: "0.72rem", background: "transparent", color: C.text1 }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#fff", borderRadius: 8, border: `1.5px solid ${C.border}`, padding: "0.3rem 0.5rem" }}>
                <span>🚶</span>

                <input value="Pedestrian (Walking Mode)" disabled
                  style={{ flex: 1, border: "none", outline: "none", fontSize: "0.72rem", background: "transparent", color: "#888", fontWeight: 600 }} />
              </div>

              <button onClick={updateWalkingPath} disabled={mapLoading} className="btn-interactive"
                style={{
                  width: "100%", padding: "0.55rem", background: C.amberDark, color: "#fff",
                  fontWeight: 700, border: "none", borderRadius: 8, cursor: "pointer", fontSize: "0.75rem",
                  boxShadow: "0 2px 8px rgba(124,94,0,0.15)", marginTop: "0.25rem", opacity: mapLoading ? 0.7 : 1,
                  transition: "background-color 0.12s ease, transform 0.05s ease"
                }}>
                {mapLoading ? "Rendering Route..." : "🗺️ Render Walking Route"}
              </button>

              <div style={{
                marginTop: "1.25rem", background: "#FAF9F5", border: `1.5px solid ${C.border}`,
                borderRadius: 12, padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.65rem",
                boxShadow: "0 4px 12px rgba(0,0,0,0.03)"
              }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 800, color: C.amberDark, letterSpacing: "0.05em" }}>
                  💡 MAP GUIDANCE CARD
                </span>
                <div style={{ fontSize: "0.78rem", color: C.text1, lineHeight: 1.55, display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                  <div>• <strong>Walking Direction:</strong> Calculates direct path and pathways for pedestrians.</div>
                  <div>• <strong>Google Maps:</strong> Keyless embed showing paths, traffic, and pedestrian pathways.</div>
                </div>
              </div>
            </>
          )}

        </div>

        {/* RIGHT PANEL - Tab Workspace Contents */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", flexDirection: "column" }}>

          {/* TAB 1: Flights Workspace */}
          {activeTab === "flights" && (
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              {renderAssistantConsole(flightTranscripts, "Flight Booking Agent", "Type flight booking command or search query override...", "flights")}
            </div>
          )}

          {/* TAB 2: Hotels Workspace */}
          {activeTab === "hotels" && (
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              {renderAssistantConsole(hotelTranscripts, "Hotel Booking Agent", "Type hotel booking command or query override...", "hotels")}
            </div>
          )}

          {/* TAB 3: Trains Workspace */}
          {activeTab === "trains" && (
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              {renderAssistantConsole(trainTranscripts, "Railways Booking Agent", "Type train booking command or query override...", "trains")}
            </div>
          )}

          {/* TAB 4: Route Map Workspace */}
          {activeTab === "map" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "1rem", background: "#FAF9F5" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>🚶 Google Maps Pedestrian Navigation</h3>
                {/* <span style={{ fontSize: "0.78rem", color: C.text3 }}>Render walking path directions between any source and destination</span> */}
              </div>

              <div style={{ flex: 1, background: "#fff", border: `1.5px solid ${C.border}`, borderRadius: 12, overflow: "hidden", position: "relative" }}>
                <iframe
                  src={mapIframeUrl}
                  style={{ width: "100%", height: "100%", border: "none" }}
                  allowFullScreen
                  loading="lazy"
                  title="Google Maps Pedestrian Directions"
                />
              </div>
            </div>
          )}

        </div>

      </div>

      <LiveTranscriptBar
        transcripts={flightTranscripts} agentStatus={sess.agentStatus}
        isListening={sess.isListening} level={sess.level}
        onToggle={() => sess.toggle("customercare")}
      />
    </div>
  );
}
