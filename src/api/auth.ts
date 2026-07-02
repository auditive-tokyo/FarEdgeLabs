import { fetchAuthSession } from "aws-amplify/auth";

export const getIdToken = async (): Promise<string | null> => {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() ?? null;
  } catch {
    return null;
  }
};

export const requireAuthHeaders = async (): Promise<HeadersInit> => {
  const token = await getIdToken();
  if (!token) throw new Error("Not authenticated");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};
