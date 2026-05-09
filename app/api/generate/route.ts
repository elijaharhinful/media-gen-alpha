export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MULTIPLIER_SYSTEM_PROMPT } from "@/lib/multiplier-system-prompt";
import { canUserUseTool, recordCreditUsage } from "@/lib/credits";
import { withRequestLog } from "@/lib/with-request-log";

export async function _POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new Response(
        JSON.stringify({ status: "error", message: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    // Check credits
    const creditCheck = await canUserUseTool(
      session.user.id,
      "PROMPT_MULTIPLIER",
    );
    if (!creditCheck.allowed) {
      return new Response(
        JSON.stringify({ status: "error", message: creditCheck.reason }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    const body = await request.json();
    const sceneDescription = body?.sceneDescription ?? "";

    if (!sceneDescription?.trim?.()) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: "Scene description is required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: "OpenRouter API key not configured",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const model = process.env.OPENROUTER_MULTIPLIER_MODEL ?? "openai/gpt-4.1";

    const messages = [
      { role: "system", content: MULTIPLIER_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Transform this weak scene description into a fully optimized video prompt using the Multiplier framework:\n\n"${sceneDescription}"\n\nApply all 5 steps (Extract, Select, Map, Amplify, Guard) and return the complete enhanced prompt with transformation analysis.`,
      },
    ];

    // Call OpenRouter API with streaming and JSON response
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://movie-gen-alpha.app",
          "X-OpenRouter-Title": "Movie Gen Alpha - Multiplier",
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          max_tokens: 1500,
          temperature: 0.7,
          response_format: { type: "json_object" },
        }),
      },
    );

    if (!response?.ok) {
      const errText = (await response?.text?.()) ?? "Unknown error";
      return new Response(
        JSON.stringify({
          status: "error",
          message: `LLM API error: ${errText}`,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const reader = response?.body?.getReader();
    if (!reader) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: "Failed to read LLM stream",
        }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = "";
        let partialRead = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            partialRead += decoder.decode(value, { stream: true });
            const lines = partialRead.split("\n");
            partialRead = lines.pop() ?? "";

            for (const line of lines) {
              if (line?.startsWith?.("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") {
                  // Parse the complete JSON buffer
                  let finalResult: any;
                  try {
                    finalResult = JSON.parse(buffer);
                  } catch {
                    // If JSON parse fails, wrap raw text
                    finalResult = {
                      enhanced_prompt: buffer,
                      analysis: {
                        extraction: {
                          who: "N/A",
                          what: "N/A",
                          where: "N/A",
                          light: "N/A",
                          feel: "N/A",
                          arc: "N/A",
                          length: "15s / 6 beats",
                        },
                        architecture_chosen: "A: Director Tool",
                        architecture_reason: "Default selection",
                        enhancements_applied: [
                          "Full multiplier framework applied",
                        ],
                        camera_strategy: "Multi-focal approach",
                        color_approach: "Cinematic",
                        quality_tier: "High",
                      },
                    };
                  }

                  // Save to database
                  try {
                    const saved = await prisma.generatedPrompt.create({
                      data: {
                        originalInput: sceneDescription,
                        enhancedOutput: finalResult?.enhanced_prompt ?? buffer,
                        transformationAnalysis: JSON.stringify(
                          finalResult?.analysis ?? {},
                        ),
                        architectureChosen:
                          finalResult?.analysis?.architecture_chosen ??
                          "Unknown",
                        userId: session.user.id,
                      },
                    });
                    await recordCreditUsage(
                      session.user.id,
                      "PROMPT_MULTIPLIER",
                      {
                        promptId: saved.id,
                        input: sceneDescription.substring(0, 100),
                      },
                    );
                  } catch (dbErr: any) {
                    console.error("DB save error:", dbErr);
                  }

                  const finalData = JSON.stringify({
                    status: "completed",
                    result: finalResult,
                  });
                  controller.enqueue(encoder.encode(`data: ${finalData}\n\n`));
                  controller.close();
                  return;
                }

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed?.choices?.[0]?.delta?.content ?? "";
                  buffer += content;

                  const progressData = JSON.stringify({
                    status: "processing",
                    message: "Applying Multiplier framework...",
                    partial: buffer.length,
                  });
                  controller.enqueue(
                    encoder.encode(`data: ${progressData}\n\n`),
                  );
                } catch {
                  // Skip invalid JSON chunks
                }
              }
            }
          }

          // If stream ends without [DONE], try to parse buffer
          if (buffer?.length > 0) {
            let finalResult: any;
            try {
              finalResult = JSON.parse(buffer);
            } catch {
              finalResult = { enhanced_prompt: buffer, analysis: {} };
            }

            try {
              const saved = await prisma.generatedPrompt.create({
                data: {
                  originalInput: sceneDescription,
                  enhancedOutput: finalResult?.enhanced_prompt ?? buffer,
                  transformationAnalysis: JSON.stringify(
                    finalResult?.analysis ?? {},
                  ),
                  architectureChosen:
                    finalResult?.analysis?.architecture_chosen ?? "Unknown",
                  userId: session.user.id,
                },
              });
              await recordCreditUsage(session.user.id, "PROMPT_MULTIPLIER", {
                promptId: saved.id,
                input: sceneDescription.substring(0, 100),
              });
            } catch (dbErr: any) {
              console.error("DB save error:", dbErr);
            }

            const finalData = JSON.stringify({
              status: "completed",
              result: finalResult,
            });
            controller.enqueue(encoder.encode(`data: ${finalData}\n\n`));
          }
        } catch (error: any) {
          console.error("Stream error:", error);
          const errData = JSON.stringify({
            status: "error",
            message: error?.message ?? "Stream processing failed",
          });
          controller.enqueue(encoder.encode(`data: ${errData}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Generate API error:", error);
    return new Response(
      JSON.stringify({
        status: "error",
        message: error?.message ?? "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

export const POST = withRequestLog(_POST);

