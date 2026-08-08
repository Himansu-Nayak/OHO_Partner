import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet";
import L from "leaflet";
import { initSocket, emitDriverOnline, emitDriverLocation } from "./services/socketService";
import { queueAction, syncOfflineActions } from "./services/offlineSync";
import { speak, listenForCommand, setVernacularLanguage, getVernacularLanguage } from "./services/speechService";

// Fix leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ─── Types ───────────────────────────────────────────────────────────────────
type Screen =
  | "splash"
  | "login"
  | "otp"
  | "home"
  | "incoming"
  | "active"
  | "orders"
  | "earnings"
  | "reviews"
  | "profile"
  | "map";

// ─── Icons ────────────────────────────────────────────────────────────────────
const HomeIcon = ({ active }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"
      stroke={active ? "#2563EB" : "#94A3B8"} strokeWidth="2" fill={active ? "#EEF3FB" : "none"} strokeLinejoin="round" />
    <path d="M9 21V12h6v9" stroke={active ? "#2563EB" : "#94A3B8"} strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const OrderIcon = ({ active }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="3" stroke={active ? "#2563EB" : "#94A3B8"} strokeWidth="2" fill={active ? "#EEF3FB" : "none"} />
    <path d="M7 8h10M7 12h7M7 16h5" stroke={active ? "#2563EB" : "#94A3B8"} strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const EarningsIcon = ({ active }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke={active ? "#2563EB" : "#94A3B8"} strokeWidth="2" fill={active ? "#EEF3FB" : "none"} />
    <path d="M12 7v1.5M12 15.5V17M9.5 10a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 4" stroke={active ? "#2563EB" : "#94A3B8"} strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const ProfileIcon = ({ active }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="4" stroke={active ? "#2563EB" : "#94A3B8"} strokeWidth="2" fill={active ? "#EEF3FB" : "none"} />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={active ? "#2563EB" : "#94A3B8"} strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const StarIcon = ({ filled = true, size = 14 }: { filled?: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "#FBBF24" : "none"}>
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const LocationPin = ({ color = "#2563EB" }: { color?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill={color} />
    <circle cx="12" cy="9" r="2.5" fill="white" />
  </svg>
);
const PhoneIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2C8.5 21 3 15.5 3 6a2 2 0 012-2z"
      stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const NavIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M12 2l7 20-7-4-7 4 7-20z" fill="white" stroke="white" strokeWidth="1" strokeLinejoin="round" />
  </svg>
);
const CheckIcon = ({ size = 16, color = "white" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const BackIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M15 18l-6-6 6-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── Components ───────────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    online: { bg: "bg-green-100", text: "text-green-700", label: "Online" },
    delivered: { bg: "bg-green-100", text: "text-green-700", label: "Delivered" },
    pending: { bg: "bg-orange-100", text: "text-orange-600", label: "Pending" },
    cancelled: { bg: "bg-red-100", text: "text-red-600", label: "Cancelled" },
    active: { bg: "bg-blue-100", text: "text-blue-700", label: "Active" },
  };
  const s = map[status] ?? { bg: "bg-gray-100", text: "text-gray-600", label: status };
  return (
    <span className={`${s.bg} ${s.text} text-xs font-600 px-2.5 py-1 rounded-full`}>{s.label}</span>
  );
};

const BottomNav = ({
  active,
  onNav,
}: {
  active: string;
  onNav: (s: Screen) => void;
}) => (
  <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex justify-around items-center pb-8 pt-3 px-4">
    {[
      { key: "home", label: "Home", Icon: HomeIcon },
      { key: "orders", label: "Orders", Icon: OrderIcon },
      { key: "earnings", label: "Earnings", Icon: EarningsIcon },
      { key: "profile", label: "Profile", Icon: ProfileIcon },
    ].map(({ key, label, Icon }) => (
      <button
        key={key}
        onClick={() => onNav(key as Screen)}
        className="flex flex-col items-center gap-1"
      >
        <Icon active={active === key} />
        <span className={`text-[10px] font-500 ${active === key ? "text-blue-600" : "text-slate-400"}`}>
          {label}
        </span>
      </button>
    ))}
  </div>
);

// ─── Screens ──────────────────────────────────────────────────────────────────

function SplashScreen({ onNext }: { onNext: () => void }) {
  useEffect(() => {
    const t = setTimeout(onNext, 2000);
    return () => clearTimeout(t);
  }, [onNext]);
  return (
    <div className="w-full h-full flex flex-col items-center justify-center pt-10" style={{ background: "#1A3564" }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center shadow-2xl">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-800 text-[#1A3564] leading-none">OHO</span>
            <span className="text-[9px] font-600 text-blue-500 tracking-widest mt-0.5">PARTNER</span>
          </div>
        </div>
        <div className="text-center mt-2">
          <p className="text-white/60 text-sm font-400">Powered by Kampa Infra</p>
        </div>
      </div>
      <div className="absolute bottom-16 flex gap-2">
        <div className="w-8 h-1.5 rounded-full bg-blue-400" />
        <div className="w-2 h-1.5 rounded-full bg-white/30" />
        <div className="w-2 h-1.5 rounded-full bg-white/30" />
      </div>
    </div>
  );
}

function LoginScreen({ onNext }: { onNext: () => void }) {
  const [phone, setPhone] = useState("");
  return (
    <div className="w-full h-full flex flex-col" style={{ background: "#1A3564" }}>
      {/* Top */}
      <div className="flex flex-col items-center pt-16 pb-8 px-6">
        <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-xl mb-4">
          <div className="flex flex-col items-center">
            <span className="text-xl font-800 text-[#1A3564] leading-none">OHO</span>
            <span className="text-[8px] font-600 text-blue-500 tracking-widest">PARTNER</span>
          </div>
        </div>
        <h1 className="text-white text-2xl font-700 mt-2">Welcome Back</h1>
        <p className="text-white/60 text-sm mt-1 text-center">Login to your partner account</p>
      </div>

      {/* Form Card - scrollable so content fits in 812px frame */}
      <div className="flex-1 bg-white rounded-t-3xl px-6 pt-8">
        {/* Partner Badge */}
        <div className="flex items-center gap-3 bg-blue-50 rounded-2xl p-4 mb-6">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M9 12l2 2 4-4" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 2l2.4 2.4L17 3l1 2.8 2.8 1-1.4 2.6.4 3-2.8.6L15 15l-3-1.2L9 15l-2-2.8-2.8-.6.4-3L3 5.8l2.8-1L7 2l2.6 1.4L12 2z"
                stroke="#2563EB" strokeWidth="1.5" fill="#EEF3FB" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-400">Verified Partner Account</p>
            <p className="text-sm text-slate-800 font-600">OHO Delivery Network</p>
          </div>
        </div>

        <label className="text-sm font-600 text-slate-700 mb-2 block">Mobile Number</label>
        <div className="flex items-center border-2 border-slate-200 rounded-2xl overflow-hidden focus-within:border-blue-500 transition-colors mb-6">
          <div className="bg-slate-50 px-4 py-4 border-r-2 border-slate-200">
            <span className="text-slate-700 font-600">+91</span>
          </div>
          <input
            className="flex-1 px-4 py-4 text-slate-800 font-500 text-base outline-none bg-white"
            placeholder="Enter phone number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.slice(0, 10))}
          />
        </div>

        <button
          onClick={onNext}
          className="w-full py-4 rounded-2xl text-white font-700 text-base transition-transform active:scale-95"
          style={{ background: "#1A3564" }}
        >
          Get OTP →
        </button>

        <p className="text-center text-xs text-slate-400 mt-6">
          By continuing, you agree to our{" "}
          <span className="text-blue-600 font-500">Terms & Conditions</span>
        </p>
      </div>
    </div>
  );
}

function OTPScreen({ onNext }: { onNext: () => void }) {
  const [otp, setOtp] = useState(["", "", "", ""]);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    if (val && i < 3) inputs.current[i + 1]?.focus();
  };

  return (
    <div className="w-full h-full flex flex-col" style={{ background: "#1A3564" }}>
      <div className="flex flex-col items-center pt-16 pb-8 px-6">
        <h1 className="text-white text-2xl font-700">Verify OTP</h1>
        <p className="text-white/60 text-sm mt-1 text-center">Sent to +91 98765 43210</p>
      </div>
      <div className="flex-1 bg-white rounded-t-3xl px-6 pt-10">
        <div className="flex justify-center gap-4 mb-8">
          {otp.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputs.current[i] = el; }}
              className="w-14 h-16 text-center text-2xl font-700 text-slate-800 border-2 border-slate-200 rounded-2xl focus:border-blue-500 outline-none transition-colors"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
            />
          ))}
        </div>
        <p className="text-center text-sm text-slate-500 mb-8">
          Didn't receive? <span className="text-blue-600 font-600">Resend in 30s</span>
        </p>
        <button
          onClick={onNext}
          className="w-full py-4 rounded-2xl text-white font-700 text-base"
          style={{ background: "#1A3564" }}
        >
          Verify & Login
        </button>
      </div>
    </div>
  );
}

function HomeScreen({ onNav }: { onNav: (s: Screen) => void }) {
  const [isOnline, setIsOnline] = useState(true);
  const [destMode, setDestMode] = useState(false);
  const [destAddress, setDestAddress] = useState("Home: Cuttack Road");

  return (
    <div className="w-full h-full flex flex-col" style={{ background: "#EEF3FB" }}>
      {/* Header */}
      <div className="px-5 pt-16 pb-5" style={{ background: "#1A3564" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/60 text-xs font-400">Good morning,</p>
            <h1 className="text-white text-xl font-700">Arjun Sharma</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-400 flex items-center justify-center">
              <span className="text-white font-700 text-sm">AS</span>
            </div>
          </div>
        </div>

        {/* Online Toggle & Destination Mode */}
        <div className="bg-white/10 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-700 text-base ${isOnline ? "text-green-400" : "text-white/50"}`}>
                {isOnline ? "● Online" : "○ Offline"}
              </p>
              <p className="text-white/60 text-xs mt-0.5">
                {isOnline ? "You're available for orders" : "You're not receiving orders"}
              </p>
            </div>
            <button
              onClick={() => {
                const nextState = !isOnline;
                setIsOnline(nextState);
                emitDriverOnline(nextState);
              }}
              className={`w-14 h-7 rounded-full transition-colors relative ${isOnline ? "bg-green-500" : "bg-white/20"}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-all ${isOnline ? "right-1" : "left-1"}`} />
            </button>
          </div>
          
          <div className="flex items-center justify-between pt-3 border-t border-white/10">
            <div>
              <p className={`font-700 text-sm ${destMode ? "text-blue-300" : "text-white/70"}`}>
                🏠 Destination Mode (Go-Home Route)
              </p>
              {destMode && (
                <input 
                  type="text" 
                  value={destAddress}
                  onChange={(e) => setDestAddress(e.target.value)}
                  className="bg-transparent text-white/90 text-xs border-b border-white/30 focus:outline-none focus:border-blue-400 mt-1 w-full"
                />
              )}
            </div>
            <button
              onClick={() => setDestMode(!destMode)}
              className={`w-10 h-5 rounded-full transition-colors relative ${destMode ? "bg-blue-500" : "bg-white/20"}`}
            >
              <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-all ${destMode ? "right-1" : "left-1"}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto hide-scrollbar px-5 py-4 pb-24 space-y-4">
        {/* Today's Earnings */}
        <div className="rounded-2xl p-5 text-white" style={{ background: "#2563EB" }}>
          <p className="text-white/70 text-xs font-500 mb-1">Today's Earnings</p>
          <p className="text-3xl font-800">₹847</p>
          <div className="flex gap-6 mt-4">
            <div>
              <p className="text-white/70 text-xs">Deliveries</p>
              <p className="text-white font-700 text-lg">12</p>
            </div>
            <div>
              <p className="text-white/70 text-xs">Rating</p>
              <p className="text-white font-700 text-lg flex items-center gap-1">4.8 <StarIcon size={12} /></p>
            </div>
            <div>
              <p className="text-white/70 text-xs">Bonus</p>
              <p className="text-green-300 font-700 text-lg">₹120</p>
            </div>
          </div>
        </div>

        {/* Active Order Card */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-700 font-600 text-sm">Active Order</p>
            <StatusBadge status="active" />
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-400 font-500">ORD-20847</span>
              <span className="text-blue-600 font-700 text-sm">₹85.00</span>
            </div>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-green-500 mt-0.5" />
                  <div className="w-0.5 h-8 bg-slate-200 my-1" />
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-xs text-slate-400">Pickup</p>
                    <p className="text-sm font-600 text-slate-800">Swiggy Dark Kitchen, Patia</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Drop</p>
                    <p className="text-sm font-600 text-slate-800">Plot 45, Saheed Nagar, BBSR</p>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={() => onNav("active")}
              className="w-full mt-4 py-3 rounded-xl text-white font-700 text-sm"
              style={{ background: "#1A3564" }}
            >
              View Active Order
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <p className="text-slate-700 font-600 text-sm">Quick Stats</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "This Week", value: "₹4,230", sub: "47 deliveries", color: "#EEF3FB", text: "#1A3564" },
            { label: "Acceptance Rate", value: "94%", sub: "Last 30 days", color: "#F0FDF4", text: "#16A34A" },
            { label: "Avg Rating", value: "4.8★", sub: "From 203 reviews", color: "#FFF7ED", text: "#EA580C" },
            { label: "Streak", value: "8 Days", sub: "Keep it up! 🔥", color: "#EEF3FB", text: "#2563EB" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl p-4" style={{ background: s.color }}>
              <p className="text-slate-500 text-xs font-500">{s.label}</p>
              <p className="font-800 text-xl mt-1" style={{ color: s.text }}>{s.value}</p>
              <p className="text-slate-400 text-xs mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Gamified Incentive Target Bar */}
        <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: "#FFF7ED" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-xl">🏆</div>
            <div className="flex-1">
              <p className="text-orange-700 font-700 text-sm">2 trips left for ₹200 bonus!</p>
              <p className="text-orange-500 text-xs mt-0.5">12 / 14 trips completed today</p>
            </div>
          </div>
          <div className="w-full bg-orange-200 rounded-full h-2">
            <div className="bg-orange-500 h-2 rounded-full" style={{ width: '85%' }}></div>
          </div>
        </div>
      </div>

      <BottomNav active="home" onNav={onNav} />
    </div>
  );
}

function IncomingOrderScreen({ onNav }: { onNav: (s: Screen) => void }) {
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    const t = setInterval(() => setTimeLeft((p) => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progress = (timeLeft / 30) * circumference;

  return (
    <div className="w-full h-full flex flex-col" style={{ background: "#1A3564" }}>
      {/* Header */}
      <div className="px-5 pt-16 pb-4 flex items-center justify-between">
        <h2 className="text-white font-700 text-lg">New Order Request</h2>
        <span className="bg-orange-500 text-white text-xs font-700 px-3 py-1.5 rounded-full animate-pulse">
          INCOMING
        </span>
      </div>

      {/* Countdown Ring */}
      <div className="flex flex-col items-center py-6">
        <svg width="128" height="128" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
          <circle
            cx="64" cy="64" r={radius} fill="none"
            stroke={timeLeft > 10 ? "#22C55E" : "#EF4444"}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            transform="rotate(-90 64 64)"
            style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
          />
          <text x="64" y="68" textAnchor="middle" fill="white" fontSize="28" fontWeight="800" fontFamily="Poppins">{timeLeft}</text>
          <text x="64" y="84" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="11" fontFamily="Poppins">seconds</text>
        </svg>
      </div>

      {/* Order Card */}
      <div className="flex-1 bg-white rounded-t-3xl px-5 pt-6 pb-8 space-y-4">
        {/* Order meta */}
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-xs font-500">Order #ORD-20899</span>
          <span className="text-blue-700 font-800 text-xl">₹92.50</span>
        </div>

        {/* Route */}
        <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
          <div className="flex gap-3 items-start">
            <LocationPin color="#16A34A" />
            <div>
              <p className="text-xs text-slate-400">Pickup</p>
              <p className="text-sm font-700 text-slate-800">Burger King, Unit-4, Bhubaneswar</p>
              <p className="text-xs text-slate-400 mt-0.5">2.3 km away</p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <LocationPin color="#DC2626" />
            <div>
              <p className="text-xs text-slate-400">Drop</p>
              <p className="text-sm font-700 text-slate-800">Plot 12, Jaydev Vihar, BBSR</p>
              <p className="text-xs text-slate-400 mt-0.5">5.8 km total</p>
            </div>
          </div>
        </div>

        {/* Details row */}
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: "Distance", value: "5.8 km" },
            { label: "Est. Time", value: "22 min" },
            { label: "Payout", value: "₹92.50" },
          ].map((d) => (
            <div key={d.label} className="bg-blue-50 rounded-xl py-3">
              <p className="text-blue-700 font-800 text-sm">{d.value}</p>
              <p className="text-slate-400 text-xs mt-0.5">{d.label}</p>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => onNav("home")}
            className="flex-1 py-4 rounded-2xl border-2 border-red-200 text-red-500 font-700 text-base"
          >
            ✕ Reject
          </button>
          <button
            onClick={() => onNav("active")}
            className="flex-2 flex-1 py-4 rounded-2xl text-white font-700 text-base"
            style={{ background: "#16A34A", flexGrow: 2 }}
          >
            ✓ Accept Order
          </button>
        </div>
      </div>
    </div>
  );
}

function ActiveDeliveryScreen({ onNav }: { onNav: (s: Screen) => void }) {
  const steps = ["Arrived at Pickup", "On the Way", "Delivered"];
  const [currentStep, setCurrentStep] = useState(0);
  const [swipeX, setSwipeX] = useState(0);
  const swipeRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  
  const [pin, setPin] = useState("");
  const [isPinVerified, setIsPinVerified] = useState(false);

  const handleVerifyPin = () => {
    if (pin === "1234") {
      setIsPinVerified(true);
      setCurrentStep(1);
      queueAction('start_trip', { pin });
    } else {
      alert("Invalid PIN. For demo, use 1234");
    }
  };

  const handlePointerDown = () => { isDragging.current = true; };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    setSwipeX(Math.min(Math.max(0, e.clientX - (swipeRef.current?.getBoundingClientRect().left ?? 0) - 28), 270));
  };
  const handlePointerUp = () => {
    isDragging.current = false;
    if (swipeX > 220) { onNav("orders"); } else { setSwipeX(0); }
  };

  return (
    <div className="w-full h-full flex flex-col" style={{ background: "#EEF3FB" }}>
      {/* Header */}
      <div className="px-5 pt-16 pb-4" style={{ background: "#1A3564" }}>
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => onNav("home")}><BackIcon /></button>
          <h2 className="text-white font-700 text-lg">Active Delivery</h2>
          <StatusBadge status="active" />
        </div>
        <div className="bg-white/10 rounded-xl px-4 py-2.5 flex items-center justify-between">
          <span className="text-white text-sm font-500">ORD-20847</span>
          <span className="text-blue-300 font-700">₹85.00</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar px-5 py-4 pb-6 space-y-4">
        {/* Customer + Action Buttons */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-blue-700 font-700">PK</span>
            </div>
            <div className="flex-1">
              <p className="font-700 text-slate-800">Priya Krishnan</p>
              <div className="flex items-center gap-1">
                <StarIcon size={12} />
                <span className="text-xs text-slate-500">4.6 • Customer</span>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl" style={{ background: "#1A3564" }}>
              <PhoneIcon />
              <span className="text-white font-600 text-sm">Call</span>
            </button>
            <button onClick={() => onNav("map")} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600">
              <NavIcon />
              <span className="text-white font-600 text-sm">Navigate</span>
            </button>
          </div>
        </div>

        {/* Route */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex gap-3 items-start">
            <LocationPin color="#16A34A" />
            <div>
              <p className="text-xs text-slate-400">Pickup</p>
              <p className="text-sm font-700 text-slate-800">Swiggy Dark Kitchen, Patia</p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <LocationPin color="#DC2626" />
            <div>
              <p className="text-xs text-slate-400">Drop</p>
              <p className="text-sm font-700 text-slate-800">Plot 45, Saheed Nagar, BBSR</p>
            </div>
          </div>
        </div>

        {/* Status Stepper */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-700 text-slate-700 mb-4">Delivery Status</p>
          <div className="space-y-1">
            {steps.map((step, i) => (
              <div key={step} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => setCurrentStep(i)}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${i <= currentStep ? "bg-blue-600" : "bg-slate-200"}`}
                  >
                    {i < currentStep ? <CheckIcon size={14} /> : <span className="text-white text-xs font-700">{i + 1}</span>}
                  </button>
                  {i < steps.length - 1 && (
                    <div className={`w-0.5 h-8 my-1 ${i < currentStep ? "bg-blue-400" : "bg-slate-200"}`} />
                  )}
                </div>
                <div className="flex-1 pt-1 pb-3">
                  <p className={`text-sm font-600 ${i <= currentStep ? "text-blue-700" : "text-slate-400"}`}>{step}</p>
                  {i === currentStep && <p className="text-xs text-slate-400 mt-0.5">In progress…</p>}
                  {i < currentStep && <p className="text-xs text-green-600 mt-0.5">Completed</p>}
                </div>
              </div>
            ))}
          </div>
          {currentStep === 0 && !isPinVerified ? (
            <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100 flex flex-col gap-3">
              <p className="text-sm font-600 text-blue-800 text-center">Enter Customer 4-Digit PIN</p>
              <div className="flex gap-2">
                <input type="text" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/, ''))} placeholder="1234" className="flex-1 px-3 py-2 text-center font-700 tracking-[0.5em] text-lg rounded-lg border border-blue-200 outline-none focus:border-blue-500 bg-white" />
                <button onClick={handleVerifyPin} className="px-5 py-2 bg-blue-600 active:bg-blue-700 text-white font-700 rounded-lg">Start Trip</button>
              </div>
            </div>
          ) : currentStep < steps.length - 1 && (
            <button
              onClick={() => setCurrentStep((p) => p + 1)}
              className="w-full mt-4 py-3 rounded-xl text-white font-700 text-sm"
              style={{ background: "#2563EB" }}
            >
              Mark Next Step →
            </button>
          )}
        </div>

        {/* Swipe to Complete */}
        <div
          ref={swipeRef}
          className="relative bg-white rounded-2xl h-16 overflow-hidden shadow-sm select-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{ touchAction: "none" }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-slate-400 font-600 text-sm">Swipe to Complete Delivery →</span>
          </div>
          <div
            className="absolute top-2 left-2 w-12 h-12 rounded-xl flex items-center justify-center transition-none"
            style={{ background: "#16A34A", transform: `translateX(${swipeX}px)`, cursor: "grab" }}
          >
            <CheckIcon size={22} />
          </div>
        </div>
      </div>
    </div>
  );
}

const orders = [
  { id: "ORD-20847", date: "Today", amount: "₹85.00", status: "delivered", rating: 5, customer: "Priya K.", time: "2:35 PM" },
  { id: "ORD-20831", date: "Today", amount: "₹62.00", status: "delivered", rating: 4, customer: "Ravi M.", time: "12:10 PM" },
  { id: "ORD-20818", date: "Today", amount: "₹94.50", status: "cancelled", rating: 0, customer: "Sunita P.", time: "10:05 AM" },
  { id: "ORD-20790", date: "Yesterday", amount: "₹78.00", status: "delivered", rating: 5, customer: "Amit D.", time: "6:42 PM" },
  { id: "ORD-20775", date: "Yesterday", amount: "₹55.00", status: "delivered", rating: 4, customer: "Kavya R.", time: "4:15 PM" },
  { id: "ORD-20741", date: "Yesterday", amount: "₹110.00", status: "delivered", rating: 5, customer: "Sanjay T.", time: "2:00 PM" },
  { id: "ORD-20699", date: "Aug 3", amount: "₹67.00", status: "delivered", rating: 3, customer: "Leela B.", time: "11:30 AM" },
];

function OrderHistoryScreen({ onNav }: { onNav: (s: Screen) => void }) {
  const grouped = orders.reduce<Record<string, typeof orders>>((acc, o) => {
    acc[o.date] = [...(acc[o.date] ?? []), o];
    return acc;
  }, {});

  return (
    <div className="w-full h-full flex flex-col" style={{ background: "#EEF3FB" }}>
      <div className="px-5 pt-16 pb-4" style={{ background: "#1A3564" }}>
        <h2 className="text-white font-700 text-xl">Order History</h2>
        <p className="text-white/60 text-sm mt-0.5">47 deliveries this week</p>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar px-5 py-4 pb-24 space-y-4">
        {Object.entries(grouped).map(([date, group]) => (
          <div key={date}>
            <p className="text-xs font-700 text-slate-500 uppercase tracking-wider mb-2">{date}</p>
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-100">
              {group.map((o) => (
                <div key={o.id} className="px-4 py-3.5 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full mt-0.5 flex-shrink-0 ${o.status === "delivered" ? "bg-green-500" : "bg-red-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-600 text-slate-500">{o.id}</span>
                      <span className="text-sm font-700 text-slate-800">{o.amount}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs text-slate-400">{o.customer} • {o.time}</span>
                      {o.rating > 0 ? (
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: o.rating }).map((_, i) => <StarIcon key={i} size={10} />)}
                        </div>
                      ) : (
                        <StatusBadge status="cancelled" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <BottomNav active="orders" onNav={onNav} />
    </div>
  );
}

const barData = [
  { day: "M", val: 620 }, { day: "T", val: 840 }, { day: "W", val: 510 },
  { day: "T", val: 920 }, { day: "F", val: 780 }, { day: "S", val: 1050 },
  { day: "S", val: 847 },
];
const maxBar = Math.max(...barData.map((b) => b.val));

function EarningsDashboard({ onNav }: { onNav: (s: Screen) => void }) {
  const [tab, setTab] = useState<"daily" | "monthly">("daily");
  const [cashoutStatus, setCashoutStatus] = useState<"idle" | "loading" | "success">("idle");

  const handleCashout = () => {
    setCashoutStatus("loading");
    setTimeout(() => setCashoutStatus("success"), 2000);
  };

  return (
    <div className="w-full h-full flex flex-col" style={{ background: "#EEF3FB" }}>
      <div className="px-5 pt-16 pb-5" style={{ background: "#1A3564" }}>
        <h2 className="text-white font-700 text-xl">Earnings & Wallet</h2>
        <div className="flex justify-between items-end mt-2">
          <div>
            <p className="text-3xl font-800 text-white">₹18,430</p>
            <p className="text-white/60 text-sm">Available Balance</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-700 text-green-400">₹24,500</p>
            <p className="text-white/60 text-xs">Total Net (Aug)</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar px-5 py-4 pb-24 space-y-4">
        
        {/* Wallet Details */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <p className="text-sm font-700 text-slate-700">Wallet Summary (Today)</p>
          {[
            { label: "Net Earnings", val: "₹1,240", color: "bg-blue-500" },
            { label: "Cash Collected (COD)", val: "-₹350", color: "bg-red-500" },
            { label: "Platform Fees", val: "-₹110", color: "bg-orange-500" },
          ].map((b) => (
            <div key={b.label} className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${b.color}`} />
              <span className="flex-1 text-sm text-slate-600">{b.label}</span>
              <span className="text-sm font-700 text-slate-800">{b.val}</span>
            </div>
          ))}
          <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
            <span className="font-700 text-slate-800">Added to Wallet</span>
            <span className="font-800 text-green-600">₹780</span>
          </div>
        </div>

        {/* Withdraw Button */}
        <button 
          onClick={cashoutStatus === "idle" ? handleCashout : undefined}
          className="w-full py-4 rounded-2xl font-700 text-base shadow-lg transition-all relative overflow-hidden text-white" 
          style={{ background: cashoutStatus === "success" ? "#16A34A" : "#2563EB" }}
        >
          {cashoutStatus === "idle" && "Instant Transfer to UPI →"}
          {cashoutStatus === "loading" && "Processing via Razorpay..."}
          {cashoutStatus === "success" && "✓ Transfer Successful"}
        </button>

        {/* Tab */}
        <div className="bg-white rounded-xl p-1 flex shadow-sm mt-2">
          {(["daily", "monthly"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-700 transition-colors ${tab === t ? "text-white" : "text-slate-400"}`}
              style={{ background: tab === t ? "#1A3564" : "transparent" }}
            >
              {t === "daily" ? "This Week" : "This Month"}
            </button>
          ))}
        </div>

        {/* Bar Chart */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-sm font-700 text-slate-700 mb-4">Earnings History</p>
          <div className="flex items-end gap-2 h-36">
            {barData.map((b, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] text-slate-400">₹{b.val >= 1000 ? (b.val / 1000).toFixed(1) + "k" : b.val}</span>
                <div className="w-full rounded-t-lg" style={{ height: `${(b.val / maxBar) * 100}%`, background: i === 6 ? "#2563EB" : "#EEF3FB" }} />
                <span className="text-[10px] text-slate-500 font-500">{b.day}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      <BottomNav active="earnings" onNav={onNav} />
    </div>
  );
}

const reviews = [
  { name: "Priya K.", rating: 5, comment: "Super fast delivery! Very polite.", date: "Today" },
  { name: "Ravi M.", rating: 4, comment: "Good delivery, slightly late.", date: "Today" },
  { name: "Amit D.", rating: 5, comment: "Excellent! Handled with care.", date: "Yesterday" },
  { name: "Kavya R.", rating: 4, comment: "Friendly and quick.", date: "Yesterday" },
  { name: "Sanjay T.", rating: 5, comment: "Best delivery experience ever!", date: "Yesterday" },
  { name: "Leela B.", rating: 3, comment: "Took longer than expected.", date: "Aug 3" },
];

function CustomerReviews({ onNav }: { onNav: (s: Screen) => void }) {
  const avg = (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1);
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: reviews.filter((r) => r.rating === n).length }));

  return (
    <div className="w-full h-full flex flex-col" style={{ background: "#EEF3FB" }}>
      <div className="px-5 pt-16 pb-5" style={{ background: "#1A3564" }}>
        <h2 className="text-white font-700 text-xl">Customer Reviews</h2>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar px-5 py-4 pb-24 space-y-4">
        {/* Summary */}
        <div className="bg-white rounded-2xl p-5 shadow-sm flex gap-5">
          <div className="flex flex-col items-center justify-center pr-5 border-r border-slate-100">
            <p className="text-5xl font-800 text-slate-800">{avg}</p>
            <div className="flex gap-0.5 my-1">{Array.from({ length: 5 }).map((_, i) => <StarIcon key={i} filled={i < Math.round(Number(avg))} size={14} />)}</div>
            <p className="text-xs text-slate-400">203 reviews</p>
          </div>
          <div className="flex-1 space-y-1.5">
            {dist.map((d) => (
              <div key={d.n} className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-2">{d.n}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-2">
                  <div className="bg-yellow-400 h-2 rounded-full" style={{ width: `${(d.count / reviews.length) * 100}%` }} />
                </div>
                <span className="text-xs text-slate-400 w-3">{d.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Badge */}
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: "#FFF7ED" }}>
          <span className="text-2xl">🏅</span>
          <div>
            <p className="text-orange-700 font-700 text-sm">Top Rated Partner</p>
            <p className="text-orange-500 text-xs">You're in the top 10% of OHO partners!</p>
          </div>
        </div>

        {/* Review list */}
        <div className="space-y-3">
          {reviews.map((r, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-blue-700 font-700 text-xs">{r.name[0]}</span>
                  </div>
                  <span className="text-sm font-700 text-slate-800">{r.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: r.rating }).map((_, j) => <StarIcon key={j} size={12} />)}
                </div>
              </div>
              <p className="text-sm text-slate-600">{r.comment}</p>
              <p className="text-xs text-slate-400 mt-1">{r.date}</p>
            </div>
          ))}
        </div>
      </div>

      <BottomNav active="profile" onNav={onNav} />
    </div>
  );
}

function ProfileScreen({ onNav }: { onNav: (s: Screen) => void }) {
  const docs = [
    { label: "Aadhaar Card", status: "verified" },
    { label: "Driving License", status: "verified" },
    { label: "Vehicle RC", status: "pending" },
    { label: "PAN Card", status: "verified" },
  ];

  return (
    <div className="w-full h-full flex flex-col" style={{ background: "#EEF3FB" }}>
      <div className="px-5 pt-16 pb-6" style={{ background: "#1A3564" }}>
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-blue-400 flex items-center justify-center">
              <span className="text-white font-800 text-xl">AS</span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-white" />
          </div>
          <div>
            <h2 className="text-white font-700 text-lg">Arjun Sharma</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="bg-blue-500 text-white text-[10px] font-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckIcon size={8} /> Verified Partner
              </span>
            </div>
            <p className="text-white/60 text-xs mt-1">+91 98765 43210</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar px-5 py-4 pb-24 space-y-4">
        {/* Vehicle */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-700 text-slate-700 mb-3">Vehicle Details</p>
          <div className="space-y-2.5">
            {[
              { label: "Type", value: "Two Wheeler" },
              { label: "Make & Model", value: "Honda Activa 6G" },
              { label: "Reg. Number", value: "OD-02-AB-1234" },
              { label: "Color", value: "Pearl White" },
            ].map((f) => (
              <div key={f.label} className="flex justify-between items-center py-1 border-b border-slate-50 last:border-0">
                <span className="text-xs text-slate-400">{f.label}</span>
                <span className="text-sm font-600 text-slate-800">{f.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* KYC / Documents */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-700 text-slate-700 mb-3">KYC Documents</p>
          <div className="space-y-2.5">
            {docs.map((d) => (
              <div key={d.label} className="flex items-center justify-between">
                <span className="text-sm text-slate-700">{d.label}</span>
                <StatusBadge status={d.status === "verified" ? "delivered" : "pending"} />
              </div>
            ))}
          </div>
        </div>

        {/* Settings & Preferences */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          <p className="text-sm font-700 text-slate-700">App & Audio Preferences</p>
          
          {/* Vernacular Language Selector */}
          <div>
            <label className="text-xs text-slate-400 font-500 block mb-1.5">Regional Audio Language</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { code: "en-IN", label: "English" },
                { code: "hi-IN", label: "हिंदी (Hindi)" },
                { code: "or-IN", label: "ଓଡ଼ିଆ (Odia)" },
              ].map((l) => (
                <button
                  key={l.code}
                  onClick={() => setVernacularLanguage(l.code)}
                  className={`py-2 px-1 rounded-xl text-xs font-700 border transition-all ${getVernacularLanguage() === l.code ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"}`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-600 text-slate-800">🎤 Voice Assistant (Hands-Free)</p>
              <p className="text-xs text-slate-400">Control rides using voice commands</p>
            </div>
            <span className="text-xs font-700 text-green-600 bg-green-50 px-2.5 py-1 rounded-full">Active</span>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={() => onNav("splash")}
          className="w-full py-4 rounded-2xl border-2 border-red-200 text-red-500 font-700 text-base"
        >
          Log Out
        </button>

        {/* Reviews shortcut */}
        <button
          onClick={() => onNav("reviews")}
          className="w-full py-4 rounded-2xl font-700 text-base text-white"
          style={{ background: "#2563EB" }}
        >
          View My Reviews →
        </button>
      </div>

      <BottomNav active="profile" onNav={onNav} />
    </div>
  );
}

function MapNavigationScreen({ onNav }: { onNav: (s: Screen) => void }) {
  const [showEV, setShowEV] = useState(false);
  const [showRest, setShowRest] = useState(false);
  
  const pickup: [number, number] = [20.3533, 85.8272];
  const drop: [number, number] = [20.3010, 85.8245];
  
  const evStation: [number, number] = [20.3300, 85.8200];
  const restStop: [number, number] = [20.3400, 85.8300];

  const [routingToEV, setRoutingToEV] = useState(false);

  const activeDrop = routingToEV ? evStation : drop;

  return (
    <div className="w-full h-full flex flex-col relative" style={{ background: "#EEF3FB" }}>
      <div className="absolute top-0 left-0 w-full px-5 pt-16 pb-12 z-[400] flex flex-col gap-3 bg-gradient-to-b from-slate-900/60 to-transparent pointer-events-none">
        <div className="flex justify-between items-start pointer-events-auto">
          <button onClick={() => onNav("active")} className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center shadow-sm">
            <BackIcon />
          </button>
          <div className="bg-white shadow-lg px-4 py-2 rounded-full">
            <span className="font-700 text-blue-700 text-sm">
              {routingToEV ? "Routing to EV Swap..." : "22 min • 5.8 km"}
            </span>
          </div>
        </div>
        <div className="flex gap-2 pointer-events-auto overflow-x-auto hide-scrollbar py-1">
          <button onClick={() => setShowEV(!showEV)} className={`px-3 py-1.5 rounded-full text-xs font-600 shadow-sm whitespace-nowrap transition-colors ${showEV ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}>
            ⚡ EV Swap
          </button>
          <button onClick={() => setShowRest(!showRest)} className={`px-3 py-1.5 rounded-full text-xs font-600 shadow-sm whitespace-nowrap transition-colors ${showRest ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}>
            ☕ Rest Stops
          </button>
        </div>
      </div>

      <div className="flex-1 w-full h-full">
        <MapContainer center={[20.327, 85.825]} zoom={13} style={{ height: "100%", width: "100%", zIndex: 0 }} zoomControl={false}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
          <Marker position={pickup}></Marker>
          <Marker position={activeDrop}></Marker>
          
          {showEV && <Marker position={evStation}></Marker>}
          {showRest && <Marker position={restStop}></Marker>}
          
          <Polyline positions={[pickup, activeDrop]} color="#2563EB" weight={5} opacity={0.8} />
        </MapContainer>
      </div>
      
      <div className="absolute bottom-0 left-0 w-full bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-[400] px-5 py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-800 text-slate-800 text-lg">
              {routingToEV ? "EV Station (Nayapalli)" : "Plot 45, Saheed Nagar"}
            </h3>
            <p className="text-slate-500 text-sm">{routingToEV ? "Battery Swap Station" : "Drop-off location"}</p>
          </div>
          <button className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
            <PhoneIcon />
          </button>
        </div>
        <div className="flex gap-3">
          {showEV && !routingToEV && (
            <button onClick={() => setRoutingToEV(true)} className="flex-1 py-4 rounded-xl font-700 text-sm text-blue-700 bg-blue-50 border border-blue-200 active:bg-blue-100 transition-colors">
              Route to EV
            </button>
          )}
          <button onClick={() => { setRoutingToEV(false); onNav("active"); }} className={`${showEV && !routingToEV ? 'flex-1' : 'w-full'} py-4 rounded-xl font-700 text-base text-white shadow-lg shadow-blue-200 active:scale-95 transition-transform`} style={{ background: "#2563EB" }}>
            Exit Nav
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    initSocket();
    emitDriverOnline(true);
    syncOfflineActions();

    const interval = setInterval(() => {
      emitDriverLocation(20.327, 85.825);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleVoiceCommand = () => {
    listenForCommand(
      {
        "accept": () => { speak("Accepting ride"); setScreen("active"); },
        "navigate": () => { speak("Starting navigation"); setScreen("map"); },
        "call": () => { speak("Calling rider"); },
        "complete": () => { speak("Delivery completed"); setScreen("orders"); },
        "home": () => { speak("Navigating home"); setScreen("home"); }
      },
      () => setIsListening(true),
      () => setIsListening(false)
    );
  };

  const screens: Record<Screen, JSX.Element> = {
    splash: <SplashScreen onNext={() => setScreen("login")} />,
    login: <LoginScreen onNext={() => setScreen("otp")} />,
    otp: <OTPScreen onNext={() => setScreen("home")} />,
    home: <HomeScreen onNav={setScreen} />,
    incoming: <IncomingOrderScreen onNav={setScreen} />,
    active: <ActiveDeliveryScreen onNav={setScreen} />,
    orders: <OrderHistoryScreen onNav={setScreen} />,
    earnings: <EarningsDashboard onNav={setScreen} />,
    reviews: <CustomerReviews onNav={setScreen} />,
    profile: <ProfileScreen onNav={setScreen} />,
    map: <MapNavigationScreen onNav={setScreen} />,
  };

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: "#EEF3FB" }}>
      {/* Voice Assistant Floating HUD */}
      {screen !== "splash" && screen !== "login" && screen !== "otp" && (
        <div className="absolute top-12 right-5 z-[500] flex items-center gap-2">
          <button
            onClick={handleVoiceCommand}
            className={`px-3 py-1.5 rounded-full text-xs font-700 shadow-md flex items-center gap-1.5 transition-all ${isListening ? "bg-red-500 text-white animate-pulse" : "bg-white text-slate-800 border border-slate-200"}`}
          >
            <span>🎤</span>
            <span>{isListening ? "Listening..." : "Voice Assist"}</span>
          </button>
        </div>
      )}

      {/* Screen Content */}
      <div className="w-full h-full">{screens[screen]}</div>
    </div>
  );
}
