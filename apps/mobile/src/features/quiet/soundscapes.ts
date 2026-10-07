export type Soundscape = {
  id:
    | "rain-window"
    | "night-forest"
    | "warm-fire"
    | "still-water"
    | "moon-garden";
  title: string;
  icon:
    | "rainy-outline"
    | "leaf-outline"
    | "flame-outline"
    | "water-outline"
    | "moon-outline";
  asset: null;
  loop: true;
  volume: number;
};

// Audio stays null until Mori has licensed or original production audio.
export const soundscapes: readonly Soundscape[] = [
  {
    id: "rain-window",
    title: "Cửa sổ ngày mưa",
    icon: "rainy-outline",
    asset: null,
    loop: true,
    volume: 0.45,
  },
  {
    id: "night-forest",
    title: "Rừng về đêm",
    icon: "leaf-outline",
    asset: null,
    loop: true,
    volume: 0.35,
  },
  {
    id: "warm-fire",
    title: "Góc lửa ấm",
    icon: "flame-outline",
    asset: null,
    loop: true,
    volume: 0.35,
  },
  {
    id: "still-water",
    title: "Bờ nước yên",
    icon: "water-outline",
    asset: null,
    loop: true,
    volume: 0.4,
  },
  {
    id: "moon-garden",
    title: "Khu vườn dưới trăng",
    icon: "moon-outline",
    asset: null,
    loop: true,
    volume: 0.3,
  },
];

export const quietTimerOptions = [0, 120, 300, 600] as const;
export const nextQuietTimer = (remaining: number) => Math.max(0, remaining - 1);
export function formatQuietTimer(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
