import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { CompanionStyle } from "@mori/shared";
import {
  MoriButton,
  MoriText,
  MoriInput,
  ScreenContainer,
  Choice,
  ErrorNote,
  styles,
} from "../components/ui";
import { GardenScene } from "../features/garden/GardenScene";
import { MoodPicker } from "../features/mood/MoodPicker";
import { request, refresh } from "../services/api";
import { useT } from "../i18n";
import { usePreferences } from "../store/preferences";
import { OnboardingScaffold } from "../components/OnboardingScaffold";
const goals = [
  "Một nơi để tâm sự",
  "Nhẹ bớt căng thẳng",
  "Hiểu cảm xúc của mình",
  "Chăm sóc bản thân tốt hơn",
  "Viết ra những suy nghĩ",
  "Mình chưa biết nữa",
];
export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [style, setStyle] = useState<CompanionStyle>("gentle");
  const copy = useT();
  const locale = usePreferences((s) => s.locale);
  const save = useMutation({
    mutationFn: () =>
      request("/auth/profile", "POST", {
        display_name: name.trim() || "Bạn",
        goals: selected,
        companion_style: style,
        locale,
        onboarded: true,
        weekly_reflection_enabled: false,
      }),
    onSuccess: async () => {
      await refresh();
      setStep(6);
    },
  });
  if (step === 0) {
    return (
      <ScreenContainer>
        <>
          <MoriText
            style={{ textAlign: "center", letterSpacing: 6, marginTop: 22 }}
          >
            MORI
          </MoriText>
          <GardenScene large />
          <MoriText
            variant="hero"
            style={{ textAlign: "center", marginTop: 10 }}
          >
            {copy.welcomeTitle}
          </MoriText>
          <MoriText muted style={{ textAlign: "center", marginBottom: 18 }}>
            {copy.welcomeBody}
          </MoriText>
          <MoriButton onPress={() => setStep(1)}>{copy.begin}</MoriButton>
        </>
      </ScreenContainer>
    );
  }

  const footer =
    step === 1 ? (
      <MoriButton onPress={() => setStep(2)}>{copy.continue}</MoriButton>
    ) : step === 2 ? (
      <MoriButton onPress={() => setStep(3)}>{copy.continue}</MoriButton>
    ) : step === 3 ? (
      <MoriButton onPress={() => setStep(4)}>Mình đã hiểu</MoriButton>
    ) : step === 4 ? (
      <MoriButton onPress={() => setStep(5)}>
        Tiếp tục với lựa chọn của mình
      </MoriButton>
    ) : step === 5 ? (
      <MoriButton
        loading={save.isPending}
        loadingLabel="Đang chuẩn bị khu vườn…"
        onPress={() => save.mutate()}
      >
        Để sau, vào khu vườn
      </MoriButton>
    ) : undefined;

  return (
    <OnboardingScaffold
      step={step}
      totalSteps={6}
      onBack={() => setStep((current) => Math.max(0, current - 1))}
      footer={footer}
    >
      {step === 1 ? (
        <>
          <MoriText muted variant="small">
            BẮT ĐẦU TỪ BẠN
          </MoriText>
          <MoriText variant="title">Bạn muốn Mori ở đây để làm gì?</MoriText>
          <MoriText muted>
            Bạn có thể chọn nhiều điều, hoặc chưa cần biết câu trả lời.
          </MoriText>
          {goals.map((goal) => (
            <Choice
              key={goal}
              title={goal}
              selected={selected.includes(goal)}
              onPress={() =>
                setSelected(
                  selected.includes(goal)
                    ? selected.filter((g) => g !== goal)
                    : [...selected, goal],
                )
              }
            />
          ))}
          <MoriInput
            accessibilityLabel="Tên của bạn, không bắt buộc"
            placeholder="Mori có thể gọi bạn là… (không bắt buộc)"
            value={name}
            onChangeText={setName}
            maxLength={60}
          />
        </>
      ) : step === 2 ? (
        <>
          <MoriText variant="title">Một giọng nói hợp với bạn.</MoriText>
          <MoriText muted>Bạn luôn có thể thay đổi sau này.</MoriText>
          {(
            [
              {
                id: "gentle",
                title: "Dịu dàng",
                subtitle: "Ấm áp, nhẹ nhàng và có chiều sâu.",
              },
              {
                id: "close_friend",
                title: "Gần gũi",
                subtitle: "Tự nhiên, thân thiện như một cuộc trò chuyện.",
              },
              {
                id: "calm",
                title: "Tĩnh lặng",
                subtitle: "Ít lời hơn. Nhiều khoảng nghỉ hơn.",
              },
            ] as const
          ).map((s) => (
            <Choice
              key={s.id}
              title={s.title}
              subtitle={s.subtitle}
              selected={style === s.id}
              onPress={() => setStyle(s.id)}
            />
          ))}
        </>
      ) : step === 3 ? (
        <>
          <GardenScene />
          <MoriText variant="title">
            Một người bạn đồng hành AI, với những giới hạn rõ ràng.
          </MoriText>
          <MoriText>
            Mori có thể lắng nghe, giúp bạn suy ngẫm và gợi ý những cách chăm
            sóc bản thân đơn giản.
          </MoriText>
          <MoriText muted>
            Mori không phải bác sĩ hay nhà trị liệu, không chẩn đoán và không
            thay thế sự hỗ trợ từ con người. AI có thể hiểu sai hoặc trả lời
            chưa phù hợp.
          </MoriText>
          <MoriText muted>
            Nếu bạn đang gặp nguy hiểm ngay lúc này, hãy liên hệ dịch vụ cấp cứu
            tại nơi bạn sống hoặc một người bạn tin tưởng.
          </MoriText>
        </>
      ) : step === 4 ? (
        <>
          <MoriText variant="title">Khoảng riêng của bạn.</MoriText>
          <MoriText>
            Cuộc trò chuyện và nhật ký là dữ liệu riêng tư. Mori chỉ dùng ký ức
            lâu dài sau khi bạn chọn cho phép ghi nhớ.
          </MoriText>
          <MoriText muted>
            Bạn có thể xem, sửa, xóa ký ức, nhật ký, cuộc trò chuyện hoặc tài
            khoản. Nội dung trò chuyện được gửi đến dịch vụ AI khi bạn sử dụng
            chế độ kết nối thật.
          </MoriText>
          <MoriText muted>
            Bản nháp nằm trên thiết bị. Trên trình duyệt, chúng nằm trong bộ nhớ
            của trình duyệt này; tránh thiết bị dùng chung. Bản demo chỉ dành
            cho dữ liệu thử.
          </MoriText>
        </>
      ) : step === 5 ? (
        <>
          <MoriText variant="title">Một lời nhắc, nếu bạn muốn.</MoriText>
          <MoriText muted>
            Lời nhắc đang tắt. Bạn có thể bật và chọn giờ ở phần cài đặt bất cứ
            lúc nào. Mori không buồn hay cô đơn khi bạn vắng mặt.
          </MoriText>
          <ErrorNote error={save.error} />
        </>
      ) : (
        <View style={styles.stack}>
          <MoriText variant="title">Trước khi bắt đầu…</MoriText>
          <MoriText muted>{copy.heart}</MoriText>
          <MoodPicker onComplete={() => router.replace("/(tabs)")} />
          <MoriButton secondary onPress={() => router.replace("/(tabs)")}>
            Mình muốn khám phá trước
          </MoriButton>
        </View>
      )}
    </OnboardingScaffold>
  );
}
