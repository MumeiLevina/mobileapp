import { useState } from "react";
import { router } from "expo-router";
import { z } from "zod";
import {
  MoriButton,
  MoriText,
  MoriInput,
  ScreenContainer,
  ErrorNote,
} from "../components/ui";
import { GardenScene } from "../features/garden/GardenScene";
import { supabase } from "../services/auth";
export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function submit() {
    setError("");
    if (!z.string().email().safeParse(email).success || password.length < 8) {
      setError("Hãy nhập email hợp lệ và mật khẩu ít nhất 8 ký tự.");
      return;
    }
    if (!supabase) {
      setError(
        "Chưa cấu hình kết nối Supabase. Vui lòng thiết lập môi trường ứng dụng.",
      );
      return;
    }
    setBusy(true);
    try {
      const { data, error: authError } = signup
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      if (data.session) router.replace("/");
      else
        setNotice(
          "Hãy kiểm tra email để xác nhận tài khoản, rồi quay lại đăng nhập.",
        );
    } catch {
      setError("Chưa đăng nhập được. Hãy kiểm tra thông tin và thử lại.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScreenContainer>
      <GardenScene />
      <MoriText variant="title">Một khoảng riêng cho bạn.</MoriText>
      <MoriText muted>
        {signup
          ? "Tạo tài khoản để bắt đầu."
          : "Đăng nhập để trở về khu vườn của mình."}
      </MoriText>
      <MoriInput
        accessibilityLabel="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
      />
      <MoriInput
        accessibilityLabel="Mật khẩu"
        secureTextEntry
        autoComplete={signup ? "new-password" : "current-password"}
        placeholder="Mật khẩu"
        value={password}
        onChangeText={setPassword}
      />
      <ErrorNote error={error} />
      {!!notice && <MoriText>{notice}</MoriText>}
      <MoriButton loading={busy} onPress={() => void submit()}>
        {signup ? "Tạo tài khoản" : "Đăng nhập"}
      </MoriButton>
      <MoriButton secondary onPress={() => setSignup(!signup)}>
        {signup ? "Mình đã có tài khoản" : "Tạo một tài khoản mới"}
      </MoriButton>
    </ScreenContainer>
  );
}
