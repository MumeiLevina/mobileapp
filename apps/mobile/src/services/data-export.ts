import { Platform, Share } from "react-native";
import { AccountDataExport } from "@mori/shared";

export async function saveAccountExport(
  accountExport: AccountDataExport,
): Promise<void> {
  const json = JSON.stringify(accountExport, null, 2);
  const filename = `mori-data-${accountExport.generatedAt.slice(0, 10)}.json`;

  if (Platform.OS === "web") {
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }

  await Share.share({
    title: filename,
    message: json,
  });
}
