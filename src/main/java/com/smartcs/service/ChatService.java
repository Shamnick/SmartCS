package com.smartcs.service;

import com.smartcs.model.dto.ChatRequest;
import com.smartcs.model.dto.ChatResponse;
import com.smartcs.service.context.ConversationContextManager;
import com.smartcs.service.function.FunctionCallingService;
import com.smartcs.service.rag.RagRetrievalService;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.output.Response;
import dev.langchain4j.store.embedding.EmbeddingMatch;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * 核心聊天服务 - 整合LLM、RAG、Function Calling
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatLanguageModel chatLanguageModel;
    private final ConversationContextManager contextManager;
    private final RagRetrievalService ragRetrievalService;
    private final FunctionCallingService functionCallingService;

    /**
     * 处理聊天请求 - 主入口
     */
    public ChatResponse chat(ChatRequest request) {
        long startTime = System.currentTimeMillis();
        String sessionId = request.getSessionId();

        // 如果没有sessionId，生成一个
        if (sessionId == null || sessionId.isEmpty()) {
            sessionId = contextManager.generateSessionId();
        }

        log.info("处理聊天请求 - 会话: {}, 消息长度: {}", sessionId,
                request.getMessage() == null ? 0 : request.getMessage().length());

        try {
            // 1. RAG检索
            String ragContext = "";
            List<EmbeddingMatch<TextSegment>> ragMatches = Collections.emptyList();
            boolean ragUsed = false;

            if (request.isEnableRag()) {
                try {
                    ragMatches = ragRetrievalService.retrieve(request.getMessage());
                    if (!ragMatches.isEmpty()) {
                        ragContext = ragRetrievalService.retrieveAndFormat(request.getMessage());
                        ragUsed = true;
                        log.info("RAG检索到{}条相关文档", ragMatches.size());
                    }
                } catch (Exception e) {
                    log.warn("RAG检索异常，将不使用知识库");
                }
            }

            // 2. 构建消息列表
            List<ChatMessage> messages = buildMessages(sessionId, request, ragContext);

            // 3. 调用大模型
            Response<AiMessage> response = chatLanguageModel.generate(messages);
            String aiAnswer = functionCallingService.sanitizeForUser(response.content().text());
            log.info("大模型返回结果长度: {}", aiAnswer.length());

            // 4. Function Calling处理
            boolean functionCalled = false;

            if (request.isEnableFunctionCalling() && functionCallingService.containsFunctionCall(aiAnswer)) {
                FunctionCallingService.FunctionCallResult callResult =
                        functionCallingService.parseAndExecute(aiAnswer);

                if (callResult != null && callResult.isSuccess()) {
                    functionCalled = true;

                    // 将函数结果发送给大模型进行整合回答
                    aiAnswer = functionCallingService.sanitizeForUser(
                            integrateFunctionResult(messages, aiAnswer, callResult)
                    );
                }
            }

            aiAnswer = functionCallingService.sanitizeForUser(aiAnswer);

            // 5. 更新上下文
            contextManager.addUserMessage(sessionId, request.getMessage());
            contextManager.addAiMessage(sessionId, aiAnswer);

            // 6. 构建响应
            long costTime = System.currentTimeMillis() - startTime;
            return ChatResponse.builder()
                    .answer(aiAnswer)
                    .sessionId(sessionId)
                    .ragUsed(ragUsed)
                    .sources(ragUsed ? ragRetrievalService.toKnowledgeSources(ragMatches) : null)
                    .functionCalled(functionCalled)
                    .functionName(functionCalled ? "business_lookup" : null)
                    .costTime(costTime)
                    .build();

        } catch (Exception e) {
            log.error("聊天处理异常", e);
            long costTime = System.currentTimeMillis() - startTime;
            return ChatResponse.builder()
                    .answer("抱歉，系统处理异常，请稍后重试。")
                    .sessionId(sessionId)
                    .costTime(costTime)
                    .build();
        }
    }

    /**
     * 异步聊天处理
     */
    @Async("chatExecutor")
    public CompletableFuture<ChatResponse> chatAsync(ChatRequest request) {
        return CompletableFuture.completedFuture(chat(request));
    }

    /**
     * 构建消息列表
     */
    private List<ChatMessage> buildMessages(String sessionId, ChatRequest request, String ragContext) {
        List<ChatMessage> messages = new ArrayList<>();

        // 获取历史上下文
        List<ChatMessage> context = contextManager.getContext(sessionId);

        // 构建增强的系统提示词
        StringBuilder systemPrompt = new StringBuilder();
        systemPrompt.append(((SystemMessage) context.get(0)).text());

        // 添加RAG上下文
        if (!ragContext.isEmpty()) {
            systemPrompt.append("\n\n").append(ragContext);
        }

        // 添加Function Calling提示
        if (request.isEnableFunctionCalling()) {
            systemPrompt.append(functionCallingService.buildFunctionCallingPrompt());
        }

        messages.add(new SystemMessage(systemPrompt.toString()));

        // 添加历史对话(跳过系统消息)
        for (int i = 1; i < context.size(); i++) {
            messages.add(context.get(i));
        }

        // 添加当前用户消息
        messages.add(new UserMessage(request.getMessage()));

        return messages;
    }

    /**
     * 整合函数调用结果 - 将函数返回值交给大模型总结
     */
    private String integrateFunctionResult(List<ChatMessage> messages,
                                            String originalAnswer,
                                            FunctionCallingService.FunctionCallResult callResult) {
        log.info("整合函数调用结果: {}", callResult.getFunctionName());

        messages.add(new AiMessage(originalAnswer));
        messages.add(new UserMessage(
                String.format("函数 %s 的调用结果如下，请基于结果用自然语言回答用户的问题:\n%s",
                        callResult.getFunctionName(), callResult.getResult())));

        Response<AiMessage> response = chatLanguageModel.generate(messages);
        return response.content().text();
    }

    /**
     * 清除会话
     */
    public void clearSession(String sessionId) {
        contextManager.clearContext(sessionId);
    }

    /**
     * 获取活跃会话数
     */
    public int getActiveSessionCount() {
        return contextManager.getActiveSessionCount();
    }
}
