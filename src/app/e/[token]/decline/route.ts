import { publicEstimateReply } from "@/server/api/public-reply";

export async function POST(request: Request, { params }: RouteContext<"/e/[token]/decline">) {
  const { token } = await params;
  return publicEstimateReply(request, token, "decline");
}
