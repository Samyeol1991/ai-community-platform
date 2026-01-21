import OpenAI from "openai";
import pRetry, { AbortError } from "p-retry";
import { storage } from "./storage";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const GPT_51_MODEL = "gpt-5.1-2025-11-13";

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4o-mini-2024-07-18": { input: 0.00015, output: 0.0006 },
  "gpt-4o-mini-2024-08-06": { input: 0.00015, output: 0.0006 },
  "gpt-5.1-2025-11-13": { input: 0.0011, output: 0.0044 },
  "o4-mini-2025-04-16": { input: 0.0011, output: 0.0044 },
};

function getPricingForModel(model: string): { input: number; output: number } {
  if (MODEL_PRICING[model]) return MODEL_PRICING[model];
  if (model.includes("gpt-4o-mini")) return MODEL_PRICING["gpt-4o-mini"];
  if (model.includes("gpt-5.1") || model.includes("o4-mini")) return MODEL_PRICING["gpt-5.1-2025-11-13"];
  console.warn(`[API Usage] Unknown model pricing: ${model}, using default rates`);
  return MODEL_PRICING["gpt-4o-mini"];
}

async function logApiUsage(
  model: string,
  functionName: string,
  promptTokens: number,
  completionTokens: number
): Promise<void> {
  try {
    const pricing = getPricingForModel(model);
    const inputCost = (promptTokens / 1000) * pricing.input;
    const outputCost = (completionTokens / 1000) * pricing.output;
    const totalCost = inputCost + outputCost;
    
    await storage.createApiUsageLog({
      model,
      functionName,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      inputCost: inputCost.toFixed(8),
      outputCost: outputCost.toFixed(8),
      totalCost: totalCost.toFixed(8),
    });
    
    console.log(`[API Usage] ${functionName}: ${model} - ${promptTokens + completionTokens} tokens, $${totalCost.toFixed(6)}`);
  } catch (error) {
    console.error("[API Usage] Failed to log usage:", error);
  }
}

export async function testGPT51() {
  try {
    const response = await openai.responses.create({
      model: GPT_51_MODEL,
      input: "간단한 테스트입니다. '성공'이라고만 답해주세요.",
      text: {
        verbosity: "low"
      },
      reasoning: {
        effort: "low"
      }
    });
    
    return {
      success: true,
      output: response.output_text,
      usage: response.usage
    };
  } catch (error: any) {
    console.error("GPT-5.1 test error:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

function isRateLimitError(error: any): boolean {
  const errorMsg = error?.message || String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("RATELIMIT_EXCEEDED") ||
    errorMsg.toLowerCase().includes("quota") ||
    errorMsg.toLowerCase().includes("rate limit")
  );
}

interface PostAnalysisResult {
  shouldComment: boolean;
  reason: string;
  comment?: string;
}

interface CommentAnalysisResult {
  shouldReply: boolean;
  reason: string;
  reply?: string;
}

interface CommentInterventionAnalysis {
  needsIntervention: boolean;
  actionLevel: "none" | "positive_feedback" | "information_response" | "defender";
  contentType: "informational" | "needs_feedback" | "needs_support" | "conflict";
  reason: string;
}

export async function analyzePostWithGPT4oMini(
  title: string,
  content: string,
  category: string
): Promise<{ shouldComment: boolean; reason: string }> {
  const prompt = `다음 게시글을 분석하여 AI 봇이 자동으로 댓글을 달만한 가치가 있는지 판단해주세요.

카테고리: ${category}
제목: ${title}
내용: ${content}

판단 기준:
1. 이 게시글이 다른 사용자들이 계속 작성할만한 가치가 있는 주제인가?
2. 작성자에게 동기부여가 필요한 내용인가?
3. AI 커뮤니티 활성화에 도움이 될 만한 내용인가?

응답은 반드시 다음 JSON 형식으로만 작성해주세요:
{
  "shouldComment": true 또는 false,
  "reason": "판단 이유를 간단히 설명"
}`;

  try {
    const apiResult = await pRetry(
      async () => {
        try {
          const result = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "당신은 AI 커뮤니티를 활성화시키는 친절한 분석가입니다. 게시글의 댓글 작성 가치를 판단합니다. 응답은 항상 JSON 형식으로 작성해주세요."
              },
              { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.5,
            store: true,
          });
          return result;
        } catch (error: any) {
          if (isRateLimitError(error)) {
            throw error;
          }
          throw new AbortError(error);
        }
      },
      {
        retries: 3,
        minTimeout: 2000,
        maxTimeout: 10000,
        factor: 2,
      }
    );

    if (apiResult.usage) {
      await logApiUsage("gpt-4o-mini", "analyzePostWithGPT4oMini", apiResult.usage.prompt_tokens, apiResult.usage.completion_tokens);
    }

    const response = apiResult.choices[0]?.message?.content || "";
    const parsed = JSON.parse(response);
    return {
      shouldComment: parsed.shouldComment || false,
      reason: parsed.reason || "분석 실패"
    };
  } catch (error) {
    console.error("Post analysis (GPT-4o-mini) error:", error);
    return {
      shouldComment: false,
      reason: "분석 중 오류 발생"
    };
  }
}

export async function generateCommentWithGPT51(
  title: string,
  content: string,
  category: string,
  analysisReason: string,
  authorPersona?: string
): Promise<string | null> {
  const personaInstruction = authorPersona 
    ? `\n\n당신의 성향/역할: ${authorPersona}\n위 성향에 맞게 댓글의 어조와 스타일을 조정해주세요.` 
    : '';
    
  const inputText = `AI 커뮤니티에 다음과 같은 게시글이 작성되었습니다:

카테고리: ${category}
제목: ${title}
내용: ${content}

분석 결과: ${analysisReason}${personaInstruction}

작성자에게 동기부여가 되고 커뮤니티를 활성화할 수 있는 댓글을 150자 이내로 작성해주세요. 
구체적인 내용에 대해 호응하거나 질문을 던지는 등 작성자가 다시 답변하고 싶게 만들어주세요.`;

  try {
    const apiResult = await pRetry(
      async () => {
        try {
          const result = await openai.responses.create({
            model: GPT_51_MODEL,
            input: inputText,
            text: {
              verbosity: "low"
            },
            reasoning: {
              effort: "low"
            }
          });
          return result;
        } catch (error: any) {
          if (isRateLimitError(error)) {
            throw error;
          }
          throw new AbortError(error);
        }
      },
      {
        retries: 3,
        minTimeout: 2000,
        maxTimeout: 10000,
        factor: 2,
      }
    );

    if (apiResult.usage) {
      await logApiUsage(GPT_51_MODEL, "generateCommentWithGPT51", apiResult.usage.input_tokens || 0, apiResult.usage.output_tokens || 0);
    }

    return apiResult.output_text?.trim() || null;
  } catch (error) {
    console.error("Comment generation (GPT-5.1) error:", error);
    return null;
  }
}

export async function analyzePost(
  title: string,
  content: string,
  category: string,
  authorPersona?: string
): Promise<PostAnalysisResult> {
  const analysis = await analyzePostWithGPT4oMini(title, content, category);
  
  if (!analysis.shouldComment) {
    return {
      shouldComment: false,
      reason: analysis.reason
    };
  }

  const comment = await generateCommentWithGPT51(title, content, category, analysis.reason, authorPersona);
  
  return {
    shouldComment: true,
    reason: analysis.reason,
    comment: comment || undefined
  };
}

interface ReplyNeedAnalysis {
  needsReply: boolean;
  purpose: "protect_author" | "improve_community" | "none";
  reason: string;
}

export async function analyzeReplyNeed(
  postTitle: string,
  postContent: string,
  commentContent: string,
  commentAuthor: string,
  toxicityScore: number
): Promise<ReplyNeedAnalysis> {
  const prompt = `다음 댓글에 대해 AI가 답글을 달아야 할 필요성을 분석해주세요.

게시글 제목: ${postTitle}
게시글 내용: ${postContent}
댓글 내용: ${commentContent}
댓글 작성자: ${commentAuthor}
유해성 점수: ${(toxicityScore * 100).toFixed(1)}%

답글이 필요한 경우:
1. **작성자 보호**: 게시글 작성자에 대한 부당한 공격이나 비난이 있어 보호가 필요한 경우
2. **커뮤니티 개선**: 댓글의 표현 방식이나 태도를 개선하도록 유도하여 더 나은 커뮤니티를 만들어야 하는 경우

판단 기준:
- 인신공격, 비난, 욕설 포함 여부
- 건설적이지 않은 부정적 비판 여부
- 커뮤니티 규칙 위반 여부
- 댓글 작성자가 개선할 여지가 있는지

응답은 반드시 다음 JSON 형식으로만 작성해주세요:
{
  "needsReply": true 또는 false,
  "purpose": "protect_author" 또는 "improve_community" 또는 "none",
  "reason": "판단 이유를 구체적으로 설명"
}`;

  try {
    const apiResult = await pRetry(
      async () => {
        try {
          const result = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "당신은 AI 커뮤니티의 모더레이터입니다. 댓글의 적절성을 판단하고 답글이 필요한지 결정합니다. 응답은 항상 JSON 형식으로 작성해주세요."
              },
              { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3,
            store: true,
          });
          return result;
        } catch (error: any) {
          if (isRateLimitError(error)) {
            throw error;
          }
          throw new AbortError(error);
        }
      },
      {
        retries: 3,
        minTimeout: 2000,
        maxTimeout: 10000,
        factor: 2,
      }
    );

    if (apiResult.usage) {
      await logApiUsage("gpt-4o-mini", "analyzeReplyNeed", apiResult.usage.prompt_tokens, apiResult.usage.completion_tokens);
    }

    const response = apiResult.choices[0]?.message?.content || "";
    const parsed = JSON.parse(response);
    return {
      needsReply: parsed.needsReply || false,
      purpose: parsed.purpose || "none",
      reason: parsed.reason || "분석 실패"
    };
  } catch (error) {
    console.error("Reply need analysis error:", error);
    return {
      needsReply: false,
      purpose: "none",
      reason: "분석 중 오류 발생"
    };
  }
}

export async function generateConstructiveFeedback(
  postTitle: string,
  commentContent: string,
  purpose: string,
  analysisReason: string,
  authorPersona?: string
): Promise<string | null> {
  const personaInstruction = authorPersona 
    ? `\n\n당신의 성향/역할: ${authorPersona}\n위 성향에 맞게 답글의 어조와 스타일을 조정해주세요.` 
    : '';
  
  let purposeGuidance = "";
  if (purpose === "protect_author") {
    purposeGuidance = `
목적: 게시글 작성자 보호
- 작성자에 대한 부당한 공격을 논리적으로 반박
- 댓글의 문제점을 객관적으로 지적
- 작성자를 옹호하되 감정적이지 않게`;
  } else if (purpose === "improve_community") {
    purposeGuidance = `
목적: 커뮤니티 문화 개선
- 댓글의 구체적인 문제점을 논리적으로 지적
- 왜 그러한 표현이 문제인지 설명
- 더 건설적이고 나은 표현 방법 제시
- 댓글 작성자가 개선할 수 있도록 유도`;
  }
    
  const inputText = `AI 커뮤니티 게시글 "${postTitle}"에 부적절한 댓글이 달렸습니다.

댓글 내용: ${commentContent}
분석 결과: ${analysisReason}${purposeGuidance}${personaInstruction}

위 목적에 맞는 답글을 150자 이내로 작성해주세요.
- 논리적이고 객관적인 어조 유지
- 감정적이지 않고 교육적으로
- 구체적인 개선 방향 제시`;

  try {
    const apiResult = await pRetry(
      async () => {
        try {
          const result = await openai.responses.create({
            model: GPT_51_MODEL,
            input: inputText,
            text: {
              verbosity: "low"
            },
            reasoning: {
              effort: "low"
            }
          });
          return result;
        } catch (error: any) {
          if (isRateLimitError(error)) {
            throw error;
          }
          throw new AbortError(error);
        }
      },
      {
        retries: 3,
        minTimeout: 2000,
        maxTimeout: 10000,
        factor: 2,
      }
    );

    if (apiResult.usage) {
      await logApiUsage(GPT_51_MODEL, "generateConstructiveFeedback", apiResult.usage.input_tokens || 0, apiResult.usage.output_tokens || 0);
    }

    return apiResult.output_text?.trim() || null;
  } catch (error) {
    console.error("Constructive feedback generation error:", error);
    return null;
  }
}

export async function generateToxicPostModerationReply(
  title: string,
  content: string,
  toxicityScore: number,
  moderationReason: string,
  authorPersona?: string
): Promise<string | null> {
  const personaInstruction = authorPersona 
    ? `\n\n당신의 성향/역할: ${authorPersona}\n위 성향에 맞게 중재 답글의 어조와 스타일을 조정해주세요.` 
    : '';
    
  const inputText = `AI 커뮤니티에 유해한 게시글이 감지되었습니다. 갈등을 완화하고 건설적인 방향으로 유도하는 중재 답글을 작성해주세요.

게시글 제목: ${title}
게시글 내용: ${content}
유해성 점수: ${(toxicityScore * 100).toFixed(1)}%
감지 이유: ${moderationReason}${personaInstruction}

중재 답글 작성 가이드라인:
1. 공격적이지 않고 차분한 어조 유지
2. 게시글의 문제점을 구체적이지만 부드럽게 지적
3. 더 건설적인 표현 방법 제안
4. 커뮤니티 규칙과 서로 존중하는 문화 강조
5. 작성자가 수정하거나 다시 생각해볼 수 있도록 유도

200자 이내로 작성해주세요.`;

  try {
    const apiResult = await pRetry(
      async () => {
        try {
          const result = await openai.responses.create({
            model: GPT_51_MODEL,
            input: inputText,
            text: {
              verbosity: "low"
            },
            reasoning: {
              effort: "medium"
            }
          });
          return result;
        } catch (error: any) {
          if (isRateLimitError(error)) {
            throw error;
          }
          throw new AbortError(error);
        }
      },
      {
        retries: 3,
        minTimeout: 2000,
        maxTimeout: 10000,
        factor: 2,
      }
    );

    if (apiResult.usage) {
      await logApiUsage(GPT_51_MODEL, "generateToxicPostModerationReply", apiResult.usage.input_tokens || 0, apiResult.usage.output_tokens || 0);
    }

    return apiResult.output_text?.trim() || null;
  } catch (error) {
    console.error("Toxic post moderation reply generation error:", error);
    return null;
  }
}

export async function analyzeComment(
  postTitle: string,
  postContent: string,
  commentContent: string,
  parentCommentContent?: string
): Promise<CommentAnalysisResult> {
  const prompt = `다음 댓글을 분석하여 자동으로 대댓글을 달만한 가치가 있는지 판단해주세요.

게시글 제목: ${postTitle}
게시글 내용: ${postContent}
${parentCommentContent ? `원댓글: ${parentCommentContent}\n` : ''}댓글 내용: ${commentContent}

판단 기준:
1. 이 댓글이 질문을 포함하고 있는가?
2. 추가 답변이나 정보가 도움이 될만한 내용인가?
3. 토론을 이어갈 가치가 있는 의견인가?

응답은 반드시 다음 JSON 형식으로만 작성해주세요:
{
  "shouldReply": true 또는 false,
  "reason": "판단 이유를 간단히 설명",
  "reply": "대댓글을 달아야 한다면 여기에 한국어로 유익하고 친절한 대댓글 작성 (150자 이내)"
}`;

  try {
    const apiResult = await pRetry(
      async () => {
        try {
          const result = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "당신은 AI 커뮤니티의 지식이 풍부한 전문가입니다. 댓글을 분석하고 유익한 대댓글을 작성합니다. 응답은 항상 JSON 형식으로 작성해주세요."
              },
              { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
            store: true,
          });
          return result;
        } catch (error: any) {
          if (isRateLimitError(error)) {
            throw error;
          }
          throw new AbortError(error);
        }
      },
      {
        retries: 3,
        minTimeout: 2000,
        maxTimeout: 10000,
        factor: 2,
      }
    );

    if (apiResult.usage) {
      await logApiUsage("gpt-4o-mini", "analyzeComment", apiResult.usage.prompt_tokens, apiResult.usage.completion_tokens);
    }

    const response = apiResult.choices[0]?.message?.content || "";
    const parsed = JSON.parse(response);
    return {
      shouldReply: parsed.shouldReply || false,
      reason: parsed.reason || "분석 실패",
      reply: parsed.reply
    };
  } catch (error) {
    console.error("Comment analysis error:", error);
    return {
      shouldReply: false,
      reason: "분석 중 오류 발생"
    };
  }
}

export async function analyzeCommentIntervention(
  postTitle: string,
  postContent: string,
  commentContent: string,
  commentAuthor: string,
  isReply: boolean,
  parentCommentContent?: string
): Promise<CommentInterventionAnalysis> {
  const replyContext = isReply && parentCommentContent 
    ? `\n답글 대상 댓글: ${parentCommentContent}` 
    : '';
  
  const prompt = `다음 ${isReply ? '답글' : '댓글'}을 분석하여 AI가 개입해야 할 필요성과 수준을 판단해주세요.

게시글 제목: ${postTitle}
게시글 내용: ${postContent}${replyContext}
${isReply ? '답글' : '댓글'} 내용: ${commentContent}
작성자: ${commentAuthor}

판단 기준:
1. **단순 정보성**: 정보만 공유하는 평범한 댓글
2. **초기 피드백 필요**: 작성자에게 긍정적 피드백이나 동기부여가 도움될 상황
3. **감정적 지지 필요**: 작성자가 어려움을 겪고 있거나 격려가 필요한 상황
4. **갈등/공격 상황**: 부정적이거나 논쟁적이지만 AI 중재가 도움될 수 있는 상황

개입 수준:
- **none**: 개입 불필요
- **positive_feedback**: 긍정 피드백/동기부여 제공
- **information_response**: 정보성 답변 제공
- **defender**: 중재 및 건설적 방향 유도

응답은 반드시 다음 JSON 형식으로만 작성해주세요:
{
  "needsIntervention": true 또는 false,
  "actionLevel": "none" 또는 "positive_feedback" 또는 "information_response" 또는 "defender",
  "contentType": "informational" 또는 "needs_feedback" 또는 "needs_support" 또는 "conflict",
  "reason": "판단 이유를 구체적으로 설명"
}`;

  try {
    const apiResult = await pRetry(
      async () => {
        try {
          const result = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "당신은 AI 커뮤니티의 지능형 모더레이터입니다. 댓글을 분석하고 AI 개입의 필요성과 수준을 정확히 판단합니다. 응답은 항상 JSON 형식으로 작성해주세요."
              },
              { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3,
            store: true,
          });
          return result;
        } catch (error: any) {
          if (isRateLimitError(error)) {
            throw error;
          }
          throw new AbortError(error);
        }
      },
      {
        retries: 3,
        minTimeout: 2000,
        maxTimeout: 10000,
        factor: 2,
      }
    );

    if (apiResult.usage) {
      await logApiUsage("gpt-4o-mini", "analyzeCommentIntervention", apiResult.usage.prompt_tokens, apiResult.usage.completion_tokens);
    }

    const response = apiResult.choices[0]?.message?.content || "";
    const parsed = JSON.parse(response);
    return {
      needsIntervention: parsed.needsIntervention || false,
      actionLevel: parsed.actionLevel || "none",
      contentType: parsed.contentType || "informational",
      reason: parsed.reason || "분석 실패"
    };
  } catch (error) {
    console.error("Comment intervention analysis error:", error);
    return {
      needsIntervention: false,
      actionLevel: "none",
      contentType: "informational",
      reason: "분석 중 오류 발생"
    };
  }
}

export async function generateInterventionResponse(
  postTitle: string,
  commentContent: string,
  actionLevel: string,
  analysisReason: string,
  authorPersona?: string,
  parentCommentContent?: string
): Promise<string | null> {
  const personaInstruction = authorPersona 
    ? `\n\n당신의 성향/역할: ${authorPersona}\n위 성향에 맞게 답글의 어조와 스타일을 조정해주세요.` 
    : '';
  
  const parentContext = parentCommentContent 
    ? `\n답글 대상 댓글: ${parentCommentContent}` 
    : '';
  
  let actionGuidance = "";
  if (actionLevel === "positive_feedback") {
    actionGuidance = `
목적: 긍정적 피드백 및 동기부여
- 작성자의 노력이나 시도를 인정
- 격려와 응원의 메시지 전달
- 건설적이고 따뜻한 어조 유지`;
  } else if (actionLevel === "information_response") {
    actionGuidance = `
목적: 정보 제공 및 답변
- 질문이나 정보 요청에 명확한 답변
- 추가 유용한 정보 제공
- 전문적이면서도 친근한 어조`;
  } else if (actionLevel === "defender") {
    actionGuidance = `
목적: 중재 및 건설적 방향 유도
- 갈등 상황을 객관적으로 정리
- 건설적인 대화 방향 제시
- 양측을 존중하면서도 커뮤니티 문화 보호
- 차분하고 공정한 어조`;
  }
    
  const inputText = `AI 커뮤니티 게시글 "${postTitle}"에 다음 댓글이 달렸습니다.${parentContext}

댓글 내용: ${commentContent}
분석 결과: ${analysisReason}${actionGuidance}${personaInstruction}

위 목적과 상황에 맞는 답글을 150자 이내로 작성해주세요.
- 자연스럽고 친근한 어조
- 구체적이고 도움이 되는 내용
- 커뮤니티 문화를 긍정적으로 유도`;

  try {
    const apiResult = await pRetry(
      async () => {
        try {
          const result = await openai.responses.create({
            model: GPT_51_MODEL,
            input: inputText,
            text: {
              verbosity: "low"
            },
            reasoning: {
              effort: "low"
            }
          });
          return result;
        } catch (error: any) {
          if (isRateLimitError(error)) {
            throw error;
          }
          throw new AbortError(error);
        }
      },
      {
        retries: 3,
        minTimeout: 2000,
        maxTimeout: 10000,
        factor: 2,
      }
    );

    if (apiResult.usage) {
      await logApiUsage(GPT_51_MODEL, "generateInterventionResponse", apiResult.usage.input_tokens || 0, apiResult.usage.output_tokens || 0);
    }

    return apiResult.output_text?.trim() || null;
  } catch (error) {
    console.error("Intervention response generation error:", error);
    return null;
  }
}

export async function generateAggressiveIntervention(
  postTitle: string,
  commentContent: string,
  toxicityScore: number,
  authorPersona?: string
): Promise<string | null> {
  const personaInstruction = authorPersona 
    ? `\n\n당신의 성향/역할: ${authorPersona}\n위 성향에 맞게 답글의 어조와 스타일을 조정해주세요.` 
    : '';
  
  const inputText = `AI 커뮤니티 게시글 "${postTitle}"에 공격적이고 악성적인 댓글이 달렸습니다.

댓글 내용: ${commentContent}
유해성 점수: ${(toxicityScore * 100).toFixed(1)}%${personaInstruction}

이 악성 댓글에 대해 강력하게 개입하는 답글을 작성해주세요.
목적: 공격적인 악성 콘텐츠에 대한 직접적 개입
- 댓글의 문제점을 명확하고 단호하게 지적
- 커뮤니티 규칙 위반 사항 명시
- 건설적인 대화 방식 제시
- 강력하지만 감정적이지 않은 어조
- 150자 이내로 작성`;

  try {
    const apiResult = await pRetry(
      async () => {
        try {
          const result = await openai.responses.create({
            model: GPT_51_MODEL,
            input: inputText,
            text: {
              verbosity: "low"
            },
            reasoning: {
              effort: "medium"
            }
          });
          return result;
        } catch (error: any) {
          if (isRateLimitError(error)) {
            throw error;
          }
          throw new AbortError(error);
        }
      },
      {
        retries: 3,
        minTimeout: 2000,
        maxTimeout: 10000,
        factor: 2,
      }
    );

    if (apiResult.usage) {
      await logApiUsage(GPT_51_MODEL, "generateAggressiveIntervention", apiResult.usage.input_tokens || 0, apiResult.usage.output_tokens || 0);
    }

    return apiResult.output_text?.trim() || null;
  } catch (error) {
    console.error("Aggressive intervention generation error:", error);
    return null;
  }
}

export async function generateBotReplyToUserComment(
  postTitle: string,
  botCommentContent: string,
  userReplyContent: string,
  authorPersona?: string
): Promise<string | null> {
  const personaInstruction = authorPersona 
    ? `\n\n당신의 성향/역할: ${authorPersona}\n위 성향에 맞게 답글의 어조와 스타일을 조정해주세요.` 
    : '';
  
  const inputText = `AI 커뮤니티 게시글 "${postTitle}"에 당신이 달았던 댓글에 사용자가 답글을 달았습니다.

당신의 원래 댓글: ${botCommentContent}
사용자의 답글: ${userReplyContent}${personaInstruction}

사용자의 답글에 자연스럽고 친근하게 화답하는 답글을 작성해주세요.
- 사용자의 의견이나 질문에 적절히 응답
- 대화를 이어가는 자연스러운 어조
- 필요시 추가 정보나 격려 제공
- 150자 이내로 작성
- 친근하고 공감하는 태도 유지`;

  try {
    const apiResult = await pRetry(
      async () => {
        try {
          const result = await openai.responses.create({
            model: GPT_51_MODEL,
            input: inputText,
            text: {
              verbosity: "low"
            },
            reasoning: {
              effort: "low"
            }
          });
          return result;
        } catch (error: any) {
          if (isRateLimitError(error)) {
            throw error;
          }
          throw new AbortError(error);
        }
      },
      {
        retries: 3,
        minTimeout: 2000,
        maxTimeout: 10000,
        factor: 2,
      }
    );

    if (apiResult.usage) {
      await logApiUsage(GPT_51_MODEL, "generateBotReplyToUserComment", apiResult.usage.input_tokens || 0, apiResult.usage.output_tokens || 0);
    }

    return apiResult.output_text?.trim() || null;
  } catch (error) {
    console.error("Bot reply generation error:", error);
    return null;
  }
}
