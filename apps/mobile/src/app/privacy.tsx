import { useState } from "react";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { AccountDataExport } from "@mori/shared";
import {
  ErrorNote,
  MoriButton,
  MoriCard,
  MoriConfirmSheet,
  MoriNotice,
  MoriText,
  ScreenContainer,
} from "../components/ui";
import { request, refresh } from "../services/api";
import { saveAccountExport } from "../services/data-export";
import { deleteAccountAndLocalData } from "../services/account-deletion";
import { useSession } from "../store/session";
import { config } from "../lib/config";

type DestructiveAction = "conversations" | "journals" | "memories" | "account";

const actionCopy: Record<
  DestructiveAction,
  { title: string; detail: string; confirm: string }
> = {
  conversations: {
    title: "Xóa tất cả cuộc trò chuyện?",
    detail: "Toàn bộ cuộc trò chuyện và tin nhắn sẽ bị xóa vĩnh viễn.",
    confirm: "Xóa tất cả cuộc trò chuyện",
  },
  journals: {
    title: "Xóa tất cả nhật ký?",
    detail: "Toàn bộ trang viết đã lưu sẽ bị xóa vĩnh viễn.",
    confirm: "Xóa tất cả nhật ký",
  },
  memories: {
    title: "Xóa tất cả ký ức của Mori?",
    detail: "Mori sẽ không dùng những ký ức này trong các cuộc trò chuyện sau.",
    confirm: "Xóa tất cả ký ức của Mori",
  },
  account: {
    title: "Xóa tài khoản và toàn bộ dữ liệu?",
    detail:
      "Nhật ký, trò chuyện, ký ức, cảm xúc, khu vườn và tài khoản sẽ bị xóa. Không thể hoàn tác.",
    confirm: "Xóa tài khoản và dữ liệu",
  },
};

export default function PrivacyCenter() {
  const user = useSession((state) => state.userId);
  const [confirming, setConfirming] = useState<DestructiveAction | null>(null);
  const [notice, setNotice] = useState("");

  const exportData = useMutation({
    mutationFn: async () => {
      const accountExport = await request<AccountDataExport>(
        "/account/export",
        "POST",
      );
      await saveAccountExport(accountExport);
    },
    onSuccess: () => setNotice("Bản xuất dữ liệu đã sẵn sàng."),
  });

  const remove = useMutation({
    mutationFn: async (action: DestructiveAction) => {
      if (action === "account") {
        await deleteAccountAndLocalData(user ?? "demo");
        return action;
      }
      await request(`/${action}`, "DELETE");
      return action;
    },
    onSuccess: (action) => {
      setConfirming(null);
      if (action === "account") {
        router.replace(config.demo ? "/" : "/auth");
        return;
      }
      setNotice("Dữ liệu đã được xóa theo yêu cầu của bạn.");
      void refresh();
    },
  });

  return (
    <ScreenContainer back>
      <MoriText variant="title">Dữ liệu của bạn</MoriText>
      <MoriText muted>
        Bạn có thể lấy một bản sao hoặc xóa từng nhóm dữ liệu. Không lựa chọn
        nào được bật sẵn.
      </MoriText>
      <ErrorNote error={exportData.error ?? remove.error} />
      {!!notice && <MoriNotice>{notice}</MoriNotice>}

      <MoriCard>
        <MoriText variant="subtitle">Lấy bản sao</MoriText>
        <MoriText muted variant="small">
          Tạo tệp JSON chứa dữ liệu tài khoản của bạn. Nội dung safety nội bộ và
          embedding không được đưa vào bản xuất.
        </MoriText>
        <MoriButton
          loading={exportData.isPending}
          loadingLabel="Đang chuẩn bị bản xuất…"
          onPress={() => exportData.mutate()}
        >
          Xuất dữ liệu của tôi
        </MoriButton>
      </MoriCard>

      <MoriCard>
        <MoriText variant="subtitle">Quản lý và xóa dữ liệu</MoriText>
        <MoriButton secondary onPress={() => router.push("/memories")}>
          Quản lý ký ức của Mori
        </MoriButton>
        <MoriButton
          variant="dangerGhost"
          disabled={remove.isPending}
          onPress={() => setConfirming("conversations")}
        >
          Xóa tất cả cuộc trò chuyện
        </MoriButton>
        <MoriButton
          variant="dangerGhost"
          disabled={remove.isPending}
          onPress={() => setConfirming("journals")}
        >
          Xóa tất cả nhật ký
        </MoriButton>
        <MoriButton
          variant="dangerGhost"
          disabled={remove.isPending}
          onPress={() => setConfirming("memories")}
        >
          Xóa tất cả ký ức của Mori
        </MoriButton>
        <MoriButton
          variant="dangerGhost"
          disabled={remove.isPending}
          onPress={() => setConfirming("account")}
        >
          {config.demo
            ? "Xóa dữ liệu demo và bắt đầu lại"
            : "Xóa tài khoản và toàn bộ dữ liệu"}
        </MoriButton>
      </MoriCard>

      <MoriConfirmSheet
        visible={confirming !== null}
        title={confirming ? actionCopy[confirming].title : ""}
        description={confirming ? actionCopy[confirming].detail : ""}
        confirmLabel={confirming ? actionCopy[confirming].confirm : ""}
        loadingLabel="Đang xóa dữ liệu…"
        cancelLabel="Giữ lại dữ liệu"
        loading={remove.isPending}
        error={remove.error}
        onConfirm={() => confirming && remove.mutate(confirming)}
        onCancel={() => setConfirming(null)}
      />
    </ScreenContainer>
  );
}
