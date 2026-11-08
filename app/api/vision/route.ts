import { NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { z } from "zod";
import { model } from "@/lib/ai/provider";

export const runtime = "nodejs";

const Out = z.object({
  item: z.string().describe("What the photo shows, as a short product name"),
  details: z.array(z.string()).max(5).describe("Visible attributes worth matching (brand, size, colour, model)"),
  suggested_mission: z
    .string()
    .describe("ONE sentence the user could send as a purchasing mission, e.g. 'Find this desk lamp (black, LED, gooseneck) for under $60, ask me above $40.' Use a placeholder budget if none is known."),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

/**
 * Photo → suggested mission. The model only SUGGESTS text; the human edits it and still compiles,
 * reviews the clauses, and signs. Nothing is bought from a photo directly.
 */
export async function POST(req: Request) {
  const { image } = z.object({ image: z.string().startsWith("data:image/").max(6_000_000) }).parse(await req.json());
  try {
    const { output } = await generateText({
      model: model(),
      output: Output.object({ schema: Out }),
      temperature: 0,
      maxRetries: 1,
      maxOutputTokens: 2500,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Identify the product in this photo so an AI purchasing agent can find it. Return the item, key visible details, and a one-sentence purchasing mission with a sensible budget and approval line." },
            { type: "image", image },
          ],
        },
      ],
    });
    return NextResponse.json(output);
  } catch (err) {
    console.error("[vision]", err);
    return NextResponse.json({ error: "Couldn't read that photo — try a clearer picture, or type the mission." }, { status: 422 });
  }
}
