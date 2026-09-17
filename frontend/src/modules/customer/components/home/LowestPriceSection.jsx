import React from "react";
import { ChevronRight, ShoppingBag } from "lucide-react";
import ProductCard from "../shared/ProductCard";

const LowestPriceSection = ({ products, onSeeAll }) => {
  const [timeLeft, setTimeLeft] = React.useState("00 : 00 : 00");

  React.useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      const diff = endOfDay - now;
      if (diff <= 0) {
        setTimeLeft("00 : 00 : 00");
        return;
      }
      const hrs = String(Math.floor(diff / (1000 * 60 * 60))).padStart(2, "0");
      const mins = String(Math.floor((diff / (1000 * 60)) % 60)).padStart(2, "0");
      const secs = String(Math.floor((diff / 1000) % 60)).padStart(2, "0");
      setTimeLeft(`${hrs} : ${mins} : ${secs}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!products || products.length === 0) return null;

  return (
    <div className="relative mb-4 md:mb-8 overflow-hidden">
      {/* Decorative Scalloped Wave Top Edge */}
      <div className="w-full overflow-hidden leading-none z-10 -mb-1">
        <svg
          viewBox="0 0 1200 20"
          className="w-full h-4 md:h-6 text-[#FFF0E6] fill-current preserve-3d"
          preserveAspectRatio="none"
        >
          <path d="M0,10 Q15,20 30,10 Q45,0 60,10 Q75,20 90,10 Q105,0 120,10 Q135,20 150,10 Q165,0 180,10 Q195,20 210,10 Q225,0 240,10 Q255,20 270,10 Q285,0 300,10 Q315,20 330,10 Q345,0 360,10 Q375,20 390,10 Q405,0 420,10 Q435,20 450,10 Q465,0 480,10 Q495,20 510,10 Q525,0 540,10 Q555,20 570,10 Q585,0 600,10 Q615,20 630,10 Q645,0 660,10 Q675,20 690,10 Q705,0 720,10 Q735,20 750,10 Q765,0 780,10 Q795,20 810,10 Q825,0 840,10 Q855,20 870,10 Q875,0 890,10 Q905,20 920,10 Q935,0 950,10 Q965,20 980,10 Q995,0 1010,10 Q1025,20 1040,10 Q1055,0 1070,10 Q1085,20 1100,10 Q1115,0 1130,10 Q1145,20 1160,10 Q1175,0 1190,10 Q1200,15 1200,20 L0,20 Z" />
        </svg>
      </div>

      {/* Light Orange Background Container */}
      <div className="relative bg-gradient-to-b from-[#FFF0E6] via-[#FFF6EF] to-[#FFFBF7] pt-4 pb-3 md:pt-6 md:pb-5 border-b border-orange-100/70 shadow-2xs">
        <div className="container mx-auto px-4 md:px-8 lg:px-[50px] relative z-10">
          <div className="flex justify-between items-center mb-4 md:mb-6 px-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-primary shrink-0">
                <ShoppingBag size={14} className="fill-current text-[#FF5722]" />
              </div>
              <h3 className="text-base md:text-lg font-black text-[#1A1A1A] tracking-tight leading-none">
                Today's Deals
              </h3>
              <div className="bg-white/90 text-slate-800 text-[10px] md:text-xs font-extrabold px-2.5 py-1 rounded-full flex items-center justify-center tracking-wide leading-none border border-orange-200/60 select-none ml-1.5 tabular-nums shadow-2xs">
                {timeLeft}
              </div>
            </div>
            <button
              onClick={onSeeAll}
              className="flex items-center gap-0.5 text-[#FF5722] hover:text-orange-600 font-bold text-xs md:text-sm transition-colors whitespace-nowrap cursor-pointer">
              See All
              <ChevronRight size={13} strokeWidth={3} />
            </button>
          </div>
          <div className="relative z-10 flex overflow-x-auto gap-3 md:gap-6 pb-2 md:pb-4 no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory scroll-smooth scroll-pl-4 md:scroll-pl-0 after:content-[''] after:w-1 after:shrink-0">
            {products.slice(0, 12).map((product) => (
              <div key={product.id} className="w-[126px] sm:w-[136px] md:w-[148px] shrink-0 snap-start smooth-transform">
                <ProductCard
                  product={product}
                  className="bg-white shadow-[0_8px_20px_-8px_rgba(0,0,0,0.08)] md:shadow-[0_15px_30px_rgba(0,0,0,0.05)] border-orange-100/50 md:border-slate-100 transition-all"
                  compact={true}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(LowestPriceSection);
