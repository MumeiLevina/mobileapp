export const firstAidActions = [
  {
    id: "slow",
    label: "Giúp mình chậm lại",
    icon: "leaf-outline",
    route: "/activity/breathing",
  },
  {
    id: "ground",
    label: "Giúp mình quay về hiện tại",
    icon: "footsteps-outline",
    route: "/first-aid/grounding",
  },
  {
    id: "talk",
    label: "Mình muốn nói",
    icon: "chatbubble-ellipses-outline",
    route: "/(tabs)/talk",
  },
  {
    id: "quiet",
    label: "Mình chỉ muốn ngồi yên",
    icon: "rainy-outline",
    route: "/quiet-room",
  },
  {
    id: "connect",
    label: "Mình muốn tìm một người để liên hệ",
    icon: "people-outline",
    route: "/first-aid/connection",
  },
  {
    id: "danger",
    label: "Mình có thể đang gặp nguy hiểm",
    icon: "alert-circle-outline",
    route: "/first-aid/danger",
  },
] as const;

export const groundingSteps = [
  "5 điều bạn có thể nhìn thấy",
  "4 điều bạn có thể cảm nhận",
  "3 điều bạn có thể nghe thấy",
  "2 điều bạn có thể ngửi thấy",
  "1 hơi thở chậm",
] as const;
