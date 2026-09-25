import { motion } from "framer-motion";
import {
  ROOMS, AESTHETICS, MATERIALITY, ATMOSPHERES, PATTERNS,
  TOUCHES_BY_ROOM, SEATING_OPTIONS, BED_SIZES, INVESTMENTS,
} from "./consultationOptions";
import patternRug from "@/assets/pattern-rug.jpg";

function Heading({ children, testId }: { children: React.ReactNode; testId?: string }) {
  return (
    <div className="max-w-[1400px] mx-auto px-6 md:px-14 pt-12 pb-10 md:pt-16 md:pb-14">
      <h2 className="cc-heading" data-testid={testId}>{children}</h2>
    </div>
  );
}

const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.9 } };

/** Step 1 (p1) */
export function ConsultRoomStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Heading testId="heading-room-type">Select the space you will be elevating</Heading>
      <div className="cc-panel py-16 md:py-24">
        <div role="radiogroup" aria-label="Room" className="max-w-[1400px] mx-auto px-6 md:px-14 grid gap-8 md:grid-cols-3">
          {ROOMS.map((r, i) => (
            <motion.button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={value === r.id}
              onClick={() => onChange(r.id)}
              className="cc-tile aspect-[1.1/1]"
              data-testid={`room-${r.id.toLowerCase().replace(/\s+/g, "-")}`}
              {...fade}
              transition={{ duration: 0.9, delay: i * 0.12 }}
            >
              <img src={r.image} alt={r.label} />
              <span className="cc-tile-label">{r.label}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Step 2 (p2): stores the mapped canonical style + keeps the caption for Verify */
export function ConsultAestheticStep({
  style, onChange,
}: { style: string; onChange: (style: string, caption: string) => void }) {
  return (
    <div>
      <Heading testId="heading-aesthetic">Identify Your Aesthetic</Heading>
      <div role="radiogroup" aria-label="Aesthetic">
        {AESTHETICS.map((a) => (
          <div key={a.style} className="mb-2">
            <button
              type="button"
              role="radio"
              aria-checked={style === a.style}
              onClick={() => onChange(a.style, a.caption)}
              className="cc-tile aspect-[16/8.5]"
              aria-label={a.caption}
              data-testid={`aesthetic-${a.style}`}
            >
              <img src={a.image} alt="" />
            </button>
            <p className="max-w-[1400px] mx-auto px-6 md:px-14 py-8 text-xl md:text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
              {a.caption}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Step 3 (p4) */
export function ConsultMaterialityStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Heading testId="heading-materiality">Define the materiality and depth of the environment</Heading>
      {MATERIALITY.map((m) => {
        const selected = value === m.style;
        return (
          <div key={m.style} className="grid md:grid-cols-2 mb-10 md:mb-14">
            <div className="relative min-h-[26rem]">
              <img src={m.photo} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="relative z-10 m-6 md:m-12 bg-[#f4f6f5] border border-[#231f20]/15 max-w-md">
                <p className="px-8 py-10 text-center text-xl md:text-2xl italic leading-snug" style={{ fontFamily: "var(--font-serif)" }}>
                  &ldquo;{m.quote}&rdquo;
                </p>
                <p className="border-y border-[#231f20]/25 px-8 py-6 text-center font-light">{m.palette}</p>
                <div className="p-8 flex justify-center">
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onChange(m.style)}
                    className="cc-option px-14 py-3"
                    data-testid={`materiality-${m.style}`}
                  >
                    Select
                  </button>
                </div>
              </div>
            </div>
            <img src={m.grid} alt="" className="w-full h-full object-cover" />
          </div>
        );
      })}
    </div>
  );
}

/** Step 4 (p5) */
export function ConsultAtmosphereStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Heading testId="heading-atmosphere">Determine the tonality of your atmosphere</Heading>
      <div role="radiogroup" aria-label="Atmosphere" className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {ATMOSPHERES.map((a) => (
          <div key={a.id}>
            <button
              type="button" role="radio" aria-checked={value === a.id}
              onClick={() => onChange(a.id)}
              className="cc-tile aspect-[0.6/1]" aria-label={a.id}
              data-testid={`atmosphere-${a.id}`}
            >
              <img src={a.image} alt="" />
            </button>
            <p className="text-center py-8 text-2xl" style={{ fontFamily: "var(--font-serif)" }}>{a.id}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Step 5 (p6) */
export function ConsultPatternStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Heading testId="heading-pattern">Specify pattern density</Heading>
      <div className="flex">
        <img src={patternRug} alt="" className="hidden md:block w-[18%] object-cover" />
        <div role="radiogroup" aria-label="Pattern density" className="flex-1 flex flex-col">
          {PATTERNS.map((p) => (
            <button
              key={p.id} type="button" role="radio" aria-checked={value === p.id}
              onClick={() => onChange(p.id)}
              className="cc-option !text-left px-8 md:px-12 py-10 md:py-14 border-0 bg-[#f4f6f5] flex-1"
              data-testid={`pattern-${p.id}`}
            >
              <span className="block text-2xl md:text-3xl mb-5" style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}>{p.id}</span>
              <span className="block text-lg md:text-xl">{p.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Step 6 (p7/p8/p9) */
export function ConsultTouchesStep({
  roomType, touches, seatingCapacity, bedSize, onTouchesChange, onSeatingChange, onBedSizeChange,
}: {
  roomType: string;
  touches: string[];
  seatingCapacity: number | null;
  bedSize: string;
  onTouchesChange: (v: string[]) => void;
  onSeatingChange: (v: number | null) => void;
  onBedSizeChange: (v: string) => void;
}) {
  const options = TOUCHES_BY_ROOM[roomType] ?? [];
  const toggle = (o: string) =>
    onTouchesChange(touches.includes(o) ? touches.filter((t) => t !== o) : [...touches, o]);
  return (
    <div>
      <Heading testId="heading-touches">Select all practical touches that make living effortless</Heading>
      <div className="cc-panel py-12 md:py-14">
        <div className="max-w-[1400px] mx-auto px-6 md:px-14">
          <p className="mb-4 text-sm text-[#57524f]" data-testid="text-touches-room">{roomType}</p>
          <div className="grid gap-6 md:grid-cols-2" role="group" aria-label="Practical touches">
            {options.map((o) => (
              <button
                key={o} type="button" aria-pressed={touches.includes(o)} onClick={() => toggle(o)}
                className="cc-option py-9 px-6 text-xl md:text-2xl"
                data-testid={`touch-${o}`}
              >
                {o}
              </button>
            ))}
          </div>

          {roomType === "Dining Room" && (
            <div className="cc-option !cursor-default mt-6 py-9 px-6 flex items-center justify-center gap-6 md:gap-14 flex-wrap" role="radiogroup" aria-label="Seating">
              <span className="text-xl md:text-2xl">Seating:</span>
              {SEATING_OPTIONS.map((n) => (
                <button
                  key={n} type="button" role="radio" aria-checked={seatingCapacity === n}
                  onClick={() => onSeatingChange(seatingCapacity === n ? null : n)}
                  className={`italic text-xl md:text-2xl px-4 py-1 transition-colors duration-500 ${seatingCapacity === n ? "bg-[#7f807a] text-white" : "text-[#231f20] hover:bg-[#231f20]/10"}`}
                  data-testid={`seating-${n}`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}

          {roomType === "Bedroom" && (
            <div className="grid gap-6 md:grid-cols-3 mt-6" role="radiogroup" aria-label="Bed size">
              {BED_SIZES.map((b) => (
                <button
                  key={b} type="button" role="radio" aria-checked={bedSize === b}
                  onClick={() => onBedSizeChange(bedSize === b ? "" : b)}
                  className="cc-option py-9 px-6 text-xl md:text-2xl"
                  data-testid={`bed-${b}`}
                >
                  {b}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Step 7 (p10) */
export function ConsultInvestmentStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Heading testId="heading-investment">Define your investment</Heading>
      <div className="cc-panel py-14">
        <div role="radiogroup" aria-label="Investment" className="max-w-[1400px] mx-auto px-6 md:px-14 flex flex-col gap-6">
          {INVESTMENTS.map((b) => (
            <button
              key={b.id} type="button" role="radio" aria-checked={value === b.id}
              onClick={() => onChange(b.id)}
              className="cc-option !text-left px-8 py-11 text-xl md:text-2xl"
              data-testid={`budget-${b.id}`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
