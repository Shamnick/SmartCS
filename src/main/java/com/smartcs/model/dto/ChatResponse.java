package com.smartcs.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 聊天响应DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatResponse {

    /**
     * 回答内容
     */
    private String answer;

    /**
     * 会话ID
     */
    private String sessionId;

    /**
     * 引用的知识来源
     */
    private List<KnowledgeSource> sources;

    /**
     * 是否使用了RAG
     */
    private boolean ragUsed;

    /**
     * 是否调用了Function
     */
    private boolean functionCalled;

    /**
     * 调用的Function名称
     */
    private String functionName;

    /**
     * 响应耗时(ms)
     */
    private long costTime;

    /**
     * 响应时间
     */
    @Builder.Default
    private LocalDateTime timestamp = LocalDateTime.now();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class KnowledgeSource {
        private String documentName;
        private String content;
        private double score;
    }
}
