package com.smartcs.controller;

import com.smartcs.model.common.R;
import com.smartcs.model.dto.ChatRequest;
import com.smartcs.model.dto.ChatResponse;
import com.smartcs.service.ChatService;
import com.smartcs.service.context.ConversationContextManager;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

/**
 * 聊天控制器 - 提供问答API
 */
@Slf4j
@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;
    private final ConversationContextManager contextManager;

    /**
     * 同步聊天接口
     */
    @PostMapping
    public R<ChatResponse> chat(@Valid @RequestBody ChatRequest request) {
        log.info("收到聊天请求: {}", request.getMessage());
        ChatResponse response = chatService.chat(request);
        return R.ok(response);
    }

    /**
     * 异步聊天接口
     */
    @PostMapping("/async")
    public CompletableFuture<R<ChatResponse>> chatAsync(@Valid @RequestBody ChatRequest request) {
        log.info("收到异步聊天请求: {}", request.getMessage());
        return chatService.chatAsync(request)
                .thenApply(R::ok);
    }

    /**
     * 清除会话上下文
     */
    @DeleteMapping("/session/{sessionId}")
    public R<Void> clearSession(@PathVariable String sessionId) {
        chatService.clearSession(sessionId);
        return R.ok();
    }

    /**
     * 获取系统状态
     */
    @GetMapping("/status")
    public R<Map<String, Object>> getStatus() {
        Map<String, Object> status = Map.of(
                "activeSessions", chatService.getActiveSessionCount(),
                "status", "running"
        );
        return R.ok(status);
    }

    /**
     * 获取所有会话列表
     */
    @GetMapping("/sessions")
    public R<List<Map<String, String>>> listSessions() {
        List<Map<String, String>> sessions = contextManager.getAllSessionIds().stream()
                .map(id -> Map.of(
                        "sessionId", id,
                        "title", contextManager.getSessionTitle(id)
                ))
                .collect(Collectors.toList());
        return R.ok(sessions);
    }

    /**
     * 获取某个会话的消息历史
     */
    @GetMapping("/sessions/{sessionId}/messages")
    public R<List<Map<String, String>>> getSessionMessages(@PathVariable String sessionId) {
        return R.ok(contextManager.getSessionMessages(sessionId));
    }
}
