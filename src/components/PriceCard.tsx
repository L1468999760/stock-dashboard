import type { Quote, AssetKey, GoldSource } from "@/lib/market";
import GoldToggle from "./GoldToggle";

const PRECISION: Record<AssetKey, number> = { ndx: 2, spx: 2, gold: 2, dv50: 4 };

interface Props {
  quote: Quote;
  goldSrc?: GoldSource;
  onGoldSrcChange?: (src: GoldSource) => void;
}

export default function PriceCard({ quote, goldSrc, onGoldSrcChange }: Props) {
  const up = quote.change >= 0;
  const showToggle = quote.key === "gold" && goldSrc !== undefined && onGoldSrcChange !== undefined;
  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-fg">{quote.name}</h3>
        {showToggle ? (
          <GoldToggle value={goldSrc} onChange={onGoldSrcChange} />
        ) : (
          <span className="text-xs text-muted">{quote.unit}</span>
        )}
      </div>
      <div className={`mt-2 text-3xl font-semibold tabular-nums ${up ? "text-up" : "text-down"}`}>
        {quote.price.toFixed(PRECISION[quote.key])}
        {showToggle && <span className="ml-1.5 text-sm font-normal text-muted">{quote.unit}</span>}
      </div>
      <div className="mt-1 flex items-center gap-2 text-sm">
        <span className={`rounded px-1.5 py-0.5 font-medium tabular-nums ${up ? "bg-up/15 text-up" : "bg-down/15 text-down"}`}>
          {up ? "+" : ""}
          {quote.change.toFixed(PRECISION[quote.key])} ({up ? "+" : ""}
          {quote.changePct.toFixed(2)}%)
        </span>
        {quote.high != null && quote.low != null && (
          <span className="text-muted">
            高 {quote.high.toFixed(quote.key === "dv50" ? 4 : 0)} / 低{" "}
            {quote.low.toFixed(quote.key === "dv50" ? 4 : 0)}
          </span>
        )}
      </div>
      <div className="mt-2 text-xs text-faint">{quote.time}</div>
    </div>
  );
}
