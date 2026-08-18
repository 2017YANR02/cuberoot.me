"use server";

import { redirect } from "next/navigation";

const MAIN_SITE_ALGORITHMS_ONLY = "main_site_algorithms_only";

function stopLegacyAlgorithmWrite(): never {
  redirect(`/admin/algorithms?notice=${MAIN_SITE_ALGORITHMS_ONLY}`);
}

export async function saveAlgorithm(formData: FormData): Promise<void> {
  void formData;
  stopLegacyAlgorithmWrite();
}

export async function removeAlgorithm(formData: FormData): Promise<void> {
  void formData;
  stopLegacyAlgorithmWrite();
}

export async function reorderAlgorithm(formData: FormData): Promise<void> {
  void formData;
  stopLegacyAlgorithmWrite();
}
