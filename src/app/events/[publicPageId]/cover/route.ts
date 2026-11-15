import { getPublicCover } from "@/modules/public-event/service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicPageId: string }> },
) {
  const { publicPageId } = await params;
  const cover = await getPublicCover(publicPageId);
  if (!cover)
    return new Response("Not found", {
      status: 404,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  return new Response(cover.stream(), {
    headers: {
      "Content-Type": cover.type,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
