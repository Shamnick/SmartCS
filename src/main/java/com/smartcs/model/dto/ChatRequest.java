package com.smartcs.model.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 聊天请求DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatRequest {

    /**
     * 用户消息
     */
    @NotBlank(message = "消息内容不能为空")
    private String message;

    /**
     * 会话ID - 用于上下文管理
     */
    private String sessionId;

    /**
     * 是否启用RAG检索
     */
    @Builder.Default
    private boolean enableRag = true;

    /**
     * 是否启用Function Calling
     */
    @Builder.Default
    private boolean enableFunctionCalling = true;

    /**
     * 用户ID
     */
    private String userId;
}
