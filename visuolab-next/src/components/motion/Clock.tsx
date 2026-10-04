"use client";

import { useEffect, useState, type ReactNode } from "react";
import { st } from "@/lib/css";

type Tick = { hh: string; mm: string; offset: string; status: string; off: boolean };

function read(tz: string): Tick {
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions = { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short" };
  let parts: Intl.DateTimeFormatPart[];
  try { parts = new Intl.DateTimeFormat("en-GB", { timeZoneName: "shortOffset", ...opts }).formatToParts(now); }
  catch { parts = new Intl.DateTimeFormat("en-GB", opts).formatToParts(now); }
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  const h = parseInt(get("hour"), 10) % 24;
  const wd = get("weekday");
  const weekend = wd === "Sat" || wd === "Sun";
  const working = !weekend && h >= 9 && h < 18;
  return {
    hh: h < 10 ? "0" + h : String(h),
    mm: get("minute"),
    offset: get("timeZoneName"),
    status: weekend ? "Weekend" : working ? "Working now" : "After hours",
    off: !working,
  };
}

/** One "where we work" clock. The server renders the --:-- placeholder from the HTML; it ticks every second after mount. */
export default function Clock({ tz, index, city, country, flag }: { tz: string; index: number; city: string; country: string; flag: ReactNode }) {
  const [t, setT] = useState<Tick | null>(null);
  useEffect(() => {
    const tick = () => setT(read(tz));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tz]);

  return (
    <div className={t?.off ? "clock reveal off" : "clock reveal"} style={st({ "--i": index })} data-tz={tz}>
      <span className="mark">{flag}</span>
      <span className="city">{city}</span>
      <span className="country">{country} <span className="offset">{t?.offset ?? ""}</span></span>
      <b className="time">{t ? t.hh : "--"}<i>:</i>{t ? t.mm : "--"}</b>
      <span className="status"><i></i><span>{t ? t.status : " "}</span></span>
    </div>
  );
}
