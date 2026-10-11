import { auth } from "@/lib/auth/auth";
import { unauthenticated } from "@/lib/api/errors";

export type SessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
};

export async function requireSession(): Promise<SessionUser> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    throw unauthenticated();
  }

  return {
    id: userId,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
  };
}
