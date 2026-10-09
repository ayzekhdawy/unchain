import type { Metadata } from "next";
import { UnchainApp } from "@/components/UnchainApp";

export const metadata: Metadata = {
  title: "Okuyucu — Unchain"
};

export default function AppPage() {
  return <UnchainApp />;
}
